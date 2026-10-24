BEGIN;

CREATE TABLE IF NOT EXISTS public.fiscal_agt_submission_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.fiscal_empresas(id) ON DELETE RESTRICT,
  submission_id uuid NOT NULL REFERENCES public.fiscal_agt_submissions(id) ON DELETE RESTRICT,
  status_anterior text NULL,
  status_novo text NOT NULL,
  request_id text NULL,
  result_code integer NULL,
  error_code text NULL,
  error_message text NULL,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fiscal_agt_submission_eventos_submission
  ON public.fiscal_agt_submission_eventos(submission_id, created_at, id);

ALTER TABLE public.fiscal_agt_submission_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fiscal_agt_submission_eventos_select
ON public.fiscal_agt_submission_eventos;

CREATE POLICY fiscal_agt_submission_eventos_select
ON public.fiscal_agt_submission_eventos
FOR SELECT TO authenticated
USING (
  public.check_super_admin_role()
  OR public.user_has_role_in_empresa(
    empresa_id,
    ARRAY['owner','admin','operator']::text[]
  )
);

REVOKE ALL ON TABLE public.fiscal_agt_submission_eventos
FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.fiscal_agt_submission_eventos TO authenticated;
GRANT SELECT ON TABLE public.fiscal_agt_submission_eventos TO service_role;

CREATE OR REPLACE FUNCTION public.fiscal_agt_capture_submission_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $bill$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.fiscal_agt_submission_eventos (
      empresa_id, submission_id, status_anterior, status_novo, request_id,
      result_code, error_code, error_message, snapshot
    )
    VALUES (
      NEW.empresa_id, NEW.id, NULL, NEW.status, NEW.request_id,
      NEW.result_code, NEW.error_code, NEW.error_message,
      jsonb_build_object(
        'submission_uuid', NEW.submission_uuid,
        'attempt_count', NEW.attempt_count,
        'poll_count', NEW.poll_count,
        'submitted_at', NEW.submitted_at,
        'completed_at', NEW.completed_at,
        'next_check_at', NEW.next_check_at
      )
    );
    RETURN NEW;
  END IF;

  IF ROW(
    OLD.status, OLD.request_id, OLD.result_code, OLD.error_code,
    OLD.error_message, OLD.attempt_count, OLD.poll_count,
    OLD.submitted_at, OLD.completed_at, OLD.next_check_at
  ) IS DISTINCT FROM ROW(
    NEW.status, NEW.request_id, NEW.result_code, NEW.error_code,
    NEW.error_message, NEW.attempt_count, NEW.poll_count,
    NEW.submitted_at, NEW.completed_at, NEW.next_check_at
  ) THEN
    INSERT INTO public.fiscal_agt_submission_eventos (
      empresa_id, submission_id, status_anterior, status_novo, request_id,
      result_code, error_code, error_message, snapshot
    )
    VALUES (
      NEW.empresa_id, NEW.id, OLD.status, NEW.status, NEW.request_id,
      NEW.result_code, NEW.error_code, NEW.error_message,
      jsonb_build_object(
        'submission_uuid', NEW.submission_uuid,
        'attempt_count', NEW.attempt_count,
        'poll_count', NEW.poll_count,
        'submitted_at', NEW.submitted_at,
        'completed_at', NEW.completed_at,
        'next_check_at', NEW.next_check_at
      )
    );
  END IF;

  RETURN NEW;
END;
$bill$;

DROP TRIGGER IF EXISTS trg_fiscal_agt_submission_event
ON public.fiscal_agt_submissions;

CREATE TRIGGER trg_fiscal_agt_submission_event
AFTER INSERT OR UPDATE ON public.fiscal_agt_submissions
FOR EACH ROW EXECUTE FUNCTION public.fiscal_agt_capture_submission_event();

REVOKE EXECUTE ON FUNCTION public.fiscal_agt_capture_submission_event()
FROM PUBLIC, anon, authenticated, service_role;

COMMIT;