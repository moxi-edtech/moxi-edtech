-- Add capacidade_maxima to turmas table

ALTER TABLE public.turmas
ADD COLUMN IF NOT EXISTS capacidade_maxima INTEGER;
