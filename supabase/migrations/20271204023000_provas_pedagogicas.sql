BEGIN;
-- Add bounded mathematical environments without changing permissions or stored document format.
CREATE FUNCTION provas_private.provas_math_scalar_validate(v_latex text)
RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $scalar$
DECLARE v_cmd text; v_char text; v_depth int; v_i int;
BEGIN
     IF v_latex IS NULL OR length(v_latex) NOT BETWEEN 1 AND 300 OR btrim(v_latex)='' OR v_latex ~ '[[:cntrl:]<>&$#%]' OR right(v_latex,1)=chr(92) THEN RAISE EXCEPTION 'invalid_math' USING ERRCODE='22023'; END IF;
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

END;
$scalar$;
REVOKE ALL ON FUNCTION provas_private.provas_math_scalar_validate(text) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION provas_private.provas_math_grid_validate(v_latex text)
RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $grid$
DECLARE v_rest text:=v_latex; v_slash text:=chr(92); v_begin text:=chr(92)||'begin{'; v_env text; v_tag text; v_body text;
 v_start int; v_body_start int; v_end int; v_rows text[]; v_cells text[]; v_row text; v_cell text; v_cols int; v_i int; v_depth int:=0; v_char text;
BEGIN
 IF v_latex IS NULL OR length(v_latex) NOT BETWEEN 1 AND 300 OR btrim(v_latex)='' OR v_latex ~ '[[:cntrl:]<>$#%]' THEN
  RAISE EXCEPTION 'invalid_math' USING ERRCODE='22023';
 END IF;
 FOR v_i IN 1..length(v_latex) LOOP
  v_char:=substr(v_latex,v_i,1);
  IF v_char='{' THEN v_depth:=v_depth+1; ELSIF v_char='}' THEN v_depth:=v_depth-1; END IF;
  IF v_depth NOT BETWEEN 0 AND 8 THEN RAISE EXCEPTION 'invalid_math_depth' USING ERRCODE='22023'; END IF;
 END LOOP;
 IF v_depth<>0 THEN RAISE EXCEPTION 'invalid_math_depth' USING ERRCODE='22023'; END IF;
 LOOP
  v_start:=strpos(v_rest,v_begin);
  EXIT WHEN v_start=0;
  v_env:=NULL;
  FOREACH v_tag IN ARRAY ARRAY['cases','pmatrix','vmatrix'] LOOP
   IF substr(v_rest,v_start,length(v_begin||v_tag||'}'))=v_begin||v_tag||'}' THEN v_env:=v_tag; EXIT; END IF;
  END LOOP;
  IF v_env IS NULL THEN RAISE EXCEPTION 'unsupported_math_environment' USING ERRCODE='22023'; END IF;
  v_body_start:=v_start+length(v_begin||v_env||'}');
  v_tag:=v_slash||'end{'||v_env||'}';
  v_end:=strpos(substr(v_rest,v_body_start),v_tag);
  IF v_end=0 THEN RAISE EXCEPTION 'invalid_math_environment' USING ERRCODE='22023'; END IF;
  v_body:=substr(v_rest,v_body_start,v_end-1);
  v_rows:=string_to_array(v_body,v_slash||v_slash);
  IF cardinality(v_rows) NOT BETWEEN 1 AND 4 THEN RAISE EXCEPTION 'invalid_math_grid_size' USING ERRCODE='22023'; END IF;
  v_cols:=NULL;
  FOREACH v_row IN ARRAY v_rows LOOP
   v_cells:=string_to_array(v_row,'&');
   IF cardinality(v_cells) NOT BETWEEN 1 AND 4 THEN RAISE EXCEPTION 'invalid_math_grid_size' USING ERRCODE='22023'; END IF;
   IF v_cols IS NULL THEN v_cols:=cardinality(v_cells); ELSIF v_cols<>cardinality(v_cells) THEN RAISE EXCEPTION 'invalid_math_grid_shape' USING ERRCODE='22023'; END IF;
   FOREACH v_cell IN ARRAY v_cells LOOP
    PERFORM provas_private.provas_math_scalar_validate(v_cell);
   END LOOP;
  END LOOP;
  IF (v_env='cases' AND (cardinality(v_rows)<2 OR v_cols<>1))
   OR (v_env='vmatrix' AND (cardinality(v_rows)<2 OR v_cols<>cardinality(v_rows))) THEN
   RAISE EXCEPTION 'invalid_math_grid_shape' USING ERRCODE='22023';
  END IF;
  v_rest:=substr(v_rest,1,v_start-1)||'1'||substr(v_rest,v_body_start+v_end-1+length(v_tag));
 END LOOP;
 -- Outside a checked grid, the old scalar allowlist still rejects alignment,
 -- row separators, begin/end, unknown macros and HTML metacharacters.
 PERFORM provas_private.provas_math_scalar_validate(v_rest);
END;
$grid$;
REVOKE ALL ON FUNCTION provas_private.provas_math_grid_validate(text) FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION provas_private.provas_rich_validate(p_doc jsonb,p_text text)
RETURNS integer LANGUAGE plpgsql IMMUTABLE SET search_path=''
AS $rich$
DECLARE seg jsonb; m jsonb; v_latex text;
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
     PERFORM provas_private.provas_math_grid_validate(v_latex);
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
COMMIT;
