const express = require('express');
const pool = require('../db');
const { requireAuth, requireSocio } = require('../middlewares/auth');
const { registrar } = require('../utils/auditoria');

const router = express.Router();
const CATEGORIA_MELHORIAS = 5;

// Saldo acumulado atual da categoria Melhorias (último saldo_final registrado)
async function saldoAtualMelhorias() {
  const result = await pool.query(
    `SELECT saldo_final FROM tocadalagartixa.saldos_mensais
     WHERE categoria_id = $1 ORDER BY mes DESC LIMIT 1`,
    [CATEGORIA_MELHORIAS]
  );
  return result.rows.length > 0 ? Number(result.rows[0].saldo_final) : 0;
}

// Verifica se a melhoria atual (menor prioridade entre em_progresso/meta_atingida)
// já atingiu o valor-alvo com o saldo disponível, e atualiza o estado automaticamente.
async function atualizarEstadoMelhoriaAtual() {
  const saldo = await saldoAtualMelhorias();

  const atualResult = await pool.query(
    `SELECT id, valor_alvo, estado_id FROM tocadalagartixa.melhorias
     WHERE estado_id IN (1, 2) ORDER BY prioridade ASC LIMIT 1`
  );
  if (atualResult.rows.length === 0) return null;

  const atual = atualResult.rows[0];
  if (saldo >= Number(atual.valor_alvo) && atual.estado_id === 1) {
    await pool.query(`UPDATE tocadalagartixa.melhorias SET estado_id = 2 WHERE id = $1`, [atual.id]);
    atual.estado_id = 2;
  }
  return { ...atual, saldo_disponivel: saldo };
}

