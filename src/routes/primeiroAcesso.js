const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../db');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

const CPF_REGEX = /^\d{11}$/;
const TELEFONE_REGEX = /^\d{10,11}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/', requireAuth, async (req, res) => {
  const { nome, email, telefone, cpf, novo_login, nova_senha } = req.body;

  if (!nome || !email || !telefone || !cpf || !novo_login || !nova_senha) {
    return res.status(400).json({ erro: 'Todos os campos são obrigatórios: nome, email, telefone, cpf, novo_login, nova_senha' });
  }

  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ erro: 'E-mail em formato inválido' });
  }
  if (!TELEFONE_REGEX.test(telefone)) {
    return res.status(400).json({ erro: 'Telefone em formato inválido (somente números, 10 ou 11 dígitos)' });
  }
  if (!CPF_REGEX.test(cpf)) {
    return res.status(400).json({ erro: 'CPF em formato inválido (11 dígitos, somente números)' });
  }
  if (nova_senha.length < 8) {
    return res.status(400).json({ erro: 'A nova senha deve ter pelo menos 8 caracteres' });
  }

  const usuarioId = req.session.usuario.id;
  const novaSenhaHash = await bcrypt.hash(nova_senha, 10);

  try {
    const result = await pool.query(
      `UPDATE tocadalagartixa.usuarios
       SET nome = $1, email = $2, telefone = $3, cpf = $4,
           login = $5, senha = $6, primeiro_acesso = true, updated_at = now()
       WHERE id = $7
       RETURNING id, nome, login, perfil_id`,
      [nome, email, telefone, cpf, novo_login, novaSenhaHash, usuarioId]
    );

    res.json({ mensagem: 'Cadastro concluído com sucesso', usuario: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ erro: 'CPF ou login já em uso' });
    }
    console.error(err);
    res.status(500).json({ erro: 'Erro ao concluir cadastro' });
  }
});

module.exports = router;
