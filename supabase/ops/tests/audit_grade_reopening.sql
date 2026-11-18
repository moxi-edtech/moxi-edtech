\set ON_ERROR_STOP on
-- AUD-P1: PostgreSQL 17 descartável. Todas as identidades são sintéticas.
DO $$ BEGIN
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
END $$;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
 AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
GRANT USAGE ON SCHEMA auth,public TO authenticated,anon;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon;
CREATE FUNCTION public.current_tenant_escola_id() RETURNS uuid LANGUAGE sql STABLE
 AS $$SELECT nullif(current_setting('request.jwt.claim.escola_id',true),'')::uuid$$;
CREATE FUNCTION public.check_super_admin_role() RETURNS boolean LANGUAGE sql STABLE AS $$SELECT false$$;
GRANT EXECUTE ON FUNCTION public.current_tenant_escola_id(),public.check_super_admin_role() TO authenticated;

CREATE TABLE public.escolas(id uuid PRIMARY KEY);
CREATE TABLE public.anos_letivos(id uuid PRIMARY KEY,escola_id uuid,ano integer);
CREATE TABLE public.escola_users(escola_id uuid,user_id uuid,papel text);
CREATE TABLE public.disciplinas_catalogo(id uuid PRIMARY KEY,escola_id uuid,nome text);
CREATE TABLE public.turmas(id uuid PRIMARY KEY,escola_id uuid,ano_letivo_id uuid,ano_letivo integer);
CREATE TABLE public.curso_curriculos(id uuid PRIMARY KEY,escola_id uuid,ano_letivo_id uuid,status text);
CREATE TABLE public.curso_matriz(id uuid PRIMARY KEY,escola_id uuid,curso_curriculo_id uuid,disciplina_id uuid,avaliacao_disciplina_id uuid);
CREATE TABLE public.professores(id uuid PRIMARY KEY,escola_id uuid,profile_id uuid);
CREATE TABLE public.turma_disciplinas(id uuid PRIMARY KEY,escola_id uuid,turma_id uuid,curso_matriz_id uuid,avaliacao_disciplina_id uuid,professor_id uuid);
CREATE TABLE public.turma_disciplinas_professores(escola_id uuid,turma_id uuid,disciplina_id uuid,professor_id uuid);
CREATE TABLE public.avaliacoes(id uuid PRIMARY KEY,escola_id uuid,turma_disciplina_id uuid,trimestre integer);
CREATE TABLE public.excecoes_pauta(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),escola_id uuid,turma_id uuid,
 disciplina_id uuid,trimestre integer,user_id uuid,motivo text,
 expira_em timestamptz,criado_por uuid,solicitado_por uuid,
 aprovado_por uuid,decidido_em timestamptz,ano_letivo_id uuid,status text,
 decisao_motivo text,created_at timestamptz DEFAULT now()
);
CREATE TABLE public.notas(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),escola_id uuid,avaliacao_id uuid,nota numeric);
GRANT SELECT ON public.escola_users TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.excecoes_pauta TO authenticated;
GRANT SELECT,INSERT ON public.notas TO authenticated;
ALTER TABLE public.excecoes_pauta ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_all_access ON public.excecoes_pauta FOR ALL TO authenticated
USING (escola_id=public.current_tenant_escola_id()) WITH CHECK (escola_id=public.current_tenant_escola_id());

INSERT INTO public.escolas VALUES ('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');
INSERT INTO public.anos_letivos VALUES
('00000000-0000-4000-8000-000000001201','00000000-0000-4000-8000-000000000001',2026),
('00000000-0000-4000-8000-000000001202','00000000-0000-4000-8000-000000000002',2026);
INSERT INTO public.escola_users VALUES
('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000101','diretor'),
('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000102','professor'),
('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000103','admin_financeiro'),
('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000202','professor'),
('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000201','diretor');
INSERT INTO public.disciplinas_catalogo VALUES
('00000000-0000-4000-8000-000000001401','00000000-0000-4000-8000-000000000001','Matemática'),
('00000000-0000-4000-8000-000000001402','00000000-0000-4000-8000-000000000002','Matemática');
INSERT INTO public.turmas VALUES
('00000000-0000-4000-8000-000000001501','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000001201',2026),
('00000000-0000-4000-8000-000000001502','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000001202',2026);
INSERT INTO public.curso_curriculos VALUES
('00000000-0000-4000-8000-000000001301','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000001201','published'),
('00000000-0000-4000-8000-000000001302','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000001202','published');
INSERT INTO public.curso_matriz VALUES
('00000000-0000-4000-8000-000000001601','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000001301','00000000-0000-4000-8000-000000001401',null),
('00000000-0000-4000-8000-000000001602','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000001302','00000000-0000-4000-8000-000000001402',null);
INSERT INTO public.professores VALUES
('00000000-0000-4000-8000-000000001801','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000102'),
('00000000-0000-4000-8000-000000001802','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000202');
INSERT INTO public.turma_disciplinas VALUES
('00000000-0000-4000-8000-000000001701','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000001501','00000000-0000-4000-8000-000000001601',null,'00000000-0000-4000-8000-000000001801'),
('00000000-0000-4000-8000-000000001702','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000001502','00000000-0000-4000-8000-000000001602',null,'00000000-0000-4000-8000-000000001802');
INSERT INTO public.avaliacoes VALUES
('00000000-0000-4000-8000-000000001901','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000001701',1),
('00000000-0000-4000-8000-000000001902','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000001702',1);

