-- Migration: 20260302000007_make_audit_logs_escola_id_nullable.sql
-- Description: Garante que escola_id em audit_logs possa ser nulo para ações globais.

BEGIN;

-- Remove a restrição NOT NULL se existir
ALTER TABLE public.audit_logs ALTER COLUMN escola_id DROP NOT NULL;

-- Garante que acao e entity também existam (para compatibilidade com o novo recordAuditClient)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'action') THEN
        ALTER TABLE public.audit_logs ADD COLUMN action text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'entity') THEN
        ALTER TABLE public.audit_logs ADD COLUMN entity text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'portal') THEN
        ALTER TABLE public.audit_logs ADD COLUMN portal text;
    END IF;
END $$;

COMMIT;
