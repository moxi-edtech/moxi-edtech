# KLASSE P1 — WAL e I/O académico sem novos serviços

## Diagnóstico (Supabase, 21/11/2026)

- `internal.mv_boletim_por_matricula`: **5.666 linhas**; refresh global `refresh-boletim-hourly`, hora `12 * * * *`.
- `pg_stat_statements`: **18.960 execuções acumuladas**, **~30.683 MB de WAL acumulado**. Isto é histórico, **não** consumo por dia/mês. Cada execução pode ter custo diferente; medir deltas de WAL após a implementação.
- Os boletins também são lidos **diretamente** por RPCs académicas e históricas. Não podemos substituir esta MV por uma tabela apenas mudando o nome ou a view pública: quebraria a fonte desses cálculos.
- `internal.mv_top_cursos_media` alimenta `public.vw_top_cursos_media`, usada nos insights rápidos; o cálculo é um AVG por escola/curso e não depende de um cálculo global do boletim.

## Migração 1 — refresh do boletim sensível a alterações

`20271130110000_boletim_change_aware_refresh.sql`

- Conserva a MV, a view pública, todos os índices e as APIs/RPCs existentes.
- Invalida uma versão transacional a cada statement relevante nas oito fontes SQL: `notas`, `matriculas`, `avaliacoes`, `turma_disciplinas`, `curso_matriz`, `disciplinas_catalogo`, `configuracoes_escola`, `modelos_avaliacao`.
- O job `refresh-boletim-hourly` mantém o horário, mas executa `internal.refresh_boletim_if_dirty()`. Sem alterações confirmadas, **não executa o REFRESH**.
- Reconciliação completa após 24 h mesmo que nenhum trigger tenha disparado; protege contra restauros e alterações fora do caminho normal.
- O botão/serviço que chama `public.refresh_mv_boletim_por_matricula()` continua a forçar o refresh, serializado por advisory lock.
- Versões de alterações confirmadas **durante** um REFRESH continuam pendentes para a execução seguinte, evitando perder atualizações em corrida.

Não é um refresh incremental nativo de linhas do boletim. É uma redução conservadora de refreshes globais sem perder consumidores diretos. A migração integral por matrícula continua sujeita ao contrato dos RPCs históricos.

## Migração 2 — média por curso verdadeiramente incremental

`20271130113000_incremental_top_course_averages.sql`

- Materializa em `internal.top_cursos_media_live` os mesmos quatro campos, mantendo `public.vw_top_cursos_media` e `security_invoker=true`.
- RLS no próprio cache restringe `SELECT` à associação `escola_users`; a fila e as funções de trabalho continuam privadas.
- As alterações em notas colocam apenas os cursos afetados na fila. Alterações em avaliação/matriz/turma-disciplina/curso colocam os cursos afetados da escola na fila.
- O worker usa `FOR UPDATE SKIP LOCKED` e atualiza **somente uma escola + curso** por item. O UPSERT só reescreve uma linha se `curso_nome` ou `media` tiver mudado.
- O cron canónico `refresh_mv_top_cursos_media` é reaproveitado com `SELECT internal.process_top_cursos_dirty(50);` a cada 10 minutos. Uma reconciliação diária volta a enfileirar os 15 cursos, e não refresca globalmente a MV.
- A função pública de refresh manual mantém a atualização global de compatibilidade **apenas quando solicitada**, e converge o cache incremental.

## Gates verificados em ensaio transacional

Os dois SQL foram executados em conjunto no projeto Supabase existente, seguidos por `supabase/ops/tests/incremental_academic_readmodels_parity.sql` **numa transação com ROLLBACK**. Passaram:

- criação de funções, tabelas, triggers e alterações temporárias de cron/view;
- 8 triggers de invalidação para boletins;
- 15 triggers statement-level para médias por curso;
- worker com fila completamente drenada;
- resultado de `top_cursos_media_live` **idêntico à consulta original** (comparação bidirecional `EXCEPT ALL`);
- política RLS e novos comandos de cron.

Nenhuma tabela, cron ou view foi alterada permanentemente nesse ensaio.

## Aplicação e validação em produção

1. Conferir CI e alterações concorrentes da `main`; comparar a migração instalada com o contrato atual do Supabase.
2. Aplicar as migrações **na ordem**, registrando as versões com o procedimento de migrações aprovado. Não repetir cegamente migrations já aplicadas manualmente em anos anteriores.
3. Executar a verificação SQL de paridade com `ROLLBACK`.
4. Verificar `cron.job_run_details`, `pg_stat_statements` (deltas de `wal_bytes`) e os tempos de Auth/nota/boletim durante algumas horas e novamente após 24h.
5. Monitorar fila: `SELECT count(*),min(requested_at) FROM internal.top_cursos_dirty;`. Filas que não drenam indicam erro de cron ou de fonte.

## Rollback operacional

Se houver divergência de médias ou erro de permissões, restaurar **apenas o consumidor e os horários**, mantendo as tabelas auxiliares para diagnóstico:

```sql
BEGIN;
CREATE OR REPLACE VIEW public.vw_top_cursos_media
WITH (security_invoker = true) AS
SELECT escola_id,curso_id,curso_nome,media
FROM internal.mv_top_cursos_media
WHERE escola_id IN (
  SELECT escola_id FROM public.escola_users WHERE user_id=auth.uid()
);

SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname='refresh_mv_top_cursos_media'),
  schedule := '10,40 * * * *',
  command := 'REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_top_cursos_media'
);
SELECT cron.unschedule('top-cursos-reconcile-daily');

SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname='refresh-boletim-hourly'),
  command := 'REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_boletim_por_matricula'
);
COMMIT;
```

A função manual `public.refresh_mv_top_cursos_media()` continua válida, mas passa a atualizar também o cache desativado até ao desmantelamento seguro. Não eliminar os artefactos auxiliares no momento do rollback: podem existir reconciliações ou gravações em curso.

## Medição de WAL

```sql
SELECT left(query,120) AS statement,calls,round((wal_bytes/1024.0/1024)::numeric,2) AS wal_mb
FROM pg_stat_statements
WHERE query ILIKE '%mv_boletim_por_matricula%'
   OR query ILIKE '%top_cursos_media%'
   OR query ILIKE '%process_top_cursos_dirty%'
ORDER BY wal_bytes DESC;

SELECT jobname,schedule,active,command
FROM cron.job
WHERE jobname IN ('refresh-boletim-hourly','refresh_mv_top_cursos_media',
                  'top-cursos-reconcile-daily');
```

**Nota:** não reiniciar `pg_stat_statements` apenas para medir; guardar um baseline e comparar diferenças de counters. Isto evita apagar histórico de outros diagnósticos.

**Custos:** usam exclusivamente PostgreSQL, `pg_cron` e Supabase já instalados. Não requer Inngest, Workers ou planos pagos.
