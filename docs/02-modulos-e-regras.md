# 02 — Módulos e regras de negócio

Este documento explica, em linguagem simples, como cada parte do app funciona e quem pode fazer o quê. As regras seguem o documento de *Regras de Negócio da Toca da Lagartixa*. No final há uma lista do que ainda é diferente da especificação.

## 1. Conceitos que valem para todo o app

**Dois perfis.** *Sócio* (administra tudo) e *Residente/Tatuador* (usa o dia a dia). Todos os sócios têm o mesmo nível de acesso.

**Duas contas diferentes, que não se misturam:**

| Conceito | Baseado em | Para que serve |
|---|---|---|
| **Repasse** | O **valor de cada tattoo** | Quanto da tattoo fica para o estúdio. |
| **Nível de benefício** | O **repasse acumulado do mês** do tatuador | Quanto de benefício o tatuador ganha. |

**Mês de competência.** Cada tattoo conta no mês da **data prevista** para ela acontecer, não no mês em que foi agendada.

**Auditoria.** As ações importantes (criar/alterar usuários, excluir agendamentos, mexer em estoque, lançar no financeiro, fechar e reabrir mês, mexer na fila de melhorias) são registradas com quem fez, o que foi feito e quando, preservando o estado anterior.

**O que cada perfil vê no menu:**

| Módulo | Sócio | Residente |
|---|---|---|
| Início | ✔ | ✔ |
| Agenda | ✔ | ✔ |
| Minha Meta | ✔ | ✔ |
| Benefícios | ✔ (gestão) | ✔ (solicitação) |
| Estoque | ✔ | ✔ (limitado) |
| Financeiro | ✔ | — |
| Melhorias | ✔ (gestão) | ✔ (acompanha) |
| Comunicados | ✔ (publica) | ✔ (lê e confirma) |
| Usuários | ✔ | — |
| Meu Perfil | ✔ | ✔ |

## 2. Acesso e usuários

### 2.1 Primeiro acesso
1. O sócio cria o usuário informando **apenas o perfil**. O sistema gera um **login genérico** e uma **senha provisória**, mostrados uma única vez para o sócio entregar à pessoa.
2. No primeiro login, o usuário é obrigado a preencher **nome, e-mail, telefone e CPF** e a escolher **seu próprio login e senha** (mínimo de 8 caracteres).
3. O CPF não pode se repetir. CPF, telefone e e-mail passam por validação de formato.
4. Só depois disso o app libera as demais telas.

### 2.2 Senhas
- Depois de definida, a senha **nunca** pode ser vista por ninguém.
- Se alguém esquecer, **só o sócio** redefine: gera-se uma senha provisória nova e a pessoa é obrigada a trocá-la no próximo login.
- O sócio **não altera o login** de outra pessoa, apenas redefine a senha.

### 2.3 Ativar e desativar
- Desativar **bloqueia o acesso na hora**: se a pessoa estiver com o app aberto, a próxima ação resulta em *Acesso negado*.
- O histórico da pessoa é preservado. Reativar devolve as mesmas credenciais (a menos que a senha tenha sido redefinida).
- **Ninguém pode desativar o próprio login.**
- A tela **Usuários** mostra só os ativos por padrão, tem filtro para ver inativos e busca por nome ou login.
- O sócio pode trocar o perfil de um usuário entre Sócio e Residente.

### 2.4 Sessão
O login dura **até 7 dias** no aparelho; depois disso é preciso entrar de novo.

### 2.5 Meu Perfil
Qualquer usuário edita nome, e-mail, telefone e CPF (os campos ficam travados até clicar em **Editar perfil**), troca a **foto** (a nova substitui a anterior, sem guardar histórico) e sai da conta.

## 3. Agenda

Calendário interno compartilhado. **Não há cadastro de clientes.**

- Cada agendamento tem: **responsável** (o tatuador), **data**, **horário de início**, **duração aproximada** e **valor da tattoo** (mínimo R$ 100).
- O mesmo tatuador **não pode ter dois agendamentos começando no mesmo horário**. Durações que se sobrepõem são permitidas se os inícios forem diferentes. Tatuadores diferentes podem ter o mesmo horário.
- **Residente** cria, edita e exclui só os próprios. **Sócio** faz tudo com qualquer agendamento. Todos veem o calendário completo.
- Não existe status (agendado, concluído, cancelado): o agendamento existe até ser excluído. A exclusão é auditada.
- No calendário do mês, os dias com agendamento ficam marcados; tocar no dia abre a lista daquele dia e o botão para novo agendamento.
- Ao criar ou editar, o **repasse é calculado automaticamente**. Mudar a data move o repasse para o novo mês; mudar o valor recalcula; excluir retira.

