BEGIN;

CREATE OR REPLACE FUNCTION public.finalizar_matricula_blindada(
  p_escola_id uuid,
  p_matricula_id uuid,
  p_motivo text DEFAULT NULL::text,
  p_is_override_manual boolean DEFAULT false,
  p_status_override text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_escola_id uuid := public.current_tenant_escola_id();
  v_actor_id uuid := auth.uid();
  v_matricula record;
  v_has_role boolean := false;
  v_is_admin boolean := false;
  v_status_calculado text;
  v_origem text;
  v_grade jsonb;
BEGIN
  IF v_escola_id IS NULL OR p_escola_id IS DISTINCT FROM v_escola_id THEN
    RAISE EXCEPTION 'AUTH: escola_id inválido.';
  END IF;

  SELECT public.user_has_role_in_school(v_escola_id, ARRAY['secretaria', 'admin', 'admin_escola', 'staff_admin']) INTO v_has_role;
  IF NOT v_has_role THEN
    RAISE EXCEPTION 'AUTH: Permissão negada.';
  END IF;

  SELECT * INTO v_matricula
  FROM public.matriculas
  WHERE id = p_matricula_id
    AND escola_id = v_escola_id
  FOR UPDATE;

  IF v_matricula.id IS NULL THEN
    RAISE EXCEPTION 'DATA: Matrícula não encontrada.';
  END IF;

  IF public.canonicalize_matricula_status_text(v_matricula.status) NOT IN ('ativo', 'pendente') THEN
    RAISE EXCEPTION 'LOGIC: Esta matrícula já foi finalizada ou não está em andamento.';
  END IF;

  IF p_is_override_manual THEN
    SELECT public.user_has_role_in_school(v_escola_id, ARRAY['admin', 'admin_escola', 'staff_admin']) INTO v_is_admin;
    IF NOT v_is_admin THEN
      RAISE EXCEPTION 'AUTH: Apenas admin/direção pode aplicar override manual.';
    END IF;

    IF p_status_override IS NULL THEN
      RAISE EXCEPTION 'LOGIC: status_override é obrigatório quando override manual está activo.';
    END IF;

    v_status_calculado := public.canonicalize_matricula_status_text(p_status_override);
    IF v_status_calculado NOT IN ('transferido', 'anulado', 'reprovado_por_faltas') THEN
      RAISE EXCEPTION 'LOGIC: Override inválido. Use transferido, anulado ou reprovado_por_faltas.';
    END IF;
    v_origem := 'override_admin';
  ELSE
    v_grade := public.gradeengine_calcular_situacao(p_matricula_id);

    IF COALESCE(v_grade->>'situacao_final', '') = 'incompleto' THEN
      RETURN jsonb_build_object(
        'ok', false,
        'status', 'incompleto',
        'message', 'Não é possível finalizar. Existem disciplinas sem notas lançadas ou pautas abertas.',
        'motivos', COALESCE(v_grade->'motivos', '[]'::jsonb)
      );
    END IF;

    IF v_grade->>'situacao_final' = 'aprovado' THEN
      v_status_calculado := 'concluido';
    ELSIF v_grade->>'situacao_final' = 'reprovado' THEN
      v_status_calculado := 'reprovado';
    ELSE
      RAISE EXCEPTION 'LOGIC: Situação final desconhecida retornada pelo GradeEngine.';
    END IF;

    v_origem := 'gradeengine';
  END IF;

  UPDATE public.matriculas
  SET status = v_status_calculado,
      motivo_fecho = NULLIF(trim(p_motivo), ''),
      data_fecho = now(),
      status_fecho_origem = v_origem,
      updated_at = now()
  WHERE id = p_matricula_id
    AND escola_id = v_escola_id
    AND public.canonicalize_matricula_status_text(status) IN ('ativo', 'pendente');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LOGIC: Conflito de concorrência ao finalizar matrícula.';
  END IF;

  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details)
  VALUES (
    v_escola_id,
    v_actor_id,
    'MATRICULA_FINALIZADA_BLINDADA',
    'matriculas',
    p_matricula_id::text,
    'secretaria',
    jsonb_build_object(
      'status', v_status_calculado,
      'origem', v_origem,
      'motivo', NULLIF(trim(p_motivo), '')
    )
  );

  IF v_status_calculado IN ('concluido', 'reprovado') THEN
    PERFORM public.gerar_historico_anual(p_matricula_id);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'status', v_status_calculado,
    'status_fecho_origem', v_origem
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalizar_matricula_blindada(uuid, uuid, text, boolean, text) TO authenticated;

COMMIT;
