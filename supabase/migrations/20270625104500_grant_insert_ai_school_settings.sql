BEGIN;

-- Grant INSERT on ai_school_settings to authenticated role to support upsert operations
GRANT INSERT ON TABLE public.ai_school_settings TO authenticated;

COMMIT;
