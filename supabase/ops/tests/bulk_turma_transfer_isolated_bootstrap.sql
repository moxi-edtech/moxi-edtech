-- AUT-002: executar SOMENTE numa base PostgreSQL EFÉMERA/Vazia.
-- Não executar este bootstrap no Supabase de produção ou staging com dados reais.
-- psql "$PGURL" -v ON_ERROR_STOP=1 -f supabase/ops/tests/bulk_turma_transfer_isolated_bootstrap.sql
CREATE SCHEMA IF NOT EXISTS auth;
DO $role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
END
$role$;
GRANT USAGE ON SCHEMA auth, public TO authenticated, anon;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
AS $$ SELECT nullif(current_setting('test.actor', true), '')::uuid $$;

CREATE TABLE public.transfer_roles (escola_id uuid, actor_id uuid, role text,
  PRIMARY KEY(escola_id, actor_id, role));
CREATE OR REPLACE FUNCTION public.current_tenant_escola_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$ SELECT nullif(current_setting('test.school', true), '')::uuid $$;
CREATE OR REPLACE FUNCTION public.user_has_role_in_school(p_school uuid, p_roles text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$ SELECT EXISTS(SELECT 1 FROM public.transfer_roles r WHERE r.escola_id=p_school
    AND r.actor_id=auth.uid() AND r.role=ANY(p_roles)) $$;
CREATE OR REPLACE FUNCTION public.canonicalize_matricula_status_text(p_status text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path=''
AS $$ SELECT CASE WHEN p_status IN ('ativo','ativa','active','matriculado')
       THEN 'ativo' ELSE p_status END $$;

CREATE TABLE public.anos_letivos(
  id uuid PRIMARY KEY, escola_id uuid NOT NULL, ano int NOT NULL, ativo boolean NOT NULL
);
CREATE TABLE public.turmas(
  id uuid PRIMARY KEY, escola_id uuid NOT NULL, classe_id uuid, curso_id uuid,
  ano_letivo int, session_id uuid, ano_letivo_id uuid,
  status_validacao text, status_fecho text, capacidade_maxima integer
);
CREATE TABLE public.matriculas(
  id uuid PRIMARY KEY, escola_id uuid NOT NULL, aluno_id uuid NOT NULL,
  turma_id uuid NOT NULL REFERENCES public.turmas(id), session_id uuid,
  ano_letivo int, status text, ativo boolean,
  updated_at timestamptz, updated_by uuid
);
CREATE TABLE public.notas(
  id uuid PRIMARY KEY, escola_id uuid NOT NULL,
  matricula_id uuid REFERENCES public.matriculas(id), valor numeric
);
CREATE TABLE public.exame_resultados(
  id uuid PRIMARY KEY, escola_id uuid NOT NULL,
  matricula_id uuid REFERENCES public.matriculas(id)
);
CREATE TABLE public.frequencias(
  id uuid PRIMARY KEY, escola_id uuid NOT NULL,
  matricula_id uuid REFERENCES public.matriculas(id)
);
CREATE TABLE public.frequencia_status_periodo(
  id uuid PRIMARY KEY, escola_id uuid NOT NULL,
  matricula_id uuid REFERENCES public.matriculas(id)
);
CREATE TABLE public.presencas(
  id uuid PRIMARY KEY, escola_id uuid NOT NULL,
  aluno_id uuid, turma_id uuid
);
CREATE TABLE public.audit_logs(
  id bigserial PRIMARY KEY, escola_id uuid, actor_id uuid, action text, entity text,
  entity_id text, portal text, details jsonb, before jsonb, after jsonb,
  created_at timestamptz DEFAULT now()
);

-- Testar RLS *mais* validação dentro das funções SECURITY DEFINER:
-- uma política permissiva para cada escola nunca substitui a role check no RPC.
ALTER TABLE public.matriculas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turmas ENABLE ROW LEVEL SECURITY;
CREATE POLICY turma_escola_read ON public.turmas FOR SELECT TO authenticated
  USING (escola_id = public.current_tenant_escola_id());
CREATE POLICY matricula_escola_read ON public.matriculas FOR SELECT TO authenticated
  USING (escola_id = public.current_tenant_escola_id());
GRANT SELECT ON public.turmas, public.matriculas, public.audit_logs TO authenticated;

INSERT INTO public.anos_letivos VALUES
('00000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000001',2026,true),
('00000000-0000-4000-8000-000000000007','00000000-0000-4000-8000-000000000001',2027,false);
INSERT INTO public.turmas VALUES
-- source A 2 pupils, destination B 0 pupils, source C 1 pupil
('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000005',2026,'00000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000006','ativo','ABERTO',3),
('00000000-0000-4000-8000-000000000012','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000005',2026,'00000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000006','ativo','ABERTO',2),
('00000000-0000-4000-8000-000000000013','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000005',2026,'00000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000006','ativo','ABERTO',3),
-- incompatible: school, class, course, year, status
('00000000-0000-4000-8000-000000000014','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000005',2026,'00000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000006','ativo','ABERTO',3),
('00000000-0000-4000-8000-000000000015','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000099','00000000-0000-4000-8000-000000000005',2026,'00000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000006','ativo','ABERTO',3),
('00000000-0000-4000-8000-000000000016','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000099',2026,'00000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000006','ativo','ABERTO',3),
('00000000-0000-4000-8000-000000000017','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000005',2027,'00000000-0000-4000-8000-000000000007','00000000-0000-4000-8000-000000000007','ativo','ABERTO',3),
('00000000-0000-4000-8000-000000000018','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000005',2026,'00000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000006','arquivado','ABERTO',3),
('00000000-0000-4000-8000-000000000019','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000005',2026,'00000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000006','ativo','ABERTO',1);
INSERT INTO public.matriculas(id,escola_id,aluno_id,turma_id,session_id,ano_letivo,status,ativo) VALUES
('00000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000006',2026,'ativo',true),
('00000000-0000-4000-8000-000000000022','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000102','00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000006',2026,'ativo',true),
('00000000-0000-4000-8000-000000000023','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000103','00000000-0000-4000-8000-000000000013','00000000-0000-4000-8000-000000000006',2026,'ativo',true),
('00000000-0000-4000-8000-000000000024','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000104','00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000006',2026,'concluido',false);
INSERT INTO public.transfer_roles VALUES
('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000031','secretaria'),
('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000032','admin_escola'),
('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000033','professor');
