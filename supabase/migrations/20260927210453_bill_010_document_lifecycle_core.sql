ALTER TABLE public.fiscal_documentos
  ADD COLUMN IF NOT EXISTS agt_document_status text NOT NULL DEFAULT 'N',
  ADD COLUMN IF NOT EXISTS agt_rejected_document_id uuid,
  ADD COLUMN IF NOT EXISTS agt_rejected_document_no text,
  ADD COLUMN IF NOT EXISTS reference_reason text,
  ADD COLUMN IF NOT EXISTS contingency_indicator text NOT NULL DEFAULT 'N';

DO $ddl$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.fiscal_documentos'::regclass
      AND conname='fiscal_documentos_agt_document_status_chk'
  ) THEN
    ALTER TABLE public.fiscal_documentos
      ADD CONSTRAINT fiscal_documentos_agt_document_status_chk
      CHECK (agt_document_status IN ('N','C'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.fiscal_documentos'::regclass
      AND conname='fiscal_documentos_agt_correction_shape_chk'
  ) THEN
    ALTER TABLE public.fiscal_documentos
      ADD CONSTRAINT fiscal_documentos_agt_correction_shape_chk
      CHECK (
        (
          agt_document_status='N'
          AND agt_rejected_document_id IS NULL
          AND agt_rejected_document_no IS NULL
        )
        OR
        (
          agt_document_status='C'
          AND agt_rejected_document_id IS NOT NULL
          AND agt_rejected_document_no IS NOT NULL
          AND char_length(agt_rejected_document_no) BETWEEN 8 AND 60
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.fiscal_documentos'::regclass
      AND conname='fiscal_documentos_agt_rejected_document_fk'
  ) THEN
    ALTER TABLE public.fiscal_documentos
      ADD CONSTRAINT fiscal_documentos_agt_rejected_document_fk
      FOREIGN KEY (agt_rejected_document_id)
      REFERENCES public.fiscal_documentos(id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.fiscal_documentos'::regclass
      AND conname='fiscal_documentos_reference_reason_chk'
  ) THEN
    ALTER TABLE public.fiscal_documentos
      ADD CONSTRAINT fiscal_documentos_reference_reason_chk
      CHECK (reference_reason IS NULL OR char_length(reference_reason) <= 60);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.fiscal_documentos'::regclass
      AND conname='fiscal_documentos_contingency_indicator_chk'
  ) THEN
    ALTER TABLE public.fiscal_documentos
      ADD CONSTRAINT fiscal_documentos_contingency_indicator_chk
      CHECK (contingency_indicator IN ('N','C'));
  END IF;
END
$ddl$;

CREATE UNIQUE INDEX IF NOT EXISTS fiscal_documentos_rejected_correction_uk
  ON public.fiscal_documentos(agt_rejected_document_id)
  WHERE agt_rejected_document_id IS NOT NULL;

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
  v_prior_credit numeric(18,4);
BEGIN
  v_requested_status := upper(
    coalesce(nullif(btrim(v_metadata->>'agt_document_status'),''),'N')
  );

  IF v_requested_status NOT IN ('N','C') THEN
    RAISE EXCEPTION 'DATA: agt_document_status inválido';
  END IF;

  v_reference_reason := nullif(btrim(v_metadata->>'reference_reason'),'');
  IF v_reference_reason IS NOT NULL AND char_length(v_reference_reason) > 60 THEN
    RAISE EXCEPTION 'DATA: reference_reason excede 60 caracteres';
  END IF;

  SELECT
    coalesce(s.series_contingency_indicator,'N'),
    s.origem_documento
  INTO v_series_contingency,v_series_origin
  FROM public.fiscal_series s
  WHERE s.id=NEW.serie_id;

  IF v_series_contingency IS NULL THEN
    RAISE EXCEPTION 'STATE: série fiscal sem indicador de contingência';
  END IF;

  NEW.agt_document_status := v_requested_status;
  NEW.reference_reason := v_reference_reason;
  NEW.contingency_indicator := v_series_contingency;

  IF NEW.tipo_documento NOT IN ('FT','FR','FG','GF','NC','ND','RC','PP','GR','GT') THEN
    RAISE EXCEPTION 'STATE: tipo de documento % não está habilitado no ciclo documental KLASSE', NEW.tipo_documento;
  END IF;

  IF NEW.tipo_documento IN ('PP','GR','GT') AND v_requested_status <> 'N' THEN
    RAISE EXCEPTION 'STATE: documento não submetido à FE não pode usar documentStatus=C';
  END IF;

  IF v_requested_status='C' THEN
    BEGIN
      v_rejected_id := nullif(btrim(v_metadata->>'agt_rejected_document_id'),'')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'DATA: agt_rejected_document_id inválido';
    END;

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

    IF v_rejected.empresa_id IS DISTINCT FROM NEW.empresa_id THEN
      RAISE EXCEPTION 'TENANT: documento rejeitado pertence a outra empresa';
    END IF;

    IF v_rejected.tipo_documento IS DISTINCT FROM NEW.tipo_documento THEN
      RAISE EXCEPTION 'DATA: correcção AGT deve preservar o tipo do documento rejeitado';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.fiscal_agt_submission_documentos sd
      WHERE sd.documento_id=v_rejected.id
        AND sd.validation_status='invalid'
    ) THEN
      RAISE EXCEPTION 'STATE: documentStatus=C exige rejeição AGT comprovada';
    END IF;

    IF NEW.numero_formatado IS NOT NULL
       AND NEW.numero_formatado = v_rejected.numero_formatado THEN
      RAISE EXCEPTION 'STATE: correcção de rejeitado exige novo número fiscal';
    END IF;

    NEW.agt_rejected_document_id := v_rejected.id;
    NEW.agt_rejected_document_no := v_rejected.numero_formatado;
  ELSE
    IF nullif(btrim(v_metadata->>'agt_rejected_document_id'),'') IS NOT NULL
       OR nullif(btrim(v_metadata->>'agt_rejected_document_no'),'') IS NOT NULL THEN
      RAISE EXCEPTION 'DATA: referência a documento rejeitado só é permitida com documentStatus=C';
    END IF;
    NEW.agt_rejected_document_id := NULL;
    NEW.agt_rejected_document_no := NULL;
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

    IF v_source.empresa_id IS DISTINCT FROM NEW.empresa_id THEN
      RAISE EXCEPTION 'TENANT: documento base da NC pertence a outra empresa';
    END IF;

    IF v_source.status NOT IN ('emitido','rectificado') THEN
      RAISE EXCEPTION 'STATE: documento base da NC deve estar emitido/rectificado';
    END IF;

    IF char_length(v_source.numero_formatado) > 60 THEN
      RAISE EXCEPTION 'STATE: número do documento base da NC excede limite AGT';
    END IF;

    SELECT coalesce(sum(d.total_liquido_aoa),0)
    INTO v_prior_credit
    FROM public.fiscal_documentos d
    WHERE d.empresa_id=NEW.empresa_id
      AND d.tipo_documento='NC'
      AND d.rectifica_documento_id=v_source.id
      AND d.status <> 'anulado'
      AND NOT EXISTS (
        SELECT 1
        FROM public.fiscal_agt_submission_documentos sd
        WHERE sd.documento_id=d.id
          AND sd.validation_status='invalid'
      );

    IF round(v_prior_credit + NEW.total_liquido_aoa,2)
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

    IF v_source.empresa_id IS DISTINCT FROM NEW.empresa_id THEN
      RAISE EXCEPTION 'TENANT: documento base da ND pertence a outra empresa';
    END IF;

    IF v_source.status NOT IN ('emitido','rectificado') THEN
      RAISE EXCEPTION 'STATE: documento base da ND deve estar emitido/rectificado';
    END IF;

    IF char_length(v_source.numero_formatado) > 60 THEN
      RAISE EXCEPTION 'STATE: número do documento base da ND excede limite AGT';
    END IF;
  END IF;

  IF v_series_origin='contingencia' AND v_series_contingency <> 'C' THEN
    RAISE EXCEPTION 'STATE: série de contingência exige seriesContingencyIndicator=C';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_fiscal_documentos_lifecycle ON public.fiscal_documentos;
