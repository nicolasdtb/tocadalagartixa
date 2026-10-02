# 05 — Documentação técnica

Visão técnica do sistema: arquitetura, ordem dos middlewares, mapa completo da API, estrutura do frontend, segurança e como criar um módulo novo. Para as regras de negócio, veja [02 — Módulos e regras](02-modulos-e-regras.md); para as tabelas, [03 — Banco de dados](03-banco-de-dados.md).

## 1. Arquitetura

```
Navegador / PWA  ──HTTPS──►  Tailscale Funnel ──► Express (porta 3001)
                                                      │
                          arquivos estáticos (public/) + API REST (/api/*)
                                                      │
                                      pg (pool) ──► PostgreSQL (schema tocadalagartixa)
```

- **Um único processo Node.js** serve o frontend (`public/`) e a API (`/api/*`).
- **Sem ORM:** consultas SQL escritas à mão com o driver `pg`, sempre com parâmetros (`$1`, `$2`...).
- **Sem build de frontend:** HTML, CSS e JavaScript puros, servidos como arquivos estáticos.
- **Estado de login no banco:** sessões na tabela `sessoes` (via `connect-pg-simple`), então reiniciar o app não derruba os logins.
- Configuração por variáveis de ambiente (`.env`): `DATABASE_URL`, `SESSION_SECRET`, `PORT`.

### Estrutura do código

```
src/
├── server.js            # sobe o app na porta configurada
├── app.js               # configuração do Express (ver seção 2)
├── db.js                # Pool do PostgreSQL
├── migrate.js           # aplicador de migrations
├── middlewares/auth.js  # requireAuth, requireSocio, requirePrimeiroAcessoConcluido
├── routes/              # uma rota por módulo
│   ├── auth.js  primeiroAcesso.js  usuarios.js
│   ├── agendamentos.js  metas.js  beneficios.js
│   ├── estoque.js  financeiro.js  melhorias.js
│   └── comunicados.js  inicio.js  notificacoes.js
└── utils/
    ├── auditoria.js     # registrar({ usuarioId, modulo, acao, entidade, entidadeId, antes, depois })
    └── credenciais.js   # gerarLoginGenerico(), gerarSenhaProvisoria()
```

Onde ficam as regras de cálculo:

| Regra | Arquivo |
|---|---|
| Repasse por faixa e regra dos R$ 2.000 (isenções) | `routes/agendamentos.js` |
| Fórmula do mês (E, O, M, B, K, I), fechamento, reabertura | `routes/financeiro.js` |
| Estado automático da melhoria atual e saldo de Melhorias | `routes/melhorias.js` |
| Nível e acumulado da Meta Individual | `routes/metas.js` |

## 2. Ordem dos middlewares (`src/app.js`)

A ordem importa. Hoje é esta:

1. `express.json({ limit: '3mb' })`: leitura de JSON (o limite comporta a foto de perfil em base64).
2. `express.static('public')`: arquivos do frontend, sem exigir login.
3. `express-session` com `connect-pg-simple`: sessão em cookie por **7 dias**, `httpOnly`, tabela `tocadalagartixa.sessoes` (criada automaticamente se faltar).
4. **`requirePrimeiroAcessoConcluido` (global):** consulta o banco a cada requisição de usuário logado e bloqueia com **428** se houver pendência.
5. As rotas de cada módulo (`/api/...`).
6. `GET /api/health` (público): confere a conexão com o banco.

Cada rota ainda declara a própria proteção:

- **`requireAuth`:** exige sessão; **reconsulta o banco** a cada requisição. Se o usuário foi desativado, destrói a sessão e responde **403 "Acesso negado"**; também atualiza `perfil_id` e flags na sessão. Por isso a desativação e a troca de perfil valem imediatamente.
- **`requireSocio`:** exige `perfil_id = 1`, senão **403**.

### Pendências que bloqueiam o uso (código 428)

| `tipo` na resposta | Quando | Como o frontend reage |
|---|---|---|
| `primeiro_acesso` | Cadastro inicial não concluído | Mostra a tela de primeiro acesso |
| `senha_provisoria` | Senha foi redefinida | Mostra a tela de nova senha |
| `comunicado_pendente` | Residente com comunicado obrigatório sem confirmar | Leva à aba Comunicados |

