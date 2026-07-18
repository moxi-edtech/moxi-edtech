BEGIN;

REVOKE ALL ON TABLE public.ai_insights FROM PUBLIC;
REVOKE ALL ON TABLE public.ai_insights FROM anon;
REVOKE ALL ON TABLE public.ai_insights FROM authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.ai_insights TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_insights TO service_role;

COMMIT;
