BEGIN;
-- Approved in chat: APPROVE: f6bf391c-3b44-4d47-8d06-eaf3e996cea3.
-- No customer data backfill. Qualitative evidence is append-only.
CREATE TABLE public.raa_eja_avaliacoes_oficiais (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 escola_id uuid NOT NULL REFERENCES public.escolas(id),
 matricula_id uuid NOT NULL REFERENCES public.matriculas(id),
 disciplina_id uuid NOT NULL REFERENCES public.disciplinas_catalogo(id),
 suficiente boolean NOT NULL,
 documento_fonte text NOT NULL CHECK(length(btrim(documento_fonte))>=5),
 fundamentacao text NOT NULL CHECK(length(btrim(fundamentacao))>=15),
 registado_por uuid NOT NULL REFERENCES auth.users(id),
 registado_em timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX ix_raa_eja_avaliacoes_contexto ON public.raa_eja_avaliacoes_oficiais
 (escola_id,matricula_id,disciplina_id,registado_em DESC,id DESC);
ALTER TABLE public.raa_eja_avaliacoes_oficiais ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.raa_eja_avaliacoes_oficiais FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.raa_eja_avaliacoes_oficiais TO authenticated;
CREATE POLICY raa_eja_avaliacoes_leitura_academica ON public.raa_eja_avaliacoes_oficiais
 FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.escola_users eu
 WHERE eu.escola_id=raa_eja_avaliacoes_oficiais.escola_id AND eu.user_id=(SELECT auth.uid())
 AND eu.papel::text IN ('admin','admin_escola','diretor')));

CREATE VIEW public.vw_raa_eja_avaliacoes_atuais WITH (security_invoker=true) AS
 SELECT DISTINCT ON (escola_id,matricula_id,disciplina_id) id,escola_id,matricula_id,disciplina_id,suficiente,registado_em
 FROM public.raa_eja_avaliacoes_oficiais
 ORDER BY escola_id,matricula_id,disciplina_id,registado_em DESC,id DESC;
REVOKE ALL ON public.vw_raa_eja_avaliacoes_atuais FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.vw_raa_eja_avaliacoes_atuais TO authenticated;

CREATE TABLE public.balcao_academic_operacoes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 escola_id uuid NOT NULL REFERENCES public.escolas(id),
 matricula_id uuid NOT NULL REFERENCES public.matriculas(id),
 actor_id uuid NOT NULL REFERENCES auth.users(id),
 chave uuid NOT NULL,
 acao text NOT NULL,
 payload jsonb NOT NULL,
 resultado jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(actor_id,chave)
);
ALTER TABLE public.balcao_academic_operacoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.balcao_academic_operacoes FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.balcao_academic_operacoes TO authenticated;
CREATE POLICY balcao_academic_operacoes_read ON public.balcao_academic_operacoes
 FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.escola_users eu
 WHERE eu.escola_id=balcao_academic_operacoes.escola_id AND eu.user_id=(SELECT auth.uid())
 AND eu.papel::text IN ('admin','admin_escola','diretor')));

