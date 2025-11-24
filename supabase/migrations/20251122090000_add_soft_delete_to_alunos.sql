-- Add soft-delete metadata to alunos
-- - deleted_at: marcação de remoção lógica
-- - deleted_by: quem executou (profiles.user_id)
-- - deletion_reason: motivo textual

ALTER TABLE public.alunos
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid,
  ADD COLUMN IF NOT EXISTS deletion_reason text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'alunos_deleted_by_fkey'
  ) THEN
    ALTER TABLE public.alunos
      ADD CONSTRAINT alunos_deleted_by_fkey
      FOREIGN KEY (deleted_by)
      REFERENCES public.profiles(user_id)
      ON DELETE SET NULL;
  END IF;
END$$;

