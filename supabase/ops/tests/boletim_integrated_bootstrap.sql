\i supabase/ops/tests/boletim_session_bootstrap.sql
ALTER TABLE public.pagamento_intents ADD COLUMN evidence_url text;
ALTER TABLE public.pagamento_intents ADD COLUMN meta jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE OR REPLACE FUNCTION public.portal_user_can_access_aluno(p_aluno_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT p_aluno_id = NULLIF(current_setting('test.aluno_id', true), '')::uuid
$$;
