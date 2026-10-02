import os
os.chdir(os.path.expanduser('~/toca-lagartixa/src'))
def patch(path, pairs):
    s = open(path, encoding='utf-8').read()
    for a, b in pairs:
        assert s.count(a) == 1, (path, a)
        s = s.replace(a, b)
    open(path, 'w', encoding='utf-8').write(s)

patch('app.js', [
 ("const notificacoesRoutes = require('./routes/notificacoes');",
  "const notificacoesRoutes = require('./routes/notificacoes');\nconst condicoesRoutes = require('./routes/condicoes');"),
 ("app.use('/api/notificacoes', notificacoesRoutes);",
  "app.use('/api/notificacoes', notificacoesRoutes);\napp.use('/api/condicoes', condicoesRoutes);"),
])
patch('routes/agendamentos.js', [
 ("u.nome AS responsavel, a.data",
  "u.nome AS responsavel, u.foto IS NOT NULL AS tem_foto, EXTRACT(EPOCH FROM u.updated_at)::bigint AS foto_v, a.data"),
])
patch('routes/inicio.js', [
 ("SELECT u.id, u.nome,",
  "SELECT u.id, u.nome, u.foto IS NOT NULL AS tem_foto, EXTRACT(EPOCH FROM u.updated_at)::bigint AS foto_v,"),
 ("nome: r.nome || 'Residente (cadastro pendente)',",
  "id: r.id, tem_foto: r.tem_foto, foto_v: Number(r.foto_v),\n      nome: r.nome || 'Residente (cadastro pendente)',"),
])
patch('routes/usuarios.js', [
 ("module.exports = router;", '''// Foto de perfil servida como imagem (cacheável), para listas leves. Só aceita tipos de imagem seguros.
router.get('/:id/foto', require('../middlewares/auth').requireAuth, async (req, res) => {
  if (!/^\\d+$/.test(req.params.id)) return res.status(404).end();
  try {
    const r = await pool.query('SELECT foto FROM tocadalagartixa.usuarios WHERE id = $1', [req.params.id]);
    const m = /^data:(image\\/(?:png|jpe?g|webp|gif));base64,(.+)$/s.exec(r.rows[0]?.foto || '');
    if (!m) return res.status(404).end();
    res.set({ 'Content-Type': m[1], 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff' });
    res.send(Buffer.from(m[2], 'base64'));
  } catch (err) {
    console.error(err);
    res.status(500).end();
  }
});

module.exports = router;'''),
])
print('ok')
