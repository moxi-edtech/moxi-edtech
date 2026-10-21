-- Disposable CI-only precondition for existing historical migration debt:
-- 20260202011000_backfill_pagamentos_aluno_id.sql references the column
-- before ANY real migration adds it. This file is copied to an ephemeral
-- GitHub runner migrations directory; it MUST NEVER be applied to production
-- or bundled in supabase/migrations in the repository.
ALTER TABLE public.pagamentos ADD COLUMN IF NOT EXISTS aluno_id uuid;
