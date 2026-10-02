-- Schema inicial (Fase 1). Em um banco já existente, marque como aplicada com: node src/migrate.js --baseline
CREATE SCHEMA IF NOT EXISTS tocadalagartixa;
-- =========================================================
-- TOCA DA LAGARTIXA — Schema do banco
-- Schema: tocadalagartixa
-- =========================================================

SET search_path TO tocadalagartixa;

-- =========================================================
-- ENUMS (tabelas de apoio para códigos)
-- =========================================================

CREATE TABLE enum_perfil (
    id smallint PRIMARY KEY,
    nome varchar(30) NOT NULL
);
INSERT INTO enum_perfil (id, nome) VALUES (1, 'socio'), (2, 'residente');

CREATE TABLE enum_tipo_movimentacao (
    id smallint PRIMARY KEY,
    nome varchar(30) NOT NULL
);
INSERT INTO enum_tipo_movimentacao (id, nome) VALUES (1, 'entrada'), (2, 'saida');

CREATE TABLE enum_tipo_lancamento (
    id smallint PRIMARY KEY,
    nome varchar(30) NOT NULL
);
INSERT INTO enum_tipo_lancamento (id, nome) VALUES (1, 'entrada'), (2, 'gasto'), (3, 'ajuste');

CREATE TABLE enum_estado_melhoria (
    id smallint PRIMARY KEY,
    nome varchar(30) NOT NULL
);
INSERT INTO enum_estado_melhoria (id, nome) VALUES (1, 'em_progresso'), (2, 'meta_atingida'), (3, 'finalizada');

CREATE TABLE enum_status_beneficio (
    id smallint PRIMARY KEY,
    nome varchar(30) NOT NULL
);
INSERT INTO enum_status_beneficio (id, nome) VALUES (1, 'pendente'), (2, 'aprovado'), (3, 'pago');

-- =========================================================
-- USUÁRIOS
-- =========================================================

