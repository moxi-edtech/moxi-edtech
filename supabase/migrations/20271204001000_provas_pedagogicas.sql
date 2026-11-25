BEGIN;
-- Confidential assessment documents; no fiscal, student or public-document linkage.
CREATE SCHEMA provas_private;
REVOKE ALL ON SCHEMA provas_private FROM PUBLIC,anon,service_role;
CREATE TABLE public.provas_pedagogicas (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
 autor_id uuid NOT NULL REFERENCES auth.users(id),
 ano_letivo_id uuid NOT NULL REFERENCES public.anos_letivos(id),
 curso_matriz_id uuid NOT NULL REFERENCES public.curso_matriz(id),
 tipo_prova text NOT NULL DEFAULT 'trimestral' CHECK(tipo_prova IN ('professor','trimestral','exame_final','recurso','extraordinario','segunda_chamada','diagnostica','simulado','outro')),
 titulo text NOT NULL CHECK(length(btrim(titulo)) BETWEEN 1 AND 160),
 classe text NOT NULL CHECK(length(btrim(classe)) BETWEEN 1 AND 80),
 disciplina text NOT NULL CHECK(length(btrim(disciplina)) BETWEEN 1 AND 120),
 ano_lectivo text NOT NULL CHECK(ano_lectivo ~ '^[0-9]{4}/[0-9]{4}$'),
 trimestre smallint NOT NULL CHECK(trimestre BETWEEN 1 AND 3),
 duracao smallint NOT NULL CHECK(duracao BETWEEN 1 AND 480),
 serie text NOT NULL CHECK(length(btrim(serie)) BETWEEN 1 AND 20),
 conteudo jsonb NOT NULL CHECK(jsonb_typeof(conteudo)='array' AND jsonb_array_length(conteudo) BETWEEN 1 AND 80 AND octet_length(conteudo::text)<=150000),
 estado text NOT NULL DEFAULT 'rascunho' CHECK(estado IN ('rascunho','em_revisao','aprovada','arquivada')),
 versao integer NOT NULL DEFAULT 1 CHECK(versao>0),
 criado_em timestamptz NOT NULL DEFAULT now(),
 atualizado_em timestamptz NOT NULL DEFAULT now(),
 aprovado_por uuid REFERENCES auth.users(id),
 aprovado_em timestamptz,
 CHECK ((aprovado_por IS NULL)=(aprovado_em IS NULL))
);
CREATE INDEX provas_escola_atualizado_idx ON public.provas_pedagogicas(escola_id, atualizado_em DESC,id DESC);
CREATE INDEX provas_autor_idx ON public.provas_pedagogicas(escola_id,autor_id,atualizado_em DESC);
ALTER TABLE public.provas_pedagogicas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.provas_pedagogicas FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.provas_pedagogicas TO authenticated;

