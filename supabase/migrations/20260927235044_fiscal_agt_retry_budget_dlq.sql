
ALTER TABLE public.fiscal_agt_submissions
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS max_poll_count integer NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS dead_lettered_at timestamptz;

ALTER TABLE public.fiscal_agt_submissions
  DROP CONSTRAINT IF EXISTS fiscal_agt_submissions_max_attempts_chk;
ALTER TABLE public.fiscal_agt_submissions
  ADD CONSTRAINT fiscal_agt_submissions_max_attempts_chk
  CHECK (max_attempts BETWEEN 1 AND 50);

ALTER TABLE public.fiscal_agt_submissions
  DROP CONSTRAINT IF EXISTS fiscal_agt_submissions_max_poll_count_chk;
ALTER TABLE public.fiscal_agt_submissions
  ADD CONSTRAINT fiscal_agt_submissions_max_poll_count_chk
  CHECK (max_poll_count BETWEEN 1 AND 500);

CREATE TABLE IF NOT EXISTS public.fiscal_agt_dead_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.fiscal_empresas(id) ON DELETE RESTRICT,
  submission_id uuid NOT NULL REFERENCES public.fiscal_agt_submissions(id) ON DELETE RESTRICT,
  submission_uuid uuid NOT NULL,
  request_id text,
  attempt_count integer NOT NULL,
  poll_count integer NOT NULL,
  reason_code text NOT NULL,
  reason_message text,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(submission_id,attempt_count,poll_count,reason_code)
);

CREATE INDEX IF NOT EXISTS idx_fiscal_agt_dead_letters_empresa_created
  ON public.fiscal_agt_dead_letters(empresa_id,created_at DESC);

ALTER TABLE public.fiscal_agt_dead_letters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fiscal_agt_dead_letters_select
  ON public.fiscal_agt_dead_letters;
CREATE POLICY fiscal_agt_dead_letters_select
ON public.fiscal_agt_dead_letters
FOR SELECT
TO authenticated
USING (public.user_has_role_in_empresa(empresa_id,ARRAY['owner','admin','operator']));

REVOKE ALL ON TABLE public.fiscal_agt_dead_letters
  FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.fiscal_agt_dead_letters TO authenticated;
GRANT SELECT,INSERT ON TABLE public.fiscal_agt_dead_letters TO service_role;

CREATE OR REPLACE FUNCTION public.fiscal_agt_block_dead_letter_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog','public'
AS $function$
BEGIN
  RAISE EXCEPTION 'IMMUTABILITY: fiscal_agt_dead_letters é append-only';
END;
$function$;

DROP TRIGGER IF EXISTS trg_fiscal_agt_dead_letters_immutable
  ON public.fiscal_agt_dead_letters;
CREATE TRIGGER trg_fiscal_agt_dead_letters_immutable
BEFORE UPDATE OR DELETE
ON public.fiscal_agt_dead_letters
FOR EACH ROW EXECUTE FUNCTION public.fiscal_agt_block_dead_letter_mutation();

DROP TRIGGER IF EXISTS trg_fiscal_agt_dead_letters_no_truncate
  ON public.fiscal_agt_dead_letters;
CREATE TRIGGER trg_fiscal_agt_dead_letters_no_truncate
BEFORE TRUNCATE
ON public.fiscal_agt_dead_letters
FOR EACH STATEMENT EXECUTE FUNCTION public.fiscal_agt_block_dead_letter_mutation();

