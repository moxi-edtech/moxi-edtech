-- Bridge between a legally ratified/closed documentary outcome and the
-- existing RAA canonical contract. Never reactivate a closed academic year,
-- fabricate marks, or infer approval from cohort membership.
-- The existing grade/attendance/financial guards continue to run.
BEGIN;

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
    OR NOT public.user_has_role_in_school(p_escola_id, ARRAY['admin','admin_escola','staff_admin','secretaria','diretor']::text[]) THEN
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
    -- Decision without grades is reserved to exact direction/admin roles.
    -- user_has_role_in_school expands aliases to financial roles: do not use
    -- it as authorization for historical grade/outcome overrides.
    IF NOT EXISTS (
      SELECT 1 FROM public.escola_users eu
      WHERE eu.escola_id=p_escola_id AND eu.user_id=v_actor_id
        AND eu.papel IN ('admin','admin_escola','staff_admin','diretor')
    ) THEN
      RAISE EXCEPTION 'ACADEMIC_DOCUMENT_AUTH_FORBIDDEN: só direção pode declarar resultado histórico'
        USING ERRCODE='42501';
    END IF;
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
    IF EXISTS (
      SELECT 1 FROM public.notas n
      WHERE n.escola_id=p_escola_id AND n.matricula_id=p_matricula_id
    ) THEN
      RAISE EXCEPTION 'ACADEMIC_DOCUMENT_GRADES_PRESENT: não substituir notas lançadas por decisão documental'
        USING ERRCODE='23514';
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
$function$;

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
  v_authorized_role text;
BEGIN
  IF v_actor_id IS NULL OR public.current_tenant_escola_id() IS DISTINCT FROM p_escola_id
     OR NOT public.user_has_role_in_school(p_escola_id,
       ARRAY['admin','admin_escola','staff_admin','diretor']::text[]) THEN
    RAISE EXCEPTION 'RATIFICATION_AUTH_FORBIDDEN: ratificação de históricos exige direção da escola'
      USING ERRCODE='42501';
  END IF;

  SELECT eu.papel INTO v_authorized_role
  FROM public.escola_users eu
  WHERE eu.escola_id=p_escola_id AND eu.user_id=v_actor_id
    AND eu.papel IN ('admin','admin_escola','staff_admin','diretor')
  LIMIT 1;
  IF v_authorized_role IS NULL THEN
    RAISE EXCEPTION 'RATIFICATION_AUTH_FORBIDDEN: só direção pode ratificar resultado histórico'
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
      AND a.details->>'ratificacao'='true'
      AND a.details->>'papel_autorizado'=v_authorized_role
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
        'papel_autorizado',v_authorized_role,
        'status_corrigido',v_fixed,
        'historico_ano_id',v_h.id,
        'snapshot_status','aberto','at',now()));
  END IF;

  RETURN jsonb_build_object('ok',true,'reused',v_reused,'matricula_id',v_m.id,
    'historico_ano_id',v_h.id,'resultado_final',v_resultado,
    'status_corrigido',v_fixed,'snapshot_status','aberto',
    'proximo_passo','Confirmar documentação e fechar histórico pelo fluxo oficial');
END;
$function$;

