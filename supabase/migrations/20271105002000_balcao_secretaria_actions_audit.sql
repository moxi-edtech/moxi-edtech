BEGIN;
-- User authorized secretaria to execute the Balcão operations and required
-- transactional audit in the follow-up request (2026-11-05).

-- Same curriculum formula as the installed MV, restricted to one enrolment and
-- discipline for transactional validation. No inline REFRESH and no new maths.
DO $live$
DECLARE definition text;
BEGIN
 definition:=rtrim(pg_get_viewdef('internal.mv_boletim_por_matricula'::regclass,true),E';\n ');
 IF definition IS NULL THEN RAISE EXCEPTION 'Boletim definition unavailable'; END IF;
 EXECUTE 'CREATE FUNCTION public.raa_nota_percurso_atual(p_escola_id uuid,p_matricula_id uuid,p_disciplina_id uuid)
 RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $body$
 DECLARE result numeric;
 BEGIN
   IF auth.uid() IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.escola_users eu
     WHERE eu.escola_id=p_escola_id AND eu.user_id=auth.uid()) AND NOT EXISTS(
     SELECT 1 FROM public.matriculas m WHERE m.escola_id=p_escola_id AND m.id=p_matricula_id
     AND public.portal_user_can_access_aluno(m.aluno_id)) THEN
     RAISE EXCEPTION ''ACADEMIC_FORBIDDEN'' USING ERRCODE=''42501'';
   END IF;
   SELECT avg(q.nota_final) INTO result FROM ('||definition||') q
     WHERE q.escola_id=p_escola_id AND q.matricula_id=p_matricula_id AND q.disciplina_id=p_disciplina_id;
   RETURN result;
 END; $body$';
