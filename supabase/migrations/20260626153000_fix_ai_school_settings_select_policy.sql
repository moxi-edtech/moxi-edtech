DROP POLICY IF EXISTS ai_school_settings_select ON public.ai_school_settings;

CREATE POLICY ai_school_settings_select
ON public.ai_school_settings
FOR SELECT
TO authenticated
USING (
  public.can_use_klasse_ai(school_id)
);
