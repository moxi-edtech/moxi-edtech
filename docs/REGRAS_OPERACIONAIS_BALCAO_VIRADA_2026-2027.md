# Balcão — Regras operacionais da virada 2026/2027

## Atualização de produto — 2026-08-23

O Balcão passou a manter o contexto do ano letivo durante todo o atendimento. O selector de ano deve representar a sessão académica real, por exemplo `2026/2027`, e não apenas `2026` como ano civil. Mensalidades são ordenadas pela competência completa, respeitando Setembro/2026 antes de Janeiro/2027.

O atendimento também permite:

- trocar de aluno sem fechar o Balcão;
- limpar automaticamente o carrinho ao trocar de aluno;
- preencher o total recebido ao escolher pagamento em numerário;
- calcular troco antes da confirmação;
- continuar no mesmo ano letivo ao abrir rematrícula, mensalidades e comprovantes.
- abrir a regularização de dívida no próprio contexto do aluno;
- pagar parcialmente as mensalidades mais antigas primeiro;
- retornar à confirmação da rematrícula depois da quitação, com indicação explícita de contexto retomado;
- consultar o histórico dos pagamentos parciais feitos na sessão.

Na confirmação de rematrícula, o modal do Balcão mantém decisão académica,
fonte/motivo da decisão, turma destino, dívida e pagamento no mesmo contexto.
Quando há saldo vencido, a etapa financeira fica bloqueada e o botão
“Regularizar dívida neste atendimento” abre a regularização sem perder o aluno,
o ano ou a turma selecionada.

Quando o pagamento é confirmado e a matrícula não é concluída, o caso fica em `RECONCILIATION_REQUIRED` e deve ser resolvido na fila de reconciliação. A secretaria não deve cobrar novamente.

Uma tentativa sem valor liquidado, referência ou comprovativo fica em
`PENDING_ORDER_REVIEW`. O próprio cartão do aluno permite **Cancelar tentativa
e cobrar agora**: o servidor só autoriza o cancelamento para intents em
`draft`, sem prova e sem pagamento associado. Tentativas com referência,
comprovativo ou pagamento ficam protegidas e seguem para reconciliação.

Para `cash`, a confirmação no Balcão é liquidação imediata: depois de o
financeiro registar o numerário, o pedido de taxa é marcado como concedido na
mesma operação e a matrícula é finalizada. Se a etapa académica falhar depois
do recebimento, o caso entra em reconciliação — nunca volta a ser uma cobrança
pendente nem permite cobrar a taxa uma segunda vez.

Na reconciliação de uma taxa já liquidada, a secretaria não muda de contexto:
o mesmo atendimento abre a decisão académica da coorte, exige resultado,
fonte e motivo, valida a inclusão do aluno e então conclui a matrícula destino
e o comprovativo. Não chama a autorização de promoção por notas pendentes
quando a decisão administrativa Curtume já foi registada.

## Objetivo

O Balcão deve orientar a secretaria sem transformar exceções académicas em bloqueios silenciosos. Cada operação deve deixar claro:

- o estado atual da matrícula;
- se a classe destino já foi preparada;
- se existem dívidas;
- se as notas estão pendentes;
- qual decisão a secretaria está a confirmar.

## Modo Curtume — virada assistida sem notas completas

O Curtume é uma escola piloto que começou a utilizar o KLASSE no meio de 2025.
Como parte relevante das notas e frequências não foi lançada, a ausência de
dados não pode ser convertida automaticamente em reprovação.

Quando o aluno aparecer no Balcão, seguir esta sequência no mesmo atendimento:

1. abrir a matrícula histórica de 2025;
2. selecionar `Aprovado`, `Reprovado`, `Concluído` ou `Revisão necessária`;
3. quando não houver notas completas, selecionar a fonte
   `declaracao_administrativa_escola`;
4. preencher o motivo obrigatório: “Notas de 2025 não lançadas após entrada
   da escola no KLASSE; decisão confirmada pela secretaria/direção”;
5. confirmar a turma destino — classe seguinte para aprovado, mesma classe para
   reprovado;
6. criar ou reutilizar a reserva 2026/2027;
7. regularizar a dívida vencida da matrícula de origem ou registrar acordo
   aprovado;
8. ativar a matrícula destino apenas quando o gate financeiro estiver verde.

O registo deve guardar utilizador, data, escola, matrícula de origem, decisão,
fonte, motivo e turma destino. Não é permitido lançar notas fictícias, reabrir
artificialmente a matrícula histórica ou ativar um destino com decisão em
`Revisão necessária`.

Se a escola decidir lançar o histórico posteriormente, o lançamento deve usar a
tela oficial de notas e manter a decisão administrativa e a auditoria da
virada. A secretaria não deve repetir o atendimento nem criar uma segunda
matrícula para o mesmo aluno/ano.

### O que o código já faz e o que ainda falta

O Balcão já implementa a decisão de resultado no próprio modal, a opção
“Lançar notas depois e rematricular agora”, valida a progressão da turma, chama
a autorização de promoção com pendências, registra motivo/actor/data em
auditoria, cria ou reutiliza a reserva e mantém a dívida como bloqueio financeiro
separado.

A extensão está aplicada no ambiente remoto:

- chave de proveniência `declaracao_administrativa_escola`;
- observação específica da decisão académica;
- fecho da origem em `historico_anos.resultado_final` e `status = concluido`.

Continua pendente um estado de fila `revisão necessária` distinto do `409` de
dados pendentes e uma configuração/cohort exclusiva do Curtume.

O fluxo usa `notas_lancar_depois = true` quando a escola decide sem notas e
persiste a proveniência. A origem passa a ficar concluída **antes** da quitação,
mantendo a dívida como bloqueio exclusivo da ativação do destino. A regra está
aplicada no remoto pela migration
`20270823210000_allow_closed_origin_rematricula_activation.sql`.

