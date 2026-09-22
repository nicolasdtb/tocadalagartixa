# Toca da Lagartixa — App Interno

Aplicação interna de gestão do estúdio TOCA DA LAGARTIXA: agendamento, repasse, metas, benefícios, estoque, controle financeiro, melhorias, comunicados e auditoria.

Baseado no documento de regras de negócio consolidado (20/09/2026). Não é um sistema de gestão de clientes — é uma ferramenta de organização interna para sócios e residentes/tatuadores.

## Stack

- **Backend:** Node.js + Express
- **Banco:** PostgreSQL (schema `tocadalagartixa`)
- **Autenticação:** sessão via cookie (`express-session` + `connect-pg-simple`, sessões persistidas no Postgres) + `bcrypt` para hash de senha
- **Acesso ao banco:** `pg` (sem ORM)
- **Frontend:** ainda não implementado (backend testado via `curl`)
- **Formato de distribuição:** PWA (instalável via Chrome/Safari em Android e iOS)

## Infraestrutura

- VM Ubuntu Server dedicada, isolada de outras aplicações.
- **ZeroTier**: acesso administrativo/SSH à VM (não usado para o app em si).
- **Tailscale + Funnel**: exposição pública da aplicação com HTTPS automático.
- Hardening aplicado: SSH por chave (sem senha, sem root), UFW (nega tudo por padrão, libera SSH só via ZeroTier e tudo via Tailscale), fail2ban, unattended-upgrades.

## Estrutura do projeto

```
toca-lagartixa/
├── src/
│   ├── app.js                    # Configuração do Express (middlewares, rotas)
│   ├── server.js                 # Ponto de entrada
│   ├── db.js                     # Pool de conexão com o Postgres
│   ├── routes/
│   │   ├── auth.js                # Login, logout, /me
│   │   ├── usuarios.js            # CRUD, status, perfil, redefinição de senha
│   │   ├── primeiroAcesso.js      # Fluxo de primeiro acesso obrigatório
│   │   ├── agendamentos.js        # CRUD + cálculo de repasse + regra dos R$2.000
│   │   ├── metas.js               # Meta Individual (acumulado, níveis)
│   │   ├── beneficios.js          # Benefício mensal, categorias, aprovação
│   │   ├── estoque.js             # Materiais e movimentações
│   │   ├── financeiro.js          # Entradas, orçamentos, gastos, fechamento mensal
│   │   ├── melhorias.js           # Fila de melhorias e Meta Coletiva
│   │   └── comunicados.js         # Comunicados com versionamento
│   ├── middlewares/
│   │   └── auth.js                # requireAuth, requireSocio, requirePrimeiroAcessoConcluido
│   └── utils/
│       ├── credenciais.js         # Geração de login/senha provisória
│       └── auditoria.js           # Helper centralizado de registro de auditoria
├── public/                        # Arquivos estáticos (frontend — pendente)
├── seed.js                        # Cria o primeiro usuário sócio
├── schema_tocadalagartixa.sql     # Script de criação de todas as tabelas
├── .env                            # Variáveis de ambiente (NÃO versionado)
└── .gitignore
```

## Configuração do ambiente

```
DATABASE_URL=postgres://usuario:senha@localhost:5432/tocalagartixa
SESSION_SECRET=string_aleatoria_longa
PORT=3001
```
Caracteres especiais na senha do banco (`#`, `@`, etc.) precisam ser URL-encodados.

## Instalação

```bash
npm install
node seed.js
npm run dev   # com nodemon, recarrega sozinho
```

## Rotas da API

### Autenticação (`/api/auth`)
| Método | Rota | Descrição |
| --- | --- | --- |
| POST | `/login` | Autentica e cria sessão |
| POST | `/logout` | Encerra a sessão |
| GET | `/me` | Dados da sessão atual |

### Primeiro acesso (`/api/primeiro-acesso`)
| POST | `/` | Completa cadastro + troca credenciais (obrigatório no 1º login) |

### Usuários (`/api/usuarios`) — sócio, salvo indicado
| Método | Rota | Descrição |
| --- | --- | --- |
| POST | `/` | Cria usuário (gera login/senha provisória) |
| GET | `/` | Lista usuários |
| PATCH | `/:id/status` | Ativa/desativa (bloqueio imediato) |
| PATCH | `/:id/perfil` | Altera sócio ↔ residente |
| POST | `/:id/redefinir-senha` | Gera senha provisória nova |
| POST | `/trocar-senha` | Qualquer usuário troca a própria senha |

