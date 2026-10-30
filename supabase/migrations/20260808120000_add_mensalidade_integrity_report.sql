-- Relatório read-only para validação de mensalidades por matrícula,
-- calendário escolar e regra de mês final para classes de exame.
CREATE OR REPLACE FUNCTION public.audit_mensalidades_integrity(
  p_escola_id uuid,
  p_ano_letivo integer
)
RETURNS TABLE (
  check_name text,
  severity text,
  total bigint,
  details jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  -- Only signed service-role calls may bypass an interactive tenant context.
  v_service_role boolean := coalesce(auth.jwt()->>'role', '') = 'service_role';
BEGIN
  IF p_escola_id IS NULL OR p_ano_letivo IS NULL
     OR p_ano_letivo NOT BETWEEN 1900 AND 2100 THEN
    RAISE EXCEPTION 'INVALID_SCOPE: escola e ano letivo obrigatórios'
      USING ERRCODE = '22023';
  END IF;

  IF NOT v_service_role THEN
    IF p_escola_id IS DISTINCT FROM public.current_tenant_escola_id()
       OR NOT coalesce(public.user_has_role_in_school(
         p_escola_id,
         ARRAY['admin','admin_escola','staff_admin','diretor',
               'admin_financeiro','secretaria_financeiro','secretaria']::text[]
       ), false) THEN
      RAISE EXCEPTION 'AUTH: acesso à auditoria financeira não autorizado'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN QUERY
  SELECT 'mensalidades_sem_matricula',
    CASE WHEN count(*) > 0 THEN 'CRITICAL' ELSE 'PASS' END,
    count(*)::bigint,
    jsonb_build_object('ano_letivo', p_ano_letivo)
  FROM public.mensalidades f
  LEFT JOIN public.matriculas m ON m.id = f.matricula_id
  WHERE f.escola_id = p_escola_id
    AND f.ano_letivo = p_ano_letivo::text
    AND m.id IS NULL;

  RETURN QUERY
  SELECT 'mensalidades_ano_desalinhado',
    CASE WHEN count(*) > 0 THEN 'CRITICAL' ELSE 'PASS' END,
    count(*)::bigint,
    jsonb_build_object('ano_letivo', p_ano_letivo)
  FROM public.mensalidades f
  JOIN public.matriculas m ON m.id = f.matricula_id
  WHERE f.escola_id = p_escola_id
    AND f.ano_letivo = p_ano_letivo::text
    AND m.escola_id = p_escola_id
    AND m.ano_letivo <> p_ano_letivo;

  RETURN QUERY
  SELECT 'mensalidades_fora_calendario',
    CASE WHEN count(*) > 0 THEN 'HIGH' ELSE 'PASS' END,
    count(*)::bigint,
    jsonb_build_object('ano_letivo', p_ano_letivo)
  FROM public.mensalidades f
  JOIN public.anos_letivos al
    ON al.escola_id = f.escola_id
   AND al.ano = p_ano_letivo
  WHERE f.escola_id = p_escola_id
    AND f.ano_letivo = p_ano_letivo::text
    AND make_date(f.ano_referencia, f.mes_referencia, 1)
        NOT BETWEEN date_trunc('month', al.data_inicio)::date
            AND date_trunc('month', al.data_fim)::date;

  RETURN QUERY
  SELECT 'mes_final_em_classe_normal',
    CASE WHEN count(*) > 0 THEN 'HIGH' ELSE 'PASS' END,
    count(*)::bigint,
    jsonb_build_object('ano_letivo', p_ano_letivo)
  FROM public.mensalidades f
  JOIN public.matriculas m ON m.id = f.matricula_id
  JOIN public.anos_letivos al ON al.escola_id = f.escola_id AND al.ano = p_ano_letivo
  WHERE f.escola_id = p_escola_id
    AND f.ano_letivo = p_ano_letivo::text
    AND make_date(f.ano_referencia, f.mes_referencia, 1) = date_trunc('month', al.data_fim)::date
    AND NOT public.is_turma_classe_exame(m.turma_id);

  RETURN QUERY
  SELECT 'mes_final_em_classe_exame_em_falta',
    CASE WHEN count(*) > 0 THEN 'HIGH' ELSE 'PASS' END,
    count(*)::bigint,
    jsonb_build_object('ano_letivo', p_ano_letivo)
  FROM public.matriculas m
  JOIN public.anos_letivos al ON al.escola_id = m.escola_id AND al.ano = p_ano_letivo
  WHERE m.escola_id = p_escola_id
    AND m.ano_letivo = p_ano_letivo
    AND public.is_turma_classe_exame(m.turma_id)
    AND NOT EXISTS (
      SELECT 1
      FROM public.mensalidades f
      WHERE f.escola_id = m.escola_id
        AND f.matricula_id = m.id
        AND f.ano_referencia = extract(year FROM al.data_fim)::int
        AND f.mes_referencia = extract(month FROM al.data_fim)::int
    );
END;
$$;

REVOKE ALL ON FUNCTION public.audit_mensalidades_integrity(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.audit_mensalidades_integrity(uuid, integer) TO authenticated, service_role;
