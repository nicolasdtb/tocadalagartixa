-- Dados de configuração que foram inseridos à mão. Só insere se a tabela estiver vazia.
SET search_path TO tocadalagartixa;

INSERT INTO faixas_repasse (valor_min, valor_max, percentual)
SELECT * FROM (VALUES (100::numeric, 499.99::numeric, 30::numeric), (500, 999.99, 25), (1000, NULL, 20)) v
WHERE NOT EXISTS (SELECT 1 FROM faixas_repasse);

INSERT INTO niveis_beneficio (nivel, repasse_minimo, valor)
SELECT * FROM (VALUES (1::smallint, 300::numeric, 50::numeric), (2, 400, 80), (3, 600, 130), (4, 800, 190), (5, 1000, 250)) v
WHERE NOT EXISTS (SELECT 1 FROM niveis_beneficio);

INSERT INTO categorias_beneficio (nome, ativa)
SELECT * FROM (VALUES ('Roupas', true), ('Uber', true), ('Adega', true), ('Tabacaria', true)) v
WHERE NOT EXISTS (SELECT 1 FROM categorias_beneficio);

INSERT INTO motivos_edicao_comunicado (nome) VALUES
    ('Correção de erro'), ('Atualização de informação'), ('Mudança de horário/regra'), ('Outro')
ON CONFLICT (nome) DO NOTHING;