-- SECURITY DEFINER is necessary: direct writes are deliberately not granted.
-- Every call checks the live membership, school, source enrolment and curriculum.
CREATE FUNCTION public.balcao_resolver_academico(
 p_escola_id uuid,p_matricula_id uuid,p_acao text,p_payload jsonb,p_chave uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
DECLARE
 actor uuid:=auth.uid(); m public.matriculas%ROWTYPE; y public.anos_letivos%ROWTYPE;
 previous public.balcao_academic_operacoes%ROWTYPE;
 regime jsonb; result jsonb; entity uuid; old_id uuid; period public.periodos_letivos%ROWTYPE;
 session_row public.exame_sessoes%ROWTYPE; exam_row public.exame_resultados%ROWTYPE;
 discipline uuid; codes text[]; component jsonb; start_date date; end_date date;
 publication public.pautas_oficiais%ROWTYPE;
 max_note numeric; reason text:=btrim(p_payload->>'motivo');
BEGIN
 IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.escola_users eu
   WHERE eu.escola_id=p_escola_id AND eu.user_id=actor
   AND eu.papel::text IN ('admin','admin_escola','diretor')) THEN
   RAISE EXCEPTION 'ACADEMIC_FORBIDDEN' USING ERRCODE='42501';
 END IF;
 IF p_chave IS NULL OR p_payload IS NULL OR length(coalesce(reason,''))<15 OR length(reason)>1000 THEN
   RAISE EXCEPTION 'ACADEMIC_REASON_REQUIRED' USING ERRCODE='22023';
 END IF;
 -- Serialize a key even when requests refer to different enrolments.
 PERFORM pg_advisory_xact_lock(hashtextextended(actor::text||p_chave::text,0));
 SELECT * INTO previous FROM public.balcao_academic_operacoes WHERE actor_id=actor AND chave=p_chave;
 IF FOUND THEN
   IF (previous.escola_id,previous.matricula_id,previous.acao,previous.payload)
      IS DISTINCT FROM (p_escola_id,p_matricula_id,p_acao,p_payload) THEN
     RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT' USING ERRCODE='23505';
   END IF;
   IF p_acao='preparar_publicacao' AND previous.resultado->>'status'<>'SUCCESS' THEN
     SELECT * INTO m FROM public.matriculas WHERE id=p_matricula_id AND escola_id=p_escola_id FOR UPDATE;
     IF NOT FOUND OR m.status<>'ativo' OR m.ativo IS DISTINCT FROM true OR NOT EXISTS(SELECT 1 FROM public.anos_letivos ay WHERE ay.id=m.session_id AND ay.escola_id=p_escola_id AND ay.ativo=true) THEN
       RAISE EXCEPTION 'RAA_LEGAL_LOCK' USING ERRCODE='23514';
     END IF;
     SELECT * INTO publication FROM public.pautas_oficiais WHERE id=(previous.resultado->>'id')::uuid
       AND escola_id=p_escola_id FOR UPDATE;
     IF publication.status='PROCESSING' AND publication.updated_at>now()-interval '15 minutes' THEN
       RETURN previous.resultado||jsonb_build_object('busy',true);
     END IF;
     IF publication.hash IS DISTINCT FROM previous.resultado->>'token' THEN
       RAISE EXCEPTION 'ACADEMIC_PUBLICATION_SUPERSEDED' USING ERRCODE='23514';
     END IF;
     result:=previous.resultado||jsonb_build_object('token',gen_random_uuid(),'status','PROCESSING');
     result:=result||jsonb_build_object('pdf_path',p_escola_id::text||'/balcao/'||p_chave::text||'/'||(result->>'token')||'.pdf');
     UPDATE public.pautas_oficiais SET status='PROCESSING',hash=result->>'token',updated_at=now() WHERE id=publication.id AND escola_id=p_escola_id;
     UPDATE public.balcao_academic_operacoes SET resultado=result WHERE id=previous.id;
     RETURN result;
   END IF;
   RETURN previous.resultado||jsonb_build_object('idempotent',true);
 END IF;
 SELECT * INTO m FROM public.matriculas WHERE id=p_matricula_id AND escola_id=p_escola_id FOR UPDATE;
 IF NOT FOUND OR m.turma_id IS NULL OR m.session_id IS NULL THEN
   RAISE EXCEPTION 'ACADEMIC_SOURCE_NOT_FOUND' USING ERRCODE='22023';
 END IF;
 SELECT * INTO y FROM public.anos_letivos WHERE id=m.session_id AND escola_id=p_escola_id;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.turmas t WHERE t.id=m.turma_id AND t.escola_id=p_escola_id AND t.ano_letivo=y.ano) THEN RAISE EXCEPTION 'ACADEMIC_YEAR_MISMATCH' USING ERRCODE='22023'; END IF;
 -- Do not silently reopen a closed legal enrolment or the whole academic year.
 IF m.status<>'ativo' OR m.ativo IS DISTINCT FROM true THEN
   RAISE EXCEPTION 'RAA_LEGAL_LOCK' USING ERRCODE='23514';
 END IF;
 IF y.ativo IS DISTINCT FROM true THEN RAISE EXCEPTION 'ACADEMIC_YEAR_CLOSED' USING ERRCODE='23514'; END IF;
 regime:=public.resolve_regime_academico(m.turma_id);
 IF p_acao IN ('registar_eja','reabrir_periodo') THEN
   discipline:=(p_payload->>'disciplina_id')::uuid;
   IF NOT EXISTS(SELECT 1 FROM public.turma_disciplinas td JOIN public.disciplinas_catalogo dc ON dc.id=td.avaliacao_disciplina_id AND dc.escola_id=p_escola_id WHERE td.escola_id=p_escola_id
     AND td.turma_id=m.turma_id AND td.avaliacao_disciplina_id=discipline) THEN
     RAISE EXCEPTION 'ACADEMIC_DISCIPLINE_MISMATCH' USING ERRCODE='22023';
   END IF;
 END IF;
 IF p_acao='registar_eja' THEN
   IF regime->>'nivel_ensino' IS DISTINCT FROM 'eja' OR regime->>'escala' IS DISTINCT FROM 'qualitativa'
      OR NOT (p_payload ? 'suficiente') OR jsonb_typeof(p_payload->'suficiente')<>'boolean'
      OR length(btrim(coalesce(p_payload->>'documento_fonte','')))<5
      OR length(p_payload->>'documento_fonte')>1000 THEN
     RAISE EXCEPTION 'EJA_OFFICIAL_EVIDENCE_REQUIRED' USING ERRCODE='22023';
   END IF;
   SELECT id INTO old_id FROM public.raa_eja_avaliacoes_oficiais WHERE escola_id=p_escola_id
     AND matricula_id=m.id AND disciplina_id=discipline ORDER BY registado_em DESC,id DESC LIMIT 1;
   IF old_id IS DISTINCT FROM nullif(p_payload->>'expected_id','')::uuid THEN
     RAISE EXCEPTION 'EJA_VERSION_CONFLICT' USING ERRCODE='23505';
   END IF;
   INSERT INTO public.raa_eja_avaliacoes_oficiais(escola_id,matricula_id,disciplina_id,suficiente,
     documento_fonte,fundamentacao,registado_por)
   VALUES(p_escola_id,m.id,discipline,(p_payload->>'suficiente')::boolean,
     btrim(p_payload->>'documento_fonte'),reason,actor) RETURNING id INTO entity;
   result:=jsonb_build_object('ok',true,'id',entity,'previous_id',old_id);
 ELSIF p_acao='reabrir_periodo' THEN
   SELECT * INTO period FROM public.periodos_letivos WHERE id=(p_payload->>'periodo_id')::uuid
     AND escola_id=p_escola_id AND ano_letivo_id=m.session_id AND tipo='TRIMESTRE';
   IF NOT FOUND OR period.numero NOT BETWEEN 1 AND 3 OR period.data_inicio IS NULL
      OR period.data_fim IS NULL OR period.data_inicio>(now() AT TIME ZONE 'Africa/Luanda')::date THEN
     RAISE EXCEPTION 'ACADEMIC_PERIOD_INVALID' USING ERRCODE='22023';
   END IF;
   INSERT INTO public.excecoes_pauta(escola_id,turma_id,disciplina_id,trimestre,user_id,motivo,
     expira_em,criado_por,solicitado_por,aprovado_por,decidido_em,ano_letivo_id,status,decisao_motivo)
   VALUES(p_escola_id,m.turma_id,discipline,period.numero,actor,reason,now()+interval '24 hours',
     actor,actor,actor,now(),m.session_id,'APROVADO',reason) RETURNING id INTO entity;
   result:=jsonb_build_object('ok',true,'id',entity,'expira_em',now()+interval '24 hours',
     'turma_id',m.turma_id,'disciplina_id',discipline,'trimestre',period.numero);
 ELSIF p_acao='abrir_exame' THEN
   IF coalesce((regime->>'eh_classe_exame')::boolean,false) IS NOT TRUE
      AND NOT (coalesce(regime->'exames_aplicaveis','[]'::jsonb) ? (p_payload->>'tipo'))
      AND NOT (p_payload->>'tipo'='extraordinario' AND
        (coalesce((regime->>'classe_num')::int,0) IN (7,8,10,11) OR
         (coalesce(regime->>'nivel_ensino','')='eja' AND coalesce(regime->>'ano_numero','')='1'))) THEN
     RAISE EXCEPTION 'TURMA_NOT_EXAM_REGIME' USING ERRCODE='22023';
   END IF;
   start_date:=(p_payload->>'data_inicio')::date; end_date:=(p_payload->>'data_fim')::date;
   IF start_date IS NULL OR end_date IS NULL OR start_date>end_date
     OR start_date<y.data_inicio OR end_date>y.data_fim OR y.data_inicio IS NULL OR y.data_fim IS NULL
     OR p_payload->>'tipo' NOT IN ('recurso','extraordinario') THEN
     RAISE EXCEPTION 'EXAM_SESSION_OUTSIDE_ACADEMIC_YEAR' USING ERRCODE='22023';
   END IF;
   SELECT array_agg(c->>'codigo' ORDER BY c->>'codigo') INTO codes
     FROM jsonb_array_elements(p_payload->'componentes') c;
   IF codes IS DISTINCT FROM (CASE p_payload->>'modalidade'
     WHEN 'simples' THEN ARRAY['escrita'] WHEN 'escrita_oral' THEN ARRAY['escrita','oral']
     WHEN 'oral_pratica' THEN ARRAY['oral','pratica'] ELSE NULL::text[] END) OR codes IS NULL THEN
     RAISE EXCEPTION 'EXAM_COMPONENTS_INVALID' USING ERRCODE='22023';
   END IF;
   max_note:=CASE WHEN regime->>'escala'='quantitativa_primario' THEN 10 ELSE 20 END;
   INSERT INTO public.exame_sessoes(escola_id,ano_letivo_id,turma_id,tipo,modalidade,estado,
     data_inicio,data_fim,observacoes,created_by)
   VALUES(p_escola_id,m.session_id,m.turma_id,p_payload->>'tipo',p_payload->>'modalidade','rascunho',
     start_date,end_date,reason,actor) RETURNING id INTO entity;
   FOR component IN SELECT * FROM jsonb_array_elements(p_payload->'componentes') LOOP
     IF (component->>'peso')::numeric<=0 OR (component->>'peso')::numeric>100 THEN
       RAISE EXCEPTION 'EXAM_COMPONENTS_INVALID' USING ERRCODE='22023';
     END IF;
     INSERT INTO public.exame_componentes(escola_id,exame_sessao_id,codigo,peso,nota_max)
       VALUES(p_escola_id,entity,component->>'codigo',(component->>'peso')::numeric,max_note);
   END LOOP;
   UPDATE public.exame_sessoes SET estado='aberta' WHERE id=entity AND escola_id=p_escola_id;
   result:=jsonb_build_object('ok',true,'id',entity,'estado','aberta');
 ELSIF p_acao='validar_exame' THEN
   SELECT * INTO exam_row FROM public.exame_resultados WHERE id=(p_payload->>'resultado_id')::uuid
     AND escola_id=p_escola_id AND matricula_id=m.id FOR UPDATE;
   IF NOT FOUND OR exam_row.estado<>'submetido' OR exam_row.nota IS NULL THEN
     RAISE EXCEPTION 'EXAM_RESULT_NOT_SUBMITTED' USING ERRCODE='23514';
   END IF;
   SELECT * INTO session_row FROM public.exame_sessoes WHERE id=exam_row.exame_sessao_id
     AND escola_id=p_escola_id FOR SHARE;
   IF session_row.ano_letivo_id IS DISTINCT FROM m.session_id
     OR session_row.estado NOT IN ('aberta','publicada')
     OR session_row.data_inicio>(now() AT TIME ZONE 'Africa/Luanda')::date
     OR NOT EXISTS(SELECT 1 FROM public.exame_componentes c JOIN public.turma_disciplinas td ON td.id=exam_row.turma_disciplina_id
       WHERE c.id=exam_row.exame_componente_id AND c.escola_id=p_escola_id AND c.exame_sessao_id=session_row.id
       AND td.escola_id=p_escola_id AND td.turma_id=m.turma_id AND exam_row.aluno_id=m.aluno_id
       AND exam_row.nota BETWEEN 0 AND c.nota_max) THEN
     RAISE EXCEPTION 'EXAM_SESSION_LOCKED' USING ERRCODE='23514';
   END IF;
   UPDATE public.exame_resultados SET estado='validado',updated_at=now()
     WHERE id=exam_row.id AND escola_id=p_escola_id;
   entity:=exam_row.id;
   result:=jsonb_build_object('ok',true,'id',entity,'estado','validado');
 ELSIF p_acao='preparar_publicacao' THEN
   SELECT * INTO period FROM public.periodos_letivos WHERE id=(p_payload->>'periodo_id')::uuid
     AND escola_id=p_escola_id AND ano_letivo_id=m.session_id AND tipo='TRIMESTRE';
   IF NOT FOUND OR p_payload->>'tipo' NOT IN ('anual','trimestral') THEN
     RAISE EXCEPTION 'ACADEMIC_PERIOD_INVALID' USING ERRCODE='22023';
   END IF;
   INSERT INTO public.pautas_oficiais(escola_id,turma_id,periodo_letivo_id,tipo,status,pdf_path,hash)
     VALUES(p_escola_id,m.turma_id,period.id,p_payload->>'tipo','PENDING','',gen_random_uuid()::text)
     ON CONFLICT(escola_id,turma_id,periodo_letivo_id,tipo) DO NOTHING;
   SELECT * INTO publication FROM public.pautas_oficiais WHERE escola_id=p_escola_id
     AND turma_id=m.turma_id AND periodo_letivo_id=period.id AND tipo=p_payload->>'tipo' FOR UPDATE;
   IF publication.status='PROCESSING' AND publication.updated_at>now()-interval '15 minutes' THEN
     RAISE EXCEPTION 'ACADEMIC_PUBLICATION_BUSY' USING ERRCODE='23505';
   END IF;
   entity:=publication.id;
   result:=jsonb_build_object('ok',true,'id',entity,'status','PROCESSING','token',gen_random_uuid(),'previous',to_jsonb(publication));
   result:=result||jsonb_build_object('pdf_path',p_escola_id::text||'/'||m.turma_id::text||'/'||period.id::text||'/balcao/'||p_chave::text||'/'||(result->>'token')||'.pdf');
   INSERT INTO public.audit_logs(escola_id,actor_id,action,entity,entity_id,portal,details)
     VALUES(p_escola_id,actor,'BALCAO_PAUTA_VERSION_RESERVED','pautas_oficiais',entity::text,'secretaria',
       jsonb_build_object('motivo',reason,'previous',to_jsonb(publication),'chave',p_chave));
   UPDATE public.pautas_oficiais SET status='PROCESSING',hash=result->>'token',updated_at=now(),error_message=NULL
     WHERE id=entity AND escola_id=p_escola_id;
 ELSE RAISE EXCEPTION 'ACADEMIC_ACTION_INVALID' USING ERRCODE='22023';
 END IF;
 INSERT INTO public.balcao_academic_operacoes(escola_id,matricula_id,actor_id,chave,acao,payload,resultado)
   VALUES(p_escola_id,m.id,actor,p_chave,p_acao,p_payload,result);
 INSERT INTO public.audit_logs(escola_id,actor_id,action,entity,entity_id,portal,details)
   VALUES(p_escola_id,actor,'BALCAO_ACADEMIC_'||upper(p_acao),'matriculas',m.id::text,'secretaria',
     jsonb_build_object('motivo',reason,'chave',p_chave,'resultado',result,'ano_letivo_id',m.session_id));
 RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.balcao_resolver_academico(uuid,uuid,text,jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.balcao_resolver_academico(uuid,uuid,text,jsonb,uuid) TO authenticated;

CREATE FUNCTION public.balcao_concluir_publicacao(p_escola_id uuid,p_matricula_id uuid,p_chave uuid,p_token uuid,p_sucesso boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE op public.balcao_academic_operacoes%ROWTYPE; pauta public.pautas_oficiais%ROWTYPE; final jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.escola_users eu WHERE eu.escola_id=p_escola_id
   AND eu.user_id=auth.uid() AND eu.papel::text IN ('admin','admin_escola','diretor')) THEN
   RAISE EXCEPTION 'ACADEMIC_FORBIDDEN' USING ERRCODE='42501';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_chave::text,0));
 -- Same source-before-publication lock order as the reservation path.
 PERFORM m.id FROM public.matriculas m WHERE m.id=p_matricula_id AND m.escola_id=p_escola_id FOR SHARE;
 IF p_sucesso IS TRUE AND NOT EXISTS(SELECT 1 FROM public.matriculas m JOIN public.anos_letivos y ON y.id=m.session_id AND y.escola_id=p_escola_id
   WHERE m.id=p_matricula_id AND m.escola_id=p_escola_id AND m.status='ativo' AND m.ativo=true AND y.ativo=true) THEN
   RAISE EXCEPTION 'RAA_LEGAL_LOCK' USING ERRCODE='23514';
 END IF;
 SELECT * INTO op FROM public.balcao_academic_operacoes WHERE actor_id=auth.uid() AND chave=p_chave
   AND escola_id=p_escola_id AND matricula_id=p_matricula_id AND acao='preparar_publicacao' FOR UPDATE;
 IF NOT FOUND OR op.resultado->>'token' IS DISTINCT FROM p_token::text THEN
   RAISE EXCEPTION 'ACADEMIC_PUBLICATION_CLAIM_INVALID' USING ERRCODE='23514';
 END IF;
 SELECT * INTO pauta FROM public.pautas_oficiais WHERE id=(op.resultado->>'id')::uuid
   AND escola_id=p_escola_id FOR UPDATE;
 IF NOT FOUND OR pauta.hash IS DISTINCT FROM p_token::text THEN
   RAISE EXCEPTION 'ACADEMIC_PUBLICATION_CLAIM_EXPIRED' USING ERRCODE='23514';
 END IF;
 IF pauta.status='SUCCESS' AND op.resultado->>'status' IN ('SUCCESS','FAILED') THEN RETURN op.resultado; END IF;
 IF pauta.status<>'PROCESSING' THEN RAISE EXCEPTION 'ACADEMIC_PUBLICATION_CLAIM_INVALID' USING ERRCODE='23514'; END IF;
 IF p_sucesso IS TRUE AND NOT EXISTS(SELECT 1 FROM storage.objects o
   WHERE o.bucket_id='pautas_oficiais_fechadas' AND o.name=op.resultado->>'pdf_path'
   AND coalesce((o.metadata->>'size')::bigint,0)>=800 AND o.metadata->>'mimetype'='application/pdf') THEN
   RAISE EXCEPTION 'ACADEMIC_PUBLICATION_FILE_MISSING' USING ERRCODE='23514';
 END IF;
 final:=op.resultado||jsonb_build_object('status',CASE WHEN p_sucesso IS TRUE THEN 'SUCCESS' ELSE 'FAILED' END);
 UPDATE public.pautas_oficiais SET status=CASE WHEN p_sucesso IS TRUE THEN 'SUCCESS' WHEN op.resultado->'previous'->>'status'='SUCCESS' AND length(op.resultado->'previous'->>'pdf_path')>0 THEN 'SUCCESS' ELSE 'FAILED' END,updated_at=now(),
   pdf_path=CASE WHEN p_sucesso IS TRUE THEN op.resultado->>'pdf_path' ELSE pdf_path END,
   generated_at=CASE WHEN p_sucesso IS TRUE THEN now() ELSE generated_at END,
   error_message=CASE WHEN p_sucesso IS TRUE THEN NULL ELSE 'Falha de geração ou publicação no Balcão' END
   WHERE id=pauta.id AND escola_id=p_escola_id;
 UPDATE public.balcao_academic_operacoes SET resultado=final WHERE id=op.id;
 INSERT INTO public.audit_logs(escola_id,actor_id,action,entity,entity_id,portal,details)
   VALUES(p_escola_id,auth.uid(),'BALCAO_PAUTA_'||(final->>'status'),'pautas_oficiais',pauta.id::text,'secretaria',
     jsonb_build_object('chave',p_chave,'motivo',op.payload->>'motivo','resultado',final));
 RETURN final;
