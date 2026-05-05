-- Migration: 20270505000000_add_escola_onboarding_fields.sql
-- Description: Adds missing columns to the escolas table to support the new academic onboarding flow.

BEGIN;

ALTER TABLE public.escolas 
ADD COLUMN IF NOT EXISTS needs_academic_setup BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS dados_pagamento JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS onboarding_completed_by UUID;

-- Add foreign key constraint for onboarding_completed_by if auth.users exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'auth' AND tablename = 'users') THEN
    ALTER TABLE public.escolas 
    ADD CONSTRAINT fk_escolas_onboarding_completed_by 
    FOREIGN KEY (onboarding_completed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Update existing schools to have needs_academic_setup = false if they already finished onboarding
UPDATE public.escolas 
SET needs_academic_setup = FALSE 
WHERE onboarding_finalizado = TRUE;

COMMIT;
