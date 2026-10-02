# 04 — Instalar o app no celular

O app da Toca da Lagartixa é um **PWA**: ele abre pelo navegador e pode ser **instalado na tela inicial** como um aplicativo comum, com ícone próprio e em tela cheia, sem passar pela Play Store nem pela App Store.

Nos exemplos abaixo, o endereço do app aparece como `https://<maquina>.<rede>.ts.net`. Use o endereço que os sócios passarem para a equipe.

## Antes de começar

- Abra o endereço **direto no navegador do celular**: **Chrome** no Android e **Safari** no iPhone/iPad.
- Não instale a partir de dentro de outro app (WhatsApp, Instagram, e-mail). Esses navegadores embutidos não oferecem a instalação. Copie o link e abra no Chrome ou no Safari.
- Para entrar pela primeira vez, você precisa do **login e da senha provisória** que o sócio gerou para você. No primeiro acesso o app pede seus dados e a criação do seu login e da sua senha.

## Android (Chrome)

1. Abra o Chrome e acesse `https://<maquina>.<rede>.ts.net`.
2. Toque no menu **⋮** (três pontinhos, canto superior direito).
3. Toque em **Instalar app** (em alguns celulares aparece como **Adicionar à tela inicial**).
4. Confirme em **Instalar**.
5. O ícone da Toca da Lagartixa aparece na tela inicial e na lista de aplicativos. Abra por ele.

Dica: o Chrome também pode mostrar um aviso na parte de baixo da tela oferecendo a instalação. Pode tocar nele.

## iPhone e iPad (Safari)

1. Abra o **Safari** e acesse `https://<maquina>.<rede>.ts.net`.
2. Toque no botão **Compartilhar** (quadrado com uma seta para cima, na barra inferior ou superior).
3. Role a lista e toque em **Adicionar à Tela de Início**.
4. Confira o nome (**Toca Lagartixa**) e toque em **Adicionar**.
5. O ícone aparece na tela inicial. Abra por ele para usar em tela cheia.

No iOS, a instalação é sempre manual por esse caminho: não aparece aviso automático.

## Computador (opcional)

No Chrome ou no Edge, abra o endereço e clique no ícone de **instalar** na barra de endereço (ou no menu → *Instalar Toca da Lagartixa*). O app abre numa janela própria.

## Usando o app instalado

- O login dura **até 7 dias**; depois disso o app pede para entrar de novo.
- O **sino** no canto superior direito mostra os alertas (estoque baixo, benefícios, meta coletiva). O app **não envia notificações para a tela bloqueada**: os alertas só aparecem quando você abre o app.
- Quando um sócio desativa a sua conta, o acesso é bloqueado na hora.

## Atualizações

O app se atualiza sozinho quando há internet. Se parecer que você está vendo uma versão antiga depois de uma novidade:

1. Feche o app por completo (tire da lista de apps recentes) e abra de novo.
2. Se continuar igual, limpe os dados do site:
   - **Android (Chrome):** menu ⋮ → *Configurações* → *Configurações do site* → *Todos os sites* → localize o endereço do app → *Limpar e redefinir*.
   - **iOS:** *Ajustes* → *Safari* → *Avançado* → *Dados dos Sites* → procure o endereço do app e remova.
3. Se ainda assim não resolver, remova o ícone da tela inicial e instale de novo pelos passos acima.

Depois de limpar os dados, será preciso fazer login novamente.

## Para quem mantém o sistema

O app guarda uma cópia dos arquivos no aparelho (*service worker*, arquivo `public/service-worker.js`). Quando uma mudança no frontend não aparecer nos celulares, aumente o número da versão do cache nesse arquivo (por exemplo, de `toca-lagartixa-v2` para `toca-lagartixa-v3`) e publique de novo: os aparelhos baixam a versão nova na próxima abertura.

## Problemas comuns

| Problema | O que fazer |
|---|---|
| Não aparece a opção *Instalar app* / *Adicionar à tela inicial* | Abra o link direto no Chrome (Android) ou no Safari (iOS), fora do WhatsApp ou de outro app. Confirme que o endereço começa com `https://`. |
| A página não abre ou diz que a conexão foi fechada | O servidor ou o acesso público pode estar fora do ar. Avise um sócio para conferir o serviço e o Tailscale Funnel. |
| "Acesso negado" | Sua conta pode ter sido desativada. Fale com um sócio. |
| Esqueci minha senha | Só um sócio pode redefinir. Você receberá uma senha provisória e o app pedirá para trocá-la no próximo login. |
| O app está mostrando dados ou telas antigas | Siga a seção *Atualizações* acima. |
| O ícone sumiu da tela inicial | Basta instalar de novo pelos passos acima; seus dados estão no servidor e não se perdem. |
