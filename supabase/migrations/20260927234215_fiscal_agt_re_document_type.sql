-- BILL readiness: align KLASSE with the official AGT FE document type RE.
-- Generated from the live canonical function definitions; only FE type allow-lists change.
CREATE OR REPLACE FUNCTION public.fiscal_agt_auto_prepare_on_emit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_submission_id uuid;
BEGIN
  IF NEW.status <> 'emitido'
     OR OLD.status IS NOT DISTINCT FROM NEW.status
     OR NEW.tipo_documento NOT IN ('FT','FR','FG','GF','NC','ND','RC','RE') THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.fiscal_agt_submission_documentos
    WHERE documento_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.fiscal_agt_submissions (
    empresa_id, submission_uuid, status, document_count, created_by
  )
  VALUES (
    NEW.empresa_id, gen_random_uuid(), 'prepared', 1, NEW.created_by
  )
  RETURNING id INTO v_submission_id;

  INSERT INTO public.fiscal_agt_submission_documentos (
    empresa_id, submission_id, documento_id, document_no
  )
  VALUES (
    NEW.empresa_id, v_submission_id, NEW.id, NEW.numero_formatado
  );

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fiscal_agt_prepare_submission(p_documento_id uuid, p_created_by uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_claim_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
  v_doc public.fiscal_documentos%ROWTYPE;
  v_existing public.fiscal_agt_submissions%ROWTYPE;
  v_submission public.fiscal_agt_submissions%ROWTYPE;
BEGIN
  IF v_claim_role <> 'service_role' AND session_user <> 'postgres' THEN
    RAISE EXCEPTION 'AUTH: preparação AGT é exclusiva do backend fiscal';
  END IF;

  SELECT *
    INTO v_doc
  FROM public.fiscal_documentos
  WHERE id = p_documento_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DATA: documento fiscal não encontrado';
  END IF;

  IF v_doc.status <> 'emitido' THEN
    RAISE EXCEPTION 'STATE: somente documento emitido pode ser submetido à AGT';
  END IF;

  IF v_doc.tipo_documento NOT IN ('FT','FR','FG','GF','NC','ND','RC','RE') THEN
    RAISE EXCEPTION 'STATE: tipo de documento fora do contrato FE actualmente integrado';
  END IF;

  SELECT s.*
    INTO v_existing
  FROM public.fiscal_agt_submission_documentos sd
  JOIN public.fiscal_agt_submissions s ON s.id = sd.submission_id
  WHERE sd.documento_id = p_documento_id
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'submission_id', v_existing.id,
      'submission_uuid', v_existing.submission_uuid,
      'request_id', v_existing.request_id,
      'status', v_existing.status
    );
  END IF;

  INSERT INTO public.fiscal_agt_submissions (
    empresa_id, submission_uuid, status, document_count, created_by
  )
  VALUES (
    v_doc.empresa_id, gen_random_uuid(), 'prepared', 1, p_created_by
  )
  RETURNING * INTO v_submission;

  INSERT INTO public.fiscal_agt_submission_documentos (
    empresa_id, submission_id, documento_id, document_no
  )
  VALUES (
    v_doc.empresa_id, v_submission.id, v_doc.id, v_doc.numero_formatado
  );

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'submission_id', v_submission.id,
    'submission_uuid', v_submission.submission_uuid,
    'request_id', null,
    'status', v_submission.status
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.fiscal_require_agt_series_on_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
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

  v_is_fe := NEW.tipo_documento IN ('FT','FR','FG','GF','NC','ND','RC','RE');

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

CREATE OR REPLACE FUNCTION public.fiscal_validate_document_lifecycle()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_metadata jsonb := coalesce(NEW.payload->'metadata','{}'::jsonb);
  v_ref public.fiscal_documentos%ROWTYPE;
  v_rejected public.fiscal_documentos%ROWTYPE;
  v_prior_credit numeric(18,4) := 0;
  v_rejected_id_text text;
  v_requested_status text;
  v_series_contingency text;
  v_series_origin text;
