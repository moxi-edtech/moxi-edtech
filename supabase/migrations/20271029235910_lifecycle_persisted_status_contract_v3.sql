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

-- Postgres fires same-kind row triggers alphabetically. Canonicalize FIRST,
-- before audit, numbering, status and school/year integrity validation.
DROP TRIGGER IF EXISTS trg_matriculas_status_canonical ON public.matriculas;
DROP TRIGGER IF EXISTS a_matriculas_status_canonical ON public.matriculas;
CREATE TRIGGER a_matriculas_status_canonical
  BEFORE INSERT OR UPDATE OF status ON public.matriculas
  FOR EACH ROW EXECUTE FUNCTION public.matriculas_status_before_ins_upd();

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
    ELSIF v_grade->>'situacao_final' IN ('reprovado','reprovado_por_faltas') THEN
      v_status_calculado := 'concluido';
    ELSE
      RAISE EXCEPTION 'LOGIC: Situação final desconhecida retornada pelo GradeEngine.';
    END IF;

    v_origem := 'gradeengine';
  END IF;

  IF v_origem='gradeengine' AND EXISTS (
    SELECT 1 FROM public.historico_anos h
    WHERE h.escola_id=v_escola_id AND h.matricula_id=p_matricula_id
      AND h.resultado_final IS DISTINCT FROM
        CASE WHEN v_grade->>'situacao_final'='reprovado_por_faltas'
          THEN 'reprovado' ELSE v_grade->>'situacao_final' END
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
      'resultado_academico', CASE WHEN v_origem='gradeengine' THEN
        CASE WHEN v_grade->>'situacao_final'='reprovado_por_faltas'
          THEN 'reprovado' ELSE v_grade->>'situacao_final' END ELSE NULL END,
      'motivos_academicos', CASE WHEN v_origem='gradeengine'
        THEN v_grade->'motivos' ELSE NULL END,
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
         SET resultado_final = CASE WHEN v_grade->>'situacao_final'='reprovado_por_faltas'
               THEN 'reprovado' ELSE v_grade->>'situacao_final' END,
             status_final = CASE WHEN v_grade->>'situacao_final'='reprovado_por_faltas'
               THEN 'reprovado' ELSE v_grade->>'situacao_final' END
       WHERE escola_id = v_escola_id
         AND matricula_id = p_matricula_id
         AND snapshot_status = 'aberto';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'status', v_status_calculado,
    'resultado_academico', CASE WHEN v_origem='gradeengine' THEN
        CASE WHEN v_grade->>'situacao_final'='reprovado_por_faltas'
          THEN 'reprovado' ELSE v_grade->>'situacao_final' END ELSE NULL END,
      'motivos_academicos', CASE WHEN v_origem='gradeengine'
        THEN v_grade->'motivos' ELSE NULL END,
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
    v_resultado := CASE
      WHEN v_grade->>'situacao_final'='reprovado_por_faltas' THEN 'reprovado'
      ELSE v_grade->>'situacao_final' END;
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
        WHEN boletim_row.nota_final IS NULL THEN NULL -- ausência de nota não equivale a reprovação na disciplina
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
    v_evidence := (
      CASE WHEN v_grade->>'situacao_final'='reprovado_por_faltas'
        THEN 'reprovado' ELSE v_grade->>'situacao_final' END
      =v_historico.resultado_final
    );
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



-- Reconciled transition, confirmation and import writers.
CREATE OR REPLACE FUNCTION public.aplicar_virada_importacao(p_importacao_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_importacao public.virada_importacoes%ROWTYPE;
  v_linha public.virada_importacao_linhas%ROWTYPE;
  v_user_id uuid := auth.uid();
  v_avaliacao_id uuid;
  v_nota numeric(6,2);
  v_nota_max numeric(6,2);
  v_resultado text;
  v_status_matricula text;
  v_matricula_orig public.matriculas%ROWTYPE;
  v_hist public.historico_anos%ROWTYPE;
  v_resultado_academico text;
  v_notas integer := 0;
  v_resultados integer := 0;
  v_linhas integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH: utilizador não autenticado';
  END IF;

  SELECT * INTO v_importacao
  FROM public.virada_importacoes
  WHERE id = p_importacao_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DATA: lote não encontrado';
  END IF;

  IF v_importacao.escola_id IS DISTINCT FROM public.current_tenant_escola_id() THEN
    RAISE EXCEPTION 'AUTH: lote fora do tenant atual';
  END IF;

  IF NOT public.user_has_role_in_school(
    v_importacao.escola_id,
    ARRAY['admin','admin_escola','staff_admin','admin_financeiro','diretor','super_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'AUTH: perfil sem permissão para aplicar resultados';
  END IF;

  IF v_importacao.status = 'APLICADO' THEN
    RETURN jsonb_build_object('id', v_importacao.id, 'status', 'APLICADO', 'reused', true);
  END IF;

  IF v_importacao.status <> 'APROVADO' THEN
    RAISE EXCEPTION 'DATA: apenas lotes APROVADOS podem ser aplicados';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.virada_importacao_linhas vil
    WHERE vil.importacao_id = v_importacao.id
      AND vil.status <> 'VALIDA'
  ) THEN
    RAISE EXCEPTION 'DATA: lote contém linhas não válidas';
  END IF;

  FOR v_linha IN
    SELECT *
    FROM public.virada_importacao_linhas
    WHERE importacao_id = v_importacao.id
    ORDER BY linha, id
    FOR UPDATE
  LOOP
    IF v_linha.matricula_id IS NULL OR NOT EXISTS (
      SELECT 1
      FROM public.matriculas m
      WHERE m.id = v_linha.matricula_id
        AND m.aluno_id = v_linha.aluno_id
        AND m.escola_id = v_importacao.escola_id
        AND m.ano_letivo = v_importacao.ano_letivo_origem
    ) THEN
      RAISE EXCEPTION 'DATA: linha % sem matrícula válida no ano de origem', v_linha.linha;
    END IF;

    IF v_linha.normalized_data ? 'nota'
       AND nullif(v_linha.normalized_data->>'nota', '') IS NOT NULL THEN
      BEGIN
        v_avaliacao_id := nullif(v_linha.normalized_data->>'avaliacao_id', '')::uuid;
        v_nota := (v_linha.normalized_data->>'nota')::numeric;
      EXCEPTION WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'DATA: linha % contém nota ou avaliacao_id inválido', v_linha.linha;
      END;

      IF v_avaliacao_id IS NULL THEN
        RAISE EXCEPTION 'DATA: linha % exige avaliacao_id', v_linha.linha;
      END IF;

      SELECT a.nota_max INTO v_nota_max
      FROM public.avaliacoes a
      JOIN public.turma_disciplinas td
        ON td.id = a.turma_disciplina_id
       AND td.escola_id = a.escola_id
      JOIN public.matriculas m
        ON m.id = v_linha.matricula_id
       AND m.turma_id = td.turma_id
       AND m.escola_id = a.escola_id
      WHERE a.id = v_avaliacao_id
        AND a.escola_id = v_importacao.escola_id
        AND a.ano_letivo = v_importacao.ano_letivo_origem;

      IF v_nota_max IS NULL THEN
        RAISE EXCEPTION 'DATA: avaliação da linha % não pertence à matrícula, turma e ano informados', v_linha.linha;
      END IF;
      IF v_nota < 0 OR v_nota > v_nota_max THEN
        RAISE EXCEPTION 'DATA: nota da linha % deve estar entre 0 e %', v_linha.linha, v_nota_max;
      END IF;

      INSERT INTO public.notas (escola_id, avaliacao_id, matricula_id, valor)
      VALUES (v_importacao.escola_id, v_avaliacao_id, v_linha.matricula_id, v_nota)
      ON CONFLICT (matricula_id, avaliacao_id)
      DO UPDATE SET valor = EXCLUDED.valor, updated_at = now();
      v_notas := v_notas + 1;
    END IF;

    v_resultado := upper(nullif(v_linha.normalized_data->>'resultado_final', ''));
    IF v_resultado IS NOT NULL THEN
      IF v_resultado = 'PENDENTE' THEN
        RAISE EXCEPTION 'DATA: resultado PENDENTE na linha % não pode ser aplicado', v_linha.linha;
      ELSIF v_resultado IN ('TRANSITADO', 'CONCLUIDO') THEN
        v_status_matricula := 'concluido';
      ELSIF v_resultado = 'RETIDO' THEN
        v_status_matricula := 'concluido';
      ELSE
        RAISE EXCEPTION 'DATA: resultado final inválido na linha %', v_linha.linha;
      END IF;

      v_resultado_academico := CASE WHEN v_resultado='RETIDO' THEN 'reprovado'
        WHEN v_resultado='CONCLUIDO' THEN 'concluido' ELSE 'aprovado' END;
      SELECT * INTO v_matricula_orig FROM public.matriculas
      WHERE id=v_linha.matricula_id AND escola_id=v_importacao.escola_id FOR UPDATE;
      SELECT * INTO v_hist FROM public.historico_anos
      WHERE escola_id=v_importacao.escola_id AND aluno_id=v_matricula_orig.aluno_id
        AND ano_letivo=v_matricula_orig.ano_letivo FOR UPDATE;
      IF v_hist.id IS NOT NULL AND (
        v_hist.snapshot_status='fechado'
        OR v_hist.matricula_id IS DISTINCT FROM v_matricula_orig.id
        OR v_hist.resultado_final IS DISTINCT FROM v_resultado_academico
      ) THEN
        RAISE EXCEPTION 'ACADEMIC_IMPORT_RESULT_CONFLICT: historico protegido ou resultado divergente' USING ERRCODE='23514';
      END IF;
      UPDATE public.matriculas
      SET status = v_status_matricula,
          ativo = false,
          motivo_fecho = 'Importação aprovada na virada do ano letivo',
          data_fecho = now(),
          status_fecho_origem = 'override_admin',
          updated_at = now()
      WHERE id = v_linha.matricula_id
        AND escola_id = v_importacao.escola_id
        AND canonicalize_matricula_status_text(status) IN ('ativo', 'pendente');

      IF NOT FOUND AND NOT EXISTS (
        SELECT 1 FROM public.matriculas
        WHERE id = v_linha.matricula_id
          AND escola_id = v_importacao.escola_id
          AND canonicalize_matricula_status_text(status) = v_status_matricula
      ) THEN
        RAISE EXCEPTION 'DATA: matrícula da linha % não pode receber o resultado final', v_linha.linha;
      END IF;
      INSERT INTO public.historico_anos(
        escola_id,aluno_id,ano_letivo,ano_letivo_id,turma_id,matricula_id,
        resultado_final,status_final,snapshot_status,data_fechamento
      ) VALUES (
        v_matricula_orig.escola_id,v_matricula_orig.aluno_id,
        v_matricula_orig.ano_letivo,v_matricula_orig.session_id,
        v_matricula_orig.turma_id,v_matricula_orig.id,
        v_resultado_academico,v_resultado_academico,'aberto',CURRENT_DATE
      )
      ON CONFLICT (escola_id,aluno_id,ano_letivo) DO UPDATE SET
        ano_letivo_id=excluded.ano_letivo_id,
        matricula_id=excluded.matricula_id,
        resultado_final=excluded.resultado_final,
        status_final=excluded.status_final
      RETURNING * INTO v_hist;
      INSERT INTO public.audit_logs(escola_id,actor_id,action,entity,entity_id,portal,details)
      VALUES(v_importacao.escola_id,v_user_id,'MATRICULA_ORIGEM_RESULTADO_ACADEMICO_REGISTADO',
        'matriculas',v_matricula_orig.id::text,'secretaria',
        jsonb_build_object('resultado_final',v_resultado_academico,
          'fonte','declaracao_administrativa_escola',
          'referencia_documental',v_importacao.id::text,
          'motivo','Resultado conferido em lote de virada aprovado pela direcao',
          'historico_ano_id',v_hist.id,'at',now()));
      v_resultados := v_resultados + 1;
    END IF;

    UPDATE public.virada_importacao_linhas
    SET status = 'APLICADA', aplicado_em = now()
    WHERE id = v_linha.id;
    v_linhas := v_linhas + 1;
  END LOOP;

  UPDATE public.virada_importacoes
  SET status = 'APLICADO', aplicado_em = now(), updated_at = now()
  WHERE id = v_importacao.id;

  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details)
  VALUES (
    v_importacao.escola_id,
    v_user_id,
    'VIRADA_IMPORTACAO_APLICADA',
    'virada_importacoes',
    v_importacao.id::text,
    'secretaria',
    jsonb_build_object('linhas', v_linhas, 'notas', v_notas, 'resultados', v_resultados)
  );

  RETURN jsonb_build_object(
    'id', v_importacao.id,
    'status', 'APLICADO',
    'reused', false,
    'linhas', v_linhas,
    'notas', v_notas,
    'resultados', v_resultados
  );
END
$function$


CREATE OR REPLACE FUNCTION public.confirmar_matricula(p_matricula_id uuid)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_numero bigint;
  v_escola_id uuid;
BEGIN
  SELECT
    NULLIF(btrim(numero_matricula), '')::bigint,
    escola_id
  INTO v_numero, v_escola_id
  FROM public.matriculas
  WHERE id = p_matricula_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Matrícula não encontrada';
  END IF;

  IF v_numero IS NULL THEN
    v_numero := public.next_matricula_number(v_escola_id);
  END IF;

  UPDATE public.matriculas
  SET
    numero_matricula = v_numero::text,
    status = 'ativo', -- SSOT estado da matricula
    ativo = true,
    updated_at = now()
  WHERE id = p_matricula_id;

  RETURN v_numero;
END;
$function$


CREATE OR REPLACE FUNCTION public.finalizar_rematricula_balcao(p_escola_id uuid, p_aluno_id uuid, p_matricula_origem_id uuid, p_ano_letivo_id uuid, p_destino_turma_id uuid, p_pedido_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_ano_destino int;
  v_turma record;
  v_origem record;
  v_destino record;
  v_ocupacao int;
  v_criada boolean := false;
  v_classe_origem record;
  v_classe_destino record;
  v_numero_origem int;
  v_numero_destino int;
  v_numero_matricula bigint;
  v_raa jsonb;
  v_decision text;
  v_decisao_origem text;
  v_retido boolean := false;
  v_actor_id uuid := public.safe_auth_uid();
  v_jwt_role text := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
  );
BEGIN
  -- service_role continua autorizado para operações internas confiáveis. Para
  -- qualquer sessão humana, a identidade e o vínculo/papel na escola são
  -- obrigatórios. user_has_role_in_school() é auth.uid()-scoped e trata os
  -- papéis compostos (secretaria_financeiro/admin_financeiro) canonicamente.
  IF v_jwt_role IS DISTINCT FROM 'service_role' THEN
    IF v_actor_id IS NULL THEN
      RAISE EXCEPTION 'AUTH_REQUIRED: utilizador autenticado é obrigatório'
        USING ERRCODE = '42501';
    END IF;

    IF NOT public.user_has_role_in_school(
      p_escola_id,
      ARRAY[
        'secretaria',
        'secretaria_financeiro',
        'admin_financeiro',
        'admin',
        'admin_escola',
        'staff_admin'
      ]::text[]
    ) THEN
      RAISE EXCEPTION 'AUTH_FORBIDDEN: sem permissão para concluir rematrícula nesta escola'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT al.ano INTO v_ano_destino
  FROM public.anos_letivos al
  WHERE al.id = p_ano_letivo_id
    AND al.escola_id = p_escola_id
    AND al.ativo = true;
  IF v_ano_destino IS NULL THEN RAISE EXCEPTION 'Ano letivo destino inválido'; END IF;

  SELECT t.id, t.session_id, t.ano_letivo, t.capacidade_maxima, t.status_fecho
    INTO v_turma
  FROM public.turmas t
  WHERE t.id = p_destino_turma_id
    AND t.escola_id = p_escola_id
    AND t.session_id = p_ano_letivo_id
    AND t.ano_letivo = v_ano_destino;
  IF v_turma.id IS NULL THEN RAISE EXCEPTION 'Turma destino não pertence ao ano letivo seleccionado'; END IF;
  IF lower(coalesce(v_turma.status_fecho, 'aberto')) NOT IN ('aberto', 'open', '') THEN RAISE EXCEPTION 'Turma destino está fechada'; END IF;

  SELECT m.* INTO v_origem
  FROM public.matriculas m
  WHERE m.id = p_matricula_origem_id
    AND m.escola_id = p_escola_id
    AND m.aluno_id = p_aluno_id
  FOR UPDATE;
  IF v_origem.id IS NULL THEN RAISE EXCEPTION 'Matrícula de origem não encontrada'; END IF;
  IF v_origem.ano_letivo IS NULL OR v_origem.ano_letivo >= v_ano_destino THEN RAISE EXCEPTION 'Matrícula de origem não é de um ano anterior'; END IF;

  SELECT m.* INTO v_destino
  FROM public.matriculas m
  WHERE m.escola_id = p_escola_id
    AND m.aluno_id = p_aluno_id
    AND m.session_id = p_ano_letivo_id
    AND m.ano_letivo = v_ano_destino
  ORDER BY CASE WHEN lower(coalesce(m.status, '')) IN ('ativo', 'ativa', 'active') THEN 0 ELSE 1 END,
           m.created_at DESC NULLS LAST
  LIMIT 1
  FOR UPDATE;

  IF public.canonicalize_matricula_status_text(v_origem.status)
     NOT IN ('ativo', 'pendente', 'concluido', 'transferido') THEN
    RAISE EXCEPTION 'Matrícula de origem não está elegível para rematrícula';
  END IF;

  v_raa := public.resolve_raa_progression_for_matricula(p_escola_id, v_origem.id);
  v_decision := lower(coalesce(v_raa->>'decision', ''));

  IF NOT (
    v_decision = 'transitou'
    OR (
      v_decision = 'inscricao_condicional'
      AND lower(coalesce(v_raa->>'destino', '')) = 'proxima_etapa'
      AND NOT coalesce((v_raa->>'efetivacao_matricula_bloqueada')::boolean, false)
    )
    OR (
      v_decision = 'retido'
      AND lower(coalesce(v_raa->>'destino', '')) = 'mesma_etapa'
    )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'REMATRICULA_ACADEMIC_BLOCKED',
      DETAIL = format(
        'O RAA não autoriza a efetivação da rematrícula; decisão=%s destino=%s bloqueada=%s.',
        nullif(v_decision, ''),
        nullif(lower(coalesce(v_raa->>'destino', '')), ''),
        coalesce((v_raa->>'efetivacao_matricula_bloqueada')::boolean, false)
      );
  END IF;

  v_retido := v_decision = 'retido';
  v_decisao_origem := v_decision;

  SELECT c.id, c.numero, c.nome, t.curso_id
    INTO v_classe_origem
  FROM public.turmas t
  LEFT JOIN public.classes c ON c.id = t.classe_id
  WHERE t.id = v_origem.turma_id AND t.escola_id = p_escola_id;
  v_numero_origem := COALESCE(v_classe_origem.numero,
    NULLIF((regexp_match(COALESCE(v_classe_origem.nome, ''), '(\d{1,2})'))[1], '')::int);

  IF v_destino.id IS NULL THEN
    SELECT count(*)::int INTO v_ocupacao
    FROM public.matriculas m
    WHERE m.escola_id = p_escola_id
      AND m.turma_id = p_destino_turma_id
      AND m.session_id = p_ano_letivo_id
      AND lower(coalesce(m.status, '')) IN ('ativo', 'ativa', 'active');
    IF v_turma.capacidade_maxima IS NOT NULL AND v_ocupacao >= v_turma.capacidade_maxima THEN RAISE EXCEPTION 'Turma destino sem vagas'; END IF;

    INSERT INTO public.matriculas (
      id, escola_id, aluno_id, turma_id, session_id, ano_letivo,
      status, ativo, created_at, data_matricula, data_inicio_financeiro,
      origem_transicao_matricula_id
    ) VALUES (
      gen_random_uuid(), p_escola_id, p_aluno_id, p_destino_turma_id,
      p_ano_letivo_id, v_ano_destino, 'pendente', false, now(), CURRENT_DATE,
      CURRENT_DATE, p_matricula_origem_id
    ) RETURNING * INTO v_destino;
    v_criada := true;
  ELSE
    UPDATE public.matriculas
       SET turma_id = p_destino_turma_id,
           session_id = p_ano_letivo_id,
           ano_letivo = v_ano_destino,
           data_inicio_financeiro = coalesce(data_inicio_financeiro, CURRENT_DATE),
           origem_transicao_matricula_id = coalesce(origem_transicao_matricula_id, p_matricula_origem_id)
     WHERE id = v_destino.id;
    SELECT * INTO v_destino FROM public.matriculas WHERE id = v_destino.id;
  END IF;

  SELECT c.id, c.numero, c.nome, t.curso_id
    INTO v_classe_destino
  FROM public.turmas t
  LEFT JOIN public.classes c ON c.id = t.classe_id
  WHERE t.id = p_destino_turma_id AND t.escola_id = p_escola_id;
  v_numero_destino := COALESCE(v_classe_destino.numero,
    NULLIF((regexp_match(COALESCE(v_classe_destino.nome, ''), '(\d{1,2})'))[1], '')::int);

  IF v_numero_origem IS NOT NULL AND v_numero_destino IS NOT NULL THEN
    IF v_retido THEN
      IF v_numero_destino <> v_numero_origem THEN
        RAISE EXCEPTION 'Turma destino inválida: aluno retido deve repetir a mesma classe';
      END IF;
    ELSE
      IF v_numero_origem = 12 THEN RAISE EXCEPTION 'Aluno da 12ª classe não tem classe seguinte para rematrícula'; END IF;
      IF v_numero_destino <> v_numero_origem + 1 THEN
        RAISE EXCEPTION 'Turma destino inválida: aluno aprovado deve seguir para a classe imediatamente seguinte';
      END IF;
    END IF;
  END IF;
  IF v_classe_origem.curso_id IS NOT NULL AND v_classe_destino.curso_id IS NOT NULL AND v_classe_origem.curso_id <> v_classe_destino.curso_id THEN
    RAISE EXCEPTION 'Turma destino pertence a outro curso';
  END IF;

  -- O resultado deve existir no historico antes de encerrar a fonte.
  IF v_decision IN ('transitou','retido')
     AND public.canonicalize_matricula_status_text(v_origem.status) IN ('ativo','pendente') THEN
    IF v_jwt_role='service_role' THEN
      RAISE EXCEPTION 'ACADEMIC_AUTHOR_REQUIRED: fecho historico exige operador da escola' USING ERRCODE='42501';
    END IF;
    PERFORM public.finalizar_origem_academica(
      p_escola_id,v_origem.id,
      CASE WHEN v_retido THEN 'reprovado' ELSE 'aprovado' END,
      'raa','Decisao RAA verificada na rematricula do Balcao',NULL
    );
  END IF;

  IF lower(coalesce(v_destino.status, '')) NOT IN ('ativo', 'ativa', 'active')
     OR v_destino.numero_matricula IS NULL OR btrim(v_destino.numero_matricula::text) = '' THEN
    v_numero_matricula := public.confirmar_matricula_core(p_aluno_id, v_ano_destino, p_destino_turma_id, v_destino.id);
  END IF;

  UPDATE public.matriculas
     SET status = 'ativo', ativo = true, turma_id = p_destino_turma_id,
         session_id = p_ano_letivo_id, ano_letivo = v_ano_destino, updated_at = now()
   WHERE id = v_destino.id;
  SELECT * INTO v_destino FROM public.matriculas WHERE id = v_destino.id;

  UPDATE public.matriculas
     SET status = 'concluido',
         ativo = false,
         motivo_fecho = coalesce(
           motivo_fecho,
           CASE
             WHEN v_retido THEN 'Resultado académico retido; repetição confirmada no ano letivo destino'
             ELSE 'Resultado académico concluído; rematrícula confirmada no ano letivo destino'
           END
         ),
         data_fecho = coalesce(data_fecho, now()), updated_at = now()
   WHERE id = p_matricula_origem_id AND id <> v_destino.id
    AND v_decision IN ('transitou','retido');

  UPDATE public.servico_pedidos
     SET status = 'granted', matricula_id = v_destino.id,
         contexto = coalesce(contexto, '{}'::jsonb) || jsonb_build_object(
           'matricula_destino_id', v_destino.id,
           'ano_letivo_id', p_ano_letivo_id,
           'destino_turma_id', p_destino_turma_id,
           'matricula_criada', v_criada,
           'decisao_academica', v_decisao_origem
         )
   WHERE id = p_pedido_id AND escola_id = p_escola_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido de rematrícula não encontrado'; END IF;

  RETURN jsonb_build_object(
    'ok', true, 'matricula_id', v_destino.id,
    'numero_matricula', v_destino.numero_matricula,
    'turma_id', p_destino_turma_id, 'ano_letivo_id', p_ano_letivo_id,
    'matricula_criada', v_criada, 'raa', v_raa,
    'decisao_academica', v_decisao_origem
  );
END;
$function$


CREATE OR REPLACE FUNCTION public.fn_transitar_alunos(p_escola_id uuid, p_turma_origem_id uuid, p_turma_destino_id uuid, p_ano_letivo_origem integer, p_ano_letivo_dest integer, p_aluno_ids uuid[])
 RETURNS TABLE(aluno_id uuid, sucesso boolean, erro text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_escola_id uuid := public.current_tenant_escola_id();
  v_aluno_id uuid;
  v_matricula_origem record;
  v_turma_destino record;
  v_tem_curriculo_publicado boolean;
  v_total_em_atraso numeric(14,2);
BEGIN
  IF v_escola_id IS NULL OR p_escola_id IS DISTINCT FROM v_escola_id THEN
    RAISE EXCEPTION 'AUTH: escola_id inválido.';
  END IF;

  IF NOT public.user_has_role_in_school(v_escola_id, ARRAY['secretaria', 'admin', 'admin_escola', 'staff_admin']) THEN
    RAISE EXCEPTION 'AUTH: Permissão negada.';
  END IF;

  SELECT t.id, t.curso_id, t.classe_id, t.ano_letivo
  INTO v_turma_destino
  FROM public.turmas t
  WHERE t.id = p_turma_destino_id
    AND t.escola_id = p_escola_id;

  IF v_turma_destino.id IS NULL THEN
    RAISE EXCEPTION 'DATA: Turma de destino não encontrada.';
  END IF;

  IF v_turma_destino.ano_letivo <> p_ano_letivo_dest THEN
    RAISE EXCEPTION 'LOGIC: Turma de destino fora do ano letivo de destino.';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.anos_letivos al
    JOIN public.curso_curriculos cc ON cc.ano_letivo_id = al.id
    WHERE al.escola_id = p_escola_id
      AND al.ano = p_ano_letivo_dest
      AND cc.escola_id = p_escola_id
      AND cc.curso_id = v_turma_destino.curso_id
      AND (cc.classe_id IS NULL OR cc.classe_id = v_turma_destino.classe_id)
      AND cc.status = 'published'
  ) INTO v_tem_curriculo_publicado;

  IF NOT v_tem_curriculo_publicado THEN
    RAISE EXCEPTION 'LOGIC: Estrutura académica do ano destino não está pronta (currículo não publicado).';
  END IF;

  FOREACH v_aluno_id IN ARRAY p_aluno_ids LOOP
    BEGIN
      SELECT m.id, m.status, m.aluno_id
      INTO v_matricula_origem
      FROM public.matriculas m
      WHERE m.aluno_id = v_aluno_id
        AND m.turma_id = p_turma_origem_id
        AND m.ano_letivo = p_ano_letivo_origem
        AND m.escola_id = p_escola_id
      LIMIT 1;

      IF v_matricula_origem.id IS NULL THEN
        RETURN QUERY SELECT v_aluno_id, false, 'Matrícula de origem não encontrada';
        CONTINUE;
      END IF;

      IF public.canonicalize_matricula_status_text(v_matricula_origem.status) <> 'concluido'
         OR NOT EXISTS (
           SELECT 1 FROM public.v_student_lifecycle_ssot_v1 ssot
           WHERE ssot.matricula_id=v_matricula_origem.id AND ssot.escola_id=p_escola_id
             AND ssot.resultado_oficial='aprovado'
         ) THEN
        RETURN QUERY SELECT v_aluno_id,false,'A transicao exige resultado academico oficial aprovado';
        CONTINUE;
      END IF;

      SELECT COALESCE(SUM(GREATEST(COALESCE(m.valor_previsto, m.valor, 0) - COALESCE(m.valor_pago_total, 0), 0)), 0)
      INTO v_total_em_atraso
      FROM public.mensalidades m
      WHERE m.escola_id = p_escola_id
        AND m.matricula_id = v_matricula_origem.id
        AND m.status NOT IN ('pago', 'isento', 'cancelado');

      IF COALESCE(v_total_em_atraso, 0) > 0 THEN
        RETURN QUERY SELECT v_aluno_id, false, 'Dívidas em aberto na matrícula anterior';
        CONTINUE;
      END IF;

      IF EXISTS (
        SELECT 1
        FROM public.matriculas m
        WHERE m.escola_id = p_escola_id
          AND m.aluno_id = v_aluno_id
          AND m.ano_letivo = p_ano_letivo_dest
          AND m.turma_id = p_turma_destino_id
      ) THEN
        RETURN QUERY SELECT v_aluno_id, false, 'Aluno já possui matrícula na turma de destino';
        CONTINUE;
      END IF;

      INSERT INTO public.matriculas (
        escola_id,
        aluno_id,
        turma_id,
        ano_letivo,
        session_id,
        status,
        ativo,
        data_matricula,
        origem_transicao_matricula_id,
        created_at,
        updated_at
      )
      VALUES (
        p_escola_id,
        v_aluno_id,
        p_turma_destino_id,
        p_ano_letivo_dest,
        (select al.id from public.anos_letivos al where al.escola_id = p_escola_id and al.ano = p_ano_letivo_dest limit 1),
        'pendente',
        true,
        CURRENT_DATE,
        v_matricula_origem.id,
        now(),
        now()
      );

      RETURN QUERY SELECT v_aluno_id, true, NULL::text;
    EXCEPTION
      WHEN OTHERS THEN
        RETURN QUERY SELECT v_aluno_id, false, SQLERRM;
    END;
  END LOOP;
END;
$function$


CREATE OR REPLACE FUNCTION public.guard_matricula_status_numero()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
begin
  -- normaliza status antes (se teu canonicalize roda em trigger separado, ok)
  if new.status = 'ativo' then
    if new.numero_matricula is null or btrim(new.numero_matricula::text) = '' then
      raise exception 'Matrícula não pode ficar ativa sem numero_matricula. Use confirmar_matricula().';
    end if;
  end if;

  -- se for pendente, força numero_matricula NULL (evita "pendente com número")
  if new.status in ('pendente','rascunho') then
    new.numero_matricula := null;
  end if;

  return new;
end;
$function$


CREATE OR REPLACE FUNCTION public.rematricula_em_massa(p_escola_id uuid, p_origem_turma_id uuid, p_destino_turma_id uuid)
 RETURNS TABLE(inserted jsonb, skipped jsonb, errors jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_id uuid := public.safe_auth_uid();
  v_source record;
  -- record keeps the migration compilable in the minimal CI harness while
  -- preserving runtime row shapes in production.
  v_source_turma record;
  v_target_turma record;
  v_target record;
  v_dest_session uuid;
  v_dest_ano integer;
  v_source_ano integer;
  v_exame_fim date;
  v_source_number integer;
  v_target_number integer;
  v_expected_number integer;
  v_occupancy integer;
  v_balance numeric;
  v_raa jsonb;
  v_decision text;
  v_retido boolean;
  v_target_id uuid;
  v_inserted jsonb := '[]'::jsonb;
  v_skipped jsonb := '[]'::jsonb;
  v_errors jsonb := '[]'::jsonb;
BEGIN
  IF public.current_tenant_escola_id() IS DISTINCT FROM p_escola_id THEN
    RAISE EXCEPTION 'AUTH: escola_id inválido';
  END IF;
  IF NOT public.user_has_role_in_school(
    p_escola_id,
    ARRAY['admin','admin_escola','staff_admin','admin_secretaria','diretor','secretaria']
  ) THEN
    RAISE EXCEPTION 'AUTH: permissão negada';
  END IF;

  SELECT * INTO v_source_turma
  FROM public.turmas
  WHERE id = p_origem_turma_id
    AND escola_id = p_escola_id;
  SELECT * INTO v_target_turma
  FROM public.turmas
  WHERE id = p_destino_turma_id
    AND escola_id = p_escola_id;
  IF v_source_turma.id IS NULL OR v_target_turma.id IS NULL THEN
    RAISE EXCEPTION 'DATA: turma de origem ou destino inválida';
  END IF;
  IF v_target_turma.session_id IS NULL OR v_target_turma.ano_letivo IS NULL THEN
    RAISE EXCEPTION 'DATA: turma de destino sem ano letivo válido';
  END IF;
  IF v_target_turma.curso_id IS DISTINCT FROM v_source_turma.curso_id THEN
    RAISE EXCEPTION 'DATA: turma destino pertence a outro curso';
  END IF;

  v_dest_session := v_target_turma.session_id;
  v_dest_ano := v_target_turma.ano_letivo;
  v_source_ano := v_source_turma.ano_letivo;
  IF v_source_ano IS NULL OR v_source_ano >= v_dest_ano THEN
    RAISE EXCEPTION 'DATA: ano letivo de destino deve ser posterior ao de origem';
  END IF;
  v_source_number := public.turma_classe_numero(v_source_turma.id);
  v_target_number := public.turma_classe_numero(v_target_turma.id);
  IF v_source_number IS NULL OR v_target_number IS NULL THEN
    RAISE EXCEPTION 'DATA: classe da turma de origem ou destino não pôde ser determinada';
  END IF;

  SELECT max(ce.data_fim) INTO v_exame_fim
  FROM public.calendario_eventos ce
  JOIN public.anos_letivos al ON al.id = ce.ano_letivo_id AND al.escola_id = ce.escola_id
  WHERE ce.escola_id = p_escola_id
    AND ce.tipo = 'EXAME_NACIONAL'
    AND al.ano = v_source_ano;
  IF v_exame_fim IS NOT NULL AND CURRENT_DATE <= v_exame_fim THEN
    RAISE EXCEPTION 'BLOQUEIO: a transição não é permitida antes do término dos Exames Nacionais (%)',
      to_char(v_exame_fim, 'DD/MM/YYYY');
  END IF;

  FOR v_source IN
    SELECT m.*
    FROM public.matriculas m
    WHERE m.escola_id = p_escola_id
      AND m.turma_id = p_origem_turma_id
      AND public.canonicalize_matricula_status_text(m.status) IN ('ativo', 'concluido', 'transferido')
    ORDER BY m.id
    FOR UPDATE
  LOOP
    BEGIN
      SELECT m.* INTO v_target
      FROM public.matriculas m
      WHERE m.escola_id = p_escola_id
        AND m.aluno_id = v_source.aluno_id
        AND m.session_id = v_dest_session
        AND m.ano_letivo = v_dest_ano
      ORDER BY CASE WHEN public.canonicalize_matricula_status_text(m.status) = 'ativo' THEN 0 ELSE 1 END,
               m.created_at DESC NULLS LAST,
               m.id DESC
      LIMIT 1
      FOR UPDATE;

      IF v_target.id IS NOT NULL
         AND public.canonicalize_matricula_status_text(v_target.status) = 'ativo' THEN
        v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
          'matricula_id', v_source.id,
          'aluno_id', v_source.aluno_id,
          'motivos', jsonb_build_array('ja_ativo')
        ));
        CONTINUE;
      END IF;
      IF public.canonicalize_matricula_status_text(v_source.status) = 'transferido'
         AND v_target.id IS NULL THEN
        v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
          'matricula_id', v_source.id,
          'aluno_id', v_source.aluno_id,
          'motivos', jsonb_build_array('origem_transferida_sem_reserva')
        ));
        CONTINUE;
      END IF;

      v_raa := public.resolve_raa_progression_for_matricula(p_escola_id, v_source.id);
      v_decision := v_raa->>'decision';
      IF NOT (
        v_decision = 'transitou'
        OR (
          v_decision = 'inscricao_condicional'
          AND lower(coalesce(v_raa->>'destino', '')) = 'proxima_etapa'
          AND NOT coalesce((v_raa->>'efetivacao_matricula_bloqueada')::boolean, false)
        )
        OR (
          v_decision = 'retido'
          AND lower(coalesce(v_raa->>'destino', '')) = 'mesma_etapa'
        )
      ) THEN
        v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
          'matricula_id', v_source.id,
          'aluno_id', v_source.aluno_id,
          'motivos', jsonb_build_array('raa_' || coalesce(v_decision, 'invalida')),
          'raa', v_raa
        ));
        CONTINUE;
      END IF;

      v_retido := v_decision = 'retido';
      v_expected_number := CASE WHEN v_retido THEN v_source_number ELSE v_source_number + 1 END;
      IF v_target_number IS DISTINCT FROM v_expected_number THEN
        v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
          'matricula_id', v_source.id,
          'aluno_id', v_source.aluno_id,
          'motivos', jsonb_build_array('turma_destino_incompativel'),
          'raa', v_raa
        ));
        CONTINUE;
      END IF;

      SELECT coalesce(sum(
        greatest(coalesce(me.valor_previsto, me.valor, 0) - coalesce(me.valor_pago_total, 0), 0)
      ), 0)
      INTO v_balance
      FROM public.mensalidades me
      WHERE me.escola_id = p_escola_id
        AND me.aluno_id = v_source.aluno_id
        AND (me.matricula_id = v_source.id OR me.ano_referencia = v_source.ano_letivo)
        AND lower(coalesce(me.status, '')) NOT IN ('pago', 'isento', 'cancelado')
        AND me.data_vencimento < CURRENT_DATE;
      IF v_balance > 0 THEN
        v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
          'matricula_id', v_source.id,
          'aluno_id', v_source.aluno_id,
          'motivos', jsonb_build_array('saldo_devedor'),
          'divida_total', v_balance
        ));
        CONTINUE;
      END IF;

      SELECT count(*)::integer INTO v_occupancy
      FROM public.matriculas m
      WHERE m.escola_id = p_escola_id
        AND m.turma_id = p_destino_turma_id
        AND m.session_id = v_dest_session
        AND m.id IS DISTINCT FROM v_target.id
        AND public.canonicalize_matricula_status_text(m.status) IN ('ativo', 'pendente');
      IF v_target_turma.capacidade_maxima IS NOT NULL AND v_occupancy >= v_target_turma.capacidade_maxima THEN
        v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
          'matricula_id', v_source.id,
          'aluno_id', v_source.aluno_id,
          'motivos', jsonb_build_array('turma_sem_vagas')
        ));
        CONTINUE;
      END IF;

      -- A decisao ja foi resolvida pelo RAA, mas antes da escrita
      -- do destino precisamos registar o resultado na fonte academica.
      IF v_decision IN ('transitou','retido')
         AND public.canonicalize_matricula_status_text(v_source.status) IN ('ativo','pendente') THEN
        PERFORM public.finalizar_origem_academica(
          p_escola_id,v_source.id,
          CASE WHEN v_retido THEN 'reprovado' ELSE 'aprovado' END,
          'raa','Decisao RAA verificada na rematricula em massa',NULL
        );
      END IF;

      IF v_target.id IS NULL THEN
        INSERT INTO public.matriculas (
          id, escola_id, aluno_id, turma_id, session_id, ano_letivo,
          status, ativo, created_at, updated_at, data_matricula,
          origem_transicao_matricula_id
        ) VALUES (
          gen_random_uuid(), p_escola_id, v_source.aluno_id, p_destino_turma_id,
          v_dest_session, v_dest_ano, 'pendente', false, now(), now(), CURRENT_DATE,
          v_source.id
        ) RETURNING id INTO v_target_id;
      ELSE
        v_target_id := v_target.id;
        UPDATE public.matriculas
        SET turma_id = p_destino_turma_id,
            session_id = v_dest_session,
            ano_letivo = v_dest_ano,
            origem_transicao_matricula_id = coalesce(origem_transicao_matricula_id, v_source.id),
            updated_at = now()
        WHERE id = v_target_id;
      END IF;

      PERFORM public.confirmar_matricula_core(v_source.aluno_id, v_dest_ano, p_destino_turma_id, v_target_id);
      UPDATE public.matriculas
      SET status = 'ativo',
          ativo = true,
          turma_id = p_destino_turma_id,
          session_id = v_dest_session,
          ano_letivo = v_dest_ano,
          data_inicio_financeiro = coalesce(data_inicio_financeiro, CURRENT_DATE),
          updated_at = now()
      WHERE id = v_target_id;

      UPDATE public.matriculas
      SET status = 'concluido',
          ativo = false,
          motivo_fecho = 'Rematrícula em massa confirmada no ano letivo destino',
          data_fecho = coalesce(data_fecho, now()),
          updated_at = now()
      WHERE id = v_source.id
        AND id <> v_target_id AND v_decision IN ('transitou','retido');

      INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, details, portal)
      VALUES (
        p_escola_id,
        v_actor_id,
        'REMATRICULA_EM_MASSA_CONFIRMADA',
        'matriculas',
        v_target_id::text,
        jsonb_build_object(
          'aluno_id', v_source.aluno_id,
          'matricula_origem_id', v_source.id,
          'turma_destino_id', p_destino_turma_id,
          'raa_decision', v_decision,
          'at', now()
        ),
        'secretaria'
      );

      v_inserted := v_inserted || jsonb_build_array(jsonb_build_object(
        'matricula_id', v_target_id,
        'aluno_id', v_source.aluno_id,
        'raa_decision', v_decision
      ));
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'matricula_id', v_source.id,
        'aluno_id', v_source.aluno_id,
        'error', SQLERRM
      ));
    END;
  END LOOP;

  RETURN QUERY SELECT v_inserted, v_skipped, v_errors;
