BEGIN;

CREATE OR REPLACE FUNCTION public.admissao_turma_ocupacao_reservada(
  p_escola_id uuid,
  p_turma_id uuid,
  p_excluir_candidatura_id uuid DEFAULT NULL::uuid
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH matriculas_ativas AS (
    SELECT count(*)::integer AS total
    FROM public.matriculas m
    WHERE m.escola_id = p_escola_id
      AND m.turma_id = p_turma_id
      AND lower(coalesce(m.status, '')) IN ('ativa', 'ativo', 'active')
  ),
  reservas_validas AS (
    SELECT count(*)::integer AS total
    FROM public.candidaturas c
    WHERE c.escola_id = p_escola_id
      AND c.turma_preferencial_id = p_turma_id
      AND lower(coalesce(c.status, '')) = 'aguardando_pagamento'
      AND coalesce(c.expires_at, now() - interval '1 second') > now()
      AND (
        p_excluir_candidatura_id IS NULL
        OR c.id IS DISTINCT FROM p_excluir_candidatura_id
      )
  )
  SELECT coalesce(matriculas_ativas.total, 0) + coalesce(reservas_validas.total, 0)
  FROM matriculas_ativas, reservas_validas;
$$;

REVOKE ALL ON FUNCTION public.admissao_turma_ocupacao_reservada(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admissao_turma_ocupacao_reservada(uuid, uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.admissao_turma_ocupacao_reservada(uuid, uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admissao_turma_ocupacao_reservada(uuid, uuid, uuid) TO service_role;

DO $$
DECLARE
  v_function_sql text;
BEGIN
  SELECT pg_get_functiondef(
    'public.admissao_finalizar_matricula(uuid,uuid,uuid,jsonb,text,text,boolean,text)'::regprocedure
  )
  INTO v_function_sql;

  IF v_function_sql IS NULL THEN
    RAISE EXCEPTION 'Função admissao_finalizar_matricula com override não encontrada.';
  END IF;

  v_function_sql := replace(
    v_function_sql,
    $old$
  SELECT count(*)::integer
  INTO v_matriculados_ativos
  FROM public.matriculas m
  WHERE m.escola_id = p_escola_id
    AND m.turma_id = p_turma_id
    AND lower(coalesce(m.status, '')) IN ('ativa', 'ativo', 'active');
$old$,
    $new$
  SELECT public.admissao_turma_ocupacao_reservada(
    p_escola_id,
    p_turma_id,
    p_candidatura_id
  )
  INTO v_matriculados_ativos;
$new$
  );

  IF v_function_sql NOT LIKE '%admissao_turma_ocupacao_reservada%' THEN
    RAISE EXCEPTION 'Não foi possível inserir ocupação com reservas em admissao_finalizar_matricula.';
  END IF;

  EXECUTE v_function_sql;
END $$;

COMMIT;