CREATE OR REPLACE FUNCTION public.resolve_raa_progression_for_matricula(p_escola_id uuid, p_matricula_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_legal jsonb;
  v_authorized record;
  v_historic record;
BEGIN
  -- The final legal snapshot is the authority only for a documented
  -- school decision in a valid, approved 2025->2026 historical cohort.
  -- This branch never changes grades or automatically decides an outcome.
  IF public.safe_auth_uid() IS NOT NULL
     AND public.current_tenant_escola_id() IS NOT DISTINCT FROM p_escola_id
  THEN
    SELECT m.id AS matricula_id, m.turma_id, h.id AS historico_id,
           h.resultado_final AS resultado
      INTO v_historic
    FROM public.matriculas m
    JOIN public.historico_anos h
      ON h.escola_id=m.escola_id AND h.aluno_id=m.aluno_id
      AND h.matricula_id=m.id AND h.ano_letivo=m.ano_letivo
      AND h.ano_letivo_id=m.session_id
    WHERE m.escola_id=p_escola_id AND m.id=p_matricula_id
      AND m.status='concluido' AND m.ativo=false
      AND m.status_fecho_origem='override_admin'
      AND h.snapshot_status='fechado'
      AND h.resultado_final IN ('aprovado','reprovado','concluido')
      AND EXISTS (
        SELECT 1 FROM public.historico_snapshot_locks sl
        WHERE sl.escola_id=p_escola_id AND sl.matricula_id=m.id
          AND sl.ano_letivo_id=m.session_id AND sl.status='fechado'
          AND sl.historico_ano_id=h.id
      )
      AND EXISTS (
        SELECT 1 FROM public.academic_transition_cohort_members cm
        JOIN public.academic_transition_cohorts c
          ON c.id=cm.cohort_id AND c.escola_id=cm.escola_id
        WHERE cm.escola_id=p_escola_id
          AND cm.matricula_origem_id=m.id
          AND cm.aluno_id=m.aluno_id AND cm.status='elegivel'
          AND c.ativo AND c.modo='virada_assistida_sem_notas'
          AND c.ano_origem=m.ano_letivo
          AND c.ano_destino=m.ano_letivo+1
          AND (c.expira_em IS NULL OR c.expira_em >= (now() AT TIME ZONE 'Africa/Luanda')::date)
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.notas n
        WHERE n.escola_id=p_escola_id AND n.matricula_id=m.id
      )
      AND EXISTS (
        SELECT 1 FROM public.audit_logs a
        WHERE a.escola_id=p_escola_id
          AND a.entity_id=m.id::text
          AND a.actor_id IS NOT NULL
          AND a.action='MATRICULA_ORIGEM_RESULTADO_ACADEMICO_REGISTADO'
          AND a.details->>'fonte'='declaracao_administrativa_escola'
          AND a.details->>'ratificacao'='true'
          AND a.details->>'papel_autorizado' IN ('admin','admin_escola','staff_admin','diretor')
          AND a.details->>'historico_ano_id'=h.id::text
          AND a.details->>'resultado_final'=h.resultado_final
          AND length(btrim(coalesce(a.details->>'referencia_documental','')))>=8
          AND length(btrim(coalesce(a.details->>'motivo','')))>=12
      )
    LIMIT 1;
    IF v_historic.matricula_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'decision', CASE v_historic.resultado
          WHEN 'aprovado' THEN 'transitou'
          WHEN 'reprovado' THEN 'retido'
          ELSE 'concluiu' END,
        'destino', CASE v_historic.resultado
          WHEN 'aprovado' THEN 'proxima_etapa'
          WHEN 'reprovado' THEN 'mesma_etapa'
          ELSE 'conclusao' END,
        'motivo','historico_documental_ratificado',
        'fonte_decisao','historico_documental_ratificado',
        'historico_ano_id',v_historic.historico_id,
        'disciplina_ids_pendentes','[]'::jsonb,
        'regime',public.resolve_regime_academico(v_historic.turma_id),
        'etapa_destino',null,
        'efetivacao_matricula_bloqueada',false
      );
    END IF;
  END IF;

  SELECT id, pendencias, motivo INTO v_authorized
  FROM public.promocoes_com_pendencias
  WHERE escola_id = p_escola_id
    AND matricula_origem_id = p_matricula_id
    AND status = 'autorizada'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_authorized.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'decision', 'transitou',
      'destino', 'proxima_etapa',
      'motivo', 'promovido_com_pendencias',
      'autorizacao_id', v_authorized.id,
      'disciplina_ids_pendentes', v_authorized.pendencias,
      'proximo_passo', 'Lançar e fechar as notas pendentes da matrícula de origem.'
    );
  END IF;

  v_legal := public.resolve_raa_decreto_for_matricula(p_escola_id, p_matricula_id);
  IF v_legal IS NOT NULL THEN
    RETURN v_legal;
  END IF;

  BEGIN
    RETURN public.resolve_raa_progression_for_matricula_generic(p_escola_id, p_matricula_id);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%RAA_PROGRESSION_POLICY_NOT_CONFIGURED%' THEN
      RETURN jsonb_build_object(
        'decision', 'pendente', 'destino', 'aguardar_dados', 'motivo', 'dados_pendentes',
        'disciplina_ids_pendentes', '[]'::jsonb,
        'proximo_passo', 'Configurar a política de progressão e concluir as notas finais da matrícula.'
      );
    END IF;
    RAISE;
  END;
END;
$function$;