END;
$function$


CREATE OR REPLACE FUNCTION public.trg_set_matricula_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_num bigint;
BEGIN
  IF NEW.status = 'ativo' AND (NEW.numero_matricula IS NULL OR btrim(NEW.numero_matricula) = '') THEN
    v_num := public.next_matricula_number(NEW.escola_id);
    NEW.numero_matricula := v_num::text; -- coluna é text
  END IF;

  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.finalizar_matricula_anual(
 p_escola_id uuid,p_matricula_id uuid,p_novo_status text,p_motivo text DEFAULT NULL::text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','public'
AS $annual$
DECLARE v_reply jsonb;
BEGIN
 IF lower(btrim(coalesce(p_novo_status,''))) NOT IN ('concluido','concluida') THEN
   RAISE EXCEPTION 'LIFECYCLE_CANONICAL_FLOW_REQUIRED: fecho academico exige GradeEngine; use fluxos proprios para transferencias' USING ERRCODE='23514';
 END IF;
 v_reply := public.finalizar_matricula_blindada(p_escola_id,p_matricula_id,p_motivo,false,NULL);
 IF v_reply->>'ok' IS DISTINCT FROM 'true' THEN
   RAISE EXCEPTION 'ACADEMIC_CLOSE_INCOMPLETE: %',coalesce(v_reply->>'message','pautas incompletas') USING ERRCODE='23514';
 END IF;
END;
$annual$;

-- No mutation of existing student grades or status as a prerequisite.
DO $guard$
BEGIN
 IF EXISTS(SELECT 1 FROM public.matriculas WHERE status NOT IN (
   'rascunho','pendente','ativo','concluido','transferido','anulado','trancado','desistente'
 )) THEN
   RAISE EXCEPTION 'LEGACY_STATUS_ROWS_REQUIRE_RECONCILIATION: dados antigos devem ser revistos antes de aplicar contrato' USING ERRCODE='23514';
 END IF;
END;
$guard$;

ALTER TABLE public.matriculas DROP CONSTRAINT matriculas_status_check;
ALTER TABLE public.matriculas ADD CONSTRAINT matriculas_status_check
CHECK (status IN ('rascunho','pendente','ativo','concluido','transferido','anulado','trancado','desistente')) NOT VALID;
ALTER TABLE public.matriculas VALIDATE CONSTRAINT matriculas_status_check;

ALTER TABLE public.matriculas DROP CONSTRAINT matriculas_numero_only_when_ativa;
ALTER TABLE public.matriculas ADD CONSTRAINT matriculas_numero_only_when_ativa
CHECK (
 (status <> 'ativo' OR (numero_matricula IS NOT NULL AND btrim(numero_matricula) <> ''))
 AND (status NOT IN ('pendente','rascunho') OR numero_matricula IS NULL OR btrim(numero_matricula) = '')
) NOT VALID;
ALTER TABLE public.matriculas VALIDATE CONSTRAINT matriculas_numero_only_when_ativa;

COMMENT ON COLUMN public.matriculas.status IS
'Contrato v3: rascunho, pendente, ativo, concluido, transferido, anulado, trancado, desistente. Reprovação/aprovação são resultados académicos em historico_anos.';
COMMIT;
