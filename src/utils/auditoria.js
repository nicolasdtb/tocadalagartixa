const pool = require('../db');

async function registrar({ usuarioId, modulo, acao, entidade, entidadeId, antes, depois }) {
  await pool.query(
    `INSERT INTO tocadalagartixa.auditoria (usuario_id, modulo, acao, entidade, entidade_id, antes, depois)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [usuarioId, modulo, acao, entidade, entidadeId || null, antes ? JSON.stringify(antes) : null, depois ? JSON.stringify(depois) : null]
  );
}

module.exports = { registrar };
