-- DISPOSABLE ONLY. Proposed fiscal SQL, NOT a production migration.
DO $$ BEGIN IF current_database() <> 'bill023_fixture' THEN RAISE EXCEPTION 'DISPOSABLE_FIXTURE_ONLY'; END IF; END $$;
BEGIN;
CREATE SCHEMA fiscal_private;
REVOKE ALL ON SCHEMA fiscal_private FROM PUBLIC,anon,authenticated,service_role;

-- Single formatting contract, shared by allocator and document insert guard.
CREATE FUNCTION fiscal_private.format_number(p_tipo text,p_code text,p_prefix text,p_number bigint)
RETURNS text LANGUAGE sql IMMUTABLE STRICT SET search_path TO pg_catalog AS $$
 SELECT CASE WHEN p_tipo IN ('FT','FR','FG','GF','NC','ND','RC','RE')
 THEN p_tipo || ' ' || btrim(p_code) || '/' || p_number::text
 ELSE p_prefix || '-' || lpad(p_number::text,greatest(6,length(p_number::text)),'0') END
$$;
-- The internal function is INVOKER, callable only by the trusted owner.
-- User/worker wrappers MUST authorize their specific tenant before entering.
CREATE FUNCTION fiscal_private.reserve_number(p_serie_id uuid,p_empresa_id uuid,p_tipo text,p_date date)
RETURNS TABLE(numero bigint,numero_formatado text)
LANGUAGE plpgsql SECURITY INVOKER SET search_path TO pg_catalog,public AS $$
DECLARE s public.fiscal_series%ROWTYPE; lo bigint; hi bigint; fe boolean;
BEGIN
 IF current_user <> 'postgres' THEN RAISE EXCEPTION 'AUTH: internal allocator'; END IF;
 IF p_serie_id IS NULL OR p_empresa_id IS NULL OR p_tipo IS NULL OR p_date IS NULL THEN RAISE EXCEPTION 'DATA: incomplete reservation context'; END IF;
 SELECT * INTO s FROM public.fiscal_series WHERE id=p_serie_id FOR UPDATE;
 IF NOT FOUND OR s.empresa_id IS DISTINCT FROM p_empresa_id OR s.tipo_documento IS DISTINCT FROM p_tipo THEN
  RAISE EXCEPTION 'TENANT: incompatible series';
 END IF;
 IF NOT s.ativa OR s.descontinuada_em IS NOT NULL THEN RAISE EXCEPTION 'STATE: inactive series'; END IF;
 fe := p_tipo IN ('FT','FR','FG','GF','NC','ND','RC','RE');
 IF fe THEN
  IF s.agt_status IS DISTINCT FROM 'provisioned'
     OR nullif(btrim(s.agt_series_code),'') IS NULL OR s.agt_submission_uuid IS NULL
     OR s.agt_provisioned_at IS NULL OR nullif(btrim(s.establishment_number),'') IS NULL
     OR s.series_year IS DISTINCT FROM extract(year FROM p_date)::integer
     OR s.series_contingency_indicator IS NULL OR s.series_contingency_indicator NOT IN ('N','C')
     OR (s.origem_documento='contingencia') IS DISTINCT FROM (s.series_contingency_indicator='C')
     OR (s.series_contingency_indicator='C' AND s.contingency_state IS DISTINCT FROM 'active')
     OR s.first_document_no IS NULL OR s.last_document_no IS NULL
     OR s.first_document_no !~ '^[0-9]+$' OR s.last_document_no !~ '^[0-9]+$'
     OR s.authorized_quantity IS NULL OR s.authorized_quantity <= 0 THEN
   RAISE EXCEPTION 'STATE: AGT provisioning evidence incomplete or incompatible';
  END IF;
  BEGIN lo:=s.first_document_no::bigint; hi:=s.last_document_no::bigint;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RAISE EXCEPTION 'STATE: invalid AGT interval'; END;
  IF lo<1 OR hi<lo OR hi::numeric-lo::numeric+1<>s.authorized_quantity::numeric OR s.ultimo_numero<lo-1 THEN
   RAISE EXCEPTION 'STATE: invalid AGT interval or counter';
  END IF;
  IF s.ultimo_numero>=hi THEN RAISE EXCEPTION 'STATE: authorized interval exhausted'; END IF;
 ELSIF p_tipo IN ('PP','GR','GT') THEN
  IF s.agt_status IS DISTINCT FROM 'legacy' OR s.origem_documento='contingencia' OR coalesce(s.series_contingency_indicator,'N')<>'N' THEN
   RAISE EXCEPTION 'STATE: invalid local series';
  END IF;
 ELSE RAISE EXCEPTION 'STATE: unsupported document type';
 END IF;
 IF s.ultimo_numero=9223372036854775807 THEN RAISE EXCEPTION 'STATE: counter exhausted'; END IF;
 UPDATE public.fiscal_series SET ultimo_numero=ultimo_numero+1,updated_at=now() WHERE id=s.id RETURNING ultimo_numero INTO numero;
 numero_formatado:=fiscal_private.format_number(p_tipo,coalesce(s.agt_series_code,''),s.prefixo,numero);
 RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION fiscal_private.reserve_number(uuid,uuid,text,date),fiscal_private.format_number(text,text,text,bigint) FROM PUBLIC,anon,authenticated,service_role;
-- Preserve the single historical public signature, including its user authorization.
CREATE OR REPLACE FUNCTION public.fiscal_reservar_numero_serie(p_serie_id uuid)
RETURNS TABLE(numero bigint,numero_formatado text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,public AS $$
DECLARE s public.fiscal_series%ROWTYPE;
BEGIN
 IF public.safe_auth_uid() IS NULL THEN RAISE EXCEPTION 'AUTH: missing user'; END IF;
 SELECT * INTO s FROM public.fiscal_series WHERE id=p_serie_id;
 IF NOT FOUND OR public.user_has_role_in_empresa(s.empresa_id,ARRAY['owner','admin','operator']) IS DISTINCT FROM true THEN
  RAISE EXCEPTION 'AUTH: series not authorized';
 END IF;
 RETURN QUERY SELECT * FROM fiscal_private.reserve_number(s.id,s.empresa_id,s.tipo_documento,(statement_timestamp() AT TIME ZONE 'Africa/Luanda')::date);
END;
$$;
REVOKE ALL ON FUNCTION public.fiscal_reservar_numero_serie(uuid) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
