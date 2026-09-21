const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../db');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { login, senha } = req.body;
  if (!login || !senha) {
    return res.status(400).json({ erro: 'Login e senha são obrigatórios' });
  }

  try {
    const result = await pool.query(
      'SELECT id, nome, senha, perfil_id, status, primeiro_acesso, senha_provisoria FROM tocadalagartixa.usuarios WHERE login = $1',
      [login]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ erro: 'Usuário ou senha inválidos' });
    }

    const usuario = result.rows[0];

    if (!usuario.status) {
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    const senhaConfere = await bcrypt.compare(senha, usuario.senha);
    if (!senhaConfere) {
      return res.status(401).json({ erro: 'Usuário ou senha inválidos' });
    }

    req.session.usuario = {
      id: usuario.id,
      nome: usuario.nome,
      perfil_id: usuario.perfil_id,
      primeiro_acesso: usuario.primeiro_acesso,
      senha_provisoria: usuario.senha_provisoria,
    };

    res.json({
      nome: usuario.nome,
      perfil_id: usuario.perfil_id,
      primeiro_acesso: usuario.primeiro_acesso,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao autenticar' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

router.get('/me', (req, res) => {
  if (!req.session.usuario) {
    return res.status(401).json({ erro: 'Não autenticado' });
  }
  res.json(req.session.usuario);
});

module.exports = router;