CREATE TRIGGER trg_fiscal_documentos_lifecycle
BEFORE INSERT ON public.fiscal_documentos
FOR EACH ROW
EXECUTE FUNCTION public.fiscal_validate_document_lifecycle();

CREATE OR REPLACE FUNCTION public.fiscal_agt_record_document_result(
  p_submission_id uuid,
  p_document_no text,
  p_validation_status text,
  p_error_list jsonb DEFAULT '[]'::jsonb,
  p_source text DEFAULT 'obterEstado'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'pg_catalog','public'
AS $function$
DECLARE
  v_status text := lower(btrim(coalesce(p_validation_status,'')));
  v_link public.fiscal_agt_submission_documentos%ROWTYPE;
  v_event_type text;
  v_idempotent boolean := false;
BEGIN
  IF v_status NOT IN ('valid','invalid') THEN
    RAISE EXCEPTION 'DATA: validation_status deve ser valid ou invalid';
  END IF;

  SELECT *
  INTO v_link
  FROM public.fiscal_agt_submission_documentos sd
  WHERE sd.submission_id=p_submission_id
    AND sd.document_no=p_document_no
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DATA: documento da submissão AGT não encontrado';
  END IF;

  IF v_link.validation_status = v_status AND v_link.validated_at IS NOT NULL THEN
    v_idempotent := true;
  ELSIF v_link.validation_status <> 'pending' THEN
    RAISE EXCEPTION
      'STATE: resultado AGT já fechado como %, não pode transitar para %',
      v_link.validation_status,v_status;
  ELSE
    UPDATE public.fiscal_agt_submission_documentos
    SET validation_status=v_status,
        error_list=coalesce(p_error_list,'[]'::jsonb),
        validated_at=now()
    WHERE id=v_link.id;
  END IF;

  v_event_type := CASE WHEN v_status='valid' THEN 'AGT_VALIDADO' ELSE 'AGT_REJEITADO' END;

  IF NOT EXISTS (
    SELECT 1
    FROM public.fiscal_documentos_eventos e
    WHERE e.documento_id=v_link.documento_id
      AND e.tipo_evento=v_event_type
      AND e.payload->>'submission_id'=p_submission_id::text
  ) THEN
    INSERT INTO public.fiscal_documentos_eventos(
      empresa_id,documento_id,tipo_evento,payload,created_by
    )
    VALUES (
      v_link.empresa_id,
      v_link.documento_id,
      v_event_type,
      jsonb_build_object(
        'submission_id',p_submission_id,
        'document_no',p_document_no,
        'validation_status',v_status,
        'source',coalesce(nullif(btrim(p_source),''),'unknown'),
        'error_list',coalesce(p_error_list,'[]'::jsonb)
      ),
      NULL
    );
  END IF;

  RETURN jsonb_build_object(
    'ok',true,
    'idempotent',v_idempotent,
    'documento_id',v_link.documento_id,
    'validation_status',v_status
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fiscal_agt_record_document_result(uuid,text,text,jsonb,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fiscal_agt_record_document_result(uuid,text,text,jsonb,text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.fiscal_anular_documento(
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
  v_motivo text := nullif(btrim(p_motivo),'');
  v_agt_status text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH: utilizador não autenticado';
  END IF;

  IF v_motivo IS NULL THEN
    RAISE EXCEPTION 'DATA: motivo é obrigatório';
  END IF;

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
    RAISE EXCEPTION 'AUTH: permissão negada para anular documento fiscal';
  END IF;

  IF v_documento.status <> 'emitido' THEN
    RAISE EXCEPTION 'STATE: apenas documento emitido pode ser anulado';
  END IF;

  SELECT sd.validation_status
  INTO v_agt_status
  FROM public.fiscal_agt_submission_documentos sd
  WHERE sd.documento_id=v_documento.id
  LIMIT 1;

  IF v_agt_status IN ('pending','valid') THEN
    RAISE EXCEPTION
      'STATE: documento submetido/validado pela AGT exige confirmação externa de anulação antes do fecho local';
  END IF;

  UPDATE public.fiscal_documentos
  SET status='anulado'
  WHERE id=v_documento.id;

  INSERT INTO public.fiscal_documentos_eventos(
    empresa_id,documento_id,tipo_evento,payload,created_by
  )
  VALUES (
    v_documento.empresa_id,
    v_documento.id,
    'ANULADO',
    jsonb_build_object(
      'motivo',v_motivo,
      'status_anterior',v_documento.status,
      'status_novo','anulado',
      'numero_formatado',v_documento.numero_formatado,
      'agt_validation_status',v_agt_status,
      'metadata',coalesce(p_metadata,'{}'::jsonb)
    ),
    v_uid
  );

  RETURN jsonb_build_object(
    'ok',true,
    'documento_id',v_documento.id,
    'empresa_id',v_documento.empresa_id,
    'status','anulado'
  );
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
  v_motivo text := nullif(btrim(p_motivo),'');
  v_original_agt text;
  v_corrective_agt text;
  v_has_agt_submission boolean;
  v_relation_ok boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH: utilizador não autenticado';
  END IF;

  IF v_motivo IS NULL THEN
    RAISE EXCEPTION 'DATA: motivo é obrigatório';
  END IF;

  BEGIN
    v_corrective_id := nullif(btrim(coalesce(p_metadata->>'documento_correctivo_id','')),'')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'DATA: documento_correctivo_id inválido';
  END;

  IF v_corrective_id IS NULL THEN
    RAISE EXCEPTION
      'STATE: rectificação exige novo documento fiscal; informe metadata.documento_correctivo_id';
  END IF;

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

  IF v_documento.status <> 'emitido' THEN
    RAISE EXCEPTION 'STATE: apenas documento emitido pode ser rectificado';
  END IF;

  SELECT *
  INTO v_corrective
  FROM public.fiscal_documentos
  WHERE id=v_corrective_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DATA: documento correctivo não encontrado';
  END IF;

  IF v_corrective.empresa_id IS DISTINCT FROM v_documento.empresa_id THEN
    RAISE EXCEPTION 'TENANT: documento correctivo pertence a outra empresa';
  END IF;

  IF v_corrective.status <> 'emitido' THEN
    RAISE EXCEPTION 'STATE: documento correctivo deve estar emitido';
  END IF;

  v_relation_ok :=
       (v_corrective.tipo_documento='NC' AND v_corrective.rectifica_documento_id=v_documento.id)
    OR (v_corrective.tipo_documento='ND' AND v_corrective.documento_origem_id=v_documento.id)
    OR (v_corrective.agt_document_status='C' AND v_corrective.agt_rejected_document_id=v_documento.id);

  IF NOT v_relation_ok THEN
    RAISE EXCEPTION 'STATE: documento correctivo não referencia o documento original';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.fiscal_agt_submission_documentos sd
    WHERE sd.documento_id=v_documento.id
  )
  INTO v_has_agt_submission;

  SELECT sd.validation_status
  INTO v_original_agt
  FROM public.fiscal_agt_submission_documentos sd
  WHERE sd.documento_id=v_documento.id
  LIMIT 1;

  SELECT sd.validation_status
  INTO v_corrective_agt
  FROM public.fiscal_agt_submission_documentos sd
  WHERE sd.documento_id=v_corrective.id
  LIMIT 1;

  IF v_has_agt_submission AND coalesce(v_original_agt,'pending')='pending' THEN
    RAISE EXCEPTION 'STATE: documento original ainda aguarda resultado AGT';
  END IF;

  IF v_has_agt_submission AND v_corrective_agt IS DISTINCT FROM 'valid' THEN
    RAISE EXCEPTION 'STATE: documento correctivo deve validar na AGT antes de fechar a rectificação';
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
