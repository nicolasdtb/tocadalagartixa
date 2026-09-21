const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

// Meta Individual — repasse acumulado do mês corrente do usuário logado
router.get('/individual', requireAuth, async (req, res) => {
  const usuarioId = req.session.usuario.id;

  try {
    const acumuladoResult = await pool.query(
      `SELECT COALESCE(SUM(repasse), 0) AS acumulado
       FROM tocadalagartixa.agendamentos
       WHERE usuario_id = $1
         AND date_trunc('month', mes_competencia) = date_trunc('month', CURRENT_DATE)`,
      [usuarioId]
    );
    const acumulado = Number(acumuladoResult.rows[0].acumulado);

    const niveisResult = await pool.query(
      `SELECT nivel, repasse_minimo, valor FROM tocadalagartixa.niveis_beneficio ORDER BY nivel`
    );
    const niveis = niveisResult.rows;

    // Nível atual = maior nível cujo repasse_minimo já foi atingido
    const atingidos = niveis.filter((n) => acumulado >= Number(n.repasse_minimo));
    const nivelAtual = atingidos.length > 0 ? atingidos[atingidos.length - 1] : null;
    const proximoNivel = niveis.find((n) => Number(n.repasse_minimo) > acumulado) || null;

    res.json({
      acumulado_mes: acumulado,
      nivel_atual: nivelAtual,
      proximo_nivel: proximoNivel,
      falta_para_proximo: proximoNivel ? Number(proximoNivel.repasse_minimo) - acumulado : 0,
      nivel_maximo_atingido: proximoNivel === null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao calcular meta individual' });
  }
});

// Consulta de todos os níveis (o "?" da tela)
router.get('/niveis', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT nivel, repasse_minimo, valor FROM tocadalagartixa.niveis_beneficio ORDER BY nivel`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao listar níveis' });
  }
});

module.exports = router;
