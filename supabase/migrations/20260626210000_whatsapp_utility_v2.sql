CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'communication_outbox_status') THEN
    CREATE TYPE public.communication_outbox_status AS ENUM (
      'draft',
      'review_required',
      'approved',
      'queued',
      'sending',
      'sent',
      'delivered',
      'read',
      'failed',
      'cancelled',
      'rejected'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.communication_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  title text NOT NULL,
  category text NOT NULL,
  body text NOT NULL,
  required_variables text[] NOT NULL DEFAULT '{}',
  risk_level text NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low','medium','high')),
  requires_approval boolean NOT NULL DEFAULT false,
  allowed_roles text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.communication_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'waha',
  channel text NOT NULL DEFAULT 'whatsapp',
  message_type text NOT NULL CHECK (message_type IN (
    'auth_provision_student',
    'school_notice',
    'finance_charge',
    'document_ready',
    'manual_message',
    'ai_generated_draft'
  )),
  source_module text NULL,
  source_entity_type text NULL,
  source_entity_id uuid NULL,
  recipient_type text NOT NULL,
  recipient_ref_id uuid NULL,
  recipient_name text NULL,
  recipient_phone_masked text NULL,
  recipient_phone_hash text NULL,
  title text NULL,
  body text NOT NULL,
  template_key text NULL REFERENCES public.communication_templates(key),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.communication_outbox_status NOT NULL DEFAULT 'draft',
  risk_level text NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low','medium','high')),
  requires_approval boolean NOT NULL DEFAULT false,
  idempotency_key text NOT NULL,
  provider_message_id text NULL,
  retry_count integer NOT NULL DEFAULT 0,
  next_retry_at timestamptz NULL,
  last_error text NULL,
  approved_at timestamptz NULL,
  queued_at timestamptz NULL,
  sending_at timestamptz NULL,
  sent_at timestamptz NULL,
  delivered_at timestamptz NULL,
  read_at timestamptz NULL,
  failed_at timestamptz NULL,
  cancelled_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT communication_outbox_provider_channel_check CHECK (provider = 'waha' AND channel = 'whatsapp'),
  CONSTRAINT communication_outbox_idempotency_unique UNIQUE (school_id, idempotency_key),
  CONSTRAINT communication_outbox_approval_check CHECK (
    (requires_approval = false)
    OR status IN ('draft','review_required','rejected','cancelled')
    OR approved_by IS NOT NULL
  )
);

