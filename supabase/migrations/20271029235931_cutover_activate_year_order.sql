-- Avoid transient violation of the partial unique index
-- uq_anos_letivos_ativo_por_escola during a successful cutover.
-- Keep all rematricula, authorization and audit logic in the existing RPC.
BEGIN;
DO $patch$
DECLARE
  v_sql text;
  v_before text := E'  UPDATE public.anos_letivos\n     SET ativo = (id = p_to_session_id),\n         updated_at = now()\n   WHERE escola_id = p_escola_id;';
  v_after text := E'  UPDATE public.anos_letivos\n     SET ativo = false, updated_at = now()\n   WHERE escola_id = p_escola_id AND id <> p_to_session_id AND ativo IS TRUE;\n\n  UPDATE public.anos_letivos\n     SET ativo = true, updated_at = now()\n   WHERE escola_id = p_escola_id AND id = p_to_session_id;';
BEGIN
  SELECT pg_get_functiondef('public.cutover_ano_letivo_v3(uuid,uuid,uuid)'::regprocedure)
    INTO STRICT v_sql;
  IF strpos(v_sql,v_before)=0 THEN
    IF strpos(v_sql,v_after)>0 THEN RETURN; END IF;
    RAISE EXCEPTION 'MED_CUTOVER_PATCH_MISMATCH: Revise a implementação atual da virada antes de alterar.';
  END IF;
  EXECUTE replace(v_sql,v_before,v_after);
END;
$patch$;
COMMIT;