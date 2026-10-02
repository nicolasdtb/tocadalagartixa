const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

// Ranking do mês corrente por repasse acumulado dos residentes ativos.
// Por regra de negócio, valores financeiros nunca são expostos aqui:
// a resposta traz só posição, nome e se a linha é do próprio usuário logado.
router.get('/ranking', requireAuth, async (req, res) => {
  const mesCompetencia = new Date().toISOString().slice(0, 7) + '-01';

  try {
    const result = await pool.query(
      `SELECT u.id, u.nome, u.foto IS NOT NULL AS tem_foto, EXTRACT(EPOCH FROM u.updated_at)::bigint AS foto_v,
              COALESCE(SUM(a.repasse), 0) AS total,
              RANK() OVER (ORDER BY COALESCE(SUM(a.repasse), 0) DESC) AS posicao
       FROM tocadalagartixa.usuarios u
       LEFT JOIN tocadalagartixa.agendamentos a
         ON a.usuario_id = u.id AND a.mes_competencia = $1
       WHERE u.perfil_id = 2 AND u.status = true
       GROUP BY u.id, u.nome
       ORDER BY posicao, u.nome`,
      [mesCompetencia]
    );

    const ranking = result.rows.map((r) => ({
      // quem ainda não teve repasse no mês fica sem posição (evita todo mundo em 1º lugar)
      posicao: Number(r.total) > 0 ? Number(r.posicao) : null,
      id: r.id, tem_foto: r.tem_foto, foto_v: Number(r.foto_v),
      nome: r.nome || 'Residente (cadastro pendente)',
      voce: String(r.id) === String(req.session.usuario.id),
    }));

    res.json(ranking);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao gerar ranking' });
  }
});

module.exports = router;
