# KLASSE — Apply Result
run_id: 4CFFB728-A54D-4BA0-8E8D-77846C32F397
status: PASS

## Alteração

Endurecidos os grants da MV operacional e adicionado índice composto para
documentos por escola/status.

## Evidências do banco real — read-only

- PostgreSQL 17.6; schemas `public`, `internal` e `cron` presentes.
- Todas as sete tabelas e colunas requeridas existem.
- Enum de outbox contém `failed`.
- `pg_cron` 1.6.4 e assinaturas de `schedule/unschedule` compatíveis.
- Nenhum artefacto operacional homónimo existe atualmente.
- Consulta exacta da MV compilou: 7 escolas e 7 chaves distintas.
- Nenhuma escola possui mais de um ano letivo ativo.
- Índices de horários, outbox, turmas e membership presentes.
- `escola_users` possui RLS e política SELECT.
- Nenhuma escrita, refresh ou migration foi executada na base.

## Checks locais

- `git diff --check`: PASS.
- MV, UNIQUE INDEX, refresh concorrente, wrapper e cron: presentes.

## Meta p95

Dashboard operacional inferior a 200 ms; agregações fora do request.
