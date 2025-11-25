ALTER TABLE public.staging_alunos
  ADD COLUMN IF NOT EXISTS curso_codigo   text,
  ADD COLUMN IF NOT EXISTS classe_label   text,
  ADD COLUMN IF NOT EXISTS turno_codigo   text,
  ADD COLUMN IF NOT EXISTS turma_label    text,
  ADD COLUMN IF NOT EXISTS ano_letivo_raw text;

ALTER TABLE public.staging_alunos
  ADD COLUMN IF NOT EXISTS ano_letivo_inicio integer;

CREATE OR REPLACE FUNCTION public.extract_ano_letivo_inicio(raw text)
RETURNS integer
LANGUAGE sql
AS $$
  SELECT NULLIF(regexp_replace(raw, '^(\d{4}).*$', '\1'), '')::integer
$$;

UPDATE public.staging_alunos
SET ano_letivo_inicio = public.extract_ano_letivo_inicio(ano_letivo_raw)
WHERE ano_letivo_raw IS NOT NULL;
