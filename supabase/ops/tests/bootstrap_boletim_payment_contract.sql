-- Dados inteiramente sintéticos para PostgreSQL descartável.
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
CREATE OR REPLACE FUNCTION public.current_tenant_escola_id() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT NULLIF(current_setting('test.escola_id', true), '')::uuid
$$;
CREATE OR REPLACE FUNCTION public.portal_user_can_access_aluno(p_aluno_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT p_aluno_id = NULLIF(current_setting('test.aluno_id', true), '')::uuid
$$;
CREATE TABLE public.servico_pedidos(
  id uuid PRIMARY KEY, escola_id uuid NOT NULL, aluno_id uuid NOT NULL,
  servico_codigo text NOT NULL, matricula_id uuid,
  status text NOT NULL, valor_cobrado numeric NOT NULL DEFAULT 0
);
CREATE TABLE public.pagamento_intents(
  id uuid PRIMARY KEY, escola_id uuid NOT NULL, aluno_id uuid NOT NULL,
  servico_pedido_id uuid NOT NULL REFERENCES public.servico_pedidos(id),
  status text NOT NULL, evidence_url text, amount numeric NOT NULL DEFAULT 100,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE public.audit_logs(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  escola_id uuid, actor_id uuid, action text,
  entity text, entity_id text, portal text, details jsonb
);
