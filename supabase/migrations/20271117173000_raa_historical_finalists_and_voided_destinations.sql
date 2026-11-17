-- RAA SSOT: (1) ignore cancelled enrolments when validating a prior-year
-- historical lock at CURTUME, (2) preserve the correct completed-cycle
-- outcome for ratified finalists without fabricating any grades or attendance.
-- No academic or financial data changes; operator must ratify from real pauta.
BEGIN;

CREATE OR REPLACE FUNCTION public.curtume_guard_legal_history_destination_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_origin public.matriculas%ROWTYPE;
  v_result text;
  v_source_grade integer;
  v_target_grade integer;
  v_target_id uuid;
  v_target_link uuid;
  v_target_count integer;
BEGIN
  IF NEW.status IS DISTINCT FROM 'fechado' OR NOT EXISTS (
    SELECT 1 FROM public.escolas e WHERE e.id=NEW.escola_id
      AND e.nome='COMPLEXO ESCOLAR PRIVADO ADVETISTA DE CURTUME'
  ) THEN RETURN NEW; END IF;

  SELECT * INTO v_origin FROM public.matriculas m
    WHERE m.id=NEW.matricula_id AND m.escola_id=NEW.escola_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACADEMIC_ORIGIN_MISSING' USING ERRCODE='23514';
  END IF;

  SELECT h.resultado_final INTO v_result FROM public.historico_anos h
  WHERE h.escola_id=NEW.escola_id AND h.matricula_id=v_origin.id
    AND h.aluno_id=v_origin.aluno_id AND h.ano_letivo=v_origin.ano_letivo;
  IF v_result NOT IN ('aprovado','reprovado','concluido') OR v_result IS NULL THEN
    RAISE EXCEPTION 'ACADEMIC_RESULT_NOT_VERIFIED' USING ERRCODE='23514';
  END IF;

  SELECT CASE WHEN c.nome='Pré-Escolar' THEN 0 ELSE c.numero END
    INTO v_source_grade FROM public.turmas t
    JOIN public.classes c ON c.id=t.classe_id AND c.escola_id=t.escola_id
    WHERE t.id=v_origin.turma_id AND t.escola_id=NEW.escola_id;

  SELECT count(*), min(d.id::text)::uuid, min(d.origem_transicao_matricula_id::text)::uuid
  INTO v_target_count, v_target_id, v_target_link
  FROM public.matriculas d
  WHERE d.escola_id=NEW.escola_id AND d.aluno_id=v_origin.aluno_id
    AND d.ano_letivo=v_origin.ano_letivo+1
    -- A voided/transferred/closed destination is not a current progression.
    AND public.canonicalize_matricula_status_text(d.status) IN ('ativo','pendente');

  IF v_target_count=0 THEN RETURN NEW; END IF; -- Leaving school or concluding cycle requires its own documented decision.
  IF v_target_count<>1 OR v_target_link IS DISTINCT FROM v_origin.id THEN
    RAISE EXCEPTION 'ACADEMIC_TRANSITION_LINK_REQUIRED: missing or mismatched historical origin'
      USING ERRCODE='23514';
  END IF;

  SELECT CASE WHEN c.nome='Pré-Escolar' THEN 0 ELSE c.numero END
    INTO v_target_grade FROM public.matriculas d
    JOIN public.turmas t ON t.id=d.turma_id AND t.escola_id=d.escola_id
    JOIN public.classes c ON c.id=t.classe_id AND c.escola_id=t.escola_id
    WHERE d.id=v_target_id AND d.escola_id=NEW.escola_id;
  IF v_source_grade IS NULL OR v_target_grade IS NULL
     OR (v_result='aprovado' AND v_target_grade<>v_source_grade+1)
     OR (v_result='reprovado' AND v_target_grade<>v_source_grade)
     OR v_result='concluido' THEN
    RAISE EXCEPTION 'ACADEMIC_DESTINATION_CONFLICT: reconcile class placement before legal close'
      USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END
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
  v_regime jsonb;
  v_terminale boolean;
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
      v_regime := public.resolve_regime_academico(v_historic.turma_id);
      -- Approved final-cycle learners have completed the cycle: do not
      -- reinterpret their ratified 9th-class approval as an ordinary move.
      v_terminale := v_historic.resultado = 'aprovado' AND (
        COALESCE((v_regime->>'eh_classe_exame')::boolean,false)
        OR (v_regime->>'nivel_ensino'='primario'
            AND (v_regime->>'classe_num')::integer=6)
        OR (v_regime->>'nivel_ensino'='secundario'
            AND (v_regime->>'classe_num')::integer=12)
        OR (v_regime->>'nivel_ensino'='eja'
            AND (COALESCE((v_regime->>'modulo_numero')::integer,0)=3
                 OR COALESCE((v_regime->>'ano_numero')::integer,0)=2))
      );
      RETURN jsonb_build_object(
        'decision', CASE WHEN v_terminale THEN 'concluiu' ELSE
          CASE v_historic.resultado WHEN 'aprovado' THEN 'transitou'
               WHEN 'reprovado' THEN 'retido' ELSE 'concluiu' END END,
        'destino', CASE WHEN v_terminale THEN 'conclusao' ELSE
          CASE v_historic.resultado WHEN 'aprovado' THEN 'proxima_etapa'
               WHEN 'reprovado' THEN 'mesma_etapa' ELSE 'conclusao' END END,
        'motivo','historico_documental_ratificado',
        'fonte_decisao','historico_documental_ratificado',
        'historico_ano_id',v_historic.historico_id,
        'disciplina_ids_pendentes','[]'::jsonb,
        'regime',v_regime,
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

COMMIT;
