# KLASSE — Apply Diff
run_id: E08C0B27-7D07-4C98-85E3-C077DEAD3E0B
timestamp: 2026-07-26T11:34:36Z
ficheiro: apps/web/tests/klasse-ai-assistant.e2e.ts

## Alteração proposta

Adicionar E2E autenticado para Secretaria, Financeiro e Professor usando o
seed oficial protegido por `TEST_SEED_KEY`.

## Reversibilidade

Novo ficheiro isolado e reversível.

## Meta p95

Cada resposta do endpoint deve concluir dentro do timeout E2E de 60 segundos;
as ferramentas locais devem manter p95 inferior a 500 ms.
