BEGIN;

CREATE OR REPLACE FUNCTION public.fiscal_agt_prepare_submission(
  p_documento_id uuid,
  p_created_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $bill$
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

  IF v_doc.tipo_documento NOT IN ('FT','FR','FG','GF','NC','ND','RC') THEN
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
$bill$;

REVOKE EXECUTE ON FUNCTION public.fiscal_agt_prepare_submission(uuid,uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fiscal_agt_prepare_submission(uuid,uuid)
TO service_role;

CREATE OR REPLACE FUNCTION public.fiscal_agt_auto_prepare_on_emit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $bill$
DECLARE
  v_submission_id uuid;
BEGIN
  IF NEW.status <> 'emitido'
     OR OLD.status IS NOT DISTINCT FROM NEW.status
     OR NEW.tipo_documento NOT IN ('FT','FR','FG','GF','NC','ND','RC') THEN
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
$bill$;

REVOKE EXECUTE ON FUNCTION public.fiscal_agt_auto_prepare_on_emit()
FROM PUBLIC, anon, authenticated, service_role;

COMMIT;