BEGIN;
-- Confidential assessment documents; no fiscal, student or public-document linkage.
CREATE SCHEMA provas_private;
REVOKE ALL ON SCHEMA provas_private FROM PUBLIC,anon,service_role;
CREATE TABLE public.provas_pedagogicas (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
 autor_id uuid NOT NULL REFERENCES auth.users(id),
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
 OR (estado='aprovada' AND provas_private.provas_papel(escola_id,ARRAY['secretaria','secretaria_financeiro']))
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

-- Only one mutation boundary. No direct INSERT/UPDATE/DELETE grants.
CREATE FUNCTION provas_private.provas_mutar(p_escola uuid,p_id uuid,p_versao integer,p_acao text,p_dados jsonb)
RETURNS public.provas_pedagogicas LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE r public.provas_pedagogicas; v_actor uuid:=auth.uid();
 v_admin boolean; v_prof boolean; b jsonb; v_body jsonb; v_math_total integer:=0;
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
   v_body:=p_dados->'conteudo';
   IF jsonb_typeof(v_body) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'invalid_blocks' USING ERRCODE='22023'; END IF;
   IF jsonb_array_length(v_body) NOT BETWEEN 1 AND 80 OR octet_length(v_body::text)>150000 THEN RAISE EXCEPTION 'invalid_blocks' USING ERRCODE='22023'; END IF;
   FOR b IN SELECT value FROM jsonb_array_elements(v_body) LOOP
     IF jsonb_typeof(b) IS DISTINCT FROM 'object' OR coalesce(b->>'tipo','') NOT IN ('grupo','texto','discursiva','verdadeiro_falso','lacunas','escolha','calculo','desenho','alinea') OR jsonb_typeof(b->'texto') IS DISTINCT FROM 'string' OR length(btrim(b->>'texto')) NOT BETWEEN 1 AND 3000 OR jsonb_typeof(b->'linhas') IS DISTINCT FROM 'number' OR coalesce(b->>'linhas','') !~ '^[0-9]{1,2}$' OR (b->>'linhas')::int NOT BETWEEN 0 AND 20 THEN RAISE EXCEPTION 'invalid_block' USING ERRCODE='22023'; END IF;
     IF (b - ARRAY['tipo','texto','linhas','rich']) <> '{}'::jsonb THEN RAISE EXCEPTION 'invalid_block_fields' USING ERRCODE='22023'; END IF;
     IF b ? 'rich' THEN v_math_total:=v_math_total+provas_private.provas_rich_validate(b->'rich',b->>'texto'); END IF;
     IF v_math_total>80 THEN RAISE EXCEPTION 'too_many_formulas' USING ERRCODE='22023'; END IF;
   END LOOP;
   IF p_acao='criar' THEN
     INSERT INTO public.provas_pedagogicas(escola_id,autor_id,titulo,classe,disciplina,ano_lectivo,trimestre,duracao,serie,conteudo)
     VALUES(p_escola,v_actor,p_dados->>'titulo',p_dados->>'classe',p_dados->>'disciplina',p_dados->>'ano_lectivo',(p_dados->>'trimestre')::smallint,(p_dados->>'duracao')::smallint,p_dados->>'serie',v_body) RETURNING * INTO r;
   ELSE
     UPDATE public.provas_pedagogicas SET titulo=p_dados->>'titulo',classe=p_dados->>'classe',disciplina=p_dados->>'disciplina',ano_lectivo=p_dados->>'ano_lectivo',trimestre=(p_dados->>'trimestre')::smallint,duracao=(p_dados->>'duracao')::smallint,serie=p_dados->>'serie',conteudo=v_body,versao=versao+1,atualizado_em=clock_timestamp() WHERE id=r.id RETURNING * INTO r;
   END IF;
 ELSIF p_acao='duplicar' THEN
   INSERT INTO public.provas_pedagogicas(escola_id,autor_id,titulo,classe,disciplina,ano_lectivo,trimestre,duracao,serie,conteudo)
   VALUES(p_escola,v_actor,r.titulo,r.classe,r.disciplina,r.ano_lectivo,r.trimestre,r.duracao,r.serie,r.conteudo) RETURNING * INTO r;
 ELSE
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
COMMIT;