CREATE OR REPLACE FUNCTION public.fiscal_agt_dead_letter_submission(
  p_submission_id uuid,
  p_reason_code text,
  p_reason_message text,
  p_snapshot jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog','public'
AS $function$
DECLARE
  v_claim_role text := coalesce(current_setting('request.jwt.claim.role',true),'');
  v_row public.fiscal_agt_submissions%ROWTYPE;
  v_inserted uuid;
BEGIN
  IF v_claim_role <> 'service_role' AND session_user <> 'postgres' THEN
    RAISE EXCEPTION 'AUTH: DLQ AGT é exclusiva do backend fiscal';
  END IF;

  SELECT * INTO v_row
  FROM public.fiscal_agt_submissions
  WHERE id=p_submission_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DATA: submission AGT não encontrada';
  END IF;

  IF v_row.status IN ('accepted','rejected','cancelled','mapping_error') THEN
    RAISE EXCEPTION 'STATE: submission terminal não pode entrar em DLQ';
  END IF;

  INSERT INTO public.fiscal_agt_dead_letters(
    empresa_id,submission_id,submission_uuid,request_id,
    attempt_count,poll_count,reason_code,reason_message,snapshot
  )
  VALUES(
    v_row.empresa_id,v_row.id,v_row.submission_uuid,v_row.request_id,
    v_row.attempt_count,v_row.poll_count,
    left(coalesce(nullif(btrim(p_reason_code),''),'AGT_RETRY_EXHAUSTED'),120),
    left(coalesce(p_reason_message,''),2000),
    coalesce(p_snapshot,'{}'::jsonb) ||
      jsonb_build_object(
        'status',v_row.status,
        'error_code',v_row.error_code,
        'error_message',v_row.error_message,
        'next_check_at',v_row.next_check_at
      )
  )
  ON CONFLICT (submission_id,attempt_count,poll_count,reason_code)
  DO NOTHING
  RETURNING id INTO v_inserted;

  UPDATE public.fiscal_agt_submissions
  SET
    dead_lettered_at=coalesce(dead_lettered_at,now()),
    next_check_at=NULL,
    error_code=left(coalesce(nullif(btrim(p_reason_code),''),'AGT_RETRY_EXHAUSTED'),120),
    error_message=left(coalesce(p_reason_message,error_message,'Retry budget exhausted'),2000)
  WHERE id=v_row.id;

  RETURN jsonb_build_object(
    'ok',true,
    'idempotent',v_inserted IS NULL,
    'submission_id',v_row.id,
    'submission_uuid',v_row.submission_uuid,
    'request_id',v_row.request_id,
    'dead_letter_id',v_inserted
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.fiscal_agt_replay_dead_letter(
  p_submission_id uuid,
  p_additional_attempts integer DEFAULT 3
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog','public'
AS $function$
DECLARE
  v_claim_role text := coalesce(current_setting('request.jwt.claim.role',true),'');
  v_row public.fiscal_agt_submissions%ROWTYPE;
  v_add integer := greatest(1,least(coalesce(p_additional_attempts,3),20));
BEGIN
  IF v_claim_role <> 'service_role' AND session_user <> 'postgres' THEN
    RAISE EXCEPTION 'AUTH: replay AGT é exclusivo do backend fiscal';
  END IF;

  SELECT * INTO v_row
  FROM public.fiscal_agt_submissions
  WHERE id=p_submission_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DATA: submission AGT não encontrada';
  END IF;

  IF v_row.dead_lettered_at IS NULL THEN
    RETURN jsonb_build_object(
      'ok',true,'idempotent',true,'submission_id',v_row.id,
      'submission_uuid',v_row.submission_uuid,'request_id',v_row.request_id
    );
  END IF;

  IF v_row.status IN ('accepted','rejected','cancelled','mapping_error') THEN
    RAISE EXCEPTION 'STATE: submission terminal não pode ser replayed';
  END IF;

  UPDATE public.fiscal_agt_submissions
  SET
    max_attempts=greatest(max_attempts,attempt_count+v_add),
    max_poll_count=greatest(max_poll_count,poll_count+(v_add*8)),
    dead_lettered_at=NULL,
    next_check_at=now(),
    error_code='AGT_MANUAL_REPLAY',
    error_message='Replay autorizado preservando submissionUUID/requestID'
  WHERE id=v_row.id;

  RETURN jsonb_build_object(
    'ok',true,
    'idempotent',false,
    'submission_id',v_row.id,
    'submission_uuid',v_row.submission_uuid,
    'request_id',v_row.request_id,
    'additional_attempts',v_add
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.fiscal_agt_metrics_snapshot()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'pg_catalog','public'
AS $function$
  SELECT jsonb_build_object(
    'generated_at',now(),
    'prepared',count(*) FILTER (WHERE status='prepared' AND dead_lettered_at IS NULL),
    'submitting',count(*) FILTER (WHERE status='submitting' AND dead_lettered_at IS NULL),
    'submitted',count(*) FILTER (WHERE status='submitted' AND dead_lettered_at IS NULL),
    'processing',count(*) FILTER (WHERE status='processing' AND dead_lettered_at IS NULL),
    'uncertain',count(*) FILTER (WHERE status='uncertain' AND dead_lettered_at IS NULL),
    'accepted',count(*) FILTER (WHERE status='accepted'),
    'rejected',count(*) FILTER (WHERE status='rejected'),
    'dead_lettered',count(*) FILTER (WHERE dead_lettered_at IS NOT NULL),
    'oldest_nonterminal_seconds',
      extract(epoch FROM now()-min(created_at) FILTER (
        WHERE status IN ('prepared','submitting','submitted','processing','uncertain')
          AND dead_lettered_at IS NULL
      )),
    'max_attempt_count',coalesce(max(attempt_count),0),
    'max_poll_count',coalesce(max(poll_count),0)
  )
  FROM public.fiscal_agt_submissions;
$function$;

REVOKE ALL ON FUNCTION public.fiscal_agt_block_dead_letter_mutation()
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.fiscal_agt_dead_letter_submission(uuid,text,text,jsonb)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fiscal_agt_dead_letter_submission(uuid,text,text,jsonb)
  TO service_role;
REVOKE ALL ON FUNCTION public.fiscal_agt_replay_dead_letter(uuid,integer)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fiscal_agt_replay_dead_letter(uuid,integer)
  TO service_role;
REVOKE ALL ON FUNCTION public.fiscal_agt_metrics_snapshot()
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fiscal_agt_metrics_snapshot()
  TO service_role;
