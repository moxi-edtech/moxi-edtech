ALTER TABLE public.fiscal_documentos
  ADD COLUMN IF NOT EXISTS agt_document_status text NOT NULL DEFAULT 'N',
  ADD COLUMN IF NOT EXISTS agt_rejected_document_id uuid NULL,
  ADD COLUMN IF NOT EXISTS reference_reason text NULL;

ALTER TABLE public.fiscal_documentos
  DROP CONSTRAINT IF EXISTS fiscal_documentos_agt_document_status_chk,
  DROP CONSTRAINT IF EXISTS fiscal_documentos_agt_rejected_document_fk,
  DROP CONSTRAINT IF EXISTS fiscal_documentos_reference_reason_chk;

ALTER TABLE public.fiscal_documentos
  ADD CONSTRAINT fiscal_documentos_agt_document_status_chk
  CHECK (
    (agt_document_status = 'N' AND agt_rejected_document_id IS NULL)
    OR
    (agt_document_status = 'C' AND agt_rejected_document_id IS NOT NULL)
  ),
  ADD CONSTRAINT fiscal_documentos_agt_rejected_document_fk
  FOREIGN KEY (agt_rejected_document_id)
  REFERENCES public.fiscal_documentos(id)
  ON DELETE RESTRICT,
  ADD CONSTRAINT fiscal_documentos_reference_reason_chk
  CHECK (reference_reason IS NULL OR char_length(reference_reason) <= 60);

CREATE OR REPLACE FUNCTION public.fiscal_validate_document_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog','public'
AS $function$
DECLARE
  v_metadata jsonb := coalesce(NEW.payload->'metadata','{}'::jsonb);
  v_ref public.fiscal_documentos%ROWTYPE;
  v_rejected public.fiscal_documentos%ROWTYPE;
  v_prior_credit numeric(18,4) := 0;
  v_rejected_id_text text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF nullif(btrim(coalesce(v_metadata->>'agt_document_status','')),'') IS NOT NULL THEN
      NEW.agt_document_status := upper(btrim(v_metadata->>'agt_document_status'));
    END IF;

    IF nullif(btrim(coalesce(v_metadata->>'agt_rejected_document_id','')),'') IS NOT NULL THEN
      v_rejected_id_text := btrim(v_metadata->>'agt_rejected_document_id');
      BEGIN
        NEW.agt_rejected_document_id := v_rejected_id_text::uuid;
      EXCEPTION WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'DATA: agt_rejected_document_id inválido';
      END;
    END IF;

    IF NEW.reference_reason IS NULL THEN
      NEW.reference_reason := nullif(
        btrim(
          coalesce(
            v_metadata->>'reference_reason',
            v_metadata->>'motivo_rectificacao',
            ''
          )
        ),
        ''
      );
    END IF;
  END IF;

  IF NEW.agt_document_status NOT IN ('N','C') THEN
    RAISE EXCEPTION 'DATA: agt_document_status deve ser N ou C';
  END IF;

  IF NEW.agt_document_status = 'N' AND NEW.agt_rejected_document_id IS NOT NULL THEN
    RAISE EXCEPTION 'DATA: documento normal não pode referenciar documento rejeitado AGT';
  END IF;

  IF NEW.agt_document_status = 'C' THEN
    IF NEW.agt_rejected_document_id IS NULL THEN
      RAISE EXCEPTION 'DATA: documento de correcção AGT exige agt_rejected_document_id';
    END IF;

    SELECT *
      INTO v_rejected
    FROM public.fiscal_documentos
    WHERE id = NEW.agt_rejected_document_id
    FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'DATA: documento rejeitado AGT não encontrado';
    END IF;

    IF v_rejected.id = NEW.id THEN
      RAISE EXCEPTION 'DATA: documento de correcção AGT não pode referenciar a si próprio';
    END IF;

    IF v_rejected.empresa_id IS DISTINCT FROM NEW.empresa_id THEN
      RAISE EXCEPTION 'DATA: documento rejeitado AGT pertence a outra empresa';
    END IF;

    IF v_rejected.tipo_documento IS DISTINCT FROM NEW.tipo_documento THEN
      RAISE EXCEPTION 'DATA: correcção de rejeição AGT deve manter o tipo do documento rejeitado';
    END IF;

    IF v_rejected.numero_formatado IS NOT DISTINCT FROM NEW.numero_formatado THEN
      RAISE EXCEPTION 'DATA: correcção AGT deve possuir novo número de documento';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.fiscal_agt_submission_documentos sd
      JOIN public.fiscal_agt_submissions s ON s.id = sd.submission_id
      WHERE sd.documento_id = v_rejected.id
        AND sd.validation_status = 'invalid'
        AND s.status = 'rejected'
        AND nullif(btrim(coalesce(s.request_id,'')),'') IS NOT NULL
    ) THEN
      RAISE EXCEPTION
        'STATE: documentStatus=C exige rejeição AGT diferida comprovada para o documento origem';
    END IF;
  END IF;

  IF NEW.tipo_documento = 'NC' THEN
    IF NEW.rectifica_documento_id IS NULL THEN
      RAISE EXCEPTION 'DATA: NC exige rectifica_documento_id';
    END IF;

    SELECT *
      INTO v_ref
    FROM public.fiscal_documentos
    WHERE id = NEW.rectifica_documento_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'DATA: documento base da NC não encontrado';
    END IF;

    IF v_ref.id = NEW.id OR v_ref.empresa_id IS DISTINCT FROM NEW.empresa_id THEN
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

    SELECT coalesce(sum(d.total_liquido_aoa),0)
      INTO v_prior_credit
    FROM public.fiscal_documentos d
    WHERE d.empresa_id = NEW.empresa_id
      AND d.tipo_documento = 'NC'
      AND d.rectifica_documento_id = v_ref.id
      AND d.id IS DISTINCT FROM NEW.id
      AND d.status IN ('pendente_assinatura','emitido','rectificado');

    IF round(v_prior_credit + NEW.total_liquido_aoa,2)
       > round(v_ref.total_liquido_aoa,2) THEN
      RAISE EXCEPTION
        'STATE: NC excede o montante líquido ainda não devolvido do documento base';
    END IF;
  END IF;

  IF NEW.tipo_documento = 'ND' THEN
    IF NEW.documento_origem_id IS NULL THEN
      RAISE EXCEPTION 'DATA: ND exige documento_origem_id';
    END IF;

    SELECT *
      INTO v_ref
    FROM public.fiscal_documentos
    WHERE id = NEW.documento_origem_id
    FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'DATA: documento base da ND não encontrado';
    END IF;

    IF v_ref.id = NEW.id OR v_ref.empresa_id IS DISTINCT FROM NEW.empresa_id THEN
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
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS fiscal_document_lifecycle_guard
  ON public.fiscal_documentos;

