-- Post-replay stabilization of academic evidence, GradeEngine and historical locks.
-- Original DDL is preserved for the already-applied remote migration versions.
-- This intentionally excludes every financial, billing and tax subsystem.
BEGIN;
CREATE OR REPLACE FUNCTION public.gradeengine_calcular_situacao(p_matricula_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_escola_id uuid := public.current_tenant_escola_id();
  v_matricula record;
  v_missing_count bigint := 0;
  v_official_rows bigint := 0;
  v_has_reprovacao boolean := false;
  v_abaixo_minimo boolean := false;
BEGIN
  IF v_escola_id IS NULL THEN
    RAISE EXCEPTION 'AUTH: escola_id inválido.';
  END IF;

  IF NOT public.user_has_role_in_school(v_escola_id, ARRAY['secretaria', 'admin', 'admin_escola', 'staff_admin']) THEN
    RAISE EXCEPTION 'AUTH: Permissão negada.';
  END IF;

  SELECT id, escola_id
    INTO v_matricula
  FROM public.matriculas
  WHERE id = p_matricula_id
    AND escola_id = v_escola_id;

  IF v_matricula.id IS NULL THEN
    RAISE EXCEPTION 'DATA: Matrícula não encontrada.';
  END IF;

  -- 0. Regra legal de faltas: reprovação automática
  SELECT COALESCE(bool_or(fsp.abaixo_minimo), false)
    INTO v_abaixo_minimo
  FROM public.frequencia_status_periodo fsp
  WHERE fsp.escola_id = v_escola_id
    AND fsp.matricula_id = p_matricula_id;

  IF v_abaixo_minimo THEN
    RETURN jsonb_build_object(
      'situacao_final', 'reprovado_por_faltas',
      'motivos', jsonb_build_array('Frequência abaixo do mínimo legal.')
    );
  END IF;

  -- A blank official academic record is never an academic approval.
  SELECT count(*) INTO v_official_rows
  FROM public.vw_boletim_por_matricula
  WHERE matricula_id = p_matricula_id AND conta_para_media_med IS TRUE;

  IF v_official_rows = 0 THEN
    RETURN jsonb_build_object('situacao_final','incompleto',
      'motivos',jsonb_build_array('Não há disciplinas oficiais avaliadas. Confirme matriz curricular, pautas ou decisão académica documentada.'));
  END IF;

  -- 1. Verificar disciplinas oficiais sem notas lançadas (ignorando isentos)
  SELECT COALESCE(SUM(missing_count), 0)
  INTO v_missing_count
  FROM public.vw_boletim_por_matricula
  WHERE matricula_id = p_matricula_id
    AND conta_para_media_med IS TRUE;

  IF v_missing_count > 0 THEN
    RETURN jsonb_build_object(
      'situacao_final', 'incompleto',
      'motivos', jsonb_build_array('Existem disciplinas oficiais sem notas lançadas ou pautas abertas.')
    );
  END IF;

  -- 2. Calcular aprovação sobre trimestres NÃO ISENTOS
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT disciplina_id,
             AVG(nota_final) FILTER (WHERE nota_final IS NOT NULL) AS media_final
      FROM public.vw_boletim_por_matricula
      WHERE matricula_id = p_matricula_id
        AND conta_para_media_med IS TRUE
      GROUP BY disciplina_id
    ) s
    WHERE s.media_final IS NULL
  ) THEN
    RETURN jsonb_build_object(
      'situacao_final', 'incompleto',
      'motivos', jsonb_build_array('Não existem notas ou isenções para todos os trimestres.')
    );
  END IF;

  -- 3. Calcular reprovação
  SELECT EXISTS (
    SELECT 1
    FROM (
      SELECT disciplina_id,
             AVG(nota_final) FILTER (WHERE nota_final IS NOT NULL) AS media_final
      FROM public.vw_boletim_por_matricula
      WHERE matricula_id = p_matricula_id
        AND conta_para_media_med IS TRUE
      GROUP BY disciplina_id
    ) s
    WHERE s.media_final < 10
  )
  INTO v_has_reprovacao;

  RETURN jsonb_build_object(
    'situacao_final', CASE WHEN v_has_reprovacao THEN 'reprovado' ELSE 'aprovado' END,
    'motivos', jsonb_build_array()
  );
END;
$function$
;

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

-- No historical grades, decisions or legal snapshots are modified here.;

-- School-signed ratification of already imported historical outcomes.
-- Does not create grades, change the registered academic outcome or close
-- the legal snapshot. Academic result remains draft until explicit legal close.
CREATE OR REPLACE FUNCTION public.ratificar_resultado_historico_escola(
  p_escola_id uuid,
  p_matricula_id uuid,
  p_resultado_confirmado text,
  p_referencia_documental text,
  p_motivo text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','public'
AS $signed_ratification$
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
     OR v_m.status NOT IN ('concluido','reprovado') OR v_m.ativo THEN
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

  -- Two legacy enrolled-as-'concluido' records were documented as failed.
  -- This correction is permitted only after the school's explicit ratification.
  IF v_resultado='reprovado' AND v_m.status='concluido' THEN
    UPDATE public.matriculas SET status='reprovado',ativo=false,updated_at=now(),updated_by=v_actor_id
    WHERE id=v_m.id AND escola_id=p_escola_id AND status='concluido';
    v_fixed := true;
  ELSIF (v_resultado IN ('aprovado','concluido') AND v_m.status<>'concluido')
      OR (v_resultado='reprovado' AND v_m.status<>'reprovado') THEN
    RAISE EXCEPTION 'RATIFICATION_STATUS_CONFLICT: estado administrativo incompatível'
      USING ERRCODE='23514';
  END IF;

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
$signed_ratification$;

REVOKE ALL ON FUNCTION public.ratificar_resultado_historico_escola(uuid,uuid,text,text,text)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ratificar_resultado_historico_escola(uuid,uuid,text,text,text)
TO authenticated, service_role;

COMMIT;
