-- PROPOSTA PARA FIXTURE, não migration. Never execute on production.
DO $$ BEGIN IF current_database() <> 'bill023_fixture' THEN RAISE EXCEPTION 'DISPOSABLE_FIXTURE_ONLY'; END IF; END $$;
CREATE OR REPLACE FUNCTION public.fiscal_reservar_numero_serie(p_serie_id uuid)
 RETURNS TABLE(numero bigint, numero_formatado text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_uid uuid := public.safe_auth_uid();
  v_serie public.fiscal_series%ROWTYPE;
  v_first_authorized bigint;
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
       OR v_serie.first_document_no IS NULL
       OR v_serie.last_document_no IS NULL
       OR nullif(btrim(coalesce(v_serie.agt_series_code,'')),'') IS NULL THEN
      RAISE EXCEPTION 'STATE: série FE ainda não foi provisionada pela AGT';
    END IF;

    BEGIN
      v_first_authorized := v_serie.first_document_no::bigint;
      v_last_authorized := v_serie.last_document_no::bigint;
    EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      RAISE EXCEPTION 'STATE: intervalo AGT inválido';
    END;

    IF v_first_authorized < 1 OR v_last_authorized < v_first_authorized
       OR v_serie.ultimo_numero < v_first_authorized - 1 THEN
      RAISE EXCEPTION 'STATE: contador fora do intervalo autorizado pela AGT';
    END IF;

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

  IF v_serie.ultimo_numero = 9223372036854775807 THEN
    RAISE EXCEPTION 'STATE: contador fiscal esgotado';
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
    ELSE v_serie.prefixo || '-' || lpad(numero::text,greatest(6,length(numero::text)),'0')
  END;

  RETURN NEXT;
END;
$function$

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
  IF NEW.ultimo_numero IS DISTINCT FROM OLD.ultimo_numero
     AND (NEW.ultimo_numero::numeric - OLD.ultimo_numero::numeric) <> 1 THEN
    RAISE EXCEPTION 'IMMUTABILITY: contador fiscal deve avançar exactamente uma unidade';
  END IF;
  RETURN NEW;
END;
$function$

-- Serialize line insertion against finalization of the parent document.
CREATE OR REPLACE FUNCTION public.fiscal_require_pending_item_parent() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'pg_catalog','public' AS $$
DECLARE v_status text; v_empresa uuid;
BEGIN
 SELECT status,empresa_id INTO v_status,v_empresa FROM public.fiscal_documentos WHERE id=NEW.documento_id FOR UPDATE;
 IF NOT FOUND OR v_empresa IS DISTINCT FROM NEW.empresa_id THEN
  RAISE EXCEPTION 'TENANT: documento fiscal inválido para a linha';
 END IF;
 IF v_status IS DISTINCT FROM 'pendente_assinatura' THEN
  RAISE EXCEPTION 'IMMUTABILITY: linhas só podem ser acrescentadas ao documento pendente';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER trg_fiscal_documento_itens_pending_parent BEFORE INSERT ON public.fiscal_documento_itens
FOR EACH ROW EXECUTE FUNCTION public.fiscal_require_pending_item_parent();
REVOKE ALL ON FUNCTION public.fiscal_require_pending_item_parent() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.fiscal_reservar_numero_serie(uuid) FROM PUBLIC,anon,authenticated,service_role;
-- No grants or school activation. Existing receipt writer bypasses reservation RPC:
-- full integration of receipt path and approved migration remains a separate gate.
