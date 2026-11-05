BEGIN;
-- Generated with supabase migration new; ordered after the two pending Balcão
-- migrations (repository chronology). No backfill or customer-data changes.
CREATE TABLE public.raa_eja_frequencias_oficiais (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 escola_id uuid NOT NULL REFERENCES public.escolas(id),
 matricula_id uuid NOT NULL REFERENCES public.matriculas(id),
 periodo_id uuid NOT NULL REFERENCES public.periodos_letivos(id),
 aulas_previstas integer NOT NULL CHECK(aulas_previstas BETWEEN 1 AND 10000),
 presencas integer NOT NULL CHECK(presencas>=0 AND presencas<=aulas_previstas),
 documento_fonte text NOT NULL CHECK(length(btrim(documento_fonte)) BETWEEN 5 AND 1000),
 fundamentacao text NOT NULL CHECK(length(btrim(fundamentacao)) BETWEEN 15 AND 1000),
 anterior_id uuid REFERENCES public.raa_eja_frequencias_oficiais(id),
 registado_por uuid NOT NULL REFERENCES auth.users(id),
 registado_em timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX ix_raa_eja_frequencias_contexto ON public.raa_eja_frequencias_oficiais
 (escola_id,matricula_id,periodo_id,registado_em DESC,id DESC);
ALTER TABLE public.raa_eja_frequencias_oficiais ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.raa_eja_frequencias_oficiais FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.raa_eja_frequencias_oficiais TO authenticated;
CREATE POLICY raa_eja_frequencias_read ON public.raa_eja_frequencias_oficiais FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.escola_users eu WHERE eu.escola_id=raa_eja_frequencias_oficiais.escola_id
 AND eu.user_id=(SELECT auth.uid()) AND eu.papel::text IN ('admin','admin_escola','diretor','secretaria','admin_secretaria','secretaria_financeiro')));

