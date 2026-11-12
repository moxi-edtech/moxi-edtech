BEGIN;
-- CLI-generated migration, ordered after the existing 20271112040000 dependency.
-- Reuses matriculas/historico_anos/audit_logs. No new tables or synthetic grades.
CREATE OR REPLACE FUNCTION public.balcao_origem_percurso_elegivel(p_escola_id uuid,p_matricula_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
SELECT public.safe_auth_uid() IS NOT NULL AND public.current_tenant_escola_id() IS NOT DISTINCT FROM p_escola_id AND EXISTS(
 SELECT 1 FROM public.matriculas m JOIN public.anos_letivos y ON y.id=m.session_id AND y.escola_id=m.escola_id AND y.ano=m.ano_letivo
 WHERE m.id=p_matricula_id AND m.escola_id=p_escola_id AND m.turma_id IS NOT NULL AND y.ativo=false AND m.ativo=false
 AND (m.status='pendente' AND coalesce(m.status_fecho_origem,'manual')='manual' OR m.status='concluido' AND m.status_fecho_origem IN ('manual','override_admin'))
 AND (SELECT count(*) FROM public.anos_letivos a WHERE a.escola_id=p_escola_id AND a.ativo)=1
 AND EXISTS(SELECT 1 FROM public.anos_letivos a WHERE a.escola_id=p_escola_id AND a.ativo AND a.ano>y.ano)
 AND NOT EXISTS(SELECT 1 FROM public.matriculas other WHERE other.escola_id=m.escola_id AND other.aluno_id=m.aluno_id AND other.ano_letivo=m.ano_letivo AND other.id<>m.id));
$$;
REVOKE ALL ON FUNCTION public.balcao_origem_percurso_elegivel(uuid,uuid) FROM PUBLIC,anon,authenticated;

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
    OR NOT public.user_has_role_in_school(p_escola_id, ARRAY['secretaria','admin_secretaria','admin_secretario','admin_financeiro','admin','admin_escola','staff_admin','diretor']::text[]) THEN
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
  -- Enforce the same end-of-cycle rule for direct authenticated RPC calls.
  -- A promotion (aprovado/transitou) is not completion of an academic cycle.
  IF v_resultado = 'concluido' THEN
    DECLARE
      v_regime jsonb := public.resolve_regime_academico(v_matricula.turma_id);
      v_final boolean;
    BEGIN
      v_final := CASE
        WHEN lower(coalesce(v_regime->>'nivel_ensino','')) = 'eja'
          THEN (v_regime->>'modulo_numero' = '3' OR v_regime->>'ano_numero' = '2')
        ELSE v_regime->>'classe_num' IN ('6','9','12')
      END;
      IF v_final IS NOT TRUE THEN
        RAISE EXCEPTION 'ACADEMIC_CYCLE_NOT_FINAL: esta classe não conclui um ciclo de ensino'
          USING ERRCODE='23514';
      END IF;
    END;
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
        AND eu.papel IN ('secretaria','admin_secretaria','admin_secretario','admin_financeiro','admin','admin_escola','staff_admin','diretor')
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
    IF NOT v_cohort_exists AND NOT public.balcao_origem_percurso_elegivel(p_escola_id,p_matricula_id) THEN
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
    -- The common RPC must not bypass the full-transcription requirement either.
    IF public.balcao_origem_percurso_elegivel(p_escola_id,p_matricula_id)
       AND EXISTS(SELECT 1 FROM public.notas n WHERE n.escola_id=p_escola_id AND n.matricula_id=p_matricula_id)
       AND public.resolve_regime_academico(v_matricula.turma_id)->>'escala' IN ('quantitativa_primario','quantitativa_secundario')
       AND NOT public.balcao_pauta_completa(p_escola_id,p_matricula_id) THEN
      RAISE EXCEPTION 'ACADEMIC_GRADES_INCOMPLETE: complete a transcrição anual antes de concluir' USING ERRCODE='23514';
    END IF;
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
       ARRAY['secretaria','admin_secretaria','admin_secretario','admin_financeiro','admin','admin_escola','staff_admin','diretor']::text[]) THEN
    RAISE EXCEPTION 'RATIFICATION_AUTH_FORBIDDEN: ratificação de históricos exige direção da escola'
      USING ERRCODE='42501';
  END IF;

  SELECT eu.papel INTO v_authorized_role
  FROM public.escola_users eu
  WHERE eu.escola_id=p_escola_id AND eu.user_id=v_actor_id
    AND eu.papel IN ('secretaria','admin_secretaria','admin_secretario','admin_financeiro','admin','admin_escola','staff_admin','diretor')
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
  IF NOT v_has_cohort AND NOT public.balcao_origem_percurso_elegivel(p_escola_id,p_matricula_id) THEN
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
      AND (public.balcao_origem_percurso_elegivel(p_escola_id,p_matricula_id) OR EXISTS (
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
      ))
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
          AND a.details->>'papel_autorizado' IN ('secretaria','admin_secretaria','admin_secretario','admin_financeiro','admin','admin_escola','staff_admin','diretor')
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
CREATE OR REPLACE FUNCTION public.lancar_nota_historica_individual(p_escola_id uuid, p_matricula_id uuid, p_turma_disciplina_id uuid, p_trimestre integer, p_tipo_avaliacao text, p_valor numeric, p_motivo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
DECLARE
 v_actor uuid := auth.uid();
 v_m record;
 v_disciplina_id uuid;
 v_active_year int;
 v_result jsonb;
BEGIN
 IF v_actor IS NULL OR public.current_tenant_escola_id() IS DISTINCT FROM p_escola_id THEN
   RAISE EXCEPTION 'AUTH: escola fora do tenant ativo' USING ERRCODE='42501';
 END IF;
 IF NOT EXISTS (
   SELECT 1 FROM public.escola_users eu
   WHERE eu.escola_id=p_escola_id AND eu.user_id=v_actor
     AND eu.papel IN ('secretaria','admin_secretaria','admin_secretario','admin_financeiro','admin','admin_escola','staff_admin','diretor')
 ) THEN
   RAISE EXCEPTION 'AUTH: operação histórica restrita à secretaria académica/direção'
     USING ERRCODE='42501';
 END IF;
 IF length(btrim(coalesce(p_motivo,''))) NOT BETWEEN 12 AND 500 THEN
   RAISE EXCEPTION 'DATA: motivo deve ter 12 a 500 caracteres' USING ERRCODE='22023';
 END IF;
 SELECT m.id,m.aluno_id,m.turma_id,m.session_id,m.ano_letivo,m.status,m.ativo,
        m.status_fecho_origem,y.ativo AS year_active
 INTO v_m
 FROM public.matriculas m JOIN public.anos_letivos y
   ON y.id=m.session_id AND y.escola_id=m.escola_id AND y.ano=m.ano_letivo
 WHERE m.id=p_matricula_id AND m.escola_id=p_escola_id
 FOR UPDATE OF m;
 IF NOT FOUND OR v_m.year_active=true
    OR v_m.status<>'pendente' OR v_m.ativo IS DISTINCT FROM false
    OR NOT (v_m.status_fecho_origem IS NULL OR v_m.status_fecho_origem='manual') THEN
   RAISE EXCEPTION 'HISTORIC_GRADE_SOURCE_INVALID: origem pendente do ano encerrado obrigatória'
     USING ERRCODE='23514';
 END IF;
 SELECT max(ano) INTO v_active_year FROM public.anos_letivos
 WHERE escola_id=p_escola_id AND ativo=true;
 IF v_active_year IS NULL OR v_active_year <= v_m.ano_letivo OR
    (SELECT count(*) FROM public.anos_letivos WHERE escola_id=p_escola_id AND ativo=true)<>1 THEN
   RAISE EXCEPTION 'HISTORIC_GRADE_YEAR_INVALID: a origem deve anteceder o único ano ativo'
     USING ERRCODE='23514';
 END IF;
 IF EXISTS (SELECT 1 FROM public.historico_anos h
            WHERE h.escola_id=p_escola_id
              AND (h.matricula_id=v_m.id OR
                (h.aluno_id=v_m.aluno_id AND h.ano_letivo=v_m.ano_letivo)))
    OR EXISTS (SELECT 1 FROM public.historico_snapshot_locks l
               WHERE l.escola_id=p_escola_id AND l.matricula_id=v_m.id
                 AND l.ano_letivo_id=v_m.session_id AND l.status='fechado') THEN
   RAISE EXCEPTION 'HISTORIC_GRADE_LEGAL_LOCKED: histórico ou lock legal já publicado'
     USING ERRCODE='23514';
 END IF;
 SELECT cm.disciplina_id INTO v_disciplina_id
 FROM public.turma_disciplinas td
 JOIN public.curso_matriz cm ON cm.id=td.curso_matriz_id AND cm.escola_id=td.escola_id
 WHERE td.id=p_turma_disciplina_id AND td.escola_id=p_escola_id
   AND td.turma_id=v_m.turma_id;
 IF NOT FOUND OR v_disciplina_id IS NULL THEN
   RAISE EXCEPTION 'HISTORIC_GRADE_DISCIPLINE_MISMATCH: disciplina fora da turma'
     USING ERRCODE='23514';
 END IF;
 INSERT INTO public.balcao_grade_historic_nonce(escola_id,matricula_id,actor_id,motivo)
 VALUES(p_escola_id,v_m.id,v_actor,btrim(p_motivo));
 PERFORM pg_catalog.set_config('klasse.historic_grade_matricula_id',v_m.id::text,true);
 v_result := public.lancar_notas_batch(
   p_escola_id,v_m.turma_id,v_disciplina_id,p_turma_disciplina_id,
   p_trimestre,p_tipo_avaliacao,
   jsonb_build_array(jsonb_build_object('aluno_id',v_m.aluno_id,'valor',p_valor)),
   false);
 IF v_result->>'ok' IS DISTINCT FROM 'true' THEN
   RAISE EXCEPTION 'HISTORIC_GRADE_WRITE_FAILED: gravação não confirmada'
     USING ERRCODE='23514';
 END IF;
 DELETE FROM public.balcao_grade_historic_nonce
 WHERE escola_id=p_escola_id AND matricula_id=v_m.id AND actor_id=v_actor;
 PERFORM pg_catalog.set_config('klasse.historic_grade_matricula_id','',true);
 INSERT INTO public.audit_logs(escola_id,actor_id,action,entity,entity_id,portal,details)
 VALUES(p_escola_id,v_actor,'BALCAO_NOTA_HISTORICA_LANCADA',
   'matriculas',v_m.id::text,'secretaria',
   jsonb_build_object('motivo',btrim(p_motivo),'ano_origem',v_m.ano_letivo,
      'turma_id',v_m.turma_id,'turma_disciplina_id',p_turma_disciplina_id,
      'trimestre',p_trimestre,'tipo_avaliacao',p_tipo_avaliacao,
      'valor_novo',p_valor,'resultado',v_result));
 RETURN v_result || jsonb_build_object('historico',true,'matricula_id',v_m.id);
END;
$function$;
-- Same model precedence and component normalization used by avaliacao-utils.ts.
-- This guard is required by the transactional close, including direct RPC calls.
CREATE OR REPLACE FUNCTION public.balcao_pauta_completa(p_escola uuid,p_matricula uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE m record; td record; config record; modelo record; chosen public.modelos_avaliacao%ROWTYPE;
 comps jsonb; base_comps jsonb; formula_comps jsonb; model_type text; base_type text;
 component jsonb; term integer; terms integer[]; code text; n integer:=0;
BEGIN
 IF public.safe_auth_uid() IS NULL OR public.current_tenant_escola_id() IS DISTINCT FROM p_escola OR NOT EXISTS(
 SELECT 1 FROM public.escola_users eu WHERE eu.escola_id=p_escola AND eu.user_id=public.safe_auth_uid()
 AND eu.papel IN ('secretaria','admin_secretaria','admin_secretario','admin_financeiro','admin','admin_escola','staff_admin','diretor')) THEN RETURN false; END IF;
 SELECT x.*,t.curso_id,t.classe_id INTO m FROM public.matriculas x JOIN public.turmas t ON t.id=x.turma_id AND t.escola_id=x.escola_id
 WHERE x.id=p_matricula AND x.escola_id=p_escola;
 IF NOT FOUND THEN RETURN false; END IF;
 SELECT avaliacao_config,modelo_avaliacao INTO config FROM public.configuracoes_escola WHERE escola_id=p_escola;
 base_comps:=CASE WHEN jsonb_typeof(config.avaliacao_config)='array' THEN config.avaliacao_config
 WHEN jsonb_typeof(config.avaliacao_config->'componentes')='array' THEN config.avaliacao_config->'componentes' ELSE '[]'::jsonb END;
 base_type:='trimestral';
 IF jsonb_array_length(base_comps)=0 THEN
   SELECT a.* INTO modelo FROM public.modelos_avaliacao a WHERE a.escola_id=p_escola
   AND ((a.curso_id=m.curso_id AND a.is_default) OR a.id::text=config.modelo_avaliacao::text OR a.nome=config.modelo_avaliacao::text OR a.curso_id IS NULL AND a.is_default)
   ORDER BY CASE WHEN a.curso_id=m.curso_id AND a.is_default THEN 1 WHEN a.id::text=config.modelo_avaliacao::text OR a.nome=config.modelo_avaliacao::text THEN 2 ELSE 3 END,a.updated_at DESC,a.id LIMIT 1;
   IF FOUND THEN
     formula_comps:=coalesce(modelo.formula->'componentes',modelo.formula->'components','[]'::jsonb);
     base_comps:=CASE WHEN jsonb_typeof(formula_comps)='array' AND jsonb_array_length(formula_comps)>0 THEN formula_comps
       WHEN jsonb_typeof(modelo.componentes)='array' THEN modelo.componentes WHEN jsonb_typeof(modelo.componentes->'componentes')='array' THEN modelo.componentes->'componentes' ELSE '[]'::jsonb END;
     base_type:=coalesce(modelo.tipo,'trimestral');
   END IF;
 END IF;
 FOR td IN SELECT d.id AS assignment_id,d.periodos_ativos AS assignment_periods,c.* FROM public.turma_disciplinas d
 JOIN public.curso_matriz c ON c.id=d.curso_matriz_id AND c.escola_id=d.escola_id
 WHERE d.escola_id=p_escola AND d.turma_id=m.turma_id LOOP
   n:=n+1; comps:=base_comps; model_type:=base_type;
   chosen:=NULL;
   IF td.avaliacao_mode='custom' THEN
     SELECT a.* INTO chosen FROM public.modelos_avaliacao a WHERE a.escola_id=p_escola AND a.id=td.avaliacao_modelo_id;
   ELSIF td.avaliacao_mode='inherit_disciplina' THEN
     SELECT a.* INTO chosen FROM public.curso_matriz cm JOIN public.modelos_avaliacao a ON a.id=cm.avaliacao_modelo_id AND a.escola_id=cm.escola_id
     WHERE cm.escola_id=p_escola AND cm.curso_id=m.curso_id AND cm.classe_id=m.classe_id AND cm.disciplina_id=td.avaliacao_disciplina_id AND cm.ativo;
   END IF;
   IF chosen.id IS NOT NULL THEN
     formula_comps:=coalesce(chosen.formula->'componentes',chosen.formula->'components','[]'::jsonb);
     comps:=CASE WHEN jsonb_typeof(formula_comps)='array' AND jsonb_array_length(formula_comps)>0 THEN formula_comps
       WHEN jsonb_typeof(chosen.componentes)='array' THEN chosen.componentes WHEN jsonb_typeof(chosen.componentes->'componentes')='array' THEN chosen.componentes->'componentes' ELSE '[]'::jsonb END;
     model_type:=coalesce(chosen.tipo,'trimestral');
   END IF;
   IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(comps) c WHERE nullif(btrim(c->>'code'),'') IS NOT NULL AND coalesce((c->>'ativo')::boolean,true)) THEN RETURN false; END IF;
   terms:=CASE WHEN coalesce(cardinality(td.assignment_periods),0)=0 THEN ARRAY[1,2,3] ELSE td.assignment_periods END;
   IF model_type<>'trimestral' THEN terms:=ARRAY[0]; END IF;
   FOREACH term IN ARRAY terms LOOP
     FOR component IN SELECT value FROM jsonb_array_elements(comps) LOOP
       IF NOT coalesce((component->>'ativo')::boolean,true) OR nullif(btrim(component->>'code'),'') IS NULL THEN CONTINUE; END IF;
       code:=upper(btrim(component->>'code')); IF code='PT' THEN code:='NPT'; END IF;
       IF NOT EXISTS(SELECT 1 FROM public.notas nt JOIN public.avaliacoes a ON a.id=nt.avaliacao_id AND a.escola_id=nt.escola_id
         WHERE nt.escola_id=p_escola AND nt.matricula_id=p_matricula AND a.turma_disciplina_id=td.assignment_id
         AND (term=0 OR a.trimestre=term) AND (nt.is_isento OR nt.valor IS NOT NULL AND
         CASE WHEN upper(btrim(a.tipo))='PT' THEN 'NPT' ELSE upper(btrim(a.tipo)) END=code)) THEN RETURN false; END IF;
     END LOOP;
   END LOOP;
 END LOOP;
 RETURN n>0 AND n=(SELECT count(*) FROM public.turma_disciplinas d WHERE d.escola_id=p_escola AND d.turma_id=m.turma_id);
END $$;
REVOKE ALL ON FUNCTION public.balcao_pauta_completa(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.balcao_pauta_completa(uuid,uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.balcao_concluir_ano_percurso(p_escola_id uuid,p_matricula_id uuid,p_resultado text DEFAULT NULL,p_modo text DEFAULT 'resultado')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE m public.matriculas%ROWTYPE; prev record; dest record; h record;
 r jsonb; raa jsonb; result text; ref text; reason text; origem_class int; destino_class int;
BEGIN
 IF public.safe_auth_uid() IS NULL OR public.current_tenant_escola_id() IS DISTINCT FROM p_escola_id
 OR NOT EXISTS(SELECT 1 FROM public.escola_users eu WHERE eu.escola_id=p_escola_id AND eu.user_id=public.safe_auth_uid()
 AND eu.papel IN ('secretaria','admin_secretaria','admin_secretario','admin_financeiro','admin','admin_escola','staff_admin','diretor')) THEN
 RAISE EXCEPTION 'AUTH: perfil sem autorização' USING ERRCODE='42501'; END IF;
 IF p_modo IS NULL OR p_modo NOT IN ('notas','resultado') THEN RAISE EXCEPTION 'ACADEMIC_MODE_INVALID' USING ERRCODE='23514'; END IF;
 SELECT * INTO m FROM public.matriculas WHERE escola_id=p_escola_id AND id=p_matricula_id FOR UPDATE;
 IF NOT FOUND OR NOT public.balcao_origem_percurso_elegivel(p_escola_id,m.id) THEN
 RAISE EXCEPTION 'ACADEMIC_SOURCE_INVALID: confirme a matrícula, turma e ano de origem' USING ERRCODE='23514'; END IF;
 IF p_modo='resultado' THEN
   IF p_resultado IS NULL OR p_resultado NOT IN ('aprovado','reprovado') THEN RAISE EXCEPTION 'ACADEMIC_RESULT_REQUIRED: confirme Aprovado ou Retido' USING ERRCODE='23514'; END IF;
   result:=p_resultado;
 ELSE
   IF NOT public.balcao_pauta_completa(p_escola_id,m.id) THEN RAISE EXCEPTION 'ACADEMIC_GRADES_INCOMPLETE: complete as notas de todas as disciplinas e períodos aplicáveis' USING ERRCODE='23514'; END IF;
   raa:=public.resolve_raa_progression_for_matricula(p_escola_id,m.id);
   IF coalesce(raa->>'efetivacao_matricula_bloqueada','false')='true' OR jsonb_array_length(coalesce(raa->'disciplina_ids_pendentes','[]'::jsonb))>0 THEN RAISE EXCEPTION 'ACADEMIC_PENDING: resolva as pendências académicas do ano' USING ERRCODE='23514'; END IF;
   result:=CASE WHEN raa->>'decision'='transitou' THEN 'aprovado' WHEN raa->>'decision'='retido' AND raa->>'destino'='mesma_etapa' THEN 'reprovado' ELSE NULL END;
   IF result IS NULL THEN RAISE EXCEPTION 'ACADEMIC_PENDING: resultado, frequência ou avaliações ainda por concluir' USING ERRCODE='23514'; END IF;
 END IF;
 SELECT * INTO h FROM public.historico_anos WHERE escola_id=p_escola_id AND matricula_id=m.id;
 IF h.snapshot_status='fechado' AND h.resultado_final=result AND EXISTS(SELECT 1 FROM public.historico_snapshot_locks sl
 WHERE sl.escola_id=p_escola_id AND sl.matricula_id=m.id AND sl.historico_ano_id=h.id AND sl.status='fechado') THEN
 RETURN jsonb_build_object('ok',true,'reused',true,'resultado',result); END IF;
 -- Existing school enrollments are the evidence for each step. Never fill missing years.
 IF EXISTS(SELECT 1 FROM public.matriculas earlier WHERE earlier.escola_id=p_escola_id AND earlier.aluno_id=m.aluno_id
 AND earlier.ano_letivo<m.ano_letivo AND earlier.status IN ('pendente','ativo','concluido') AND NOT EXISTS(
 SELECT 1 FROM public.historico_anos eh JOIN public.historico_snapshot_locks sl ON sl.escola_id=eh.escola_id AND sl.historico_ano_id=eh.id AND sl.matricula_id=eh.matricula_id AND sl.status='fechado'
 WHERE eh.escola_id=p_escola_id AND eh.matricula_id=earlier.id AND eh.snapshot_status='fechado')) THEN
 RAISE EXCEPTION 'ACADEMIC_PREVIOUS_YEAR_PENDING: conclua primeiro o ano anterior' USING ERRCODE='23514'; END IF;
 IF EXISTS(SELECT 1 FROM public.mensalidades debt JOIN public.matriculas earlier ON earlier.id=debt.matricula_id AND earlier.escola_id=debt.escola_id
 WHERE earlier.escola_id=p_escola_id AND earlier.aluno_id=m.aluno_id AND earlier.ano_letivo<m.ano_letivo
 AND coalesce(lower(debt.status),'') NOT IN ('pago','isento','cancelado')
 AND coalesce(debt.valor_previsto,debt.valor,0)>coalesce(debt.valor_pago_total,0)
 AND debt.data_vencimento::date<(now() AT TIME ZONE 'Africa/Luanda')::date) THEN
 RAISE EXCEPTION 'ACADEMIC_PREVIOUS_DEBT_PENDING: liquide a dívida do ano anterior' USING ERRCODE='23514'; END IF;
 origem_class:=(public.resolve_regime_academico(m.turma_id)->>'classe_num')::int;
 SELECT earlier.ano_letivo,earlier.turma_id,eh.resultado_final INTO prev FROM public.matriculas earlier
 LEFT JOIN public.historico_anos eh ON eh.escola_id=earlier.escola_id AND eh.matricula_id=earlier.id
 WHERE earlier.escola_id=p_escola_id AND earlier.aluno_id=m.aluno_id AND earlier.ano_letivo<m.ano_letivo
 ORDER BY earlier.ano_letivo DESC,earlier.id LIMIT 1;
 IF FOUND AND (prev.ano_letivo<>m.ano_letivo-1 OR origem_class IS NULL OR prev.resultado_final NOT IN ('aprovado','reprovado')
 OR origem_class IS DISTINCT FROM (public.resolve_regime_academico(prev.turma_id)->>'classe_num')::int+CASE WHEN prev.resultado_final='aprovado' THEN 1 ELSE 0 END) THEN
 RAISE EXCEPTION 'ACADEMIC_PATH_MISMATCH: confira o ano e a classe do percurso registado' USING ERRCODE='23514'; END IF;
 FOR dest IN SELECT * FROM public.matriculas WHERE escola_id=p_escola_id AND aluno_id=m.aluno_id AND ano_letivo=m.ano_letivo+1 LOOP
 destino_class:=(public.resolve_regime_academico(dest.turma_id)->>'classe_num')::int;
 IF destino_class IS NULL OR origem_class IS NULL OR destino_class<>(origem_class+CASE WHEN result='aprovado' THEN 1 ELSE 0 END) THEN
 RAISE EXCEPTION 'ACADEMIC_DESTINATION_CONFLICT: a classe seguinte contradiz o resultado confirmado' USING ERRCODE='23514'; END IF;
 -- Older imports can lack a transition link: no inferred relationship is written.
 IF dest.origem_transicao_matricula_id IS NOT NULL AND dest.origem_transicao_matricula_id<>m.id THEN
 RAISE EXCEPTION 'ACADEMIC_DESTINATION_CONFLICT: a matrícula seguinte aponta para outra origem' USING ERRCODE='23514'; END IF;
 END LOOP;
 ref:='Confirmação escolar no Balcão: matrícula '||m.id::text;
 reason:=CASE WHEN p_modo='notas' THEN 'Pauta anual completa e resultado académico confirmado no Balcão.' ELSE 'Resultado confirmado explicitamente pela escola no Balcão, sem transcrição de notas.' END;
 r:=public.finalizar_origem_academica(p_escola_id,m.id,result,CASE WHEN p_modo='notas' THEN 'raa' ELSE 'declaracao_administrativa_escola' END,reason,ref);
 IF r->>'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'ACADEMIC_CONFIRMATION_FAILED: %',r; END IF;
 IF p_modo='resultado' THEN
 r:=public.ratificar_resultado_historico_escola(p_escola_id,m.id,result,ref,reason);
 IF r->>'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'ACADEMIC_RATIFICATION_FAILED: %',r; END IF;
 END IF;
 r:=public.historico_set_snapshot_state(p_escola_id,ARRAY[m.id],m.session_id,'fechado',reason,NULL);
 IF r->>'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'ACADEMIC_CLOSURE_FAILED: %',r; END IF;
 INSERT INTO public.audit_logs(escola_id,actor_id,action,entity,entity_id,portal,details)
 VALUES(p_escola_id,public.safe_auth_uid(),'BALCAO_ANO_PERCURSO_CONCLUIDO','matriculas',m.id::text,'secretaria',
 jsonb_build_object('modo',p_modo,'resultado',result,'ano',m.ano_letivo,'turma_id',m.turma_id));
 RETURN jsonb_build_object('ok',true,'matricula_id',m.id,'resultado',result);
END $$;
REVOKE ALL ON FUNCTION public.balcao_concluir_ano_percurso(uuid,uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.balcao_concluir_ano_percurso(uuid,uuid,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.balcao_corrigir_turma_origem_pauta(
  p_escola_id uuid,
  p_matricula_id uuid,
  p_turma_destino_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_source public.matriculas%ROWTYPE;
  v_old_turma public.turmas%ROWTYPE;
  v_new_turma public.turmas%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR
     public.current_tenant_escola_id() IS DISTINCT FROM p_escola_id OR
     NOT public.user_has_role_in_school(p_escola_id,ARRAY[
       'secretaria','admin_secretaria','admin_secretario','admin_financeiro',
       'admin','admin_escola','staff_admin','diretor'
     ]::text[]) THEN
    RAISE EXCEPTION 'Não tem acesso à pauta desta escola.'
      USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_source FROM public.matriculas
  WHERE id=p_matricula_id AND escola_id=p_escola_id FOR UPDATE;
  IF NOT FOUND OR v_source.turma_id IS NULL THEN
    RAISE EXCEPTION 'Matrícula do aluno não encontrada.' USING ERRCODE='23514';
  END IF;
  IF v_source.turma_id = p_turma_destino_id THEN
    RETURN pg_catalog.jsonb_build_object('ok',true,'matricula_id',v_source.id,
      'turma_id',v_source.turma_id,'alterada',false);
  END IF;
  IF v_source.status <> 'pendente' OR v_source.ativo IS DISTINCT FROM false
     OR v_source.status_fecho_origem IS DISTINCT FROM 'manual' THEN
    RAISE EXCEPTION 'A turma desta matrícula já não permite correção de origem.'
      USING ERRCODE='23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.anos_letivos ano
    WHERE ano.id=v_source.session_id AND ano.escola_id=p_escola_id
      AND ano.ano=v_source.ano_letivo AND ano.ativo=false
      AND ano.ano < (SELECT max(ano_ativo.ano)
                     FROM public.anos_letivos ano_ativo
                     WHERE ano_ativo.escola_id=p_escola_id AND ano_ativo.ativo=true)
  ) THEN
    RAISE EXCEPTION 'A pauta deve pertencer a um ano encerrado anterior ao ativo.' USING ERRCODE='23514';
  END IF;

  SELECT * INTO v_old_turma FROM public.turmas WHERE id=v_source.turma_id AND escola_id=p_escola_id;
  SELECT * INTO v_new_turma FROM public.turmas WHERE id=p_turma_destino_id AND escola_id=p_escola_id;
  IF v_old_turma.id IS NULL OR v_new_turma.id IS NULL
     OR v_old_turma.session_id IS DISTINCT FROM v_source.session_id
     OR v_new_turma.session_id IS DISTINCT FROM v_source.session_id
     OR v_new_turma.ano_letivo IS DISTINCT FROM v_source.ano_letivo
     OR v_old_turma.curso_id IS DISTINCT FROM v_new_turma.curso_id
     OR v_new_turma.status_validacao IS DISTINCT FROM 'ativo' THEN
    RAISE EXCEPTION 'Escolha uma turma válida do mesmo ano e curso.'
      USING ERRCODE='23514';
  END IF;

  -- An existing individual assessment or officially closed history cannot be
  -- silently re-bound to another pauta. No upload/approval is required.
  IF EXISTS (SELECT 1 FROM public.notas n
             WHERE n.matricula_id=v_source.id AND n.escola_id=p_escola_id)
     OR EXISTS (SELECT 1 FROM public.notas_avaliacoes n WHERE n.matricula_id=v_source.id)
     OR EXISTS (SELECT 1 FROM public.lancamentos l WHERE l.matricula_id=v_source.id)
     OR EXISTS (SELECT 1 FROM public.frequencias f WHERE f.matricula_id=v_source.id AND f.escola_id=p_escola_id)
     OR EXISTS (SELECT 1 FROM public.exame_resultados e WHERE e.matricula_id=v_source.id AND e.escola_id=p_escola_id)
     OR EXISTS (SELECT 1 FROM public.historico_anos h
               WHERE h.escola_id=p_escola_id
                 AND (h.matricula_id=v_source.id
                   OR (h.aluno_id=v_source.aluno_id AND h.ano_letivo=v_source.ano_letivo)))
     OR EXISTS (SELECT 1 FROM public.historico_snapshot_locks h
                WHERE h.escola_id=p_escola_id AND h.matricula_id=v_source.id AND h.status='fechado')
  THEN
    RAISE EXCEPTION 'A turma tem avaliações deste aluno já registadas. Abra a pauta existente.'
      USING ERRCODE='23514';
  END IF;

  INSERT INTO public.balcao_pauta_turma_correction_nonce(
    escola_id, matricula_id, actor_id, turma_origem_id, turma_destino_id
  ) VALUES(p_escola_id,v_source.id,v_actor,v_source.turma_id,p_turma_destino_id);

  UPDATE public.matriculas
  SET turma_id=v_new_turma.id,updated_at=now(),updated_by=v_actor
  WHERE id=v_source.id AND escola_id=p_escola_id AND turma_id=v_source.turma_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'A matrícula foi alterada. Atualize a pauta.' USING ERRCODE='40001';
  END IF;

  DELETE FROM public.balcao_pauta_turma_correction_nonce
  WHERE escola_id=p_escola_id AND matricula_id=v_source.id AND actor_id=v_actor;

  INSERT INTO public.audit_logs(
    escola_id,actor_id,action,entity,entity_id,portal,details,before,after
  ) VALUES (
    p_escola_id,v_actor,'BALCAO_PAUTA_TURMA_ORIGEM_CORRIGIDA',
    'matriculas',v_source.id::text,'secretaria',
    pg_catalog.jsonb_build_object(
      'aluno_id',v_source.aluno_id,'ano_letivo',v_source.ano_letivo,
      'origem','pauta_fisica_escola'),
    pg_catalog.jsonb_build_object('turma_id',v_old_turma.id),
    pg_catalog.jsonb_build_object('turma_id',v_new_turma.id)
  );
  RETURN pg_catalog.jsonb_build_object('ok',true,'matricula_id',v_source.id,
    'turma_id',v_new_turma.id,'alterada',true);
END;
$function$;
COMMIT;