Rotas **isentas** desse bloqueio (prefixos): `/api/auth`, `/api/primeiro-acesso`, `/api/health`, `/api/usuarios/trocar-senha` e `/api/comunicados` (o residente precisa dela para confirmar a leitura). Sócios nunca são travados por comunicados.

### Códigos de resposta usados

| Código | Significado |
|---|---|
| 200 / 201 | Sucesso / criado |
| 400 | Dados inválidos ou regra violada (ex.: estoque insuficiente) |
| 401 | Não autenticado |
| 403 | Acesso negado (sem permissão ou usuário desativado) |
| 404 | Não encontrado |
| 409 | Conflito (ex.: horário duplicado, CPF já cadastrado) |
| 423 | Mês financeiro fechado |
| 428 | Pendência obrigatória (tabela acima) |
| 500 | Erro interno (detalhe só no log do servidor) |

Respostas de erro vêm como `{ "erro": "mensagem" }`.

## 3. Mapa da API

Legenda de acesso: **Público** (sem login), **Logado** (qualquer usuário ativo) e **Sócio**. O parâmetro `:mes` usa o formato `AAAA-MM`.

### Acesso e usuários

| Método | Rota | Acesso | Função |
|---|---|---|---|
| POST | `/api/auth/login` | Público | Login; abre a sessão |
| POST | `/api/auth/logout` | Público | Encerra a sessão |
| GET | `/api/auth/me` | Sessão | Dados do usuário logado e flags de pendência |
| POST | `/api/primeiro-acesso` | Logado | Conclui o cadastro inicial (dados + login + senha) |
| POST | `/api/usuarios` | Sócio | Cria usuário (só o perfil); devolve login e senha provisória uma única vez |
| GET | `/api/usuarios` | Sócio | Lista usuários |
| PATCH | `/api/usuarios/:id/status` | Sócio | Ativa/desativa (não permite desativar a si mesmo) |
| PATCH | `/api/usuarios/:id/perfil` | Sócio | Troca entre sócio e residente |
| POST | `/api/usuarios/:id/redefinir-senha` | Sócio | Gera senha provisória; exige troca no próximo login |
| POST | `/api/usuarios/trocar-senha` | Logado | Troca a própria senha |
| GET / PUT | `/api/usuarios/me` | Logado | Lê / edita o próprio perfil (inclui foto) |

### Agenda, metas e benefícios

| Método | Rota | Acesso | Função |
|---|---|---|---|
| POST | `/api/agendamentos` | Logado | Cria agendamento (residente só para si; sócio para qualquer um) e calcula o repasse |
| GET | `/api/agendamentos` | Logado | Lista o calendário coletivo |
| PUT | `/api/agendamentos/:id` | Logado | Edita (residente só o próprio); recalcula o repasse |
| DELETE | `/api/agendamentos/:id` | Logado | Exclui (residente só o próprio); auditado |
| GET | `/api/metas/individual` | Logado | Acumulado do mês, nível atual e próximo |
| GET | `/api/metas/niveis` | Logado | Tabela de níveis e benefícios |
| GET | `/api/beneficios/categorias` | Logado | Categorias de benefício ativas |
| POST | `/api/beneficios/solicitar` | Logado | Residente solicita o benefício do mês |
| PATCH | `/api/beneficios/:id/status` | Sócio | Aprova ou marca como pago |
| GET | `/api/beneficios/resumo` | Sócio | Repasse, nível e benefício por residente |

### Estoque

| Método | Rota | Acesso | Função |
|---|---|---|---|
| POST | `/api/estoque/materiais` | Sócio | Cadastra material |
| GET | `/api/estoque/materiais` | Logado | Lista (residente vê só os ativos); inclui `estoque_baixo` |
| PATCH | `/api/estoque/materiais/:id/status` | Sócio | Ativa/desativa material |
| POST | `/api/estoque/movimentacoes` | Logado | Registra entrada (só sócio) ou saída; transação com bloqueio de linha, nunca deixa o estoque negativo |
| DELETE | `/api/estoque/movimentacoes/:id` | Logado | Exclui a própria (ou qualquer, se sócio) e reverte o estoque; auditado |

### Financeiro (todas só para sócio)

