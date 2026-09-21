require('dotenv').config();
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const pool = require('./db');

const app = express();

app.use(express.json());
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
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias, conforme regra de negócio
    httpOnly: true,
    secure: false, // true quando estiver atrás de HTTPS (Tailscale Funnel já entrega HTTPS na borda)
  },
}));

// Rota de teste — confirma que o servidor e o banco estão de pé
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
