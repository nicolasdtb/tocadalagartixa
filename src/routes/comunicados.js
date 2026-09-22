const express = require('express');
const pool = require('../db');
const { requireAuth, requireSocio } = require('../middlewares/auth');

const router = express.Router();

// Criar comunicado (título + primeira versão de conteúdo) — só sócio
router.post('/', requireSocio, async (req, res) => {
  const { titulo, conteudo, obrigatorio } = req.body;
  if (!titulo || !conteudo) {
    return res.status(400).json({ erro: 'Campos obrigatórios: titulo, conteudo' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const comunicadoResult = await client.query(
      `INSERT INTO tocadalagartixa.comunicados (titulo, obrigatorio) VALUES ($1, $2) RETURNING *`,
      [titulo, !!obrigatorio]
    );
    const comunicado = comunicadoResult.rows[0];

    const versaoResult = await client.query(
      `INSERT INTO tocadalagartixa.comunicados_versoes
        (comunicado_id, versao, conteudo, publicado_por, versao_base)
       VALUES ($1, 1, $2, $3, NULL) RETURNING *`,
      [comunicado.id, conteudo, req.session.usuario.id]
    );

    await client.query('COMMIT');
    res.status(201).json({ ...comunicado, versao_atual: versaoResult.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ erro: 'Erro ao criar comunicado' });
  } finally {
    client.release();
  }
});

// Editar/publicar nova versão — sócio. Aviso não-bloqueante se versao_base estiver desatualizada.
router.put('/:id', requireSocio, async (req, res) => {
  const { id } = req.params;
  const { conteudo, versao_base } = req.body;
  if (!conteudo || versao_base === undefined) {
    return res.status(400).json({ erro: 'Campos obrigatórios: conteudo, versao_base (versão sobre a qual a edição foi iniciada)' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const comunicadoResult = await client.query(
      'SELECT * FROM tocadalagartixa.comunicados WHERE id = $1 AND is_deleted = false',
      [id]
    );
    if (comunicadoResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ erro: 'Comunicado não encontrado' });
    }

    const ultimaVersaoResult = await client.query(
      `SELECT versao FROM tocadalagartixa.comunicados_versoes
       WHERE comunicado_id = $1 ORDER BY versao DESC LIMIT 1`,
      [id]
    );
    const ultimaVersao = ultimaVersaoResult.rows[0].versao;
    const novaVersao = ultimaVersao + 1;
    const conflito = Number(versao_base) < ultimaVersao;

    const versaoResult = await client.query(
      `INSERT INTO tocadalagartixa.comunicados_versoes
        (comunicado_id, versao, conteudo, publicado_por, versao_base)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, novaVersao, conteudo, req.session.usuario.id, versao_base]
    );

    if (conflito) {
      await client.query(
        `INSERT INTO tocadalagartixa.auditoria (usuario_id, modulo, acao, entidade, entidade_id, depois)
         VALUES ($1, 'comunicados', 'publicacao_com_conflito', 'comunicados_versoes', $2, $3)`,
        [req.session.usuario.id, versaoResult.rows[0].id, JSON.stringify({ versao_base, ultima_versao_no_momento: ultimaVersao })]
      );
    }

    await client.query('COMMIT');
    res.json({
      versao_publicada: versaoResult.rows[0],
      aviso: conflito
        ? `Existe uma versão mais nova (v${ultimaVersao}) publicada desde o início desta edição. Publicado mesmo assim como v${novaVersao}.`
        : null,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ erro: 'Erro ao publicar edição' });
  } finally {
    client.release();
  }
});

// Listar comunicados ativos, com conteúdo da última versão e status de confirmação do usuário logado
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.titulo, c.obrigatorio,
              v.versao AS versao_atual, v.conteudo, v.publicado_em,
              EXISTS (
                SELECT 1 FROM tocadalagartixa.comunicados_confirmacoes cc
                WHERE cc.versao_id = v.id AND cc.usuario_id = $1
              ) AS confirmado_pelo_usuario
       FROM tocadalagartixa.comunicados c
       JOIN LATERAL (
         SELECT * FROM tocadalagartixa.comunicados_versoes
         WHERE comunicado_id = c.id ORDER BY versao DESC LIMIT 1
       ) v ON true
       WHERE c.is_deleted = false
       ORDER BY v.publicado_em DESC`,
      [req.session.usuario.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao listar comunicados' });
  }
});

// Histórico completo de versões — só sócio
router.get('/:id/versoes', requireSocio, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT * FROM tocadalagartixa.comunicados_versoes WHERE comunicado_id = $1 ORDER BY versao`,
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao listar versões' });
  }
});

// Confirmar leitura da versão atual (obrigatório ou não)
router.post('/:id/confirmar', requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const versaoResult = await pool.query(
      `SELECT id FROM tocadalagartixa.comunicados_versoes
       WHERE comunicado_id = $1 ORDER BY versao DESC LIMIT 1`,
      [id]
    );
    if (versaoResult.rows.length === 0) {
      return res.status(404).json({ erro: 'Comunicado não encontrado' });
    }
    const versaoId = versaoResult.rows[0].id;

    await pool.query(
      `INSERT INTO tocadalagartixa.comunicados_confirmacoes (versao_id, usuario_id)
       VALUES ($1, $2) ON CONFLICT (versao_id, usuario_id) DO NOTHING`,
      [versaoId, req.session.usuario.id]
    );

    res.json({ mensagem: 'Leitura confirmada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao confirmar leitura' });
  }
});

// Excluir (soft delete) — só sócio. Preserva versões e auditoria.
router.delete('/:id', requireSocio, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `UPDATE tocadalagartixa.comunicados SET is_deleted = true, deleted_at = now()
       WHERE id = $1 AND is_deleted = false RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'Comunicado não encontrado ou já excluído' });
    }

    await pool.query(
      `INSERT INTO tocadalagartixa.auditoria (usuario_id, modulo, acao, entidade, entidade_id, antes)
       VALUES ($1, 'comunicados', 'exclusao', 'comunicados', $2, $3)`,
      [req.session.usuario.id, id, JSON.stringify(result.rows[0])]
    );

    res.json({ mensagem: 'Comunicado excluído' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao excluir comunicado' });
  }
});

module.exports = router;
