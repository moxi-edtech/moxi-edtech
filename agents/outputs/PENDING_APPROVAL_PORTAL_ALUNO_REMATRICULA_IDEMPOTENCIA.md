# Aprovação necessária — Agent 3

run_id:    PORTAL-ALUNO-REM-IDEMPOTENCIA-20260604
timestamp: 2026-06-04T20:00:00Z
status:    APPROVED_AND_APPLIED

## Acção proposta

Corrigir o finding `GAP-REM-002`:

- Criar índice único parcial para uma candidatura de rematrícula ativa por escola, aluno e ano letivo.
- Criar RPC transacional para confirmar rematrícula de forma idempotente.
- Validar novamente ano futuro, dívida, matrícula atual e pedido existente dentro da transação.
- Alterar `/api/aluno/rematricula/confirmar` para usar a RPC.

## Diff

```diff
- endpoint consulta e insere candidatura em operações separadas
- ausência de constraint específica para rematrícula
+ índice único parcial por (escola_id, aluno_id, ano_letivo)
+ RPC SECURITY DEFINER com validação de auth.uid() e tenant
+ retorno idempotente do pedido já existente
+ auditoria na mesma transação
```

## Risco

O índice falhará se já existirem duplicados ativos. A inspeção atual encontrou zero grupos duplicados, mas a migration será simulada com rollback antes da aplicação.

## Salvaguardas

- Nenhum pedido existente será apagado.
- Migration transacional.
- Simulação com rollback.
- Teste concorrente antes e depois da aplicação.

## Como aprovar

`APPROVE: PORTAL-ALUNO-REM-IDEMPOTENCIA-20260604`

## Como rejeitar

`REJECT: PORTAL-ALUNO-REM-IDEMPOTENCIA-20260604 [motivo]`

## Resultado

- Migration aplicada e registrada: `20270604194700_aluno_rematricula_idempotente.sql`.
- Índice único parcial ativo somente para rematrículas do portal não rejeitadas.
- Endpoint alterado para RPC transacional.
- Curso atual derivado corretamente por `matriculas.turma_id -> turmas.curso_id`.
- Teste idempotente em rollback: uma candidatura; primeira chamada `reused=false`; segunda `reused=true`.
- Teste financeiro em rollback: pendências bloquearam a operação.
- Nenhum pedido nem ano letivo de teste persistiu.
- Typecheck, lint e diff check passaram.
