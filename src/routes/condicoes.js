const express = require('express');
const pool = require('../db');
const { requireAuth, requireSocio } = require('../middlewares/auth');
const { registrar } = require('../utils/auditoria');

const router = express.Router();

// Documento "Sobre o estúdio" + situação do aceite do usuário logado (versão atual).
router.get('/', requireAuth, async (req, res) => {
  try {
    const d = await pool.query('SELECT conteudo, versao, atualizado_em FROM tocadalagartixa.sobre_estudio WHERE id = 1');
    if (!d.rows[0]) return res.status(404).json({ erro: 'Documento não encontrado' });
    const a = await pool.query(
      'SELECT aceito_em FROM tocadalagartixa.aceites_condicoes WHERE usuario_id = $1 AND versao = $2',
      [req.session.usuario.id, d.rows[0].versao]
    );
    res.json({ ...d.rows[0], aceito: a.rows.length > 0, aceito_em: a.rows[0]?.aceito_em || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao carregar o documento' });
  }
});

router.post('/aceitar', requireAuth, async (req, res) => {
  try {
    await pool.query(
      `INSERT INTO tocadalagartixa.aceites_condicoes (usuario_id, versao)
       SELECT $1, versao FROM tocadalagartixa.sobre_estudio WHERE id = 1
       ON CONFLICT (usuario_id, versao) DO NOTHING`,
      [req.session.usuario.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao registrar aceite' });
  }
});

// Edição — só sócio. "exigir_novo_aceite" sobe a versão: todos os residentes precisam aceitar de novo.
router.put('/', requireSocio, async (req, res) => {
  const { conteudo, exigir_novo_aceite } = req.body;
  if (typeof conteudo !== 'string' || conteudo.trim().length < 10 || conteudo.length > 60000) {
    return res.status(400).json({ erro: 'Conteúdo inválido' });
  }
  try {
    const antes = await pool.query('SELECT versao FROM tocadalagartixa.sobre_estudio WHERE id = 1');
    const r = await pool.query(
      `UPDATE tocadalagartixa.sobre_estudio
       SET conteudo = $1, versao = versao + $2, atualizado_em = now(), atualizado_por = $3
       WHERE id = 1 RETURNING versao`,
      [conteudo, exigir_novo_aceite ? 1 : 0, req.session.usuario.id]
    );
    await registrar({
      usuarioId: req.session.usuario.id, modulo: 'sobre_estudio', acao: 'editar',
      entidade: 'sobre_estudio', entidadeId: 1,
      antes: { versao: antes.rows[0]?.versao }, depois: { versao: r.rows[0].versao, novo_aceite: !!exigir_novo_aceite },
    });
    res.json({ ok: true, versao: r.rows[0].versao });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao salvar' });
  }
});

module.exports = router;
