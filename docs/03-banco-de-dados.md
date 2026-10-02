# 03 — Banco de dados

O app usa **PostgreSQL** (banco `tocalagartixa`, schema `tocadalagartixa`, usuário do app `app_tocalagartixa`). Este documento descreve as tabelas, as regras de integridade, como evoluir o banco com migrations e como conectar pelo DBeaver.

## 1. Convenções

- Chaves primárias `id bigserial` (sequenciais).
- Nomes curtos e sem acento: `usuario_id`, `login`, `senha`, `perfil_id`.
- Códigos com 3 ou mais valores ficam em tabelas `enum_*`; status de dois valores usam `boolean` (`status`, `ativa`, `fechado`).
- `timestamptz` só onde o momento exato importa (`created_at`, `confirmado_em`...); datas de competência são `date` (sempre o **dia 1** do mês).
- Chaves estrangeiras usam `ON DELETE RESTRICT`: nada é apagado em cascata, o histórico se preserva.
- Comunicados usam exclusão lógica (`is_deleted`, `deleted_at`).
- Em consultas fora do app, use o prefixo `tocadalagartixa.` ou rode antes `SET search_path TO tocadalagartixa;`.

## 2. Mapa das tabelas

```
usuarios ─┬─< agendamentos ──< isencoes_uso >── isencoes_repasse >── usuarios
          ├─< beneficios_mensais >── niveis_beneficio / categorias_beneficio
          ├─< movimentacoes_estoque >── materiais
          ├─< lancamentos_financeiros >── categorias_financeiras
          ├─< comunicados_versoes >── comunicados
          │        └─< comunicados_confirmacoes
          └─< auditoria

categorias_financeiras ─< saldos_mensais, orcamentos_categoria
fechamentos (um por mês)      melhorias (fila)      faixas_repasse (parâmetro)
```

## 3. Tabelas por assunto

### 3.1 Usuários e sessões

**`usuarios`**

| Coluna | Tipo | Observações |
|---|---|---|
| id | bigint | PK |
| nome, email, telefone | varchar | Opcionais no banco: preenchidos pelo próprio usuário no primeiro acesso. |
| cpf | varchar(14) | **Único**. |
| login | varchar(50) | **Único**. |
| senha | varchar | Hash `bcrypt`. Nunca guarda a senha real. |
| perfil_id | smallint | FK → `enum_perfil` (1 sócio, 2 residente). |
| status | boolean | `true` = ativo. |
| primeiro_acesso | boolean | `true` quando o cadastro inicial já foi concluído. |
| senha_provisoria | boolean | `true` obriga a troca de senha no próximo login. |
| foto | text | Foto de perfil em base64 (a nova substitui a antiga). |
| created_at, updated_at | timestamptz | |

**`sessoes`**: sessões de login (`sid`, `sess` json, `expire`), gerenciada pela biblioteca `connect-pg-simple`. Sessões expiradas são removidas automaticamente.

### 3.2 Agenda, repasse e metas

**`agendamentos`**: `usuario_id`, `data`, `horario`, `duracao`, `valor`, `percentual`, `repasse`, `mes_competencia`, `created_at`.
Restrição única `(usuario_id, horario, data)`: o mesmo tatuador não pode ter dois agendamentos começando no mesmo horário. `percentual` e `repasse` ficam gravados no agendamento e são recalculados ao editar.

**`faixas_repasse`**: `valor_min`, `valor_max` (nulo = sem limite), `percentual`. Padrão: 100–499,99 → 30%, 500–999,99 → 25%, a partir de 1000 → 20%.

**`niveis_beneficio`**: `nivel` (1 a 5), `repasse_minimo`, `valor`. Padrão: 300→50, 400→80, 600→130, 800→190, 1000→250.

### 3.3 Benefícios

**`beneficios_mensais`**: `usuario_id`, `mes_competencia`, `nivel_id`, `valor`, `categoria_id`, `status_id`, `data_uso`.
Único `(usuario_id, mes_competencia)`: **um benefício por pessoa por mês**. `status_id` → `enum_status_beneficio` (1 pendente, 2 aprovado, 3 pago).

**`categorias_beneficio`**: `nome`, `ativa`. Padrão: Roupas, Uber, Adega, Tabacaria.

