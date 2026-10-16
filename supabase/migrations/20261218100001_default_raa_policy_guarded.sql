BEGIN;
DO $guarded$
BEGIN
  IF to_regprocedure('public.ensure_default_raa_policy()') IS NULL THEN
    EXECUTE $fresh_function$
CREATE FUNCTION public.ensure_default_raa_policy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tenant_type = 'k12' THEN
    INSERT INTO public.configuracoes_pedagogicas (escola_id)
    VALUES (NEW.id)
    ON CONFLICT (escola_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
$fresh_function$;
    REVOKE EXECUTE ON FUNCTION public.ensure_default_raa_policy() FROM PUBLIC, anon, authenticated;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid='public.escolas'::regclass
      AND tgname='trg_escolas_default_raa_policy'
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER trg_escolas_default_raa_policy
      AFTER INSERT ON public.escolas FOR EACH ROW
      EXECUTE FUNCTION public.ensure_default_raa_policy();
  END IF;
END $guarded$;
COMMIT;
