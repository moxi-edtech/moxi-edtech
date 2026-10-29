-- KLASSE: academic evidence and legal history close guards.
-- NOT fiscal: no AGT, invoicing, tax, or finance objects are modified.
--
-- Only a signed school declaration within a valid assisted-transition cohort,
-- or an eligible RAA decision, can finalize a historical source enrollment.
-- An enrollment transition alone never proves academic approval.

CREATE OR REPLACE FUNCTION public.finalizar_origem_academica(
  p_escola_id uuid,
  p_matricula_id uuid,
  p_resultado_final text,
  p_fonte text DEFAULT 'raa',
  p_motivo text DEFAULT NULL,
  p_observacao text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','public'
AS $academic_evidence$
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

  v_status := CASE WHEN v_resultado='reprovado' THEN 'reprovado' ELSE 'concluido' END;
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
    motivo_fecho=btrim(p_motivo),
    status_fecho_origem=v_fonte,
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
       'motivo',NULLIF(btrim(p_motivo),''),
       'observacao',NULLIF(btrim(p_observacao),''),
       'historico_ano_id',v_historico.id,'matricula_status',v_status,
       'snapshot_status','aberto','at',now()),
    'secretaria');

  RETURN jsonb_build_object('ok',true,'matricula_id',p_matricula_id,
    'historico_ano_id',v_historico.id,'resultado_final',v_resultado,
    'fonte',v_fonte,'status',v_status,'snapshot_status','aberto');
END;
$academic_evidence$;

-- The legal lock is the ONLY authority that publishes academic results.
-- Block phantom locks, pending enrollments and contradictory results before
-- historico_set_snapshot_state can persist a "fechado" transition.
CREATE OR REPLACE FUNCTION public.lifecycle_validate_historico_legal_lock()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','public'
AS $history_legal_guard$
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
     OR v_matricula.status NOT IN ('concluido','reprovado') THEN
    RAISE EXCEPTION 'ACADEMIC_HISTORY_NOT_FINAL: matrícula não encerrada no ano letivo correspondente'
      USING ERRCODE='23514';
  END IF;

  SELECT * INTO v_historico FROM public.historico_anos
  WHERE matricula_id=v_matricula.id AND escola_id=NEW.escola_id
    AND aluno_id=v_matricula.aluno_id AND ano_letivo=v_matricula.ano_letivo
    AND ano_letivo_id=NEW.ano_letivo_id;

  IF NOT FOUND OR v_historico.resultado_final NOT IN ('aprovado','reprovado','concluido')
      OR (v_historico.resultado_final='reprovado' AND v_matricula.status<>'reprovado')
      OR (v_historico.resultado_final IN ('aprovado','concluido') AND v_matricula.status<>'concluido') THEN
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
$history_legal_guard$;

DROP TRIGGER IF EXISTS trg_lifecycle_guard_official_history_lock ON public.historico_snapshot_locks;
CREATE TRIGGER trg_lifecycle_guard_official_history_lock
BEFORE INSERT OR UPDATE OF status ON public.historico_snapshot_locks
FOR EACH ROW EXECUTE FUNCTION public.lifecycle_validate_historico_legal_lock();

-- No historical grades, decisions or legal snapshots are modified here.