**`isencoes_repasse`** (regra dos R$ 2.000): `usuario_id`, `mes_concessao`, `total` (isenções concedidas, normalmente 3), `usadas`, `valor_beneficio` (R$ 250).
**`isencoes_uso`**: liga cada isenção ao agendamento que a consumiu (`isencao_id`, `agendamento_id`).

### 3.4 Estoque

**`materiais`**: `nome`, `unidade`, `quantidade`, `minimo` (alerta quando `quantidade <= minimo`), `status` (ativo/inativo).
**`movimentacoes_estoque`**: `material_id`, `tipo_id` (1 entrada, 2 saída), `quantidade`, `usuario_id`, `observacao`, `created_at`.

A quantidade atual fica em `materiais.quantidade` e é atualizada junto com cada movimentação, dentro de uma transação.

### 3.5 Financeiro

**`categorias_financeiras`**: 1 operacional, 2 materiais, 3 beneficios, 4 marketing, 5 melhorias (estrutura fixa; os nomes ficam em minúsculas no banco).

**`lancamentos_financeiros`**

| Coluna | Observações |
|---|---|
| categoria_id | Pode ser **nulo**: tipo *entrada* sem categoria é a **entrada geral de caixa**. |
| tipo_id | FK → `enum_tipo_lancamento` (1 entrada, 2 gasto, 3 ajuste). |
| valor, mes_competencia, usuario_id, descricao, created_at | |
| itens | Texto livre com os materiais de um gasto da categoria Materiais. |

**`orcamentos_categoria`**: orçamento mensal por categoria (`categoria_id`, `mes`, `valor`), usado para Operacional e Materiais.

**`saldos_mensais`**: foto consolidada de cada categoria por mês (`saldo_inicial`, `destinacao`, `gastos`, `saldo_final`). Único `(categoria_id, mes)`. É gravada no fechamento do mês.

**`fechamentos`**: um registro por mês (`mes` único): `fechado`, `fechado_em`, e, quando reaberto, `reaberto_por`, `reaberto_em`, `motivo`.

### 3.6 Melhorias

**`melhorias`**: `nome`, `valor_alvo`, `prioridade` (ordem da fila), `estado_id` (1 em_progresso, 2 meta_atingida, 3 finalizada), `valor_gasto`, `data_finalizacao`.

### 3.7 Comunicados

- **`comunicados`**: `titulo`, `obrigatorio`, `is_deleted`, `deleted_at`.
- **`comunicados_versoes`**: `comunicado_id`, `versao` (única por comunicado), `conteudo`, `publicado_por`, `publicado_em`, `versao_base` (em qual versão a edição começou, para o aviso de conflito), `motivo_categoria_id`, `motivo_texto`.
- **`comunicados_confirmacoes`**: `versao_id`, `usuario_id`, `confirmado_em`. Único `(versao_id, usuario_id)`.
- **`motivos_edicao_comunicado`**: categorias de motivo de edição (cadastráveis pelo sócio).

### 3.8 Auditoria

**`auditoria`**: `usuario_id`, `modulo`, `acao`, `entidade`, `entidade_id`, `antes` (jsonb), `depois` (jsonb), `created_at`. Guarda o estado anterior e o novo para reconstruir o que aconteceu. Não é apagada quando o registro original é excluído.

### 3.9 Tabelas de apoio (`enum_*`)

| Tabela | Valores |
|---|---|
| `enum_perfil` | 1 socio, 2 residente |
| `enum_tipo_movimentacao` | 1 entrada, 2 saida |
| `enum_tipo_lancamento` | 1 entrada, 2 gasto, 3 ajuste |
| `enum_estado_melhoria` | 1 em_progresso, 2 meta_atingida, 3 finalizada |
| `enum_status_beneficio` | 1 pendente, 2 aprovado, 3 pago |

### 3.10 Controle das migrations

**`schema_migrations`**: `nome` (arquivo aplicado) e `aplicada_em`. Quem preenche é o `src/migrate.js`.

## 4. Migrations: como evoluir o banco

Toda mudança de estrutura vira um **arquivo novo** em `migrations/`, numerado em sequência. Nunca edite uma migration que já foi aplicada.

Modelo de arquivo (`migrations/006_exemplo.sql`):

```sql
SET search_path TO tocadalagartixa;

ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS observacao text;
```

