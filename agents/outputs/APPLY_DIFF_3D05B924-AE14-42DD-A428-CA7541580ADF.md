# Apply Diff — 3D05B924-AE14-42DD-A428-CA7541580ADF

## Ficheiro
`supabase/migrations/20260604111350_limit_pg_cron_history.sql`

## Alteração proposta
- Desativar o cron quebrado `select public.process_outbox_batch(50);`.
- Remover histórico do pg_cron anterior a 7 dias.
- Criar retenção diária de 7 dias.
- Após a migration, executar `VACUUM (FULL, ANALYZE) cron.job_run_details;` para devolver espaço ao sistema.

## Reversão
A retenção e o cron podem ser revertidos com migration posterior. Os registros históricos removidos não podem ser recuperados por `git revert`.
