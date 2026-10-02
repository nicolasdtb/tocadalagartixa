const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../db');
const { requireSocio } = require('../middlewares/auth');
const { gerarLoginGenerico, gerarSenhaProvisoria } = require('../utils/credenciais');
const { registrar } = require('../utils/auditoria');

const router = express.Router();

// Criação de usuário — só sócio
router.post('/', requireSocio, async (req, res) => {
  const { perfil_id } = req.body;

  if (![1, 2].includes(Number(perfil_id))) {
    return res.status(400).json({ erro: 'perfil_id inválido (1 = sócio, 2 = residente)' });
  }

  const login = gerarLoginGenerico();
  const senhaProvisoria = gerarSenhaProvisoria();
  const senhaHash = await bcrypt.hash(senhaProvisoria, 10);

  try {
    const result = await pool.query(
      `INSERT INTO tocadalagartixa.usuarios
        (login, senha, perfil_id, status, primeiro_acesso)
       VALUES ($1, $2, $3, true, false)
       RETURNING id, login, perfil_id`,
      [login, senhaHash, perfil_id]
    );

    // Credenciais em texto puro só aparecem aqui, nesta resposta única —
    // depois disso, a senha real nunca mais é recuperável (só re-hash).
    await registrar({
      usuarioId: req.session.usuario.id, modulo: 'usuarios', acao: 'criacao',
      entidade: 'usuarios', entidadeId: result.rows[0].id, depois: result.rows[0],
    });
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
  if (status === false && String(id) === String(req.session.usuario.id)) {
    return res.status(400).json({ erro: 'Você não pode desativar o próprio usuário' });
  }

  try {
    const antesResult = await pool.query('SELECT status FROM tocadalagartixa.usuarios WHERE id = $1', [id]);
    if (antesResult.rows.length === 0) {
      return res.status(404).json({ erro: 'Usuário não encontrado' });
    }

    const result = await pool.query(
      `UPDATE tocadalagartixa.usuarios SET status = $1, updated_at = now()
       WHERE id = $2 RETURNING id, nome, login, status`,
      [status, id]
    );

    await registrar({
      usuarioId: req.session.usuario.id, modulo: 'usuarios',
      acao: status ? 'ativacao' : 'desativacao',
      entidade: 'usuarios', entidadeId: id, antes: antesResult.rows[0], depois: result.rows[0],
    });

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
    const antesResult = await pool.query('SELECT perfil_id FROM tocadalagartixa.usuarios WHERE id = $1', [id]);
    if (antesResult.rows.length === 0) {
      return res.status(404).json({ erro: 'Usuário não encontrado' });
    }

    const result = await pool.query(
      `UPDATE tocadalagartixa.usuarios SET perfil_id = $1, updated_at = now()
       WHERE id = $2 RETURNING id, nome, login, perfil_id`,
      [perfil_id, id]
    );

    await registrar({
      usuarioId: req.session.usuario.id, modulo: 'usuarios', acao: 'alteracao_perfil',
      entidade: 'usuarios', entidadeId: id, antes: antesResult.rows[0], depois: result.rows[0],
    });

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

    await registrar({
      usuarioId: req.session.usuario.id, modulo: 'usuarios', acao: 'redefinicao_senha',
      entidade: 'usuarios', entidadeId: id,
    });

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

// Dados do próprio usuário — qualquer um autenticado
router.get('/me', require('../middlewares/auth').requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, nome, email, telefone, cpf, login, perfil_id, foto FROM tocadalagartixa.usuarios WHERE id = $1',
      [req.session.usuario.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ erro: 'Usuário não encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao consultar dados' });
  }
});

// Editar os próprios dados (nome/email/telefone/cpf/foto) — não mexe em login/senha
router.put('/me', require('../middlewares/auth').requireAuth, async (req, res) => {
  const { nome, email, telefone, cpf, foto } = req.body;
  const CPF_REGEX = /^\d{11}$/;
  const TELEFONE_REGEX = /^\d{10,11}$/;
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!nome || !email || !telefone || !cpf) {
    return res.status(400).json({ erro: 'Todos os campos são obrigatórios: nome, email, telefone, cpf' });
  }
  if (!EMAIL_REGEX.test(email)) return res.status(400).json({ erro: 'E-mail em formato inválido' });
  if (!TELEFONE_REGEX.test(telefone)) return res.status(400).json({ erro: 'Telefone em formato inválido (somente números, 10 ou 11 dígitos)' });
  if (!CPF_REGEX.test(cpf)) return res.status(400).json({ erro: 'CPF em formato inválido (11 dígitos, somente números)' });
  // Limite generoso o bastante pra uma foto de perfil pequena (~1.3MB em base64), sem virar depósito de arquivo grande.
  if (foto && foto.length > 1_800_000) {
    return res.status(400).json({ erro: 'Foto muito grande. Escolha uma imagem menor.' });
  }

  try {
    const result = foto
      ? await pool.query(
          `UPDATE tocadalagartixa.usuarios SET nome = $1, email = $2, telefone = $3, cpf = $4, foto = $5, updated_at = now()
           WHERE id = $6 RETURNING id, nome, email, telefone, cpf, login, foto`,
          [nome, email, telefone, cpf, foto, req.session.usuario.id]
        )
      : await pool.query(
          `UPDATE tocadalagartixa.usuarios SET nome = $1, email = $2, telefone = $3, cpf = $4, updated_at = now()
           WHERE id = $5 RETURNING id, nome, email, telefone, cpf, login, foto`,
          [nome, email, telefone, cpf, req.session.usuario.id]
        );
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ erro: 'CPF já cadastrado para outro usuário' });
    console.error(err);
    res.status(500).json({ erro: 'Erro ao salvar dados' });
  }
});

module.exports = router;