Regras:
- Escreva de forma **idempotente** (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`), para poder rodar em qualquer estado do banco.
- Cada arquivo roda em **uma transação**: se algo falhar, nada daquele arquivo é aplicado.
- Depois de enviar o arquivo para a VM, rode `node src/migrate.js` (e `--status` para conferir).
- Como o usuário do app é dono do schema, não é preciso fazer `GRANT` depois de criar tabelas.

Banco já existente que nunca usou migrations: `node src/migrate.js --baseline` marca a `001` como aplicada sem executá-la; depois `node src/migrate.js` aplica as demais.

## 5. Backup e restauração

O backup diário (`pg_dump` compactado, 14 cópias em `~/backups`) está descrito em [01 — Instalação e operação](01-instalacao.md#4-backup-do-banco). Para restaurar:

```bash
gunzip -c ~/backups/<arquivo>.sql.gz | sudo -u postgres psql tocalagartixa
```

## 6. Conectar pelo DBeaver

O PostgreSQL só escuta dentro da VM (não há acesso direto da internet nem da rede local). Por isso a conexão passa por um **túnel SSH**, usando o mesmo acesso administrativo da VM.

1. Instale o **DBeaver Community** no seu computador.
2. **Nova conexão → PostgreSQL**.
3. Aba **Main**:
   - Host: `localhost`
   - Porta: `5432`
   - Database: `tocalagartixa`
   - Usuário: `app_tocalagartixa` (ou o usuário de consulta, veja abaixo) e a respectiva senha.
4. Aba **SSH**: marque **Use SSH Tunnel**:
   - Host/IP: o endereço da VM na rede ZeroTier (o mesmo do SSH administrativo)
   - Porta: `22`
   - Usuário: o usuário SSH da VM
   - Authentication Method: **Public Key**
   - Private Key: o arquivo da chave privada usada no SSH (a mesma do `scp`)
5. Clique em **Test Connection**. Se o DBeaver pedir para baixar o driver PostgreSQL, aceite.
6. No painel esquerdo, abra **tocalagartixa → Schemas → tocadalagartixa → Tables**.

> Cuidado: com o usuário `app_tocalagartixa` qualquer alteração feita no DBeaver vale para o sistema de verdade. Para apenas consultar, prefira um usuário somente leitura.

### Usuário somente leitura (recomendado)

Na VM, em `sudo -u postgres psql -d tocalagartixa`:

```sql
CREATE ROLE consulta LOGIN PASSWORD '<senha-forte>';
GRANT CONNECT ON DATABASE tocalagartixa TO consulta;
GRANT USAGE ON SCHEMA tocadalagartixa TO consulta;
GRANT SELECT ON ALL TABLES IN SCHEMA tocadalagartixa TO consulta;
ALTER DEFAULT PRIVILEGES FOR ROLE app_tocalagartixa IN SCHEMA tocadalagartixa
  GRANT SELECT ON TABLES TO consulta;
-- opcional: esconder a tabela de sessões
REVOKE SELECT ON tocadalagartixa.sessoes FROM consulta;
```

Mesmo somente leitura, esse usuário enxerga dados pessoais (CPF, telefone) e o hash das senhas. Guarde a senha dele com cuidado.

## 7. Consultas úteis

```sql
SET search_path TO tocadalagartixa;

-- Repasse acumulado por tatuador no mês atual
SELECT u.nome, SUM(a.repasse) AS repasse
FROM agendamentos a JOIN usuarios u ON u.id = a.usuario_id
WHERE a.mes_competencia = date_trunc('month', current_date)
GROUP BY u.nome ORDER BY repasse DESC;

-- Lançamentos financeiros de um mês
SELECT l.created_at, t.nome AS tipo, c.nome AS categoria, l.valor, l.descricao, l.itens
FROM lancamentos_financeiros l
JOIN enum_tipo_lancamento t ON t.id = l.tipo_id
LEFT JOIN categorias_financeiras c ON c.id = l.categoria_id
WHERE l.mes_competencia = '2026-10-01'
ORDER BY l.created_at;

-- Materiais com estoque baixo
SELECT nome, quantidade, minimo, unidade
FROM materiais WHERE status AND quantidade <= minimo;

-- Últimas ações registradas na auditoria
SELECT a.created_at, u.nome, a.modulo, a.acao, a.entidade, a.entidade_id
FROM auditoria a LEFT JOIN usuarios u ON u.id = a.usuario_id
ORDER BY a.created_at DESC LIMIT 50;
```
