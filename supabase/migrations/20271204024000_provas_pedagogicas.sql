BEGIN;
-- Bounded figures use the same tenant-scoped RLS row as their question.
-- No bucket, URL fetch, separate grant or public object.
CREATE FUNCTION provas_private.provas_figura_valida(p_src text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $figure$
DECLARE payload text; bytes bytea; w bigint; h bigint;
BEGIN
 IF p_src IS NULL OR length(p_src)>160000 OR left(p_src,22)<>'data:image/png;base64,' THEN RETURN false; END IF;
 payload:=substring(p_src from 23);
 IF length(payload)<44 OR length(payload)%4<>0 OR payload !~ '^[A-Za-z0-9+/]+={0,2}$' THEN RETURN false; END IF;
 BEGIN bytes:=decode(payload,'base64'); EXCEPTION WHEN invalid_parameter_value OR invalid_text_representation THEN RETURN false; END;
 IF length(bytes)<33 OR replace(encode(bytes,'base64'),chr(10),'')<>payload OR substring(bytes from 1 for 16)<>decode('89504e470d0a1a0a0000000d49484452','hex') THEN RETURN false; END IF;
 w:=get_byte(bytes,16)::bigint*16777216+get_byte(bytes,17)*65536+get_byte(bytes,18)*256+get_byte(bytes,19);
 h:=get_byte(bytes,20)::bigint*16777216+get_byte(bytes,21)*65536+get_byte(bytes,22)*256+get_byte(bytes,23);
 RETURN w BETWEEN 1 AND 1200 AND h BETWEEN 1 AND 1200;
END;
$figure$;
REVOKE ALL ON FUNCTION provas_private.provas_figura_valida(text) FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE public.provas_pedagogicas DROP CONSTRAINT provas_pedagogicas_conteudo_check;
ALTER TABLE public.provas_pedagogicas ADD CONSTRAINT provas_pedagogicas_conteudo_check CHECK(jsonb_typeof(conteudo)='array' AND jsonb_array_length(conteudo) BETWEEN 1 AND 80 AND octet_length(conteudo::text)<=900000);
CREATE OR REPLACE FUNCTION provas_private.provas_validar_blocos(v_body jsonb)
RETURNS void LANGUAGE plpgsql SET search_path='' AS $validate$
DECLARE b jsonb; v_option jsonb; v_math_total integer:=0; f jsonb; v_figure_total integer:=0; v_text_bytes integer:=0;
BEGIN
   IF jsonb_typeof(v_body) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'invalid_blocks' USING ERRCODE='22023'; END IF;
   IF jsonb_array_length(v_body) NOT BETWEEN 1 AND 80 OR octet_length(v_body::text)>900000 THEN RAISE EXCEPTION 'invalid_blocks' USING ERRCODE='22023'; END IF;
   FOR b IN SELECT value FROM jsonb_array_elements(v_body) LOOP
     IF jsonb_typeof(b) IS DISTINCT FROM 'object' OR coalesce(b->>'tipo','') NOT IN ('grupo','texto','discursiva','verdadeiro_falso','lacunas','escolha','calculo','desenho','alinea') OR jsonb_typeof(b->'texto') IS DISTINCT FROM 'string' OR length(btrim(b->>'texto')) NOT BETWEEN 1 AND 3000 OR jsonb_typeof(b->'linhas') IS DISTINCT FROM 'number' OR coalesce(b->>'linhas','') !~ '^[0-9]{1,2}$' OR (b->>'linhas')::int NOT BETWEEN 0 AND 20 THEN RAISE EXCEPTION 'invalid_block' USING ERRCODE='22023'; END IF;
     IF (b - ARRAY['tipo','texto','linhas','rich','alternativas','cotacao_cent','figuras']) <> '{}'::jsonb THEN RAISE EXCEPTION 'invalid_block_fields' USING ERRCODE='22023'; END IF;
     v_text_bytes:=v_text_bytes+octet_length((b-'figuras')::text)+2;
     IF v_text_bytes>150000 THEN RAISE EXCEPTION 'invalid_blocks' USING ERRCODE='22023'; END IF;
     IF b ? 'figuras' THEN
       IF b->>'tipo'='grupo' OR jsonb_typeof(b->'figuras') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'invalid_figures' USING ERRCODE='22023'; END IF;
       IF jsonb_array_length(b->'figuras') NOT BETWEEN 1 AND 6 THEN RAISE EXCEPTION 'invalid_figures' USING ERRCODE='22023'; END IF;
       v_figure_total:=v_figure_total+jsonb_array_length(b->'figuras');
       IF v_figure_total>24 THEN RAISE EXCEPTION 'too_many_figures' USING ERRCODE='22023'; END IF;
       FOR f IN SELECT value FROM jsonb_array_elements(b->'figuras') LOOP
         IF jsonb_typeof(f) IS DISTINCT FROM 'object' OR (f-ARRAY['src','alt'])<>'{}'::jsonb OR jsonb_typeof(f->'src') IS DISTINCT FROM 'string' OR jsonb_typeof(f->'alt') IS DISTINCT FROM 'string' OR length(btrim(f->>'alt')) NOT BETWEEN 1 AND 160 OR NOT provas_private.provas_figura_valida(f->>'src') THEN RAISE EXCEPTION 'invalid_figure' USING ERRCODE='22023'; END IF;
       END LOOP;
     END IF;
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
-- Existing authenticated mutator and private system importer call this shared validator.
-- Existing scoring guard is unchanged: qualitative blocks omit cotacao_cent.
COMMIT;
