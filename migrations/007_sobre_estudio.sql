-- Conteúdo editável da aba "Sobre o estúdio" (documento de condições). Uma linha só (id = 1).
CREATE TABLE IF NOT EXISTS tocadalagartixa.sobre_estudio (
  id             integer PRIMARY KEY CHECK (id = 1),
  conteudo       text NOT NULL,
  versao         integer NOT NULL DEFAULT 1,
  atualizado_em  timestamptz NOT NULL DEFAULT now(),
  atualizado_por integer REFERENCES tocadalagartixa.usuarios(id)
);

INSERT INTO tocadalagartixa.sobre_estudio (id, conteudo, versao) VALUES (1, $conteudo$# Valores e convivência
## Respeito acima de tudo
Zero tolerância a racismo, LGBTfobia, misoginia, capacitismo, xenofobia ou qualquer discriminação.
## Inclusão e diversidade
Valorizamos identidades, corpos e culturas plurais, ampliando espaço para quem foi historicamente marginalizado.
## Espaço seguro LGBTQIAPN+
Comunidade bem-vinda, respeitada e protegida — sem assédio, exposição ou invalidação de identidade.
## Liberdade com responsabilidade
Incentivamos a experimentação artística, mas liberdade criativa não autoriza violência ou discriminação.
## Zero tolerância a assédio e violência
Assédio, perseguição, ameaças, agressões e coerção não são aceitos com ninguém.
## Conduta ética e legal
Respeito às leis e às normas do espaço; atos ilícitos encerram a residência de imediato.
## Responsabilidade coletiva
Cada residente responde pela própria conduta e contribui para um ambiente saudável e profissional.
## Consentimento e limites
Nenhum contato, registro ou abordagem ultrapassa os limites da outra pessoa. Não significa não.
## Privacidade e confidencialidade
Dados, imagens e situações internas de clientes e residentes são tratados com respeito.
## Cultura de diálogo
Conflitos são tratados com maturidade; a administração media denúncias e reclamações.
> Princípio da Toca
> Criatividade não existe sem liberdade. Liberdade não existe sem respeito. E respeito é condição para fazer parte da Toca.
> A permanência como residente está condicionada ao cumprimento desses princípios.

# Espaço
## Sala de procedimento
- 2 estações de trabalho;
- Impressora de decalque.
## Sala da recepção
- Água, café e açúcar;
- Espaço para expor artes suas que estejam à venda (QR Code para suas redes + descrição da arte/mídia).

# Materiais
O estúdio cede os seguintes materiais:
- Papel toalha
- Plástico filme
- Gilete
- Palito de madeira
- Álcool
- Clean up
- Máscara descartável
- Fita crepe
- Vaselina
- Batoque
- Sabão neutro
>> No futuro pretendemos incluir mais materiais descartáveis nos materiais cedidos pelo estúdio, além de um armário de "lojinha" para os tatuadores — agulhas, biqueiras, cartuchos, luvas etc. (todos a preço de custo).

# Porcentagem
**O valor mínimo das sessões no estúdio é R$ 100,00.**
| Valor | % para o estúdio |
| A partir de R$ 100 | 30% |
| A partir de R$ 500 | 25% |
| A partir de R$ 1000 | 20% |
Para os residentes, trabalhamos com uma porcentagem que diminui gradualmente conforme o valor do agendamento. Acreditamos que, se você consegue trabalhar a construção de valor no seu trabalho, quem deve ganhar com isso é você.
>> Eventos
>> Em eventos promovidos pelo estúdio, o valor mínimo da sessão não será alterado, mas a porcentagem será reduzida a 20%.

# Responsabilidades
Tatuadores residentes possuem vantagens em comparação aos guests, mas possuem as seguintes responsabilidades:
##
Comparecimento nas reuniões de alinhamento mensal, onde discutiremos melhorias pro espaço e eventos;
##
Comparecimento nos eventos do estúdio conforme disponibilidade;
##
Comprometimento com o cuidado coletivo do espaço (manutenção pós uso);
## !NÃO EXIGIMOS exclusividade.
$conteudo$, 1)
ON CONFLICT (id) DO NOTHING;
