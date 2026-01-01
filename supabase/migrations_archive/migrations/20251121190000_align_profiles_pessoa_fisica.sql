-- Pessoa física centralizada em public.profiles

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS data_nascimento date,
  ADD COLUMN IF NOT EXISTS sexo text,
  ADD COLUMN IF NOT EXISTS bi_numero text,
  ADD COLUMN IF NOT EXISTS naturalidade text,
  ADD COLUMN IF NOT EXISTS provincia text,
  ADD COLUMN IF NOT EXISTS telefone text,
  ADD COLUMN IF NOT EXISTS encarregado_relacao text;

-- Opcional (só depois de checar que não há duplicado)
-- CREATE UNIQUE INDEX IF NOT EXISTS profiles_bi_numero_key
--   ON public.profiles(bi_numero)
--   WHERE bi_numero IS NOT NULL;
