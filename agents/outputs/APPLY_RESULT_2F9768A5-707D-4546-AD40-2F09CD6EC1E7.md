# Resultado do apply — DB lint, lote 3
run_id: 2F9768A5-707D-4546-AD40-2F09CD6EC1E7
approval_commit: 12de95406ef409f6eea27a2f2fc8ca75344580dc
status: REVERTED

## Resultado

A transação abortou no primeiro `ATTACH PARTITION`. O PostgreSQL exige que o
índice filho pertença a uma constraint UNIQUE da partição quando o índice pai
também pertence a uma constraint.

## Rollback

- Transação: abortada antes do COMMIT
- Índices residuais do lote: 0
- Funções alteradas: 0
- Estado do banco: inalterado