CREATE TRIGGER fiscal_document_lifecycle_guard
BEFORE INSERT OR UPDATE
ON public.fiscal_documentos
FOR EACH ROW
EXECUTE FUNCTION public.fiscal_validate_document_lifecycle();

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
  v_correcao public.fiscal_documentos%ROWTYPE;
  v_motivo text := nullif(btrim(coalesce(p_motivo,'')),'');
  v_correcao_id uuid;
  v_correcao_id_text text := nullif(
    btrim(coalesce(p_metadata->>'correction_document_id','')),
    ''
  );
  v_original_agt_rejected boolean := false;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH: utilizador não autenticado'; END IF;
  IF v_motivo IS NULL THEN RAISE EXCEPTION 'DATA: motivo é obrigatório'; END IF;
  IF v_correcao_id_text IS NULL THEN
    RAISE EXCEPTION
      'DATA: correction_document_id é obrigatório; rectificação exige novo documento correctivo';
  END IF;

  BEGIN
    v_correcao_id := v_correcao_id_text::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'DATA: correction_document_id inválido';
  END;

  SELECT * INTO v_documento
  FROM public.fiscal_documentos
  WHERE id = p_documento_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'DATA: documento fiscal não encontrado'; END IF;

  IF NOT public.user_has_role_in_empresa(
    v_documento.empresa_id, ARRAY['owner','admin','operator']
  ) THEN
    RAISE EXCEPTION 'AUTH: permissão negada para rectificar documento fiscal';
  END IF;

  IF v_documento.status <> 'emitido' THEN
    RAISE EXCEPTION 'STATE: apenas documento emitido pode ser rectificado';
  END IF;

  SELECT * INTO v_correcao
  FROM public.fiscal_documentos
  WHERE id = v_correcao_id
    AND empresa_id = v_documento.empresa_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'DATA: documento correctivo não encontrado'; END IF;
  IF v_correcao.status <> 'emitido' THEN
    RAISE EXCEPTION 'STATE: documento correctivo deve estar emitido';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.fiscal_agt_submission_documentos sd
    JOIN public.fiscal_agt_submissions s ON s.id=sd.submission_id
    WHERE sd.documento_id=v_documento.id
      AND sd.validation_status='invalid'
      AND s.status='rejected'
  ) INTO v_original_agt_rejected;

  IF v_original_agt_rejected THEN
    IF v_correcao.agt_document_status <> 'C'
       OR v_correcao.agt_rejected_document_id IS DISTINCT FROM v_documento.id THEN
      RAISE EXCEPTION
        'STATE: documento rejeitado pela AGT só pode ser rectificado por novo documento documentStatus=C';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.fiscal_agt_submission_documentos sd
      JOIN public.fiscal_agt_submissions s ON s.id=sd.submission_id
      WHERE sd.documento_id=v_correcao.id
        AND sd.validation_status='valid'
        AND s.status='accepted'
    ) THEN
      RAISE EXCEPTION
        'STATE: correcção de documento rejeitado só fecha após validação AGT do novo documento';
    END IF;
  ELSE
    IF NOT (
      (v_correcao.tipo_documento='NC'
        AND v_correcao.rectifica_documento_id=v_documento.id)
      OR
      (v_correcao.tipo_documento='ND'
        AND v_correcao.documento_origem_id=v_documento.id)
    ) THEN
      RAISE EXCEPTION
        'STATE: rectificação exige NC/ND emitida e referenciada ao documento original';
    END IF;
  END IF;

  UPDATE public.fiscal_documentos
  SET status='rectificado'
  WHERE id=v_documento.id;

  INSERT INTO public.fiscal_documentos_eventos (
    empresa_id,documento_id,tipo_evento,payload,created_by
  ) VALUES (
    v_documento.empresa_id,
    v_documento.id,
    'RECTIFICADO',
    jsonb_build_object(
      'motivo',v_motivo,
      'status_anterior',v_documento.status,
      'status_novo','rectificado',
      'numero_formatado',v_documento.numero_formatado,
      'correction_document_id',v_correcao.id,
      'correction_document_no',v_correcao.numero_formatado,
      'correction_document_type',v_correcao.tipo_documento,
      'metadata',coalesce(p_metadata,'{}'::jsonb)
    ),
    v_uid
  );

  RETURN jsonb_build_object(
    'ok',true,'documento_id',v_documento.id,'empresa_id',v_documento.empresa_id,
    'status','rectificado','correction_document_id',v_correcao.id
  );
