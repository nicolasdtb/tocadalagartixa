// Aplica, em ordem, os arquivos de migrations/ que ainda não rodaram neste banco.
// Uso:  node src/migrate.js             -> aplica as pendentes
//       node src/migrate.js --status    -> só lista o que está aplicado e o que falta
//       node src/migrate.js --baseline  -> marca a 001 como aplicada sem rodar (banco já existente)
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./db');

const PASTA = path.join(__dirname, '..', 'migrations');

async function main() {
  const flag = process.argv[2];
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS tocadalagartixa.schema_migrations (
        nome text PRIMARY KEY,
        aplicada_em timestamptz NOT NULL DEFAULT now()
      )`);

    const arquivos = fs.readdirSync(PASTA).filter((f) => f.endsWith('.sql')).sort();
    const aplicadas = new Set(
      (await client.query('SELECT nome FROM tocadalagartixa.schema_migrations')).rows.map((r) => r.nome)
    );

    if (flag === '--baseline') {
      await client.query(
        'INSERT INTO tocadalagartixa.schema_migrations (nome) VALUES ($1) ON CONFLICT DO NOTHING',
        [arquivos[0]]
      );
      console.log(`Marcada como aplicada (sem rodar): ${arquivos[0]}`);
      return;
    }

    const pendentes = arquivos.filter((f) => !aplicadas.has(f));

    if (flag === '--status') {
      arquivos.forEach((f) => console.log(`${aplicadas.has(f) ? '[ok]      ' : '[pendente]'} ${f}`));
      return;
    }

    if (pendentes.length === 0) {
      console.log('Nenhuma migration pendente.');
      return;
    }

    for (const arquivo of pendentes) {
      const sql = fs.readFileSync(path.join(PASTA, arquivo), 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO tocadalagartixa.schema_migrations (nome) VALUES ($1)', [arquivo]);
        await client.query('COMMIT');
        console.log(`Aplicada: ${arquivo}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`Falhou em ${arquivo} (nada dela foi aplicado): ${err.message}`);
        process.exitCode = 1;
        return;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
