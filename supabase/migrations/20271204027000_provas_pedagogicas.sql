BEGIN;
ALTER TABLE public.provas_pedagogicas ADD COLUMN data_realizacao date, ADD COLUMN hora_inicio time(0) without time zone;
ALTER TABLE public.provas_pedagogicas ADD CONSTRAINT provas_hora_requires_date CHECK (hora_inicio IS NULL OR data_realizacao IS NOT NULL), ADD CONSTRAINT provas_data_range CHECK (data_realizacao BETWEEN DATE '1900-01-01' AND DATE '2200-12-31'), ADD CONSTRAINT provas_hora_minute CHECK (extract(second from hora_inicio)=0 AND hora_inicio < TIME '24:00');
CREATE INDEX provas_escola_data_idx ON public.provas_pedagogicas(escola_id,data_realizacao,id);
CREATE OR REPLACE FUNCTION provas_private.provas_mutar(p_escola uuid,p_id uuid,p_versao integer,p_acao text,p_dados jsonb)
RETURNS public.provas_pedagogicas LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE r public.provas_pedagogicas; v_actor uuid:=auth.uid();
 v_admin boolean; v_prof boolean; v_body jsonb; v_context record; v_date date; v_time time without time zone;
BEGIN
 v_admin:=provas_private.provas_papel(p_escola,ARRAY['admin','admin_escola','diretor','admin_secretaria','admin_secretario','staff_admin','admin_financeiro']);
 v_prof:=provas_private.provas_papel(p_escola,ARRAY['professor']);
 IF v_actor IS NULL OR NOT(v_admin OR v_prof) THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE='42501'; END IF;
 IF p_acao IS NULL OR p_acao NOT IN ('criar','guardar','submeter','aprovar','devolver','arquivar','duplicar') THEN RAISE EXCEPTION 'invalid_action' USING ERRCODE='22023'; END IF;
 IF p_acao<>'criar' THEN
   SELECT * INTO r FROM public.provas_pedagogicas WHERE id=p_id AND escola_id=p_escola FOR UPDATE;
   IF NOT FOUND OR NOT(v_admin OR (v_prof AND (r.autor_tipo='sistema' OR r.autor_id IS NOT DISTINCT FROM v_actor)
      AND provas_private.provas_professor_atribuido(r.escola_id,r.ano_letivo_id,r.curso_matriz_id,r.trimestre))) THEN
     RAISE EXCEPTION 'not_allowed' USING ERRCODE='42501';
   END IF;
   -- Shared system exams can be edited/submitted, never archived or cloned by a teacher.
   IF NOT v_admin AND r.autor_tipo='sistema' AND p_acao NOT IN ('guardar','submeter') THEN
     RAISE EXCEPTION 'not_allowed' USING ERRCODE='42501';
   END IF;
   IF p_versao IS DISTINCT FROM r.versao THEN RAISE EXCEPTION 'version_conflict' USING ERRCODE='40001'; END IF;
 ELSE
   IF p_id IS NOT NULL OR p_versao IS NOT NULL THEN RAISE EXCEPTION 'invalid_id' USING ERRCODE='22023'; END IF;
 END IF;
 IF p_acao IN ('criar','guardar') THEN
   IF p_acao='guardar' AND r.estado<>'rascunho' THEN RAISE EXCEPTION 'invalid_state' USING ERRCODE='22023'; END IF;
   IF jsonb_typeof(p_dados) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'invalid_data' USING ERRCODE='22023'; END IF;
   SELECT * INTO v_context FROM provas_private.provas_opcoes(p_escola,(p_dados->>'ano_letivo_id')::uuid,(p_dados->>'curso_matriz_id')::uuid) o
   WHERE o.curso_matriz_id=(p_dados->>'curso_matriz_id')::uuid AND o.trimestre=(p_dados->>'trimestre')::integer;
   IF NOT FOUND THEN RAISE EXCEPTION 'invalid_academic_context' USING ERRCODE='42501'; END IF;
   -- A teacher must not move a shared import into another class, discipline, year or trimester.
   IF p_acao='guardar' AND NOT v_admin AND r.autor_tipo='sistema' AND
      (v_context.ano_letivo_id IS DISTINCT FROM r.ano_letivo_id OR
       v_context.curso_matriz_id IS DISTINCT FROM r.curso_matriz_id OR
       v_context.trimestre IS DISTINCT FROM r.trimestre) THEN
     RAISE EXCEPTION 'invalid_academic_context' USING ERRCODE='42501';
   END IF;
   IF p_dados ? 'apresentacao' AND (jsonb_typeof(p_dados->'apresentacao') IS DISTINCT FROM 'string' OR p_dados->>'apresentacao' NOT IN ('automatica','compacta','espacosa')) THEN RAISE EXCEPTION 'invalid_apresentacao' USING ERRCODE='22023'; END IF;
   -- Old clients preserve the existing schedule; explicit null clears it.
   IF p_dados ? 'data_realizacao' THEN
     IF jsonb_typeof(p_dados->'data_realizacao') NOT IN ('null','string') OR (p_dados->>'data_realizacao' IS NOT NULL AND p_dados->>'data_realizacao' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}
   PERFORM provas_private.provas_validar_blocos(v_body);
   IF p_acao='criar' THEN
     INSERT INTO public.provas_pedagogicas(escola_id,autor_id,ano_letivo_id,curso_matriz_id,tipo_prova,apresentacao,titulo,classe,disciplina,ano_lectivo,trimestre,duracao,serie,conteudo,data_realizacao,hora_inicio)
     VALUES(p_escola,v_actor,v_context.ano_letivo_id,v_context.curso_matriz_id,coalesce(p_dados->>'tipo_prova','trimestral'),coalesce(p_dados->>'apresentacao','automatica'),p_dados->>'titulo',v_context.classe,v_context.disciplina,v_context.ano_lectivo,v_context.trimestre,(p_dados->>'duracao')::smallint,p_dados->>'serie',v_body,v_date,v_time) RETURNING * INTO r;
   ELSE
     UPDATE public.provas_pedagogicas SET ano_letivo_id=v_context.ano_letivo_id,curso_matriz_id=v_context.curso_matriz_id,tipo_prova=coalesce(p_dados->>'tipo_prova','trimestral'),apresentacao=coalesce(p_dados->>'apresentacao',r.apresentacao),titulo=p_dados->>'titulo',classe=v_context.classe,disciplina=v_context.disciplina,ano_lectivo=v_context.ano_lectivo,trimestre=v_context.trimestre,duracao=(p_dados->>'duracao')::smallint,serie=p_dados->>'serie',conteudo=v_body,data_realizacao=v_date,hora_inicio=v_time,versao=versao+1,atualizado_em=clock_timestamp() WHERE id=r.id RETURNING * INTO r;
   END IF;
 ELSIF p_acao='duplicar' THEN
   SELECT * INTO v_context FROM provas_private.provas_opcoes(p_escola,r.ano_letivo_id,r.curso_matriz_id) o WHERE o.trimestre=r.trimestre;
   IF NOT FOUND THEN RAISE EXCEPTION 'invalid_academic_context' USING ERRCODE='42501'; END IF;
   INSERT INTO public.provas_pedagogicas(escola_id,autor_id,ano_letivo_id,curso_matriz_id,tipo_prova,apresentacao,titulo,classe,disciplina,ano_lectivo,trimestre,duracao,serie,conteudo)
   VALUES(p_escola,v_actor,v_context.ano_letivo_id,v_context.curso_matriz_id,r.tipo_prova,r.apresentacao,r.titulo,v_context.classe,v_context.disciplina,v_context.ano_lectivo,v_context.trimestre,r.duracao,r.serie,r.conteudo) RETURNING * INTO r;
 ELSE
   IF p_acao IN ('submeter','aprovar') AND NOT EXISTS(SELECT 1 FROM provas_private.provas_opcoes(p_escola,r.ano_letivo_id,r.curso_matriz_id) o WHERE o.trimestre=r.trimestre) THEN RAISE EXCEPTION 'invalid_academic_context' USING ERRCODE='42501'; END IF;
   IF p_acao IN ('submeter','aprovar') AND EXISTS (
     WITH blocks AS (SELECT b, n FROM jsonb_array_elements(r.conteudo) WITH ORDINALITY AS q(b,n))
     SELECT 1 FROM blocks g WHERE g.b->>'tipo'='grupo' AND NOT EXISTS (
       SELECT 1 FROM blocks q WHERE q.n>g.n AND q.n<coalesce((SELECT min(h.n) FROM blocks h WHERE h.n>g.n AND h.b->>'tipo'='grupo'),9223372036854775807::bigint)
         AND q.b->>'tipo' NOT IN ('grupo','texto')
     )
   ) THEN RAISE EXCEPTION 'empty_exam_group' USING ERRCODE='22023'; END IF;
   IF p_acao='submeter' AND r.estado='rascunho' AND EXISTS(SELECT 1 FROM jsonb_array_elements(r.conteudo) x WHERE x->>'tipo' NOT IN ('grupo','texto')) THEN r.estado:='em_revisao';
   ELSIF p_acao='aprovar' AND v_admin AND r.estado IN ('rascunho','em_revisao') THEN r.estado:='aprovada'; r.aprovado_por:=v_actor; r.aprovado_em:=clock_timestamp();
   ELSIF p_acao='devolver' AND v_admin AND r.estado='em_revisao' THEN r.estado:='rascunho';
   ELSIF p_acao='arquivar' AND (v_admin OR r.estado='rascunho') AND r.estado IN ('rascunho','aprovada') THEN r.estado:='arquivada';
   ELSE RAISE EXCEPTION 'invalid_transition' USING ERRCODE='42501'; END IF;
   UPDATE public.provas_pedagogicas SET estado=r.estado,aprovado_por=r.aprovado_por,aprovado_em=r.aprovado_em,versao=versao+1,atualizado_em=clock_timestamp() WHERE id=r.id RETURNING * INTO r;
 END IF;
 -- Reuse the existing audit stream; do not put confidential questions or images in logs.
 INSERT INTO public.audit_logs(escola_id,user_id,actor_id,acao,tabela,registro_id,action,entity,entity_id,details)
 VALUES(r.escola_id,(SELECT p.user_id FROM public.profiles p WHERE p.user_id=v_actor LIMIT 1),v_actor,
  'PROVA_'||upper(p_acao),'provas_pedagogicas',r.id::text,
  'PROVA_'||upper(p_acao),'provas_pedagogicas',r.id::text,
  jsonb_build_object('versao',r.versao,'estado',r.estado,'autor_tipo',r.autor_tipo,'curso_matriz_id',r.curso_matriz_id,'trimestre',r.trimestre,'data_realizacao',r.data_realizacao,'hora_inicio',r.hora_inicio));
 RETURN r;