CREATE TABLE IF NOT EXISTS public.communication_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outbox_id uuid NULL REFERENCES public.communication_outbox(id) ON DELETE SET NULL,
  school_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  provider text NOT NULL DEFAULT 'waha',
  provider_event_id text NULL,
  payload_sanitized jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.communication_rate_limits (
  school_id uuid PRIMARY KEY REFERENCES public.escolas(id) ON DELETE CASCADE,
  max_messages_per_minute integer NOT NULL DEFAULT 10,
  max_messages_per_hour integer NOT NULL DEFAULT 100,
  max_messages_per_day integer NOT NULL DEFAULT 500,
  quiet_hours_start time NOT NULL DEFAULT '20:00',
  quiet_hours_end time NOT NULL DEFAULT '07:00',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_communication_outbox_school_status
  ON public.communication_outbox (school_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_communication_outbox_worker
  ON public.communication_outbox (status, next_retry_at, queued_at)
  WHERE status IN ('approved','queued','sending');

CREATE INDEX IF NOT EXISTS idx_communication_logs_school_created
  ON public.communication_logs (school_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.claim_communication_outbox(p_limit integer DEFAULT 25)
RETURNS SETOF public.communication_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH candidate AS (
    SELECT id
    FROM public.communication_outbox
    WHERE channel = 'whatsapp'
      AND provider = 'waha'
      AND (
        status IN ('approved','queued')
        OR (status = 'sending' AND sending_at < now() - interval '10 minutes')
      )
      AND (next_retry_at IS NULL OR next_retry_at <= now())
      AND (requires_approval = false OR approved_by IS NOT NULL)
    ORDER BY queued_at NULLS LAST, created_at
    LIMIT GREATEST(1, LEAST(p_limit, 50))
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.communication_outbox o
     SET status = 'sending',
         sending_at = now(),
         updated_at = now()
   WHERE o.id IN (SELECT id FROM candidate)
  RETURNING o.*;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_communication_outbox(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.guard_communication_outbox_client_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.role() = 'authenticated'
     AND current_setting('app.communication_server_update', true) IS DISTINCT FROM 'on' THEN
    IF NEW.approved_by IS DISTINCT FROM OLD.approved_by THEN
      RAISE EXCEPTION 'approved_by is server-managed';
    END IF;
    IF NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
      RAISE EXCEPTION 'approved_at is server-managed';
    END IF;
    IF NEW.provider_message_id IS DISTINCT FROM OLD.provider_message_id THEN
      RAISE EXCEPTION 'provider_message_id is server-managed';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_communication_outbox_client_update ON public.communication_outbox;
CREATE TRIGGER trg_guard_communication_outbox_client_update
BEFORE UPDATE ON public.communication_outbox
FOR EACH ROW
EXECUTE FUNCTION public.guard_communication_outbox_client_update();

CREATE OR REPLACE FUNCTION public.set_communication_outbox_action(p_outbox_id uuid, p_action text)
RETURNS public.communication_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.communication_outbox;
  v_allowed boolean;
  v_now timestamptz := now();
BEGIN
  SELECT *
    INTO v_row
    FROM public.communication_outbox
   WHERE id = p_outbox_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'communication_outbox not found';
  END IF;

  SELECT public.user_has_role_in_school(
    v_row.school_id,
    ARRAY['admin','admin_escola','staff_admin','direcao','diretoria','secretaria','financeiro','admin_financeiro','secretaria_financeiro']::text[]
  )
  INTO v_allowed;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  IF v_row.message_type = 'finance_charge' THEN
    SELECT public.user_has_role_in_school(
      v_row.school_id,
      ARRAY['admin','admin_escola','direcao','diretoria','financeiro','admin_financeiro','secretaria_financeiro']::text[]
    )
    INTO v_allowed;
    IF NOT v_allowed THEN
      RAISE EXCEPTION 'finance permission denied';
    END IF;
  END IF;

  PERFORM set_config('app.communication_server_update', 'on', true);

  IF p_action = 'approve' THEN
    IF v_row.status NOT IN ('draft','review_required','approved','failed') THEN
      RAISE EXCEPTION 'status cannot be approved';
    END IF;

    UPDATE public.communication_outbox
       SET status = 'queued',
           approved_by = auth.uid(),
           approved_at = v_now,
           queued_at = v_now,
           next_retry_at = null,
           last_error = null,
           updated_at = v_now
     WHERE id = p_outbox_id
     RETURNING * INTO v_row;
  ELSIF p_action = 'retry' THEN
    IF v_row.status <> 'failed' THEN
      RAISE EXCEPTION 'only failed messages can be retried';
    END IF;

    UPDATE public.communication_outbox
       SET status = CASE WHEN requires_approval AND approved_by IS NULL THEN 'review_required'::public.communication_outbox_status ELSE 'queued'::public.communication_outbox_status END,
           queued_at = CASE WHEN requires_approval AND approved_by IS NULL THEN queued_at ELSE v_now END,
           next_retry_at = null,
           last_error = null,
           retry_count = 0,
           failed_at = null,
           updated_at = v_now
     WHERE id = p_outbox_id
     RETURNING * INTO v_row;
  ELSIF p_action = 'cancel' THEN
    IF v_row.status NOT IN ('draft','review_required','approved','queued') THEN
      RAISE EXCEPTION 'status cannot be cancelled';
    END IF;

    UPDATE public.communication_outbox
       SET status = 'cancelled',
           cancelled_at = v_now,
           updated_at = v_now
     WHERE id = p_outbox_id
     RETURNING * INTO v_row;
  ELSIF p_action = 'reject' THEN
    IF v_row.status NOT IN ('draft','review_required') THEN
      RAISE EXCEPTION 'status cannot be rejected';
    END IF;

    UPDATE public.communication_outbox
       SET status = 'rejected',
           cancelled_at = v_now,
           updated_at = v_now
     WHERE id = p_outbox_id
     RETURNING * INTO v_row;
  ELSE
    RAISE EXCEPTION 'invalid action';
  END IF;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_communication_outbox_action(uuid, text) TO authenticated;

ALTER TABLE public.communication_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS communication_templates_select ON public.communication_templates;
CREATE POLICY communication_templates_select
ON public.communication_templates
FOR SELECT
TO authenticated
USING (active = true);

DROP POLICY IF EXISTS communication_outbox_select ON public.communication_outbox;
CREATE POLICY communication_outbox_select
ON public.communication_outbox
FOR SELECT
TO authenticated
USING (
  public.user_has_role_in_school(
    school_id,
    ARRAY['admin','admin_escola','staff_admin','direcao','diretoria','secretaria','financeiro','admin_financeiro','secretaria_financeiro']::text[]
  )
);

DROP POLICY IF EXISTS communication_outbox_insert ON public.communication_outbox;
CREATE POLICY communication_outbox_insert
ON public.communication_outbox
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND approved_by IS NULL
  AND provider_message_id IS NULL
  AND public.user_has_role_in_school(
    school_id,
    ARRAY['admin','admin_escola','staff_admin','direcao','diretoria','secretaria','financeiro','admin_financeiro','secretaria_financeiro']::text[]
  )
);

DROP POLICY IF EXISTS communication_outbox_update ON public.communication_outbox;
CREATE POLICY communication_outbox_update
ON public.communication_outbox
FOR UPDATE
TO authenticated
USING (
  public.user_has_role_in_school(
    school_id,
    ARRAY['admin','admin_escola','staff_admin','direcao','diretoria','secretaria','financeiro','admin_financeiro','secretaria_financeiro']::text[]
  )
)
WITH CHECK (
  public.user_has_role_in_school(
    school_id,
    ARRAY['admin','admin_escola','staff_admin','direcao','diretoria','secretaria','financeiro','admin_financeiro','secretaria_financeiro']::text[]
  )
);

DROP POLICY IF EXISTS communication_logs_select ON public.communication_logs;
CREATE POLICY communication_logs_select
ON public.communication_logs
FOR SELECT
TO authenticated
USING (
  public.user_has_role_in_school(
    school_id,
    ARRAY['admin','admin_escola','staff_admin','direcao','diretoria','secretaria','financeiro','admin_financeiro','secretaria_financeiro']::text[]
  )
);

DROP POLICY IF EXISTS communication_logs_insert ON public.communication_logs;
CREATE POLICY communication_logs_insert
ON public.communication_logs
FOR INSERT
TO authenticated
WITH CHECK (
  public.user_has_role_in_school(
    school_id,
    ARRAY['admin','admin_escola','staff_admin','direcao','diretoria','secretaria','financeiro','admin_financeiro','secretaria_financeiro']::text[]
  )
);

DROP POLICY IF EXISTS communication_rate_limits_select ON public.communication_rate_limits;
CREATE POLICY communication_rate_limits_select
ON public.communication_rate_limits
FOR SELECT
TO authenticated
USING (
  public.user_has_role_in_school(
    school_id,
    ARRAY['admin','admin_escola','staff_admin','direcao','diretoria','secretaria','financeiro','admin_financeiro','secretaria_financeiro']::text[]
  )
);

INSERT INTO public.communication_templates (key, title, category, body, required_variables, risk_level, requires_approval, allowed_roles)
VALUES
  ('student_access_basic', 'Acesso ao Portal do Aluno', 'secretaria', 'Olá, {guardianName}. O acesso ao Portal do Aluno de {studentName} está disponível. Link: {portalUrl}. Por segurança, não partilhe estes dados com terceiros.', ARRAY['guardianName','studentName','portalUrl'], 'low', false, ARRAY['admin','admin_escola','staff_admin','secretaria']),
  ('student_access_activation', 'Ativação segura do Portal', 'secretaria', 'Olá, {guardianName}. Use este link seguro para ativar o acesso de {studentName}: {activationLink}. O link é pessoal e deve ser usado apenas pelo encarregado.', ARRAY['guardianName','studentName','activationLink'], 'medium', false, ARRAY['admin','admin_escola','staff_admin','secretaria']),
  ('finance_friendly_reminder', 'Lembrete financeiro amigável', 'financeiro', 'Olá, {guardianName}. Identificámos uma pendência financeira de {studentName}. Valor: {amount}. Pode regularizar junto à secretaria/financeiro.', ARRAY['guardianName','studentName','amount'], 'high', true, ARRAY['admin','admin_escola','direcao','diretoria','financeiro','admin_financeiro','secretaria_financeiro']),
  ('finance_second_reminder', 'Segundo lembrete financeiro', 'financeiro', 'Olá, {guardianName}. A pendência financeira de {studentName} continua em aberto. Solicitamos regularização ou contacto com o financeiro.', ARRAY['guardianName','studentName'], 'high', true, ARRAY['admin','admin_escola','direcao','diretoria','financeiro','admin_financeiro','secretaria_financeiro']),
  ('finance_formal_notice', 'Aviso financeiro formal', 'financeiro', 'Prezado(a) {guardianName}, comunicamos que existe pendência financeira associada a {studentName}. Pedimos regularização no prazo informado pela escola.', ARRAY['guardianName','studentName'], 'high', true, ARRAY['admin','admin_escola','direcao','diretoria','financeiro','admin_financeiro']),
  ('school_general_notice', 'Comunicado geral', 'comunicacao', 'Olá, {guardianName}. Comunicado da escola {schoolName}: {noticeBody}', ARRAY['guardianName','schoolName','noticeBody'], 'medium', false, ARRAY['admin','admin_escola','staff_admin','direcao','diretoria','secretaria']),
  ('document_ready_notice', 'Documento pronto', 'secretaria', 'Olá, {guardianName}. O documento {documentName} de {studentName} está pronto. Consulte o portal ou contacte a secretaria.', ARRAY['guardianName','documentName','studentName'], 'low', false, ARRAY['admin','admin_escola','staff_admin','secretaria']),
  ('meeting_invitation', 'Convite para reunião', 'comunicacao', 'Olá, {guardianName}. A escola {schoolName} convida para reunião em {meetingDate}. Local/forma: {meetingPlace}.', ARRAY['guardianName','schoolName','meetingDate','meetingPlace'], 'medium', false, ARRAY['admin','admin_escola','staff_admin','direcao','diretoria','secretaria']),
  ('enrollment_confirmation', 'Confirmação de matrícula', 'secretaria', 'Olá, {guardianName}. A matrícula de {studentName} foi confirmada na escola {schoolName}.', ARRAY['guardianName','studentName','schoolName'], 'low', false, ARRAY['admin','admin_escola','staff_admin','secretaria'])
ON CONFLICT (key) DO UPDATE SET
  title = EXCLUDED.title,
  category = EXCLUDED.category,
  body = EXCLUDED.body,
  required_variables = EXCLUDED.required_variables,
  risk_level = EXCLUDED.risk_level,
  requires_approval = EXCLUDED.requires_approval,
  allowed_roles = EXCLUDED.allowed_roles,
  active = true,
  updated_at = now();
