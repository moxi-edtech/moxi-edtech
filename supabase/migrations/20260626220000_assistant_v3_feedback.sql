CREATE TABLE IF NOT EXISTS public.ai_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  action_id uuid NULL REFERENCES public.ai_actions(id) ON DELETE SET NULL,
  rating text NOT NULL CHECK (rating IN ('useful','not_useful')),
  adjustment text NULL CHECK (adjustment IS NULL OR adjustment IN ('shorter','more_formal','clearer','redo')),
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_feedback_school_created
  ON public.ai_feedback (school_id, created_at DESC);

ALTER TABLE public.ai_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_feedback_select ON public.ai_feedback;
CREATE POLICY ai_feedback_select
ON public.ai_feedback
FOR SELECT
TO authenticated
USING (
  public.user_has_role_in_school(
    school_id,
    ARRAY['admin','admin_escola','staff_admin','direcao','diretoria']::text[]
  )
);

DROP POLICY IF EXISTS ai_feedback_insert ON public.ai_feedback;
CREATE POLICY ai_feedback_insert
ON public.ai_feedback
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND public.user_has_role_in_school(
    school_id,
    ARRAY['admin','admin_escola','staff_admin','direcao','diretoria','secretaria','financeiro','admin_financeiro','secretaria_financeiro']::text[]
  )
);
