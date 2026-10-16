BEGIN;

ALTER TABLE public.fiscal_documentos
  ADD COLUMN IF NOT EXISTS saft_required boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.fiscal_prevent_update_emitido()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public', 'auth', 'extensions'
AS $function$
BEGIN
  IF OLD.status IN ('rectificado', 'anulado') THEN
    RAISE EXCEPTION 'IMMUTABILITY: documento fiscal fechado não pode ser alterado';
  END IF;

  IF OLD.status = 'emitido' THEN
    IF (to_jsonb(NEW) - ARRAY['status']::text[])
       IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['status']::text[])
    THEN
      RAISE EXCEPTION 'IMMUTABILITY: apenas transição de status é permitida para documento emitido';
    END IF;

    IF NEW.status NOT IN ('rectificado', 'anulado') THEN
      RAISE EXCEPTION 'IMMUTABILITY: documento emitido só pode transitar para rectificado ou anulado';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = 'pendente_assinatura' THEN
    IF (
      to_jsonb(NEW) -
      ARRAY[
        'assinatura_base64','hash_control','canonical_string',
        'saft_hash','saft_hash_control','saft_hash_anterior',
        'saft_canonical_string','saft_required','status'
      ]::text[]
    ) IS DISTINCT FROM (
      to_jsonb(OLD) -
      ARRAY[
        'assinatura_base64','hash_control','canonical_string',
        'saft_hash','saft_hash_control','saft_hash_anterior',
        'saft_canonical_string','saft_required','status'
      ]::text[]
    ) THEN
      RAISE EXCEPTION 'IMMUTABILITY: documento pendente só pode receber assinaturas e finalizar emissão';
    END IF;

    IF NEW.status NOT IN ('pendente_assinatura', 'emitido') THEN
      RAISE EXCEPTION 'IMMUTABILITY: documento pendente só pode transitar para emitido';
    END IF;

    IF NEW.status = 'emitido' AND (
      nullif(trim(coalesce(NEW.assinatura_base64, '')), '') IS NULL
      OR nullif(trim(coalesce(NEW.hash_control, '')), '') IS NULL
      OR nullif(trim(coalesce(NEW.canonical_string, '')), '') IS NULL
    ) THEN
      RAISE EXCEPTION 'IMMUTABILITY: documento não pode ser emitido sem assinatura, hash e canonical string';
    END IF;

    IF NEW.status = 'emitido'
       AND NEW.saft_required
       AND (
         nullif(trim(coalesce(NEW.saft_hash, '')), '') IS NULL
         OR NEW.saft_hash_control IS NULL
         OR nullif(trim(coalesce(NEW.saft_canonical_string, '')), '') IS NULL
       ) THEN
      RAISE EXCEPTION 'IMMUTABILITY: documento SAF-T v2 não pode ser emitido sem assinatura SAF-T';
    END IF;

    RETURN NEW;
  END IF;

  IF to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) THEN
    RAISE EXCEPTION 'IMMUTABILITY: estado fiscal não permite alteração';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fiscal_preparar_assinatura_saft(
  p_documento_id uuid,
  p_hash_control_version integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_claim_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
  v_documento public.fiscal_documentos%ROWTYPE;
  v_anterior public.fiscal_documentos%ROWTYPE;
  v_hash_anterior text := '';
  v_canonical text;
  v_system_entry text;
  v_gross text;
BEGIN
  IF v_claim_role <> 'service_role' AND session_user <> 'postgres' THEN
    RAISE EXCEPTION 'AUTH: preparação de assinatura SAF-T é exclusiva do backend fiscal';
  END IF;
  IF p_hash_control_version IS NULL OR p_hash_control_version <= 0 THEN
    RAISE EXCEPTION 'DATA: versão da chave SAF-T deve ser inteiro positivo';
  END IF;

  SELECT * INTO v_documento
  FROM public.fiscal_documentos
  WHERE id=p_documento_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'DATA: documento fiscal não encontrado'; END IF;
  IF v_documento.status <> 'pendente_assinatura' THEN
    RAISE EXCEPTION 'STATE: documento não está pendente de assinatura';
  END IF;

  PERFORM 1 FROM public.fiscal_series WHERE id=v_documento.serie_id FOR UPDATE;

  IF v_documento.saft_canonical_string IS NOT NULL THEN
    IF v_documento.saft_hash_control IS DISTINCT FROM p_hash_control_version THEN
      RAISE EXCEPTION 'STATE: documento já preparado com outra versão de chave SAF-T';
    END IF;
    IF NOT v_documento.saft_required THEN
      UPDATE public.fiscal_documentos SET saft_required=true WHERE id=v_documento.id;
    END IF;
    RETURN jsonb_build_object(
      'ok',true,'idempotent',true,'documento_id',v_documento.id,
      'saft_canonical_string',v_documento.saft_canonical_string,
      'saft_hash_control',v_documento.saft_hash_control,
      'saft_hash_anterior',coalesce(v_documento.saft_hash_anterior,'')
    );
  END IF;

  SELECT * INTO v_anterior
  FROM public.fiscal_documentos
  WHERE serie_id=v_documento.serie_id
    AND numero<v_documento.numero
  ORDER BY numero DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF v_anterior.saft_required
       AND (v_anterior.status='pendente_assinatura'
            OR nullif(trim(coalesce(v_anterior.saft_hash,'')),'') IS NULL) THEN
      RAISE EXCEPTION 'STATE: documento anterior da série ainda não possui assinatura SAF-T finalizada';
    END IF;

    -- Durante o rollout, documentos históricos não-SAF-T não entram na cadeia nova.
    IF v_anterior.saft_required THEN
      v_hash_anterior := coalesce(v_anterior.saft_hash,'');
    END IF;
  END IF;

  v_system_entry := to_char(v_documento.system_entry AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS');
  v_gross := to_char(round(v_documento.total_bruto_aoa,2),'FM999999999999999990.00');
  v_canonical :=
    to_char(v_documento.invoice_date,'YYYY-MM-DD') || ';' ||
    v_system_entry || ';' ||
    v_documento.numero_formatado || ';' ||
    v_gross || ';' ||
    v_hash_anterior;

  IF position(E'\n' IN v_canonical)>0 OR position(E'\r' IN v_canonical)>0 THEN
    RAISE EXCEPTION 'DATA: canonical SAF-T contém quebra de linha';
  END IF;

  UPDATE public.fiscal_documentos
  SET saft_required=true,
      saft_hash_control=p_hash_control_version,
      saft_hash_anterior=nullif(v_hash_anterior,''),
      saft_canonical_string=v_canonical
  WHERE id=v_documento.id;

  RETURN jsonb_build_object(
    'ok',true,'idempotent',false,'documento_id',v_documento.id,
    'saft_canonical_string',v_canonical,
    'saft_hash_control',p_hash_control_version,
    'saft_hash_anterior',v_hash_anterior
  );
END;
$function$;

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
AS $function$
DECLARE
  v_uid uuid := public.safe_auth_uid();
  v_claim_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
  v_documento public.fiscal_documentos%ROWTYPE;
  v_event_user uuid;
BEGIN
  IF v_claim_role <> 'service_role' AND session_user <> 'postgres' THEN
    RAISE EXCEPTION 'AUTH: finalização de assinatura é exclusiva do backend fiscal';
  END IF;

  SELECT * INTO v_documento
  FROM public.fiscal_documentos
  WHERE id=p_documento_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'DATA: documento fiscal não encontrado'; END IF;
  IF v_documento.status <> 'pendente_assinatura' THEN
    RAISE EXCEPTION 'STATE: documento não está pendente de assinatura';
  END IF;

  IF nullif(trim(coalesce(p_assinatura_base64,'')),'') IS NULL
     OR nullif(trim(coalesce(p_hash_control,'')),'') IS NULL
     OR nullif(trim(coalesce(p_canonical_string,'')),'') IS NULL THEN
    RAISE EXCEPTION 'DATA: assinatura, hash e canonical string são obrigatórios';
  END IF;

  IF p_hash_control IS DISTINCT FROM v_documento.hash_control
     OR p_canonical_string IS DISTINCT FROM v_documento.canonical_string THEN
    RAISE EXCEPTION 'DATA: hash/canonical divergentes do documento pendente';
  END IF;

  IF v_documento.saft_required AND (
       nullif(trim(coalesce(v_documento.saft_hash,'')),'') IS NULL
       OR v_documento.saft_hash_control IS NULL
       OR nullif(trim(coalesce(v_documento.saft_canonical_string,'')),'') IS NULL
     ) THEN
    RAISE EXCEPTION 'STATE: assinatura SAF-T deve ser finalizada antes da emissão';
  END IF;

  v_event_user := coalesce(v_uid,v_documento.created_by);

  UPDATE public.fiscal_documentos
  SET assinatura_base64=p_assinatura_base64,status='emitido'
  WHERE id=p_documento_id;

  INSERT INTO public.fiscal_documentos_eventos(
    empresa_id,documento_id,tipo_evento,payload,created_by
  ) VALUES (
    v_documento.empresa_id,v_documento.id,'EMITIDO',
    jsonb_build_object(
      'hash_control',v_documento.hash_control,
      'hash_anterior',v_documento.hash_anterior,
      'saft_required',v_documento.saft_required,
      'saft_hash_control',v_documento.saft_hash_control,
      'numero_formatado',v_documento.numero_formatado
    ),
    v_event_user
  );

  RETURN jsonb_build_object(
    'ok',true,'documento_id',v_documento.id,'numero',v_documento.numero,
    'numero_formatado',v_documento.numero_formatado,
    'hash_control',v_documento.hash_control,'key_version',v_documento.key_version,
    'saft_hash_control',v_documento.saft_hash_control,'status','emitido'
  );
END;
$function$;

COMMIT;