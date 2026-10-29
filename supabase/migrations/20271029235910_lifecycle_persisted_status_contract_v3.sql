-- Contract v3: stored matricula status is administrative, academic result lives in historico_anos.
BEGIN;
SET LOCAL lock_timeout='5s';

CREATE OR REPLACE FUNCTION public.canonicalize_matricula_status_text(input text)
RETURNS text LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE SET search_path TO 'pg_catalog','public'
AS $canonical$
DECLARE v text := lower(btrim(coalesce(input,'')));
BEGIN
 IF v IN ('ativo','ativa','active','em_andamento','matriculado') THEN RETURN 'ativo'; END IF;
 IF v IN ('concluido','concluida','encerrado','encerrada') THEN RETURN 'concluido'; END IF;
 IF v IN ('pendente','aguardando') THEN RETURN 'pendente'; END IF;
 IF v IN ('rascunho','transferido','anulado','trancado','desistente') THEN RETURN v; END IF;
 IF v='transferida' THEN RETURN 'transferido'; END IF;
 IF v='anulada' THEN RETURN 'anulado'; END IF;
 IF v IN ('reprovado','reprovada','reprovado_por_faltas','aprovado','aprovada','graduado','graduada') THEN
   RAISE EXCEPTION 'ACADEMIC_RESULT_NOT_ENROLLMENT_STATUS: resultado pertence ao historico (%)',v USING ERRCODE='23514';
 END IF;
 RAISE EXCEPTION 'MATRICULA_STATUS_INVALID: valor invalido (%)',coalesce(nullif(v,''),'<vazio>') USING ERRCODE='23514';
END;
$canonical$;

CREATE OR REPLACE FUNCTION public.matriculas_status_before_ins_upd()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'pg_catalog','public'
AS $status_write$
BEGIN
 NEW.status := public.canonicalize_matricula_status_text(NEW.status);
 RETURN NEW;
END;
$status_write$;

CREATE OR REPLACE FUNCTION public.finalizar_matricula_blindada(p_escola_id uuid, p_matricula_id uuid, p_motivo text DEFAULT NULL::text, p_is_override_manual boolean DEFAULT false, p_status_override text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    IF v_status_calculado NOT IN ('transferido', 'anulado') THEN
      RAISE EXCEPTION 'LOGIC: Override inválido. Use transferido ou anulado. Reprovacao por faltas exige decisao academica documentada.';
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
      v_status_calculado := 'concluido';
    ELSE
      RAISE EXCEPTION 'LOGIC: Situação final desconhecida retornada pelo GradeEngine.';
    END IF;

    v_origem := 'gradeengine';
  END IF;

  IF v_origem='gradeengine' AND EXISTS (
    SELECT 1 FROM public.historico_anos h
    WHERE h.escola_id=v_escola_id AND h.matricula_id=p_matricula_id
      AND h.resultado_final IS DISTINCT FROM v_grade->>'situacao_final'
  ) THEN
    RAISE EXCEPTION 'ACADEMIC_RESULT_CONFLICT: historico diverge do GradeEngine' USING ERRCODE='23514';
  END IF;
  UPDATE public.matriculas
  SET status = v_status_calculado,
      ativo = false,
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
      'resultado_academico', CASE WHEN v_origem='gradeengine' THEN v_grade->>'situacao_final' ELSE NULL END,
      'origem', v_origem,
      'motivo', NULLIF(trim(p_motivo), '')
    )
  );

  IF v_status_calculado = 'concluido' THEN
    PERFORM public.gerar_historico_anual(p_matricula_id);

    -- A decisão calculada pelo GradeEngine é a autoridade académica.
    -- O status da matrícula continua apenas a fechar o vínculo administrativo.
    IF v_origem = 'gradeengine' THEN
      UPDATE public.historico_anos
         SET resultado_final = v_grade->>'situacao_final',
             status_final = v_grade->>'situacao_final'
       WHERE escola_id = v_escola_id
         AND matricula_id = p_matricula_id
         AND snapshot_status = 'aberto';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'status', v_status_calculado,
    'resultado_academico', CASE WHEN v_origem='gradeengine' THEN v_grade->>'situacao_final' ELSE NULL END,
    'status_fecho_origem', v_origem
  );
