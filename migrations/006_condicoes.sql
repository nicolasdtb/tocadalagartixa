-- Aceite das "Condições — Artistas Residentes" (por versão do documento)
CREATE TABLE IF NOT EXISTS tocadalagartixa.aceites_condicoes (
  id         serial PRIMARY KEY,
  usuario_id integer NOT NULL REFERENCES tocadalagartixa.usuarios(id),
  versao     integer NOT NULL,
  aceito_em  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, versao)
);
