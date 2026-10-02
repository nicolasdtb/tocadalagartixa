-- Tabela de sessões de login (usada pelo connect-pg-simple).
-- Em bancos já existentes ela já está criada; aqui garantimos que instalações novas também a tenham.
CREATE TABLE IF NOT EXISTS tocadalagartixa.sessoes (
    sid varchar NOT NULL PRIMARY KEY,
    sess json NOT NULL,
    expire timestamp(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessoes_expire ON tocadalagartixa.sessoes (expire);