## 4. Repasse para o estúdio

O percentual depende do **valor da tattoo**, não do volume do mês:

| Valor da tattoo | % para o estúdio |
|---|---|
| A partir de R$ 100 e abaixo de R$ 500 | 30% |
| A partir de R$ 500 e abaixo de R$ 1.000 | 25% |
| A partir de R$ 1.000 | 20% |

Exemplo: uma tattoo de R$ 700 usa 25% → repasse de R$ 175.

Os percentuais e os limites ficam em uma tabela do banco (`faixas_repasse`), então podem ser alterados sem mudar o app.

## 5. Minha Meta (Meta Individual)

- Mostra o **repasse acumulado do próprio tatuador no mês**, o **nível atual**, o **próximo nível** e **quanto falta**. O acumulado volta a zero todo dia 1º.
- O ícone **?** no canto do card abre a tabela com todos os níveis.
- Quando o último nível é atingido, aparece *Nível máximo atingido*.
- Tattoo gratuita não gera repasse e não conta para a meta.

| Nível | Repasse acumulado no mês | Benefício |
|---|---|---|
| 1 | R$ 300 | R$ 50 |
| 2 | R$ 400 | R$ 80 |
| 3 | R$ 600 | R$ 130 |
| 4 | R$ 800 | R$ 190 |
| 5 | R$ 1.000 | R$ 250 |

## 6. Benefícios

**Regras:**
- Um benefício por residente por mês; individual, intransferível e **não acumula** para o mês seguinte.
- O valor vem do nível alcançado no mês. A categoria escolhida só define onde o benefício pode ser usado.
- O residente escolhe **uma categoria** e faz **uma compra** (vários itens da mesma categoria são permitidos). Categorias hoje: **Roupas, Uber, Adega e Tabacaria**.
- O pagamento acontece ao final do mês.

**Fluxo:**
1. O residente toca em **+ Solicitar benefício**, escolhe a categoria e envia.
2. A solicitação fica **Pendente**. O sócio **aprova** (*Aprovado*) e depois marca como **pago** (*Pago*).
3. O sócio vê, para cada residente: repasse acumulado, valor do benefício e situação. Quem não solicitou aparece como *Sem solicitação*.

**Regra especial dos R$ 2.000:** ao chegar a R$ 2.000 de repasse acumulado no mês, o residente recebe o benefício de **R$ 250** e **3 isenções** de repasse. As isenções valem para os **3 primeiros novos agendamentos fechados no mesmo mês** em que a meta foi atingida (o que conta é o mês em que o agendamento foi feito, não o da execução). Um agendamento isento tem repasse zero.

## 7. Estoque

- **Cadastrar material** (nome, unidade, quantidade mínima) e **registrar entrada**: só sócio.
- **Registrar saída**: todos. A saída **nunca deixa o estoque negativo**, e o app mostra a quantidade disponível.
- **Estoque baixo:** quando a quantidade fica **igual ou menor** que o mínimo, o item é sinalizado para todos.
- Materiais podem ser **desativados** (saem da lista dos tatuadores e não recebem movimentações) e **reativados**. O histórico é preservado.
- Excluir uma movimentação **reverte o efeito no estoque** e é auditado. O residente exclui só as próprias; o sócio, qualquer uma.

## 8. Controle Financeiro (só sócio)

Controla o **dinheiro** em cinco compartimentos lógicos (não são contas bancárias). O estoque controla quantidades; o financeiro controla valores, e os dois são separados.

| Categoria | Como o valor do mês é definido |
|---|---|
| **Operacional** | Orçamento mensal de custos (internet, luz, água...), definido pelos sócios. |
| **Materiais** | Orçamento mensal de materiais, definido pelos sócios. |
| **Benefícios** | Soma dos benefícios alcançados pelos residentes no mês. |
| **Marketing** | 20% das novas entradas do mês. |
| **Melhorias** | Todo o **resto**: Entradas − Operacional − Materiais − Benefícios − Marketing. |

**Saldos:** saldo final = saldo inicial + destinação do mês − gastos. O saldo, positivo ou negativo, **passa para o mês seguinte**. Um gasto pode deixar a categoria negativa; o déficit é compensado pelas destinações seguintes da mesma categoria, sem transferência automática entre categorias. O saldo carregado não conta de novo como entrada (não gera Marketing duas vezes).

**Na tela:**
- Seletor de mês com setas. Tudo carrega automaticamente ao trocar o mês.
- **Faturamento** do mês com a distribuição por categoria (barras e percentuais sobre as entradas).
- **Situação financeira** por categoria: destinado, gasto e disponível. Antes do fechamento, o gasto é calculado ao vivo a partir dos lançamentos, e o card avisa que os valores são estimados.
- **Lançamentos do mês:** lista com tipo, categoria, descrição, data e valor. Em gastos de **Materiais** há o campo **Materiais / itens**, exibido pelo botão *Ver itens*.
- Botão **+ Novo lançamento**: entrada de caixa, orçamento (Operacional ou Materiais) ou gasto em categoria.

