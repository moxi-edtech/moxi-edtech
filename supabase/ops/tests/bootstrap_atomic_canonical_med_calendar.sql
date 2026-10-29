-- Isolated PostgreSQL grade-writer database only. Never run in production.
-- Adds columns that exist on the real project but are intentionally absent
-- from bootstrap_notas_writer_minimal.sql.
ALTER TABLE public.anos_letivos
  ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.anos_letivos ADD COLUMN IF NOT EXISTS data_inicio date;
ALTER TABLE public.anos_letivos ADD COLUMN IF NOT EXISTS data_fim date;
CREATE UNIQUE INDEX IF NOT EXISTS ano_escola_ano_atomic_test_uk
  ON public.anos_letivos(escola_id,ano);

ALTER TABLE public.periodos_letivos
  ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.periodos_letivos ADD COLUMN IF NOT EXISTS peso smallint;
ALTER TABLE public.periodos_letivos ADD COLUMN IF NOT EXISTS source_version text;
ALTER TABLE public.periodos_letivos ADD COLUMN IF NOT EXISTS applied_at timestamptz;
ALTER TABLE public.periodos_letivos ADD COLUMN IF NOT EXISTS applied_by uuid;
CREATE UNIQUE INDEX IF NOT EXISTS periodos_escola_ano_tipo_num_atomic_test_uk
  ON public.periodos_letivos(escola_id,ano_letivo_id,tipo,numero);

ALTER TABLE public.calendario_eventos ADD COLUMN IF NOT EXISTS source_version text;
ALTER TABLE public.calendario_eventos ADD COLUMN IF NOT EXISTS applied_at timestamptz;
ALTER TABLE public.calendario_eventos ADD COLUMN IF NOT EXISTS applied_by uuid;

ALTER TABLE public.school_education_offerings ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE public.school_education_offerings ADD COLUMN IF NOT EXISTS updated_at timestamptz;

ALTER TABLE public.calendario_template_items ADD COLUMN IF NOT EXISTS applies_to_all_offerings boolean NOT NULL DEFAULT true;
ALTER TABLE public.calendario_template_items ADD COLUMN IF NOT EXISTS education_subsystems text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.calendario_template_items ADD COLUMN IF NOT EXISTS education_levels text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.calendario_template_items ADD COLUMN IF NOT EXISTS grade_codes text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.calendario_template_items ADD COLUMN IF NOT EXISTS course_types text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.calendario_template_items ADD COLUMN IF NOT EXISTS cycles text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.school_education_offerings ADD COLUMN IF NOT EXISTS education_level text;
ALTER TABLE public.school_education_offerings ADD COLUMN IF NOT EXISTS cycle text;
ALTER TABLE public.school_education_offerings ADD COLUMN IF NOT EXISTS grades text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.cursos ADD COLUMN IF NOT EXISTS tipo text;

DO $type$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='tipo_evento_calendario'
    AND typnamespace='public'::regnamespace) THEN
    CREATE TYPE public.tipo_evento_calendario AS ENUM (
      'PERIODO_LETIVO','EXAME_ESCRITO','FERIADO','EXAME_ORAL',
      'PAUSA_PEDAGOGICA','PROVA_TRIMESTRAL'
    );
  END IF;
END;
$type$;
ALTER TABLE public.calendario_eventos
  ALTER COLUMN tipo TYPE public.tipo_evento_calendario USING tipo::public.tipo_evento_calendario;
