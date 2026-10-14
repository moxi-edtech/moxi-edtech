CREATE SCHEMA IF NOT EXISTS auth;
DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF; END $$;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('test.actor', true), '')::uuid $$;
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT jsonb_build_object('email', COALESCE(current_setting('test.email', true), '')) $$;
CREATE OR REPLACE FUNCTION public.current_tenant_escola_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('test.school', true),'')::uuid $$;
CREATE TABLE public.alunos (id uuid PRIMARY KEY, escola_id uuid NOT NULL, usuario_auth_id uuid, profile_id uuid);
CREATE TABLE public.aluno_encarregados (escola_id uuid NOT NULL, aluno_id uuid NOT NULL, encarregado_id uuid NOT NULL);
CREATE TABLE public.encarregados (id uuid PRIMARY KEY, escola_id uuid NOT NULL, email text);
CREATE TABLE public.anos_letivos (id uuid PRIMARY KEY, escola_id uuid NOT NULL, ativo boolean NOT NULL);
CREATE TABLE public.matriculas (id uuid PRIMARY KEY, escola_id uuid NOT NULL, aluno_id uuid NOT NULL, session_id uuid NOT NULL, status text NOT NULL, created_at timestamptz DEFAULT now());
CREATE TABLE public.servicos_escola (id uuid PRIMARY KEY, escola_id uuid NOT NULL, codigo text NOT NULL, ativo boolean NOT NULL, valor_base numeric NOT NULL, exige_aprovacao boolean NOT NULL DEFAULT false, nome text NOT NULL);
CREATE TABLE public.servico_pedidos (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), escola_id uuid NOT NULL, aluno_id uuid NOT NULL, matricula_id uuid NOT NULL, servico_escola_id uuid NOT NULL, status text NOT NULL, servico_codigo text NOT NULL, servico_nome text NOT NULL, valor_cobrado numeric NOT NULL, created_by uuid, created_at timestamptz DEFAULT now());
CREATE TABLE public.pagamento_intents (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), escola_id uuid NOT NULL, aluno_id uuid NOT NULL, servico_pedido_id uuid NOT NULL REFERENCES public.servico_pedidos(id), amount numeric NOT NULL, status text NOT NULL, method text NOT NULL, created_by uuid, created_at timestamptz DEFAULT now());
CREATE TABLE public.audit_logs (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, escola_id uuid, actor_id uuid, action text, entity text, entity_id text, portal text, details jsonb);
INSERT INTO public.alunos VALUES ('00000000-0000-4000-8000-000000000102','00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000103',null);
INSERT INTO public.anos_letivos VALUES ('00000000-0000-4000-8000-000000000104','00000000-0000-4000-8000-000000000101',true),('00000000-0000-4000-8000-000000000105','00000000-0000-4000-8000-000000000101',false);
INSERT INTO public.matriculas(id,escola_id,aluno_id,session_id,status) VALUES
('00000000-0000-4000-8000-000000000106','00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000102','00000000-0000-4000-8000-000000000104','ativa'),
('00000000-0000-4000-8000-000000000107','00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000102','00000000-0000-4000-8000-000000000105','trancada'),
('00000000-0000-4000-8000-000000000108','00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000102','00000000-0000-4000-8000-000000000104','transferida');
INSERT INTO public.servicos_escola VALUES ('00000000-0000-4000-8000-000000000109','00000000-0000-4000-8000-000000000101','DOC_BOLETIM_TRIMESTRAL',true,150,false,'Boletim trimestral');
