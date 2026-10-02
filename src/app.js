require('dotenv').config();
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const pool = require('./db');
const authRoutes = require('./routes/auth');
const usuariosRoutes = require('./routes/usuarios');
const primeiroAcessoRoutes = require('./routes/primeiroAcesso');
const agendamentosRoutes = require('./routes/agendamentos');
const metasRoutes = require('./routes/metas');
const beneficiosRoutes = require('./routes/beneficios');
const estoqueRoutes = require('./routes/estoque');
const financeiroRoutes = require('./routes/financeiro');
const melhoriasRoutes = require('./routes/melhorias');
const comunicadosRoutes = require('./routes/comunicados');
const inicioRoutes = require('./routes/inicio');
const notificacoesRoutes = require('./routes/notificacoes');

const app = express();

app.use(express.json({ limit: '3mb' }));
app.use(express.static('public'));

app.use(session({
  store: new pgSession({
    pool,
    schemaName: 'tocadalagartixa',
    tableName: 'sessoes',
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: false,
  },
}));

app.use(require('./middlewares/auth').requirePrimeiroAcessoConcluido);

app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/primeiro-acesso', primeiroAcessoRoutes);
app.use('/api/agendamentos', agendamentosRoutes);
app.use('/api/metas', metasRoutes);
app.use('/api/beneficios', beneficiosRoutes);
app.use('/api/estoque', estoqueRoutes);
app.use('/api/financeiro', financeiroRoutes);
app.use('/api/melhorias', melhoriasRoutes);
app.use('/api/comunicados', comunicadosRoutes);
app.use('/api/inicio', inicioRoutes);
app.use('/api/notificacoes', notificacoesRoutes);

app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ status: 'ok', banco: result.rows[0].now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'erro', mensagem: 'Falha ao conectar no banco' });
  }
});

module.exports = app;
