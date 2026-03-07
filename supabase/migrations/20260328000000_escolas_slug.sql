BEGIN;

ALTER TABLE public.escolas
  ADD COLUMN IF NOT EXISTS slug text;

CREATE OR REPLACE FUNCTION public.slugify_escola_nome(input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  base text;
BEGIN
  base := regexp_replace(lower(public.unaccent(coalesce(input, ''))), '[^a-z0-9]+', '-', 'g');
  base := regexp_replace(base, '(^-+|-+$)', '', 'g');
  IF base = '' THEN
    base := 'escola';
  END IF;
  RETURN base;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_escola_slug(p_nome text, p_id uuid DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  base text;
  candidate text;
  counter integer := 1;
BEGIN
  base := public.slugify_escola_nome(p_nome);
  candidate := base;

  LOOP
    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.escolas
      WHERE slug = candidate
        AND (p_id IS NULL OR id <> p_id)
    );
    counter := counter + 1;
    candidate := base || '-' || counter;
  END LOOP;

  RETURN candidate;
END;
$$;

UPDATE public.escolas AS e
SET slug = resolved.slug
FROM (
  SELECT id, public.generate_escola_slug(nome, id) AS slug
  FROM public.escolas
  WHERE slug IS NULL OR btrim(slug) = ''
) AS resolved
WHERE e.id = resolved.id;

ALTER TABLE public.escolas
  ALTER COLUMN slug SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'escolas_slug_key'
  ) THEN
    ALTER TABLE public.escolas
      ADD CONSTRAINT escolas_slug_key UNIQUE (slug);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_escolas_slug()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.slug IS NULL OR btrim(NEW.slug) = '' THEN
    NEW.slug := public.generate_escola_slug(NEW.nome, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_escolas_slug ON public.escolas;
CREATE TRIGGER trg_escolas_slug
BEFORE INSERT OR UPDATE OF slug, nome
ON public.escolas
FOR EACH ROW
EXECUTE FUNCTION public.set_escolas_slug();

COMMIT;