## Estados e comportamento

| Estado | Situação | Ação do Balcão |
|---|---|---|
| `READY` | Não existe matrícula destino | Permite selecionar a turma destino e pagar a taxa. |
| `RECONFIRMATION_REQUIRED` | Já existe matrícula ativa na classe destino | Cobra apenas a taxa; não mostra selector de turma nem executa nova promoção. |
| `FINALIST_PENDING` | Existe registo `aguardando_destino` de finalista | Cobra a taxa e encaminha para continuar no novo ciclo; a conclusão/saída é tratada no fluxo de finalistas. |
| `ALREADY_COMPLETED` | Operação já paga/concluída | Não permite nova cobrança; mostra o comprovante quando disponível. |
| `PAYMENT_IN_PROGRESS` | Existe pedido de taxa em aberto | Não cria pedido duplicado; orienta a concluir/reconciliar o pagamento existente. |
| `LEGACY_REVIEW_REQUIRED` | Existe pedido incompleto sem ano letivo/contexto | Não cobra novamente; mostra o ano letivo corrente, associa o pedido àquele contexto e substitui o rascunho por uma operação válida. Se houver pagamento liquidado, encaminha para reconciliação financeira. |
| `PRICE_NOT_CONFIGURED` | Serviço sem valor ativo | Não permite pagamento e orienta a configuração do emolumento. |

## Notas pendentes

Notas não lançadas não significam automaticamente reprovação.

Quando a secretaria conhece o resultado e confirma que o aluno está apto:

1. o Balcão mostra a progressão como provisória;
2. a secretaria marca `Lançar notas depois`;
3. a matrícula pode ser criada/reconfirmada;
4. a decisão fica registada no pedido;
5. as notas devem ser lançadas posteriormente.

O certificado com notas só deve ser emitido quando o histórico estiver completo. Para um aluno que não continuará na escola, a secretaria pode concluir/arquivar e emitir o certificado sem notas quando essa for a decisão operacional.

## Dívidas

Dívida com saldo aberto impede a rematrícula em qualquer canal. O bloqueio nunca deve ser silencioso: deve apresentar quantidade, valor, mensalidades afectadas e a ação “Regularizar no balcão”.

O Balcão permite pagamento parcial, aplicado às mensalidades mais antigas primeiro. O pagamento parcial reduz o saldo, mas não libera a rematrícula. Apenas saldo zero torna o aluno elegível.

Depois da quitação, o sistema apresenta “Dívida regularizada” e “Continuar”, retornando à confirmação da rematrícula com o aluno e a operação preservados. A taxa de rematrícula não liquida mensalidades e não deve ser confundida com elas.

## Pedidos legados sem ano

Um pedido legado é um `SERV_REMATRICULA` pendente criado sem `ano_letivo_id` no contexto. O Balcão não o cobra novamente nem o associa silenciosamente a outro ano: apresenta o ano actualmente seleccionado e pede confirmação da secretaria. Ao confirmar, o pedido antigo fica auditado como substituído e a secretaria continua no fluxo normal daquele ano. Pedidos com pagamento liquidado nunca são substituídos pelo Balcão; seguem para reconciliação financeira.

## Finalistas

Os finalistas não devem voltar ao fluxo genérico de promoção:

- continuar no Curtume: pagar a taxa e confirmar a matrícula preparada no novo ciclo;
- não continuar: arquivar a matrícula, libertar a vaga e emitir certificado;
- certificado com notas: histórico académico disponível;
- certificado sem notas: decisão explícita de conclusão sem notas ou histórico ainda não lançado.

## Critérios de aceitação UX

- Nunca mostrar “a verificar elegibilidade” quando a API já respondeu um estado final.
- Nunca pedir uma nova turma para uma matrícula destino já existente.
- Nunca bloquear por notas ausentes sem explicar a confirmação necessária.
- Nunca permitir pagamento duplicado para o mesmo aluno/ano/operação.
- Nunca bloquear por dívida sem oferecer regularização, valor, quantidade de mensalidades e retorno contextual.
- Nunca liberar rematrícula após pagamento parcial; o saldo deve ser zero.
- Depois de concluir, mostrar “já concluído” e o comprovante, quando emitido.

## Admissão inicial — falha recuperável e retomada contextual

A falha de conversão nunca deve terminar em bloqueio sem próximo passo. Quando a
geração financeira encontra uma candidatura com calendário ausente, calendário de
ano incompatível ou data financeira fora do calendário:

1. a conversão não cria matrícula parcial;
2. a candidatura é reaberta como `rascunho`;
3. o operador recebe a causa em linguagem operacional;
4. o sistema oferece **Rever matrícula** ou **Corrigir calendário MED**;
5. ao voltar para “Nova admissão”, aparece “Tem uma candidatura em andamento” e o
   operador pode continuar de onde parou.

O botão **Corrigir calendário MED** deve abrir a configuração oficial do ano letivo,
onde `data_inicio` e `data_fim` são editáveis. O calendário operacional de eventos
não substitui essa configuração.

## Integridade das turmas

Toda turma deve possuir `ano_letivo_id` vinculado à escola e ao calendário MED. A
API grava esse vínculo explicitamente e o banco rejeita turmas órfãs. Imports
legados que enviam apenas `ano_letivo` podem ser resolvidos automaticamente quando
existe um calendário único para a escola/ano; caso contrário, a operação deve
orientar a secretaria a configurar o calendário.

Matrícula efetiva antes do início oficial do calendário é permitida para alunos que
já frequentam a escola. Isso não antecipa a cobrança: a primeira competência segue
o início do calendário MED.
