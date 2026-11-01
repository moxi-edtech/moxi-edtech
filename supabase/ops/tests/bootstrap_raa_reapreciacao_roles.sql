-- Isolated fixture for the existing permissive appeals policy.
-- Execute in an empty PostgreSQL 17 database, then apply the new migration.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated;

CREATE OR REPLACE FUNCTION public.user_can_access_raa_school(p_escola_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS
$$ SELECT auth.uid() IS NOT NULL
  AND p_escola_id = nullif(current_setting('app.mock_school', true), '')::uuid $$;

CREATE OR REPLACE FUNCTION public.user_has_role_in_school(p_escola_id uuid, p_roles text[])
RETURNS boolean LANGUAGE sql STABLE AS
$$ SELECT public.user_can_access_raa_school(p_escola_id)
  AND nullif(current_setting('app.mock_role', true), '') = ANY(p_roles) $$;

CREATE TABLE public.escola_users (
  escola_id uuid NOT NULL, user_id uuid NOT NULL, papel text NOT NULL,
  PRIMARY KEY (escola_id, user_id)
);
INSERT INTO public.escola_users (escola_id, user_id, papel) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','secretaria'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','33333333-3333-4333-8333-333333333333','admin_financeiro'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','44444444-4444-4444-8444-444444444444','diretor');

CREATE TABLE public.raa_indisciplina_eventos (
  id uuid PRIMARY KEY, escola_id uuid NOT NULL,
  estado text NOT NULL DEFAULT 'registado', decisao_motivo text,
  resolvido_por uuid, resolvido_em timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  matricula_id uuid DEFAULT '55555555-5555-4555-8555-555555555555'
);
ALTER TABLE public.raa_indisciplina_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY raa_indisciplina_director_update_v2 ON public.raa_indisciplina_eventos
  FOR UPDATE TO authenticated
  USING (public.user_can_access_raa_school(escola_id)
    AND public.user_has_role_in_school(escola_id,ARRAY['admin','admin_escola','diretor']::text[]))
  WITH CHECK (public.user_can_access_raa_school(escola_id));
CREATE POLICY raa_indisciplina_school_read_v2 ON public.raa_indisciplina_eventos
  FOR SELECT TO authenticated USING (public.user_can_access_raa_school(escola_id));
GRANT ALL ON public.raa_indisciplina_eventos TO anon, authenticated, service_role;
INSERT INTO public.raa_indisciplina_eventos (id,escola_id,estado) VALUES
  ('00000000-0000-4000-8000-000000000005','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','registado');

CREATE TABLE public.reapreciacao_pedidos (
  id uuid PRIMARY KEY, escola_id uuid NOT NULL,
  estado text NOT NULL DEFAULT 'pendente',
  solicitado_por uuid, decidido_por uuid, decidido_em timestamptz,
  decisao_motivo text, prazo_em timestamptz NOT NULL,
  resultado_publicado_em timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reapreciacao_pedidos ENABLE ROW LEVEL SECURITY;
CREATE POLICY reapreciacao_pedidos_tenant ON public.reapreciacao_pedidos
  FOR ALL USING (public.user_can_access_raa_school(escola_id))
  WITH CHECK (public.user_can_access_raa_school(escola_id));
GRANT ALL ON public.reapreciacao_pedidos TO anon, authenticated, service_role;

INSERT INTO public.reapreciacao_pedidos
  (id,escola_id,estado,solicitado_por,prazo_em,resultado_publicado_em)
VALUES
  ('00000000-0000-4000-8000-000000000001',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','pendente',
   '11111111-1111-4111-8111-111111111111',
   now() + interval '1 day',now() - interval '1 hour'),
  ('00000000-0000-4000-8000-000000000002',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','pendente',
   '11111111-1111-4111-8111-111111111111',
   now() - interval '1 hour',now() - interval '3 hours');
