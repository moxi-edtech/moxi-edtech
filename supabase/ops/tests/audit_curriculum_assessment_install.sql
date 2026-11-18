\set ON_ERROR_STOP on
-- PostgreSQL 17 descartável: duas escolas, papéis autenticados, sem dados reais.
DO $$ BEGIN
 IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN
   CREATE ROLE authenticated NOLOGIN;
 END IF;
END $$;
GRANT USAGE ON SCHEMA public TO authenticated;
CREATE TABLE public.disciplinas_catalogo (
 id uuid PRIMARY KEY, escola_id uuid NOT NULL, nome text NOT NULL
);
CREATE TABLE public.curso_matriz (
 id uuid PRIMARY KEY, escola_id uuid NOT NULL, curso_id uuid NOT NULL,
 classe_id uuid NOT NULL, curso_curriculo_id uuid NOT NULL,
 disciplina_id uuid NOT NULL, avaliacao_disciplina_id uuid
);
CREATE TABLE public.turma_disciplinas (
 id uuid PRIMARY KEY, escola_id uuid NOT NULL,
 turma_id uuid NOT NULL, curso_matriz_id uuid NOT NULL,
 avaliacao_disciplina_id uuid, professor_id uuid
);
CREATE TABLE public.notas (id uuid PRIMARY KEY, valor numeric);
ALTER TABLE public.disciplinas_catalogo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curso_matriz ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turma_disciplinas ENABLE ROW LEVEL SECURITY;
CREATE POLICY dc_school ON public.disciplinas_catalogo TO authenticated
USING (escola_id=nullif(current_setting('test.school',true),'')::uuid);
CREATE POLICY cm_school ON public.curso_matriz TO authenticated
USING (escola_id=nullif(current_setting('test.school',true),'')::uuid);
CREATE POLICY td_school ON public.turma_disciplinas TO authenticated
USING (escola_id=nullif(current_setting('test.school',true),'')::uuid)
WITH CHECK (escola_id=nullif(current_setting('test.school',true),'')::uuid);
GRANT SELECT ON public.disciplinas_catalogo,public.curso_matriz TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.turma_disciplinas TO authenticated;

INSERT INTO public.disciplinas_catalogo VALUES
('00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000001','Matemática'),
('00000000-0000-4000-8000-000000000102','00000000-0000-4000-8000-000000000001','Avaliação de Matemática'),
('00000000-0000-4000-8000-000000000103','00000000-0000-4000-8000-000000000001','História'),
('00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000002','Biologia');
INSERT INTO public.curso_matriz VALUES
('00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000031','00000000-0000-4000-8000-000000000101',NULL),
('00000000-0000-4000-8000-000000000302','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000031','00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000102'),
('00000000-0000-4000-8000-000000000303','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000031','00000000-0000-4000-8000-000000000103',NULL),
('00000000-0000-4000-8000-000000000401','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000012','00000000-0000-4000-8000-000000000022','00000000-0000-4000-8000-000000000032','00000000-0000-4000-8000-000000000201',NULL);
INSERT INTO public.notas VALUES ('00000000-0000-4000-8000-000000000901',17);

\ir ../../migrations/20271118120000_guard_turma_assessment_identity_install.sql

SELECT set_config('test.school','00000000-0000-4000-8000-000000000001',false);
SET ROLE authenticated;
-- Herança sem disciplina avaliada explícita deve resolver o catálogo.
INSERT INTO public.turma_disciplinas(id,escola_id,turma_id,curso_matriz_id)
VALUES ('00000000-0000-4000-8000-000000000501','00000000-0000-4000-8000-000000000001',
'00000000-0000-4000-8000-000000000601','00000000-0000-4000-8000-000000000301');
DO $$ BEGIN
 IF (SELECT avaliacao_disciplina_id FROM public.turma_disciplinas
   WHERE id='00000000-0000-4000-8000-000000000501')
   IS DISTINCT FROM '00000000-0000-4000-8000-000000000101'::uuid THEN
   RAISE EXCEPTION 'Herança da disciplina não foi aplicada'; END IF;
END $$;

-- Quando a matriz tem identidade explícita, esta prevalece.
INSERT INTO public.turma_disciplinas(id,escola_id,turma_id,curso_matriz_id)
VALUES ('00000000-0000-4000-8000-000000000502','00000000-0000-4000-8000-000000000001',
'00000000-0000-4000-8000-000000000601','00000000-0000-4000-8000-000000000302');
DO $$ BEGIN
 IF (SELECT avaliacao_disciplina_id FROM public.turma_disciplinas
   WHERE id='00000000-0000-4000-8000-000000000502')
   IS DISTINCT FROM '00000000-0000-4000-8000-000000000102'::uuid THEN
   RAISE EXCEPTION 'Avaliação explícita não foi aplicada'; END IF;
END $$;
DO $$ BEGIN
 BEGIN
  INSERT INTO public.turma_disciplinas(id,escola_id,turma_id,curso_matriz_id,avaliacao_disciplina_id)
  VALUES ('00000000-0000-4000-8000-000000000503','00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000601','00000000-0000-4000-8000-000000000301',
  '00000000-0000-4000-8000-000000000103');
  RAISE EXCEPTION 'Aceitou disciplina de avaliação incompatível';
 EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN
  INSERT INTO public.turma_disciplinas(id,escola_id,turma_id,curso_matriz_id)
  VALUES ('00000000-0000-4000-8000-000000000504','00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000601','00000000-0000-4000-8000-000000000401');
  RAISE EXCEPTION 'Aceitou matriz de outra escola';
 EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN
  UPDATE public.turma_disciplinas SET avaliacao_disciplina_id='00000000-0000-4000-8000-000000000103'
   WHERE id='00000000-0000-4000-8000-000000000501';
  RAISE EXCEPTION 'Aceitou alteração manual incompatível';
 EXCEPTION WHEN check_violation THEN NULL; END;
END $$;

-- Trocar a matriz recompõe apenas o identificador curricular, sem tocar notas.
UPDATE public.turma_disciplinas
  SET curso_matriz_id='00000000-0000-4000-8000-000000000303'
  WHERE id='00000000-0000-4000-8000-000000000501';
DO $$ BEGIN
 IF (SELECT avaliacao_disciplina_id FROM public.turma_disciplinas
   WHERE id='00000000-0000-4000-8000-000000000501')
   IS DISTINCT FROM '00000000-0000-4000-8000-000000000103'::uuid THEN
   RAISE EXCEPTION 'Troca de matriz manteve identidade anterior'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.notas WHERE valor=17) <> 1
   OR (SELECT count(*) FROM public.turma_disciplinas) <> 2 THEN
   RAISE EXCEPTION 'Notas modificadas ou gravações incompatíveis inseridas'; END IF;
 IF NOT EXISTS (
   SELECT 1 FROM pg_constraint WHERE conname='turma_disciplinas_avaliacao_identidade_nn'
   AND convalidated
 ) THEN RAISE EXCEPTION 'Constraint de integridade não validada'; END IF;
END $$;
