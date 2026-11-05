BEGIN;

-- BILL-003: number reservation is internal to the authoritative emission RPC.
REVOKE EXECUTE ON FUNCTION public.fiscal_reservar_numero_serie(uuid)
FROM PUBLIC, anon, authenticated, service_role;

-- BILL-004: a document must always be inserted as pending signature.
-- This blocks direct callers from marking a document emitted by supplying
-- arbitrary p_assinatura_base64 to fiscal_emitir_documento.
CREATE OR REPLACE FUNCTION public.fiscal_require_pending_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog','public'
AS $bill$
BEGIN
  IF NEW.status IS DISTINCT FROM 'pendente_assinatura' THEN
    RAISE EXCEPTION 'IMMUTABILITY: novo documento fiscal deve iniciar em pendente_assinatura';
  END IF;
  RETURN NEW;
END;
$bill$;

DROP TRIGGER IF EXISTS trg_fiscal_documentos_require_pending_insert
ON public.fiscal_documentos;

CREATE TRIGGER trg_fiscal_documentos_require_pending_insert
BEFORE INSERT ON public.fiscal_documentos
FOR EACH ROW EXECUTE FUNCTION public.fiscal_require_pending_on_insert();

-- Signature finalization is backend-only. The KMS-signed result is finalized
-- through service_role after the human request was authorized by the API route.
REVOKE EXECUTE ON FUNCTION public.fiscal_finalizar_assinatura(uuid,text,text,text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fiscal_finalizar_assinatura(uuid,text,text,text)
TO service_role;

CREATE OR REPLACE FUNCTION public.fiscal_finalizar_assinatura(
  p_documento_id uuid,
  p_assinatura_base64 text,
  p_hash_control text,
  p_canonical_string text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $bill$
DECLARE
  v_uid uuid := public.safe_auth_uid();
  v_claim_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
  v_documento public.fiscal_documentos%ROWTYPE;
  v_event_user uuid;
BEGIN
  IF v_claim_role <> 'service_role' AND session_user <> 'postgres' THEN
    RAISE EXCEPTION 'AUTH: finalização de assinatura é exclusiva do backend fiscal';
  END IF;

  SELECT *
    INTO v_documento
  FROM public.fiscal_documentos
  WHERE id = p_documento_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DATA: documento fiscal não encontrado';
  END IF;

  IF v_documento.status <> 'pendente_assinatura' THEN
    RAISE EXCEPTION 'STATE: documento não está pendente de assinatura';
  END IF;

  IF nullif(trim(coalesce(p_assinatura_base64, '')), '') IS NULL
     OR nullif(trim(coalesce(p_hash_control, '')), '') IS NULL
     OR nullif(trim(coalesce(p_canonical_string, '')), '') IS NULL THEN
    RAISE EXCEPTION 'DATA: assinatura, hash e canonical string são obrigatórios';
  END IF;

  IF p_hash_control IS DISTINCT FROM v_documento.hash_control
     OR p_canonical_string IS DISTINCT FROM v_documento.canonical_string THEN
    RAISE EXCEPTION 'DATA: hash/canonical divergentes do documento pendente';
  END IF;

  v_event_user := coalesce(v_uid, v_documento.created_by);

  UPDATE public.fiscal_documentos
     SET assinatura_base64 = p_assinatura_base64,
         status = 'emitido'
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
    'EMITIDO',
    jsonb_build_object(
      'hash_control', v_documento.hash_control,
      'hash_anterior', v_documento.hash_anterior,
      'numero_formatado', v_documento.numero_formatado
    ),
    v_event_user
  );

  RETURN jsonb_build_object(
    'ok', true,
    'documento_id', v_documento.id,
    'numero', v_documento.numero,
    'numero_formatado', v_documento.numero_formatado,
    'hash_control', v_documento.hash_control,
    'key_version', v_documento.key_version,
    'status', 'emitido'
  );
END;
$bill$;

COMMIT;
