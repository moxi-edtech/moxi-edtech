-- Read-only catalog gate. Does not invoke fiscal RPCs or touch fiscal records.
BEGIN READ ONLY;
DO $audit$
DECLARE r text; p text; f record; n int;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='public.fiscal_documentos'::regclass AND relrowsecurity) THEN RAISE EXCEPTION 'BILL001_RLS_DISABLED'; END IF;
 FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  IF pg_has_role(r,(SELECT relowner FROM pg_class WHERE oid='public.fiscal_documentos'::regclass),'USAGE') THEN RAISE EXCEPTION 'BILL001_OWNER_ACCESS: %',r; END IF;
  FOREACH p IN ARRAY ARRAY['INSERT','UPDATE','DELETE','TRUNCATE'] LOOP
   IF has_table_privilege(r,'public.fiscal_documentos',p) OR (p IN ('INSERT','UPDATE') AND has_any_column_privilege(r,'public.fiscal_documentos',p)) THEN
    RAISE EXCEPTION 'BILL001_DIRECT_DML: % %',r,p;
   END IF;
  END LOOP;
 END LOOP;
 SELECT count(*) INTO n FROM pg_trigger WHERE tgrelid='public.fiscal_documentos'::regclass AND NOT tgisinternal AND tgenabled IN ('O','A') AND (tgname,tgfoid::regprocedure::text) IN
 (('trg_fiscal_documentos_no_delete','fiscal_block_document_delete()'),('trg_fiscal_documentos_no_update','fiscal_prevent_update_emitido()'),('trg_fiscal_documentos_require_pending_insert','fiscal_require_pending_on_insert()'));
 IF n<>3 THEN RAISE EXCEPTION 'BILL001_TRIGGER_DRIFT'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.fiscal_block_document_delete()'::regprocedure) IS DISTINCT FROM 'eb50ed3256fdbf0463f0ae7a94dc6e70' OR
 (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.fiscal_prevent_update_emitido()'::regprocedure) IS DISTINCT FROM '45fd67275fed155bfb06a9360958bff1' OR
 (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.fiscal_require_pending_on_insert()'::regprocedure) IS DISTINCT FROM 'c463a7354384711b4d083ff82816d946' THEN
 RAISE EXCEPTION 'BILL001_GUARD_BODY_DRIFT'; END IF;
 IF EXISTS (SELECT 1 FROM public.fiscal_escola_bindings WHERE fiscal_enabled IS DISTINCT FROM false) THEN RAISE EXCEPTION 'FISCAL_FREEZE_BINDING_DRIFT'; END IF;
 FOR f IN SELECT oid,proname FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('fiscal_emitir_documento','fiscal_emitir_recibo_pagamento','fiscal_finalizar_assinatura','fiscal_reservar_numero_serie') LOOP
  FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
   IF has_function_privilege(r,f.oid,'EXECUTE') THEN RAISE EXCEPTION 'FISCAL_FREEZE_RPC_DRIFT: % %',r,f.proname; END IF;
  END LOOP;
 END LOOP;
 IF (SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('fiscal_emitir_documento','fiscal_emitir_recibo_pagamento','fiscal_finalizar_assinatura','fiscal_reservar_numero_serie')) <> 4 THEN RAISE EXCEPTION 'FISCAL_FREEZE_RPC_COUNT_DRIFT'; END IF;
END $audit$;
-- Independent freeze backlog: inspect other exposed lifecycle writers; do not invoke them.
SELECT proname, has_function_privilege('authenticated',oid,'EXECUTE') AS authenticated_execute,
 has_function_privilege('service_role',oid,'EXECUTE') AS service_role_execute
FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('fiscal_anular_documento','fiscal_rectificar_documento','fiscal_preparar_assinatura_saft','fiscal_finalizar_hash_saft') ORDER BY proname;
ROLLBACK;
