BEGIN;
-- Reuse the existing academic options as the single authorization source.
-- The same exact matrix, year and trimester now govern reading, saving and creation.
CREATE OR REPLACE FUNCTION provas_private.provas_opcoes(p_escola uuid,p_ano uuid,p_matriz uuid DEFAULT NULL)
RETURNS TABLE(ano_letivo_id uuid,curso_matriz_id uuid,ano_lectivo text,classe text,disciplina text,curso text,trimestre integer)
LANGUAGE sql STABLE SET search_path='' AS $academic$
 SELECT DISTINCT a.id,cm.id,
   extract(year from a.data_inicio)::integer::text||'/'||extract(year from a.data_fim)::integer::text,
   cl.nome,dc.nome,c.nome,pl.numero::integer
 FROM public.anos_letivos a
 JOIN public.curso_curriculos cc ON cc.ano_letivo_id=a.id AND cc.escola_id=a.escola_id AND cc.status='published'
 JOIN public.curso_matriz cm ON cm.curso_curriculo_id=cc.id AND cm.escola_id=a.escola_id AND cm.curso_id=cc.curso_id AND cm.ativo=true
 JOIN public.classes cl ON cl.id=cm.classe_id AND cl.escola_id=a.escola_id
 JOIN public.cursos c ON c.id=cm.curso_id AND c.escola_id=a.escola_id
 JOIN public.disciplinas_catalogo dc ON dc.id=cm.disciplina_id AND dc.escola_id=a.escola_id
 JOIN public.periodos_letivos pl ON pl.ano_letivo_id=a.id AND pl.escola_id=a.escola_id AND pl.tipo='TRIMESTRE' AND pl.numero BETWEEN 1 AND 3
 WHERE a.escola_id=p_escola AND a.id=p_ano AND (p_matriz IS NULL OR cm.id=p_matriz)
 AND (cl.ano_letivo_id IS NULL OR cl.ano_letivo_id=a.id)
 AND (cc.classe_id IS NULL OR cc.classe_id=cl.id)
 AND (cm.periodos_ativos IS NULL OR pl.numero=ANY(cm.periodos_ativos))
 AND (
  provas_private.provas_papel(p_escola,ARRAY['admin','admin_escola','diretor','admin_secretaria','admin_secretario','staff_admin','admin_financeiro'])
  OR (
   provas_private.provas_papel(p_escola,ARRAY['professor']) AND EXISTS (
    SELECT 1 FROM public.turma_disciplinas td
    JOIN public.turmas t ON t.id=td.turma_id AND t.escola_id=td.escola_id
    JOIN public.professores pr ON pr.escola_id=t.escola_id AND pr.profile_id=auth.uid()
    WHERE td.escola_id=p_escola AND td.curso_matriz_id=cm.id AND t.ano_letivo_id=a.id AND t.session_id=a.id
      AND t.classe_id=cm.classe_id AND t.curso_id=cm.curso_id
      AND (td.periodos_ativos IS NULL OR pl.numero=ANY(td.periodos_ativos))
      AND (td.professor_id=pr.id OR EXISTS (
       SELECT 1 FROM public.turma_disciplinas_professores tdp
       WHERE tdp.escola_id=p_escola AND tdp.turma_id=t.id AND tdp.disciplina_id=cm.disciplina_id AND tdp.professor_id=pr.id
      ))
   )
  )
 );
$academic$;

CREATE FUNCTION provas_private.provas_professor_atribuido(p_escola uuid,p_ano uuid,p_matriz uuid,p_trimestre integer)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $assigned$
 SELECT auth.uid() IS NOT NULL
 AND provas_private.provas_papel(p_escola,ARRAY['professor'])
 AND EXISTS (
   SELECT 1 FROM provas_private.provas_opcoes(p_escola,p_ano,p_matriz) o
   WHERE o.ano_letivo_id=p_ano AND o.curso_matriz_id=p_matriz AND o.trimestre=p_trimestre
 );
$assigned$;
REVOKE ALL ON FUNCTION provas_private.provas_professor_atribuido(uuid,uuid,uuid,integer) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION provas_private.provas_professor_atribuido(uuid,uuid,uuid,integer) TO authenticated;

ALTER POLICY provas_read ON public.provas_pedagogicas USING (
 provas_private.provas_papel(escola_id,ARRAY['admin','admin_escola','diretor','admin_secretaria','admin_secretario','staff_admin','admin_financeiro'])
 OR ((autor_tipo='sistema' OR autor_id=(SELECT auth.uid()))
     AND provas_private.provas_professor_atribuido(escola_id,ano_letivo_id,curso_matriz_id,trimestre))
 OR (estado='aprovada' AND provas_private.provas_papel(escola_id,ARRAY['secretaria','secretaria_financeiro']))
);

CREATE OR REPLACE FUNCTION provas_private.provas_mutar(p_escola uuid,p_id uuid,p_versao integer,p_acao text,p_dados jsonb)
RETURNS public.provas_pedagogicas LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE r public.provas_pedagogicas; v_actor uuid:=auth.uid();
 v_admin boolean; v_prof boolean; v_body jsonb; v_context record;
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
