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

module.exports = { requireAuth, requireSocio };
