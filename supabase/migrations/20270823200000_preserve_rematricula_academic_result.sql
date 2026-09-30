BEGIN;

ALTER TABLE public.promocoes_com_pendencias
  ADD COLUMN IF NOT EXISTS fonte_decisao text,
  ADD COLUMN IF NOT EXISTS observacao_decisao text;

CREATE OR REPLACE FUNCTION public.finalizar_origem_academica(
  p_escola_id uuid,
  p_matricula_id uuid,
  p_resultado_final text,
  p_fonte text DEFAULT 'raa',
  p_motivo text DEFAULT NULL,
  p_observacao text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor_id uuid := public.safe_auth_uid();
  v_matricula public.matriculas%ROWTYPE;
  v_ano integer;
  v_resultado text := lower(trim(coalesce(p_resultado_final, '')));
  v_fonte text := lower(trim(coalesce(p_fonte, 'raa')));
  v_historico_id uuid;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'AUTH: not_authenticated';
  END IF;
  IF public.current_tenant_escola_id() IS DISTINCT FROM p_escola_id
     OR NOT public.user_has_role_in_school(
       p_escola_id,
       ARRAY['admin','admin_escola','staff_admin','admin_secretaria','diretor','secretaria']
     ) THEN
    RAISE EXCEPTION 'AUTH: forbidden';
  END IF;
  IF v_resultado NOT IN ('aprovado', 'reprovado', 'concluido') THEN
    RAISE EXCEPTION 'DATA: resultado_final inválido';
  END IF;
  IF v_fonte = 'declaracao_administrativa_escola'
     AND COALESCE(NULLIF(trim(p_motivo), ''), '') = '' THEN
    RAISE EXCEPTION 'DATA: motivo obrigatório para declaração administrativa';
  END IF;

  SELECT * INTO v_matricula
  FROM public.matriculas
  WHERE id = p_matricula_id
    AND escola_id = p_escola_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DATA: matrícula de origem não encontrada';
  END IF;
  v_ano := v_matricula.ano_letivo;
  IF v_ano IS NULL OR v_matricula.turma_id IS NULL THEN
    RAISE EXCEPTION 'DATA: matrícula sem ano letivo ou turma para histórico';
  END IF;

  INSERT INTO public.historico_anos (
    escola_id, aluno_id, ano_letivo, turma_id, resultado_final, data_fechamento
  ) VALUES (
    p_escola_id, v_matricula.aluno_id, v_ano, v_matricula.turma_id,
    v_resultado, current_date
  )
  ON CONFLICT (escola_id, aluno_id, ano_letivo)
  DO UPDATE SET
    turma_id = EXCLUDED.turma_id,
    resultado_final = EXCLUDED.resultado_final,
    data_fechamento = EXCLUDED.data_fechamento;

  SELECT id INTO v_historico_id
  FROM public.historico_anos
  WHERE escola_id = p_escola_id
    AND aluno_id = v_matricula.aluno_id
    AND ano_letivo = v_ano;

  UPDATE public.matriculas
  SET status = 'concluido',
      ativo = false,
      motivo_fecho = COALESCE(NULLIF(trim(p_motivo), ''), 'Ano letivo encerrado com resultado académico'),
      data_fecho = COALESCE(data_fecho, now()),
      updated_at = now()
  WHERE id = p_matricula_id
    AND escola_id = p_escola_id;

  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, details, portal)
  VALUES (
    p_escola_id, v_actor_id, 'MATRICULA_ORIGEM_RESULTADO_ACADEMICO_REGISTADO',
    'matriculas', p_matricula_id::text,
    jsonb_build_object(
      'resultado_final', v_resultado,
      'fonte', v_fonte,
      'motivo', NULLIF(trim(p_motivo), ''),
      'observacao', NULLIF(trim(p_observacao), ''),
      'historico_ano_id', v_historico_id,
      'matricula_status', 'concluido',
      'at', now()
    ),
    'secretaria'
  );

  RETURN jsonb_build_object(
    'ok', true,
    'matricula_id', p_matricula_id,
    'historico_ano_id', v_historico_id,
    'resultado_final', v_resultado,
    'fonte', v_fonte,
    'status', 'concluido'
  );
END;
$$;

ALTER FUNCTION public.finalizar_origem_academica(uuid, uuid, text, text, text, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.finalizar_origem_academica(uuid, uuid, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalizar_origem_academica(uuid, uuid, text, text, text, text) TO authenticated, service_role;

COMMIT;
