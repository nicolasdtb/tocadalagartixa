# 06 — Pendências e próximos passos

Lista viva do que ainda falta. Ordem sugerida: de cima para baixo.

## Antes de usar em produção

1. **Limpeza do banco**: apagar os dados de teste. Preservar as tabelas de parâmetros (`enum_*`, `faixas_repasse`, `niveis_beneficio`, `categorias_beneficio`, `categorias_financeiras`, `motivos_edicao_comunicado`) e o usuário sócio real. Deve ser a última etapa.
2. **Testar a instalação do zero** seguindo `01-instalacao.md`, incluindo a criação do primeiro sócio por SQL.
3. **Cópia externa dos backups**: o backup diário já roda, mas fica só na VM. Plano: `rclone` + Google Drive com criptografia (`crypt`), enviando direto da VM.

## Segurança (ver seção 5 de `05-tecnica.md`)

- Cookie de sessão com `secure: true` (e `trust proxy`), já que o acesso externo é HTTPS pelo Tailscale Funnel.
- Limite de tentativas no login.
- `helmet` e proteção contra CSRF.
- Validar o tipo da foto também no envio (hoje só é validado ao servir).
- Rever o prefixo `/api/comunicados` na lista de rotas livres do middleware de primeiro acesso.
- Exigir o aceite de "Sobre o estúdio" também no servidor (hoje só a tela bloqueia).

## Funcionalidades futuras

- **Pagamento de funcionários/sócios**: card próprio no financeiro (bem mais pra frente).
- **Tutorial salvo no banco**, para não repetir em outro aparelho (hoje fica no navegador).

## Divergências da especificação original

Ver a tabela em `02-modulos-e-regras.md`: calendário em visão de dia/semana, fechamento automático do mês, edição de movimentação de estoque, telas de parâmetros, quinta categoria de benefício e "manter logado".

## Opcional

- Configurar identidade do git na VM (`git config user.name` e `user.email`).