END;
$$;
-- The existing grants, public wrapper, optimistic version check and scoring guard remain unchanged.
COMMIT;
) THEN RAISE EXCEPTION 'invalid_exam_date' USING ERRCODE='22023'; END IF;
     v_date:=(p_dados->>'data_realizacao')::date;
   ELSE v_date:=r.data_realizacao; END IF;
   IF p_dados ? 'hora_inicio' THEN
     IF jsonb_typeof(p_dados->'hora_inicio') NOT IN ('null','string') OR (p_dados->>'hora_inicio' IS NOT NULL AND p_dados->>'hora_inicio' !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:00)?
   PERFORM provas_private.provas_validar_blocos(v_body);
   IF p_acao='criar' THEN
     INSERT INTO public.provas_pedagogicas(escola_id,autor_id,ano_letivo_id,curso_matriz_id,tipo_prova,apresentacao,titulo,classe,disciplina,ano_lectivo,trimestre,duracao,serie,conteudo)
     VALUES(p_escola,v_actor,v_context.ano_letivo_id,v_context.curso_matriz_id,coalesce(p_dados->>'tipo_prova','trimestral'),coalesce(p_dados->>'apresentacao','automatica'),p_dados->>'titulo',v_context.classe,v_context.disciplina,v_context.ano_lectivo,v_context.trimestre,(p_dados->>'duracao')::smallint,p_dados->>'serie',v_body) RETURNING * INTO r;
   ELSE
     UPDATE public.provas_pedagogicas SET ano_letivo_id=v_context.ano_letivo_id,curso_matriz_id=v_context.curso_matriz_id,tipo_prova=coalesce(p_dados->>'tipo_prova','trimestral'),apresentacao=coalesce(p_dados->>'apresentacao',r.apresentacao),titulo=p_dados->>'titulo',classe=v_context.classe,disciplina=v_context.disciplina,ano_lectivo=v_context.ano_lectivo,trimestre=v_context.trimestre,duracao=(p_dados->>'duracao')::smallint,serie=p_dados->>'serie',conteudo=v_body,versao=versao+1,atualizado_em=clock_timestamp() WHERE id=r.id RETURNING * INTO r;
   END IF;
 ELSIF p_acao='duplicar' THEN
   SELECT * INTO v_context FROM provas_private.provas_opcoes(p_escola,r.ano_letivo_id,r.curso_matriz_id) o WHERE o.trimestre=r.trimestre;
   IF NOT FOUND THEN RAISE EXCEPTION 'invalid_academic_context' USING ERRCODE='42501'; END IF;
   INSERT INTO public.provas_pedagogicas(escola_id,autor_id,ano_letivo_id,curso_matriz_id,tipo_prova,apresentacao,titulo,classe,disciplina,ano_lectivo,trimestre,duracao,serie,conteudo)
   VALUES(p_escola,v_actor,v_context.ano_letivo_id,v_context.curso_matriz_id,r.tipo_prova,r.apresentacao,r.titulo,v_context.classe,v_context.disciplina,v_context.ano_lectivo,v_context.trimestre,r.duracao,r.serie,r.conteudo) RETURNING * INTO r;
 ELSE
   IF p_acao IN ('submeter','aprovar') AND NOT EXISTS(SELECT 1 FROM provas_private.provas_opcoes(p_escola,r.ano_letivo_id,r.curso_matriz_id) o WHERE o.trimestre=r.trimestre) THEN RAISE EXCEPTION 'invalid_academic_context' USING ERRCODE='42501'; END IF;
   IF p_acao='submeter' AND r.estado='rascunho' AND EXISTS(SELECT 1 FROM jsonb_array_elements(r.conteudo) x WHERE x->>'tipo' NOT IN ('grupo','texto')) THEN r.estado:='em_revisao';
   ELSIF p_acao='aprovar' AND v_admin AND r.estado='em_revisao' THEN r.estado:='aprovada'; r.aprovado_por:=v_actor; r.aprovado_em:=clock_timestamp();
   ELSIF p_acao='devolver' AND v_admin AND r.estado='em_revisao' THEN r.estado:='rascunho';
   ELSIF p_acao='arquivar' AND (v_admin OR r.estado='rascunho') AND r.estado IN ('rascunho','aprovada') THEN r.estado:='arquivada';
   ELSE RAISE EXCEPTION 'invalid_transition' USING ERRCODE='42501'; END IF;
   UPDATE public.provas_pedagogicas SET estado=r.estado,aprovado_por=r.aprovado_por,aprovado_em=r.aprovado_em,versao=versao+1,atualizado_em=clock_timestamp() WHERE id=r.id RETURNING * INTO r;
 END IF;
 -- Reuse the existing audit stream; do not put confidential questions or images in logs.
 INSERT INTO public.audit_logs(escola_id,user_id,actor_id,acao,tabela,registro_id,action,entity,entity_id,details)
 VALUES(r.escola_id,(SELECT p.user_id FROM public.profiles p WHERE p.user_id=v_actor LIMIT 1),v_actor,
  'PROVA_'||upper(p_acao),'provas_pedagogicas',r.id::text,
  'PROVA_'||upper(p_acao),'provas_pedagogicas',r.id::text,
  jsonb_build_object('versao',r.versao,'estado',r.estado,'autor_tipo',r.autor_tipo,'curso_matriz_id',r.curso_matriz_id,'trimestre',r.trimestre));
 RETURN r;
