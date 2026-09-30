BEGIN;
CREATE OR REPLACE FUNCTION public.fiscal_preparar_assinatura_saft(p_documento_id uuid, p_hash_control_version integer)
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
    IF NOT v_anterior.saft_required THEN
      RAISE EXCEPTION
        'STATE: série contém documento anterior fora da cadeia SAF-T validada; active o software validado numa nova série';
    END IF;

    IF v_anterior.status='pendente_assinatura'
       OR nullif(trim(coalesce(v_anterior.saft_hash,'')),'') IS NULL THEN
      RAISE EXCEPTION
        'STATE: documento anterior da série ainda não possui assinatura SAF-T finalizada';
    END IF;

    v_hash_anterior := v_anterior.saft_hash;
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
REVOKE EXECUTE ON FUNCTION public.fiscal_preparar_assinatura_saft(uuid,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fiscal_preparar_assinatura_saft(uuid,integer) TO service_role;
COMMIT;