END;
$function$;

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
  v_motivo text := nullif(btrim(coalesce(p_motivo,'')),'');
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH: utilizador não autenticado'; END IF;
  IF v_motivo IS NULL THEN RAISE EXCEPTION 'DATA: motivo é obrigatório'; END IF;

  SELECT * INTO v_documento
  FROM public.fiscal_documentos
  WHERE id=p_documento_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'DATA: documento fiscal não encontrado'; END IF;

  IF NOT public.user_has_role_in_empresa(
    v_documento.empresa_id, ARRAY['owner','admin','operator']
  ) THEN
    RAISE EXCEPTION 'AUTH: permissão negada para anular documento fiscal';
  END IF;

  IF v_documento.status <> 'emitido' THEN
    RAISE EXCEPTION 'STATE: apenas documento emitido pode ser anulado';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.fiscal_agt_submission_documentos sd
    JOIN public.fiscal_agt_submissions s ON s.id=sd.submission_id
    WHERE sd.documento_id=v_documento.id
      AND s.status IN (
        'prepared','submitting','submitted','processing','uncertain','accepted'
      )
  ) THEN
    RAISE EXCEPTION
      'STATE: documento comunicado à AGT exige fluxo electrónico de anulação antes da anulação local';
  END IF;

  UPDATE public.fiscal_documentos
  SET status='anulado'
  WHERE id=v_documento.id;

  INSERT INTO public.fiscal_documentos_eventos (
    empresa_id,documento_id,tipo_evento,payload,created_by
  ) VALUES (
    v_documento.empresa_id,v_documento.id,'ANULADO',
    jsonb_build_object(
      'motivo',v_motivo,'status_anterior',v_documento.status,
      'status_novo','anulado','numero_formatado',v_documento.numero_formatado,
      'metadata',coalesce(p_metadata,'{}'::jsonb)
    ),
    v_uid
  );

  RETURN jsonb_build_object(
    'ok',true,'documento_id',v_documento.id,
    'empresa_id',v_documento.empresa_id,'status','anulado'
  );
END;
$function$;

COMMENT ON COLUMN public.fiscal_documentos.agt_document_status IS
  'AGT documentStatus: N normal; C correction of a document previously rejected by AGT.';
COMMENT ON COLUMN public.fiscal_documentos.agt_rejected_document_id IS
  'Canonical reference to the KLASSE fiscal document proven invalid/rejected by AGT when documentStatus=C.';
COMMENT ON COLUMN public.fiscal_documentos.reference_reason IS
  'Reason for intervention on the referenced fiscal document; max 60 characters for AGT referenceInfo.reason.';

REVOKE ALL ON FUNCTION public.fiscal_rectificar_documento(uuid,text,jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fiscal_anular_documento(uuid,text,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fiscal_rectificar_documento(uuid,text,jsonb)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.fiscal_anular_documento(uuid,text,jsonb)
  TO service_role;
