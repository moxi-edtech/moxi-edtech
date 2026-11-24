BEGIN;
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF has_table_privilege(r,'public.fiscal_provider_connections','SELECT,INSERT,UPDATE,DELETE')
       OR has_table_privilege(r,'public.fiscal_operations','SELECT,INSERT,UPDATE,DELETE')
       OR has_function_privilege(r,'public.fiscal_provider_enqueue_sandbox(uuid,uuid,text,uuid,text,text,jsonb)','EXECUTE') THEN
      RAISE EXCEPTION 'client privileges leaked: %',r;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_class WHERE oid IN ('public.fiscal_provider_connections'::regclass,'public.fiscal_operations'::regclass) AND NOT relrowsecurity) THEN
    RAISE EXCEPTION 'RLS missing';
  END IF;
  IF has_table_privilege('service_role','public.fiscal_operations','UPDATE,DELETE,TRUNCATE') THEN
    RAISE EXCEPTION 'outbox mutable';
  END IF;
END $$;
SET LOCAL ROLE service_role;
DO $$
DECLARE
  a uuid := '00000000-0000-4000-8000-000000000001';
  b uuid := '00000000-0000-4000-8000-000000000002';
  c uuid;
  d uuid;
  s uuid := gen_random_uuid();
  op uuid;
  replay uuid;
BEGIN
  INSERT INTO public.fiscal_provider_connections(empresa_id,provider_code,environment,status)
    VALUES(a,'mock','sandbox','active') RETURNING id INTO c;
  INSERT INTO public.fiscal_provider_connections(empresa_id,provider_code,environment,status)
    VALUES(b,'mock','sandbox','active') RETURNING id INTO d;
  BEGIN
    INSERT INTO public.fiscal_provider_connections(empresa_id,provider_code,environment,status) VALUES(a,'mock','sandbox','active');
    RAISE EXCEPTION 'duplicate active connection accepted';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.fiscal_provider_connections(empresa_id,provider_code,environment,status) VALUES(a,'ulemo','production','active');
    RAISE EXCEPTION 'production activation accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.fiscal_provider_connections(empresa_id,provider_code,environment,status) VALUES(a,'vero','sandbox','active');
    RAISE EXCEPTION 'external activation accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  op := public.fiscal_provider_enqueue_sandbox(a,c,'payment',s,'FR','key-1','{"expectedTotal":"100.00"}');
  replay := public.fiscal_provider_enqueue_sandbox(a,c,'payment',s,'FR','key-1','{"expectedTotal":"100.00"}');
  IF op IS NULL OR op IS DISTINCT FROM replay THEN RAISE EXCEPTION 'replay mismatch'; END IF;
  BEGIN
    PERFORM public.fiscal_provider_enqueue_sandbox(a,c,'payment',s,'FR','key-1','{"expectedTotal":"200.00"}');
    RAISE EXCEPTION 'changed snapshot accepted';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  BEGIN
    PERFORM public.fiscal_provider_enqueue_sandbox(a,c,'payment',s,'FR','key-2','{}');
    RAISE EXCEPTION 'duplicate business source accepted';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  BEGIN
    PERFORM public.fiscal_provider_enqueue_sandbox(a,d,'payment',gen_random_uuid(),'FR','cross-tenant','{}');
    RAISE EXCEPTION 'cross tenant accepted';
  EXCEPTION WHEN check_violation OR foreign_key_violation THEN NULL; END;
  IF public.fiscal_provider_enqueue_sandbox(b,d,'payment',s,'FR','key-1','{}') = op THEN
    RAISE EXCEPTION 'tenant identity not isolated';
  END IF;
  UPDATE public.fiscal_provider_connections SET status='disabled' WHERE id=c;
  IF public.fiscal_provider_enqueue_sandbox(a,c,'payment',s,'FR','key-1','{"expectedTotal":"100.00"}') IS DISTINCT FROM op THEN
    RAISE EXCEPTION 'historical replay lost';
  END IF;
  BEGIN
    PERFORM public.fiscal_provider_enqueue_sandbox(a,c,'payment',gen_random_uuid(),'FR','disabled','{}');
    RAISE EXCEPTION 'disabled connection accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE public.fiscal_operations SET request_payload='{}' WHERE id=op;
    RAISE EXCEPTION 'outbox update accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  INSERT INTO public.fiscal_provider_connections(empresa_id,provider_code,environment,status)
    VALUES(a,'mock','sandbox','active') RETURNING id INTO c;
  BEGIN
    PERFORM public.fiscal_provider_enqueue_sandbox(a,c,'payment',s,'FR','different-connection','{}');
    RAISE EXCEPTION 'switching connection duplicated source';
  EXCEPTION WHEN unique_violation THEN NULL; END;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM 1 FROM public.fiscal_operations;
    RAISE EXCEPTION 'authenticated read accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
ROLLBACK;
