BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('test.actor','00000000-0000-0000-0000-000000000011',true),set_config('test.tenant','00000000-0000-0000-0000-000000000001',true);
DO $$
DECLARE s uuid:='00000000-0000-0000-0000-000000000001'; other uuid:='00000000-0000-0000-0000-000000000002'; result jsonb;
BEGIN
 result:=public.klasse_lingua_estrangeira_config_v1(s,false);
 IF result IS DISTINCT FROM '{"idioma":null,"outro":null}'::jsonb THEN RAISE EXCEPTION 'invented default'; END IF;
 result:=public.klasse_lingua_estrangeira_config_v1(s,true,'en',null);
 IF result IS DISTINCT FROM '{"idioma":"en","outro":null}'::jsonb THEN RAISE EXCEPTION 'English failed'; END IF;
 result:=public.klasse_lingua_estrangeira_config_v1(s,true,'other',' Alemão ');
 IF result IS DISTINCT FROM '{"idioma":"other","outro":"Alemão"}'::jsonb THEN RAISE EXCEPTION 'custom failed'; END IF;
 result:=public.klasse_lingua_estrangeira_config_v1(s,true,'fr',null);
 IF result IS DISTINCT FROM '{"idioma":"fr","outro":null}'::jsonb THEN RAISE EXCEPTION 'stale custom label'; END IF;
 BEGIN PERFORM public.klasse_lingua_estrangeira_config_v1(s,true,'other',null); RAISE EXCEPTION 'missing custom accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM public.klasse_lingua_estrangeira_config_v1(s,true,'xx',null); RAISE EXCEPTION 'invalid code accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM public.klasse_lingua_estrangeira_config_v1(other,true,'es',null); RAISE EXCEPTION 'tenant write accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('test.tenant',other::text,true);
 BEGIN PERFORM public.klasse_lingua_estrangeira_config_v1(other,false); RAISE EXCEPTION 'forged tenant accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('test.tenant',s::text,true);
 PERFORM set_config('test.actor','00000000-0000-0000-0000-000000000012',true);
 BEGIN PERFORM public.klasse_lingua_estrangeira_config_v1(s,true,'es',null); RAISE EXCEPTION 'teacher write accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('test.actor','00000000-0000-0000-0000-000000000013',true);
 BEGIN PERFORM public.klasse_lingua_estrangeira_config_v1(s,true,'es',null); RAISE EXCEPTION 'deleted actor accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('test.actor','00000000-0000-0000-0000-000000000014',true);
 PERFORM set_config('test.tenant',other::text,true);
 result:=public.klasse_lingua_estrangeira_config_v1(other,true,'es',null);
 IF result IS DISTINCT FROM '{"idioma":"es","outro":null}'::jsonb THEN RAISE EXCEPTION 'new config insert failed'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF (SELECT negativas_para_reprovar FROM public.configuracoes_pedagogicas WHERE escola_id='00000000-0000-0000-0000-000000000001')<>7 OR
 (SELECT idioma_lingua_estrangeira FROM public.configuracoes_pedagogicas WHERE escola_id='00000000-0000-0000-0000-000000000001')<>'fr' OR
 (SELECT count(*) FROM public.configuracoes_pedagogicas)<>2 OR (SELECT count(*) FROM public.audit_logs)<>4
 THEN RAISE EXCEPTION 'unexpected config/audit effects'; END IF;
 IF has_table_privilege('anon','public.configuracoes_pedagogicas','TRUNCATE') OR
    has_table_privilege('authenticated','public.configuracoes_pedagogicas','TRUNCATE') THEN
   RAISE EXCEPTION 'RLS cannot protect TRUNCATE';
 END IF;
 IF NOT has_table_privilege('authenticated','public.configuracoes_pedagogicas','SELECT') THEN RAISE EXCEPTION 'existing tenant read revoked'; END IF;
 IF has_function_privilege('anon','public.klasse_lingua_estrangeira_config_v1(uuid,boolean,text,text)','EXECUTE') THEN RAISE EXCEPTION 'anon grant'; END IF;
END $$;
ROLLBACK;
