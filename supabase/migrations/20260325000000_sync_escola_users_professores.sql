INSERT INTO public.escola_users (escola_id, user_id, papel)
SELECT t.escola_id, t.profile_id, 'professor'
FROM public.teachers t
LEFT JOIN public.escola_users eu
  ON eu.escola_id = t.escola_id
  AND eu.user_id = t.profile_id
WHERE t.profile_id IS NOT NULL
  AND eu.user_id IS NULL;

INSERT INTO public.escola_users (escola_id, user_id, papel)
SELECT p.escola_id, p.profile_id, 'professor'
FROM public.professores p
LEFT JOIN public.escola_users eu
  ON eu.escola_id = p.escola_id
  AND eu.user_id = p.profile_id
WHERE p.profile_id IS NOT NULL
  AND eu.user_id IS NULL;

CREATE OR REPLACE FUNCTION public.ensure_escola_user_professor()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.profile_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.escola_users (escola_id, user_id, papel)
  VALUES (NEW.escola_id, NEW.profile_id, 'professor')
  ON CONFLICT (escola_id, user_id) DO UPDATE
    SET papel = EXCLUDED.papel;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_teachers_escola_users'
  ) THEN
    CREATE TRIGGER trg_teachers_escola_users
    AFTER INSERT OR UPDATE OF escola_id, profile_id ON public.teachers
    FOR EACH ROW EXECUTE FUNCTION public.ensure_escola_user_professor();
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_professores_escola_users'
  ) THEN
    CREATE TRIGGER trg_professores_escola_users
    AFTER INSERT OR UPDATE OF escola_id, profile_id ON public.professores
    FOR EACH ROW EXECUTE FUNCTION public.ensure_escola_user_professor();
  END IF;
END;
$$;
