const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

async function calcularRepasse(valor) {
  const result = await pool.query(
    `SELECT percentual FROM tocadalagartixa.faixas_repasse
     WHERE valor_min <= $1 AND (valor_max IS NULL OR valor_max >= $1)
     ORDER BY valor_min DESC LIMIT 1`,
    [valor]
  );
  if (result.rows.length === 0) {
    throw new Error('Nenhuma faixa de repasse encontrada para esse valor');
  }
  const percentual = Number(result.rows[0].percentual);
  const repasse = (valor * percentual) / 100;
  return { percentual, repasse };
}

// Criar agendamento — residente cria só o próprio; sócio pode criar de qualquer um
router.post('/', requireAuth, async (req, res) => {
  const { usuario_id, data, horario, duracao, valor } = req.body;
  const solicitante = req.session.usuario;

  const alvoUsuarioId = solicitante.perfil_id === 1 ? (usuario_id || solicitante.id) : solicitante.id;

  if (!data || !horario || !valor) {
    return res.status(400).json({ erro: 'Campos obrigatórios: data, horario, valor' });
  }
  if (Number(valor) < 100) {
    return res.status(400).json({ erro: 'Valor mínimo de tattoo é R$ 100' });
  }

  try {
    const { percentual, repasse } = await calcularRepasse(Number(valor));
    const mesCompetencia = `${data.slice(0, 7)}-01`; // primeiro dia do mês da data

    const result = await pool.query(
      `INSERT INTO tocadalagartixa.agendamentos
        (usuario_id, data, horario, duracao, valor, percentual, repasse, mes_competencia)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [alvoUsuarioId, data, horario, duracao || null, valor, percentual, repasse, mesCompetencia]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ erro: 'Já existe um agendamento desse residente nesse mesmo horário' });
    }
    console.error(err);
    res.status(500).json({ erro: err.message || 'Erro ao criar agendamento' });
  }
});

// Listar agendamentos — todos veem o calendário coletivo
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.id, a.usuario_id, u.nome AS responsavel, a.data, a.horario, a.duracao, a.valor,
              a.percentual, a.repasse, a.mes_competencia
       FROM tocadalagartixa.agendamentos a
       JOIN tocadalagartixa.usuarios u ON u.id = a.usuario_id
       ORDER BY a.data, a.horario`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao listar agendamentos' });
  }
});

// Editar agendamento — residente só o próprio; sócio qualquer um
router.put('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { data, horario, duracao, valor } = req.body;
  const solicitante = req.session.usuario;

  try {
    const atual = await pool.query('SELECT * FROM tocadalagartixa.agendamentos WHERE id = $1', [id]);
    if (atual.rows.length === 0) {
      return res.status(404).json({ erro: 'Agendamento não encontrado' });
    }
    if (solicitante.perfil_id !== 1 && atual.rows[0].usuario_id !== solicitante.id) {
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    const novoValor = valor !== undefined ? Number(valor) : Number(atual.rows[0].valor);
    const novaData = data || atual.rows[0].data;
    const { percentual, repasse } = await calcularRepasse(novoValor);
    const mesCompetencia = `${String(novaData).slice(0, 7)}-01`;

    const result = await pool.query(
      `UPDATE tocadalagartixa.agendamentos
       SET data = $1, horario = $2, duracao = $3, valor = $4, percentual = $5, repasse = $6, mes_competencia = $7
       WHERE id = $8 RETURNING *`,
      [novaData, horario || atual.rows[0].horario, duracao !== undefined ? duracao : atual.rows[0].duracao,
       novoValor, percentual, repasse, mesCompetencia, id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ erro: 'Já existe um agendamento desse residente nesse mesmo horário' });
    }
    console.error(err);
    res.status(500).json({ erro: err.message || 'Erro ao editar agendamento' });
  }
});

// Excluir agendamento — residente só o próprio; sócio qualquer um. Auditado.
router.delete('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const solicitante = req.session.usuario;

  try {
    const atual = await pool.query('SELECT * FROM tocadalagartixa.agendamentos WHERE id = $1', [id]);
    if (atual.rows.length === 0) {
      return res.status(404).json({ erro: 'Agendamento não encontrado' });
    }
    if (solicitante.perfil_id !== 1 && atual.rows[0].usuario_id !== solicitante.id) {
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    await pool.query('DELETE FROM tocadalagartixa.agendamentos WHERE id = $1', [id]);
    await pool.query(
      `INSERT INTO tocadalagartixa.auditoria (usuario_id, modulo, acao, entidade, entidade_id, antes)
       VALUES ($1, 'agendamento', 'exclusao', 'agendamentos', $2, $3)`,
      [solicitante.id, id, JSON.stringify(atual.rows[0])]
    );

    res.json({ mensagem: 'Agendamento excluído' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao excluir agendamento' });
  }
});

module.exports = router;