END;
$$;
-- The existing grants, public wrapper, optimistic version check and scoring guard remain unchanged.
COMMIT;
) THEN RAISE EXCEPTION 'invalid_exam_time' USING ERRCODE='22023'; END IF;
     v_time:=(p_dados->>'hora_inicio')::time;
   ELSE v_time:=r.hora_inicio; END IF;
   IF v_date IS NULL AND v_time IS NOT NULL THEN RAISE EXCEPTION 'invalid_exam_time' USING ERRCODE='22023'; END IF;
   v_body:=p_dados->'conteudo';
   PERFORM provas_private.provas_validar_blocos(v_body);
   IF p_acao='criar' THEN
     INSERT INTO public.provas_pedagogicas(escola_id,autor_id,ano_letivo_id,curso_matriz_id,tipo_prova,apresentacao,titulo,classe,disciplina,ano_lectivo,trimestre,duracao,serie,conteudo)
     VALUES(p_escola,v_actor,v_context.ano_letivo_id,v_context.curso_matriz_id,coalesce(p_dados->>'tipo_prova','trimestral'),coalesce(p_dados->>'apresentacao','automatica'),p_dados->>'titulo',v_context.classe,v_context.disciplina,v_context.ano_lectivo,v_context.trimestre,(p_dados->>'duracao')::smallint,p_dados->>'serie',v_body) RETURNING * INTO r;
   ELSE
     UPDATE public.provas_pedagogicas SET ano_letivo_id=v_context.ano_letivo_id,curso_matriz_id=v_context.curso_matriz_id,tipo_prova=coalesce(p_dados->>'tipo_prova','trimestral'),apresentacao=coalesce(p_dados->>'apresentacao',r.apresentacao),titulo=p_dados->>'titulo',classe=v_context.classe,disciplina=v_context.disciplina,ano_lectivo=v_context.ano_lectivo,trimestre=v_context.trimestre,duracao=(p_dados->>'duracao')::smallint,serie=p_dados->>'serie',conteudo=v_body,versao=versao+1,atualizado_em=clock_timestamp() WHERE id=r.id RETURNING * INTO r;
   END IF;
 ELSIF p_acao='duplicar' THEN
   SELECT * INTO v_context FROM provas_private.provas_opcoes(p_escola,r.ano_letivo_id,r.curso_matriz_id) o WHERE o.trimestre=r.trimestre;
   IF NOT FOUND THEN RAISE EXCEPTION 'invalid_academic_context' USING ERRCODE='42501'; END IF;
   INSERT INTO public.provas_pedagogicas(escola_id,autor_id,ano_letivo_id,curso_matriz_id,tipo_prova,apresentacao,titulo,classe,disciplina,ano_lectivo,trimestre,duracao,serie,conteudo)
   VALUES(p_escola,v_actor,v_context.ano_letivo_id,v_context.curso_matriz_id,r.tipo_prova,r.apresentacao,r.titulo,v_context.classe,v_context.disciplina,v_context.ano_lectivo,v_context.trimestre,r.duracao,r.serie,r.conteudo) RETURNING * INTO r;
 ELSE
   IF p_acao IN ('submeter','aprovar') AND NOT EXISTS(SELECT 1 FROM provas_private.provas_opcoes(p_escola,r.ano_letivo_id,r.curso_matriz_id) o WHERE o.trimestre=r.trimestre) THEN RAISE EXCEPTION 'invalid_academic_context' USING ERRCODE='42501'; END IF;
   IF p_acao='submeter' AND r.estado='rascunho' AND EXISTS(SELECT 1 FROM jsonb_array_elements(r.conteudo) x WHERE x->>'tipo' NOT IN ('grupo','texto')) THEN r.estado:='em_revisao';
   ELSIF p_acao='aprovar' AND v_admin AND r.estado='em_revisao' THEN r.estado:='aprovada'; r.aprovado_por:=v_actor; r.aprovado_em:=clock_timestamp();
   ELSIF p_acao='devolver' AND v_admin AND r.estado='em_revisao' THEN r.estado:='rascunho';
   ELSIF p_acao='arquivar' AND (v_admin OR r.estado='rascunho') AND r.estado IN ('rascunho','aprovada') THEN r.estado:='arquivada';
   ELSE RAISE EXCEPTION 'invalid_transition' USING ERRCODE='42501'; END IF;
   UPDATE public.provas_pedagogicas SET estado=r.estado,aprovado_por=r.aprovado_por,aprovado_em=r.aprovado_em,versao=versao+1,atualizado_em=clock_timestamp() WHERE id=r.id RETURNING * INTO r;
 END IF;
 -- Reuse the existing audit stream; do not put confidential questions or images in logs.
 INSERT INTO public.audit_logs(escola_id,user_id,actor_id,acao,tabela,registro_id,action,entity,entity_id,details)
 VALUES(r.escola_id,(SELECT p.user_id FROM public.profiles p WHERE p.user_id=v_actor LIMIT 1),v_actor,
  'PROVA_'||upper(p_acao),'provas_pedagogicas',r.id::text,
  'PROVA_'||upper(p_acao),'provas_pedagogicas',r.id::text,
  jsonb_build_object('versao',r.versao,'estado',r.estado,'autor_tipo',r.autor_tipo,'curso_matriz_id',r.curso_matriz_id,'trimestre',r.trimestre));
 RETURN r;
END;
$$;
-- The existing grants, public wrapper, optimistic version check and scoring guard remain unchanged.
COMMIT;