END;
$function$


CREATE OR REPLACE FUNCTION public.finalizar_origem_academica(p_escola_id uuid, p_matricula_id uuid, p_resultado_final text, p_fonte text DEFAULT 'raa'::text, p_motivo text DEFAULT NULL::text, p_observacao text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_actor_id uuid := public.safe_auth_uid();
  v_matricula public.matriculas%ROWTYPE;
  v_historico public.historico_anos%ROWTYPE;
  v_raa jsonb;
  v_decision text;
  v_ano_destino integer;
  v_resultado text := lower(btrim(coalesce(p_resultado_final,'')));
  v_fonte text := lower(btrim(coalesce(p_fonte,'')));
  v_status text;
  v_old_result text;
  v_cohort_exists boolean;
  v_motivo text;
BEGIN
  IF v_actor_id IS NULL OR public.current_tenant_escola_id() IS DISTINCT FROM p_escola_id
    OR NOT public.user_has_role_in_school(p_escola_id, ARRAY['admin','admin_escola','staff_admin','secretaria']::text[]) THEN
    RAISE EXCEPTION 'AUTH: escola ou utilizador sem autorização' USING ERRCODE='42501';
  END IF;

  IF v_resultado NOT IN ('aprovado','reprovado','concluido')
     OR v_fonte NOT IN ('raa','declaracao_administrativa_escola') THEN
    RAISE EXCEPTION 'ACADEMIC_EVIDENCE_INVALID: resultado ou fonte inválida' USING ERRCODE='23514';
  END IF;

  SELECT * INTO v_matricula FROM public.matriculas
  WHERE id=p_matricula_id AND escola_id=p_escola_id FOR UPDATE;
  IF NOT FOUND OR v_matricula.ano_letivo IS NULL OR v_matricula.turma_id IS NULL
      OR v_matricula.session_id IS NULL THEN
    RAISE EXCEPTION 'ACADEMIC_SOURCE_REQUIRED: origem, turma e ano letivo são obrigatórios' USING ERRCODE='23514';
  END IF;
  v_ano_destino := v_matricula.ano_letivo+1;
  v_motivo := coalesce(nullif(btrim(p_motivo),''),
    CASE WHEN v_fonte='raa' THEN 'Progressão académica confirmada pela decisão oficial do RAA' END);

  -- The cohort is *eligibility*, not a decision. Evidence and authorization
  -- must be explicitly recorded by the responsible staff member.
  IF v_fonte='declaracao_administrativa_escola' THEN
    IF length(btrim(coalesce(p_motivo,''))) < 12
       OR length(btrim(coalesce(p_observacao,''))) < 8 THEN
      RAISE EXCEPTION 'ACADEMIC_DOCUMENT_REQUIRED: informe a referência da decisão escolar no motivo e na observação' USING ERRCODE='23514';
    END IF;
    SELECT EXISTS(
      SELECT 1 FROM public.academic_transition_cohort_members cm
      JOIN public.academic_transition_cohorts c ON c.id=cm.cohort_id
      WHERE cm.escola_id=p_escola_id AND cm.matricula_origem_id=p_matricula_id
        AND cm.aluno_id=v_matricula.aluno_id AND cm.status='elegivel'
        AND c.escola_id=p_escola_id AND c.ativo=true AND c.ano_origem=v_matricula.ano_letivo
        AND c.ano_destino=v_ano_destino AND c.modo='virada_assistida_sem_notas'
        AND (c.expira_em IS NULL OR c.expira_em>=CURRENT_DATE)
    ) INTO v_cohort_exists;
    IF NOT v_cohort_exists THEN
      RAISE EXCEPTION 'ASSISTED_TRANSITION_COHORT_REQUIRED: a decisão sem notas exige coorte assistida válida' USING ERRCODE='23514';
    END IF;
  ELSE
    v_raa := public.resolve_raa_progression_for_matricula(p_escola_id,p_matricula_id);
    v_decision := lower(coalesce(v_raa->>'decision',''));
    IF (v_resultado IN ('aprovado','concluido') AND v_decision NOT IN ('transitou','aprovado','concluido','concluiu'))
       OR (v_resultado='reprovado' AND v_decision NOT IN ('retido','reprovado')) THEN
      RAISE EXCEPTION 'ACADEMIC_RAA_NOT_CONFIRMED: não há decisão de progressão compatível; resolva as pendências no RAA'
        USING ERRCODE='23514';
    END IF;
  END IF;

  SELECT * INTO v_historico FROM public.historico_anos
  WHERE escola_id=p_escola_id AND aluno_id=v_matricula.aluno_id
    AND ano_letivo=v_matricula.ano_letivo FOR UPDATE;
  IF FOUND THEN
    IF v_historico.matricula_id IS NOT NULL AND v_historico.matricula_id<>v_matricula.id
       OR coalesce(v_historico.snapshot_status,'aberto')<>'aberto' THEN
      RAISE EXCEPTION 'ACADEMIC_HISTORY_CONFLICT: histórico ligado a outra matrícula ou protegido legalmente'
        USING ERRCODE='23514';
    END IF;
    v_old_result := lower(btrim(coalesce(v_historico.resultado_final,'')));
    IF v_old_result <> '' AND v_old_result <> v_resultado THEN
      RAISE EXCEPTION 'ACADEMIC_RESULT_CONFLICT: decisão histórica divergente; requer retificação auditada'
        USING ERRCODE='23514';
    END IF;
  END IF;

  v_status := 'concluido'; -- resultado registado separadamente em historico_anos
  IF public.canonicalize_matricula_status_text(v_matricula.status) NOT IN ('pendente','ativo') THEN
    IF v_matricula.status=v_status
       AND v_historico.id IS NOT NULL AND v_historico.resultado_final=v_resultado THEN
      RETURN jsonb_build_object('ok',true,'reused',true,'historico_ano_id',v_historico.id,
        'matricula_id',p_matricula_id,'resultado_final',v_resultado,'status',v_status);
    END IF;
    RAISE EXCEPTION 'ACADEMIC_ALREADY_FINALIZED: a origem tem outro fecho; revisão auditada obrigatória'
      USING ERRCODE='23514';
  END IF;

  UPDATE public.matriculas SET
    status=v_status, ativo=false,
    motivo_fecho=v_motivo,
    status_fecho_origem=CASE WHEN v_fonte='declaracao_administrativa_escola' THEN 'override_admin' ELSE 'manual' END,
    data_fecho=coalesce(data_fecho,now()),
    updated_at=now(),
    updated_by=v_actor_id
  WHERE id=v_matricula.id AND escola_id=p_escola_id;

  INSERT INTO public.historico_anos (
    escola_id,aluno_id,ano_letivo,ano_letivo_id,turma_id,matricula_id,
    resultado_final,status_final,snapshot_status,data_fechamento
  ) VALUES (
    p_escola_id,v_matricula.aluno_id,v_matricula.ano_letivo,v_matricula.session_id,
    v_matricula.turma_id,v_matricula.id,v_resultado,v_resultado,'aberto',CURRENT_DATE
  )
  ON CONFLICT (escola_id,aluno_id,ano_letivo)
  DO UPDATE SET
    matricula_id=excluded.matricula_id,
    ano_letivo_id=excluded.ano_letivo_id,
    turma_id=excluded.turma_id,
    resultado_final=excluded.resultado_final,
    status_final=excluded.status_final,
    data_fechamento=excluded.data_fechamento
  RETURNING * INTO v_historico;

  INSERT INTO public.audit_logs (escola_id,actor_id,action,entity,entity_id,details,portal)
  VALUES (p_escola_id,v_actor_id,'MATRICULA_ORIGEM_RESULTADO_ACADEMICO_REGISTADO',
    'matriculas',p_matricula_id::text,
    jsonb_build_object('resultado_final',v_resultado,'fonte',v_fonte,
       'motivo',v_motivo,
       'observacao',NULLIF(btrim(p_observacao),''),
       'historico_ano_id',v_historico.id,'matricula_status',v_status,
       'snapshot_status','aberto','at',now()),
    'secretaria');

  RETURN jsonb_build_object('ok',true,'matricula_id',p_matricula_id,
    'historico_ano_id',v_historico.id,'resultado_final',v_resultado,
    'fonte',v_fonte,'status',v_status,'snapshot_status','aberto');
END;
$function$


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
  v_existing record;
  v_resultado text;
  v_grade jsonb;
BEGIN
  IF v_escola_id IS NULL THEN
    RAISE EXCEPTION 'AUTH: escola_id não resolvido.';
  END IF;

  SELECT * INTO v_matricula FROM public.matriculas WHERE id = p_matricula_id AND escola_id = v_escola_id;
  IF v_matricula.id IS NULL THEN
    RAISE EXCEPTION 'Matrícula com ID % não encontrada.', p_matricula_id;
  END IF;

  IF public.canonicalize_matricula_status_text(v_matricula.status)
     <> 'concluido' OR v_matricula.ativo IS DISTINCT FROM false THEN
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

  SELECT h.* INTO v_existing FROM public.historico_anos h
  WHERE h.escola_id=v_escola_id AND h.aluno_id=v_matricula.aluno_id
    AND h.ano_letivo=v_matricula.ano_letivo FOR UPDATE;
  IF v_existing.id IS NOT NULL THEN
    IF v_existing.matricula_id IS DISTINCT FROM p_matricula_id
       OR v_existing.snapshot_status='fechado' THEN
      RAISE EXCEPTION 'ACADEMIC_HISTORY_CONFLICT: historico ja vinculado ou congelado' USING ERRCODE='23514';
    END IF;
    v_resultado := v_existing.resultado_final;
  END IF;
  IF v_resultado NOT IN ('aprovado','reprovado','concluido') OR v_resultado IS NULL THEN
    v_grade := public.gradeengine_calcular_situacao(p_matricula_id);
    v_resultado := v_grade->>'situacao_final';
    IF v_resultado NOT IN ('aprovado','reprovado') OR v_resultado IS NULL THEN
      RAISE EXCEPTION 'ACADEMIC_RESULT_REQUIRED: pauta/decisao verificada obrigatoria' USING ERRCODE='23514';
    END IF;
  END IF;
  INSERT INTO public.historico_anos (escola_id, aluno_id, ano_letivo, ano_letivo_id, turma_id, matricula_id, resultado_final, status_final, snapshot_status)
  VALUES (
    v_matricula.escola_id,
    v_matricula.aluno_id,
    v_matricula.ano_letivo,
    v_matricula.session_id,
    v_matricula.turma_id,
    p_matricula_id,
    v_resultado,
    v_resultado,
    'aberto'
  )
  ON CONFLICT (escola_id, aluno_id, ano_letivo) DO UPDATE SET
    turma_id = EXCLUDED.turma_id,
    matricula_id = EXCLUDED.matricula_id,
    ano_letivo_id = EXCLUDED.ano_letivo_id,
    resultado_final = EXCLUDED.resultado_final,
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


CREATE OR REPLACE FUNCTION public.lifecycle_validate_historico_legal_lock()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_matricula public.matriculas%ROWTYPE;
  v_historico public.historico_anos%ROWTYPE;
  v_evidence boolean;
  v_grade jsonb;
BEGIN
  IF NEW.status IS DISTINCT FROM 'fechado' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_matricula FROM public.matriculas
  WHERE id=NEW.matricula_id AND escola_id=NEW.escola_id;

  IF NOT FOUND OR v_matricula.session_id IS DISTINCT FROM NEW.ano_letivo_id
     OR v_matricula.ativo IS DISTINCT FROM false
     OR v_matricula.status IS DISTINCT FROM 'concluido' THEN
    RAISE EXCEPTION 'ACADEMIC_HISTORY_NOT_FINAL: matrícula não encerrada no ano letivo correspondente'
      USING ERRCODE='23514';
  END IF;

  SELECT * INTO v_historico FROM public.historico_anos
  WHERE matricula_id=v_matricula.id AND escola_id=NEW.escola_id
    AND aluno_id=v_matricula.aluno_id AND ano_letivo=v_matricula.ano_letivo
    AND ano_letivo_id=NEW.ano_letivo_id;

  IF NOT FOUND OR v_historico.resultado_final NOT IN ('aprovado','reprovado','concluido') THEN
    RAISE EXCEPTION 'ACADEMIC_RESULT_NOT_VERIFIED: resultado e matrícula incompatíveis ou histórico inexistente'
      USING ERRCODE='23514';
  END IF;

  -- An audited school declaration is a legitimate documented source; a
  -- manually typed result with no signed audit trail is not.
  SELECT EXISTS(
    SELECT 1 FROM public.audit_logs al
    WHERE al.escola_id=NEW.escola_id AND al.entity_id=NEW.matricula_id::text
      AND al.action='MATRICULA_ORIGEM_RESULTADO_ACADEMICO_REGISTADO'
      AND al.actor_id IS NOT NULL
      AND al.details->>'resultado_final'=v_historico.resultado_final
      AND al.details->>'fonte' IN ('raa','declaracao_administrativa_escola')
      AND nullif(btrim(coalesce(al.details->>'motivo','')),'') IS NOT NULL
  ) INTO v_evidence;
  IF NOT v_evidence AND v_matricula.status_fecho_origem='gradeengine' THEN
    -- GradeEngine evaluation is authoritative only when it still matches the
    -- persisted decision. If data disappeared, a legal lock must be refused.
    v_grade := public.gradeengine_calcular_situacao(v_matricula.id);
    v_evidence := (v_grade->>'situacao_final'=v_historico.resultado_final);
  END IF;

  IF NOT v_evidence THEN
    RAISE EXCEPTION 'ACADEMIC_DECISION_EVIDENCE_REQUIRED: anexe decisão escolar auditada ou feche as pautas e execute o GradeEngine'
      USING ERRCODE='23514';
  END IF;

  IF nullif(btrim(coalesce(NEW.lock_reason,'')),'') IS NULL THEN
    RAISE EXCEPTION 'ACADEMIC_LOCK_REASON_REQUIRED: informe o motivo para congelamento legal'
      USING ERRCODE='23514';
  END IF;

  -- historico_set_snapshot_state's legacy writer did not populate this FK.
  -- Resolve it from the fully verified history, never from a client-supplied
  -- reference. This is essential to the lifecycle view's official-result gate.
  NEW.historico_ano_id := v_historico.id;
  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.ratificar_resultado_historico_escola(p_escola_id uuid, p_matricula_id uuid, p_resultado_confirmado text, p_referencia_documental text, p_motivo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_actor_id uuid := public.safe_auth_uid();
  v_m public.matriculas%ROWTYPE;
  v_h public.historico_anos%ROWTYPE;
  v_resultado text := lower(btrim(coalesce(p_resultado_confirmado,'')));
  v_ref text := btrim(coalesce(p_referencia_documental,''));
  v_motivo text := btrim(coalesce(p_motivo,''));
  v_has_cohort boolean;
  v_reused boolean;
  v_fixed boolean := false;
BEGIN
  IF v_actor_id IS NULL OR public.current_tenant_escola_id() IS DISTINCT FROM p_escola_id
     OR NOT public.user_has_role_in_school(p_escola_id,
       ARRAY['admin','admin_escola','staff_admin']::text[]) THEN
    RAISE EXCEPTION 'RATIFICATION_AUTH_FORBIDDEN: ratificação de históricos exige direção da escola'
      USING ERRCODE='42501';
  END IF;

  IF length(v_ref)<8 OR length(v_motivo)<12 THEN
    RAISE EXCEPTION 'RATIFICATION_DOCUMENT_REQUIRED: informe referência documental e motivo da ratificação'
      USING ERRCODE='23514';
  END IF;

  SELECT * INTO v_m FROM public.matriculas
  WHERE escola_id=p_escola_id AND id=p_matricula_id FOR UPDATE;
  IF NOT FOUND OR v_m.ano_letivo IS NULL OR v_m.session_id IS NULL
     OR v_m.status IS DISTINCT FROM 'concluido' OR v_m.ativo THEN
    RAISE EXCEPTION 'RATIFICATION_SOURCE_INVALID: origem sem encerramento académico válido'
      USING ERRCODE='23514';
  END IF;

  SELECT * INTO v_h FROM public.historico_anos
  WHERE escola_id=p_escola_id AND aluno_id=v_m.aluno_id
    AND matricula_id=v_m.id AND ano_letivo=v_m.ano_letivo FOR UPDATE;
  IF NOT FOUND OR v_h.snapshot_status IS DISTINCT FROM 'aberto'
      OR v_resultado NOT IN ('aprovado','reprovado','concluido')
      OR v_h.resultado_final IS DISTINCT FROM v_resultado
      OR EXISTS(SELECT 1 FROM public.historico_snapshot_locks sl
                WHERE sl.matricula_id=v_m.id AND sl.escola_id=p_escola_id AND sl.status='fechado') THEN
    RAISE EXCEPTION 'RATIFICATION_RESULT_CONFLICT: histórico não corresponde à decisão ou já está fechado'
      USING ERRCODE='23514';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.academic_transition_cohort_members cm
    JOIN public.academic_transition_cohorts c ON c.id=cm.cohort_id
    WHERE cm.escola_id=p_escola_id AND cm.matricula_origem_id=v_m.id
      AND cm.aluno_id=v_m.aluno_id AND cm.status='elegivel'
      AND c.escola_id=p_escola_id AND c.ativo AND c.ano_origem=v_m.ano_letivo
      AND c.ano_destino=v_m.ano_letivo+1 AND c.modo='virada_assistida_sem_notas'
      AND (c.expira_em IS NULL OR c.expira_em>=CURRENT_DATE)
  ) INTO v_has_cohort;
  IF NOT v_has_cohort THEN
    RAISE EXCEPTION 'RATIFICATION_COHORT_REQUIRED: não existe coorte histórica autorizada'
      USING ERRCODE='23514';
  END IF;

  -- Historical import might have left its session link null.
  IF v_h.ano_letivo_id IS DISTINCT FROM v_m.session_id THEN
    IF v_h.ano_letivo_id IS NOT NULL THEN
      RAISE EXCEPTION 'RATIFICATION_YEAR_CONFLICT: histórico aponta para outro ano letivo'
        USING ERRCODE='23514';
    END IF;
    UPDATE public.historico_anos SET ano_letivo_id=v_m.session_id
    WHERE id=v_h.id AND escola_id=p_escola_id AND ano_letivo_id IS NULL;
  END IF;

  -- Uma matrícula concluída pode ter resultado académico reprovado.
  v_fixed := false;

  SELECT EXISTS(
    SELECT 1 FROM public.audit_logs a
    WHERE a.escola_id=p_escola_id AND a.entity_id=v_m.id::text
      AND a.actor_id=v_actor_id
      AND a.action='MATRICULA_ORIGEM_RESULTADO_ACADEMICO_REGISTADO'
      AND a.details->>'resultado_final'=v_resultado
      AND a.details->>'referencia_documental'=v_ref
      AND a.details->>'motivo'=v_motivo
  ) INTO v_reused;

  IF NOT v_reused THEN
    INSERT INTO public.audit_logs (escola_id,actor_id,action,entity,entity_id,portal,details)
    VALUES (p_escola_id,v_actor_id,'MATRICULA_ORIGEM_RESULTADO_ACADEMICO_REGISTADO',
      'matriculas',v_m.id::text,'secretaria',
      jsonb_build_object('resultado_final',v_resultado,
        'fonte','declaracao_administrativa_escola',
        'motivo',v_motivo,
        'referencia_documental',v_ref,
        'ratificacao',true,
        'status_corrigido',v_fixed,
        'historico_ano_id',v_h.id,
        'snapshot_status','aberto','at',now()));
  END IF;

  RETURN jsonb_build_object('ok',true,'reused',v_reused,'matricula_id',v_m.id,
    'historico_ano_id',v_h.id,'resultado_final',v_resultado,
    'status_corrigido',v_fixed,'snapshot_status','aberto',
    'proximo_passo','Confirmar documentação e fechar histórico pelo fluxo oficial');
END;
$function$


