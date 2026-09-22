const express = require('express');
const pool = require('../db');
const { requireAuth, requireSocio } = require('../middlewares/auth');
const { registrar } = require('../utils/auditoria');

const router = express.Router();

// Cadastrar material — só sócio
router.post('/materiais', requireSocio, async (req, res) => {
  const { nome, unidade, minimo } = req.body;
  if (!nome || !unidade) {
    return res.status(400).json({ erro: 'Campos obrigatórios: nome, unidade' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO tocadalagartixa.materiais (nome, unidade, quantidade, minimo, status)
       VALUES ($1, $2, 0, $3, true) RETURNING *`,
      [nome, unidade, minimo || 0]
    );
    await registrar({
      usuarioId: req.session.usuario.id, modulo: 'estoque', acao: 'cadastro_material',
      entidade: 'materiais', entidadeId: result.rows[0].id, depois: result.rows[0],
    });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao cadastrar material' });
  }
});

// Listar materiais — todos autorizados; mostra alerta de estoque baixo
router.get('/materiais', requireAuth, async (req, res) => {
  const apenasAtivos = req.session.usuario.perfil_id !== 1; // residente só vê ativos
  try {
    const result = await pool.query(
      `SELECT id, nome, unidade, quantidade, minimo, status,
              (quantidade <= minimo) AS estoque_baixo
       FROM tocadalagartixa.materiais
       ${apenasAtivos ? 'WHERE status = true' : ''}
       ORDER BY nome`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao listar materiais' });
  }
});

// Ativar/desativar material — só sócio
router.patch('/materiais/:id/status', requireSocio, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (typeof status !== 'boolean') {
    return res.status(400).json({ erro: 'Campo "status" deve ser true ou false' });
  }
  try {
    const antesResult = await pool.query('SELECT * FROM tocadalagartixa.materiais WHERE id = $1', [id]);
    if (antesResult.rows.length === 0) {
      return res.status(404).json({ erro: 'Material não encontrado' });
    }
    const result = await pool.query(
      `UPDATE tocadalagartixa.materiais SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id]
    );
    await registrar({
      usuarioId: req.session.usuario.id, modulo: 'estoque',
      acao: status ? 'ativacao_material' : 'desativacao_material',
      entidade: 'materiais', entidadeId: id, antes: antesResult.rows[0], depois: result.rows[0],
    });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao alterar status do material' });
  }
});

// Registrar movimentação (entrada ou saída)
// tipo_id: 1 = entrada (só sócio), 2 = saída (todos)
router.post('/movimentacoes', requireAuth, async (req, res) => {
  const { material_id, tipo_id, quantidade, observacao } = req.body;
  const usuarioId = req.session.usuario.id;
  const perfilId = req.session.usuario.perfil_id;

  if (!material_id || !tipo_id || !quantidade) {
    return res.status(400).json({ erro: 'Campos obrigatórios: material_id, tipo_id, quantidade' });
  }
  if (Number(tipo_id) === 1 && perfilId !== 1) {
    return res.status(403).json({ erro: 'Somente sócios podem registrar entrada de estoque' });
  }
  if (![1, 2].includes(Number(tipo_id))) {
    return res.status(400).json({ erro: 'tipo_id inválido (1 = entrada, 2 = saída)' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const materialResult = await client.query(
      'SELECT quantidade, status FROM tocadalagartixa.materiais WHERE id = $1 FOR UPDATE',
      [material_id]
    );
    if (materialResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ erro: 'Material não encontrado' });
    }
    const material = materialResult.rows[0];
    if (!material.status) {
      await client.query('ROLLBACK');
      return res.status(400).json({ erro: 'Material desativado, não participa de movimentações' });
    }

    const quantidadeAtual = Number(material.quantidade);
    const delta = Number(tipo_id) === 1 ? Number(quantidade) : -Number(quantidade);
    const novaQuantidade = quantidadeAtual + delta;

    if (novaQuantidade < 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ erro: 'Quantidade insuficiente em estoque para essa saída' });
    }

    await client.query(
      'UPDATE tocadalagartixa.materiais SET quantidade = $1 WHERE id = $2',
      [novaQuantidade, material_id]
    );

    const movResult = await client.query(
      `INSERT INTO tocadalagartixa.movimentacoes_estoque (material_id, tipo_id, quantidade, usuario_id, observacao)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [material_id, tipo_id, quantidade, usuarioId, observacao || null]
    );

    if (Number(tipo_id) === 1) {
      await client.query(
        `INSERT INTO tocadalagartixa.auditoria (usuario_id, modulo, acao, entidade, entidade_id, depois)
         VALUES ($1, 'estoque', 'entrada_estoque', 'movimentacoes_estoque', $2, $3)`,
        [usuarioId, movResult.rows[0].id, JSON.stringify(movResult.rows[0])]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ movimentacao: movResult.rows[0], quantidade_atual: novaQuantidade });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ erro: 'Erro ao registrar movimentação' });
  } finally {
    client.release();
  }
});

// Editar/excluir movimentação própria (ou qualquer uma, se sócio)
router.delete('/movimentacoes/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const solicitante = req.session.usuario;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const movResult = await client.query(
      'SELECT * FROM tocadalagartixa.movimentacoes_estoque WHERE id = $1 FOR UPDATE',
      [id]
    );
    if (movResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ erro: 'Movimentação não encontrada' });
    }
    const mov = movResult.rows[0];
    if (solicitante.perfil_id !== 1 && mov.usuario_id !== solicitante.id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    // Reverte o efeito da movimentação no estoque
    const materialResult = await client.query(
      'SELECT quantidade FROM tocadalagartixa.materiais WHERE id = $1 FOR UPDATE',
      [mov.material_id]
    );
    const quantidadeAtual = Number(materialResult.rows[0].quantidade);
    const delta = Number(mov.tipo_id) === 1 ? -Number(mov.quantidade) : Number(mov.quantidade);
    const novaQuantidade = quantidadeAtual + delta;

    if (novaQuantidade < 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ erro: 'Não é possível excluir: deixaria o estoque negativo' });
    }

    await client.query('UPDATE tocadalagartixa.materiais SET quantidade = $1 WHERE id = $2', [novaQuantidade, mov.material_id]);
    await client.query('DELETE FROM tocadalagartixa.movimentacoes_estoque WHERE id = $1', [id]);
    await client.query(
      `INSERT INTO tocadalagartixa.auditoria (usuario_id, modulo, acao, entidade, entidade_id, antes)
       VALUES ($1, 'estoque', 'exclusao_movimentacao', 'movimentacoes_estoque', $2, $3)`,
      [solicitante.id, id, JSON.stringify(mov)]
    );

    await client.query('COMMIT');
    res.json({ mensagem: 'Movimentação excluída e estoque revertido' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ erro: 'Erro ao excluir movimentação' });
  } finally {
    client.release();
  }
});

module.exports = router;
