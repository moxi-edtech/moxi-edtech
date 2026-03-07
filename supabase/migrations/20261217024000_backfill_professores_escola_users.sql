BEGIN;

INSERT INTO public.escola_users (escola_id, user_id, papel, created_at)
SELECT DISTINCT t.escola_id, t.profile_id, 'professor', now()
FROM public.teachers t
LEFT JOIN public.escola_users eu
  ON eu.escola_id = t.escola_id
 AND eu.user_id = t.profile_id
WHERE t.profile_id IS NOT NULL
  AND eu.user_id IS NULL;

INSERT INTO public.escola_users (escola_id, user_id, papel, created_at)
SELECT DISTINCT p.escola_id, p.profile_id, 'professor', now()
FROM public.professores p
LEFT JOIN public.escola_users eu
  ON eu.escola_id = p.escola_id
 AND eu.user_id = p.profile_id
WHERE p.profile_id IS NOT NULL
  AND eu.user_id IS NULL;

CREATE OR REPLACE FUNCTION public.trg_sync_professor_escola_user()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.profile_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.escola_users (escola_id, user_id, papel, created_at)
  SELECT NEW.escola_id, NEW.profile_id, 'professor', now()
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.escola_users eu
    WHERE eu.escola_id = NEW.escola_id
      AND eu.user_id = NEW.profile_id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_teachers_sync_escola_user ON public.teachers;
CREATE TRIGGER trg_teachers_sync_escola_user
AFTER INSERT ON public.teachers
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_professor_escola_user();

DROP TRIGGER IF EXISTS trg_professores_sync_escola_user ON public.professores;
CREATE TRIGGER trg_professores_sync_escola_user
AFTER INSERT ON public.professores
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_professor_escola_user();

COMMIT;
