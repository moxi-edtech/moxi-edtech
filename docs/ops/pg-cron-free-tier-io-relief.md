# KLASSE — controlo de Disk I/O sem nova subscrição

**Âmbito desta PR:** consolidar o refresh duplicado de pagamentos e persistir o alívio de 13 agendamentos que foi aplicado durante o incidente de 20/11/2026. Não migra processamento crítico, não altera RLS, não elimina materialized views nem ativa serviços pagos.

## Alterações

- Manter o job canónico `refresh_mv_pagamentos_status` (RPC definida no contrato F18). Desativar, sem eliminar, apenas o job legado `fin-pagamentos-status-5m` que atualiza diretamente `internal.mv_pagamentos_status`. São duas execuções da **mesma MV**, não duas fontes de dados.
- Preservar os 13 horários reduzidos de refresh que já estavam em produção, evitando que um ambiente recém-instalado volte aos intervalos antigos.
- Corrigir o intervalo do resumo de auditoria do Super Admin, que se chamava `refresh-audit-metrics-daily` mas executava a cada hora: passar para cada seis horas. Os eventos de auditoria continuam a ser gravados normalmente; apenas o resumo poderá estar até seis horas desatualizado.
- **Não alterar** `outbox-db-worker-1m`, `operational-receipts-1m`, reconciliação de pagamentos, Auth, permissões ou RPCs críticas.

## Validações e reversão

Aplicar `supabase/migrations/20271130090000_consolidate_pg_cron_io_free_tier.sql` pelo fluxo de migrações aprovado. Em seguida executar `supabase/ops/tests/regression_pg_cron_io_free_tier.sql`; o teste é read-only e falha se a única atualização canónica de pagamentos ou os workers essenciais estiverem desativados.

Consultas de observabilidade:

```sql
SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname IN (
  'refresh_mv_pagamentos_status', 'fin-pagamentos-status-5m',
  'refresh-audit-metrics-daily', 'outbox-db-worker-1m',
  'operational-receipts-1m'
)
ORDER BY jobname;

SELECT query, calls, wal_bytes, shared_blks_dirtied
FROM pg_stat_statements
WHERE query ILIKE '%mv_pagamentos_status%'
ORDER BY wal_bytes DESC;
```

Reversão operacional **apenas se necessária e após inspeção da query do job**:

```sql
-- Restaura a duplicação somente como rollback temporário.
SELECT cron.alter_job(jobid, active := true)
FROM cron.job
WHERE jobname = 'fin-pagamentos-status-5m'
  AND command = 'REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_pagamentos_status';

-- Restaura o resumo de auditoria para cada hora.
SELECT cron.alter_job(jobid, schedule := '18 * * * *')
FROM cron.job
WHERE jobname = 'refresh-audit-metrics-daily'
  AND command = 'REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_super_admin_audit_metrics';
```

> A redução do número de execuções não pode ser confundida com uma redução da mesma proporção de I/O. Comparar o delta de WAL, latência, falhas do cron e frequência de atualização após algumas horas.

## Inngest gratuito — fase seguinte, sem cutover implícito

Já existe Inngest no KLASSE (`apps/web/src/app/api/inngest/route.ts`). **Não mover um refresh SQL pesado para Inngest sem corrigir a query**: continua a escrever no mesmo Postgres e adiciona callbacks Vercel. Migrar `outbox-db-worker-1m` e `operational-receipts-1m` só depois de ter evento durável, idempotência, claim exclusivo (`FOR UPDATE SKIP LOCKED`), fallback de recuperação e interface interna com permissões verificadas. Atualmente a RPC de recibos não é executável por `service_role`; não abrir esse privilégio indiscriminadamente.

O worker de push Inngest atualmente consulta notificações por cron a cada minuto. A evolução correta é: publicar um evento **após confirmação da transação**, processar por ID com deduplicação de entrega e manter cron de recuperação pouco frequente. Alterar apenas o cron antes de integrar todos os produtores introduziria atrasos silenciosos.

**Critério de custo:** nenhuma nova subscrição, infraestrutura ou consumo garantido; monitorizar as quotas atuais de Inngest, Vercel e Supabase antes de habilitar mais jobs.
