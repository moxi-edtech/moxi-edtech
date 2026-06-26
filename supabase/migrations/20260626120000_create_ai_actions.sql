BEGIN;

CREATE TABLE IF NOT EXISTS public.ai_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  approved_by uuid REFERENCES auth.users(id),
  rejected_by uuid REFERENCES auth.users(id),
  action_type text NOT NULL,
  source_module text NOT NULL,
  source_entity_type text,
  source_entity_id text,
  title text NOT NULL,
  summary text,
  content text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  risk_level text NOT NULL DEFAULT 'low',
  requires_approval boolean NOT NULL DEFAULT false,
  approved_at timestamptz,
  rejected_at timestamptz,
  queued_at timestamptz,
  sent_at timestamptz,
  failed_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_actions_status_check CHECK (
    status IN ('draft', 'review_required', 'approved', 'rejected', 'queued', 'sending', 'sent', 'failed', 'cancelled')
  ),
  CONSTRAINT ai_actions_type_check CHECK (
    action_type IN (
      'finance_message',
      'communication_draft',
      'school_summary',
      'student_summary',
      'help_navigation',
      'operational_recommendation'
    )
  ),
  CONSTRAINT ai_actions_risk_check CHECK (risk_level IN ('low', 'medium', 'high')),
  CONSTRAINT ai_actions_approval_state_check CHECK (
    (status <> 'approved' OR (approved_by IS NOT NULL AND approved_at IS NOT NULL))
    AND (status <> 'rejected' OR (rejected_by IS NOT NULL AND rejected_at IS NOT NULL))
    AND (status <> 'queued' OR queued_at IS NOT NULL)
    AND (status <> 'sent' OR sent_at IS NOT NULL)
    AND (status <> 'failed' OR failed_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_ai_actions_school_id ON public.ai_actions (school_id);
CREATE INDEX IF NOT EXISTS idx_ai_actions_status ON public.ai_actions (status);
CREATE INDEX IF NOT EXISTS idx_ai_actions_action_type ON public.ai_actions (action_type);
CREATE INDEX IF NOT EXISTS idx_ai_actions_created_at ON public.ai_actions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_actions_school_status_created ON public.ai_actions (school_id, status, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_ai_actions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ai_actions_updated_at ON public.ai_actions;
CREATE TRIGGER trg_ai_actions_updated_at
BEFORE UPDATE ON public.ai_actions
FOR EACH ROW
EXECUTE FUNCTION public.set_ai_actions_updated_at();

CREATE OR REPLACE FUNCTION public.enforce_ai_actions_governance()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_waha boolean := false;
BEGIN
  v_waha := lower(coalesce(NEW.metadata->>'channel', NEW.metadata->>'provider', '')) = 'waha';

  IF NEW.risk_level = 'high' OR NEW.action_type = 'finance_message' OR v_waha THEN
    NEW.requires_approval := true;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.status IN ('queued', 'sending', 'sent') THEN
    RAISE EXCEPTION 'ai_actions cannot be queued or sent automatically on creation';
  END IF;

  IF NEW.status IN ('approved', 'queued', 'sending', 'sent') AND NEW.requires_approval IS TRUE THEN
    IF NEW.approved_by IS NULL OR NEW.approved_at IS NULL THEN
      RAISE EXCEPTION 'approved ai_actions require approved_by and approved_at';
    END IF;
  END IF;

  IF NEW.status IN ('queued', 'sending', 'sent') AND v_waha THEN
    IF current_setting('app.waha_experimental_enabled', true) IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION 'WAHA dispatch requires explicit server-side enablement';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ai_actions_governance ON public.ai_actions;
CREATE TRIGGER trg_ai_actions_governance
BEFORE INSERT OR UPDATE ON public.ai_actions
FOR EACH ROW
EXECUTE FUNCTION public.enforce_ai_actions_governance();

ALTER TABLE public.ai_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_actions_select_allowed_roles ON public.ai_actions;
CREATE POLICY ai_actions_select_allowed_roles
ON public.ai_actions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.escola_users eu
    WHERE eu.escola_id = ai_actions.school_id
      AND eu.user_id = auth.uid()
      AND lower(eu.papel) = ANY (ARRAY[
        'admin',
        'admin_escola',
        'staff_admin',
        'direcao',
        'diretoria',
        'financeiro',
        'admin_financeiro',
        'secretaria_financeiro',
        'secretaria'
      ])
  )
);

DROP POLICY IF EXISTS ai_actions_insert_allowed_roles ON public.ai_actions;
CREATE POLICY ai_actions_insert_allowed_roles
ON public.ai_actions
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND status IN ('draft', 'review_required')
  AND EXISTS (
    SELECT 1
    FROM public.escola_users eu
    WHERE eu.escola_id = ai_actions.school_id
      AND eu.user_id = auth.uid()
      AND lower(eu.papel) = ANY (ARRAY[
        'admin',
        'admin_escola',
        'staff_admin',
        'direcao',
        'diretoria',
        'financeiro',
        'admin_financeiro',
        'secretaria_financeiro',
        'secretaria'
      ])
  )
);

DROP POLICY IF EXISTS ai_actions_update_finance_roles ON public.ai_actions;
CREATE POLICY ai_actions_update_finance_roles
ON public.ai_actions
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.escola_users eu
    WHERE eu.escola_id = ai_actions.school_id
      AND eu.user_id = auth.uid()
      AND (
        CASE
          WHEN ai_actions.action_type = 'finance_message' THEN lower(eu.papel) = ANY (ARRAY[
            'admin',
            'admin_escola',
            'direcao',
            'diretoria',
            'financeiro',
            'admin_financeiro',
            'secretaria_financeiro'
          ])
          ELSE lower(eu.papel) = ANY (ARRAY[
            'admin',
            'admin_escola',
            'staff_admin',
            'direcao',
            'diretoria',
            'secretaria'
          ])
        END
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.escola_users eu
    WHERE eu.escola_id = ai_actions.school_id
      AND eu.user_id = auth.uid()
      AND (
        CASE
          WHEN ai_actions.action_type = 'finance_message' THEN lower(eu.papel) = ANY (ARRAY[
            'admin',
            'admin_escola',
            'direcao',
            'diretoria',
            'financeiro',
            'admin_financeiro',
            'secretaria_financeiro'
          ])
          ELSE lower(eu.papel) = ANY (ARRAY[
            'admin',
            'admin_escola',
            'staff_admin',
            'direcao',
            'diretoria',
            'secretaria'
          ])
        END
      )
  )
);

REVOKE ALL ON TABLE public.ai_actions FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON TABLE public.ai_actions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_actions TO service_role;

COMMIT;
