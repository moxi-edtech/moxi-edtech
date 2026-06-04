# Apply Diff — 598B12B4-B6B1-461F-A4DD-026E1BDD9764

## Ficheiro
`supabase/migrations/20260604112227_stagger_pg_cron_compute_load.sql`

## Alteração proposta
- Distribuir refreshes de MVs para evitar 25–27 jobs simultâneos.
- Remover o refresh global diário redundante.
- Remover o cleanup de pautas que falha por tentar apagar diretamente do Storage.

## Reversão
Os schedules anteriores podem ser restaurados por migration posterior.