**Fechamento e reabertura:**
1. O sócio **fecha o mês** (botão na tela); os valores ficam consolidados e viram o saldo inicial do mês seguinte.
2. Com o mês fechado, não se lançam novos gastos. Para corrigir, o sócio **reabre** o mês informando o motivo.
3. Ao reabrir, o mês fica aberto para ajustes; depois o sócio confere e **fecha de novo**.
4. Reabertura e novo fechamento são auditados.

## 9. Melhorias (Meta Coletiva)

- Fila de melhorias do estúdio, **administrada pelos sócios**: adicionar, reordenar, editar o valor-alvo, excluir (somente se ainda em progresso) e finalizar.
- A meta coletiva usa **apenas o saldo da categoria Melhorias**. Os tatuadores veem só a **melhoria atual**, o valor acumulado e a barra de progresso, sem o caixa total.
- **Estados:** *Em progresso* → *Meta atingida* (automático ao chegar no valor-alvo) → *Finalizada* (registrada pelo sócio depois que o item foi comprado e instalado).
- Ao finalizar, o sócio informa o **valor realmente gasto**, que sai da categoria Melhorias. A sobra continua no fundo e já conta para o próximo item, que assume automaticamente como melhoria atual.

## 10. Comunicados

- Só sócios criam, editam e excluem. Podem ser **comuns** ou **obrigatórios**.
- **Obrigatório:** o residente com comunicado pendente fica **bloqueado** e é levado à aba Comunicados até confirmar a leitura. Um usuário novo herda os obrigatórios já existentes.
- **Versões:** cada edição publicada cria a versão seguinte (1, 2, 3...). O sócio vê o histórico de versões e **quem confirmou** a leitura.
- **Motivo da edição:** ao editar, é obrigatório escolher uma **categoria de motivo** (o sócio pode cadastrar novas) e, se quiser, escrever um texto.
- **Edição concorrente:** se outra versão foi publicada enquanto você editava, o app só **avisa** e deixa publicar; não há mesclagem automática.
- **Exclusão** é lógica (*soft delete*): some da lista, mas versões e auditoria permanecem.

## 11. Tela Início e Notificações

**Início:** painel de cards, cada um carregando por conta própria:
- Próximos agendamentos; Minha Meta (residente); Ranking do mês; Estoque baixo; Melhoria atual; Último comunicado; Financeiro (sócio).
- O **Ranking** mostra posição e nome dos residentes por repasse acumulado, **sem valores em reais**, e a sua própria linha fica sempre visível.
- **Personalizar:** cada usuário reordena e oculta os cards; a escolha fica salva naquele aparelho.

**Notificações (sino no canto superior direito):** alertas calculados na hora, que somem sozinhos quando o problema é resolvido.

| Alerta | Sócio | Residente |
|---|---|---|
| Estoque baixo | ✔ | ✔ |
| Meta coletiva atingida | ✔ | ✔ |
| Benefícios aguardando aprovação | ✔ | — |
| Benefícios aprovados aguardando pagamento | ✔ | — |
| Seu benefício aprovado ou pago | — | ✔ |

## 12. Diferenças em relação à especificação original

Pontos em que o app ainda não segue exatamente o documento de regras (também listados em [06 — Pendências](06-pendencias.md)):

| Tema | Especificação | Situação atual |
|---|---|---|
| Calendário | Visões de dia, semana e mês | Só a visão mensal, com lista do dia ao tocar. |
| Fechamento do mês | Fecha sozinho na virada do mês | O fechamento é feito pelo sócio, no botão da tela. |
| Edição de movimentação de estoque | Editar ou excluir a própria movimentação | Só exclusão (que reverte o estoque); para corrigir, exclui-se e lança-se de novo. |
| Parâmetros administrativos | Sócios alteram faixas de repasse, níveis, categorias de benefício e quantidade mínima | Faixas, níveis e categorias de benefício ficam no banco, sem tela de edição. Orçamentos mensais são lançados na tela Financeiro. |
| Quinta categoria de benefício | Espaço aberto para sugestão | Não criada; entra com decisão interna. |
| "Manter logado" | Opção no login, máximo 7 dias | A sessão sempre dura até 7 dias. |

Itens que o app oferece **além** da especificação: tela Início personalizável com ranking, Notificações, foto de perfil, motivo obrigatório na edição de comunicados e campo de materiais nos gastos.