CREATE TABLE usuarios (
    id bigserial PRIMARY KEY,
    nome varchar(150) NOT NULL,
    email varchar(150) NOT NULL,
    telefone varchar(20) NOT NULL,
    cpf varchar(14) NOT NULL UNIQUE,
    login varchar(50) NOT NULL UNIQUE,
    senha varchar(255) NOT NULL,
    perfil_id smallint NOT NULL REFERENCES enum_perfil(id),
    status boolean NOT NULL DEFAULT true,
    primeiro_acesso boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- AGENDAMENTO / REPASSE
-- =========================================================

CREATE TABLE faixas_repasse (
    id bigserial PRIMARY KEY,
    valor_min numeric(10,2) NOT NULL,
    valor_max numeric(10,2),
    percentual numeric(5,2) NOT NULL
);

CREATE TABLE agendamentos (
    id bigserial PRIMARY KEY,
    usuario_id bigint NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    data date NOT NULL,
    horario time NOT NULL,
    duracao integer,
    valor numeric(10,2) NOT NULL,
    percentual numeric(5,2) NOT NULL,
    repasse numeric(10,2) NOT NULL,
    mes_competencia date NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (usuario_id, horario, data)
);

-- =========================================================
-- METAS / BENEFÍCIOS
-- =========================================================

CREATE TABLE niveis_beneficio (
    id bigserial PRIMARY KEY,
    nivel smallint NOT NULL,
    repasse_minimo numeric(10,2) NOT NULL,
    valor numeric(10,2) NOT NULL
);

CREATE TABLE categorias_beneficio (
    id bigserial PRIMARY KEY,
    nome varchar(50) NOT NULL,
    ativa boolean NOT NULL DEFAULT false
);

CREATE TABLE beneficios_mensais (
    id bigserial PRIMARY KEY,
    usuario_id bigint NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    mes_competencia date NOT NULL,
    nivel_id bigint NOT NULL REFERENCES niveis_beneficio(id),
    valor numeric(10,2) NOT NULL,
    categoria_id bigint REFERENCES categorias_beneficio(id) ON DELETE RESTRICT,
    status_id smallint NOT NULL REFERENCES enum_status_beneficio(id),
    data_uso timestamptz,
    UNIQUE (usuario_id, mes_competencia)
);

CREATE TABLE isencoes_repasse (
    id bigserial PRIMARY KEY,
    usuario_id bigint NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    mes_concessao date NOT NULL,
    total smallint NOT NULL DEFAULT 3,
    usadas smallint NOT NULL DEFAULT 0
);

CREATE TABLE isencoes_uso (
    id bigserial PRIMARY KEY,
    isencao_id bigint NOT NULL REFERENCES isencoes_repasse(id) ON DELETE RESTRICT,
    agendamento_id bigint NOT NULL REFERENCES agendamentos(id) ON DELETE RESTRICT
);

-- =========================================================
-- ESTOQUE
-- =========================================================

CREATE TABLE materiais (
    id bigserial PRIMARY KEY,
    nome varchar(150) NOT NULL,
    unidade varchar(30) NOT NULL,
    quantidade numeric(10,2) NOT NULL DEFAULT 0,
    minimo numeric(10,2) NOT NULL DEFAULT 0,
    status boolean NOT NULL DEFAULT true
);

CREATE TABLE movimentacoes_estoque (
    id bigserial PRIMARY KEY,
    material_id bigint NOT NULL REFERENCES materiais(id) ON DELETE RESTRICT,
    tipo_id smallint NOT NULL REFERENCES enum_tipo_movimentacao(id),
    quantidade numeric(10,2) NOT NULL,
    usuario_id bigint NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    observacao text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- CONTROLE FINANCEIRO
-- =========================================================

CREATE TABLE categorias_financeiras (
    id bigserial PRIMARY KEY,
    nome varchar(50) NOT NULL UNIQUE
);
INSERT INTO categorias_financeiras (nome) VALUES
    ('operacional'), ('materiais'), ('beneficios'), ('marketing'), ('melhorias');

CREATE TABLE lancamentos_financeiros (
    id bigserial PRIMARY KEY,
    categoria_id bigint NOT NULL REFERENCES categorias_financeiras(id) ON DELETE RESTRICT,
    tipo_id smallint NOT NULL REFERENCES enum_tipo_lancamento(id),
    valor numeric(10,2) NOT NULL,
    mes_competencia date NOT NULL,
    usuario_id bigint NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    descricao text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE saldos_mensais (
    id bigserial PRIMARY KEY,
    categoria_id bigint NOT NULL REFERENCES categorias_financeiras(id) ON DELETE RESTRICT,
    mes date NOT NULL,
    saldo_inicial numeric(12,2) NOT NULL DEFAULT 0,
    destinacao numeric(12,2) NOT NULL DEFAULT 0,
    gastos numeric(12,2) NOT NULL DEFAULT 0,
    saldo_final numeric(12,2) NOT NULL DEFAULT 0,
    UNIQUE (categoria_id, mes)
);

CREATE TABLE fechamentos (
    id bigserial PRIMARY KEY,
    mes date NOT NULL UNIQUE,
    fechado boolean NOT NULL DEFAULT false,
    fechado_em timestamptz,
    reaberto_por bigint REFERENCES usuarios(id) ON DELETE RESTRICT,
    reaberto_em timestamptz,
    motivo text
);

-- =========================================================
-- MELHORIAS
-- =========================================================

CREATE TABLE melhorias (
    id bigserial PRIMARY KEY,
    nome varchar(150) NOT NULL,
    valor_alvo numeric(10,2) NOT NULL,
    prioridade integer NOT NULL,
    estado_id smallint NOT NULL REFERENCES enum_estado_melhoria(id),
    valor_gasto numeric(10,2),
    data_finalizacao timestamptz
);

-- =========================================================
-- COMUNICADOS
-- =========================================================

CREATE TABLE comunicados (
    id bigserial PRIMARY KEY,
    titulo varchar(200) NOT NULL,
    obrigatorio boolean NOT NULL DEFAULT false,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz
);

CREATE TABLE comunicados_versoes (
    id bigserial PRIMARY KEY,
    comunicado_id bigint NOT NULL REFERENCES comunicados(id) ON DELETE RESTRICT,
    versao integer NOT NULL,
    conteudo text NOT NULL,
    publicado_por bigint NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    publicado_em timestamptz NOT NULL DEFAULT now(),
    versao_base integer,
    UNIQUE (comunicado_id, versao)
);

CREATE TABLE comunicados_confirmacoes (
    id bigserial PRIMARY KEY,
    versao_id bigint NOT NULL REFERENCES comunicados_versoes(id) ON DELETE RESTRICT,
    usuario_id bigint NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    confirmado_em timestamptz NOT NULL DEFAULT now(),
    UNIQUE (versao_id, usuario_id)
);

-- =========================================================
-- AUDITORIA
-- =========================================================

CREATE TABLE auditoria (
    id bigserial PRIMARY KEY,
    usuario_id bigint REFERENCES usuarios(id) ON DELETE RESTRICT,
    modulo varchar(50) NOT NULL,
    acao varchar(50) NOT NULL,
    entidade varchar(50) NOT NULL,
    entidade_id bigint,
    antes jsonb,
    depois jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);
