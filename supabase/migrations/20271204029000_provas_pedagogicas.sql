BEGIN;
-- Optional explicit answer format; legacy blocks retain their inferred layout.
CREATE OR REPLACE FUNCTION provas_private.provas_validar_blocos(v_body jsonb)
RETURNS void LANGUAGE plpgsql SET search_path='' AS $validate$
DECLARE b jsonb; v_option jsonb; v_math_total integer:=0; f jsonb; v_figure_total integer:=0; v_text_bytes integer:=0;
BEGIN
   IF jsonb_typeof(v_body) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'invalid_blocks' USING ERRCODE='22023'; END IF;
   IF jsonb_array_length(v_body) NOT BETWEEN 1 AND 80 OR octet_length(v_body::text)>900000 THEN RAISE EXCEPTION 'invalid_blocks' USING ERRCODE='22023'; END IF;
   FOR b IN SELECT value FROM jsonb_array_elements(v_body) LOOP
     IF jsonb_typeof(b) IS DISTINCT FROM 'object' OR coalesce(b->>'tipo','') NOT IN ('grupo','texto','discursiva','verdadeiro_falso','lacunas','escolha','calculo','desenho','alinea') OR jsonb_typeof(b->'texto') IS DISTINCT FROM 'string' OR length(btrim(b->>'texto')) NOT BETWEEN 1 AND 3000 OR jsonb_typeof(b->'linhas') IS DISTINCT FROM 'number' OR coalesce(b->>'linhas','') !~ '^[0-9]{1,2}$' OR (b->>'linhas')::int NOT BETWEEN 0 AND 20 THEN RAISE EXCEPTION 'invalid_block' USING ERRCODE='22023'; END IF;
     IF (b - ARRAY['tipo','texto','linhas','rich','alternativas','cotacao_cent','figuras','resposta_formato']) <> '{}'::jsonb THEN RAISE EXCEPTION 'invalid_block_fields' USING ERRCODE='22023'; END IF;
     IF b ? 'resposta_formato' AND (
       jsonb_typeof(b->'resposta_formato') IS DISTINCT FROM 'string'
       OR b->>'resposta_formato' NOT IN ('nenhum','linhas','retangulo')
       OR b->>'tipo' IN ('grupo','texto')
       OR ((b->>'resposta_formato'='nenhum') IS DISTINCT FROM ((b->>'linhas')::int=0))
       OR (b->>'resposta_formato'='retangulo' AND (b->>'linhas')::int<3)
     ) THEN RAISE EXCEPTION 'invalid_answer_format' USING ERRCODE='22023'; END IF;
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
