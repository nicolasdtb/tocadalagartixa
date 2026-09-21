const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../db');
const { requireSocio } = require('../middlewares/auth');
const { gerarLoginGenerico, gerarSenhaProvisoria } = require('../utils/credenciais');

const router = express.Router();

// Criação de usuário — só sócio
router.post('/', requireSocio, async (req, res) => {
  const { nome, email, telefone, cpf, perfil_id } = req.body;

  if (!nome || !email || !telefone || !cpf || !perfil_id) {
    return res.status(400).json({ erro: 'Campos obrigatórios: nome, email, telefone, cpf, perfil_id' });
  }

  if (![1, 2].includes(Number(perfil_id))) {
    return res.status(400).json({ erro: 'perfil_id inválido (1 = sócio, 2 = residente)' });
  }

  const login = gerarLoginGenerico();
  const senhaProvisoria = gerarSenhaProvisoria();
  const senhaHash = await bcrypt.hash(senhaProvisoria, 10);

  try {
    const result = await pool.query(
      `INSERT INTO tocadalagartixa.usuarios
        (nome, email, telefone, cpf, login, senha, perfil_id, status, primeiro_acesso)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true, false)
       RETURNING id, nome, login, perfil_id`,
      [nome, email, telefone, cpf, login, senhaHash, perfil_id]
    );

    // Credenciais em texto puro só aparecem aqui, nesta resposta única —
    // depois disso, a senha real nunca mais é recuperável (só re-hash).
    res.status(201).json({
      usuario: result.rows[0],
      credenciais_iniciais: {
        login,
        senha: senhaProvisoria,
      },
    });
  } catch (err) {
    if (err.code === '23505') { // unique_violation (cpf ou login duplicado)
      return res.status(409).json({ erro: 'CPF já cadastrado' });
    }
    console.error(err);
    res.status(500).json({ erro: 'Erro ao criar usuário' });
  }
});

// Listagem de usuários — só sócio
router.get('/', requireSocio, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, nome, email, telefone, cpf, login, perfil_id, status, primeiro_acesso
       FROM tocadalagartixa.usuarios ORDER BY nome`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao listar usuários' });
  }
});

module.exports = router;
