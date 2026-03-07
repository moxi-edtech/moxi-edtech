BEGIN;

ALTER TABLE public.escolas
  ALTER COLUMN slug SET NOT NULL;

DO $$
DECLARE
  row_record record;
  normalized_slug text;
BEGIN
  FOR row_record IN
    SELECT id, slug, nome
    FROM public.escolas
    WHERE slug IS NULL
      OR btrim(slug) = ''
      OR slug <> public.slugify_escola_nome(slug)
      OR slug !~ '^[a-z0-9-]+$'
  LOOP
    normalized_slug := public.generate_escola_slug(
      COALESCE(NULLIF(row_record.slug, ''), row_record.nome),
      row_record.id
    );

    RAISE NOTICE 'Normalizing escola slug %: % -> %', row_record.id, row_record.slug, normalized_slug;

    UPDATE public.escolas
      SET slug = normalized_slug
      WHERE id = row_record.id;
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'escolas_slug_key'
  ) THEN
    ALTER TABLE public.escolas
      ADD CONSTRAINT escolas_slug_key UNIQUE (slug);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'escolas_slug_format_check'
  ) THEN
    ALTER TABLE public.escolas
      ADD CONSTRAINT escolas_slug_format_check
      CHECK (
        btrim(slug) <> ''
        AND slug = public.slugify_escola_nome(slug)
        AND slug ~ '^[a-z0-9-]+$'
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS escolas_slug_idx
  ON public.escolas(slug);

CREATE OR REPLACE FUNCTION public.set_escolas_slug()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.slug := public.generate_escola_slug(
    COALESCE(NULLIF(NEW.slug, ''), NEW.nome),
    NEW.id
  );
  RETURN NEW;
END;
$$;

COMMIT;
