\set ON_ERROR_STOP on
-- Reuse the BILL-023 isolated schema, not a Supabase connection.
ALTER TABLE public.fiscal_series ADD COLUMN agt_submission_uuid uuid, ADD COLUMN agt_provisioned_at timestamptz, ADD COLUMN establishment_number text, ADD COLUMN series_year integer, ADD COLUMN authorized_quantity bigint;
\ir ../fiscal/bill045-numbering-core.sql
INSERT INTO public.fiscal_series(id,empresa_id,tipo_documento,prefixo,ultimo_numero,agt_status,agt_series_code,first_document_no,last_document_no,agt_submission_uuid,agt_provisioned_at,establishment_number,series_year,authorized_quantity,series_contingency_indicator) VALUES
('00000000-0000-0000-0000-000000000041','00000000-0000-0000-0000-000000000100','FT','FT',99,'provisioned','TESTFT','100','102','00000000-0000-0000-0000-000000000141',now(),'1',2026,3,'N'),
('00000000-0000-0000-0000-000000000042','00000000-0000-0000-0000-000000000100','RC','RC',499,'provisioned','TESTRC','500','501','00000000-0000-0000-0000-000000000142',now(),'1',2026,2,'N'),
('00000000-0000-0000-0000-000000000043','00000000-0000-0000-0000-000000000100','FT','FT',99,'provisioned','INVALID','100','102',NULL,now(),'1',2026,3,'N'),
('00000000-0000-0000-0000-000000000044','00000000-0000-0000-0000-000000000100','FT','FT',0,'legacy',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),
('00000000-0000-0000-0000-000000000045','00000000-0000-0000-0000-000000000100','PP','PP',999999,'legacy',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),
('00000000-0000-0000-0000-000000000046','00000000-0000-0000-0000-000000000100','RC','RC',99,'provisioned','BADQTY','100','102','00000000-0000-0000-0000-000000000146',now(),'1',2026,2,'N'),
('00000000-0000-0000-0000-000000000047','00000000-0000-0000-0000-000000000100','FT','FT',999,'provisioned','CONCURRENT','1000','1031','00000000-0000-0000-0000-000000000147',now(),'1',2026,32,'N');
-- two fixture wrappers represent validated user and worker contexts, not actual production auth.
CREATE FUNCTION public.fixture_invoice(p_serie uuid,p_company uuid,p_date date) RETURNS TABLE(numero bigint,numero_formatado text) LANGUAGE sql AS $$
 SELECT * FROM fiscal_private.reserve_number(p_serie,p_company,'FT',p_date)
$$;
CREATE FUNCTION public.fixture_receipt(p_serie uuid,p_company uuid,p_date date) RETURNS TABLE(numero bigint,numero_formatado text) LANGUAGE sql AS $$
 SELECT * FROM fiscal_private.reserve_number(p_serie,p_company,'RC',p_date)
$$;
REVOKE ALL ON FUNCTION public.fixture_invoice(uuid,uuid,date),public.fixture_receipt(uuid,uuid,date) FROM PUBLIC,anon,authenticated,service_role;
DO $$ DECLARE n bigint; f text; BEGIN
 SELECT * INTO n,f FROM public.fixture_invoice('00000000-0000-0000-0000-000000000041','00000000-0000-0000-0000-000000000100','2026-11-24');
 IF n<>100 OR f<>'FT TESTFT/100' THEN RAISE EXCEPTION 'FT contract'; END IF;
 SELECT * INTO n,f FROM public.fixture_receipt('00000000-0000-0000-0000-000000000042','00000000-0000-0000-0000-000000000100','2026-11-24');
 IF n<>500 OR f<>'RC TESTRC/500' THEN RAISE EXCEPTION 'RC contract'; END IF;
 SELECT * INTO n,f FROM fiscal_private.reserve_number('00000000-0000-0000-0000-000000000045','00000000-0000-0000-0000-000000000100','PP','2026-11-24');
 IF n<>1000000 OR f<>'PP-1000000' THEN RAISE EXCEPTION 'PP formatting'; END IF;
END $$;
SELECT public.assert_failure($q$SELECT * FROM fiscal_private.reserve_number('00000000-0000-0000-0000-000000000041','00000000-0000-0000-0000-000000000999','FT','2026-11-24')$q$,'P0001','TENANT:');
SELECT public.assert_failure($q$SELECT * FROM fiscal_private.reserve_number('00000000-0000-0000-0000-000000000041','00000000-0000-0000-0000-000000000100','RC','2026-11-24')$q$,'P0001','TENANT:');
SELECT public.assert_failure($q$SELECT * FROM fiscal_private.reserve_number('00000000-0000-0000-0000-000000000041','00000000-0000-0000-0000-000000000100','FT','2027-01-01')$q$,'P0001','STATE:');
SELECT public.assert_failure($q$SELECT * FROM fiscal_private.reserve_number('00000000-0000-0000-0000-000000000043','00000000-0000-0000-0000-000000000100','FT','2026-11-24')$q$,'P0001','STATE:');
SELECT public.assert_failure($q$SELECT * FROM fiscal_private.reserve_number('00000000-0000-0000-0000-000000000044','00000000-0000-0000-0000-000000000100','FT','2026-11-24')$q$,'P0001','STATE:');
SELECT public.assert_failure($q$SELECT * FROM fiscal_private.reserve_number('00000000-0000-0000-0000-000000000046','00000000-0000-0000-0000-000000000100','RC','2026-11-24')$q$,'P0001','STATE:');
BEGIN;
SELECT * FROM public.fixture_receipt('00000000-0000-0000-0000-000000000042','00000000-0000-0000-0000-000000000100','2026-11-24');
ROLLBACK;
DO $$ DECLARE n bigint; BEGIN SELECT numero INTO n FROM public.fixture_receipt('00000000-0000-0000-0000-000000000042','00000000-0000-0000-0000-000000000100','2026-11-24'); IF n<>501 THEN RAISE EXCEPTION 'RC rollback gap'; END IF; END $$;
SELECT public.assert_failure($q$SELECT * FROM public.fixture_receipt('00000000-0000-0000-0000-000000000042','00000000-0000-0000-0000-000000000100','2026-11-24')$q$,'P0001','STATE: authorized interval exhausted');
SET ROLE anon;
SELECT public.assert_failure($q$SELECT * FROM fiscal_private.reserve_number('00000000-0000-0000-0000-000000000041','00000000-0000-0000-0000-000000000100','FT','2026-11-24')$q$,'42501');
SELECT public.assert_failure($q$SELECT * FROM public.fiscal_reservar_numero_serie('00000000-0000-0000-0000-000000000041')$q$,'42501');
RESET ROLE;
SET ROLE authenticated;
SELECT public.assert_failure($q$SELECT * FROM fiscal_private.reserve_number('00000000-0000-0000-0000-000000000041','00000000-0000-0000-0000-000000000100','FT','2026-11-24')$q$,'42501');
SELECT public.assert_failure($q$SELECT * FROM public.fiscal_reservar_numero_serie('00000000-0000-0000-0000-000000000041')$q$,'42501');
RESET ROLE;
SET ROLE service_role;
SELECT public.assert_failure($q$SELECT * FROM fiscal_private.reserve_number('00000000-0000-0000-0000-000000000041','00000000-0000-0000-0000-000000000100','FT','2026-11-24')$q$,'42501');
SELECT public.assert_failure($q$SELECT * FROM public.fiscal_reservar_numero_serie('00000000-0000-0000-0000-000000000041')$q$,'42501');
RESET ROLE;
