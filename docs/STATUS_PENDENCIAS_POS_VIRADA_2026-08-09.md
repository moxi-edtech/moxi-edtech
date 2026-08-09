# Centro de Pendências Pós-Virada — diagnóstico e regra operacional

**Data:** 2026-08-09  
**Escopo:** Pendências pós-virada, dívida de mensalidades, finalistas e certificados  
**Escola de validação:** Curtume

## Veredito inicial

O Centro já tem uma base útil: resolve o ano de origem e destino no servidor, usa uma RPC tenant-scoped, separa dívida/finalista/revisão e executa ações auditadas. Ainda não era production-ready porque a dívida era calculada no ledger global do aluno, o pagamento abria mensalidades sem contexto de ano, a regularização não apresentava claramente o passo académico seguinte e o fluxo de finalistas podia terminar sem ação para pagar a taxa ou reemitir um certificado pendente.

## Regras implementadas

### Dívida pós-virada

- A dívida da fila é o saldo das mensalidades ligadas à matrícula de origem do ano anterior.
- Mensalidades de outros anos ou de outra matrícula não entram no saldo da fila.
- O pagamento deve apresentar competência, valor, vencimento e matrícula de origem.
- Depois de regularizar o saldo, o aluno passa para `Pronto para promover`.
- A promoção usa a matrícula de origem e o ano destino resolvidos no servidor; não aceita ano vindo livremente da UI.

### Finalistas

- `Continuar`: a secretaria precisa pagar a taxa de reconfirmação no contexto do ano destino antes de escolher a turma.
- `Não continuar`: pode concluir/arquivar sem criar matrícula no ciclo seguinte.
- Se a taxa faltar, a área mostra uma ação explícita para abrir o Balcão no aluno e ano corretos.
- A validação de classe destino continua no backend.

### Certificados

- `com_notas` só é permitido quando todas as disciplinas obrigatórias do histórico estiverem concluídas.
- Histórico aberto, inexistente ou parcialmente preenchido fica como `pendente`, sem afirmar que o certificado foi emitido.
- A conclusão académica e a emissão documental são estados separados; falha de emissão deve permanecer reprocessável.

## Gaps encontrados e tratamento

| Gap | Risco | Tratamento |
|---|---|---|
| Ledger agregado apenas por aluno | Mistura anos e pode bloquear promoção indevidamente | Saldo por `matricula_id` e mensalidades da matrícula de origem |
| Pagamento usava dossier global | Secretaria podia liquidar competência de outro ano | Endpoint contextual de mensalidades pós-virada |
| `pode_promover` era logicamente inalcançável | Após pagar, o aluno caía em revisão sem próximo passo | Estado visual `Pronto para promover` |
| Finalista sem taxa | Erro sem ação para corrigir | CTA para Balcão com aluno/ano destino |
| Notas contadas por quantidade de linhas | Parcial podia virar certificado com notas | Validar disciplinas e notas concluídas |
| Certificado falhava após arquivar | Emissão pode depender do fechamento do histórico | Retornar pendência explícita; fila documental persistente fica como próximo incremento |
| Permissão genérica `configurar_escola` | Perfis operacionais podiam receber 403 | Permissão específica de resolução pós-virada |

## Critérios de aceitação

- Um aluno com dívida de 2025 não aparece como devedor por mensalidade de 2026/2027.
- O modal de pagamento não mostra mensalidades de outro ano ou matrícula.
- Após pagamento total, aparece `Promover agora`.
- A promoção cria/reutiliza apenas a matrícula do ano destino.
- Finalista sem taxa vê como pagar antes de tentar continuar.
- Finalista arquivado com notas incompletas não recebe certificado classificado como `com_notas`.
- Falha documental não apaga silenciosamente a pendência.
- Todas as ações continuam tenant-scoped e auditadas.

## Limites desta entrega

O Centro continua a usar as RPCs académicas existentes para criar/reutilizar matrícula e concluir finalistas. A emissão de certificado continua sujeita ao fechamento oficial do histórico; quando esse requisito não estiver satisfeito, o sistema informa a pendência no resultado da operação. A fila documental persistente e o botão de reprocessamento automático permanecem backlog explícito, não sendo tratados como concluídos nesta entrega.

## Reconciliação financeira pós-virada

O relatório de mensalidades é somente leitura e não corrige dados automaticamente. Ele
identifica ausência de matrícula válida, ano divergente, ausência de vencimento,
ausência de calendário, vencimento fora do calendário e divergência real de turma.
O saldo é apresentado para priorização, mas qualquer correção exige revisão financeira
e académica.

Os agregados usados pelas telas escolares passaram a ter dimensão explícita
`escola_id + ano_letivo_id`. As visões globais antigas permanecem apenas para cenários
globais/super-admin; não devem ser usadas para decidir cobrança ou inadimplência de um
ano letivo específico.

A reconciliação agora é assistida: o sistema oferece candidatos e correções limitadas,
exige confirmação e justificativa, registra antes/depois e mantém casos ambíguos em
aberto. Nenhuma mensalidade é apagada ou alterada em lote pelo relatório.
