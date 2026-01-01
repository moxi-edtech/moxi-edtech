-- Add missing email column to public.alunos used by import and UI flows
ALTER TABLE public.alunos
  ADD COLUMN IF NOT EXISTS email text;

-- Optional indexes to speed up lookups by email
CREATE INDEX IF NOT EXISTS alunos_email_idx ON public.alunos(email);
CREATE INDEX IF NOT EXISTS alunos_escola_email_idx ON public.alunos(escola_id, email);
