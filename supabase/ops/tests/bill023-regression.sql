\set ON_ERROR_STOP on
SELECT set_config('fixture.user','00000000-0000-0000-0000-000000000101',false);
SELECT set_config('fixture.empresa','00000000-0000-0000-0000-000000000100',false);
SELECT public.assert_failure($q$SELECT * FROM public.fiscal_reservar_numero_serie('00000000-0000-0000-0000-000000000010')$q$,'P0001','STATE: contador fora');
SELECT public.assert_failure($q$UPDATE public.fiscal_series SET ultimo_numero=99 WHERE id='00000000-0000-0000-0000-000000000010'$q$,'P0001','IMMUTABILITY:');
SELECT public.assert_failure($q$UPDATE public.fiscal_series SET ultimo_numero=999998 WHERE id='00000000-0000-0000-0000-000000000011'$q$,'P0001','IMMUTABILITY:');
DO $$ DECLARE f text; BEGIN
 SELECT numero_formatado INTO f FROM public.fiscal_reservar_numero_serie('00000000-0000-0000-0000-000000000011');
 IF f<>'PP-1000000' THEN RAISE EXCEPTION 'LOCAL_FORMAT'; END IF;
END $$;
SELECT public.assert_failure($q$INSERT INTO public.fiscal_documento_itens VALUES(2,'00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000100',1,10)$q$,'P0001','IMMUTABILITY:');
SELECT public.assert_failure($q$INSERT INTO public.fiscal_documento_itens VALUES(2,'00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000999',2,10)$q$,'P0001','TENANT:');
INSERT INTO public.fiscal_documento_itens VALUES(2,'00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000100',2,10);
SELECT public.assert_failure($q$INSERT INTO public.fiscal_documento_itens VALUES(3,'00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000100',2,10)$q$,'23505');
INSERT INTO public.fiscal_series(id,empresa_id,tipo_documento,prefixo,ultimo_numero,agt_status,agt_series_code,first_document_no,last_document_no,ativa) VALUES
('00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000100','FT','FT',99,'provisioned','TEST2','100','102',true),
('00000000-0000-0000-0000-000000000013','00000000-0000-0000-0000-000000000100','FT','FT',0,'legacy',NULL,NULL,NULL,true),
('00000000-0000-0000-0000-000000000014','00000000-0000-0000-0000-000000000100','FT','FT',99,'provisioned','TEST3','100','102',false),
('00000000-0000-0000-0000-000000000015','00000000-0000-0000-0000-000000000999','FT','FT',99,'provisioned','TEST4','100','102',true),
('00000000-0000-0000-0000-000000000016','00000000-0000-0000-0000-000000000100','FT','FT',0,'provisioned','TEST5','bad','102',true),
('00000000-0000-0000-0000-000000000017','00000000-0000-0000-0000-000000000100','FT','FT',0,'provisioned','TEST6','1','999999999999999999999',true),
('00000000-0000-0000-0000-000000000018','00000000-0000-0000-0000-000000000100','PP','PP',9223372036854775807,'legacy',NULL,NULL,NULL,true),
('00000000-0000-0000-0000-000000000019','00000000-0000-0000-0000-000000000100','FT','FT',999,'provisioned','CONCURRENT','1000','1031',true);
SELECT public.assert_failure($q$SELECT * FROM public.fiscal_reservar_numero_serie('00000000-0000-0000-0000-000000000013')$q$,'P0001','STATE: série FE');
SELECT public.assert_failure($q$SELECT * FROM public.fiscal_reservar_numero_serie('00000000-0000-0000-0000-000000000014')$q$,'P0001','STATE: série inativa');
SELECT public.assert_failure($q$SELECT * FROM public.fiscal_reservar_numero_serie('00000000-0000-0000-0000-000000000015')$q$,'P0001','AUTH:');
SELECT public.assert_failure($q$SELECT * FROM public.fiscal_reservar_numero_serie('00000000-0000-0000-0000-000000000016')$q$,'P0001','STATE: intervalo AGT');
SELECT public.assert_failure($q$SELECT * FROM public.fiscal_reservar_numero_serie('00000000-0000-0000-0000-000000000017')$q$,'P0001','STATE: intervalo AGT');
SELECT public.assert_failure($q$SELECT * FROM public.fiscal_reservar_numero_serie('00000000-0000-0000-0000-000000000018')$q$,'P0001','STATE: contador fiscal esgotado');
BEGIN;
SELECT * FROM public.fiscal_reservar_numero_serie('00000000-0000-0000-0000-000000000012');
ROLLBACK;
DO $$ DECLARE n bigint; BEGIN
 SELECT numero INTO n FROM public.fiscal_reservar_numero_serie('00000000-0000-0000-0000-000000000012');
 IF n<>100 THEN RAISE EXCEPTION 'ROLLBACK_GAP'; END IF;
 SELECT numero INTO n FROM public.fiscal_reservar_numero_serie('00000000-0000-0000-0000-000000000012');
 IF n<>101 THEN RAISE EXCEPTION 'SEQUENCE_GAP'; END IF;
 SELECT numero INTO n FROM public.fiscal_reservar_numero_serie('00000000-0000-0000-0000-000000000012');
 IF n<>102 THEN RAISE EXCEPTION 'SEQUENCE_GAP'; END IF;
END $$;
SELECT public.assert_failure($q$SELECT * FROM public.fiscal_reservar_numero_serie('00000000-0000-0000-0000-000000000012')$q$,'P0001','STATE: intervalo autorizado');
SELECT set_config('fixture.user','',false);
SELECT public.assert_failure($q$SELECT * FROM public.fiscal_reservar_numero_serie('00000000-0000-0000-0000-000000000012')$q$,'P0001','AUTH:');
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles r CROSS JOIN pg_proc p WHERE r.rolname IN ('anon','authenticated','service_role') AND p.oid='public.fiscal_reservar_numero_serie(uuid)'::regprocedure AND has_function_privilege(r.rolname,p.oid,'EXECUTE')) THEN RAISE EXCEPTION 'FREEZE_RPC'; END IF;
END $$;
