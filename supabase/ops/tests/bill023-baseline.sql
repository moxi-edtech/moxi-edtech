\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() <> 'bill023_fixture' OR to_regclass('public.fiscal_series') IS NOT NULL THEN RAISE EXCEPTION 'DISPOSABLE_FIXTURE_ONLY'; END IF; END $$;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE TABLE public.fiscal_documentos(id uuid PRIMARY KEY,empresa_id uuid NOT NULL,status text NOT NULL,serie_id uuid,numero bigint,numero_formatado text, UNIQUE(serie_id,numero), UNIQUE(empresa_id,numero_formatado));
CREATE TABLE public.fiscal_documento_itens(id integer PRIMARY KEY,documento_id uuid NOT NULL REFERENCES public.fiscal_documentos(id),empresa_id uuid NOT NULL,linha_no integer NOT NULL, valor numeric NOT NULL,UNIQUE(documento_id,linha_no));
CREATE TABLE public.fiscal_documentos_eventos(id integer PRIMARY KEY,documento_id uuid NOT NULL REFERENCES public.fiscal_documentos(id),empresa_id uuid NOT NULL,payload jsonb NOT NULL);
CREATE TABLE public.fiscal_series(id uuid PRIMARY KEY,empresa_id uuid NOT NULL,tipo_documento text NOT NULL,prefixo text NOT NULL,origem_documento text NOT NULL DEFAULT 'interno',ultimo_numero bigint NOT NULL CHECK(ultimo_numero>=0),ativa boolean NOT NULL DEFAULT true,descontinuada_em timestamptz,agt_status text NOT NULL DEFAULT 'legacy',agt_series_code text,first_document_no text,last_document_no text,updated_at timestamptz DEFAULT now(),series_contingency_indicator text,contingency_state text,contingency_state_changed_at timestamptz,contingency_closed_at timestamptz);
ALTER TABLE public.fiscal_documento_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_documentos_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_series ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.fiscal_documento_itens,public.fiscal_documentos_eventos,public.fiscal_series TO authenticated,service_role;
GRANT INSERT ON public.fiscal_series TO service_role;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON public.fiscal_documento_itens,public.fiscal_documentos_eventos FROM PUBLIC,anon,authenticated,service_role;
REVOKE UPDATE,DELETE,TRUNCATE ON public.fiscal_series FROM PUBLIC,anon,authenticated,service_role;
-- Synthetic authorization stubs only; never use them as real authorization.
CREATE FUNCTION public.safe_auth_uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('fixture.user',true),'')::uuid $$;
CREATE FUNCTION public.user_has_role_in_empresa(uuid,text[]) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT $1 = nullif(current_setting('fixture.empresa',true),'')::uuid AND 'operator'=ANY($2) $$;
CREATE OR REPLACE FUNCTION public.fiscal_block_event_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  RAISE EXCEPTION 'IMMUTABILITY: evento fiscal é append-only';
END;
$function$;
CREATE OR REPLACE FUNCTION public.fiscal_block_item_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  RAISE EXCEPTION 'IMMUTABILITY: item de documento fiscal é append-only';
END;
$function$;
CREATE OR REPLACE FUNCTION public.fiscal_guard_contingency_series()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_last bigint;
BEGIN
  IF NEW.series_contingency_indicator='C' THEN
    IF NEW.origem_documento IS DISTINCT FROM 'contingencia' THEN
      RAISE EXCEPTION 'STATE: série C deve usar origem_documento=contingencia';
    END IF;

    IF NEW.agt_status='provisioned' AND NEW.contingency_state IS NULL THEN
      NEW.contingency_state := 'ready';
      NEW.contingency_state_changed_at := now();
    END IF;

    IF TG_OP='UPDATE'
       AND NEW.ultimo_numero IS DISTINCT FROM OLD.ultimo_numero THEN
      IF OLD.contingency_state IS DISTINCT FROM 'active' THEN
        RAISE EXCEPTION 'STATE: série de contingência precisa estar active antes de reservar número';
      END IF;

      IF NEW.last_document_no IS NOT NULL THEN
        BEGIN
          v_last := NEW.last_document_no::bigint;
        EXCEPTION WHEN invalid_text_representation THEN
          RAISE EXCEPTION 'STATE: last_document_no da série de contingência não é numérico';
        END;

        IF NEW.ultimo_numero >= v_last THEN
          NEW.contingency_state := 'exhausted';
          NEW.contingency_state_changed_at := now();
          NEW.contingency_closed_at := now();
          NEW.ativa := false;
        END IF;
      END IF;
    END IF;
  ELSE
    IF NEW.origem_documento='contingencia' THEN
      RAISE EXCEPTION 'STATE: origem_documento=contingencia exige seriesContingencyIndicator=C';
    END IF;
    IF NEW.contingency_state IS NOT NULL THEN
      RAISE EXCEPTION 'STATE: série normal não pode transportar contingency_state';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.fiscal_guard_series_counter()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF NEW.ultimo_numero IS DISTINCT FROM OLD.ultimo_numero
     AND current_user <> 'postgres' THEN
    RAISE EXCEPTION 'IMMUTABILITY: contador fiscal só pode avançar pela RPC fiscal_reservar_numero_serie';
  END IF;
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.fiscal_reservar_numero_serie(p_serie_id uuid)
 RETURNS TABLE(numero bigint, numero_formatado text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_uid uuid := public.safe_auth_uid();
  v_serie public.fiscal_series%ROWTYPE;
  v_last_authorized bigint;
  v_is_fe boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH: utilizador não autenticado';
  END IF;

  SELECT *
  INTO v_serie
  FROM public.fiscal_series
  WHERE id=p_serie_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DATA: série não encontrada';
  END IF;

  IF NOT public.user_has_role_in_empresa(
    v_serie.empresa_id,
    ARRAY['owner','admin','operator']
  ) THEN
    RAISE EXCEPTION 'AUTH: permissão negada para reservar número da série';
  END IF;

  IF NOT v_serie.ativa OR v_serie.descontinuada_em IS NOT NULL THEN
    RAISE EXCEPTION 'STATE: série inativa ou descontinuada';
  END IF;

  v_is_fe := v_serie.tipo_documento IN ('FT','FR','FG','GF','NC','ND','RC','RE');

  IF v_is_fe THEN
    IF v_serie.agt_status IS DISTINCT FROM 'provisioned'
       OR v_serie.last_document_no IS NULL
       OR nullif(btrim(coalesce(v_serie.agt_series_code,'')),'') IS NULL THEN
      RAISE EXCEPTION 'STATE: série FE ainda não foi provisionada pela AGT';
    END IF;

    BEGIN
      v_last_authorized := v_serie.last_document_no::bigint;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'STATE: last_document_no AGT não é numérico';
    END;

    IF v_serie.ultimo_numero >= v_last_authorized THEN
      RAISE EXCEPTION 'STATE: intervalo autorizado pela AGT esgotado';
    END IF;
  ELSIF v_serie.tipo_documento IN ('PP','GR','GT') THEN
    IF v_serie.agt_status IS DISTINCT FROM 'legacy' THEN
      RAISE EXCEPTION 'STATE: série local PP/GR/GT inválida';
    END IF;
  ELSE
    RAISE EXCEPTION
      'STATE: tipo de documento % não possui política de numeração definida',
      v_serie.tipo_documento;
  END IF;

  UPDATE public.fiscal_series
  SET ultimo_numero=ultimo_numero+1,
      updated_at=now()
  WHERE id=p_serie_id
  RETURNING ultimo_numero INTO numero;

  numero_formatado := CASE
    WHEN v_is_fe
      THEN upper(trim(v_serie.tipo_documento)) || ' ' ||
           trim(v_serie.agt_series_code) || '/' || numero::text
    ELSE v_serie.prefixo || '-' || lpad(numero::text,6,'0')
  END;

  RETURN NEXT;
END;
$function$;
CREATE OR REPLACE FUNCTION public.fiscal_validate_event_consistency()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_documento_empresa_id uuid;
BEGIN
  SELECT empresa_id
    INTO v_documento_empresa_id
  FROM public.fiscal_documentos
  WHERE id = NEW.documento_id;

  IF v_documento_empresa_id IS NULL THEN
    RAISE EXCEPTION 'DATA: documento fiscal inválido';
  END IF;

  IF v_documento_empresa_id IS DISTINCT FROM NEW.empresa_id THEN
    RAISE EXCEPTION 'TENANT: empresa do evento divergente da empresa do documento';
  END IF;

  RETURN NEW;
END;
$function$;
CREATE TRIGGER items_immutable BEFORE UPDATE OR DELETE ON public.fiscal_documento_itens FOR EACH ROW EXECUTE FUNCTION public.fiscal_block_item_mutation();
CREATE TRIGGER events_immutable BEFORE UPDATE OR DELETE ON public.fiscal_documentos_eventos FOR EACH ROW EXECUTE FUNCTION public.fiscal_block_event_mutation();
CREATE TRIGGER events_consistency BEFORE INSERT OR UPDATE ON public.fiscal_documentos_eventos FOR EACH ROW EXECUTE FUNCTION public.fiscal_validate_event_consistency();
CREATE TRIGGER series_counter BEFORE UPDATE OF ultimo_numero ON public.fiscal_series FOR EACH ROW EXECUTE FUNCTION public.fiscal_guard_series_counter();
CREATE TRIGGER series_contingency BEFORE INSERT OR UPDATE ON public.fiscal_series FOR EACH ROW EXECUTE FUNCTION public.fiscal_guard_contingency_series();
REVOKE ALL ON FUNCTION public.fiscal_reservar_numero_serie(uuid) FROM PUBLIC,anon,authenticated,service_role;
DO $$ BEGIN
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.fiscal_block_event_mutation()'::regprocedure) IS DISTINCT FROM 'f2e68de74d1be1f6c5123211755310d9' THEN RAISE EXCEPTION 'BASELINE_BODY_DRIFT:fiscal_block_event_mutation'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.fiscal_block_item_mutation()'::regprocedure) IS DISTINCT FROM '1db41c02a8fd2dffabe0467c916ce0ed' THEN RAISE EXCEPTION 'BASELINE_BODY_DRIFT:fiscal_block_item_mutation'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.fiscal_guard_contingency_series()'::regprocedure) IS DISTINCT FROM 'dd79b2f333944d400ca838c90698566b' THEN RAISE EXCEPTION 'BASELINE_BODY_DRIFT:fiscal_guard_contingency_series'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.fiscal_guard_series_counter()'::regprocedure) IS DISTINCT FROM 'bf47be489ef4193acd278e6cc591965d' THEN RAISE EXCEPTION 'BASELINE_BODY_DRIFT:fiscal_guard_series_counter'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.fiscal_reservar_numero_serie(uuid)'::regprocedure) IS DISTINCT FROM 'e367ea874dd8b84b6152e58923eb8a5e' THEN RAISE EXCEPTION 'BASELINE_BODY_DRIFT:fiscal_reservar_numero_serie'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.fiscal_validate_event_consistency()'::regprocedure) IS DISTINCT FROM 'eff1f03f977aab036deb607748e875b4' THEN RAISE EXCEPTION 'BASELINE_BODY_DRIFT:fiscal_validate_event_consistency'; END IF;
END $$;
CREATE FUNCTION public.assert_failure(q text,expected_state text,expected_prefix text DEFAULT '') RETURNS void LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
 BEGIN EXECUTE q;
 EXCEPTION WHEN OTHERS THEN
  IF SQLSTATE=expected_state AND left(SQLERRM,length(expected_prefix))=expected_prefix THEN RETURN; END IF;
  RAISE;
 END;
 RAISE EXCEPTION 'EXPECTED_DENIAL: %',q;
