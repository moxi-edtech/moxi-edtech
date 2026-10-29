-- Applied to KLASSE Supabase as 20261028212124.
DO $reconcile$
DECLARE h record; v_matricula uuid; v_count integer;
BEGIN
  FOR h IN SELECT id, escola_id, aluno_id, ano_letivo, turma_id
    FROM public.historico_anos WHERE matricula_id IS NULL FOR UPDATE
  LOOP
    SELECT count(*)::integer, (array_agg(m.id))[1]
      INTO v_count, v_matricula
    FROM public.matriculas m
    WHERE m.escola_id=h.escola_id AND m.aluno_id=h.aluno_id
      AND m.ano_letivo=h.ano_letivo AND m.turma_id=h.turma_id
      AND m.ativo=false AND m.status='concluido';
    IF v_count <> 1 THEN
      RAISE EXCEPTION 'LIFECYCLE_MANUAL_REVIEW_REQUIRED: origem histórica não é única'
        USING ERRCODE='23514';
    END IF;
    UPDATE public.historico_anos SET matricula_id=v_matricula
    WHERE id=h.id AND matricula_id IS NULL;
    INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details)
    VALUES (h.escola_id, NULL, 'LIFECYCLE_HISTORY_LINK_RECONCILED',
      'historico_anos', h.id::text, 'system',
      jsonb_build_object('matricula_id',v_matricula,'school_year',h.ano_letivo,
        'reason','unique_school_student_year_class_link',
        'academic_result_changed',false,'snapshot_status_changed',false));
  END LOOP;
END;
$reconcile$;

ALTER TABLE public.historico_anos VALIDATE CONSTRAINT chk_lifecycle_historico_com_matricula;