END;
$live$;
REVOKE ALL ON FUNCTION public.raa_nota_percurso_atual(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
-- Internal only: invoked by the canonical SECURITY DEFINER result resolver.

-- Read the exact absences/decisions used by the transactional RAA, avoiding
-- paginated raw-frequency reads and never treating a query error as zero.
CREATE FUNCTION public.raa_faltas_atuais(p_escola_id uuid,p_matricula_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE m public.matriculas%ROWTYPE; counts jsonb;
BEGIN
 SELECT * INTO m FROM public.matriculas WHERE escola_id=p_escola_id AND id=p_matricula_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'ACADEMIC_SOURCE_NOT_FOUND' USING ERRCODE='22023'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.escola_users eu WHERE eu.escola_id=p_escola_id AND eu.user_id=auth.uid()
   AND eu.papel::text IN ('admin','admin_escola','diretor','staff_admin','secretaria','admin_secretaria','secretaria_financeiro','admin_financeiro','professor'))
   AND NOT public.portal_user_can_access_aluno(m.aluno_id)
   AND NOT (auth.uid() IS NULL AND coalesce(current_setting('role',true),'')='service_role') THEN
   RAISE EXCEPTION 'ACADEMIC_FORBIDDEN' USING ERRCODE='42501';
 END IF;
 SELECT coalesce(jsonb_object_agg(x.turma_disciplina_id::text,x.faltas),'{}'::jsonb) INTO counts FROM (
   SELECT td.id AS turma_disciplina_id,jsonb_build_array(
     count(*) FILTER(WHERE p.numero=1),count(*) FILTER(WHERE p.numero=2),count(*) FILTER(WHERE p.numero=3)) AS faltas
   FROM public.frequencias f JOIN public.aulas a ON a.id=f.aula_id AND a.escola_id=p_escola_id
   JOIN public.turma_disciplinas td ON td.id=a.turma_disciplina_id AND td.escola_id=p_escola_id AND td.turma_id=m.turma_id
   JOIN public.periodos_letivos p ON p.id=f.periodo_letivo_id AND p.escola_id=p_escola_id AND p.ano_letivo_id=m.session_id AND p.tipo='TRIMESTRE' AND p.numero BETWEEN 1 AND 3
   WHERE f.escola_id=p_escola_id AND f.matricula_id=m.id AND f.status='falta'
     AND NOT EXISTS(SELECT 1 FROM public.aluno_falta_justificacoes j WHERE j.escola_id=p_escola_id AND j.matricula_id=m.id AND j.frequencia_id=f.id AND j.status='approved')
   GROUP BY td.id
 ) x;
 RETURN jsonb_build_object('faltas_por_turma_disciplina',counts);
END;
$$;
REVOKE ALL ON FUNCTION public.raa_faltas_atuais(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.raa_faltas_atuais(uuid,uuid) TO authenticated,service_role;

DO $canonical$
DECLARE definition text; marker text;
BEGIN
 SELECT pg_get_functiondef('public.resolve_estado_resultado_academico_base(uuid,uuid)'::regprocedure) INTO definition;
 marker:='  SELECT AVG(v.nota_final)';
 IF position(marker IN definition)=0 THEN RAISE EXCEPTION 'Live grade patch precondition failed'; END IF;
 definition:=replace(definition,
   '  SELECT AVG(v.nota_final)
  INTO v_nota
  FROM internal.mv_boletim_por_matricula v
  WHERE v.escola_id = v_escola_id
    AND v.matricula_id = p_matricula_id
    AND v.disciplina_id = p_disciplina_id
    AND v.nota_final IS NOT NULL;',
   '  v_nota := public.raa_nota_percurso_atual(v_escola_id,p_matricula_id,p_disciplina_id);');
 IF position(marker IN definition)>0 THEN RAISE EXCEPTION 'Live grade patch did not match exact definition'; END IF;
 EXECUTE definition;
 -- Numeric primary and EJA module 3 use the canonical 0–10 scale (cutoff 5).
 SELECT pg_get_functiondef('public.resolve_raa_decreto_for_matricula(uuid,uuid)'::regprocedure) INTO definition;
 marker:='v_regime_codigo NOT IN (''eja_modulo_1'', ''eja_modulo_2'', ''eja_modulo_3'') AND v_nota < 10';
 IF position(marker IN definition)=0 THEN RAISE EXCEPTION 'Decree scale patch precondition failed'; END IF;
 definition:=replace(definition,marker,
   'v_regime_codigo NOT IN (''eja_modulo_1'', ''eja_modulo_2'') AND v_nota < (CASE WHEN v_regime_codigo IN (''classe_6'',''eja_modulo_3'') THEN 5 ELSE 10 END)');
 -- Preserve the same disciplinary and attendance gates in SQL and TS.
 definition:=replace(definition,'  v_area text;', '  v_area text; v_absences jsonb; v_attendance_blocked boolean:=false; v_pending_ids jsonb;');
 definition:=replace(definition,'  v_terminal :=',
 '  IF EXISTS(SELECT 1 FROM jsonb_array_elements(v_statuses) item WHERE item->>''status''=''reprovado_por_indisciplina'') THEN
    RETURN jsonb_build_object(''decision'',''retido_por_indisciplina'',''destino'',''mesma_etapa'',''motivo'',''indisciplina_grave'',''efetivacao_matricula_bloqueada'',true,''regime'',v_regime,''disciplinas'',v_statuses,''disciplina_ids_pendentes'',v_ids_negativos,''etapa_destino'',v_regime);
  END IF;
  v_absences:=public.raa_faltas_atuais(p_escola_id,p_matricula_id);
  SELECT EXISTS(SELECT 1 FROM public.turma_disciplinas td JOIN public.disciplinas_catalogo dc ON dc.id=td.avaliacao_disciplina_id AND dc.escola_id=p_escola_id
    CROSS JOIN LATERAL jsonb_array_elements_text(coalesce(v_absences->''faltas_por_turma_disciplina''->td.id::text,''[]''::jsonb)) value
    WHERE td.escola_id=p_escola_id AND td.turma_id=v_matricula.turma_id
      AND value::numeric >= CASE WHEN coalesce(td.carga_horaria_semanal,dc.carga_horaria_semana,0)<=1 THEN 3 WHEN coalesce(td.carga_horaria_semanal,dc.carga_horaria_semana,0)=2 THEN 4 ELSE 5 END) INTO v_attendance_blocked;
  IF v_attendance_blocked THEN
    RETURN jsonb_build_object(''decision'',''retido_por_faltas'',''destino'',''mesma_etapa'',''motivo'',''faltas'',''efetivacao_matricula_bloqueada'',true,''regime'',v_regime,''disciplinas'',v_statuses,''disciplina_ids_pendentes'',v_ids_negativos,''etapa_destino'',v_regime);
  END IF;
  v_terminal :=');
 EXECUTE definition;
END;
$canonical$;

ALTER POLICY raa_eja_avaliacoes_leitura_academica ON public.raa_eja_avaliacoes_oficiais
 USING(EXISTS(SELECT 1 FROM public.escola_users eu WHERE eu.escola_id=raa_eja_avaliacoes_oficiais.escola_id
 AND eu.user_id=(SELECT auth.uid()) AND eu.papel::text IN ('admin','admin_escola','diretor','secretaria','admin_secretaria','secretaria_financeiro')));
ALTER POLICY balcao_academic_operacoes_read ON public.balcao_academic_operacoes
 USING(EXISTS(SELECT 1 FROM public.escola_users eu WHERE eu.escola_id=balcao_academic_operacoes.escola_id
 AND eu.user_id=(SELECT auth.uid()) AND eu.papel::text IN ('admin','admin_escola','diretor','secretaria','admin_secretaria','secretaria_financeiro')));

-- The existing immutable-facts and decision-column grants remain in force.
ALTER POLICY reapreciacao_pedidos_director_decide ON public.reapreciacao_pedidos
 USING(public.user_can_access_raa_school(escola_id) AND public.raa_has_exact_school_role(escola_id,
 ARRAY['admin','admin_escola','diretor','admin_financeiro','secretaria','admin_secretaria','secretaria_financeiro']::text[]) AND estado IN ('pendente','em_analise'))
 WITH CHECK(public.user_can_access_raa_school(escola_id) AND public.raa_has_exact_school_role(escola_id,
 ARRAY['admin','admin_escola','diretor','admin_financeiro','secretaria','admin_secretaria','secretaria_financeiro']::text[]) AND
 ((estado='expirado' AND prazo_em<=now()) OR (estado IN ('em_analise','deferido','indeferido','cancelado') AND prazo_em>now()
 AND decidido_por=(SELECT auth.uid()) AND decidido_em IS NOT NULL AND length(btrim(coalesce(decisao_motivo,'')))>=5)));
ALTER POLICY raa_indisciplina_director_update_v2 ON public.raa_indisciplina_eventos
 USING(public.user_can_access_raa_school(escola_id) AND public.raa_has_exact_school_role(escola_id,
 ARRAY['admin','admin_escola','diretor','admin_financeiro','secretaria','admin_secretaria','secretaria_financeiro']::text[]) AND estado IN ('registado','em_analise'))
 WITH CHECK(public.user_can_access_raa_school(escola_id) AND public.raa_has_exact_school_role(escola_id,
 ARRAY['admin','admin_escola','diretor','admin_financeiro','secretaria','admin_secretaria','secretaria_financeiro']::text[])
 AND length(btrim(coalesce(decisao_motivo,'')))>=15 AND
 ((estado='em_analise' AND resolvido_por IS NULL AND resolvido_em IS NULL)
 OR (estado IN ('resolvido','cancelado') AND resolvido_por=(SELECT auth.uid()) AND resolvido_em IS NOT NULL)));
ALTER POLICY reapreciacao_pedidos_staff_file ON public.reapreciacao_pedidos WITH CHECK(
 public.user_can_access_raa_school(escola_id) AND public.raa_has_exact_school_role(escola_id,
 ARRAY['admin','admin_escola','staff_admin','diretor','secretaria','admin_secretaria','secretaria_financeiro','professor','admin_financeiro']::text[])
 AND solicitado_por=(SELECT auth.uid()) AND estado='pendente' AND decidido_por IS NULL AND decidido_em IS NULL AND decisao_motivo IS NULL AND resultado_publicado_em IS NOT NULL AND prazo_em>now());

ALTER POLICY aluno_falta_justificacoes_read ON public.aluno_falta_justificacoes USING(
 escola_id=public.current_tenant_escola_id() AND (public.portal_user_can_access_aluno(aluno_id)
 OR public.raa_has_exact_school_role(escola_id,ARRAY['diretor','admin','admin_escola','staff_admin','secretaria','admin_secretaria','secretaria_financeiro','admin_financeiro']::text[])));
ALTER POLICY aluno_falta_justificacoes_staff_decide ON public.aluno_falta_justificacoes
 USING(status='pending' AND escola_id=public.current_tenant_escola_id() AND public.raa_has_exact_school_role(escola_id,
 ARRAY['diretor','admin','admin_escola','staff_admin','secretaria','admin_secretaria','secretaria_financeiro','admin_financeiro']::text[]))
 WITH CHECK(status IN ('approved','rejected') AND reviewed_by=(SELECT auth.uid()) AND reviewed_at IS NOT NULL
 AND escola_id=public.current_tenant_escola_id() AND public.raa_has_exact_school_role(escola_id,
 ARRAY['diretor','admin','admin_escola','staff_admin','secretaria','admin_secretaria','secretaria_financeiro','admin_financeiro']::text[]));

-- New and existing grade-result callers share the same operational writer roles.
ALTER POLICY exame_resultados_insert_v2 ON public.exame_resultados
 WITH CHECK(public.user_can_access_raa_school(escola_id) AND public.raa_has_exact_school_role(escola_id,
 ARRAY['professor','secretaria','admin_secretaria','secretaria_financeiro','admin','admin_escola','staff_admin','diretor']::text[]));

-- Narrow lock helper: SELECT FOR SHARE would otherwise require the caller's
-- session UPDATE policy. Result writers must not receive session-management rights.
CREATE FUNCTION public.raa_lock_exam_session(p_escola_id uuid,p_sessao_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE state text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.escola_users eu WHERE eu.escola_id=p_escola_id AND eu.user_id=auth.uid()
   AND eu.papel::text IN ('professor','secretaria','admin_secretaria','secretaria_financeiro','admin','admin_escola','staff_admin','diretor'))
   AND NOT (auth.uid() IS NULL AND coalesce(current_setting('role',true),'') IN ('service_role','none')) THEN
   RAISE EXCEPTION 'ACADEMIC_FORBIDDEN' USING ERRCODE='42501';
 END IF;
 SELECT estado INTO state FROM public.exame_sessoes WHERE escola_id=p_escola_id AND id=p_sessao_id FOR SHARE;
 RETURN state;
END;
$$;
REVOKE ALL ON FUNCTION public.raa_lock_exam_session(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.raa_lock_exam_session(uuid,uuid) TO authenticated,service_role;

-- All result writes acquire the session lock before checking its state.
-- Publication cannot race a last component insertion or validation.
DO $exam_guard$
DECLARE definition text; marker text;
BEGIN
 SELECT pg_get_functiondef('public.raa_assert_exam_result_context_v2()'::regprocedure) INTO definition;
 marker:='BEGIN
  IF TG_OP=''INSERT'' THEN';
 IF position(marker IN definition)=0 THEN RAISE EXCEPTION 'Exam session lock patch precondition failed'; END IF;
 definition:=replace(definition,marker,
   'BEGIN
  IF coalesce(public.raa_lock_exam_session(NEW.escola_id,NEW.exame_sessao_id),'''') NOT IN (''aberta'',''publicada'') THEN
    RAISE EXCEPTION ''EXAM_SESSION_LOCKED'' USING ERRCODE=''23514'';
  END IF;
  IF TG_OP=''INSERT'' THEN');
 EXECUTE definition;
END;
$exam_guard$;

CREATE FUNCTION public.raa_guard_published_exam_components() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE session_state text;
BEGIN
 session_state:=public.raa_lock_exam_session(NEW.escola_id,NEW.exame_sessao_id);
 IF coalesce(session_state,'') NOT IN ('rascunho','aberta') THEN
   RAISE EXCEPTION 'EXAM_SESSION_LOCKED' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.raa_guard_published_exam_components() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER trg_raa_guard_published_exam_components BEFORE INSERT OR UPDATE ON public.exame_componentes
 FOR EACH ROW EXECUTE FUNCTION public.raa_guard_published_exam_components();

DO $operations$
DECLARE definition text; marker text;
BEGIN
 FOREACH marker IN ARRAY ARRAY['public.balcao_resolver_academico(uuid,uuid,text,jsonb,uuid)', 'public.balcao_concluir_publicacao(uuid,uuid,uuid,uuid,boolean)'] LOOP
   SELECT pg_get_functiondef(marker::regprocedure) INTO definition;
   IF position('(''admin'',''admin_escola'',''diretor'')' IN definition)=0 THEN RAISE EXCEPTION 'Operator role patch precondition failed'; END IF;
   definition:=replace(definition,'(''admin'',''admin_escola'',''diretor'')','(''admin'',''admin_escola'',''diretor'',''secretaria'',''admin_secretaria'',''secretaria_financeiro'')');
   EXECUTE definition;
 END LOOP;
 SELECT pg_get_functiondef('public.balcao_resolver_academico(uuid,uuid,text,jsonb,uuid)'::regprocedure) INTO definition;
 definition:=replace(definition,' publication public.pautas_oficiais%ROWTYPE;',
   ' academic_before jsonb; academic_after jsonb;
 publication public.pautas_oficiais%ROWTYPE;');
 marker:=' regime:=public.resolve_regime_academico(m.turma_id);';
 IF position(marker IN definition)=0 THEN RAISE EXCEPTION 'Academic snapshot patch precondition failed'; END IF;
 definition:=replace(definition,marker,marker||'
 BEGIN academic_before:=public.resolve_raa_decreto_for_matricula(p_escola_id,m.id);
 EXCEPTION WHEN OTHERS THEN academic_before:=jsonb_build_object(''unavailable'',true,''code'',SQLSTATE); END;');
 -- Lock the session before the result, matching the trigger/publication order.
 definition:=replace(definition,
   'AND escola_id=p_escola_id AND matricula_id=m.id FOR UPDATE;',
   'AND escola_id=p_escola_id AND matricula_id=m.id;');
 definition:=replace(definition,
   '   UPDATE public.exame_resultados SET estado=''validado'',updated_at=now()',
   '   PERFORM 1 FROM public.exame_resultados WHERE id=exam_row.id AND escola_id=p_escola_id AND estado=''submetido'' FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION ''EXAM_RESULT_NOT_SUBMITTED'' USING ERRCODE=''23514''; END IF;
   UPDATE public.exame_resultados SET estado=''validado'',updated_at=now()');
 marker:=' ELSE RAISE EXCEPTION ''ACADEMIC_ACTION_INVALID''';
 IF position(marker IN definition)=0 THEN RAISE EXCEPTION 'Exam publication patch precondition failed'; END IF;
 definition:=replace(definition,marker,
   ' ELSIF p_acao=''publicar_exame'' THEN
   SELECT * INTO session_row FROM public.exame_sessoes WHERE id=(p_payload->>''sessao_id'')::uuid
     AND escola_id=p_escola_id AND ano_letivo_id=m.session_id AND turma_id=m.turma_id FOR UPDATE;
   IF NOT FOUND OR session_row.estado NOT IN (''aberta'',''publicada'') OR session_row.data_inicio>(now() AT TIME ZONE ''Africa/Luanda'')::date THEN
     RAISE EXCEPTION ''EXAM_SESSION_NOT_PUBLISHABLE'' USING ERRCODE=''23514'';
   END IF;
   IF NOT EXISTS(SELECT 1 FROM public.exame_resultados r WHERE r.escola_id=p_escola_id AND r.exame_sessao_id=session_row.id AND r.matricula_id=m.id AND r.estado=''validado'')
     OR EXISTS(SELECT 1 FROM public.exame_resultados r WHERE r.escola_id=p_escola_id AND r.exame_sessao_id=session_row.id AND r.estado<>''anulado''
       GROUP BY r.matricula_id,r.turma_disciplina_id
       HAVING NOT bool_and(r.estado=''validado'') OR count(DISTINCT r.exame_componente_id)<>(SELECT count(*) FROM public.exame_componentes c WHERE c.escola_id=p_escola_id AND c.exame_sessao_id=session_row.id)) THEN
     RAISE EXCEPTION ''EXAM_COMPONENTS_NOT_VALIDATED'' USING ERRCODE=''23514'';
   END IF;
   UPDATE public.exame_sessoes SET estado=''encerrada'',updated_at=clock_timestamp() WHERE id=session_row.id AND escola_id=p_escola_id;
   entity:=session_row.id;
   result:=jsonb_build_object(''ok'',true,''id'',entity,''estado'',''encerrada'',''published'',true);
'||marker);
 marker:=' INSERT INTO public.balcao_academic_operacoes(escola_id,matricula_id,actor_id,chave,acao,payload,resultado)';
 IF position(marker IN definition)=0 THEN RAISE EXCEPTION 'Audit snapshot patch precondition failed'; END IF;
 definition:=replace(definition,marker,
   ' BEGIN academic_after:=public.resolve_raa_decreto_for_matricula(p_escola_id,m.id);
 EXCEPTION WHEN OTHERS THEN academic_after:=jsonb_build_object(''unavailable'',true,''code'',SQLSTATE); END;
 result:=result||jsonb_build_object(''academic_before'',academic_before,''academic_after'',academic_after);
'||marker);
 EXECUTE definition;
END;
$operations$;

-- Audit is in the same transaction, even when an older API uses a best-effort
-- logging helper or when an authorized operator calls the Data API directly.
CREATE FUNCTION public.raa_audit_operational_mutation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE before_row jsonb; after_row jsonb; payload jsonb;
BEGIN
 IF auth.uid() IS NULL AND current_setting('role',true) IS DISTINCT FROM 'service_role' THEN RETURN NEW; END IF;
 before_row:=CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
 after_row:=to_jsonb(NEW);
 payload:=jsonb_build_object('schema_version',1,'table',TG_TABLE_NAME,'operation',TG_OP,
   'matricula_id',after_row->'matricula_id','sessao_id',after_row->'exame_sessao_id',
   'before',jsonb_strip_nulls(jsonb_build_object('estado',before_row->'estado','status',before_row->'status','nota',before_row->'nota','codigo',before_row->'codigo','peso',before_row->'peso','nota_max',before_row->'nota_max','modalidade',before_row->'modalidade','data_inicio',before_row->'data_inicio','data_fim',before_row->'data_fim')),
   'after',jsonb_strip_nulls(jsonb_build_object('estado',after_row->'estado','status',after_row->'status','nota',after_row->'nota','codigo',after_row->'codigo','peso',after_row->'peso','nota_max',after_row->'nota_max','modalidade',after_row->'modalidade','data_inicio',after_row->'data_inicio','data_fim',after_row->'data_fim')),
   'motivo',coalesce(after_row->'decisao_motivo',after_row->'decision_reason',after_row->'motivo',after_row->'observacoes',after_row->'observacao'),
   'actor_type',CASE WHEN auth.uid() IS NULL THEN 'system' ELSE 'user' END);
 INSERT INTO public.audit_logs(escola_id,actor_id,action,entity,entity_id,portal,details)
 VALUES((after_row->>'escola_id')::uuid,auth.uid(),'RAA_OPERATION_'||upper(TG_TABLE_NAME)||'_'||TG_OP,TG_TABLE_NAME,after_row->>'id','secretaria',payload);
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.raa_audit_operational_mutation() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER trg_raa_exams_session_audit AFTER INSERT OR UPDATE ON public.exame_sessoes FOR EACH ROW EXECUTE FUNCTION public.raa_audit_operational_mutation();
CREATE TRIGGER trg_raa_exams_components_audit AFTER INSERT OR UPDATE ON public.exame_componentes FOR EACH ROW EXECUTE FUNCTION public.raa_audit_operational_mutation();
CREATE TRIGGER trg_raa_exams_results_audit AFTER INSERT OR UPDATE ON public.exame_resultados FOR EACH ROW EXECUTE FUNCTION public.raa_audit_operational_mutation();
CREATE TRIGGER trg_raa_appeal_audit AFTER INSERT OR UPDATE ON public.reapreciacao_pedidos FOR EACH ROW EXECUTE FUNCTION public.raa_audit_operational_mutation();
CREATE TRIGGER trg_raa_discipline_audit AFTER INSERT OR UPDATE ON public.raa_indisciplina_eventos FOR EACH ROW EXECUTE FUNCTION public.raa_audit_operational_mutation();
CREATE TRIGGER trg_raa_absence_audit AFTER INSERT OR UPDATE ON public.aluno_falta_justificacoes FOR EACH ROW EXECUTE FUNCTION public.raa_audit_operational_mutation();
COMMIT;
