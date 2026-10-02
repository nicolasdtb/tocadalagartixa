# 01 — Instalação e operação

Este guia mostra como montar o servidor do zero, publicar o app, atualizá-lo no dia a dia e resolver os problemas mais comuns. Onde aparecer algo entre `< >`, troque pelo seu valor.

## 1. Visão geral da infraestrutura

```
Celular / PC dos usuários
        │  HTTPS
        ▼
Tailscale Funnel  (endereço público https://<nome-da-maquina>.<rede>.ts.net)
        │  proxy para 127.0.0.1:3001
        ▼
App Node.js/Express  (serviço systemd "toca-lagartixa")
        │
        ▼
PostgreSQL  (banco "tocalagartixa", só acessível dentro da VM)

Administrador ── SSH por chave, via rede privada ZeroTier ──► VM
```

- O **banco não é exposto** na internet.
- O acesso público ao app passa **somente** pelo Tailscale Funnel.
- A administração da VM (SSH) é feita pela rede privada ZeroTier, nunca pela internet aberta.

## 2. Requisitos

| Item | Usado hoje |
|---|---|
| Sistema | Ubuntu Server 26.04 (VM), 2 GB de RAM, 20 GB de disco |
| Node.js | 24 |
| PostgreSQL | 18 |
| Rede | Conta Tailscale (acesso público) e ZeroTier (administração) |

## 3. Instalação do zero

### 3.1 Preparar a VM e o acesso

1. Instale o Ubuntu Server com um usuário administrador (aqui, `tocadalagartixa`) e o pacote `openssh-server`.
2. Crie uma chave SSH no seu computador e autorize-a na VM (`~/.ssh/authorized_keys`).
3. Aplique a proteção do servidor: SSH somente por chave, firewall (UFW), fail2ban e atualizações automáticas. O passo a passo está em `seguranca-servidor.md`.
4. Instale o ZeroTier para o acesso administrativo remoto e o Tailscale para o acesso público.

### 3.2 Instalar Node.js, PostgreSQL e Git

```bash
sudo apt update
sudo apt install -y postgresql git
# Node.js: instale a versão 24 pelo método oficial (NodeSource ou nvm)
node -v    # deve mostrar v24.x
```

### 3.3 Baixar o projeto

```bash
cd ~
git clone git@github.com:<usuario>/<repositorio>.git toca-lagartixa
cd toca-lagartixa
npm install
```

> O Git da VM usa uma **chave SSH exclusiva** do GitHub. Gere uma chave na VM (`ssh-keygen`) e cadastre a parte pública no GitHub.

### 3.4 Criar o banco de dados

```bash
sudo -u postgres psql
```

Dentro do `psql`:

```sql
CREATE USER app_tocalagartixa WITH PASSWORD '<senha-forte-do-banco>';
CREATE DATABASE tocalagartixa OWNER app_tocalagartixa;
\c tocalagartixa
CREATE SCHEMA tocadalagartixa AUTHORIZATION app_tocalagartixa;
\q
```

O schema precisa existir **antes** de rodar as migrations. O usuário do app deve ser o **dono** do schema, para que as migrations futuras funcionem sem ajustes manuais de permissão.

### 3.5 Configurar o `.env`

Crie o arquivo `~/toca-lagartixa/.env` (ele nunca vai para o Git):

```
DATABASE_URL=postgres://app_tocalagartixa:<senha-forte-do-banco>@localhost:5432/tocalagartixa
SESSION_SECRET=<texto-longo-e-aleatorio>
PORT=3001
```

Para gerar um segredo de sessão:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 3.6 Criar as tabelas (migrations)

```bash
cd ~/toca-lagartixa
node src/migrate.js            # aplica todas as migrations pendentes
node src/migrate.js --status   # confere: todas devem aparecer como [ok]
```

Isso cria todas as tabelas e carrega os dados de configuração (faixas de repasse, níveis de benefício, categorias e motivos de edição).

### 3.7 Criar o primeiro sócio

O primeiro usuário precisa ser criado direto no banco. Gere o hash da senha:

```bash
cd ~/toca-lagartixa
node -e "require('bcrypt').hash('<senha-inicial>', 10).then(console.log)"
```

Depois, no `psql` (`sudo -u postgres psql -d tocalagartixa`):

```sql
INSERT INTO tocadalagartixa.usuarios (login, senha, perfil_id, status, primeiro_acesso)
VALUES ('<login>', '<hash-gerado>', 1, true, false);
```

No primeiro login o sistema pede os dados pessoais (nome, e-mail, telefone, CPF) e a troca de login e senha. Os demais usuários são criados pelo próprio app, na tela **Usuários**.

### 3.8 Rodar como serviço (systemd)

Crie o arquivo `/etc/systemd/system/toca-lagartixa.service`:

```ini
[Unit]
Description=Toca da Lagartixa (app interno)
After=network-online.target postgresql.service
Wants=network-online.target

[Service]
Type=simple
User=tocadalagartixa
WorkingDirectory=/home/tocadalagartixa/toca-lagartixa
ExecStart=/usr/bin/node src/server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Ative e inicie:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now toca-lagartixa
systemctl is-active toca-lagartixa     # deve responder: active
curl http://127.0.0.1:3001/api/health  # teste local
```

O serviço sobe sozinho com a VM e reinicia se cair.

### 3.9 Publicar na internet (Tailscale Funnel)

```bash
sudo tailscale funnel --bg 3001
tailscale funnel status
```