CREATE OR REPLACE FUNCTION public.historico_set_snapshot_state(p_escola_id uuid, p_matricula_ids uuid[], p_ano_letivo_id uuid, p_novo_estado text, p_motivo text, p_run_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_id uuid := auth.uid();
  v_escola_id uuid := public.current_tenant_escola_id();
  v_has_permission boolean;
  v_row record;
  v_updated int := 0;
  v_new_status text := lower(trim(p_novo_estado));
  v_current_lock record;
BEGIN
  IF v_escola_id IS NULL OR p_escola_id IS DISTINCT FROM v_escola_id THEN
    RAISE EXCEPTION 'AUTH: escola_id inválido.';
  END IF;

  SELECT public.user_has_role_in_school(v_escola_id, ARRAY['admin', 'admin_escola', 'staff_admin', 'secretaria', 'diretor'])
    INTO v_has_permission;
  IF NOT v_has_permission THEN
    RAISE EXCEPTION 'AUTH: Permissão negada para alterar estado de snapshot histórico.';
  END IF;

  IF v_new_status NOT IN ('aberto', 'fechado', 'reaberto') THEN
    RAISE EXCEPTION 'LOGIC: estado inválido (%). Use aberto|fechado|reaberto.', p_novo_estado;
  END IF;

  IF v_new_status = 'reaberto' AND (p_motivo IS NULL OR btrim(p_motivo) = '') THEN
    RAISE EXCEPTION 'LOGIC: motivo é obrigatório para reabertura.';
  END IF;

  -- A verified documentary legal lock cannot be reopened or closed by
  -- financial aliases or ordinary secretariat staff through a direct RPC.
  IF EXISTS (
    SELECT 1 FROM public.matriculas m
    WHERE m.escola_id=p_escola_id
      AND m.id=ANY(p_matricula_ids)
      AND m.status_fecho_origem='override_admin'
  ) AND NOT EXISTS (
    SELECT 1 FROM public.escola_users eu
    WHERE eu.escola_id=p_escola_id AND eu.user_id=v_actor_id
      AND eu.papel IN ('admin','admin_escola','staff_admin','diretor')
  ) THEN
    RAISE EXCEPTION 'HISTORICAL_SNAPSHOT_AUTH_FORBIDDEN: decisão histórica exige direção'
      USING ERRCODE='42501';
  END IF;

  -- Even a director cannot call the generic snapshot RPC to close an
  -- unratified override_admin decision. Enforce this in PostgreSQL, not only
  -- in the Balcão API. Fail closed if grades were recorded meanwhile.
  IF v_new_status='fechado' AND EXISTS (
    SELECT 1 FROM public.matriculas m
    JOIN public.historico_anos h
      ON h.escola_id=m.escola_id AND h.matricula_id=m.id
      AND h.aluno_id=m.aluno_id AND h.ano_letivo=m.ano_letivo
      AND h.ano_letivo_id=p_ano_letivo_id
    WHERE m.escola_id=p_escola_id AND m.id=ANY(p_matricula_ids)
      AND m.status_fecho_origem='override_admin'
      AND (
        h.resultado_final NOT IN ('aprovado','reprovado','concluido')
        OR EXISTS (
          SELECT 1 FROM public.notas n
          WHERE n.escola_id=m.escola_id AND n.matricula_id=m.id
        )
        OR NOT EXISTS (
          SELECT 1 FROM public.audit_logs a
          WHERE a.escola_id=m.escola_id AND a.entity_id=m.id::text
            AND a.actor_id IS NOT NULL
            AND a.action='MATRICULA_ORIGEM_RESULTADO_ACADEMICO_REGISTADO'
            AND a.details->>'historico_ano_id'=h.id::text
            AND a.details->>'resultado_final'=h.resultado_final
            AND a.details->>'fonte'='declaracao_administrativa_escola'
            AND a.details->>'ratificacao'='true'
            AND a.details->>'papel_autorizado'
              IN ('admin','admin_escola','staff_admin','diretor')
            AND length(btrim(coalesce(a.details->>'referencia_documental','')))>=8
            AND length(btrim(coalesce(a.details->>'motivo','')))>=12
        )
      )
  ) THEN
    RAISE EXCEPTION 'HISTORICAL_RATIFICATION_REQUIRED: fecho exige decisão documental ratificada e sem notas divergentes'
      USING ERRCODE='23514';
  END IF;

  FOR v_row IN
    SELECT m.id AS matricula_id, m.aluno_id
    FROM public.matriculas m
    WHERE m.escola_id = v_escola_id
      AND m.id = ANY(p_matricula_ids)
  LOOP
    SELECT * INTO v_current_lock
    FROM public.historico_snapshot_locks hsl
    WHERE hsl.escola_id = v_escola_id
      AND hsl.ano_letivo_id = p_ano_letivo_id
      AND hsl.matricula_id = v_row.matricula_id
    FOR UPDATE;

    INSERT INTO public.historico_snapshot_locks (
      escola_id,
      ano_letivo_id,
      matricula_id,
      status,
      lock_run_id,
      lock_job_id,
      lock_step,
      lock_reason,
      locked_at,
      reopened_at,
      reopened_by,
      reopened_reason,
      allow_reopen
    )
    VALUES (
      v_escola_id,
      p_ano_letivo_id,
      v_row.matricula_id,
      v_new_status,
      p_run_id,
      p_run_id,
      CASE WHEN v_new_status = 'fechado' THEN 'GENERATING_HISTORY' ELSE NULL END,
      CASE WHEN v_new_status = 'fechado' THEN p_motivo ELSE NULL END,
      CASE WHEN v_new_status = 'fechado' THEN now() ELSE v_current_lock.locked_at END,
      CASE WHEN v_new_status = 'reaberto' THEN now() ELSE NULL END,
      CASE WHEN v_new_status = 'reaberto' THEN v_actor_id ELSE NULL END,
      CASE WHEN v_new_status = 'reaberto' THEN p_motivo ELSE NULL END,
      CASE WHEN v_new_status = 'reaberto' THEN true ELSE false END
    )
    ON CONFLICT (escola_id, ano_letivo_id, matricula_id)
    DO UPDATE SET
      status = EXCLUDED.status,
      lock_run_id = EXCLUDED.lock_run_id,
      lock_job_id = EXCLUDED.lock_job_id,
      lock_step = EXCLUDED.lock_step,
      lock_reason = COALESCE(EXCLUDED.lock_reason, public.historico_snapshot_locks.lock_reason),
      locked_at = COALESCE(EXCLUDED.locked_at, public.historico_snapshot_locks.locked_at),
      reopened_at = EXCLUDED.reopened_at,
      reopened_by = EXCLUDED.reopened_by,
      reopened_reason = EXCLUDED.reopened_reason,
      allow_reopen = EXCLUDED.allow_reopen,
      updated_at = now();

    UPDATE public.historico_anos ha
      SET snapshot_status = v_new_status,
          snapshot_lock_run_id = p_run_id,
          snapshot_locked_at = CASE WHEN v_new_status = 'fechado' THEN now() ELSE ha.snapshot_locked_at END,
          snapshot_reopened_at = CASE WHEN v_new_status = 'reaberto' THEN now() ELSE ha.snapshot_reopened_at END,
          snapshot_reopened_by = CASE WHEN v_new_status = 'reaberto' THEN v_actor_id ELSE ha.snapshot_reopened_by END,
          snapshot_reopen_reason = CASE WHEN v_new_status = 'reaberto' THEN p_motivo ELSE ha.snapshot_reopen_reason END
    WHERE ha.escola_id = v_escola_id
      AND ha.ano_letivo_id = p_ano_letivo_id
      AND ha.matricula_id = v_row.matricula_id;

    INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details)
    VALUES (
      v_escola_id,
      v_actor_id,
      CASE WHEN v_new_status = 'reaberto' THEN 'HISTORICO_SNAPSHOT_REABERTO' ELSE 'HISTORICO_SNAPSHOT_ESTADO_ALTERADO' END,
      'historico_snapshot_locks',
      v_row.matricula_id::text,
      'secretaria',
      jsonb_build_object(
        'ano_letivo_id', p_ano_letivo_id,
        'matricula_id', v_row.matricula_id,
        'novo_estado', v_new_status,
        'run_id', p_run_id,
        'motivo', p_motivo
      )
    );

    v_updated := v_updated + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'updated', v_updated, 'novo_estado', v_new_status);
END;
$function$;

-- Preserve existing privileges for the replaced function signatures.
-- SECURITY DEFINER handlers authorize both tenant and exact direction role.
REVOKE ALL ON FUNCTION public.finalizar_origem_academica(uuid,uuid,text,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ratificar_resultado_historico_escola(uuid,uuid,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resolve_raa_progression_for_matricula(uuid,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.historico_set_snapshot_state(uuid,uuid[],uuid,text,text,uuid) FROM PUBLIC, anon;

COMMIT;
