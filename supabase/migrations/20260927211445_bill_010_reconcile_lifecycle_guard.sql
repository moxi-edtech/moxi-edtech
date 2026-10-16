
CREATE OR REPLACE FUNCTION public.fiscal_validate_document_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog','public'
AS $function$
DECLARE
  v_metadata jsonb := coalesce(NEW.payload->'metadata','{}'::jsonb);
  v_requested_status text;
  v_rejected_id uuid;
  v_rejected public.fiscal_documentos%ROWTYPE;
  v_source public.fiscal_documentos%ROWTYPE;
  v_reference_reason text;
  v_series_contingency text;
  v_series_origin text;
  v_prior_credit numeric(18,4) := 0;
BEGIN
  SELECT
    coalesce(s.series_contingency_indicator,'N'),
    s.origem_documento
  INTO v_series_contingency,v_series_origin
  FROM public.fiscal_series s
  WHERE s.id=NEW.serie_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DATA: série fiscal não encontrada';
  END IF;

  IF v_series_contingency NOT IN ('N','C') THEN
    RAISE EXCEPTION 'STATE: série fiscal sem indicador de contingência válido';
  END IF;

  IF TG_OP='INSERT' THEN
    v_requested_status := upper(
      coalesce(nullif(btrim(v_metadata->>'agt_document_status'),''),'N')
    );
    v_reference_reason := nullif(
      btrim(
        coalesce(
          v_metadata->>'reference_reason',
          v_metadata->>'motivo_rectificacao',
          ''
        )
      ),
      ''
    );

    NEW.agt_document_status := v_requested_status;
    NEW.reference_reason := v_reference_reason;
    NEW.contingency_indicator := v_series_contingency;
  ELSE
    v_requested_status := NEW.agt_document_status;
    v_reference_reason := NEW.reference_reason;

    IF NEW.contingency_indicator IS DISTINCT FROM v_series_contingency THEN
      RAISE EXCEPTION
        'IMMUTABILITY: contingency_indicator diverge da série fiscal';
    END IF;
  END IF;

  IF v_requested_status NOT IN ('N','C') THEN
    RAISE EXCEPTION 'DATA: agt_document_status inválido';
  END IF;

  IF v_reference_reason IS NOT NULL AND char_length(v_reference_reason)>60 THEN
    RAISE EXCEPTION 'DATA: reference_reason excede 60 caracteres';
  END IF;

  IF NEW.tipo_documento NOT IN ('FT','FR','FG','GF','NC','ND','RC','PP','GR','GT') THEN
    RAISE EXCEPTION
      'STATE: tipo de documento % não está habilitado no ciclo documental KLASSE',
      NEW.tipo_documento;
  END IF;

  IF NEW.tipo_documento IN ('PP','GR','GT') AND v_requested_status<>'N' THEN
    RAISE EXCEPTION
      'STATE: documento não submetido à FE não pode usar documentStatus=C';
  END IF;

  IF v_requested_status='C' THEN
    IF TG_OP='INSERT' THEN
      BEGIN
        v_rejected_id := nullif(
          btrim(v_metadata->>'agt_rejected_document_id'),
          ''
        )::uuid;
      EXCEPTION WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'DATA: agt_rejected_document_id inválido';
      END;
    ELSE
      v_rejected_id := NEW.agt_rejected_document_id;
    END IF;

    IF v_rejected_id IS NULL THEN
      RAISE EXCEPTION 'DATA: correcção AGT exige agt_rejected_document_id';
    END IF;

    SELECT *
    INTO v_rejected
    FROM public.fiscal_documentos d
    WHERE d.id=v_rejected_id
    FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'DATA: documento rejeitado AGT não encontrado';
    END IF;

    IF v_rejected.id=NEW.id THEN
      RAISE EXCEPTION
        'DATA: documento de correcção AGT não pode referenciar a si próprio';
    END IF;

    IF v_rejected.empresa_id IS DISTINCT FROM NEW.empresa_id THEN
      RAISE EXCEPTION 'TENANT: documento rejeitado pertence a outra empresa';
    END IF;

    IF v_rejected.tipo_documento IS DISTINCT FROM NEW.tipo_documento THEN
      RAISE EXCEPTION
        'DATA: correcção AGT deve preservar o tipo do documento rejeitado';
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
        'STATE: documentStatus=C exige rejeição AGT diferida comprovada';
    END IF;

    IF NEW.numero_formatado IS NOT NULL
       AND NEW.numero_formatado=v_rejected.numero_formatado THEN
      RAISE EXCEPTION
        'STATE: correcção de rejeitado exige novo número fiscal';
    END IF;

    NEW.agt_rejected_document_id := v_rejected.id;
    NEW.agt_rejected_document_no := v_rejected.numero_formatado;
  ELSE
    IF TG_OP='INSERT'
       AND (
         nullif(btrim(v_metadata->>'agt_rejected_document_id'),'') IS NOT NULL
         OR nullif(btrim(v_metadata->>'agt_rejected_document_no'),'') IS NOT NULL
       ) THEN
      RAISE EXCEPTION
        'DATA: referência a documento rejeitado só é permitida com documentStatus=C';
    END IF;

    IF NEW.agt_rejected_document_id IS NOT NULL
       OR NEW.agt_rejected_document_no IS NOT NULL THEN
      RAISE EXCEPTION
        'DATA: documento normal não pode transportar referência a rejeição AGT';
    END IF;
  END IF;

  IF NEW.tipo_documento='NC' THEN
    IF NEW.rectifica_documento_id IS NULL THEN
      RAISE EXCEPTION 'DATA: NC exige rectifica_documento_id';
    END IF;

    SELECT *
    INTO v_source
    FROM public.fiscal_documentos d
    WHERE d.id=NEW.rectifica_documento_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'DATA: documento base da NC não encontrado';
    END IF;

    IF v_source.id=NEW.id
       OR v_source.empresa_id IS DISTINCT FROM NEW.empresa_id THEN
      RAISE EXCEPTION 'TENANT: referência da NC inválida';
    END IF;

    IF v_source.status NOT IN ('emitido','rectificado') THEN
      RAISE EXCEPTION
        'STATE: documento base da NC deve estar emitido/rectificado';
    END IF;

    IF v_source.moeda IS DISTINCT FROM NEW.moeda THEN
      RAISE EXCEPTION 'DATA: NC deve usar a mesma moeda do documento base';
    END IF;

    IF coalesce(v_source.cliente_nif,'999999999')
       IS DISTINCT FROM coalesce(NEW.cliente_nif,'999999999') THEN
      RAISE EXCEPTION 'DATA: NC deve manter o cliente fiscal do documento base';
    END IF;

    IF NEW.invoice_date<v_source.invoice_date THEN
      RAISE EXCEPTION 'DATA: NC não pode anteceder o documento base';
    END IF;

    IF char_length(v_source.numero_formatado)>60 THEN
      RAISE EXCEPTION
        'STATE: número do documento base da NC excede limite AGT';
    END IF;

    SELECT coalesce(sum(d.total_liquido_aoa),0)
    INTO v_prior_credit
    FROM public.fiscal_documentos d
    WHERE d.empresa_id=NEW.empresa_id
      AND d.tipo_documento='NC'
      AND d.rectifica_documento_id=v_source.id
      AND d.id IS DISTINCT FROM NEW.id
      AND d.status<>'anulado'
      AND NOT EXISTS (
        SELECT 1
        FROM public.fiscal_agt_submission_documentos sd
        WHERE sd.documento_id=d.id
          AND sd.validation_status='invalid'
      );

    IF round(v_prior_credit+NEW.total_liquido_aoa,2)
       > round(v_source.total_liquido_aoa,2) THEN
      RAISE EXCEPTION
        'STATE: NC excede montante líquido ainda não anulado/devolvido do documento base';
    END IF;
  END IF;

  IF NEW.tipo_documento='ND' THEN
    IF NEW.documento_origem_id IS NULL THEN
      RAISE EXCEPTION 'DATA: ND exige documento_origem_id no KLASSE';
    END IF;

    SELECT *
    INTO v_source
    FROM public.fiscal_documentos d
    WHERE d.id=NEW.documento_origem_id
    FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'DATA: documento base da ND não encontrado';
    END IF;

    IF v_source.id=NEW.id
       OR v_source.empresa_id IS DISTINCT FROM NEW.empresa_id THEN
      RAISE EXCEPTION 'TENANT: referência da ND inválida';
    END IF;

    IF v_source.status NOT IN ('emitido','rectificado') THEN
      RAISE EXCEPTION
        'STATE: documento base da ND deve estar emitido/rectificado';
    END IF;

    IF v_source.moeda IS DISTINCT FROM NEW.moeda THEN
      RAISE EXCEPTION 'DATA: ND deve usar a mesma moeda do documento base';
    END IF;

    IF coalesce(v_source.cliente_nif,'999999999')
       IS DISTINCT FROM coalesce(NEW.cliente_nif,'999999999') THEN
      RAISE EXCEPTION 'DATA: ND deve manter o cliente fiscal do documento base';
    END IF;

    IF NEW.invoice_date<v_source.invoice_date THEN
      RAISE EXCEPTION 'DATA: ND não pode anteceder o documento base';
    END IF;

    IF char_length(v_source.numero_formatado)>60 THEN
      RAISE EXCEPTION
        'STATE: número do documento base da ND excede limite AGT';
    END IF;
  END IF;

  IF v_series_origin='contingencia' AND v_series_contingency<>'C' THEN
    RAISE EXCEPTION
      'STATE: série de contingência exige seriesContingencyIndicator=C';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_fiscal_documentos_lifecycle
  ON public.fiscal_documentos;