BEGIN
  IF TG_OP='INSERT' THEN
    v_requested_status := upper(
      coalesce(nullif(btrim(v_metadata->>'agt_document_status'),''),'N')
    );
    NEW.agt_document_status := v_requested_status;

    IF nullif(btrim(coalesce(v_metadata->>'agt_rejected_document_id','')),'') IS NOT NULL THEN
      v_rejected_id_text := btrim(v_metadata->>'agt_rejected_document_id');
      BEGIN
        NEW.agt_rejected_document_id := v_rejected_id_text::uuid;
      EXCEPTION WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'DATA: agt_rejected_document_id inválido';
      END;
    END IF;

    NEW.reference_reason := coalesce(
      NEW.reference_reason,
      nullif(
        btrim(
          coalesce(
            v_metadata->>'reference_reason',
            v_metadata->>'motivo_rectificacao',
            ''
          )
        ),
        ''
      )
    );

    SELECT s.series_contingency_indicator,s.origem_documento
    INTO v_series_contingency,v_series_origin
    FROM public.fiscal_series s
    WHERE s.id=NEW.serie_id;

    IF v_series_contingency NOT IN ('N','C') THEN
      RAISE EXCEPTION 'STATE: série AGT sem indicador de contingência válido';
    END IF;

    NEW.contingency_indicator := v_series_contingency;

    IF v_series_origin='contingencia' AND v_series_contingency <> 'C' THEN
      RAISE EXCEPTION 'STATE: série de contingência exige seriesContingencyIndicator=C';
    END IF;
  END IF;

  IF NEW.tipo_documento NOT IN ('FT','FR','FG','GF','NC','ND','RC','RE','PP','GR','GT') THEN
    RAISE EXCEPTION
      'STATE: tipo de documento % não está habilitado no ciclo documental KLASSE',
      NEW.tipo_documento;
  END IF;

  IF NEW.agt_document_status NOT IN ('N','C') THEN
    RAISE EXCEPTION 'DATA: agt_document_status deve ser N ou C';
  END IF;

  IF NEW.contingency_indicator NOT IN ('N','C') THEN
    RAISE EXCEPTION 'DATA: contingency_indicator deve ser N ou C';
  END IF;

  IF NEW.reference_reason IS NOT NULL
     AND char_length(NEW.reference_reason) > 60 THEN
    RAISE EXCEPTION 'DATA: reference_reason excede 60 caracteres';
  END IF;

  IF NEW.tipo_documento IN ('PP','GR','GT')
     AND NEW.agt_document_status <> 'N' THEN
    RAISE EXCEPTION
      'STATE: documento fora da Facturação Electrónica não pode usar documentStatus=C';
  END IF;

  IF NEW.agt_document_status='N' THEN
    IF NEW.agt_rejected_document_id IS NOT NULL
       OR NEW.agt_rejected_document_no IS NOT NULL THEN
      RAISE EXCEPTION
        'DATA: documento normal não pode referenciar documento rejeitado AGT';
    END IF;
  ELSE
    IF NEW.agt_rejected_document_id IS NULL THEN
      RAISE EXCEPTION
        'DATA: documento de correcção AGT exige agt_rejected_document_id';
    END IF;

    SELECT *
    INTO v_rejected
    FROM public.fiscal_documentos d
    WHERE d.id=NEW.agt_rejected_document_id
    FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'DATA: documento rejeitado AGT não encontrado';
    END IF;

    IF v_rejected.id=NEW.id THEN
      RAISE EXCEPTION
        'DATA: documento de correcção AGT não pode referenciar a si próprio';
    END IF;

    IF v_rejected.empresa_id IS DISTINCT FROM NEW.empresa_id THEN
      RAISE EXCEPTION 'TENANT: documento rejeitado AGT pertence a outra empresa';
    END IF;

    IF v_rejected.tipo_documento IS DISTINCT FROM NEW.tipo_documento THEN
      RAISE EXCEPTION
        'DATA: correcção de rejeição AGT deve manter o tipo do documento rejeitado';
    END IF;

    IF v_rejected.numero_formatado IS NOT DISTINCT FROM NEW.numero_formatado THEN
      RAISE EXCEPTION 'DATA: correcção AGT deve possuir novo número de documento';
    END IF;

    IF char_length(v_rejected.numero_formatado) NOT BETWEEN 8 AND 60 THEN
      RAISE EXCEPTION
        'STATE: número do documento rejeitado não cumpre comprimento AGT';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.fiscal_agt_submission_documentos sd
      JOIN public.fiscal_agt_submissions s ON s.id=sd.submission_id
      WHERE sd.documento_id=v_rejected.id
        AND sd.validation_status='invalid'
        AND s.status='rejected'
        AND nullif(btrim(coalesce(s.request_id,'')),'') IS NOT NULL
    ) THEN
      RAISE EXCEPTION
        'STATE: documentStatus=C exige rejeição AGT diferida comprovada para o documento origem';
    END IF;

    IF TG_OP='INSERT' THEN
      NEW.agt_rejected_document_no := v_rejected.numero_formatado;
    ELSIF NEW.agt_rejected_document_no IS DISTINCT FROM v_rejected.numero_formatado THEN
      RAISE EXCEPTION
        'IMMUTABILITY: número do documento rejeitado diverge da referência canónica';
    END IF;
  END IF;

  IF NEW.tipo_documento='NC' THEN
    IF NEW.rectifica_documento_id IS NULL THEN
      RAISE EXCEPTION 'DATA: NC exige rectifica_documento_id';
    END IF;

    SELECT *
    INTO v_ref
    FROM public.fiscal_documentos d
    WHERE d.id=NEW.rectifica_documento_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'DATA: documento base da NC não encontrado';
    END IF;

    IF v_ref.id=NEW.id OR v_ref.empresa_id IS DISTINCT FROM NEW.empresa_id THEN
      RAISE EXCEPTION 'DATA: referência da NC inválida';
    END IF;

    IF v_ref.status NOT IN ('emitido','rectificado') THEN
      RAISE EXCEPTION 'STATE: NC exige documento base emitido/rectificado';
    END IF;

    IF v_ref.moeda IS DISTINCT FROM NEW.moeda THEN
      RAISE EXCEPTION 'DATA: NC deve usar a mesma moeda do documento base';
    END IF;

    IF coalesce(v_ref.cliente_nif,'999999999')
       IS DISTINCT FROM coalesce(NEW.cliente_nif,'999999999') THEN
      RAISE EXCEPTION 'DATA: NC deve manter o cliente fiscal do documento base';
    END IF;

    IF NEW.invoice_date < v_ref.invoice_date THEN
      RAISE EXCEPTION 'DATA: NC não pode anteceder o documento base';
    END IF;

    IF char_length(v_ref.numero_formatado) > 60 THEN
      RAISE EXCEPTION 'STATE: referência da NC excede limite AGT';
    END IF;

    SELECT coalesce(sum(d.total_liquido_aoa),0)
    INTO v_prior_credit
    FROM public.fiscal_documentos d
    WHERE d.empresa_id=NEW.empresa_id
      AND d.tipo_documento='NC'
      AND d.rectifica_documento_id=v_ref.id
      AND d.id IS DISTINCT FROM NEW.id
      AND d.status IN ('pendente_assinatura','emitido','rectificado')
      AND NOT EXISTS (
        SELECT 1
        FROM public.fiscal_agt_submission_documentos sd
        JOIN public.fiscal_agt_submissions s ON s.id=sd.submission_id
        WHERE sd.documento_id=d.id
          AND sd.validation_status='invalid'
          AND s.status='rejected'
      );

    IF round(v_prior_credit + NEW.total_liquido_aoa,2)
       > round(v_ref.total_liquido_aoa,2) THEN
      RAISE EXCEPTION
        'STATE: NC excede o montante líquido ainda não devolvido do documento base';
    END IF;
  END IF;

  IF NEW.tipo_documento='ND' THEN
    IF NEW.documento_origem_id IS NULL THEN
      RAISE EXCEPTION 'DATA: ND exige documento_origem_id';
    END IF;

    SELECT *
    INTO v_ref
    FROM public.fiscal_documentos d
    WHERE d.id=NEW.documento_origem_id
    FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'DATA: documento base da ND não encontrado';
    END IF;

    IF v_ref.id=NEW.id OR v_ref.empresa_id IS DISTINCT FROM NEW.empresa_id THEN
      RAISE EXCEPTION 'DATA: referência da ND inválida';
    END IF;

    IF v_ref.status NOT IN ('emitido','rectificado') THEN
      RAISE EXCEPTION 'STATE: ND exige documento base emitido/rectificado';
    END IF;

    IF v_ref.moeda IS DISTINCT FROM NEW.moeda THEN
      RAISE EXCEPTION 'DATA: ND deve usar a mesma moeda do documento base';
    END IF;

    IF coalesce(v_ref.cliente_nif,'999999999')
       IS DISTINCT FROM coalesce(NEW.cliente_nif,'999999999') THEN
      RAISE EXCEPTION 'DATA: ND deve manter o cliente fiscal do documento base';
    END IF;

    IF NEW.invoice_date < v_ref.invoice_date THEN
      RAISE EXCEPTION 'DATA: ND não pode anteceder o documento base';
    END IF;

    IF char_length(v_ref.numero_formatado) > 60 THEN
      RAISE EXCEPTION 'STATE: referência da ND excede limite AGT';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.fiscal_agt_prepare_submission(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fiscal_agt_prepare_submission(uuid,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.fiscal_agt_auto_prepare_on_emit() FROM PUBLIC,anon,authenticated,service_role;
