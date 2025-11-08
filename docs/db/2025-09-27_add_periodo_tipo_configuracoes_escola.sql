-- Adds periodo_tipo to configuracoes_escola and an index.
-- Run this in Supabase SQL editor or psql connected to your project.

-- 1) Add column if missing
ALTER TABLE IF EXISTS public.configuracoes_escola
  ADD COLUMN IF NOT EXISTS periodo_tipo text;

-- 2) Add CHECK constraint to restrict values (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.conname = 'configuracoes_escola_periodo_tipo_check'
      AND n.nspname = 'public'
  ) THEN
    ALTER TABLE public.configuracoes_escola
      ADD CONSTRAINT configuracoes_escola_periodo_tipo_check
      CHECK (periodo_tipo IN ('semestre', 'trimestre'));
  END IF;
END $$;

-- 3) Optional: make it NULLABLE (explicit, in case a previous migration set NOT NULL)
ALTER TABLE public.configuracoes_escola
  ALTER COLUMN periodo_tipo DROP NOT NULL;

-- 4) Index for faster filtering
CREATE INDEX IF NOT EXISTS idx_configuracoes_escola_periodo_tipo
  ON public.configuracoes_escola (periodo_tipo);

