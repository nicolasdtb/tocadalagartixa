require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('./src/db');

async function seed() {
  const senha = await bcrypt.hash('troque123', 10);
  await pool.query(`
    INSERT INTO tocadalagartixa.usuarios
      (nome, email, telefone, cpf, login, senha, perfil_id, status, primeiro_acesso)
    VALUES
      ('Sócio Inicial', 'socio@tocadalagartixa.com', '00000000000', '00000000000', 'admin', $1, 1, true, false)
    ON CONFLICT (login) DO NOTHING
  `, [senha]);
  console.log('Seed concluído. Login: admin / Senha: troque123');
  process.exit(0);
}

seed();
