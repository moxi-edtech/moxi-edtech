-- Run only after both migrations in an isolated PostgreSQL 17 environment.
BEGIN;
DO $$
DECLARE t text; f text;
BEGIN
 FOREACH t IN ARRAY ARRAY['fecho_caixa','secretaria_expedientes','secretaria_expediente_operacoes','secretaria_expediente_config','secretaria_expediente_reminders'] LOOP
   IF has_table_privilege('authenticated','public.'||t,'INSERT') OR has_table_privilege('authenticated','public.'||t,'UPDATE') OR has_table_privilege('authenticated','public.'||t,'DELETE') OR has_table_privilege('authenticated','public.'||t,'TRUNCATE') THEN
     RAISE EXCEPTION 'DIRECT_WRITE_ALLOWED: %',t;
   END IF;
   IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=('public.'||t)::regclass) THEN RAISE EXCEPTION 'RLS_DISABLED: %',t; END IF;
 END LOOP;
 FOREACH f IN ARRAY ARRAY['financeiro_fecho_declarar_e_snapshot(uuid,date,numeric,numeric,numeric,numeric)','financeiro_fecho_aprovar(uuid,uuid,text,text,jsonb)','declarar_fecho_caixa(uuid,numeric,numeric,numeric)','aprovar_fecho_caixa(uuid)','secretaria_fechar_expediente(uuid,date)','secretaria_configurar_expediente(uuid,time,integer,integer[],boolean)'] LOOP
   IF has_function_privilege('anon','public.'||f,'EXECUTE') OR NOT has_function_privilege('authenticated','public.'||f,'EXECUTE') THEN RAISE EXCEPTION 'WRONG_RPC_GRANT: %',f; END IF;
 END LOOP;
 IF has_function_privilege('authenticated','public.secretaria_enviar_lembretes_expediente()','EXECUTE') THEN RAISE EXCEPTION 'REMINDER_RPC_PUBLIC'; END IF;
 IF has_function_privilege('authenticated','public.capture_secretaria_expediente_operation()','EXECUTE') THEN RAISE EXCEPTION 'TRIGGER_RPC_PUBLIC'; END IF;
END $$;
-- Unauthenticated calls must be rejected before touching any school or data.
SET LOCAL ROLE authenticated;
DO $$
BEGIN
 BEGIN
   PERFORM public.secretaria_fechar_expediente('00000000-0000-0000-0000-000000000000',current_date);
   RAISE EXCEPTION 'UNAUTHENTICATED_CLOSE_ACCEPTED';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
   PERFORM public.financeiro_fecho_declarar_e_snapshot('00000000-0000-0000-0000-000000000000',current_date,0,0,0,0);
   RAISE EXCEPTION 'UNAUTHENTICATED_CASH_ACCEPTED';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
   PERFORM public.financeiro_fecho_aprovar('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-000000000000','approved');
   RAISE EXCEPTION 'UNAUTHENTICATED_APPROVAL_ACCEPTED';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
ROLLBACK;