DROP TRIGGER IF EXISTS fiscal_document_lifecycle_guard
  ON public.fiscal_documentos;

CREATE TRIGGER fiscal_document_lifecycle_guard
BEFORE INSERT OR UPDATE
ON public.fiscal_documentos
FOR EACH ROW
EXECUTE FUNCTION public.fiscal_validate_document_lifecycle();

ALTER TABLE public.fiscal_documentos
  DROP CONSTRAINT IF EXISTS fiscal_documentos_agt_document_status_chk;

CREATE OR REPLACE FUNCTION public.fiscal_require_agt_series_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog','public'
AS $function$
DECLARE
  v_serie public.fiscal_series%ROWTYPE;
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

  IF v_serie.agt_status IS DISTINCT FROM 'provisioned'
     OR nullif(btrim(coalesce(v_serie.agt_series_code,'')),'') IS NULL
     OR v_serie.agt_submission_uuid IS NULL
     OR v_serie.agt_provisioned_at IS NULL THEN
    RAISE EXCEPTION 'STATE: emissão fiscal exige série provisionada pela AGT';
  END IF;

  IF v_serie.series_year
     IS DISTINCT FROM extract(year from NEW.invoice_date)::integer THEN
    RAISE EXCEPTION 'STATE: ano da série AGT diverge da data do documento';
  END IF;

  IF v_serie.series_contingency_indicator NOT IN ('N','C') THEN
    RAISE EXCEPTION
      'STATE: indicador de contingência da série AGT inválido';
  END IF;

  NEW.contingency_indicator := v_serie.series_contingency_indicator;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fiscal_rectificar_documento(
  p_documento_id uuid,
  p_motivo text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog','public'
AS $function$
DECLARE
  v_uid uuid := public.safe_auth_uid();
  v_documento public.fiscal_documentos%ROWTYPE;
  v_corrective public.fiscal_documentos%ROWTYPE;
  v_corrective_id uuid;
  v_corrective_id_text text := nullif(
    btrim(
      coalesce(
        p_metadata->>'correction_document_id',
        p_metadata->>'documento_correctivo_id',
        ''
      )
    ),
    ''
  );
  v_motivo text := nullif(btrim(coalesce(p_motivo,'')),'');
  v_original_agt text;
  v_corrective_agt text;
  v_original_submission_status text;
  v_corrective_submission_status text;
  v_has_agt_submission boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH: utilizador não autenticado';
  END IF;

  IF v_motivo IS NULL THEN
    RAISE EXCEPTION 'DATA: motivo é obrigatório';
  END IF;

  IF v_corrective_id_text IS NULL THEN
    RAISE EXCEPTION
      'STATE: rectificação exige novo documento fiscal correctivo';
  END IF;

  BEGIN
    v_corrective_id := v_corrective_id_text::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'DATA: documento correctivo inválido';
  END;

  SELECT *
  INTO v_documento
  FROM public.fiscal_documentos
  WHERE id=p_documento_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DATA: documento fiscal não encontrado';
  END IF;

  IF NOT public.user_has_role_in_empresa(
    v_documento.empresa_id,ARRAY['owner','admin','operator']
  ) THEN
    RAISE EXCEPTION 'AUTH: permissão negada para rectificar documento fiscal';
  END IF;

  IF v_documento.status<>'emitido' THEN
    RAISE EXCEPTION 'STATE: apenas documento emitido pode ser rectificado';
  END IF;

  SELECT *
  INTO v_corrective
  FROM public.fiscal_documentos
  WHERE id=v_corrective_id
    AND empresa_id=v_documento.empresa_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DATA: documento correctivo não encontrado';
  END IF;

  IF v_corrective.status<>'emitido' THEN
    RAISE EXCEPTION 'STATE: documento correctivo deve estar emitido';
  END IF;

  SELECT
    true,
    sd.validation_status,
    s.status
  INTO
    v_has_agt_submission,
    v_original_agt,
    v_original_submission_status
  FROM public.fiscal_agt_submission_documentos sd
  JOIN public.fiscal_agt_submissions s ON s.id=sd.submission_id
  WHERE sd.documento_id=v_documento.id
  LIMIT 1;

  SELECT
    sd.validation_status,
    s.status
  INTO
    v_corrective_agt,
    v_corrective_submission_status
  FROM public.fiscal_agt_submission_documentos sd
  JOIN public.fiscal_agt_submissions s ON s.id=sd.submission_id
  WHERE sd.documento_id=v_corrective.id
  LIMIT 1;

  IF v_has_agt_submission THEN
    IF coalesce(v_original_agt,'pending')='pending'
       OR v_original_submission_status IN (
         'prepared','submitting','submitted','processing','uncertain'
       ) THEN
      RAISE EXCEPTION
        'STATE: documento original ainda aguarda resultado AGT';
    END IF;

    IF v_corrective_agt IS DISTINCT FROM 'valid'
       OR v_corrective_submission_status IS DISTINCT FROM 'accepted' THEN
      RAISE EXCEPTION
        'STATE: documento correctivo deve validar na AGT antes de fechar a rectificação';
    END IF;
  END IF;

  IF v_original_agt='invalid'
     OR v_original_submission_status='rejected' THEN
    IF v_corrective.agt_document_status<>'C'
       OR v_corrective.agt_rejected_document_id
          IS DISTINCT FROM v_documento.id THEN
      RAISE EXCEPTION
        'STATE: rejeição AGT exige novo documento documentStatus=C';
    END IF;
  ELSE
    IF NOT (
      (v_corrective.tipo_documento='NC'
       AND v_corrective.rectifica_documento_id=v_documento.id)
      OR
      (v_corrective.tipo_documento='ND'
       AND v_corrective.documento_origem_id=v_documento.id)
    ) THEN
      RAISE EXCEPTION
        'STATE: rectificação exige NC/ND que referencie o documento original';
    END IF;
  END IF;

  UPDATE public.fiscal_documentos
  SET status='rectificado'
  WHERE id=v_documento.id;

  INSERT INTO public.fiscal_documentos_eventos(
    empresa_id,documento_id,tipo_evento,payload,created_by
  )
  VALUES (
    v_documento.empresa_id,
    v_documento.id,
    'RECTIFICADO',
    jsonb_build_object(
      'motivo',v_motivo,
      'status_anterior',v_documento.status,
      'status_novo','rectificado',
      'numero_formatado',v_documento.numero_formatado,
      'documento_correctivo_id',v_corrective.id,
      'documento_correctivo_no',v_corrective.numero_formatado,
      'original_agt_status',v_original_agt,
      'corrective_agt_status',v_corrective_agt,
      'metadata',coalesce(p_metadata,'{}'::jsonb)
    ),
    v_uid
  );

  RETURN jsonb_build_object(
    'ok',true,
    'documento_id',v_documento.id,
    'documento_correctivo_id',v_corrective.id,
    'empresa_id',v_documento.empresa_id,
    'status','rectificado'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fiscal_rectificar_documento(uuid,text,jsonb)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fiscal_rectificar_documento(uuid,text,jsonb)
  TO service_role;