CREATE FUNCTION provas_private.provas_papel(p_escola uuid,p_roles text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(
  SELECT 1 FROM public.escola_users e WHERE e.escola_id=p_escola AND e.user_id=auth.uid()
   AND e.tenant_type='k12' AND e.papel=ANY(p_roles)
 );
$$;
REVOKE ALL ON FUNCTION provas_private.provas_papel(uuid,text[]) FROM PUBLIC,anon,service_role;
GRANT USAGE ON SCHEMA provas_private TO authenticated;
GRANT EXECUTE ON FUNCTION provas_private.provas_papel(uuid,text[]) TO authenticated;
CREATE POLICY provas_read ON public.provas_pedagogicas FOR SELECT TO authenticated USING (
 provas_private.provas_papel(escola_id,ARRAY['admin','admin_escola','diretor','admin_secretaria','admin_secretario','staff_admin'])
 OR (autor_id=(SELECT auth.uid()) AND provas_private.provas_papel(escola_id,ARRAY['professor']))
 OR (estado='aprovada' AND provas_private.provas_papel(escola_id,ARRAY['secretaria','secretaria_financeiro','admin_financeiro']))
);

-- Validate rich v1 at the same RPC boundary; never accept HTML, arbitrary attrs or URLs.
CREATE FUNCTION provas_private.provas_rich_validate(p_doc jsonb,p_text text)
RETURNS integer LANGUAGE plpgsql IMMUTABLE SET search_path=''
AS $rich$
DECLARE seg jsonb; m jsonb; v_latex text; v_cmd text; v_char text; v_depth int; v_i int;
 v_plain text:=''; v_math int:=0; v_marks text[];
BEGIN
 IF jsonb_typeof(p_doc) IS DISTINCT FROM 'object' OR (p_doc-ARRAY['version','segments'])<>'{}'::jsonb
 OR p_doc->'version' IS DISTINCT FROM '1'::jsonb OR jsonb_typeof(p_doc->'segments') IS DISTINCT FROM 'array' THEN
   RAISE EXCEPTION 'invalid_rich' USING ERRCODE='22023';
 END IF;
 IF jsonb_array_length(p_doc->'segments') NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'invalid_segments' USING ERRCODE='22023'; END IF;
 FOR seg IN SELECT value FROM jsonb_array_elements(p_doc->'segments') LOOP
   IF jsonb_typeof(seg) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'invalid_segment' USING ERRCODE='22023'; END IF;
   CASE seg->>'kind'
   WHEN 'text' THEN
     IF (seg-ARRAY['kind','text','marks'])<>'{}'::jsonb OR jsonb_typeof(seg->'text') IS DISTINCT FROM 'string'
       OR length(seg->>'text') NOT BETWEEN 1 AND 3000 OR jsonb_typeof(seg->'marks') IS DISTINCT FROM 'array' THEN
       RAISE EXCEPTION 'invalid_text_segment' USING ERRCODE='22023';
     END IF;
     IF jsonb_array_length(seg->'marks')>3 THEN RAISE EXCEPTION 'invalid_marks' USING ERRCODE='22023'; END IF;
     v_marks:=ARRAY[]::text[];
     FOR m IN SELECT value FROM jsonb_array_elements(seg->'marks') LOOP
       IF jsonb_typeof(m) IS DISTINCT FROM 'string' OR (m#>>'{}') NOT IN ('bold','italic','underline') OR (m#>>'{}')=ANY(v_marks) THEN
         RAISE EXCEPTION 'invalid_marks' USING ERRCODE='22023';
       END IF;
       v_marks:=array_append(v_marks,m#>>'{}');
     END LOOP;
     v_plain:=v_plain||(seg->>'text');
   WHEN 'break' THEN
     IF (seg-'kind')<>'{}'::jsonb THEN RAISE EXCEPTION 'invalid_break' USING ERRCODE='22023'; END IF;
     v_plain:=v_plain||chr(10);
   WHEN 'math' THEN
     IF (seg-ARRAY['kind','latex'])<>'{}'::jsonb OR jsonb_typeof(seg->'latex') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'invalid_math' USING ERRCODE='22023'; END IF;
     v_latex:=seg->>'latex';
     IF length(v_latex) NOT BETWEEN 1 AND 300 OR btrim(v_latex)='' OR v_latex ~ '[[:cntrl:]<>&$#%]' OR right(v_latex,1)=chr(92) THEN RAISE EXCEPTION 'invalid_math' USING ERRCODE='22023'; END IF;
     v_depth:=0;
     FOR v_i IN 1..length(v_latex) LOOP
       v_char:=substr(v_latex,v_i,1);
       IF v_char='{' THEN v_depth:=v_depth+1; ELSIF v_char='}' THEN v_depth:=v_depth-1; END IF;
       IF v_depth NOT BETWEEN 0 AND 8 THEN RAISE EXCEPTION 'invalid_math_depth' USING ERRCODE='22023'; END IF;
     END LOOP;
     IF v_depth<>0 THEN RAISE EXCEPTION 'invalid_math_depth' USING ERRCODE='22023'; END IF;
     FOR v_cmd IN SELECT x[1] FROM regexp_matches(v_latex,'\\([A-Za-z]+|.)','g') AS x LOOP
       IF v_cmd NOT IN ('frac','dfrac','tfrac','sqrt','pi','times','div','pm','mp','cdot','left','right','sin','cos','tan','log','ln','exp','lim','sum','prod','int','infty','in','notin','cup','cap','subset','subseteq','supset','supseteq','le','leq','ge','geq','ne','neq','approx','equiv','alpha','beta','gamma','delta','theta','lambda','mu','sigma','omega','phi','Delta','Omega','Gamma','Sigma','vec','overline','underline','hat','bar','text','mathrm','mathbf','mathit','quad','qquad','degree','circ','percent',' ',',',';','!','(',')','[',']','|','{','}','_') THEN
         RAISE EXCEPTION 'unsupported_math_command' USING ERRCODE='22023';
       END IF;
     END LOOP;
     v_math:=v_math+1;
     IF v_math>12 THEN RAISE EXCEPTION 'too_many_formulas' USING ERRCODE='22023'; END IF;
     v_plain:=v_plain||v_latex;
   ELSE RAISE EXCEPTION 'invalid_segment_kind' USING ERRCODE='22023';
   END CASE;
   IF length(v_plain)>6000 THEN RAISE EXCEPTION 'invalid_rich_length' USING ERRCODE='22023'; END IF;
 END LOOP;
 IF regexp_replace(v_plain,'^[[:space:]]+|[[:space:]]+$','','g') IS DISTINCT FROM p_text THEN RAISE EXCEPTION 'inconsistent_rich' USING ERRCODE='22023'; END IF;
 RETURN v_math;
END;
$rich$;
REVOKE ALL ON FUNCTION provas_private.provas_rich_validate(jsonb,text) FROM PUBLIC,anon,authenticated,service_role;

-- Academic identity: one published curriculum matrix per year and a configured trimester.
-- Keep print labels as historical snapshots; never trust caller-supplied names.
CREATE FUNCTION provas_private.provas_opcoes(p_escola uuid,p_ano uuid,p_matriz uuid DEFAULT NULL)
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
  provas_private.provas_papel(p_escola,ARRAY['admin','admin_escola','diretor','admin_secretaria','admin_secretario','staff_admin'])
  OR (
   provas_private.provas_papel(p_escola,ARRAY['professor']) AND EXISTS (
    SELECT 1 FROM public.turma_disciplinas td
    JOIN public.turmas t ON t.id=td.turma_id AND t.escola_id=td.escola_id
    JOIN public.professores pr ON pr.escola_id=t.escola_id AND pr.profile_id=auth.uid()
    WHERE td.escola_id=p_escola AND td.curso_matriz_id=cm.id AND t.ano_letivo_id=a.id
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
REVOKE ALL ON FUNCTION provas_private.provas_opcoes(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION provas_private.provas_contexto(p_escola uuid,p_ano uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $context$
DECLARE v_result jsonb;
BEGIN
 IF NOT provas_private.provas_papel(p_escola,ARRAY['admin','admin_escola','diretor','admin_secretaria','admin_secretario','staff_admin','professor']) THEN
  RAISE EXCEPTION 'not_allowed' USING ERRCODE='42501';
 END IF;
 IF p_ano IS NULL THEN
  SELECT coalesce(jsonb_agg(to_jsonb(y) ORDER BY y.ativo DESC,y.data_inicio DESC,y.id),'[]'::jsonb) INTO v_result
  FROM (SELECT a.id,a.ativo,a.data_inicio,
   extract(year from a.data_inicio)::integer::text||'/'||extract(year from a.data_fim)::integer::text AS label
   FROM public.anos_letivos a WHERE a.escola_id=p_escola ORDER BY a.ativo DESC,a.data_inicio DESC,a.id LIMIT 101) y;
  IF jsonb_array_length(v_result)>100 THEN RAISE EXCEPTION 'too_many_academic_years' USING ERRCODE='22023'; END IF;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM public.anos_letivos WHERE id=p_ano AND escola_id=p_escola) THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE='42501'; END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(o) ORDER BY o.curso,o.classe,o.disciplina,o.curso_matriz_id,o.trimestre),'[]'::jsonb) INTO v_result
  FROM (SELECT * FROM provas_private.provas_opcoes(p_escola,p_ano,NULL) ORDER BY curso,classe,disciplina,curso_matriz_id,trimestre LIMIT 1501) o;
  IF jsonb_array_length(v_result)>1500 THEN RAISE EXCEPTION 'too_many_academic_options' USING ERRCODE='22023'; END IF;
 END IF;
 RETURN v_result;
END;
$context$;
REVOKE ALL ON FUNCTION provas_private.provas_contexto(uuid,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION provas_private.provas_contexto(uuid,uuid) TO authenticated;
CREATE FUNCTION public.provas_contexto(p_escola uuid,p_ano uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $public_context$
 SELECT provas_private.provas_contexto(p_escola,p_ano);
$public_context$;
REVOKE ALL ON FUNCTION public.provas_contexto(uuid,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.provas_contexto(uuid,uuid) TO authenticated;

-- Only one mutation boundary. No direct INSERT/UPDATE/DELETE grants.
CREATE FUNCTION provas_private.provas_mutar(p_escola uuid,p_id uuid,p_versao integer,p_acao text,p_dados jsonb)
RETURNS public.provas_pedagogicas LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE r public.provas_pedagogicas; v_actor uuid:=auth.uid();
 v_admin boolean; v_prof boolean; b jsonb; v_option jsonb; v_body jsonb; v_math_total integer:=0; v_context record;
BEGIN
 v_admin:=provas_private.provas_papel(p_escola,ARRAY['admin','admin_escola','diretor','admin_secretaria','admin_secretario','staff_admin']);
 v_prof:=provas_private.provas_papel(p_escola,ARRAY['professor']);
 IF v_actor IS NULL OR NOT(v_admin OR v_prof) THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE='42501'; END IF;
 IF p_acao IS NULL OR p_acao NOT IN ('criar','guardar','submeter','aprovar','devolver','arquivar','duplicar') THEN RAISE EXCEPTION 'invalid_action' USING ERRCODE='22023'; END IF;
 IF p_acao<>'criar' THEN
   SELECT * INTO r FROM public.provas_pedagogicas WHERE id=p_id AND escola_id=p_escola FOR UPDATE;
   IF NOT FOUND OR NOT(v_admin OR r.autor_id=v_actor) THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE='42501'; END IF;
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
   v_body:=p_dados->'conteudo';
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
   IF p_acao='criar' THEN
     INSERT INTO public.provas_pedagogicas(escola_id,autor_id,ano_letivo_id,curso_matriz_id,tipo_prova,titulo,classe,disciplina,ano_lectivo,trimestre,duracao,serie,conteudo)
     VALUES(p_escola,v_actor,v_context.ano_letivo_id,v_context.curso_matriz_id,coalesce(p_dados->>'tipo_prova','trimestral'),p_dados->>'titulo',v_context.classe,v_context.disciplina,v_context.ano_lectivo,v_context.trimestre,(p_dados->>'duracao')::smallint,p_dados->>'serie',v_body) RETURNING * INTO r;
   ELSE
     UPDATE public.provas_pedagogicas SET ano_letivo_id=v_context.ano_letivo_id,curso_matriz_id=v_context.curso_matriz_id,tipo_prova=coalesce(p_dados->>'tipo_prova','trimestral'),titulo=p_dados->>'titulo',classe=v_context.classe,disciplina=v_context.disciplina,ano_lectivo=v_context.ano_lectivo,trimestre=v_context.trimestre,duracao=(p_dados->>'duracao')::smallint,serie=p_dados->>'serie',conteudo=v_body,versao=versao+1,atualizado_em=clock_timestamp() WHERE id=r.id RETURNING * INTO r;
   END IF;
 ELSIF p_acao='duplicar' THEN
   SELECT * INTO v_context FROM provas_private.provas_opcoes(p_escola,r.ano_letivo_id,r.curso_matriz_id) o WHERE o.trimestre=r.trimestre;
   IF NOT FOUND THEN RAISE EXCEPTION 'invalid_academic_context' USING ERRCODE='42501'; END IF;
   INSERT INTO public.provas_pedagogicas(escola_id,autor_id,ano_letivo_id,curso_matriz_id,tipo_prova,titulo,classe,disciplina,ano_lectivo,trimestre,duracao,serie,conteudo)
   VALUES(p_escola,v_actor,v_context.ano_letivo_id,v_context.curso_matriz_id,r.tipo_prova,r.titulo,v_context.classe,v_context.disciplina,v_context.ano_lectivo,v_context.trimestre,r.duracao,r.serie,r.conteudo) RETURNING * INTO r;
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
REVOKE ALL ON FUNCTION provas_private.provas_mutar(uuid,uuid,integer,text,jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION provas_private.provas_mutar(uuid,uuid,integer,text,jsonb) TO authenticated;
CREATE FUNCTION public.provas_mutar(p_escola uuid,p_id uuid,p_versao integer,p_acao text,p_dados jsonb)
RETURNS public.provas_pedagogicas LANGUAGE sql SECURITY INVOKER SET search_path=''
AS $$ SELECT provas_private.provas_mutar(p_escola,p_id,p_versao,p_acao,p_dados); $$;
REVOKE ALL ON FUNCTION public.provas_mutar(uuid,uuid,integer,text,jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.provas_mutar(uuid,uuid,integer,text,jsonb) TO authenticated;

-- Read-only distribution. SECURITY INVOKER preserves school and campus RLS on
-- turmas, turma_disciplinas, matriculas and alunos. No service role or names supplied by the caller.
CREATE FUNCTION public.provas_destinatarios(p_escola uuid,p_prova uuid,p_versao integer,p_modo text,p_turmas uuid[],p_matricula uuid,p_offset integer,p_limit integer DEFAULT 40)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $distribution$
DECLARE r public.provas_pedagogicas; v_items jsonb; v_total integer; v_allowed integer; v_duplicate boolean; v_snapshot text;
BEGIN
 IF NOT provas_private.provas_papel(p_escola,ARRAY['admin','admin_escola','diretor','admin_secretaria','admin_secretario','staff_admin','secretaria','secretaria_financeiro','admin_financeiro']) THEN
  RAISE EXCEPTION 'not_allowed' USING ERRCODE='42501';
 END IF;
 IF p_modo IS NULL OR p_modo NOT IN ('turmas','alunos','imprimir') OR p_limit IS NULL OR p_limit NOT IN (1,5,10,20,40) OR p_offset IS NULL OR p_offset<0 OR p_offset>10000 OR p_turmas IS NULL OR cardinality(p_turmas)>10 OR array_position(p_turmas,NULL::uuid) IS NOT NULL OR cardinality(p_turmas)<>(SELECT count(DISTINCT x) FROM unnest(p_turmas) x) THEN
  RAISE EXCEPTION 'invalid_distribution' USING ERRCODE='22023';
 END IF;
 IF (p_modo='turmas' AND (cardinality(p_turmas)<>0 OR p_matricula IS NOT NULL OR p_offset<>0))
 OR (p_modo='alunos' AND (cardinality(p_turmas)<>1 OR p_matricula IS NOT NULL OR p_offset<>0))
 OR (p_modo='imprimir' AND (cardinality(p_turmas)=0 OR (p_matricula IS NOT NULL AND (cardinality(p_turmas)<>1 OR p_offset<>0)))) THEN
  RAISE EXCEPTION 'invalid_distribution' USING ERRCODE='22023';
 END IF;
 SELECT * INTO r FROM public.provas_pedagogicas WHERE id=p_prova AND escola_id=p_escola AND estado='aprovada';
 IF NOT FOUND THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE='42501'; END IF;
 IF p_versao IS DISTINCT FROM r.versao THEN RAISE EXCEPTION 'version_conflict' USING ERRCODE='40001'; END IF;
 WITH eligible AS MATERIALIZED (
   SELECT t.id,t.nome,t.letra,t.turno,t.sala,c.nome AS curso
   FROM public.turmas t
   JOIN public.curso_matriz cm ON cm.id=r.curso_matriz_id AND cm.escola_id=t.escola_id AND cm.classe_id=t.classe_id AND cm.curso_id=t.curso_id
   JOIN public.curso_curriculos cc ON cc.id=cm.curso_curriculo_id AND cc.escola_id=t.escola_id AND cc.ano_letivo_id=r.ano_letivo_id
   LEFT JOIN public.cursos c ON c.id=t.curso_id AND c.escola_id=t.escola_id
   WHERE t.escola_id=p_escola AND t.ano_letivo_id=r.ano_letivo_id AND t.session_id=r.ano_letivo_id
     AND (p_modo='turmas' OR t.id=ANY(p_turmas))
     AND EXISTS(SELECT 1 FROM public.turma_disciplinas td WHERE td.escola_id=p_escola AND td.turma_id=t.id AND td.curso_matriz_id=r.curso_matriz_id
      AND (td.periodos_ativos IS NULL OR r.trimestre=ANY(td.periodos_ativos)))
 ), roster AS MATERIALIZED (
   SELECT m.id AS matricula_id,m.aluno_id,e.id AS turma_id,e.nome AS turma,e.letra,e.turno,e.sala,e.curso,
     coalesce(nullif(btrim(a.nome_completo),''),a.nome) AS nome,a.numero_processo,m.numero_chamada
   FROM eligible e
   JOIN public.matriculas m ON m.escola_id=p_escola AND m.session_id=r.ano_letivo_id AND m.turma_id=e.id
   JOIN public.alunos a ON a.id=m.aluno_id AND a.escola_id=m.escola_id AND a.deleted_at IS NULL
   WHERE m.ativo IS TRUE AND lower(btrim(m.status)) IN ('ativo','ativa','active')
     AND (p_matricula IS NULL OR m.id=p_matricula)
 ), stats AS (
   SELECT count(*)::integer AS total,count(DISTINCT aluno_id)<>count(*) AS duplicate,md5(coalesce(string_agg(matricula_id::text,',' ORDER BY turma,numero_chamada NULLS LAST,nome,matricula_id),'')) AS snapshot FROM roster
 ), payload AS (
   SELECT CASE WHEN p_modo='turmas' THEN (
    SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.nome,q.id),'[]'::jsonb) FROM (
      SELECT e.id,e.nome,e.letra,e.turno,e.sala,e.curso,count(roster.matricula_id)::integer AS total
      FROM eligible e LEFT JOIN roster ON roster.turma_id=e.id GROUP BY e.id,e.nome,e.letra,e.turno,e.sala,e.curso
      ORDER BY e.nome,e.id LIMIT 501
    ) q
   ) ELSE (
    SELECT coalesce(jsonb_agg(to_jsonb(q)-'aluno_id' ORDER BY q.turma,q.numero_chamada NULLS LAST,q.nome,q.matricula_id),'[]'::jsonb) FROM (
      SELECT * FROM roster ORDER BY turma,numero_chamada NULLS LAST,nome,matricula_id
      LIMIT CASE WHEN p_modo='alunos' THEN 1001 ELSE p_limit END OFFSET p_offset
    ) q
   ) END AS items
 )
 SELECT payload.items,stats.total,(SELECT count(*) FROM eligible)::integer,stats.duplicate,stats.snapshot INTO v_items,v_total,v_allowed,v_duplicate,v_snapshot FROM payload CROSS JOIN stats;
 IF p_modo<>'turmas' AND v_allowed<>cardinality(p_turmas) THEN RAISE EXCEPTION 'invalid_turma' USING ERRCODE='42501'; END IF;
 IF p_modo<>'turmas' AND v_duplicate THEN RAISE EXCEPTION 'duplicate_active_enrollment' USING ERRCODE='22023'; END IF;
 IF (p_modo='turmas' AND v_allowed>500) OR (p_modo='alunos' AND v_total>1000) THEN RAISE EXCEPTION 'distribution_limit' USING ERRCODE='22023'; END IF;
 IF p_modo='imprimir' AND (v_total=0 OR p_offset>=v_total OR (p_matricula IS NOT NULL AND v_total<>1)) THEN RAISE EXCEPTION 'no_eligible_students' USING ERRCODE='22023'; END IF;
 RETURN jsonb_build_object('items',v_items,'total',v_total,'offset',p_offset,'limit',p_limit,'snapshot',v_snapshot);
END;
$distribution$;
REVOKE ALL ON FUNCTION public.provas_destinatarios(uuid,uuid,integer,text,uuid[],uuid,integer,integer) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.provas_destinatarios(uuid,uuid,integer,text,uuid[],uuid,integer,integer) TO authenticated;
COMMIT;