END;
$$;
GRANT EXECUTE ON FUNCTION public.assert_failure(text,text,text) TO anon,authenticated,service_role;
INSERT INTO public.fiscal_documentos(id,empresa_id,status) VALUES('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000100','pendente_assinatura'),('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000100','emitido');
INSERT INTO public.fiscal_documento_itens VALUES(1,'00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000100',1,100);
INSERT INTO public.fiscal_documentos_eventos VALUES(1,'00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000100','{}');
SELECT public.assert_failure('UPDATE public.fiscal_documento_itens SET valor=1 WHERE id=1','P0001','IMMUTABILITY:');
SELECT public.assert_failure('DELETE FROM public.fiscal_documento_itens WHERE id=1','P0001','IMMUTABILITY:');
SELECT public.assert_failure('UPDATE public.fiscal_documentos_eventos SET payload=''{}'' WHERE id=1','P0001','IMMUTABILITY:');
SELECT public.assert_failure('DELETE FROM public.fiscal_documentos_eventos WHERE id=1','P0001','IMMUTABILITY:');
SELECT public.assert_failure($q$INSERT INTO public.fiscal_documentos_eventos VALUES(2,'00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000999','{}')$q$,'P0001','TENANT:');
SET ROLE anon;
SELECT public.assert_failure('INSERT INTO public.fiscal_documento_itens(id) VALUES(9)','42501');
SELECT public.assert_failure('UPDATE public.fiscal_documento_itens SET id=9 WHERE id=1','42501');
SELECT public.assert_failure('DELETE FROM public.fiscal_documento_itens WHERE id=1','42501');
SELECT public.assert_failure('TRUNCATE public.fiscal_documento_itens','42501');
SELECT public.assert_failure('INSERT INTO public.fiscal_documentos_eventos(id) VALUES(9)','42501');
SELECT public.assert_failure('UPDATE public.fiscal_documentos_eventos SET id=9 WHERE id=1','42501');
SELECT public.assert_failure('DELETE FROM public.fiscal_documentos_eventos WHERE id=1','42501');
SELECT public.assert_failure('TRUNCATE public.fiscal_documentos_eventos','42501');
SELECT public.assert_failure('UPDATE public.fiscal_series SET ultimo_numero=99','42501');
SELECT public.assert_failure('DELETE FROM public.fiscal_series','42501');
SELECT public.assert_failure('TRUNCATE public.fiscal_series','42501');
SELECT public.assert_failure($q$SELECT * FROM public.fiscal_reservar_numero_serie('00000000-0000-0000-0000-000000000010')$q$,'42501');
RESET ROLE;
SET ROLE authenticated;
SELECT public.assert_failure('INSERT INTO public.fiscal_documento_itens(id) VALUES(9)','42501');
SELECT public.assert_failure('UPDATE public.fiscal_documento_itens SET id=9 WHERE id=1','42501');
SELECT public.assert_failure('DELETE FROM public.fiscal_documento_itens WHERE id=1','42501');
SELECT public.assert_failure('TRUNCATE public.fiscal_documento_itens','42501');
SELECT public.assert_failure('INSERT INTO public.fiscal_documentos_eventos(id) VALUES(9)','42501');
SELECT public.assert_failure('UPDATE public.fiscal_documentos_eventos SET id=9 WHERE id=1','42501');
SELECT public.assert_failure('DELETE FROM public.fiscal_documentos_eventos WHERE id=1','42501');
SELECT public.assert_failure('TRUNCATE public.fiscal_documentos_eventos','42501');
SELECT public.assert_failure('UPDATE public.fiscal_series SET ultimo_numero=99','42501');
SELECT public.assert_failure('DELETE FROM public.fiscal_series','42501');
SELECT public.assert_failure('TRUNCATE public.fiscal_series','42501');
SELECT public.assert_failure($q$SELECT * FROM public.fiscal_reservar_numero_serie('00000000-0000-0000-0000-000000000010')$q$,'42501');
RESET ROLE;
SET ROLE service_role;
SELECT public.assert_failure('INSERT INTO public.fiscal_documento_itens(id) VALUES(9)','42501');
SELECT public.assert_failure('UPDATE public.fiscal_documento_itens SET id=9 WHERE id=1','42501');
SELECT public.assert_failure('DELETE FROM public.fiscal_documento_itens WHERE id=1','42501');
SELECT public.assert_failure('TRUNCATE public.fiscal_documento_itens','42501');
SELECT public.assert_failure('INSERT INTO public.fiscal_documentos_eventos(id) VALUES(9)','42501');
SELECT public.assert_failure('UPDATE public.fiscal_documentos_eventos SET id=9 WHERE id=1','42501');
SELECT public.assert_failure('DELETE FROM public.fiscal_documentos_eventos WHERE id=1','42501');
SELECT public.assert_failure('TRUNCATE public.fiscal_documentos_eventos','42501');
SELECT public.assert_failure('UPDATE public.fiscal_series SET ultimo_numero=99','42501');
SELECT public.assert_failure('DELETE FROM public.fiscal_series','42501');
SELECT public.assert_failure('TRUNCATE public.fiscal_series','42501');
SELECT public.assert_failure($q$SELECT * FROM public.fiscal_reservar_numero_serie('00000000-0000-0000-0000-000000000010')$q$,'42501');
RESET ROLE;
-- Baseline defect reproduction uses synthetic rows only.
SELECT set_config('fixture.user','00000000-0000-0000-0000-000000000101',false);
SELECT set_config('fixture.empresa','00000000-0000-0000-0000-000000000100',false);
INSERT INTO public.fiscal_series(id,empresa_id,tipo_documento,prefixo,ultimo_numero,agt_status,agt_series_code,first_document_no,last_document_no) VALUES
('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000100','FT','FT',0,'provisioned','TEST','100','102'),
('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000100','PP','PP',999999,'legacy',NULL,NULL,NULL);
BEGIN;
DO $$ DECLARE n bigint; f text; BEGIN
 SELECT numero INTO n FROM public.fiscal_reservar_numero_serie('00000000-0000-0000-0000-000000000010');
 IF n<>1 THEN RAISE EXCEPTION 'Expected baseline lower-bound defect'; END IF;
 SELECT numero_formatado INTO f FROM public.fiscal_reservar_numero_serie('00000000-0000-0000-0000-000000000011');
 IF f<>'PP-100000' THEN RAISE EXCEPTION 'Expected baseline formatting defect'; END IF;
END $$;
ROLLBACK;
