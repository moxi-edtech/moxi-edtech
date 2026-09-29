-- Rebuild professor pending-grades MV so duplicate evaluation rows do not
-- violate the concurrent-refresh unique index. No source evaluations/notes
-- are deleted; duplicates are consolidated logically.
DROP VIEW IF EXISTS public.vw_professor_pendencias;
DROP MATERIALIZED VIEW IF EXISTS internal.mv_professor_pendencias;

CREATE MATERIALIZED VIEW internal.mv_professor_pendencias AS
WITH base AS (
  SELECT
    td.escola_id,
    td.id AS turma_disciplina_id,
    td.turma_id,
    td.professor_id,
    pr.profile_id,
    t.nome AS turma_nome,
    cm.disciplina_id,
    dc.nome AS disciplina_nome
  FROM public.turma_disciplinas td
  LEFT JOIN public.professores pr ON pr.id = td.professor_id
  LEFT JOIN public.turmas t ON t.id = td.turma_id
  LEFT JOIN public.curso_matriz cm ON cm.id = td.curso_matriz_id
  LEFT JOIN public.disciplinas_catalogo dc ON dc.id = cm.disciplina_id
  WHERE td.escola_id IS NOT NULL
),
active_matriculas AS (
  SELECT
    m.escola_id,
    m.turma_id,
    COUNT(*)::int AS total_alunos
  FROM public.matriculas m
  WHERE m.status IN ('ativa', 'ativo', 'active')
  GROUP BY m.escola_id, m.turma_id
),
tipos AS (
  SELECT unnest(ARRAY['MAC','NPP','NPT']) AS tipo
),
trimestres AS (
  SELECT unnest(ARRAY[1,2,3])::int AS trimestre
),
avaliacoes_grouped AS (
  SELECT
    a.escola_id,
    a.turma_disciplina_id,
    upper(a.tipo) AS tipo,
    a.trimestre,
    (array_agg(a.id ORDER BY a.created_at DESC, a.id DESC))[1] AS avaliacao_id,
    array_agg(a.id) AS avaliacao_ids
  FROM public.avaliacoes a
  WHERE a.escola_id IS NOT NULL
    AND a.turma_disciplina_id IS NOT NULL
    AND a.tipo IS NOT NULL
    AND a.trimestre IS NOT NULL
  GROUP BY a.escola_id, a.turma_disciplina_id, upper(a.tipo), a.trimestre
)
SELECT
  b.escola_id,
  b.professor_id,
  b.profile_id,
  b.turma_disciplina_id,
  b.turma_id,
  b.turma_nome,
  b.disciplina_id,
  b.disciplina_nome,
  t.tipo,
  tr.trimestre,
  ag.avaliacao_id,
  COALESCE(am.total_alunos, 0) AS total_alunos,
  COUNT(DISTINCT n.matricula_id) FILTER (WHERE n.id IS NOT NULL)::int AS notas_lancadas,
  CASE
    WHEN COALESCE(am.total_alunos, 0) = 0 THEN 0
    WHEN ag.avaliacao_id IS NULL THEN COALESCE(am.total_alunos, 0)
    ELSE GREATEST(COALESCE(am.total_alunos, 0) - COUNT(DISTINCT n.matricula_id), 0)
  END AS pendentes
FROM base b
CROSS JOIN tipos t
CROSS JOIN trimestres tr
LEFT JOIN avaliacoes_grouped ag
  ON ag.escola_id = b.escola_id
 AND ag.turma_disciplina_id = b.turma_disciplina_id
 AND ag.tipo = t.tipo
 AND ag.trimestre = tr.trimestre
LEFT JOIN public.notas n
  ON ag.avaliacao_ids IS NOT NULL
 AND n.escola_id = b.escola_id
 AND n.avaliacao_id = ANY(ag.avaliacao_ids)
LEFT JOIN active_matriculas am
  ON am.escola_id = b.escola_id
 AND am.turma_id = b.turma_id
GROUP BY
  b.escola_id,
  b.professor_id,
  b.profile_id,
  b.turma_disciplina_id,
  b.turma_id,
  b.turma_nome,
  b.disciplina_id,
  b.disciplina_nome,
  t.tipo,
  tr.trimestre,
  ag.avaliacao_id,
  am.total_alunos;

CREATE UNIQUE INDEX ux_mv_professor_pendencias
  ON internal.mv_professor_pendencias
     (escola_id, turma_disciplina_id, tipo, trimestre);

