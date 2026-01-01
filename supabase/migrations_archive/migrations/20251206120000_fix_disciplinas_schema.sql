-- Ensure disciplinas table has the columns and unique constraint expected by the app
-- This migration is idempotent and only adds missing pieces.

DO $$
BEGIN
  IF to_regclass('public.disciplinas') IS NOT NULL THEN
    -- Add missing columns (kept nullable for safe backfill)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'disciplinas' AND column_name = 'curso_escola_id'
    ) THEN
      ALTER TABLE public.disciplinas
        ADD COLUMN curso_escola_id uuid REFERENCES public.cursos(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'disciplinas' AND column_name = 'classe_nome'
    ) THEN
      ALTER TABLE public.disciplinas
        ADD COLUMN classe_nome text;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'disciplinas' AND column_name = 'nivel_ensino'
    ) THEN
      ALTER TABLE public.disciplinas
        ADD COLUMN nivel_ensino text DEFAULT 'base';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'disciplinas' AND column_name = 'tipo'
    ) THEN
      ALTER TABLE public.disciplinas
        ADD COLUMN tipo text DEFAULT 'core' CHECK (tipo IN ('core','eletivo','extra'));
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'disciplinas' AND column_name = 'carga_horaria'
    ) THEN
      ALTER TABLE public.disciplinas
        ADD COLUMN carga_horaria integer DEFAULT 0;
    END IF;

    -- Ensure created_at exists (older table had it, but keep idempotent)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'disciplinas' AND column_name = 'created_at'
    ) THEN
      ALTER TABLE public.disciplinas
        ADD COLUMN created_at timestamptz DEFAULT now();
    END IF;

    -- Unique constraint for upsert on (curso_escola_id, classe_nome, nome)
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'unique_disciplina_por_classe'
    ) THEN
      ALTER TABLE public.disciplinas
        ADD CONSTRAINT unique_disciplina_por_classe UNIQUE (curso_escola_id, classe_nome, nome);
    END IF;

    -- Helpful indexes
    CREATE INDEX IF NOT EXISTS idx_disciplinas_curso ON public.disciplinas (curso_escola_id);
    CREATE INDEX IF NOT EXISTS idx_disciplinas_escola ON public.disciplinas (escola_id);

    -- Ensure RLS is enabled (policies are handled by previous migrations)
    ALTER TABLE public.disciplinas ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

