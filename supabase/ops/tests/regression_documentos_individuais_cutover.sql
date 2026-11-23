-- Após migrar contrato 20271203003000 num PostgreSQL 17 descartável.
BEGIN;
DO $$
BEGIN
 IF has_function_privilege(
   'authenticated','public.emitir_documento_final_idempotente(uuid,uuid,integer,text,text)','EXECUTE'
 ) THEN RAISE EXCEPTION 'LEGACY_DOCUMENT_BYPASS_STILL_PUBLIC'; END IF;
 IF has_function_privilege(
   'anon','public.emitir_documento_final_idempotente(uuid,uuid,integer,text,text)','EXECUTE'
 ) THEN RAISE EXCEPTION 'ANON_LEGACY_WRAPPER_EXECUTABLE'; END IF;
 IF NOT has_function_privilege(
   'service_role','public.emitir_documento_final_idempotente(uuid,uuid,integer,text,text)','EXECUTE'
 ) THEN RAISE EXCEPTION 'INTERNAL_DOCUMENT_WRAPPER_BROKEN'; END IF;
 IF NOT has_function_privilege(
   'authenticated','public.emitir_documento_final_individual(uuid,uuid,integer,uuid,text,text)','EXECUTE'
 ) THEN RAISE EXCEPTION 'NEW_DOCUMENT_EMISSION_UNAVAILABLE'; END IF;
 IF NOT has_function_privilege(
   'authenticated','public.documento_individual_acesso(uuid,uuid,uuid,text)','EXECUTE'
 ) THEN RAISE EXCEPTION 'NEW_DOCUMENT_ACCESS_UNAVAILABLE'; END IF;
END;
$$;
ROLLBACK;
