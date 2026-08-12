# Balcão — Regras operacionais da virada 2026/2027

## Atualização de produto — 2026-08-11

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

Quando o pagamento é confirmado e a matrícula não é concluída, o caso fica em `RECONCILIATION_REQUIRED` e deve ser resolvido na fila de reconciliação. A secretaria não deve cobrar novamente.

## Objetivo

O Balcão deve orientar a secretaria sem transformar exceções académicas em bloqueios silenciosos. Cada operação deve deixar claro:

- o estado atual da matrícula;
- se a classe destino já foi preparada;
- se existem dívidas;
- se as notas estão pendentes;
- qual decisão a secretaria está a confirmar.

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
