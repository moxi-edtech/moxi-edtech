-- Applied to KLASSE Supabase as 20261028211752.
CREATE OR REPLACE FUNCTION public.gerar_historico_anual(p_matricula_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_matricula record;
  v_historico_ano_id uuid;
  boletim_row record;
  v_escola_id uuid := public.current_tenant_escola_id();
  v_has_permission boolean;
  v_snapshot_lock record;
BEGIN
  IF v_escola_id IS NULL THEN
    RAISE EXCEPTION 'AUTH: escola_id não resolvido.';
  END IF;

  SELECT * INTO v_matricula FROM public.matriculas WHERE id = p_matricula_id AND escola_id = v_escola_id;
  IF v_matricula.id IS NULL THEN
    RAISE EXCEPTION 'Matrícula com ID % não encontrada.', p_matricula_id;
  END IF;

  IF public.canonicalize_matricula_status_text(v_matricula.status)
     NOT IN ('concluido','reprovado') OR v_matricula.ativo IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'LIFECYCLE_HISTORY_NOT_FINAL: matrícula sem fecho académico confirmado' USING ERRCODE='23514';
  END IF;

  SELECT public.user_has_role_in_school(v_escola_id, ARRAY['secretaria', 'admin', 'admin_escola'])
  INTO v_has_permission;
  IF NOT v_has_permission THEN
    RAISE EXCEPTION 'AUTH: Permissão negada.';
  END IF;

  SELECT hsl.* INTO v_snapshot_lock
  FROM public.historico_snapshot_locks hsl
  WHERE hsl.escola_id = v_escola_id
    AND hsl.matricula_id = p_matricula_id
  ORDER BY hsl.updated_at DESC
  LIMIT 1;

  IF v_snapshot_lock.id IS NOT NULL AND v_snapshot_lock.status = 'fechado' THEN
    RAISE EXCEPTION 'LEGAL_LOCK: Histórico legal já congelado para esta matrícula. Reabertura auditada obrigatória.';
  END IF;

  INSERT INTO public.historico_anos (escola_id, aluno_id, ano_letivo, ano_letivo_id, turma_id, matricula_id, status_final, snapshot_status)
  VALUES (
    v_matricula.escola_id,
    v_matricula.aluno_id,
    v_matricula.ano_letivo,
    v_matricula.session_id,
    v_matricula.turma_id,
    p_matricula_id,
    v_matricula.status,
    'aberto'
  )
  ON CONFLICT (escola_id, aluno_id, ano_letivo) DO UPDATE SET
    turma_id = EXCLUDED.turma_id,
    matricula_id = EXCLUDED.matricula_id,
    ano_letivo_id = EXCLUDED.ano_letivo_id,
    status_final = EXCLUDED.status_final
  RETURNING id INTO v_historico_ano_id;

  FOR boletim_row IN
    SELECT *
    FROM public.vw_boletim_por_matricula
    WHERE matricula_id = p_matricula_id
  LOOP
    INSERT INTO public.historico_disciplinas (
      historico_ano_id,
      disciplina_id,
      disciplina_nome,
      nota_final,
      status_final,
      notas_detalhe
    )
    VALUES (
      v_historico_ano_id,
      boletim_row.disciplina_id,
      boletim_row.disciplina_nome,
      boletim_row.nota_final,
      CASE
        WHEN boletim_row.nota_final >= 9.5 THEN 'aprovado'
        ELSE 'reprovado'
      END,
      boletim_row.notas_por_tipo
    )
    ON CONFLICT (historico_ano_id, disciplina_id) DO UPDATE SET
      disciplina_nome = EXCLUDED.disciplina_nome,
      nota_final = EXCLUDED.nota_final,
      status_final = EXCLUDED.status_final,
      notas_detalhe = EXCLUDED.notas_detalhe;
  END LOOP;

  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details)
  VALUES (
    v_matricula.escola_id,
    auth.uid(),
    'HISTORICO_ANUAL_GERADO',
    'historico_anos',
    v_historico_ano_id::text,
    'system',
    jsonb_build_object(
      'matricula_id', p_matricula_id,
      'status_final_matricula', v_matricula.status,
      'snapshot_status', 'aberto'
    )
  );

  RETURN v_historico_ano_id;
END;
$function$
