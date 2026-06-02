-- P1 Admissoes: search/dedupe indexes and explicit MV refresh schedule.

CREATE INDEX IF NOT EXISTS idx_candidaturas_id_text_trgm
ON public.candidaturas
USING gin ((id::text) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_candidaturas_doc_normalizado_jsonb
ON public.candidaturas (
  escola_id,
  ano_letivo,
  curso_id,
  ((dados_candidato ->> 'documento_normalizado'))
)
WHERE dados_candidato ? 'documento_normalizado';

CREATE INDEX IF NOT EXISTS idx_candidaturas_resp_phone_nome_normalizado_jsonb
ON public.candidaturas (
  escola_id,
  ano_letivo,
  curso_id,
  ((dados_candidato ->> 'responsavel_contato_normalizado')),
  ((dados_candidato ->> 'nome_normalizado'))
)
WHERE dados_candidato ? 'responsavel_contato_normalizado'
  AND dados_candidato ? 'nome_normalizado';

CREATE INDEX IF NOT EXISTS idx_candidaturas_phone_nome_normalizado_jsonb
ON public.candidaturas (
  escola_id,
  ano_letivo,
  curso_id,
  ((dados_candidato ->> 'telefone_normalizado')),
  ((dados_candidato ->> 'nome_normalizado'))
)
WHERE dados_candidato ? 'telefone_normalizado'
  AND dados_candidato ? 'nome_normalizado';

DO $$
DECLARE
  v_job record;
BEGIN
  FOR v_job IN
    SELECT jobid
    FROM cron.job
    WHERE jobname = 'refresh_mv_admissoes_counts_por_status'
       OR command ILIKE '%mv_admissoes_counts_por_status%'
  LOOP
    PERFORM cron.unschedule(v_job.jobid);
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'refresh_mv_admissoes_counts_por_status',
  '*/10 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_admissoes_counts_por_status$$
);

REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_admissoes_counts_por_status;