O comando `--bg` deixa o Funnel ativo em segundo plano e persistente. O `status` mostra o endereço público no formato `https://<maquina>.<rede>.ts.net`. É esse endereço que os usuários abrem no celular (veja o guia [04 — Instalar o app no celular](04-instalar-pwa.md)).

## 4. Backup do banco

Um script diário faz o `pg_dump` compactado e guarda os 14 mais recentes em `~/backups`.

`~/backup-db.sh`:

```bash
#!/bin/bash
DATA=$(date +%Y-%m-%d_%H%M)
sudo -u postgres pg_dump tocalagartixa | gzip > /home/tocadalagartixa/backups/tocalagartixa_$DATA.sql.gz
# mantém só os 14 backups mais recentes
ls -1t /home/tocadalagartixa/backups/*.sql.gz | tail -n +15 | xargs -r rm
```

Preparação (uma vez):

```bash
mkdir -p ~/backups
chmod +x ~/backup-db.sh
# o usuário precisa poder rodar pg_dump como postgres sem senha (regra em /etc/sudoers.d)
(crontab -l 2>/dev/null; echo "0 3 * * * /home/tocadalagartixa/backup-db.sh") | crontab -
```

**Restaurar um backup** (em um banco vazio, com o schema criado):

```bash
gunzip -c ~/backups/<arquivo>.sql.gz | sudo -u postgres psql tocalagartixa
```

> Atenção: hoje os backups ficam **somente na própria VM**. A cópia externa (nuvem, criptografada) está prevista em [06 — Pendências](06-pendencias.md).

## 5. Rotina do dia a dia

### Atualizar o app depois de uma mudança

| O que mudou | O que fazer |
|---|---|
| Arquivos em `public/` (telas, CSS, JS) | Enviar o arquivo para a VM e dar **Ctrl+F5** no navegador. |
| Arquivos em `src/` (backend) | Enviar o arquivo e rodar `sudo systemctl restart toca-lagartixa`. |
| Arquivo novo em `migrations/` | Enviar e rodar `node src/migrate.js`. |

Exemplo de envio de um arquivo a partir do Windows (PowerShell):

```powershell
scp -i C:\Users\<usuario>\.ssh\<chave> C:\Users\<usuario>\Downloads\app.js <usuario-vm>@<ip-da-vm>:~/toca-lagartixa/public/js/app.js
```

### Salvar no Git

```bash
cd ~/toca-lagartixa
git status
git add .
git commit -m "Descrição da mudança"
git push
```

Confira o `git status` antes: o `.env` e a pasta `node_modules` jamais devem aparecer como arquivos novos (o `.gitignore` já os protege).

### Comandos úteis

```bash
systemctl status toca-lagartixa            # estado do serviço
sudo systemctl restart toca-lagartixa      # reiniciar o app
journalctl -u toca-lagartixa -f            # logs ao vivo (Ctrl+C para sair)
journalctl -u toca-lagartixa -n 100        # últimas 100 linhas
node src/migrate.js --status               # situação das migrations
tailscale funnel status                    # endereço público
ls -lh ~/backups                           # backups existentes
```

## 6. Solução de problemas

| Sintoma | Causa provável | Solução |
|---|---|---|
| Alterei uma tela e nada mudou | Cache do navegador ou do service worker | Ctrl+F5. Se persistir, no DevTools (F12) → Application → Service Workers → *Unregister* e limpe os dados do site. |
| Tela do app não carrega ou fica em branco | Erro de JavaScript | F12 → aba **Console**; copie a linha em vermelho. Confirme também que o `app.js` enviado é o mais recente (não um arquivo antigo na pasta Downloads). |
| `permission denied for table ...` | Tabela criada por outro usuário do banco | Passe o dono para o usuário do app: `ALTER TABLE tocadalagartixa.<tabela> OWNER TO app_tocalagartixa;` (para todas as tabelas e sequences do schema). |
| Migration falha com `must be owner of table` | Mesmo problema de dono | Mesma correção acima; depois rode `node src/migrate.js` de novo. A migration que falhou não aplica nada pela metade. |
| Migration falha na criação de `schema_migrations` em banco novo | Schema `tocadalagartixa` ainda não existe | Crie o schema (passo 3.4) e rode de novo. |
| Backend mudou mas o comportamento é o antigo | Serviço não reiniciado | `sudo systemctl restart toca-lagartixa`. |
| `ERR_CONNECTION_CLOSED` no endereço público | Funnel parou ou o Tailscale perdeu conexão | `sudo systemctl restart tailscaled` e depois `sudo tailscale funnel --bg 3001`. |
| Login diz "não foi possível entrar" logo após queda de conexão | Mesma causa do item anterior | Mesma solução; confira com `tailscale funnel status`. |
| Usuário bloqueado após redefinir senha | Comportamento esperado | A senha provisória obriga a troca no próximo login. |
| `sudo` pede senha e o comando parece não rodar | A senha não foi digitada | Rode de novo e digite a senha (ela não aparece na tela). |
| Sessão cai ou usuário é deslogado | Usuário foi desativado ou a senha redefinida | Confira o status na tela **Usuários**. O servidor reconfere o usuário a cada requisição. |

## 7. Atualizações do sistema operacional

As atualizações de segurança são automáticas (`unattended-upgrades`). Quando o Ubuntu avisar *System restart required*, reinicie a VM em um horário calmo:

```bash
sudo reboot
```

O app e o Funnel voltam sozinhos. Depois confira com `systemctl is-active toca-lagartixa` e `tailscale funnel status`.
