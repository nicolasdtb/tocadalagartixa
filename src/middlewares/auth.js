function requireAuth(req, res, next) {
  if (!req.session.usuario) {
    return res.status(401).json({ erro: 'Não autenticado' });
  }
  next();
}

function requireSocio(req, res, next) {
  if (!req.session.usuario || req.session.usuario.perfil_id !== 1) {
    return res.status(403).json({ erro: 'Acesso negado' });
  }
  next();
}

const ROTAS_LIVRES_DE_PRIMEIRO_ACESSO = ['/api/auth', '/api/primeiro-acesso', '/api/health'];

function requirePrimeiroAcessoConcluido(req, res, next) {
  const rotaLivre = ROTAS_LIVRES_DE_PRIMEIRO_ACESSO.some((prefixo) => req.path.startsWith(prefixo));
  if (rotaLivre) {
    return next();
  }

  if (req.session.usuario && req.session.usuario.primeiro_acesso === false) {
    return res.status(428).json({ erro: 'Cadastro inicial pendente. Complete o primeiro acesso antes de continuar.' });
  }
  next();
}

module.exports = { requireAuth, requireSocio, requirePrimeiroAcessoConcluido };