END;
$$;
REVOKE ALL ON FUNCTION public.balcao_concluir_publicacao(uuid,uuid,uuid,uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.balcao_concluir_publicacao(uuid,uuid,uuid,uuid,boolean) TO authenticated;

-- Shared qualitative source for SQL mutations and the TypeScript RAA adapter.
-- Numerical grades are never translated to Suficiente/Não suficiente.
CREATE FUNCTION public.resolve_raa_eja_oficial(p_escola_id uuid,p_matricula_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE m public.matriculas%ROWTYPE; regime jsonb; statuses jsonb:='[]'; pending_ids jsonb:='[]';
 negative_ids jsonb:='[]'; d record; total int:=0; complete boolean:=true;
 aulas numeric; presencas numeric; period_count int; frequency_complete boolean; decision text; legal_decision text; destination text;
 reason text; blocked boolean; disciplinary boolean; decree jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.escola_users eu WHERE eu.escola_id=p_escola_id
   AND eu.user_id=auth.uid() AND eu.papel::text IN
   ('admin','admin_escola','diretor','staff_admin','secretaria','admin_secretaria','secretaria_financeiro','admin_financeiro','professor'))
   AND NOT (auth.uid() IS NULL AND coalesce(current_setting('role',true),'')='service_role') THEN
   RAISE EXCEPTION 'ACADEMIC_FORBIDDEN' USING ERRCODE='42501';
 END IF;
 SELECT * INTO m FROM public.matriculas WHERE escola_id=p_escola_id AND id=p_matricula_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'ACADEMIC_SOURCE_NOT_FOUND' USING ERRCODE='22023'; END IF;
 regime:=public.resolve_regime_academico(m.turma_id);
 IF regime->>'nivel_ensino' IS DISTINCT FROM 'eja' OR regime->>'escala' IS DISTINCT FROM 'qualitativa' THEN RETURN NULL; END IF;
 FOR d IN
   SELECT DISTINCT td.avaliacao_disciplina_id AS disciplina_id,e.suficiente,e.id AS evidence_id
   FROM public.turma_disciplinas td
   LEFT JOIN LATERAL(SELECT a.id,a.suficiente FROM public.raa_eja_avaliacoes_oficiais a
     WHERE a.escola_id=p_escola_id AND a.matricula_id=m.id AND a.disciplina_id=td.avaliacao_disciplina_id
     ORDER BY a.registado_em DESC,a.id DESC LIMIT 1) e ON true
   WHERE td.escola_id=p_escola_id AND td.turma_id=m.turma_id AND td.avaliacao_disciplina_id IS NOT NULL
 LOOP
   total:=total+1;
   complete:=complete AND d.suficiente IS NOT NULL;
   IF d.suficiente IS NULL THEN pending_ids:=pending_ids||jsonb_build_array(d.disciplina_id); END IF;
   IF d.suficiente IS FALSE THEN negative_ids:=negative_ids||jsonb_build_array(d.disciplina_id); END IF;
   statuses:=statuses||jsonb_build_array(jsonb_build_object('disciplina_id',d.disciplina_id,
     'suficiente',d.suficiente,'evidence_id',d.evidence_id,
     'status',CASE WHEN d.suficiente IS NULL THEN 'pendente_dados' WHEN d.suficiente THEN 'aprovado' ELSE 'reprovado' END));
 END LOOP;
 SELECT sum(fsp.aulas_previstas),sum(fsp.presencas),count(DISTINCT p.numero),
   bool_and(fsp.aulas_previstas>0 AND fsp.presencas BETWEEN 0 AND fsp.aulas_previstas)
 INTO aulas,presencas,period_count,frequency_complete FROM public.frequencia_status_periodo fsp
 JOIN public.periodos_letivos p ON p.id=fsp.periodo_letivo_id AND p.escola_id=p_escola_id
   AND p.ano_letivo_id=m.session_id AND p.tipo='TRIMESTRE' AND p.numero BETWEEN 1 AND 3
 WHERE fsp.escola_id=p_escola_id AND fsp.matricula_id=m.id;
 SELECT EXISTS(SELECT 1 FROM public.raa_indisciplina_eventos WHERE escola_id=p_escola_id
   AND matricula_id=m.id AND estado IN ('registado','em_analise') AND impacta_resultado=true) INTO disciplinary;
 IF total=0 OR NOT complete OR period_count<>3 OR frequency_complete IS DISTINCT FROM true OR aulas IS NULL OR aulas<=0 OR presencas IS NULL THEN
   decision:='pendente'; legal_decision:='pendente_dados'; destination:='aguardar_dados'; reason:='dados_pendentes'; blocked:=true;
 ELSIF disciplinary THEN
   decision:='retido_por_indisciplina'; legal_decision:='reprovado_por_indisciplina'; destination:='mesma_etapa'; reason:='indisciplina_grave'; blocked:=true;
 ELSIF presencas*3<aulas*2 THEN
   decision:='retido_por_faltas'; legal_decision:='reprovado_por_faltas'; destination:='mesma_etapa'; reason:='frequencia_eja'; blocked:=true;
 ELSIF jsonb_array_length(negative_ids)>0 THEN
   decision:='retido'; legal_decision:='reprovado'; destination:='mesma_etapa'; reason:='negativas_faixa_legal'; blocked:=true;
 ELSE
   decision:=CASE WHEN regime->>'modulo_numero'='3' THEN 'concluiu' ELSE 'transitou' END;
   legal_decision:=decision; destination:=CASE WHEN decision='concluiu' THEN 'conclusao' ELSE 'proxima_etapa' END;
   reason:='sem_pendencias'; blocked:=false;
 END IF;
 decree:=jsonb_build_object('decision',legal_decision,'motivo',reason,'baseLegal','Art. 26.º: avaliação qualitativa e frequência anual oficial.',
   'elegivelRecurso',false,'exameExtraordinario',false,'efetivacaoMatriculaBloqueada',blocked,
   'disciplinasNegativas',negative_ids,'disciplinasPendentes',pending_ids);
 RETURN jsonb_build_object('decision',decision,'destino',destination,'motivo',reason,'regime',regime,
   'efetivacao_matricula_bloqueada',blocked,'disciplina_ids_pendentes',pending_ids||negative_ids,
   'disciplinas',statuses,'decreto',decree,
   'frequencia',jsonb_build_object('percentual_presenca',CASE WHEN aulas>0 THEN round(presencas*100/aulas,2) ELSE NULL END,
     'frequencia_min_percent',100.0*2/3),
   'etapa_destino',CASE WHEN destination='proxima_etapa' THEN regime||jsonb_build_object('modulo_numero',(regime->>'modulo_numero')::int+1) ELSE regime END);
END;
$$;
REVOKE ALL ON FUNCTION public.resolve_raa_eja_oficial(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.resolve_raa_eja_oficial(uuid,uuid) TO authenticated,service_role;

-- Preserve installed numeric logic, including later patches. Fail if a known
-- insertion point is absent instead of silently dropping existing guard logic.
DO $patch$
DECLARE definition text; marker text;
BEGIN
 SELECT pg_get_functiondef('public.resolve_raa_decreto_for_matricula(uuid,uuid)'::regprocedure) INTO definition;
 marker:='  IF v_regime_codigo IS NULL THEN';
 IF position(marker IN definition)=0 THEN RAISE EXCEPTION 'RAA decree patch precondition failed'; END IF;
 definition:=replace(definition,marker,
   '  IF v_nivel = ''eja'' AND v_regime->>''escala'' = ''qualitativa'' THEN
    RETURN public.resolve_raa_eja_oficial(p_escola_id,p_matricula_id);
  END IF;
'||marker);
 EXECUTE definition;
 SELECT pg_get_functiondef('public.resolve_estado_resultado(uuid,uuid)'::regprocedure) INTO definition;
 marker:='  v_base := public.resolve_estado_resultado_academico_base(p_matricula_id, p_disciplina_id);';
 IF position(marker IN definition)=0 THEN RAISE EXCEPTION 'RAA result patch precondition failed'; END IF;
 definition:=replace(definition,marker,
   '  SELECT escola_id INTO v_escola_id FROM public.matriculas WHERE id=p_matricula_id;
  IF public.resolve_regime_academico((SELECT turma_id FROM public.matriculas WHERE id=p_matricula_id))->>''escala'' = ''qualitativa'' THEN
    v_base := public.resolve_raa_eja_oficial(v_escola_id,p_matricula_id);
    IF v_base IS NOT NULL THEN
      SELECT item INTO v_base FROM jsonb_array_elements(v_base->''disciplinas'') item
        WHERE item->>''disciplina_id''=p_disciplina_id::text;
    END IF;
  END IF;
  IF v_base IS NULL THEN
'||marker||'
  END IF;');
 EXECUTE definition;
END;
$patch$;

-- Scope the existing grade exception to its actual curriculum/year. Expiry is
-- checked by the database on every write; no period dates are rewritten.
CREATE OR REPLACE FUNCTION public.can_bypass_pauta_lock(p_escola_id uuid,p_turma_id uuid,p_avaliacao_id uuid,p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT p_user_id=auth.uid() AND EXISTS(
   SELECT 1 FROM public.avaliacoes a JOIN public.turma_disciplinas td ON td.id=a.turma_disciplina_id
   JOIN public.excecoes_pauta e ON e.escola_id=p_escola_id AND e.turma_id=td.turma_id
   JOIN public.turmas t ON t.id=td.turma_id AND t.escola_id=p_escola_id
   JOIN public.anos_letivos y ON y.id=e.ano_letivo_id AND y.escola_id=p_escola_id AND y.ano=t.ano_letivo
   WHERE a.id=p_avaliacao_id AND a.escola_id=p_escola_id AND td.escola_id=p_escola_id
     AND td.turma_id=p_turma_id AND e.user_id=p_user_id AND e.status='APROVADO' AND e.expira_em>now()
     AND (e.trimestre IS NULL OR e.trimestre=a.trimestre)
     AND (e.disciplina_id IS NULL OR e.disciplina_id=td.avaliacao_disciplina_id));
$$;
REVOKE ALL ON FUNCTION public.can_bypass_pauta_lock(uuid,uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_bypass_pauta_lock(uuid,uuid,uuid,uuid) TO authenticated;
COMMIT;
