-- Alterações feitas manualmente durante o desenvolvimento, consolidadas aqui.
-- Escritas pra serem seguras de rodar num banco que já tenha recebido essas mudanças.
SET search_path TO tocadalagartixa;

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS senha_provisoria boolean NOT NULL DEFAULT false;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS foto text;
ALTER TABLE usuarios ALTER COLUMN nome DROP NOT NULL;
ALTER TABLE usuarios ALTER COLUMN email DROP NOT NULL;
ALTER TABLE usuarios ALTER COLUMN telefone DROP NOT NULL;
ALTER TABLE usuarios ALTER COLUMN cpf DROP NOT NULL;

ALTER TABLE lancamentos_financeiros ALTER COLUMN categoria_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS orcamentos_categoria (
    id bigserial PRIMARY KEY,
    categoria_id bigint NOT NULL REFERENCES categorias_financeiras(id),
    mes date NOT NULL,
    valor numeric(12,2) NOT NULL,
    UNIQUE (categoria_id, mes)
);

ALTER TABLE isencoes_repasse ADD COLUMN IF NOT EXISTS valor_beneficio numeric(10,2) NOT NULL DEFAULT 250;

CREATE TABLE IF NOT EXISTS motivos_edicao_comunicado (
    id bigserial PRIMARY KEY,
    nome varchar(80) NOT NULL UNIQUE
);
ALTER TABLE comunicados_versoes ADD COLUMN IF NOT EXISTS motivo_categoria_id bigint REFERENCES motivos_edicao_comunicado(id);
ALTER TABLE comunicados_versoes ADD COLUMN IF NOT EXISTS motivo_texto text;
