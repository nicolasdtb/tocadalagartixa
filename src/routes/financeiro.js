const express = require('express');
const pool = require('../db');
const { requireSocio } = require('../middlewares/auth');
const { registrar } = require('../utils/auditoria');

const router = express.Router();

const CATEGORIA = { OPERACIONAL: 1, MATERIAIS: 2, BENEFICIOS: 3, MARKETING: 4, MELHORIAS: 5 };
const PERCENTUAL_MARKETING = 0.20;

function primeiroDiaMes(mesStr) {
  // aceita "2026-09" ou "2026-09-01"
  return `${mesStr.slice(0, 7)}-01`;
}

async function mesEstaFechado(mes) {
  const result = await pool.query(
    'SELECT fechado FROM tocadalagartixa.fechamentos WHERE mes = $1',
    [mes]
  );
  return result.rows.length > 0 && result.rows[0].fechado;
}

// Registrar nova entrada de caixa do mês (E) — não pertence a categoria específica ainda
router.post('/entradas', requireSocio, async (req, res) => {
  const { mes, valor, descricao } = req.body;
  if (!mes || !valor) {
    return res.status(400).json({ erro: 'Campos obrigatórios: mes, valor' });
  }
  const mesCompetencia = primeiroDiaMes(mes);

  if (await mesEstaFechado(mesCompetencia)) {
    return res.status(423).json({ erro: 'Mês fechado. Reabra o mês para lançar novas entradas.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO tocadalagartixa.lancamentos_financeiros
        (categoria_id, tipo_id, valor, mes_competencia, usuario_id, descricao)
       VALUES (NULL, 1, $1, $2, $3, $4) RETURNING *`,
      [valor, mesCompetencia, req.session.usuario.id, descricao || null]
    );
    await registrar({
      usuarioId: req.session.usuario.id, modulo: 'financeiro', acao: 'entrada',
      entidade: 'lancamentos_financeiros', entidadeId: result.rows[0].id, depois: result.rows[0],
    });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao registrar entrada' });
  }
});

// Definir/ajustar orçamento de Operacional ou Materiais pro mês
router.post('/orcamentos', requireSocio, async (req, res) => {
  const { categoria_id, mes, valor } = req.body;
  if (![CATEGORIA.OPERACIONAL, CATEGORIA.MATERIAIS].includes(Number(categoria_id))) {
    return res.status(400).json({ erro: 'categoria_id deve ser Operacional (1) ou Materiais (2)' });
  }
  if (!mes || valor === undefined) {
    return res.status(400).json({ erro: 'Campos obrigatórios: mes, valor' });
  }
  const mesCompetencia = primeiroDiaMes(mes);

  if (await mesEstaFechado(mesCompetencia)) {
    return res.status(423).json({ erro: 'Mês fechado. Reabra o mês para ajustar orçamento.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO tocadalagartixa.orcamentos_categoria (categoria_id, mes, valor)
       VALUES ($1, $2, $3)
       ON CONFLICT (categoria_id, mes) DO UPDATE SET valor = EXCLUDED.valor
       RETURNING *`,
      [categoria_id, mesCompetencia, valor]
    );

    await pool.query(
      `INSERT INTO tocadalagartixa.auditoria (usuario_id, modulo, acao, entidade, entidade_id, depois)
       VALUES ($1, 'financeiro', 'ajuste_orcamento', 'orcamentos_categoria', $2, $3)`,
      [req.session.usuario.id, result.rows[0].id, JSON.stringify(result.rows[0])]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao definir orçamento' });
  }
});

// Registrar gasto numa categoria específica
router.post('/gastos', requireSocio, async (req, res) => {
  const { categoria_id, mes, valor, descricao } = req.body;
  if (!categoria_id || !mes || !valor) {
    return res.status(400).json({ erro: 'Campos obrigatórios: categoria_id, mes, valor' });
  }
  const mesCompetencia = primeiroDiaMes(mes);

  if (await mesEstaFechado(mesCompetencia)) {
    return res.status(423).json({ erro: 'Mês fechado. Reabra o mês para lançar gastos.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO tocadalagartixa.lancamentos_financeiros
        (categoria_id, tipo_id, valor, mes_competencia, usuario_id, descricao)
       VALUES ($1, 2, $2, $3, $4, $5) RETURNING *`,
      [categoria_id, valor, mesCompetencia, req.session.usuario.id, descricao || null]
    );
    await registrar({
      usuarioId: req.session.usuario.id, modulo: 'financeiro', acao: 'gasto',
      entidade: 'lancamentos_financeiros', entidadeId: result.rows[0].id, depois: result.rows[0],
    });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao registrar gasto' });
  }
});

// Calcula a fórmula do mês (E, O, M, B, K, I) sem gravar nada — usado no preview e no fechamento
async function calcularFormulaMes(mes) {
  const entradasResult = await pool.query(
    `SELECT COALESCE(SUM(valor), 0) AS total FROM tocadalagartixa.lancamentos_financeiros
     WHERE tipo_id = 1 AND categoria_id IS NULL AND mes_competencia = $1`,
    [mes]
  );
  const E = Number(entradasResult.rows[0].total);

  const orcamentoResult = async (categoriaId) => {
    const r = await pool.query(
      `SELECT valor FROM tocadalagartixa.orcamentos_categoria WHERE categoria_id = $1 AND mes = $2`,
      [categoriaId, mes]
    );
    return r.rows.length > 0 ? Number(r.rows[0].valor) : 0;
  };

  const O = await orcamentoResult(CATEGORIA.OPERACIONAL);
  const M = await orcamentoResult(CATEGORIA.MATERIAIS);

  const beneficiosResult = await pool.query(
    `SELECT COALESCE(SUM(valor), 0) AS total FROM tocadalagartixa.beneficios_mensais
     WHERE mes_competencia = $1 AND status_id IN (2, 3)`,
    [mes]
  );
  const beneficiosNormais = Number(beneficiosResult.rows[0].total);

  const isencoesResult = await pool.query(
    `SELECT COALESCE(SUM(valor_beneficio), 0) AS total FROM tocadalagartixa.isencoes_repasse
     WHERE mes_concessao = $1`,
    [mes]
  );
  const beneficiosEspeciais = Number(isencoesResult.rows[0].total);

  const B = beneficiosNormais + beneficiosEspeciais;
  const K = E * PERCENTUAL_MARKETING;
  const I = E - O - M - B - K;

  return { E, O, M, B, K, I };
}

// Preview do fechamento — mostra o que vai acontecer, sem gravar
router.get('/fechamento/:mes/preview', requireSocio, async (req, res) => {
  const mesCompetencia = primeiroDiaMes(req.params.mes);
  try {
    const formula = await calcularFormulaMes(mesCompetencia);
    res.json({ mes: mesCompetencia, ...formula });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao calcular preview do mês' });
  }
});

// Saldo de uma categoria no mês anterior (base do saldo_inicial)
async function saldoAnterior(categoriaId, mes) {
  const result = await pool.query(
    `SELECT saldo_final FROM tocadalagartixa.saldos_mensais
     WHERE categoria_id = $1 AND mes = (date_trunc('month', $2::date) - interval '1 month')::date`,
    [categoriaId, mes]
  );
  return result.rows.length > 0 ? Number(result.rows[0].saldo_final) : 0;
}

async function gastosDaCategoria(categoriaId, mes) {
  const result = await pool.query(
    `SELECT COALESCE(SUM(valor), 0) AS total FROM tocadalagartixa.lancamentos_financeiros
     WHERE categoria_id = $1 AND tipo_id = 2 AND mes_competencia = $2`,
    [categoriaId, mes]
  );
  return Number(result.rows[0].total);
}

// Fechar o mês — calcula e grava os saldos definitivos de cada categoria
router.post('/fechamento/:mes/fechar', requireSocio, async (req, res) => {
  const mesCompetencia = primeiroDiaMes(req.params.mes);

  if (await mesEstaFechado(mesCompetencia)) {
    return res.status(409).json({ erro: 'Mês já está fechado' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { O, M, B, K, I } = await calcularFormulaMes(mesCompetencia);
    const destinacoes = {
      [CATEGORIA.OPERACIONAL]: O,
      [CATEGORIA.MATERIAIS]: M,
      [CATEGORIA.BENEFICIOS]: B,
      [CATEGORIA.MARKETING]: K,
      [CATEGORIA.MELHORIAS]: I,
    };

    for (const [categoriaId, destinacao] of Object.entries(destinacoes)) {
      const saldoInicial = await saldoAnterior(categoriaId, mesCompetencia);
      const gastos = await gastosDaCategoria(categoriaId, mesCompetencia);
      const saldoFinal = saldoInicial + destinacao - gastos;

      await client.query(
        `INSERT INTO tocadalagartixa.saldos_mensais (categoria_id, mes, saldo_inicial, destinacao, gastos, saldo_final)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (categoria_id, mes) DO UPDATE SET
           saldo_inicial = EXCLUDED.saldo_inicial, destinacao = EXCLUDED.destinacao,
           gastos = EXCLUDED.gastos, saldo_final = EXCLUDED.saldo_final`,
        [categoriaId, mesCompetencia, saldoInicial, destinacao, gastos, saldoFinal]
      );
    }

    await client.query(
      `INSERT INTO tocadalagartixa.fechamentos (mes, fechado, fechado_em)
       VALUES ($1, true, now())
       ON CONFLICT (mes) DO UPDATE SET fechado = true, fechado_em = now()`,
      [mesCompetencia]
    );

    await client.query('COMMIT');
    res.json({ mensagem: 'Mês fechado com sucesso', mes: mesCompetencia });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ erro: 'Erro ao fechar o mês' });
  } finally {
    client.release();
  }
});

// Reabrir mês fechado — só sócio, com motivo obrigatório
router.post('/fechamento/:mes/reabrir', requireSocio, async (req, res) => {
  const mesCompetencia = primeiroDiaMes(req.params.mes);
  const { motivo } = req.body;

  if (!motivo) {
    return res.status(400).json({ erro: 'motivo é obrigatório para reabrir um mês' });
  }
  if (!(await mesEstaFechado(mesCompetencia))) {
    return res.status(409).json({ erro: 'Mês não está fechado' });
  }

  try {
    await pool.query(
      `UPDATE tocadalagartixa.fechamentos
       SET fechado = false, reaberto_por = $1, reaberto_em = now(), motivo = $2
       WHERE mes = $3`,
      [req.session.usuario.id, motivo, mesCompetencia]
    );

    await pool.query(
      `INSERT INTO tocadalagartixa.auditoria (usuario_id, modulo, acao, entidade, entidade_id)
       VALUES ($1, 'financeiro', 'reabertura_mes', 'fechamentos', NULL)`,
      [req.session.usuario.id]
    );

    res.json({ mensagem: 'Mês reaberto. Lembre-se de fechá-lo novamente após os ajustes.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao reabrir o mês' });
  }
});

// Histórico de saldos por categoria
router.get('/saldos/:mes', requireSocio, async (req, res) => {
  const mesCompetencia = primeiroDiaMes(req.params.mes);
  try {
    const result = await pool.query(
      `SELECT c.nome, s.saldo_inicial, s.destinacao, s.gastos, s.saldo_final
       FROM tocadalagartixa.saldos_mensais s
       JOIN tocadalagartixa.categorias_financeiras c ON c.id = s.categoria_id
       WHERE s.mes = $1 ORDER BY c.id`,
      [mesCompetencia]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao consultar saldos' });
  }
});

// Consulta de período maior — resumo consolidado por categoria entre dois meses (inclusive)
// Ex.: /api/financeiro/saldos-periodo?inicio=2026-01&fim=2026-12
router.get('/saldos-periodo', requireSocio, async (req, res) => {
  const { inicio, fim } = req.query;
  if (!inicio || !fim) {
    return res.status(400).json({ erro: 'Parâmetros obrigatórios: inicio, fim (formato AAAA-MM)' });
  }
  const mesInicio = primeiroDiaMes(inicio);
  const mesFim = primeiroDiaMes(fim);

  try {
    const result = await pool.query(
      `SELECT c.nome,
              COALESCE(SUM(s.destinacao), 0) AS total_entradas,
              COALESCE(SUM(s.gastos), 0) AS total_saidas,
              (SELECT saldo_final FROM tocadalagartixa.saldos_mensais
                WHERE categoria_id = c.id AND mes <= $2
                ORDER BY mes DESC LIMIT 1) AS saldo_final_periodo
       FROM tocadalagartixa.categorias_financeiras c
       LEFT JOIN tocadalagartixa.saldos_mensais s
         ON s.categoria_id = c.id AND s.mes BETWEEN $1 AND $2
       GROUP BY c.id, c.nome
       ORDER BY c.id`,
      [mesInicio, mesFim]
    );
    res.json({ periodo: { inicio: mesInicio, fim: mesFim }, categorias: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao consultar saldos do período' });
  }
});

router.get("/lancamentos/:mes", requireSocio, async (req, res) => {
  const mesCompetencia = primeiroDiaMes(req.params.mes);
  try {
    const result = await pool.query(
      `SELECT l.id, l.tipo_id, l.valor, l.descricao, l.created_at,
              c.nome AS categoria, u.nome AS usuario_nome
       FROM tocadalagartixa.lancamentos_financeiros l
       LEFT JOIN tocadalagartixa.categorias_financeiras c ON c.id = l.categoria_id
       JOIN tocadalagartixa.usuarios u ON u.id = l.usuario_id
       WHERE l.mes_competencia = $1
       ORDER BY l.created_at DESC`,
      [mesCompetencia]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao listar lançamentos" });
  }
});

module.exports = router;
