-- Fix: incluir status 'aberta' na resolução de target para auto-inscrição (Via C / Self-service)

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
  vagas integer
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
    c.vagas
  FROM public.escolas e
  JOIN public.formacao_cohorts c
    ON c.escola_id = e.id
  WHERE e.slug = btrim(lower(p_escola_slug))
    AND (c.id::text = btrim(p_cohort_ref) OR upper(c.codigo) = upper(btrim(p_cohort_ref)))
    AND c.status IN ('planeada', 'aberta', 'em_andamento')
  LIMIT 1;
END;
$$;
