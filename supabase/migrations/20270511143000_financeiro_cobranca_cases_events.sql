CREATE TABLE IF NOT EXISTS public.financeiro_cobranca_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  status_operacional text NOT NULL DEFAULT 'novo' CHECK (status_operacional IN ('novo','em_contato','promessa','escalado','resolvido')),
  owner_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  next_action_at timestamptz NULL,
  sla_at timestamptz NULL,
  last_contact_at timestamptz NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (escola_id, aluno_id)
);

CREATE TABLE IF NOT EXISTS public.financeiro_cobranca_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES public.financeiro_cobranca_cases(id) ON DELETE CASCADE,
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('status_change','contato','promessa','nota')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fin_cobranca_cases_escola_status
  ON public.financeiro_cobranca_cases(escola_id, status_operacional, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_fin_cobranca_events_case_created
  ON public.financeiro_cobranca_events(case_id, created_at DESC);

ALTER TABLE public.financeiro_cobranca_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_cobranca_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS financeiro_cobranca_cases_select ON public.financeiro_cobranca_cases;
CREATE POLICY financeiro_cobranca_cases_select
ON public.financeiro_cobranca_cases
FOR SELECT
TO authenticated
USING (user_has_role_in_school(escola_id, ARRAY['admin','admin_escola','secretaria','financeiro','staff_admin']));

DROP POLICY IF EXISTS financeiro_cobranca_cases_mutation ON public.financeiro_cobranca_cases;
CREATE POLICY financeiro_cobranca_cases_mutation
ON public.financeiro_cobranca_cases
FOR ALL
TO authenticated
USING (user_has_role_in_school(escola_id, ARRAY['admin','admin_escola','secretaria','financeiro','staff_admin']))
WITH CHECK (user_has_role_in_school(escola_id, ARRAY['admin','admin_escola','secretaria','financeiro','staff_admin']));

DROP POLICY IF EXISTS financeiro_cobranca_events_select ON public.financeiro_cobranca_events;
CREATE POLICY financeiro_cobranca_events_select
ON public.financeiro_cobranca_events
FOR SELECT
TO authenticated
USING (user_has_role_in_school(escola_id, ARRAY['admin','admin_escola','secretaria','financeiro','staff_admin']));

DROP POLICY IF EXISTS financeiro_cobranca_events_insert ON public.financeiro_cobranca_events;
CREATE POLICY financeiro_cobranca_events_insert
ON public.financeiro_cobranca_events
FOR INSERT
TO authenticated
WITH CHECK (user_has_role_in_school(escola_id, ARRAY['admin','admin_escola','secretaria','financeiro','staff_admin']));
