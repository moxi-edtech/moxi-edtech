-- Runs only after bootstrap_grade_period_guard.sql in a disposable database.
-- The base grade writer bootstrap deliberately contains minimal schemas.
ALTER TABLE public.calendario_templates ADD COLUMN IF NOT EXISTS nome text;
ALTER TABLE public.calendario_templates ADD COLUMN IF NOT EXISTS data_inicio date;
ALTER TABLE public.calendario_templates ADD COLUMN IF NOT EXISTS data_fim date;
ALTER TABLE public.calendario_templates ADD COLUMN IF NOT EXISTS versao_documento text;
ALTER TABLE public.calendario_templates ADD COLUMN IF NOT EXISTS fonte_nome text;
ALTER TABLE public.calendario_templates ADD COLUMN IF NOT EXISTS fonte_referencia text;
ALTER TABLE public.calendario_templates ADD COLUMN IF NOT EXISTS fonte_documento_url text;
ALTER TABLE public.calendario_templates ADD COLUMN IF NOT EXISTS subsistema text;

ALTER TABLE public.calendario_template_items ADD COLUMN IF NOT EXISTS peso smallint;
ALTER TABLE public.calendario_eventos ADD COLUMN IF NOT EXISTS offering_id uuid;

CREATE TABLE IF NOT EXISTS public.cursos (
  id uuid PRIMARY KEY, escola_id uuid NOT NULL, nome text NOT NULL
);
CREATE TABLE IF NOT EXISTS public.school_education_offerings (
  id uuid PRIMARY KEY,
  escola_id uuid NOT NULL,
  course_id uuid REFERENCES public.cursos(id),
  education_subsystem text NOT NULL,
  calendar_profile_id uuid NOT NULL REFERENCES public.calendario_templates(id)
);
ALTER TABLE public.calendario_eventos
  ADD CONSTRAINT uq_calendario_eventos
  UNIQUE (escola_id,ano_letivo_id,nome,data_inicio);

INSERT INTO public.calendario_templates
  (id,ano_base,nome,data_inicio,data_fim,estado,is_oficial,
   versao_documento,fonte_nome,fonte_referencia,subsistema)
SELECT
  ('b5d7b33a-8a77-4d74-9c65-20262027000' || n)::uuid,
  2026,'Perfil MED '||n,'2026-09-01','2027-08-31','PUBLICADO',true,
  'FINAL-ACTUALIZADO','Ministério da Educação da República de Angola',
  'Referência normativa do subsistema '||n,
  (ARRAY['REGULAR_ADULTOS','PRE_ESCOLAR','TECNICO_PROFISSIONAL','SECUNDARIO_PEDAGOGICO'])[n]
FROM generate_series(1,4) n;

INSERT INTO public.calendario_template_items
  (id,template_id,tipo,numero,nome,data_inicio,data_fim,peso)
SELECT gen_random_uuid(),t.id,'PERIODO_LETIVO',p.numero,
       p.numero||'º trimestre',p.data_inicio,p.data_fim,p.peso
FROM public.calendario_templates t
CROSS JOIN (VALUES
 (1,DATE '2026-09-01',DATE '2026-12-18',30::smallint),
 (2,DATE '2027-01-04',DATE '2027-04-09',30::smallint),
 (3,DATE '2027-04-26',DATE '2027-06-18',40::smallint)
) p(numero,data_inicio,data_fim,peso)
WHERE t.ano_base=2026;
