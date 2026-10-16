CREATE OR REPLACE FUNCTION public.fiscal_require_agt_series_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog','public'
AS $function$
DECLARE
  v_serie public.fiscal_series%ROWTYPE;
  v_is_fe boolean;
BEGIN
  SELECT *
  INTO v_serie
  FROM public.fiscal_series
  WHERE id=NEW.serie_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DATA: série fiscal não encontrada';
  END IF;

  IF v_serie.empresa_id IS DISTINCT FROM NEW.empresa_id
     OR v_serie.tipo_documento IS DISTINCT FROM NEW.tipo_documento THEN
    RAISE EXCEPTION 'DATA: série fiscal incompatível com o documento';
  END IF;

  v_is_fe := NEW.tipo_documento IN ('FT','FR','FG','GF','NC','ND','RC');

  IF v_is_fe THEN
    IF v_serie.agt_status IS DISTINCT FROM 'provisioned'
       OR nullif(btrim(coalesce(v_serie.agt_series_code,'')),'') IS NULL
       OR v_serie.agt_submission_uuid IS NULL
       OR v_serie.agt_provisioned_at IS NULL THEN
      RAISE EXCEPTION 'STATE: documento FE exige série provisionada pela AGT';
    END IF;

    IF v_serie.series_year
       IS DISTINCT FROM extract(year from NEW.invoice_date)::integer THEN
      RAISE EXCEPTION 'STATE: ano da série AGT diverge da data do documento';
    END IF;

    IF v_serie.series_contingency_indicator NOT IN ('N','C') THEN
      RAISE EXCEPTION 'STATE: indicador de contingência da série AGT inválido';
    END IF;

    IF (v_serie.origem_documento='contingencia')
       IS DISTINCT FROM (v_serie.series_contingency_indicator='C') THEN
      RAISE EXCEPTION
        'STATE: origem contingência e seriesContingencyIndicator devem ser coerentes';
    END IF;

    NEW.contingency_indicator := v_serie.series_contingency_indicator;
  ELSIF NEW.tipo_documento IN ('PP','GR','GT') THEN
    IF v_serie.agt_status IS DISTINCT FROM 'legacy' THEN
      RAISE EXCEPTION
        'STATE: PP/GR/GT usam série local controlada e não série de Facturação Electrónica';
    END IF;

    IF v_serie.origem_documento='contingencia'
       OR coalesce(v_serie.series_contingency_indicator,'N')<>'N' THEN
      RAISE EXCEPTION
        'STATE: PP/GR/GT não podem usar série FE de contingência';
    END IF;

    NEW.contingency_indicator := 'N';
  ELSE
    RAISE EXCEPTION
      'STATE: tipo de documento % não possui política de série definida',
      NEW.tipo_documento;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fiscal_reservar_numero_serie(p_serie_id uuid)
RETURNS TABLE(numero bigint, numero_formatado text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog','public'
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

  v_is_fe := v_serie.tipo_documento IN ('FT','FR','FG','GF','NC','ND','RC');

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

REVOKE ALL ON FUNCTION public.fiscal_anular_documento(uuid,text,jsonb)
  FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.fiscal_rectificar_documento(uuid,text,jsonb)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fiscal_anular_documento(uuid,text,jsonb)
  TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.fiscal_rectificar_documento(uuid,text,jsonb)
  TO authenticated,service_role;

REVOKE ALL ON FUNCTION public.estornar_mensalidade(uuid,text)
  FROM PUBLIC,anon,authenticated,service_role;

COMMENT ON FUNCTION public.estornar_mensalidade(uuid,text) IS
  'LEGACY DISABLED by BILL-010. Use reverter_pagamento_realizado so ledger allocations and fiscal lifecycle guards are preserved.';
