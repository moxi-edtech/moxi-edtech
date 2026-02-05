ALTER TABLE public.anos_letivos
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.periodos_letivos
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
