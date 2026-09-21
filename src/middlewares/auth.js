const pool = require('../db');

async function requireAuth(req, res, next) {
  if (!req.session.usuario) {
    return res.status(401).json({ erro: 'Não autenticado' });
  }

  try {
    const result = await pool.query(
      'SELECT status, perfil_id, primeiro_acesso, senha_provisoria FROM tocadalagartixa.usuarios WHERE id = $1',
      [req.session.usuario.id]
    );

    if (result.rows.length === 0 || !result.rows[0].status) {
      req.session.destroy(() => {});
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    req.session.usuario.perfil_id = result.rows[0].perfil_id;
    req.session.usuario.primeiro_acesso = result.rows[0].primeiro_acesso;
    req.session.usuario.senha_provisoria = result.rows[0].senha_provisoria;

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

function requirePrimeiroAcessoConcluido(req, res, next) {
  const rotaLivre = ROTAS_LIVRES.some((prefixo) => req.path.startsWith(prefixo));
  if (rotaLivre) {
    return next();
  }

  if (!req.session.usuario) {
    return next();
  }

  if (req.session.usuario.primeiro_acesso === false) {
    return res.status(428).json({ erro: 'Cadastro inicial pendente. Complete o primeiro acesso antes de continuar.' });
  }

  if (req.session.usuario.senha_provisoria === true) {
    return res.status(428).json({ erro: 'Troca de senha obrigatória antes de continuar.' });
  }

  next();
}

module.exports = { requireAuth, requireSocio, requirePrimeiroAcessoConcluido };
