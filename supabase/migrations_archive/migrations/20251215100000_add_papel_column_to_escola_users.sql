-- Ensure escola_users has the expected 'papel' column used by the app
-- Idempotent: only adds/backfills when column is missing

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'escola_users'
      AND column_name = 'papel'
  ) THEN
    ALTER TABLE public.escola_users
      ADD COLUMN papel text;

    -- Backfill from legacy role values when present
    UPDATE public.escola_users
      SET papel = CASE
        WHEN role IN ('admin','staff_admin','financeiro','secretaria','aluno','professor','admin_escola') THEN role
        WHEN role = 'staff' THEN 'staff_admin'
        ELSE COALESCE(role, 'secretaria')
      END;

    ALTER TABLE public.escola_users
      ALTER COLUMN papel SET NOT NULL,
      ALTER COLUMN papel SET DEFAULT 'secretaria';
  END IF;
END $$;

-- Constrain allowed values for papel (matches application allowedPapeis)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'escola_users_papel_check'
      AND conrelid = 'public.escola_users'::regclass
  ) THEN
    ALTER TABLE public.escola_users
      ADD CONSTRAINT escola_users_papel_check
      CHECK (papel IN ('admin','staff_admin','financeiro','secretaria','aluno','professor','admin_escola'));
  END IF;
END $$;

