BEGIN;

CREATE OR REPLACE FUNCTION public.fiscal_prevent_update_emitido()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status IN ('rectificado', 'anulado') THEN
    RAISE EXCEPTION 'IMMUTABILITY: documento fiscal fechado não pode ser alterado';
  END IF;

  IF OLD.status = 'emitido' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.empresa_id IS DISTINCT FROM OLD.empresa_id
      OR NEW.serie_id IS DISTINCT FROM OLD.serie_id
      OR NEW.tipo_documento IS DISTINCT FROM OLD.tipo_documento
      OR NEW.numero IS DISTINCT FROM OLD.numero
      OR NEW.numero_formatado IS DISTINCT FROM OLD.numero_formatado
      OR NEW.cliente_id IS DISTINCT FROM OLD.cliente_id
      OR NEW.cliente_nome IS DISTINCT FROM OLD.cliente_nome
      OR NEW.cliente_nif IS DISTINCT FROM OLD.cliente_nif
      OR NEW.invoice_date IS DISTINCT FROM OLD.invoice_date
      OR NEW.system_entry IS DISTINCT FROM OLD.system_entry
      OR NEW.moeda IS DISTINCT FROM OLD.moeda
      OR NEW.taxa_cambio_aoa IS DISTINCT FROM OLD.taxa_cambio_aoa
      OR NEW.total_bruto_aoa IS DISTINCT FROM OLD.total_bruto_aoa
      OR NEW.total_impostos_aoa IS DISTINCT FROM OLD.total_impostos_aoa
      OR NEW.total_liquido_aoa IS DISTINCT FROM OLD.total_liquido_aoa
      OR NEW.hash_anterior IS DISTINCT FROM OLD.hash_anterior
      OR NEW.assinatura_base64 IS DISTINCT FROM OLD.assinatura_base64
      OR NEW.hash_control IS DISTINCT FROM OLD.hash_control
      OR NEW.canonical_string IS DISTINCT FROM OLD.canonical_string
      OR NEW.key_version IS DISTINCT FROM OLD.key_version
      OR NEW.documento_origem_id IS DISTINCT FROM OLD.documento_origem_id
      OR NEW.rectifica_documento_id IS DISTINCT FROM OLD.rectifica_documento_id
      OR NEW.payload IS DISTINCT FROM OLD.payload
      OR NEW.pdf_storage_path IS DISTINCT FROM OLD.pdf_storage_path
      OR NEW.xml_storage_path IS DISTINCT FROM OLD.xml_storage_path
      OR NEW.created_by IS DISTINCT FROM OLD.created_by
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'IMMUTABILITY: apenas transição de status é permitida para documento emitido';
    END IF;

    IF NEW.status NOT IN ('rectificado', 'anulado') THEN
      RAISE EXCEPTION 'IMMUTABILITY: documento emitido só pode transitar para rectificado ou anulado';
    END IF;
  END IF;

  IF OLD.status = 'pendente_assinatura' AND NEW.status NOT IN ('pendente_assinatura', 'emitido') THEN
    RAISE EXCEPTION 'IMMUTABILITY: documento pendente só pode transitar para emitido';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fiscal_rectificar_documento(
  p_documento_id uuid,
  p_motivo text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public.safe_auth_uid();
  v_documento public.fiscal_documentos%ROWTYPE;
  v_motivo text := nullif(trim(p_motivo), '');
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
  WHERE id = p_documento_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DATA: documento fiscal não encontrado';
  END IF;

  IF NOT public.user_has_role_in_empresa(v_documento.empresa_id, ARRAY['owner','admin','operator']) THEN
    RAISE EXCEPTION 'AUTH: permissão negada para rectificar documento fiscal';
  END IF;

  IF v_documento.status <> 'emitido' THEN
    RAISE EXCEPTION 'STATE: apenas documento emitido pode ser rectificado';
  END IF;

  UPDATE public.fiscal_documentos
     SET status = 'rectificado'
   WHERE id = p_documento_id;

  INSERT INTO public.fiscal_documentos_eventos (
    empresa_id,
    documento_id,
    tipo_evento,
    payload,
    created_by
  )
  VALUES (
    v_documento.empresa_id,
    v_documento.id,
    'RECTIFICADO',
    jsonb_build_object(
      'motivo', v_motivo,
      'status_anterior', v_documento.status,
      'status_novo', 'rectificado',
      'numero_formatado', v_documento.numero_formatado,
      'metadata', coalesce(p_metadata, '{}'::jsonb)
    ),
    v_uid
  );

  RETURN jsonb_build_object(
    'ok', true,
    'documento_id', v_documento.id,
    'empresa_id', v_documento.empresa_id,
    'status', 'rectificado'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.fiscal_anular_documento(
  p_documento_id uuid,
  p_motivo text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public.safe_auth_uid();
  v_documento public.fiscal_documentos%ROWTYPE;
  v_motivo text := nullif(trim(p_motivo), '');
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
  WHERE id = p_documento_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DATA: documento fiscal não encontrado';
  END IF;

  IF NOT public.user_has_role_in_empresa(v_documento.empresa_id, ARRAY['owner','admin','operator']) THEN
    RAISE EXCEPTION 'AUTH: permissão negada para anular documento fiscal';
  END IF;

  IF v_documento.status <> 'emitido' THEN
    RAISE EXCEPTION 'STATE: apenas documento emitido pode ser anulado';
  END IF;

  UPDATE public.fiscal_documentos
     SET status = 'anulado'
   WHERE id = p_documento_id;

  INSERT INTO public.fiscal_documentos_eventos (
    empresa_id,
    documento_id,
    tipo_evento,
    payload,
    created_by
  )
  VALUES (
    v_documento.empresa_id,
    v_documento.id,
    'ANULADO',
    jsonb_build_object(
      'motivo', v_motivo,
      'status_anterior', v_documento.status,
      'status_novo', 'anulado',
      'numero_formatado', v_documento.numero_formatado,
      'metadata', coalesce(p_metadata, '{}'::jsonb)
    ),
    v_uid
  );

  RETURN jsonb_build_object(
    'ok', true,
    'documento_id', v_documento.id,
    'empresa_id', v_documento.empresa_id,
    'status', 'anulado'
  );
END;
$$;

ALTER FUNCTION public.fiscal_rectificar_documento(uuid, text, jsonb) OWNER TO postgres;
ALTER FUNCTION public.fiscal_anular_documento(uuid, text, jsonb) OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.fiscal_rectificar_documento(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fiscal_anular_documento(uuid, text, jsonb) TO authenticated;

COMMIT;