\ir ../../migrations/20271118100000_audit_grade_reopen_subject_resolution.sql
\ir ../../migrations/20271118101000_grade_reopen_rls_guard.sql
DO $$ BEGIN
 IF (SELECT avaliacao_disciplina_id FROM public.turma_disciplinas
     WHERE id='00000000-0000-4000-8000-000000001701') IS NULL THEN
   RAISE EXCEPTION 'Migração não reconciliou a disciplina avaliada'; END IF;
 IF EXISTS(SELECT 1 FROM pg_policies WHERE tablename='excecoes_pauta' AND policyname='tenant_all_access') THEN
   RAISE EXCEPTION 'Policy tenant_all_access insegura permaneceu activa'; END IF;
END $$;

-- Mesma função de autorização da pauta; execução em DB descartável.
CREATE FUNCTION public.can_bypass_pauta_lock(p_escola_id uuid,p_turma_id uuid,p_avaliacao_id uuid,p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT p_user_id=auth.uid() AND EXISTS(
   SELECT 1 FROM public.avaliacoes a JOIN public.turma_disciplinas td ON td.id=a.turma_disciplina_id
   JOIN public.excecoes_pauta e ON e.escola_id=p_escola_id AND e.turma_id=td.turma_id
   JOIN public.turmas t ON t.id=td.turma_id AND t.escola_id=p_escola_id
   JOIN public.anos_letivos y ON y.id=e.ano_letivo_id AND y.escola_id=p_escola_id AND y.ano=t.ano_letivo
   WHERE a.id=p_avaliacao_id AND a.escola_id=p_escola_id AND td.escola_id=p_escola_id
     AND td.turma_id=p_turma_id AND e.user_id=p_user_id AND e.status='APROVADO' AND e.expira_em>now()
     AND (e.trimestre IS NULL OR e.trimestre=a.trimestre)
     AND (e.disciplina_id IS NULL OR e.disciplina_id=td.avaliacao_disciplina_id));
$$;
GRANT EXECUTE ON FUNCTION public.can_bypass_pauta_lock(uuid,uuid,uuid,uuid) TO authenticated;
CREATE FUNCTION public.notas_guard_reabertura() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
BEGIN
 IF NOT public.can_bypass_pauta_lock(NEW.escola_id,
   (SELECT td.turma_id FROM public.avaliacoes a JOIN public.turma_disciplinas td
    ON td.id=a.turma_disciplina_id WHERE a.id=NEW.avaliacao_id),
   NEW.avaliacao_id,auth.uid()) THEN
   RAISE EXCEPTION 'pauta_bloqueada' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER notas_guard_reabertura BEFORE INSERT ON public.notas
FOR EACH ROW EXECUTE FUNCTION public.notas_guard_reabertura();
ALTER TABLE public.notas ENABLE ROW LEVEL SECURITY;
CREATE POLICY notas_own_school ON public.notas FOR ALL TO authenticated
USING (escola_id=public.current_tenant_escola_id())
WITH CHECK (escola_id=public.current_tenant_escola_id());

SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000102',false);
SELECT set_config('request.jwt.claim.escola_id','00000000-0000-4000-8000-000000000001',false);
SET ROLE authenticated;
DO $$ DECLARE v_count integer; BEGIN
 IF public.can_bypass_pauta_lock('00000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000001501','00000000-0000-4000-8000-000000001901',auth.uid()) THEN
   RAISE EXCEPTION 'Pauta desbloqueada antes da aprovação'; END IF;
 BEGIN
  INSERT INTO public.notas(escola_id,avaliacao_id,nota) VALUES
  ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000001901',16);
  RAISE EXCEPTION 'Nota escrita antes de aprovação';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
INSERT INTO public.excecoes_pauta(escola_id,turma_id,disciplina_id,disciplina_catalogo_id,
 trimestre,user_id,motivo,expira_em,criado_por,solicitado_por,ano_letivo_id,status)
VALUES (
'00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000001501',
'00000000-0000-4000-8000-000000001401','00000000-0000-4000-8000-000000001401',
1,'00000000-0000-4000-8000-000000000102','Reabrir avaliação para rectificação',
now()+interval '24 hours','00000000-0000-4000-8000-000000000102',
'00000000-0000-4000-8000-000000000102','00000000-0000-4000-8000-000000001201','PENDENTE');
DO $$ DECLARE v_count integer; BEGIN
 BEGIN
  INSERT INTO public.excecoes_pauta(escola_id,turma_id,disciplina_id,disciplina_catalogo_id,
  trimestre,user_id,motivo,expira_em,criado_por,solicitado_por,ano_letivo_id,status)
  VALUES ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000001501',
  '00000000-0000-4000-8000-000000001401','00000000-0000-4000-8000-000000001401',
  1,auth.uid(),'Duplicado',now()+interval '24 hours',auth.uid(),auth.uid(),
  '00000000-0000-4000-8000-000000001201','PENDENTE');
  RAISE EXCEPTION 'Pedido duplicado autorizado';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 UPDATE public.excecoes_pauta SET status='APROVADO',aprovado_por=auth.uid(),decidido_em=now()
 WHERE escola_id='00000000-0000-4000-8000-000000000001';
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count<>0 THEN RAISE EXCEPTION 'Docente aprovou o próprio pedido'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000201',false);
SELECT set_config('request.jwt.claim.escola_id','00000000-0000-4000-8000-000000000002',false);
SET ROLE authenticated;
DO $$ DECLARE v_count integer; BEGIN
 IF (SELECT count(*) FROM public.excecoes_pauta)<>0 THEN RAISE EXCEPTION 'Escola B leu pedido A'; END IF;
 UPDATE public.excecoes_pauta SET status='APROVADO',aprovado_por=auth.uid(),decidido_em=now()
 WHERE escola_id='00000000-0000-4000-8000-000000000001';
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count<>0 THEN RAISE EXCEPTION 'Escola B aprovou pedido A'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',false);
SELECT set_config('request.jwt.claim.escola_id','00000000-0000-4000-8000-000000000001',false);
SET ROLE authenticated;
UPDATE public.excecoes_pauta
SET status='APROVADO',aprovado_por=auth.uid(),decidido_em=now(),
    expira_em=now()+interval '24 hours'