### Agendamentos (`/api/agendamentos`)
CRUD completo (POST/GET/PUT/DELETE). Calcula repasse pela tabela de faixas, bloqueia conflito de horário do mesmo residente, aplica isenções da regra especial dos R$2.000 automaticamente, e concede o benefício especial + isenções quando o acumulado do mês cruza R$2.000.

### Metas (`/api/metas`)
| GET | `/individual` | Acumulado do mês, nível atual/próximo |
| GET | `/niveis` | Tabela completa de níveis |

### Benefícios (`/api/beneficios`)
| GET | `/categorias` | Categorias ativas |
| POST | `/solicitar` | Residente escolhe categoria (1x/mês) |
| PATCH | `/:id/status` | Sócio aprova/paga |
| GET | `/resumo` | Visão consolidada por tatuador (sócio) |

### Estoque (`/api/estoque`)
| POST | `/materiais` | Cadastra material (sócio) |
| GET | `/materiais` | Lista com alerta de estoque baixo |
| PATCH | `/materiais/:id/status` | Ativa/desativa (sócio) |
| POST | `/movimentacoes` | Entrada (sócio) ou saída (todos); nunca fica negativo |
| DELETE | `/movimentacoes/:id` | Exclui e reverte o estoque |

### Financeiro (`/api/financeiro`) — sócio
| POST | `/entradas` | Nova entrada de caixa do mês |
| POST | `/orcamentos` | Define orçamento Operacional/Materiais |
| POST | `/gastos` | Lança gasto numa categoria |
| GET | `/fechamento/:mes/preview` | Calcula E/O/M/B/K/I sem gravar |
| POST | `/fechamento/:mes/fechar` | Fecha o mês e grava saldos |
| POST | `/fechamento/:mes/reabrir` | Reabre mês fechado (motivo obrigatório) |
| GET | `/saldos/:mes` | Saldos do mês por categoria |
| GET | `/saldos-periodo?inicio=&fim=` | Resumo consolidado multi-mês |

### Melhorias (`/api/melhorias`)
| POST | `/` | Cadastra melhoria na fila (sócio) |
| GET | `/` | Fila completa (sócio) |
| PATCH | `/:id/prioridade` | Reordena (sócio) |
| PATCH | `/:id/valor-alvo` | Ajusta valor-alvo (sócio) |
| POST | `/:id/finalizar` | Registra compra, passa pro próximo item (sócio) |
| GET | `/atual` | Visão do tatuador: item atual + progresso, sem caixa total |

### Comunicados (`/api/comunicados`)
| POST | `/` | Cria comunicado (v1) |
| PUT | `/:id` | Publica nova versão (avisa se houve edição concorrente) |
| GET | `/` | Lista ativos com status de confirmação do usuário |
| GET | `/:id/versoes` | Histórico completo (sócio) |
| POST | `/:id/confirmar` | Confirma leitura |
| DELETE | `/:id` | Soft delete (preserva histórico) |

## Regras de negócio essenciais

- **Repasse** (percentual sobre o valor da tattoo) e **nível de benefício** (por repasse acumulado no mês) são cálculos independentes.
- **Regra especial:** ao atingir R$2.000 de repasse acumulado no mês, concede benefício de R$250 + 3 isenções de repasse para os próximos bookings **fechados** no mesmo mês (não importa o mês do serviço).
- Perfis: **Sócio** (acesso total) e **Residente/Tatuador** (acesso restrito).
- Fechamento mensal trava edições; correções exigem reabertura por um sócio.
- Marketing = 20% das novas entradas; Melhorias recebe o residual após Operacional, Materiais, Benefícios e Marketing.

Documento de regras de negócio completo disponível no projeto — fonte da verdade para qualquer dúvida de comportamento.

## Status do desenvolvimento

- [x] Fase 0 — Infraestrutura (VM, rede, segurança)
- [x] Fase 1 — Modelagem e criação do banco de dados
- [x] Fase 2 — Autenticação e usuários
- [x] Fase 3 — Agendamento
- [x] Fase 4 — Repasse e Meta Individual
- [x] Fase 5 — Benefícios
- [x] Fase 6 — Estoque
- [x] Fase 7 — Controle Financeiro
- [x] Fase 8 — Meta Coletiva e Fila de Melhorias
- [x] Fase 9 — Comunicados
- [x] Fase 10 — Auditoria
- [ ] Fase 11 — Integração e testes finais
- [ ] Fase 12 — Empacotamento como PWA (frontend ainda não existe)
