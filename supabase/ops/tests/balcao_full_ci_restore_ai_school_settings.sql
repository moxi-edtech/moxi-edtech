-- CI-only schema drift recovery. METADATA (no rows) read-only from connected KLASSE
-- Supabase on 2026-10-21: information_schema.columns, pg_constraint,
-- pg_policies, pg_proc. This object is absent from ALL checked-in migrations.
-- Never apply in production; copy to a disposable runner only.
CREATE TABLE IF NOT EXISTS public.ai_school_settings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 school_id uuid NOT NULL UNIQUE REFERENCES public.escolas(id) ON DELETE CASCADE,
 enabled boolean NOT NULL DEFAULT false,
 monthly_limit integer NOT NULL DEFAULT 500 CHECK (monthly_limit >= 0),
 daily_limit integer NOT NULL DEFAULT 20 CHECK (daily_limit >= 0),
 allowed_features jsonb NOT NULL DEFAULT '[]'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 updated_by uuid DEFAULT public.safe_auth_uid()
);
CREATE INDEX IF NOT EXISTS idx_ai_school_settings_school ON public.ai_school_settings (school_id);
ALTER TABLE public.ai_school_settings ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_use_klasse_ai(p_school_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_catalog'
AS $function$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN true;
  END IF;

  IF public.check_super_admin_role() THEN
    RETURN true;
  END IF;

  IF p_school_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN public.user_has_role_in_school(
    p_school_id,
    ARRAY['admin', 'admin_escola', 'staff_admin', 'secretaria', 'financeiro', 'admin_financeiro', 'secretaria_financeiro', 'direcao', 'diretoria']
  );
END;
$function$;

-- These are EXACTLY the production metadata policy expressions, not permissive
-- dummy rules. The select policy remains governed by ORIGINAL migration
-- 20260626153000_fix_ai_school_settings_select_policy.sql.
CREATE POLICY ai_school_settings_insert ON public.ai_school_settings
 FOR INSERT TO public
 WITH CHECK (
   ((school_id = public.current_tenant_escola_id()) AND public.can_use_klasse_ai(school_id))
   OR public.check_super_admin_role()
 );
CREATE POLICY ai_school_settings_update ON public.ai_school_settings
 FOR UPDATE TO public
 USING (
   ((school_id = public.current_tenant_escola_id()) AND
     public.user_has_role_in_school(school_id, ARRAY['admin','admin_escola','staff_admin','direcao']))
   OR public.check_super_admin_role()
 )
 WITH CHECK (
   ((school_id = public.current_tenant_escola_id()) AND
     public.user_has_role_in_school(school_id, ARRAY['admin','admin_escola','staff_admin','direcao']))
   OR public.check_super_admin_role()
 );
GRANT SELECT, INSERT, UPDATE ON public.ai_school_settings TO authenticated;
