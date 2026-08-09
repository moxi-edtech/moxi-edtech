CREATE OR REPLACE FUNCTION public.audit_rematricula_integrity(
  p_escola_id uuid,
  p_ano_letivo_id uuid DEFAULT NULL
)
RETURNS TABLE (
  check_name text,
  severity text,
  total bigint,
  scope text,
  details jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ano integer;
BEGIN
  SELECT al.ano INTO v_ano
  FROM public.anos_letivos al
  WHERE al.escola_id = p_escola_id
    AND (p_ano_letivo_id IS NULL OR al.id = p_ano_letivo_id)
  ORDER BY al.ativo DESC, al.ano DESC
  LIMIT 1;

  IF v_ano IS NULL THEN
    RAISE EXCEPTION 'Ano letivo não encontrado para a escola';
  END IF;

  RETURN QUERY
  SELECT 'duplicados_matricula_ano',
         CASE WHEN count(*) > 0 THEN 'CRITICAL' ELSE 'PASS' END,
         count(*)::bigint,
         'ano_atual',
         jsonb_build_object('ano_letivo', v_ano)
  FROM (
    SELECT m.aluno_id
    FROM public.matriculas m
    WHERE m.escola_id = p_escola_id
      AND m.ano_letivo = v_ano
      AND lower(coalesce(m.status, '')) IN ('ativo', 'ativa', 'active', 'pendente', 'aprovado', 'aprovada')
    GROUP BY m.aluno_id
    HAVING count(*) > 1
  ) duplicates;

  RETURN QUERY
  SELECT 'mensalidades_sem_matricula',
         CASE WHEN count(*) > 0 THEN 'CRITICAL' ELSE 'PASS' END,
         count(*)::bigint,
         'ano_atual',
         jsonb_build_object('ano_letivo', v_ano)
  FROM public.mensalidades f
  LEFT JOIN public.matriculas m ON m.id = f.matricula_id
  WHERE f.escola_id = p_escola_id
    AND f.ano_letivo = v_ano::text
    AND m.id IS NULL;

  RETURN QUERY
  SELECT 'mensalidades_ano_desalinhado',
         CASE WHEN count(*) > 0 THEN 'CRITICAL' ELSE 'PASS' END,
         count(*)::bigint,
         'ano_atual',
         jsonb_build_object('ano_letivo', v_ano)
  FROM public.mensalidades f
  JOIN public.matriculas m ON m.id = f.matricula_id
  WHERE f.escola_id = p_escola_id
    AND f.ano_letivo = v_ano::text
    AND m.escola_id = p_escola_id
    AND m.ano_letivo <> v_ano;

  RETURN QUERY
  SELECT 'mensalidades_turma_desalinhada',
         CASE WHEN count(*) > 0 THEN 'HIGH' ELSE 'PASS' END,
         count(*)::bigint,
         'ano_atual',
         jsonb_build_object('ano_letivo', v_ano)
  FROM public.mensalidades f
  JOIN public.matriculas m ON m.id = f.matricula_id
  WHERE f.escola_id = p_escola_id
    AND f.ano_letivo = v_ano::text
    AND f.turma_id IS NOT NULL
    AND f.turma_id IS DISTINCT FROM m.turma_id;

  RETURN QUERY
  SELECT 'mensalidades_duplicadas_mes',
         CASE WHEN count(*) > 0 THEN 'HIGH' ELSE 'PASS' END,
         count(*)::bigint,
         'ano_atual',
         jsonb_build_object('ano_letivo', v_ano)
  FROM (
    SELECT f.matricula_id, f.ano_referencia, f.mes_referencia
    FROM public.mensalidades f
    WHERE f.escola_id = p_escola_id
      AND f.ano_letivo = v_ano::text
    GROUP BY f.matricula_id, f.ano_referencia, f.mes_referencia
    HAVING count(*) > 1
  ) duplicates;

  RETURN QUERY
  SELECT 'transicoes_com_origem_inexistente',
         CASE WHEN count(*) > 0 THEN 'CRITICAL' ELSE 'PASS' END,
         count(*)::bigint,
         'ano_atual',
         jsonb_build_object('ano_letivo', v_ano)
  FROM public.matriculas destino
  LEFT JOIN public.matriculas origem ON origem.id = destino.origem_transicao_matricula_id
  WHERE destino.escola_id = p_escola_id
    AND destino.ano_letivo = v_ano
    AND destino.origem_transicao_matricula_id IS NOT NULL
    AND origem.id IS NULL;

  RETURN QUERY
  SELECT 'origens_legadas_sem_destino',
         CASE WHEN count(*) > 0 THEN 'WARN' ELSE 'PASS' END,
         count(*)::bigint,
         'historico',
         jsonb_build_object('observacao', 'Registos transferidos sem origem_transicao_matricula_id; não são alterados automaticamente')
  FROM public.matriculas origem
  WHERE origem.escola_id = p_escola_id
    AND lower(coalesce(origem.status, '')) = 'transferido'
    AND NOT EXISTS (
      SELECT 1
      FROM public.matriculas destino
      WHERE destino.escola_id = origem.escola_id
        AND destino.origem_transicao_matricula_id = origem.id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.audit_rematricula_integrity(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.audit_rematricula_integrity(uuid, uuid) TO authenticated, service_role;
