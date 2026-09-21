# Toca da Lagartixa — App Interno

Aplicação interna de gestão do estúdio TOCA DA LAGARTIXA: agendamento, repasse, metas, benefícios, estoque, controle financeiro, melhorias, comunicados e auditoria.

Baseado no documento de regras de negócio consolidado (20/09/2026). Não é um sistema de gestão de clientes — é uma ferramenta de organização interna para sócios e residentes/tatuadores.

## Stack

- **Backend:** Node.js + Express
- **Banco:** PostgreSQL (schema `tocadalagartixa`)
- **Autenticação:** sessão via cookie (`express-session` + `connect-pg-simple`, sessões persistidas no Postgres) + `bcrypt` para hash de senha
- **Acesso ao banco:** `pg` (sem ORM)
- **Frontend:** HTML/CSS/JS simples servido pelo Express (a definir se evolui para algo mais robusto)
- **Formato de distribuição:** PWA (instalável via Chrome/Safari em Android e iOS)

## Infraestrutura

- VM Ubuntu Server dedicada, isolada de outras aplicações.
- **ZeroTier**: acesso administrativo/SSH à VM (não usado para o app em si).
- **Tailscale + Funnel**: exposição pública da aplicação com HTTPS automático.
- Hardening aplicado: SSH por chave (sem senha, sem root), UFW (nega tudo por padrão, libera SSH só via ZeroTier e tudo via Tailscale), fail2ban, unattended-upgrades.

Detalhes completos da configuração de segurança: ver documento `seguranca-servidor.md` (mantido fora do repositório).

## Estrutura do projeto

```
toca-lagartixa/
├── src/
│   ├── app.js              # Configuração do Express (middlewares, rotas)
│   ├── server.js           # Ponto de entrada (inicia o servidor)
│   ├── db.js                # Pool de conexão com o Postgres
│   ├── routes/
│   │   └── auth.js          # Login, logout, /me
│   ├── middlewares/
│   │   └── auth.js          # requireAuth, requireSocio
│   └── utils/
│       └── credenciais.js   # Geração de login genérico e senha provisória
├── public/                  # Arquivos estáticos (frontend)
├── seed.js                  # Cria o primeiro usuário sócio
├── schema_tocadalagartixa.sql  # Script de criação de todas as tabelas
├── .env                      # Variáveis de ambiente (NÃO versionado)
└── .gitignore
```

## Configuração do ambiente

Crie um arquivo `.env` na raiz com:

```
DATABASE_URL=postgres://usuario:senha@localhost:5432/tocalagartixa
SESSION_SECRET=string_aleatoria_longa
PORT=3001
```

**Atenção:** se a senha do banco tiver caracteres especiais (`#`, `@`, etc.), eles precisam ser URL-encodados na `DATABASE_URL` (ex.: `#` vira `%23`).

## Instalação

```bash
npm install
node seed.js       # cria o primeiro usuário sócio (login: admin / senha: troque123 — trocar depois)
npm start
```

## Rotas disponíveis (até o momento)

| Método | Rota | Descrição | Acesso |
| --- | --- | --- | --- |
| GET | `/api/health` | Verifica se o servidor e o banco estão de pé | Público |
| POST | `/api/auth/login` | Autentica e cria sessão | Público |
| POST | `/api/auth/logout` | Encerra a sessão | Autenticado |
| GET | `/api/auth/me` | Retorna dados da sessão atual | Autenticado |

## Regras de negócio essenciais

- **Repasse** (percentual sobre o valor da tattoo) e **nível de benefício** (por repasse acumulado no mês) são cálculos independentes — não confundir.
- Perfis: **Sócio** (acesso total) e **Residente/Tatuador** (acesso restrito aos próprios dados/agendamentos).
- Sessão expira em no máximo 7 dias com "manter logado".
- Fechamento mensal automático; correções exigem reabertura por um sócio.

Documento de regras de negócio completo disponível no projeto (fonte da verdade para qualquer dúvida de comportamento).

## Status do desenvolvimento

- [x] Fase 0 — Infraestrutura (VM, rede, segurança)
- [x] Fase 1 — Modelagem e criação do banco de dados
- [~] Fase 2 — Autenticação e usuários (login funcionando; criação de usuário pelo sócio em andamento)
- [ ] Fase 3 — Agendamento
- [ ] Fase 4 — Repasse e Meta Individual
- [ ] Fase 5 — Benefícios
- [ ] Fase 6 — Estoque
- [ ] Fase 7 — Controle Financeiro
- [ ] Fase 8 — Meta Coletiva e Fila de Melhorias
- [ ] Fase 9 — Comunicados
- [ ] Fase 10 — Auditoria
- [ ] Fase 11 — Integração e testes
- [ ] Fase 12 — Empacotamento como PWA