| Método | Rota | Função |
|---|---|---|
| POST | `/api/financeiro/entradas` | Registra entrada de caixa |
| POST | `/api/financeiro/orcamentos` | Define orçamento de Operacional ou Materiais no mês |
| POST | `/api/financeiro/gastos` | Registra gasto numa categoria (aceita `itens` para Materiais); responde 423 se o mês está fechado |
| GET | `/api/financeiro/fechamento/:mes/preview` | Calcula a fórmula do mês sem gravar |
| POST | `/api/financeiro/fechamento/:mes/fechar` | Fecha o mês e grava os saldos |
| POST | `/api/financeiro/fechamento/:mes/reabrir` | Reabre o mês (exige motivo); auditado |
| GET | `/api/financeiro/saldos/:mes` | Saldos por categoria no mês |
| GET | `/api/financeiro/saldos-periodo` | Consolidado de vários meses |
| GET | `/api/financeiro/lancamentos/:mes` | Lançamentos do mês |

### Melhorias, comunicados e painel

| Método | Rota | Acesso | Função |
|---|---|---|---|
| POST | `/api/melhorias` | Sócio | Adiciona à fila |
| GET | `/api/melhorias` | Sócio | Fila completa |
| PATCH | `/api/melhorias/:id/prioridade` | Sócio | Altera a posição na fila |
| PATCH | `/api/melhorias/:id/valor-alvo` | Sócio | Altera o valor-alvo |
| POST | `/api/melhorias/:id/finalizar` | Sócio | Finaliza, lança o gasto real e promove a próxima |
| DELETE | `/api/melhorias/:id` | Sócio | Remove (só se ainda em progresso) |
| GET | `/api/melhorias/atual` | Logado | Melhoria atual e progresso (visão sem o caixa total) |
| POST | `/api/comunicados` | Sócio | Publica (versão 1) |
| GET | `/api/comunicados` | Logado | Lista, com a situação de confirmação do usuário |
| PUT | `/api/comunicados/:id` | Sócio | Edita e cria a próxima versão (exige categoria de motivo) |
| GET | `/api/comunicados/:id/versoes` | Sócio | Histórico de versões |
| POST | `/api/comunicados/:id/confirmar` | Logado | Confirma a leitura da versão atual |
| GET | `/api/comunicados/:id/confirmacoes` | Sócio | Quem confirmou |
| DELETE | `/api/comunicados/:id` | Sócio | Exclusão lógica |
| GET / POST | `/api/comunicados/motivos` | Logado / Sócio | Lista / cadastra categorias de motivo de edição |
| GET | `/api/inicio/ranking` | Logado | Ranking do mês (posição e nome, sem valores) |
| GET | `/api/notificacoes` | Logado | Alertas calculados na hora para o perfil |
| GET | `/api/health` | Público | Verifica a conexão com o banco |

## 4. Frontend

Tudo em `public/`: `index.html` (telas e menu), `css/style.css` (estilos), `js/api.js` (chamadas à API) e `js/app.js` (telas e navegação).

**Cliente da API (`api.js`):** funções `api.get`, `api.post`, `api.put`, `api.patch` e `api.delete`, sempre com JSON e cookie de sessão. Em caso de erro, a exceção traz `err.dados.erro` com a mensagem do servidor, e as respostas **428** disparam o redirecionamento da seção 2.

**Navegação (`app.js`):**
- O menu é montado em `index.html` com botões `.nav-item data-view="nome"`; os restritos a sócio levam a classe `apenas-socio`.
- `navegarPara(view)` chama `views[view](container)`. Cada tela é uma função dentro do objeto `views` (`inicio`, `agenda`, `metas`, `beneficios`, `estoque`, `financeiro`, `melhorias`, `comunicados`, `usuarios`, `perfil`).
- `usuarioAtual` guarda os dados do usuário logado; o perfil decide o que cada tela mostra.

**Padrões de interface reutilizáveis:**

| Padrão | Função |
|---|---|
| `abrirOverlay(titulo, html)` / `fecharOverlay()` | Tela sobreposta para formulários e detalhes |
| `mostrarBotaoFixoRodape(rotulo, acao)` / `esconderBotaoFixoRodape()` | Botão de ação fixo no rodapé (ex.: "+ Novo lançamento") |
| `esc(texto)` | Escapa HTML; **use sempre** ao exibir texto vindo do banco |
| Linhas em grade (`.lanc-linha`, `.ben-linha`, `.mel-linha`) | Lista que vira cartões no celular |
| Cards do Início (`.inicio-card`, cores `.cor-roxo/.cor-verde/.cor-escarlate`) | Painel personalizável |

**Preferências locais:** a ordem e os cards ocultos do Início ficam no `localStorage` do aparelho (chave `toca_inicio_prefs_<id>`).

