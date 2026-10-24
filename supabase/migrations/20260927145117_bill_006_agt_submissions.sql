BEGIN;

CREATE TABLE IF NOT EXISTS public.fiscal_agt_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.fiscal_empresas(id) ON DELETE RESTRICT,
  submission_uuid uuid NOT NULL UNIQUE,
  request_id text NULL,
  status text NOT NULL DEFAULT 'prepared',
  result_code integer NULL,
  document_count integer NOT NULL DEFAULT 1,
  request_payload jsonb NULL,
  response_payload jsonb NULL,
  status_response_payload jsonb NULL,
  error_code text NULL,
  error_message text NULL,
  attempt_count integer NOT NULL DEFAULT 0,
  poll_count integer NOT NULL DEFAULT 0,
  submitted_at timestamptz NULL,
  completed_at timestamptz NULL,
  next_check_at timestamptz NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fiscal_agt_submissions_status_chk CHECK (
    status IN ('prepared','submitting','submitted','processing','accepted','partial','rejected','cancelled','uncertain','mapping_error')
  ),
  CONSTRAINT fiscal_agt_submissions_result_code_chk CHECK (
    result_code IS NULL OR result_code IN (0,1,2,7,8,9)
  ),
  CONSTRAINT fiscal_agt_submissions_document_count_chk CHECK (document_count BETWEEN 1 AND 30),
  CONSTRAINT fiscal_agt_submissions_request_id_chk CHECK (
    request_id IS NULL OR char_length(request_id) BETWEEN 1 AND 15
  ),
  CONSTRAINT fiscal_agt_submissions_attempt_count_chk CHECK (attempt_count >= 0),
  CONSTRAINT fiscal_agt_submissions_poll_count_chk CHECK (poll_count >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_fiscal_agt_submissions_request_id
  ON public.fiscal_agt_submissions(request_id)
  WHERE request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fiscal_agt_submissions_empresa_status
  ON public.fiscal_agt_submissions(empresa_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fiscal_agt_submissions_next_check
  ON public.fiscal_agt_submissions(next_check_at)
  WHERE status IN ('submitted','processing','uncertain');

CREATE TABLE IF NOT EXISTS public.fiscal_agt_submission_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.fiscal_empresas(id) ON DELETE RESTRICT,
  submission_id uuid NOT NULL REFERENCES public.fiscal_agt_submissions(id) ON DELETE RESTRICT,
  documento_id uuid NOT NULL REFERENCES public.fiscal_documentos(id) ON DELETE RESTRICT,
  document_no text NOT NULL,
  validation_status text NOT NULL DEFAULT 'pending',
  error_list jsonb NOT NULL DEFAULT '[]'::jsonb,
  validated_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fiscal_agt_submission_documentos_status_chk CHECK (
    validation_status IN ('pending','valid','invalid')
  ),
  CONSTRAINT fiscal_agt_submission_documentos_submission_doc_uk UNIQUE (submission_id, documento_id),
  CONSTRAINT fiscal_agt_submission_documentos_documento_uk UNIQUE (documento_id)
);

CREATE INDEX IF NOT EXISTS idx_fiscal_agt_submission_documentos_submission
  ON public.fiscal_agt_submission_documentos(submission_id);

ALTER TABLE public.fiscal_agt_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_agt_submission_documentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fiscal_agt_submissions_select ON public.fiscal_agt_submissions;
CREATE POLICY fiscal_agt_submissions_select
ON public.fiscal_agt_submissions
FOR SELECT TO authenticated
USING (
  public.check_super_admin_role()
  OR public.user_has_role_in_empresa(
    empresa_id,
    ARRAY['owner','admin','operator']::text[]
  )
);

DROP POLICY IF EXISTS fiscal_agt_submission_documentos_select
ON public.fiscal_agt_submission_documentos;
CREATE POLICY fiscal_agt_submission_documentos_select
ON public.fiscal_agt_submission_documentos
FOR SELECT TO authenticated
USING (
  public.check_super_admin_role()
  OR public.user_has_role_in_empresa(
    empresa_id,
    ARRAY['owner','admin','operator']::text[]
  )
);

REVOKE ALL ON TABLE public.fiscal_agt_submissions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.fiscal_agt_submission_documentos FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.fiscal_agt_submissions TO authenticated;
GRANT SELECT ON TABLE public.fiscal_agt_submission_documentos TO authenticated;

REVOKE ALL ON TABLE public.fiscal_agt_submissions FROM service_role;
REVOKE ALL ON TABLE public.fiscal_agt_submission_documentos FROM service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.fiscal_agt_submissions TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.fiscal_agt_submission_documentos TO service_role;

DROP TRIGGER IF EXISTS trg_fiscal_agt_submissions_updated_at
ON public.fiscal_agt_submissions;
CREATE TRIGGER trg_fiscal_agt_submissions_updated_at
BEFORE UPDATE ON public.fiscal_agt_submissions
FOR EACH ROW EXECUTE FUNCTION public.fiscal_touch_updated_at();

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

  IF v_doc.tipo_documento NOT IN ('FT','FR','FG','GF','NC','ND') THEN
    RAISE EXCEPTION 'STATE: tipo de documento ainda não suportado pelo mapper AGT';
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
    empresa_id,
    submission_uuid,
    status,
    document_count,
    created_by
  )
  VALUES (
    v_doc.empresa_id,
    gen_random_uuid(),
    'prepared',
    1,
    p_created_by
  )
  RETURNING * INTO v_submission;

  INSERT INTO public.fiscal_agt_submission_documentos (
    empresa_id,
    submission_id,
    documento_id,
    document_no
  )
  VALUES (
    v_doc.empresa_id,
    v_submission.id,
    v_doc.id,
    v_doc.numero_formatado
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

COMMIT;
