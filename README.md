# Toca da Lagartixa — Sistema de Gestão do Estúdio

Aplicativo interno para gerenciar o estúdio de tatuagem **Toca da Lagartixa**: agenda dos atendimentos, repasse e metas dos tatuadores, benefícios, estoque, controle financeiro, melhorias do estúdio e comunicados da equipe.

É um **PWA** (Progressive Web App): funciona no navegador e pode ser instalado na tela inicial do Android (Chrome) e do iOS (Safari), sem passar por loja de aplicativos.

## Quem usa

| Perfil | O que faz |
|---|---|
| **Sócio** | Acesso completo: cria usuários, aprova e paga benefícios, controla o financeiro, publica comunicados, gerencia estoque e melhorias. |
| **Residente** | Tatuador do estúdio: vê a agenda, registra os próprios atendimentos, acompanha a própria meta, solicita o benefício do mês, dá saída no estoque e lê os comunicados. Não vê o caixa do estúdio. |

## Módulos

- **Início:** painel com cards personalizáveis (reordenar e ocultar), incluindo ranking de atendimentos sem mostrar valores.
- **Agenda:** calendário mensal compartilhado; o repasse é calculado automaticamente por faixa de valor.
- **Minha Meta:** acumulado do mês, nível atual e próximo nível de benefício.
- **Benefícios:** solicitação mensal pelo residente; aprovação e pagamento pelo sócio.
- **Estoque:** materiais, entradas, saídas e alerta de estoque baixo.
- **Financeiro (sócio):** entradas, orçamentos, gastos por categoria, fechamento e reabertura de mês, saldos acumulados.
- **Melhorias:** fila de melhorias do estúdio com meta coletiva e estado automático.
- **Comunicados:** publicação com versionamento, motivo de edição e confirmação de leitura obrigatória.
- **Usuários (sócio):** criação, ativação e desativação, troca de perfil e redefinição de senha.
- **Meu Perfil:** dados pessoais, foto e saída da conta.
- **Notificações:** sino com alertas calculados na hora (estoque baixo, benefícios pendentes, meta coletiva atingida).

Todas as ações importantes ficam registradas em uma **trilha de auditoria**.

## Tecnologias

- **Backend:** Node.js + Express, driver `pg` (sem ORM), sessão por cookie (`express-session` + `connect-pg-simple`), senhas com `bcrypt`.
- **Banco de dados:** PostgreSQL, schema `tocadalagartixa`, versionado por **migrations** SQL.
- **Frontend:** HTML, CSS e JavaScript puros (sem framework), servidos pelo próprio Express.
- **Infraestrutura:** VM Ubuntu Server, serviço `systemd`, acesso público por Tailscale Funnel (HTTPS), administração por SSH via ZeroTier, backup diário do banco.

## Estrutura do projeto

```
toca-lagartixa/
├── migrations/          # Arquivos SQL numerados (001, 002, ...)
├── public/              # Frontend (PWA)
│   ├── index.html
│   ├── css/style.css
│   ├── js/api.js        # Cliente da API
│   ├── js/app.js        # Telas (views) e navegação
│   ├── icons/ img/      # Ícones do PWA e logo
│   ├── manifest.json
│   └── service-worker.js
├── src/
│   ├── app.js           # Montagem do Express e ordem dos middlewares
│   ├── server.js        # Inicialização
│   ├── db.js            # Conexão com o PostgreSQL
│   ├── migrate.js       # Aplicador de migrations
│   ├── middlewares/     # Autenticação e permissões
│   ├── routes/          # Uma rota por módulo
│   └── utils/           # Auditoria, geração de credenciais
├── .env                 # Configuração local (nunca vai para o Git)
└── docs/                # Documentação detalhada
```

## Rodando o projeto (resumo)

Requisitos: Node.js, PostgreSQL e um arquivo `.env` com as variáveis de conexão e o segredo da sessão.

```bash
npm install
node src/migrate.js        # cria/atualiza o banco
npm start                  # produção (na VM roda como serviço systemd)
npm run dev                # desenvolvimento, com reinício automático (nodemon)
```

O guia completo de instalação, publicação e solução de problemas está em [docs/01-instalacao.md](docs/01-instalacao.md).

## Documentação

| Documento | Conteúdo |
|---|---|
| [01 — Instalação e operação](docs/01-instalacao.md) | Montar o servidor, publicar, atualizar, logs, problemas comuns |
| [02 — Módulos e regras de negócio](docs/02-modulos-e-regras.md) | Como cada módulo funciona e quem pode o quê |
| [03 — Banco de dados](docs/03-banco-de-dados.md) | Tabelas, migrations, backup e conexão pelo DBeaver |
| [04 — Instalar o app no celular](docs/04-instalar-pwa.md) | PWA no Android e no iOS |
| [05 — Documentação técnica](docs/05-tecnica.md) | Arquitetura, rotas da API, segurança, como criar um módulo |
| [06 — Pendências e roadmap](docs/06-pendencias.md) | O que falta fazer |

## Segurança em resumo

- Login com sessão em cookie (7 dias); a cada requisição o servidor reconfere no banco se o usuário continua ativo.
- Senhas guardadas com hash `bcrypt`; senha provisória obrigatoriamente trocada no primeiro acesso.
- Servidor com SSH somente por chave, firewall (UFW), fail2ban e atualizações automáticas.
- O banco não é exposto na internet; o acesso externo ao app passa só pelo Tailscale Funnel.

## Licença e uso

Projeto de uso interno do estúdio. Não deve ser redistribuído sem autorização dos sócios.
