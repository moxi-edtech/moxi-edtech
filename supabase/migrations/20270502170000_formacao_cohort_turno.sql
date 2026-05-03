-- Migration: Add structured Turno (Shift) to Formação
-- Date: 02/05/2026

BEGIN;

-- 1. Add turno to cohorts
ALTER TABLE public.formacao_cohorts 
ADD COLUMN IF NOT EXISTS turno text;

-- Add check constraint for common shifts
ALTER TABLE public.formacao_cohorts
DROP CONSTRAINT IF EXISTS formacao_cohorts_turno_check;

ALTER TABLE public.formacao_cohorts
ADD CONSTRAINT formacao_cohorts_turno_check 
CHECK (turno IN ('manha', 'tarde', 'noite', 'integral', 'fim_de_semana', 'pos_laboral'));

-- 2. Add preference to leads
ALTER TABLE public.formacao_leads
ADD COLUMN IF NOT EXISTS turno_preferencia text;

COMMIT;
