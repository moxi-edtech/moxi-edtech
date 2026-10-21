-- Disposable CI-only precondition for existing historical migration debt:
-- 20260202011000_backfill_pagamentos_aluno_id.sql references the column
-- before ANY real migration adds it. This file is copied to an ephemeral
-- GitHub runner migrations directory; it MUST NEVER be applied to production
-- or bundled in supabase/migrations in the repository.
ALTER TABLE public.pagamentos ADD COLUMN IF NOT EXISTS aluno_id uuid;
-- A SECOND historical dependency: the 20260202011100 RPC has parameters
-- public.pagamento_metodo and local enum public.pagamento_status, both of
-- which are otherwise created only by the 20260308000001 migration. The
-- exact later enum labels are staged early, only on the discarded runner.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='pagamento_metodo' AND typnamespace='public'::regnamespace) THEN
    CREATE TYPE public.pagamento_metodo AS ENUM ('cash','tpa','transfer','mcx');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='pagamento_status' AND typnamespace='public'::regnamespace) THEN
    CREATE TYPE public.pagamento_status AS ENUM ('pending','settled','rejected','voided');
  END IF;
END $$;

-- Historical March 2026 SQL function already resolves t.status_fecho,
-- although the identical production column is only created in November.
-- No fake data/table or policy bypass: advance only the existing NOT NULL
-- column/DEFAULT definition, which its later migration declares identically.
ALTER TABLE public.turmas
  ADD COLUMN IF NOT EXISTS status_fecho text DEFAULT 'ABERTO'::text NOT NULL;
