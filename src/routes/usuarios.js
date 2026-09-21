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

// Ativar/desativar usuário — só sócio. Desativação bloqueia acesso imediatamente
// (o requireAuth consulta o status no banco a cada request).
router.patch('/:id/status', requireSocio, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (typeof status !== 'boolean') {
    return res.status(400).json({ erro: 'Campo "status" deve ser true ou false' });
  }

  try {
    const result = await pool.query(
      `UPDATE tocadalagartixa.usuarios SET status = $1, updated_at = now()
       WHERE id = $2 RETURNING id, nome, login, status`,
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'Usuário não encontrado' });
    }

    res.json({ mensagem: status ? 'Usuário ativado' : 'Usuário desativado', usuario: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao alterar status do usuário' });
  }
});

// Alterar perfil (sócio <-> residente) — só sócio
router.patch('/:id/perfil', requireSocio, async (req, res) => {
  const { id } = req.params;
  const { perfil_id } = req.body;

  if (![1, 2].includes(Number(perfil_id))) {
    return res.status(400).json({ erro: 'perfil_id inválido (1 = sócio, 2 = residente)' });
  }

  try {
    const result = await pool.query(
      `UPDATE tocadalagartixa.usuarios SET perfil_id = $1, updated_at = now()
       WHERE id = $2 RETURNING id, nome, login, perfil_id`,
      [perfil_id, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'Usuário não encontrado' });
    }

    res.json({ mensagem: 'Perfil alterado', usuario: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao alterar perfil do usuário' });
  }
});

// Redefinição administrativa de senha — só sócio.
// Gera senha provisória nova e obriga troca no próximo login, SEM exigir recadastro completo
// (usa o campo dedicado senha_provisoria, separado de primeiro_acesso).
router.post('/:id/redefinir-senha', requireSocio, async (req, res) => {
  const { id } = req.params;
  const senhaProvisoria = gerarSenhaProvisoria();
  const senhaHash = await bcrypt.hash(senhaProvisoria, 10);

  try {
    const result = await pool.query(
      `UPDATE tocadalagartixa.usuarios SET senha = $1, senha_provisoria = true, updated_at = now()
       WHERE id = $2 RETURNING id, nome, login`,
      [senhaHash, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'Usuário não encontrado' });
    }

    res.json({
      mensagem: 'Senha redefinida. Usuário precisará trocá-la no próximo login.',
      usuario: result.rows[0],
      nova_senha_provisoria: senhaProvisoria,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao redefinir senha' });
  }
});

// Troca de senha — usuário autenticado troca a própria senha
// (usado após redefinição administrativa, mas também disponível a qualquer momento).
router.post('/trocar-senha', require('../middlewares/auth').requireAuth, async (req, res) => {
  const { nova_senha } = req.body;

  if (!nova_senha || nova_senha.length < 8) {
    return res.status(400).json({ erro: 'A nova senha deve ter pelo menos 8 caracteres' });
  }

  const novaSenhaHash = await bcrypt.hash(nova_senha, 10);

  try {
    await pool.query(
      `UPDATE tocadalagartixa.usuarios SET senha = $1, senha_provisoria = false, updated_at = now()
       WHERE id = $2`,
      [novaSenhaHash, req.session.usuario.id]
    );
    res.json({ mensagem: 'Senha alterada com sucesso' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao trocar senha' });
  }
});

module.exports = router;