WHERE escola_id='00000000-0000-4000-8000-000000000001' AND status='PENDENTE';
DO $$ BEGIN
 IF (SELECT count(*) FROM public.excecoes_pauta WHERE status='APROVADO')<>1 THEN
 RAISE EXCEPTION 'Direção não aprovou o pedido'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000102',false);
SET ROLE authenticated;
DO $$ BEGIN
 IF NOT public.can_bypass_pauta_lock('00000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000001501','00000000-0000-4000-8000-000000001901',auth.uid()) THEN
   RAISE EXCEPTION 'Aprovação não desbloqueou a pauta'; END IF;
END $$;
INSERT INTO public.notas(escola_id,avaliacao_id,nota) VALUES
('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000001901',16);
DO $$ BEGIN
 IF (SELECT count(*) FROM public.notas WHERE nota=16)<>1 THEN
 RAISE EXCEPTION 'Nota não persistiu e não pôde ser lida'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',false);
SET ROLE authenticated;
UPDATE public.excecoes_pauta
SET status='EXPIRADO',aprovado_por=auth.uid(),decidido_em=now(),
    decisao_motivo='Revogado pela Direção',expira_em=now()
WHERE escola_id='00000000-0000-4000-8000-000000000001' AND status='APROVADO';
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000102',false);
SET ROLE authenticated;
DO $$ BEGIN
 IF public.can_bypass_pauta_lock('00000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000001501','00000000-0000-4000-8000-000000001901',auth.uid()) THEN
   RAISE EXCEPTION 'Revogação não bloqueou a pauta'; END IF;
 BEGIN
  INSERT INTO public.notas(escola_id,avaliacao_id,nota) VALUES
  ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000001901',18);
  RAISE EXCEPTION 'Nota escrita após revogação';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF (SELECT count(*) FROM public.notas WHERE nota=16)<>1 THEN
   RAISE EXCEPTION 'Revogação apagou nota válida'; END IF;
END $$;
RESET ROLE;