-- Read-through official attendance. Retifications append evidence; they never
-- rewrite the closed summary or raw lesson registers and remain authoritative
-- even if a background summary refresh runs later.
CREATE FUNCTION public.balcao_eja_frequencias(p_escola_id uuid,p_matricula_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE m public.matriculas%ROWTYPE; result jsonb;
BEGIN
 SELECT * INTO m FROM public.matriculas WHERE id=p_matricula_id AND escola_id=p_escola_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'ACADEMIC_SOURCE_NOT_FOUND' USING ERRCODE='22023'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.escola_users eu WHERE eu.escola_id=p_escola_id AND eu.user_id=auth.uid()
    AND eu.papel::text IN ('admin','admin_escola','diretor','staff_admin','secretaria','admin_secretaria','secretaria_financeiro','admin_financeiro','professor'))
    AND NOT public.portal_user_can_access_aluno(m.aluno_id)
    AND NOT (auth.uid() IS NULL AND coalesce(current_setting('role',true),'')='service_role') THEN
   RAISE EXCEPTION 'ACADEMIC_FORBIDDEN' USING ERRCODE='42501';
 END IF;
 SELECT coalesce(jsonb_agg(row_value||jsonb_build_object('version',md5(row_value::text)) ORDER BY numero),'[]'::jsonb) INTO result
 FROM (SELECT p.numero,jsonb_build_object('periodo_id',p.id,'numero',p.numero,'data_fim',p.data_fim,
   'aulas_previstas',coalesce(e.aulas_previstas,s.aulas_previstas),'presencas',coalesce(e.presencas,s.presencas),
   'evidence_id',e.id,'documento_fonte',e.documento_fonte,'base_aulas',s.aulas_previstas,'base_presencas',s.presencas,
   'pode_corrigir',p.data_fim<=(now() AT TIME ZONE 'Africa/Luanda')::date) AS row_value
 FROM public.periodos_letivos p
 LEFT JOIN LATERAL(SELECT sum(f.aulas_previstas)::integer AS aulas_previstas,sum(f.presencas)::integer AS presencas FROM public.frequencia_status_periodo f
   WHERE f.escola_id=p_escola_id AND f.matricula_id=m.id AND f.periodo_letivo_id=p.id) s ON true
 LEFT JOIN LATERAL(SELECT f.* FROM public.raa_eja_frequencias_oficiais f WHERE f.escola_id=p_escola_id
   AND f.matricula_id=m.id AND f.periodo_id=p.id ORDER BY f.registado_em DESC,f.id DESC LIMIT 1) e ON true
 WHERE p.escola_id=p_escola_id AND p.ano_letivo_id=m.session_id AND p.tipo='TRIMESTRE' AND p.numero BETWEEN 1 AND 3) rows;
 RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.balcao_eja_frequencias(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.balcao_eja_frequencias(uuid,uuid) TO authenticated,service_role;

CREATE FUNCTION public.balcao_exam_progress(p_escola_id uuid,p_matricula_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE m public.matriculas%ROWTYPE; result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.escola_users eu WHERE eu.escola_id=p_escola_id AND eu.user_id=auth.uid()
   AND eu.papel::text IN ('admin','admin_escola','diretor','secretaria','admin_secretaria','secretaria_financeiro')) THEN
   RAISE EXCEPTION 'ACADEMIC_FORBIDDEN' USING ERRCODE='42501';
 END IF;
 SELECT * INTO m FROM public.matriculas WHERE id=p_matricula_id AND escola_id=p_escola_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'ACADEMIC_SOURCE_NOT_FOUND' USING ERRCODE='22023'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(s)||jsonb_build_object('componentes',c.componentes,'pendencias_publicacao',x.pendencias,'participantes_pendentes',x.participantes) ORDER BY s.data_inicio,s.id),'[]'::jsonb) INTO result
 FROM (SELECT id,tipo,estado,data_inicio FROM public.exame_sessoes WHERE escola_id=p_escola_id AND turma_id=m.turma_id
   AND ano_letivo_id=m.session_id AND estado IN ('aberta','publicada') ORDER BY data_inicio DESC,id DESC LIMIT 50) s
 CROSS JOIN LATERAL(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'codigo',codigo,'nota_max',nota_max) ORDER BY codigo,id),'[]'::jsonb) componentes,count(*) n
   FROM public.exame_componentes WHERE escola_id=p_escola_id AND exame_sessao_id=s.id) c
 CROSS JOIN LATERAL(SELECT coalesce(sum(g.pendente),0)::int pendencias,coalesce(jsonb_agg(g.participante ORDER BY g.matricula_id,g.turma_disciplina_id) FILTER(WHERE g.pendente>0 AND g.matricula_id<>m.id),'[]'::jsonb) participantes FROM (
   SELECT r.matricula_id,r.turma_disciplina_id,
     jsonb_build_object('matricula_id',r.matricula_id,'disciplina_id',td.avaliacao_disciplina_id,
       'nome',coalesce(to_jsonb(al)->>'nome','Participante'),'disciplina_nome',dc.nome) AS participante,
     (c.n-count(DISTINCT r.exame_componente_id) FILTER(WHERE r.estado='validado')) AS pendente
   FROM public.exame_resultados r
   JOIN public.matriculas mr ON mr.id=r.matricula_id AND mr.escola_id=p_escola_id
   JOIN public.alunos al ON al.id=mr.aluno_id
   JOIN public.turma_disciplinas td ON td.id=r.turma_disciplina_id AND td.escola_id=p_escola_id
   JOIN public.disciplinas_catalogo dc ON dc.id=td.avaliacao_disciplina_id AND dc.escola_id=p_escola_id
   WHERE r.escola_id=p_escola_id AND r.exame_sessao_id=s.id AND r.estado<>'anulado'
   GROUP BY r.matricula_id,r.turma_disciplina_id,td.avaliacao_disciplina_id,al.id,dc.nome) g) x;
 RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.balcao_exam_progress(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.balcao_exam_progress(uuid,uuid) TO authenticated;

DO $eja$
DECLARE definition text; start_at int; end_at int;
BEGIN
 SELECT pg_get_functiondef('public.resolve_raa_eja_oficial(uuid,uuid)'::regprocedure) INTO definition;
 start_at:=position(' SELECT sum(fsp.aulas_previstas)' IN definition);
 end_at:=position(' SELECT EXISTS(SELECT 1 FROM public.raa_indisciplina_eventos' IN definition);
 IF start_at=0 OR end_at<=start_at THEN RAISE EXCEPTION 'EJA frequency patch precondition failed'; END IF;
 definition:=substr(definition,1,start_at-1)||
 ' SELECT sum(f.aulas_previstas),sum(f.presencas),count(DISTINCT f.numero),
   bool_and(f.aulas_previstas>0 AND f.presencas BETWEEN 0 AND f.aulas_previstas)
 INTO aulas,presencas,period_count,frequency_complete
 FROM jsonb_to_recordset(public.balcao_eja_frequencias(p_escola_id,m.id))
 AS f(aulas_previstas integer,presencas integer,numero integer);
 '||substr(definition,end_at);
 -- Missing period totals must not be ignored by aggregate boolean null handling.
 definition:=replace(definition,'bool_and(f.aulas_previstas>0 AND f.presencas BETWEEN 0 AND f.aulas_previstas)',
   'bool_and(coalesce(f.aulas_previstas>0 AND f.presencas BETWEEN 0 AND f.aulas_previstas,false))');
 EXECUTE definition;
END;
$eja$;

DO $operations$
DECLARE definition text; marker text;
BEGIN
 SELECT pg_get_functiondef('public.balcao_resolver_academico(uuid,uuid,text,jsonb,uuid)'::regprocedure) INTO definition;
 definition:=replace(definition,' academic_before jsonb;', ' frequency_before jsonb; frequency_after jsonb; frequency_version text; frequency_old_id uuid; frequency_total integer; frequency_present integer;\n academic_before jsonb;');
 marker:=' ELSIF p_acao=''publicar_exame'' THEN';
 IF position(marker IN definition)=0 THEN RAISE EXCEPTION 'Guided operations patch precondition failed'; END IF;
 definition:=replace(definition,marker,
 ' ELSIF p_acao=''lancar_exame'' THEN
   SELECT * INTO session_row FROM public.exame_sessoes WHERE escola_id=p_escola_id AND id=(p_payload->>''sessao_id'')::uuid
    AND ano_letivo_id=m.session_id AND turma_id=m.turma_id FOR SHARE;
   IF NOT FOUND OR session_row.estado NOT IN (''aberta'',''publicada'') OR session_row.data_inicio>(now() AT TIME ZONE ''Africa/Luanda'')::date THEN
     RAISE EXCEPTION ''EXAM_SESSION_NOT_WRITABLE'' USING ERRCODE=''23514'';
   END IF;
   IF NOT EXISTS(SELECT 1 FROM public.turma_disciplinas td WHERE td.escola_id=p_escola_id AND td.turma_id=m.turma_id AND td.id=(p_payload->>''turma_disciplina_id'')::uuid) THEN
     RAISE EXCEPTION ''ACADEMIC_DISCIPLINE_MISMATCH'' USING ERRCODE=''22023'';
   END IF;
   INSERT INTO public.exame_resultados(escola_id,exame_sessao_id,exame_componente_id,matricula_id,aluno_id,turma_disciplina_id,nota,estado,lancado_por)
   VALUES(p_escola_id,session_row.id,(p_payload->>''componente_id'')::uuid,m.id,m.aluno_id,(p_payload->>''turma_disciplina_id'')::uuid,(p_payload->>''nota'')::numeric,''submetido'',actor) RETURNING id INTO entity;
   result:=jsonb_build_object(''ok'',true,''id'',entity,''estado'',''submetido'');
 ELSIF p_acao=''registar_frequencia_eja'' THEN
   IF regime->>''nivel_ensino'' IS DISTINCT FROM ''eja'' OR regime->>''escala'' IS DISTINCT FROM ''qualitativa'' THEN
     RAISE EXCEPTION ''EJA_OFFICIAL_EVIDENCE_REQUIRED'' USING ERRCODE=''22023'';
   END IF;
   SELECT * INTO period FROM public.periodos_letivos WHERE escola_id=p_escola_id AND ano_letivo_id=m.session_id
     AND id=(p_payload->>''periodo_id'')::uuid AND tipo=''TRIMESTRE'' AND numero BETWEEN 1 AND 3;
   IF NOT FOUND OR period.data_fim>(now() AT TIME ZONE ''Africa/Luanda'')::date THEN
     RAISE EXCEPTION ''EJA_ATTENDANCE_PERIOD_NOT_FINISHED'' USING ERRCODE=''23514'';
   END IF;
   SELECT item INTO frequency_before FROM jsonb_array_elements(public.balcao_eja_frequencias(p_escola_id,m.id)) item
     WHERE item->>''periodo_id''=period.id::text;
   frequency_version:=frequency_before->>''version'';
   frequency_old_id:=(frequency_before->>''evidence_id'')::uuid;
   IF frequency_version IS DISTINCT FROM p_payload->>''expected_version'' THEN RAISE EXCEPTION ''EJA_VERSION_CONFLICT'' USING ERRCODE=''23505''; END IF;
   IF length(btrim(coalesce(p_payload->>''documento_fonte'',''''))) NOT BETWEEN 5 AND 1000
     OR coalesce(p_payload->>''aulas_previstas'','''') !~ ''^[0-9]{1,5}$'' OR coalesce(p_payload->>''presencas'','''') !~ ''^[0-9]{1,5}$'' THEN
     RAISE EXCEPTION ''EJA_OFFICIAL_EVIDENCE_REQUIRED'' USING ERRCODE=''22023'';
   END IF;
   frequency_total:=(p_payload->>''aulas_previstas'')::integer; frequency_present:=(p_payload->>''presencas'')::integer;
   INSERT INTO public.raa_eja_frequencias_oficiais(escola_id,matricula_id,periodo_id,aulas_previstas,presencas,documento_fonte,fundamentacao,anterior_id,registado_por)
   VALUES(p_escola_id,m.id,period.id,frequency_total,frequency_present,btrim(p_payload->>''documento_fonte''),reason,frequency_old_id,actor) RETURNING id INTO entity;
   SELECT item INTO frequency_after FROM jsonb_array_elements(public.balcao_eja_frequencias(p_escola_id,m.id)) item WHERE item->>''periodo_id''=period.id::text;
   result:=jsonb_build_object(''ok'',true,''id'',entity,''frequency_before'',frequency_before,''frequency_after'',frequency_after);
 '||marker);
 -- PL/pgSQL definition needs a real newline in its declaration.
 definition:=replace(definition,'\n',E'\n');
 EXECUTE definition;
END;
$operations$;
COMMIT;
