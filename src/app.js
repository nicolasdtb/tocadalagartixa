require('dotenv').config();
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const pool = require('./db');
const authRoutes = require('./routes/auth');

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
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: false,
  },
}));

app.use('/api/auth', authRoutes);

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
