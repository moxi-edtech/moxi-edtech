BEGIN;

CREATE OR REPLACE FUNCTION public.block_escola_slug_changes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.slug IS DISTINCT FROM OLD.slug
    AND current_setting('klasse.allow_slug_change', true) <> 'on' THEN
    RAISE EXCEPTION 'School slug cannot be changed once created';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_escolas_slug_immutable ON public.escolas;
CREATE TRIGGER trg_escolas_slug_immutable
BEFORE UPDATE OF slug
ON public.escolas
FOR EACH ROW
EXECUTE FUNCTION public.block_escola_slug_changes();

CREATE OR REPLACE FUNCTION public.set_escolas_slug()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.slug := public.generate_escola_slug(
      COALESCE(NULLIF(NEW.slug, ''), NEW.nome),
      NEW.id
    );
  ELSIF current_setting('klasse.allow_slug_change', true) = 'on'
    AND (NEW.slug IS DISTINCT FROM OLD.slug OR NEW.slug IS NULL OR btrim(NEW.slug) = '') THEN
    NEW.slug := public.generate_escola_slug(
      COALESCE(NULLIF(NEW.slug, ''), NEW.nome),
      NEW.id
    );
  ELSE
    NEW.slug := OLD.slug;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_escola_slug(p_escola_id uuid, p_slug text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM set_config('klasse.allow_slug_change', 'on', true);

  UPDATE public.escolas
    SET slug = public.generate_escola_slug(p_slug, p_escola_id)
    WHERE id = p_escola_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_escola_slug(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_escola_slug(uuid, text) TO postgres, service_role;

COMMIT;
