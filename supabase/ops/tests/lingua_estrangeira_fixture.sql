CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth TO authenticated, anon;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.actor',true),'')::uuid $$;
CREATE FUNCTION public.current_tenant_escola_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.tenant',true),'')::uuid $$;
CREATE TABLE public.profiles(user_id uuid, role text, deleted_at timestamptz);
CREATE TABLE public.escola_users(escola_id uuid,user_id uuid,papel text,role text);
CREATE TABLE public.configuracoes_pedagogicas(escola_id uuid PRIMARY KEY, negativas_para_reprovar integer NOT NULL DEFAULT 3, media_minima_aprovacao numeric DEFAULT 10, updated_at timestamptz DEFAULT now(),updated_by uuid);
CREATE TABLE public.audit_logs(escola_id uuid,user_id uuid,actor_id uuid,portal text,action text,entity text,entity_id text,"before" jsonb,"after" jsonb,acao text,tabela text,registro_id text);
ALTER TABLE public.configuracoes_pedagogicas ENABLE ROW LEVEL SECURITY;
GRANT SELECT,UPDATE ON public.configuracoes_pedagogicas TO authenticated;
CREATE POLICY read_tenant ON public.configuracoes_pedagogicas FOR SELECT TO authenticated USING(escola_id=public.current_tenant_escola_id());
INSERT INTO public.profiles VALUES ('00000000-0000-0000-0000-000000000011','admin',null),('00000000-0000-0000-0000-000000000012','professor',null),('00000000-0000-0000-0000-000000000013','admin',now()),('00000000-0000-0000-0000-000000000014','admin',null);
INSERT INTO public.escola_users VALUES
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000011','admin_escola',null),
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000012','professor',null),
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000013','admin_escola',null),
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000014','admin_escola',null);
INSERT INTO public.configuracoes_pedagogicas(escola_id,negativas_para_reprovar) VALUES ('00000000-0000-0000-0000-000000000001',7);
