-- Fix: incluir 'vagas_ocupadas' na resolução de target (Via C / Self-service)

DROP FUNCTION IF EXISTS public.formacao_self_service_resolve_target(text, text) CASCADE;

CREATE OR REPLACE FUNCTION public.formacao_self_service_resolve_target(
  p_escola_slug text,
  p_cohort_ref text
)
RETURNS TABLE (
  escola_id uuid,
  escola_nome text,
  escola_slug text,
  cohort_id uuid,
  cohort_codigo text,
  cohort_nome text,
  curso_nome text,
  data_inicio date,
  data_fim date,
  status text,
  vagas integer,
  vagas_ocupadas integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.nome,
    e.slug,
    c.id,
    c.codigo,
    c.nome,
    c.curso_nome,
    c.data_inicio,
    c.data_fim,
    c.status,
    c.vagas,
    coalesce((
      SELECT count(*)::int
      FROM public.formacao_inscricoes fi
      WHERE fi.cohort_id = c.id
        AND fi.estado IN ('pre_inscrito', 'inscrito')
        AND fi.cancelled_at IS NULL
    ), 0)
  FROM public.escolas e
  JOIN public.formacao_cohorts c
    ON c.escola_id = e.id
  WHERE e.slug = btrim(lower(p_escola_slug))
    AND (c.id::text = btrim(p_cohort_ref) OR upper(c.codigo) = upper(btrim(p_cohort_ref)))
    AND c.status IN ('planeada', 'aberta', 'em_andamento')
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.formacao_self_service_resolve_target(text, text) TO anon, authenticated;