**PWA:** `manifest.json` (nome, ícones, cores) e `service-worker.js` (cache dos arquivos). Veja [04 — Instalar o app no celular](04-instalar-pwa.md).

**Identidade visual:** roxo `#7c3aed` (ação principal), escarlate `#c81d3f` (marca e alertas), verde `#39d353` (sucesso), fundos escuros e off-white nos textos. As cores são variáveis CSS no início de `style.css`.

## 5. Segurança

**O que já existe:**
- Consultas SQL **parametrizadas** em todo o código (proteção contra SQL injection).
- Senhas com **hash bcrypt**; senha provisória sempre exige troca.
- Cookie de sessão `httpOnly`, validade de 7 dias; o usuário é reconferido no banco **a cada requisição**.
- Autorização por rota (`requireAuth` / `requireSocio`) e regras de "só o próprio" nas rotas de agendamento e estoque.
- Frontend escapa HTML de dados do usuário (`esc()`).
- Auditoria das ações relevantes, com estado anterior e posterior.
- Servidor: SSH somente por chave via rede privada, UFW, fail2ban (SSH), atualizações automáticas; banco sem exposição externa. Detalhes em `seguranca-servidor.md`.

**Pontos de melhoria conhecidos** (nenhum impede o uso interno, mas vale endurecer):
- O cookie de sessão está com `secure: false`. Atrás do Funnel (HTTPS), o ideal é `app.set('trust proxy', 1)` e `secure: true` em produção.
- Não há limite de tentativas de login por usuário ou IP (o fail2ban protege só o SSH).
- Não há cabeçalhos de segurança HTTP (por exemplo, o pacote `helmet`) nem token anti-CSRF; a proteção atual depende do comportamento padrão dos navegadores para cookies e do uso de JSON.
- A foto de perfil é limitada por tamanho, mas o tipo do arquivo não é verificado no servidor.
- O prefixo isento `/api/comunicados` também dispensa o bloqueio de primeiro acesso e de senha provisória nessas rotas (a autenticação continua exigida por rota).

## 6. Como criar um módulo novo

Exemplo: módulo "Fornecedores".

1. **Banco:** crie `migrations/00X_fornecedores.sql` (idempotente, com `SET search_path TO tocadalagartixa;`) e rode `node src/migrate.js`.
2. **Rota:** crie `src/routes/fornecedores.js` com `express.Router()`, proteja cada rota com `requireAuth` ou `requireSocio`, use consultas parametrizadas e, nas ações relevantes, `registrar(...)` de `utils/auditoria.js`.
3. **Registro:** em `src/app.js`, importe a rota e adicione `app.use('/api/fornecedores', fornecedoresRoutes);` junto das demais (depois do middleware global). Não inclua em `ROTAS_LIVRES`.
4. **Menu:** em `public/index.html`, adicione um `.nav-item` com `data-view="fornecedores"` (com `apenas-socio oculto` se for só dos sócios) e um ícone SVG.
5. **Tela:** em `public/js/app.js`, crie `views.fornecedores(container)` seguindo os padrões da seção 4 (lista em linhas/cards, botão fixo no rodapé e overlay para o formulário).
6. **Cache do PWA:** aumente a versão do cache em `public/service-worker.js` para os aparelhos receberem a novidade.
7. **Documentação:** atualize os documentos 02 (regras), 03 (tabelas) e este (rotas).
8. **Publicar:** envie os arquivos para a VM, `node src/migrate.js`, `sudo systemctl restart toca-lagartixa` e `git commit` + `git push`.

## 7. Acréscimos recentes

- **Rotas novas**: `GET /api/condicoes` (documento e situação do aceite), `POST /api/condicoes/aceitar`, `PUT /api/condicoes` (sócio), `GET /api/usuarios/:id/foto` (foto como imagem).
- **Fotos**: ficam em base64 na coluna `usuarios.foto`. As listas (agendamentos, ranking) só trazem `tem_foto` e `foto_v` (versão); o navegador busca a imagem em `/api/usuarios/:id/foto?v=...`, com cache de 1 dia. A rota só serve png, jpeg, webp e gif, com `X-Content-Type-Options: nosniff`.
- **Tutoriais e aceite**: totalmente no frontend (`app.js`: `obterTutoriais`, `abrirTutorial`, `verificarCondicoes`, `condicoesHtml`).