CREATE INDEX idx_mv_professor_pendencias_escola_turma
  ON internal.mv_professor_pendencias (escola_id, turma_id);

REVOKE ALL ON TABLE internal.mv_professor_pendencias FROM PUBLIC, anon;
GRANT SELECT ON TABLE internal.mv_professor_pendencias TO authenticated, service_role;

CREATE VIEW public.vw_professor_pendencias
WITH (security_invoker = true) AS
SELECT
  escola_id,
  professor_id,
  profile_id,
  turma_disciplina_id,
  turma_id,
  turma_nome,
  disciplina_id,
  disciplina_nome,
  tipo,
  trimestre,
  avaliacao_id,
  total_alunos,
  notas_lancadas,
  pendentes
FROM internal.mv_professor_pendencias
WHERE escola_id IN (
  SELECT eu.escola_id
  FROM public.escola_users eu
  WHERE eu.user_id = auth.uid()
);

REVOKE ALL ON TABLE public.vw_professor_pendencias FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.vw_professor_pendencias TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.refresh_mv_professor_pendencias()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_professor_pendencias;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.refresh_mv_professor_pendencias()
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_mv_professor_pendencias() TO service_role;

-- Auto-expire is a trusted internal transition and must opt into the same
-- guard used by official status RPCs only for the duration of its UPDATE.
CREATE OR REPLACE FUNCTION public.admissao_auto_expire_reservations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_rec record;
BEGIN
  FOR v_rec IN
    SELECT id, escola_id, status, expires_at
    FROM public.candidaturas
    WHERE status = 'aguardando_pagamento'
      AND expires_at < now()
    FOR UPDATE SKIP LOCKED
  LOOP
    INSERT INTO public.candidaturas_status_log (
      escola_id, candidatura_id, from_status, to_status, motivo
    ) VALUES (
      v_rec.escola_id,
      v_rec.id,
      v_rec.status,
      'arquivada',
      'Reserva expirada (prazo de pagamento de 48h excedido).'
    );

    BEGIN
      PERFORM set_config('app.rpc_internal', 'on', true);

      UPDATE public.candidaturas
      SET status = 'arquivada',
          updated_at = now()
      WHERE id = v_rec.id;

      PERFORM set_config('app.rpc_internal', 'off', true);
    EXCEPTION WHEN OTHERS THEN
      PERFORM set_config('app.rpc_internal', 'off', true);
      RAISE;
    END;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admissao_auto_expire_reservations()
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admissao_auto_expire_reservations() TO service_role;

-- Repair two stale cron commands that referenced functions that do not exist.
SELECT cron.alter_job(
  job_id := 213,
  command := 'REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_secretaria_matriculas_turma_status'
);

SELECT cron.alter_job(
  job_id := 216,
  command := 'REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_cursos_reais'
);

-- Drop structurally identical non-constraint indexes; keep the canonical/used copy.
DROP INDEX IF EXISTS public.ix_search_alunos_bi_numero_trgm;
DROP INDEX IF EXISTS public.ix_search_alunos_numero_processo_trgm;
DROP INDEX IF EXISTS public.ix_search_candidaturas_nome_trgm;
DROP INDEX IF EXISTS public.ix_search_cursos_nome_trgm;
DROP INDEX IF EXISTS public.idx_pautas_lote_jobs_escola_status;

-- These per-partition constraints duplicate the parent-attached unique constraint.
ALTER TABLE public.frequencias_2025_09 DROP CONSTRAINT IF EXISTS uq_frequencias_ssot__2025_09;
ALTER TABLE public.frequencias_2025_10 DROP CONSTRAINT IF EXISTS uq_frequencias_ssot__2025_10;
ALTER TABLE public.frequencias_2025_11 DROP CONSTRAINT IF EXISTS uq_frequencias_ssot__2025_11;
ALTER TABLE public.frequencias_2025_12 DROP CONSTRAINT IF EXISTS uq_frequencias_ssot__2025_12;
ALTER TABLE public.frequencias_2026_01 DROP CONSTRAINT IF EXISTS uq_frequencias_ssot__2026_01;
ALTER TABLE public.frequencias_2026_02 DROP CONSTRAINT IF EXISTS uq_frequencias_ssot__2026_02;
ALTER TABLE public.frequencias_default DROP CONSTRAINT IF EXISTS uq_frequencias_ssot__default;

