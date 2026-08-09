# Balcão — Regras operacionais da virada 2026/2027

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

Dívida é apresentada como alerta com quantidade e valor. A taxa de reconfirmação não liquida mensalidades e não deve ser confundida com elas. A secretaria deve poder tratar a taxa e a dívida no atendimento conforme a política financeira da escola.

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
- Depois de concluir, mostrar “já concluído” e o comprovante, quando emitido.
