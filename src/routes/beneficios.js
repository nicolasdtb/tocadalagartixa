const express = require('express');
const pool = require('../db');
const { requireAuth, requireSocio } = require('../middlewares/auth');

const router = express.Router();

// Listar categorias ativas
router.get('/categorias', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, nome FROM tocadalagartixa.categorias_beneficio WHERE ativa = true ORDER BY nome`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao listar categorias' });
  }
});

// Residente solicita o benefício do mês (escolhe categoria)
router.post('/solicitar', requireAuth, async (req, res) => {
  const usuarioId = req.session.usuario.id;
  const { categoria_id } = req.body;
  const mesCompetencia = new Date().toISOString().slice(0, 7) + '-01';

  if (!categoria_id) {
    return res.status(400).json({ erro: 'categoria_id é obrigatório' });
  }

  try {
    // Já existe solicitação nesse mês?
    const existente = await pool.query(
      `SELECT id FROM tocadalagartixa.beneficios_mensais WHERE usuario_id = $1 AND mes_competencia = $2`,
      [usuarioId, mesCompetencia]
    );
    if (existente.rows.length > 0) {
      return res.status(409).json({ erro: 'Benefício deste mês já solicitado' });
    }

    // Calcula o nível atingido no mês (mesma lógica da Meta Individual)
    const acumuladoResult = await pool.query(
      `SELECT COALESCE(SUM(repasse), 0) AS acumulado
       FROM tocadalagartixa.agendamentos
       WHERE usuario_id = $1 AND mes_competencia = $2`,
      [usuarioId, mesCompetencia]
    );
    const acumulado = Number(acumuladoResult.rows[0].acumulado);

    const niveisResult = await pool.query(
      `SELECT id, nivel, repasse_minimo, valor FROM tocadalagartixa.niveis_beneficio
       WHERE repasse_minimo <= $1 ORDER BY repasse_minimo DESC LIMIT 1`,
      [acumulado]
    );

    if (niveisResult.rows.length === 0) {
      return res.status(400).json({ erro: 'Nenhum nível de benefício atingido ainda este mês' });
    }

    const nivel = niveisResult.rows[0];

    const result = await pool.query(
      `INSERT INTO tocadalagartixa.beneficios_mensais
        (usuario_id, mes_competencia, nivel_id, valor, categoria_id, status_id)
       VALUES ($1, $2, $3, $4, $5, 1)
       RETURNING *`,
      [usuarioId, mesCompetencia, nivel.id, nivel.valor, categoria_id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao solicitar benefício' });
  }
});

// Sócio aprova/paga o benefício
router.patch('/:id/status', requireSocio, async (req, res) => {
  const { id } = req.params;
  const { status_id } = req.body; // 2 = aprovado, 3 = pago

  if (![2, 3].includes(Number(status_id))) {
    return res.status(400).json({ erro: 'status_id inválido (2 = aprovado, 3 = pago)' });
  }

  try {
    const result = await pool.query(
      `UPDATE tocadalagartixa.beneficios_mensais
       SET status_id = $1::smallint, data_uso = CASE WHEN $1::smallint = 3 THEN now() ELSE data_uso END
       WHERE id = $2 RETURNING *`,
      [status_id, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'Benefício não encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao atualizar status do benefício' });
  }
});

// Sócio: visão consolidada (repasse acumulado, nível, benefício por tatuador)
router.get('/resumo', requireSocio, async (req, res) => {
  const mesCompetencia = new Date().toISOString().slice(0, 7) + '-01';
  try {
    const result = await pool.query(
      `SELECT u.id, u.nome, bm.id AS beneficio_id,
              COALESCE(SUM(a.repasse), 0) AS repasse_acumulado,
              bm.nivel_id, bm.valor AS valor_beneficio, bm.status_id
       FROM tocadalagartixa.usuarios u
       LEFT JOIN tocadalagartixa.agendamentos a
         ON a.usuario_id = u.id AND a.mes_competencia = $1
       LEFT JOIN tocadalagartixa.beneficios_mensais bm
         ON bm.usuario_id = u.id AND bm.mes_competencia = $1
       WHERE u.perfil_id = 2
       GROUP BY u.id, u.nome, bm.id, bm.nivel_id, bm.valor, bm.status_id
       ORDER BY u.nome`,
      [mesCompetencia]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao gerar resumo' });
  }
});

module.exports = router;
