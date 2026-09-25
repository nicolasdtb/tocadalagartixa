const pool = require('../db');

async function carregarDadosAtuais(usuarioId) {
  const result = await pool.query(
    'SELECT status, perfil_id, primeiro_acesso, senha_provisoria FROM tocadalagartixa.usuarios WHERE id = $1',
    [usuarioId]
  );
  return result.rows[0] || null;
}

async function comunicadoObrigatorioPendente(usuarioId) {
  const result = await pool.query(
    `SELECT c.id, c.titulo
     FROM tocadalagartixa.comunicados c
     JOIN LATERAL (
       SELECT id FROM tocadalagartixa.comunicados_versoes
       WHERE comunicado_id = c.id ORDER BY versao DESC LIMIT 1
     ) v ON true
     WHERE c.obrigatorio = true AND c.is_deleted = false
       AND NOT EXISTS (
         SELECT 1 FROM tocadalagartixa.comunicados_confirmacoes cc
         WHERE cc.versao_id = v.id AND cc.usuario_id = $1
       )
     LIMIT 1`,
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

const ROTAS_LIVRES = ['/api/auth', '/api/primeiro-acesso', '/api/health', '/api/usuarios/trocar-senha', '/api/comunicados'];

// Consulta o banco diretamente (não confia na sessão em cache), já que este
// middleware roda ANTES do requireAuth de cada rota.
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
      return res.status(428).json({ erro: 'Cadastro inicial pendente. Complete o primeiro acesso antes de continuar.', tipo: 'primeiro_acesso' });
    }
    if (dados.senha_provisoria === true) {
      return res.status(428).json({ erro: 'Troca de senha obrigatória antes de continuar.', tipo: 'senha_provisoria' });
    }

    // Comunicado obrigatório não confirmado trava o uso do resto do app
    // (residentes; sócios não são travados pelos próprios comunicados publicados).
    if (dados.perfil_id !== 1) {
      const pendente = await comunicadoObrigatorioPendente(req.session.usuario.id);
      if (pendente) {
        return res.status(428).json({
          erro: `Existe um comunicado obrigatório pendente de confirmação: "${pendente.titulo}". Confirme a leitura antes de continuar.`,
          tipo: 'comunicado_pendente',
          comunicado_id: pendente.id,
        });
      }
    }

    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao verificar status do usuário' });
  }
}

module.exports = { requireAuth, requireSocio, requirePrimeiroAcessoConcluido };
