const pool = require('../db');

async function carregarDadosAtuais(usuarioId) {
  const result = await pool.query(
    'SELECT status, perfil_id, primeiro_acesso, senha_provisoria FROM tocadalagartixa.usuarios WHERE id = $1',
    [usuarioId]
  );
  return result.rows[0] || null;
}

async function requireAuth(req, res, next) {
  if (!req.session.usuario) {
    return res.status(401).json({ erro: 'Não autenticado' });
  }

  try {
    const dados = await carregarDadosAtuais(req.session.usuario.id);

    if (!dados || !dados.status) {
      req.session.destroy(() => {});
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    req.session.usuario.perfil_id = dados.perfil_id;
    req.session.usuario.primeiro_acesso = dados.primeiro_acesso;
    req.session.usuario.senha_provisoria = dados.senha_provisoria;

    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao verificar autenticação' });
  }
}

function requireSocio(req, res, next) {
  if (!req.session.usuario || req.session.usuario.perfil_id !== 1) {
    return res.status(403).json({ erro: 'Acesso negado' });
  }
  next();
}

const ROTAS_LIVRES = ['/api/auth', '/api/primeiro-acesso', '/api/health', '/api/usuarios/trocar-senha'];

// Consulta o banco diretamente (não confia na sessão em cache), já que este
// middleware roda ANTES do requireAuth de cada rota e por isso não pode
// depender de um valor que só é atualizado depois.
async function requirePrimeiroAcessoConcluido(req, res, next) {
  const rotaLivre = ROTAS_LIVRES.some((prefixo) => req.path.startsWith(prefixo));
  if (rotaLivre) {
    return next();
  }

  if (!req.session.usuario) {
    return next();
  }

  try {
    const dados = await carregarDadosAtuais(req.session.usuario.id);
    if (!dados) {
      return next();
    }

    if (dados.primeiro_acesso === false) {
      return res.status(428).json({ erro: 'Cadastro inicial pendente. Complete o primeiro acesso antes de continuar.' });
    }
    if (dados.senha_provisoria === true) {
      return res.status(428).json({ erro: 'Troca de senha obrigatória antes de continuar.' });
    }

    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao verificar status do usuário' });
  }
}

module.exports = { requireAuth, requireSocio, requirePrimeiroAcessoConcluido };