// Cadastrar melhoria — só sócio
router.post('/', requireSocio, async (req, res) => {
  const { nome, valor_alvo, prioridade } = req.body;
  if (!nome || !valor_alvo || prioridade === undefined) {
    return res.status(400).json({ erro: 'Campos obrigatórios: nome, valor_alvo, prioridade' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO tocadalagartixa.melhorias (nome, valor_alvo, prioridade, estado_id)
       VALUES ($1, $2, $3, 1) RETURNING *`,
      [nome, valor_alvo, prioridade]
    );
    await registrar({
      usuarioId: req.session.usuario.id, modulo: 'melhorias', acao: 'criacao',
      entidade: 'melhorias', entidadeId: result.rows[0].id, depois: result.rows[0],
    });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao cadastrar melhoria' });
  }
});

// Listar fila completa — só sócio
router.get('/', requireSocio, async (req, res) => {
  try {
    await atualizarEstadoMelhoriaAtual();
    const result = await pool.query(
      `SELECT m.*, e.nome AS estado
       FROM tocadalagartixa.melhorias m
       JOIN tocadalagartixa.enum_estado_melhoria e ON e.id = m.estado_id
       ORDER BY m.prioridade`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao listar melhorias' });
  }
});

// Alterar prioridade — só sócio
router.patch('/:id/prioridade', requireSocio, async (req, res) => {
  const { id } = req.params;
  const { prioridade } = req.body;
  if (prioridade === undefined) {
    return res.status(400).json({ erro: 'Campo obrigatório: prioridade' });
  }
  try {
    const antesResult = await pool.query('SELECT prioridade FROM tocadalagartixa.melhorias WHERE id = $1', [id]);
    if (antesResult.rows.length === 0) return res.status(404).json({ erro: 'Melhoria não encontrada' });

    const result = await pool.query(
      `UPDATE tocadalagartixa.melhorias SET prioridade = $1 WHERE id = $2 RETURNING *`,
      [prioridade, id]
    );
    await registrar({
      usuarioId: req.session.usuario.id, modulo: 'melhorias', acao: 'alteracao_prioridade',
      entidade: 'melhorias', entidadeId: id, antes: antesResult.rows[0], depois: result.rows[0],
    });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao alterar prioridade' });
  }
});

// Alterar valor-alvo — só sócio
router.patch('/:id/valor-alvo', requireSocio, async (req, res) => {
  const { id } = req.params;
  const { valor_alvo } = req.body;
  if (!valor_alvo) {
    return res.status(400).json({ erro: 'Campo obrigatório: valor_alvo' });
  }
  try {
    const result = await pool.query(
      `UPDATE tocadalagartixa.melhorias SET valor_alvo = $1 WHERE id = $2 RETURNING *`,
      [valor_alvo, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ erro: 'Melhoria não encontrada' });
    await atualizarEstadoMelhoriaAtual();
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao alterar valor-alvo' });
  }
});

// Finalizar melhoria — só sócio. Registra o gasto real na categoria Melhorias
// e libera a próxima da fila automaticamente (via prioridade).
router.post('/:id/finalizar', requireSocio, async (req, res) => {
  const { id } = req.params;
  const { valor_gasto, mes } = req.body;
  if (!valor_gasto || !mes) {
    return res.status(400).json({ erro: 'Campos obrigatórios: valor_gasto, mes (AAAA-MM, mês corrente aberto)' });
  }
  const mesCompetencia = `${mes.slice(0, 7)}-01`;

  const fechamento = await pool.query(
    'SELECT fechado FROM tocadalagartixa.fechamentos WHERE mes = $1',
    [mesCompetencia]
  );
  if (fechamento.rows.length > 0 && fechamento.rows[0].fechado) {
    return res.status(423).json({ erro: 'Mês fechado. Reabra o mês para finalizar melhorias com gasto nele.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const melhoriaResult = await client.query(
      'SELECT * FROM tocadalagartixa.melhorias WHERE id = $1 FOR UPDATE',
      [id]
    );
    if (melhoriaResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ erro: 'Melhoria não encontrada' });
    }
    if (melhoriaResult.rows[0].estado_id === 3) {
      await client.query('ROLLBACK');
      return res.status(409).json({ erro: 'Melhoria já finalizada' });
    }

    await client.query(
      `UPDATE tocadalagartixa.melhorias
       SET estado_id = 3, valor_gasto = $1, data_finalizacao = now()
       WHERE id = $2`,
      [valor_gasto, id]
    );

    await client.query(
      `INSERT INTO tocadalagartixa.lancamentos_financeiros
        (categoria_id, tipo_id, valor, mes_competencia, usuario_id, descricao)
       VALUES ($1, 2, $2, $3, $4, $5)`,
      [CATEGORIA_MELHORIAS, valor_gasto, mesCompetencia, req.session.usuario.id, `Finalização: ${melhoriaResult.rows[0].nome}`]
    );

    await client.query('COMMIT');
    res.json({ mensagem: 'Melhoria finalizada. Lance o gasto no fechamento do mês para refletir no saldo.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ erro: 'Erro ao finalizar melhoria' });
  } finally {
    client.release();
  }
});

// Visão do tatuador — só o item atual, acumulado e progresso (sem caixa total)
router.get('/atual', requireAuth, async (req, res) => {
  try {
    await atualizarEstadoMelhoriaAtual();

    const atualResult = await pool.query(
      `SELECT m.nome, m.valor_alvo, m.estado_id, e.nome AS estado
       FROM tocadalagartixa.melhorias m
       JOIN tocadalagartixa.enum_estado_melhoria e ON e.id = m.estado_id
       WHERE m.estado_id IN (1, 2) ORDER BY m.prioridade LIMIT 1`
    );

    const saldo = await saldoAtualMelhorias();

    const ultimaResult = await pool.query(
      `SELECT nome, data_finalizacao FROM tocadalagartixa.melhorias
       WHERE estado_id = 3 ORDER BY data_finalizacao DESC LIMIT 1`
    );

    if (atualResult.rows.length === 0) {
      return res.json({
        melhoria_atual: null,
        mensagem: 'Nenhuma melhoria em andamento no momento',
        ultima_melhoria_adquirida: ultimaResult.rows[0] || null,
      });
    }

    const atual = atualResult.rows[0];
    const progresso = Math.min(100, (saldo / Number(atual.valor_alvo)) * 100);

    res.json({
      melhoria_atual: atual.nome,
      valor_alvo: atual.valor_alvo,
      valor_acumulado: saldo,
      progresso_percentual: Math.round(progresso * 100) / 100,
      estado: atual.estado,
      ultima_melhoria_adquirida: ultimaResult.rows[0] || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao consultar meta coletiva' });
  }
});

router.delete("/:id", requireSocio, async (req, res) => {
  const { id } = req.params;
  try {
    const atual = await pool.query("SELECT * FROM tocadalagartixa.melhorias WHERE id = $1", [id]);
    if (atual.rows.length === 0) {
      return res.status(404).json({ erro: "Melhoria não encontrada" });
    }
    if (atual.rows[0].estado_id !== 1) {
      return res.status(409).json({ erro: "Só é possível excluir itens que ainda estão em progresso (não iniciados ou finalizados)" });
    }
    await pool.query("DELETE FROM tocadalagartixa.melhorias WHERE id = $1", [id]);
    await registrar({
      usuarioId: req.session.usuario.id, modulo: "melhorias", acao: "exclusao",
      entidade: "melhorias", entidadeId: id, antes: atual.rows[0],
    });
    res.json({ mensagem: "Melhoria removida da fila" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao excluir melhoria" });
  }
});

module.exports = router;
