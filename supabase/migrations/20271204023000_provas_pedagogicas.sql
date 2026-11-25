BEGIN;
-- System-authored exams are not synthetic auth.users accounts.
ALTER TABLE public.provas_pedagogicas
 ALTER COLUMN autor_id DROP NOT NULL,
 ADD COLUMN autor_tipo text NOT NULL DEFAULT 'usuario',
 ADD COLUMN importacao_chave text,
 ADD COLUMN importacao_hash text,
 ADD CONSTRAINT provas_autoria_check CHECK (
   (autor_tipo='usuario' AND autor_id IS NOT NULL AND importacao_chave IS NULL AND importacao_hash IS NULL)
   OR (autor_tipo='sistema' AND autor_id IS NULL AND importacao_chave IS NOT NULL AND importacao_hash IS NOT NULL
       AND length(importacao_chave) BETWEEN 1 AND 200 AND importacao_hash ~ '^[0-9a-f]{64}$')
 );
CREATE UNIQUE INDEX provas_importacao_chave_idx ON public.provas_pedagogicas(escola_id,importacao_chave) WHERE importacao_chave IS NOT NULL;

-- Share exactly the same block validator with the authenticated write path.
CREATE FUNCTION provas_private.provas_validar_blocos(v_body jsonb)
RETURNS void LANGUAGE plpgsql SET search_path='' AS $validate$
DECLARE b jsonb; v_option jsonb; v_math_total integer:=0;
BEGIN
   IF jsonb_typeof(v_body) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'invalid_blocks' USING ERRCODE='22023'; END IF;
   IF jsonb_array_length(v_body) NOT BETWEEN 1 AND 80 OR octet_length(v_body::text)>150000 THEN RAISE EXCEPTION 'invalid_blocks' USING ERRCODE='22023'; END IF;
   FOR b IN SELECT value FROM jsonb_array_elements(v_body) LOOP
     IF jsonb_typeof(b) IS DISTINCT FROM 'object' OR coalesce(b->>'tipo','') NOT IN ('grupo','texto','discursiva','verdadeiro_falso','lacunas','escolha','calculo','desenho','alinea') OR jsonb_typeof(b->'texto') IS DISTINCT FROM 'string' OR length(btrim(b->>'texto')) NOT BETWEEN 1 AND 3000 OR jsonb_typeof(b->'linhas') IS DISTINCT FROM 'number' OR coalesce(b->>'linhas','') !~ '^[0-9]{1,2}$' OR (b->>'linhas')::int NOT BETWEEN 0 AND 20 THEN RAISE EXCEPTION 'invalid_block' USING ERRCODE='22023'; END IF;
     IF (b - ARRAY['tipo','texto','linhas','rich','alternativas','cotacao_cent']) <> '{}'::jsonb THEN RAISE EXCEPTION 'invalid_block_fields' USING ERRCODE='22023'; END IF;
     IF b ? 'alternativas' THEN
       IF b->>'tipo'<>'escolha' OR jsonb_typeof(b->'alternativas') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'invalid_alternatives' USING ERRCODE='22023'; END IF;
       IF jsonb_array_length(b->'alternativas') NOT BETWEEN 2 AND 8 THEN RAISE EXCEPTION 'invalid_alternatives' USING ERRCODE='22023'; END IF;
       FOR v_option IN SELECT value FROM jsonb_array_elements(b->'alternativas') LOOP
         IF jsonb_typeof(v_option) IS DISTINCT FROM 'string' OR length(regexp_replace(v_option #>> '{}','^[[:space:]]+|[[:space:]]+$','','g')) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'invalid_alternative' USING ERRCODE='22023'; END IF;
       END LOOP;
     END IF;
     IF b ? 'cotacao_cent' THEN
       IF b->>'tipo' IN ('grupo','texto') OR jsonb_typeof(b->'cotacao_cent') IS DISTINCT FROM 'number' OR coalesce(b->>'cotacao_cent','') !~ '^[0-9]{1,4}$' THEN RAISE EXCEPTION 'invalid_cotacao' USING ERRCODE='22023'; END IF;
       IF (b->>'cotacao_cent')::integer>2000 THEN RAISE EXCEPTION 'invalid_cotacao' USING ERRCODE='22023'; END IF;
     END IF;
     IF b ? 'rich' THEN v_math_total:=v_math_total+provas_private.provas_rich_validate(b->'rich',b->>'texto'); END IF;
     IF v_math_total>80 THEN RAISE EXCEPTION 'too_many_formulas' USING ERRCODE='22023'; END IF;
   END LOOP;
END;
$validate$;
REVOKE ALL ON FUNCTION provas_private.provas_validar_blocos(jsonb) FROM PUBLIC,anon,authenticated,service_role;
-- NULL ownership is never authorization.
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
   IF NOT FOUND OR NOT(v_admin OR (r.autor_id IS NOT NULL AND r.autor_id=v_actor)) THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE='42501'; END IF;
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
 RETURN r;
END;
$$;

-- Canonical academic context without a human-role filter; only database operators may call this helper.
CREATE FUNCTION provas_private.provas_import_contexto(p_escola uuid,p_ano uuid,p_matriz uuid)
RETURNS TABLE(ano_letivo_id uuid,curso_matriz_id uuid,ano_lectivo text,classe text,disciplina text,curso text,trimestre integer)
LANGUAGE sql STABLE SET search_path='' AS $ctx$
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
$ctx$;
REVOKE ALL ON FUNCTION provas_private.provas_import_contexto(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

-- Not exposed through PostgREST; SECURITY INVOKER; no grant to application roles.
-- All-or-nothing batch; retries do not overwrite edited or archived drafts.
CREATE FUNCTION provas_private.provas_importar_sistema(p_escola uuid,p_itens jsonb)
RETURNS TABLE(prova_id uuid,criada boolean) LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $import$
DECLARE item jsonb; d jsonb; chave text; fingerprint text; ctx record; r public.provas_pedagogicas;
 v_max integer; v_total bigint; v_count integer; v_missing integer; v_marked integer;
BEGIN
 IF auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'system_import_only' USING ERRCODE='42501'; END IF;
 IF p_escola IS NULL OR jsonb_typeof(p_itens) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'invalid_import' USING ERRCODE='22023'; END IF;
 IF jsonb_array_length(p_itens) NOT BETWEEN 1 AND 50 OR octet_length(p_itens::text)>2000000 THEN RAISE EXCEPTION 'invalid_import_size' USING ERRCODE='22023'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_itens) LOOP
  IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR (item-ARRAY['chave','dados'])<>'{}'::jsonb OR jsonb_typeof(item->'chave') IS DISTINCT FROM 'string' OR jsonb_typeof(item->'dados') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'invalid_import_item' USING ERRCODE='22023'; END IF;
  chave:=item->>'chave'; d:=item->'dados';
  IF chave<>btrim(chave) OR length(chave) NOT BETWEEN 1 AND 200 OR (d-ARRAY['ano_letivo_id','curso_matriz_id','tipo_prova','titulo','trimestre','duracao','serie','apresentacao','conteudo'])<>'{}'::jsonb THEN RAISE EXCEPTION 'invalid_import_item' USING ERRCODE='22023'; END IF;
  fingerprint:=encode(sha256(convert_to(d::text,'UTF8')),'hex');
  SELECT * INTO r FROM public.provas_pedagogicas p WHERE p.escola_id=p_escola AND p.importacao_chave=chave;
  IF FOUND THEN
   IF r.importacao_hash IS DISTINCT FROM fingerprint THEN RAISE EXCEPTION 'import_key_conflict' USING ERRCODE='23505'; END IF;
   prova_id:=r.id; criada:=false; RETURN NEXT; CONTINUE;
  END IF;
  SELECT * INTO ctx FROM provas_private.provas_import_contexto(p_escola,(d->>'ano_letivo_id')::uuid,(d->>'curso_matriz_id')::uuid) c WHERE c.trimestre=(d->>'trimestre')::integer;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_academic_context' USING ERRCODE='42501'; END IF;
  PERFORM provas_private.provas_validar_blocos(d->'conteudo');
  IF d ? 'apresentacao' AND (jsonb_typeof(d->'apresentacao') IS DISTINCT FROM 'string' OR d->>'apresentacao' NOT IN ('automatica','compacta','espacosa')) THEN RAISE EXCEPTION 'invalid_apresentacao' USING ERRCODE='22023'; END IF;
  v_max:=provas_private.provas_cotacao_max(p_escola,ctx.ano_letivo_id,ctx.curso_matriz_id,ctx.trimestre);
  IF v_max IS NULL THEN RAISE EXCEPTION 'unavailable_exam_scale' USING ERRCODE='22023'; END IF;
  SELECT count(*),count(*) FILTER(WHERE coalesce((b->>'cotacao_cent')::integer,0)<=0),count(*) FILTER(WHERE b ? 'cotacao_cent'),coalesce(sum((b->>'cotacao_cent')::integer),0)
   INTO v_count,v_missing,v_marked,v_total FROM jsonb_array_elements(d->'conteudo') b WHERE b->>'tipo' NOT IN ('grupo','texto');
  IF v_count=0 OR (v_max=0 AND v_marked<>0) OR (v_max>0 AND (v_total<>v_max OR v_missing<>0)) THEN RAISE EXCEPTION 'invalid_exam_cotacao' USING ERRCODE='22023'; END IF;
  INSERT INTO public.provas_pedagogicas(escola_id,autor_id,autor_tipo,importacao_chave,importacao_hash,ano_letivo_id,curso_matriz_id,tipo_prova,apresentacao,titulo,classe,disciplina,ano_lectivo,trimestre,duracao,serie,conteudo)
   VALUES(p_escola,NULL,'sistema',chave,fingerprint,ctx.ano_letivo_id,ctx.curso_matriz_id,coalesce(d->>'tipo_prova','trimestral'),coalesce(d->>'apresentacao','automatica'),d->>'titulo',ctx.classe,ctx.disciplina,ctx.ano_lectivo,ctx.trimestre,(d->>'duracao')::smallint,d->>'serie',d->'conteudo')
   ON CONFLICT (escola_id,importacao_chave) WHERE importacao_chave IS NOT NULL DO NOTHING RETURNING * INTO r;
  criada:=FOUND;
  IF NOT criada THEN
   SELECT * INTO STRICT r FROM public.provas_pedagogicas p WHERE p.escola_id=p_escola AND p.importacao_chave=chave;
   IF r.importacao_hash IS DISTINCT FROM fingerprint THEN RAISE EXCEPTION 'import_key_conflict' USING ERRCODE='23505'; END IF;
  END IF;
  prova_id:=r.id; RETURN NEXT;
 END LOOP;
END;
$import$;
REVOKE ALL ON FUNCTION provas_private.provas_importar_sistema(uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
