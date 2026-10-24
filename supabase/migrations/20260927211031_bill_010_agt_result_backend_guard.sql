CREATE OR REPLACE FUNCTION public.fiscal_agt_record_document_result(
  p_submission_id uuid,
  p_document_no text,
  p_validation_status text,
  p_error_list jsonb DEFAULT '[]'::jsonb,
  p_source text DEFAULT 'obterEstado'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog','public'
AS $function$
DECLARE
  v_claim_role text := coalesce(current_setting('request.jwt.claim.role',true),'');
  v_status text := lower(btrim(coalesce(p_validation_status,'')));
  v_link public.fiscal_agt_submission_documentos%ROWTYPE;
  v_event_type text;
  v_idempotent boolean := false;
BEGIN
  IF v_claim_role <> 'service_role' AND session_user <> 'postgres' THEN
    RAISE EXCEPTION 'AUTH: resultado AGT é exclusivo do backend fiscal';
  END IF;

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
