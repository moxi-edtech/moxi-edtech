-- Student import wizard support

-- Ensure required extension for text normalization
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Support tables for imports
CREATE TABLE IF NOT EXISTS public.import_migrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL,
  created_by uuid,
  file_name text,
  file_hash text,
  storage_path text,
  status text NOT NULL DEFAULT 'uploaded',
  total_rows integer DEFAULT 0,
  imported_rows integer DEFAULT 0,
  error_rows integer DEFAULT 0,
  processed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT import_migrations_escola_fk FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.import_errors (
  id bigserial PRIMARY KEY,
  import_id uuid NOT NULL REFERENCES public.import_migrations(id) ON DELETE CASCADE,
  row_number integer,
  column_name text,
  message text NOT NULL,
  raw_value text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.staging_alunos (
  id bigserial PRIMARY KEY,
  import_id uuid NOT NULL REFERENCES public.import_migrations(id) ON DELETE CASCADE,
  escola_id uuid NOT NULL,
  profile_id uuid,
  nome text,
  data_nascimento date,
  telefone text,
  bi text,
  email text,
  raw_data jsonb,
  created_at timestamptz DEFAULT now()
);

-- Column tracking on alunos
ALTER TABLE public.alunos
  ADD COLUMN IF NOT EXISTS import_id uuid;

ALTER TABLE public.alunos
  ADD COLUMN IF NOT EXISTS telefone text;

-- Ensure BI column exists on alunos (used by import and index below)
ALTER TABLE public.alunos
  ADD COLUMN IF NOT EXISTS bi_numero text;

-- Ensure birth date exists for indexing and import writes
ALTER TABLE public.alunos
  ADD COLUMN IF NOT EXISTS data_nascimento date;

-- Unique BI per escola; ignore NULL values
DROP INDEX IF EXISTS public.alunos_bi_key;
CREATE UNIQUE INDEX IF NOT EXISTS alunos_bi_key
  ON public.alunos(escola_id, bi_numero)
  WHERE bi_numero IS NOT NULL;
CREATE INDEX IF NOT EXISTS alunos_tel_idx ON public.alunos(telefone);
CREATE INDEX IF NOT EXISTS alunos_nome_data_idx ON public.alunos(nome, data_nascimento);

CREATE INDEX IF NOT EXISTS staging_alunos_import_id_idx ON public.staging_alunos(import_id);
CREATE INDEX IF NOT EXISTS import_errors_import_id_idx ON public.import_errors(import_id);

-- Normalization helpers
CREATE OR REPLACE FUNCTION public.normalize_text(input_text text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  cleaned text;
BEGIN
  IF input_text IS NULL THEN
    RETURN NULL;
  END IF;

  cleaned := lower(unaccent(input_text));
  cleaned := regexp_replace(cleaned, '\\s+', ' ', 'g');
  cleaned := trim(cleaned);
  IF cleaned = '' THEN
    RETURN NULL;
  END IF;
  RETURN cleaned;
END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_date(input_text text)
RETURNS date
LANGUAGE plpgsql
AS $$
DECLARE
  candidate date;
  formats text[] := ARRAY['YYYY-MM-DD', 'DD/MM/YYYY', 'DD-MM-YYYY', 'MM/DD/YYYY', 'YYYY/MM/DD'];
  fmt text;
BEGIN
  IF input_text IS NULL OR trim(input_text) = '' THEN
    RETURN NULL;
  END IF;

  FOR fmt IN SELECT unnest(formats) LOOP
    BEGIN
      candidate := to_date(input_text, fmt);
      EXIT WHEN candidate IS NOT NULL;
    EXCEPTION
      WHEN others THEN
        candidate := NULL;
    END;
  END LOOP;

  RETURN candidate;
END;
$$;

-- RPC to import alunos from staging
CREATE OR REPLACE FUNCTION public.importar_alunos(p_import_id uuid, p_escola_id uuid)
RETURNS TABLE(imported integer, skipped integer, errors integer)
LANGUAGE plpgsql
AS $$
DECLARE
  v_imported integer := 0;
  v_skipped integer := 0;
  v_errors integer := 0;
  v_record record;
BEGIN
  -- Basic guard: ensure migration exists
  PERFORM 1 FROM public.import_migrations m WHERE m.id = p_import_id AND m.escola_id = p_escola_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Import % for escola % not found', p_import_id, p_escola_id;
  END IF;

  -- Clean previous errors for re-runs
  DELETE FROM public.import_errors e WHERE e.import_id = p_import_id;

  -- Iterate through staging rows
  FOR v_record IN SELECT * FROM public.staging_alunos WHERE import_id = p_import_id LOOP
    IF v_record.profile_id IS NULL THEN
      v_errors := v_errors + 1;
      INSERT INTO public.import_errors(import_id, row_number, column_name, message, raw_value)
      VALUES (p_import_id, v_record.id::integer, 'profile_id', 'Profile obrigatório para importar aluno', NULL);
      CONTINUE;
    END IF;

    BEGIN
      INSERT INTO public.alunos (
        id,
        escola_id,
        profile_id,
        data_nascimento,
        nome,
        bi_numero,
        email,
        telefone,
        import_id
      )
      VALUES (
        gen_random_uuid(),
        p_escola_id,
        v_record.profile_id,
        v_record.data_nascimento,
        v_record.nome,
        v_record.bi,
        v_record.email,
        v_record.telefone,
        p_import_id
      )
      ON CONFLICT (profile_id, escola_id) DO UPDATE SET
        nome = EXCLUDED.nome,
        data_nascimento = EXCLUDED.data_nascimento,
        bi_numero = COALESCE(EXCLUDED.bi_numero, public.alunos.bi_numero),
        email = COALESCE(EXCLUDED.email, public.alunos.email),
        telefone = COALESCE(EXCLUDED.telefone, public.alunos.telefone),
        import_id = EXCLUDED.import_id;
      v_imported := v_imported + 1;
    EXCEPTION
      WHEN others THEN
        v_errors := v_errors + 1;
        INSERT INTO public.import_errors(import_id, row_number, column_name, message, raw_value)
        VALUES (p_import_id, v_record.id::integer, 'alunos', SQLERRM, row_to_json(v_record)::text);
    END;
  END LOOP;

  v_skipped := (SELECT COUNT(*) FROM public.staging_alunos WHERE import_id = p_import_id) - v_imported - v_errors;

  UPDATE public.import_migrations
  SET status = 'imported',
      processed_at = now(),
      imported_rows = v_imported,
      error_rows = v_errors
  WHERE id = p_import_id;

  RETURN QUERY SELECT v_imported, v_skipped, v_errors;
END;
$$;

-- RLS policies
ALTER TABLE public.import_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staging_alunos ENABLE ROW LEVEL SECURITY;

-- Service role full access
DROP POLICY IF EXISTS import_migrations_service_full ON public.import_migrations;
CREATE POLICY import_migrations_service_full ON public.import_migrations
FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS import_errors_service_full ON public.import_errors;
CREATE POLICY import_errors_service_full ON public.import_errors
FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS staging_alunos_service_full ON public.staging_alunos;
CREATE POLICY staging_alunos_service_full ON public.staging_alunos
FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Tenant-aware read for staff/admin
DROP POLICY IF EXISTS import_migrations_staff_read ON public.import_migrations;
CREATE POLICY import_migrations_staff_read ON public.import_migrations
FOR SELECT TO authenticated USING (public.is_staff_escola(escola_id));

DROP POLICY IF EXISTS import_errors_staff_read ON public.import_errors;
CREATE POLICY import_errors_staff_read ON public.import_errors
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.import_migrations m
    WHERE m.id = import_errors.import_id
      AND public.is_staff_escola(m.escola_id)
  )
);

DROP POLICY IF EXISTS staging_alunos_staff_read ON public.staging_alunos;
CREATE POLICY staging_alunos_staff_read ON public.staging_alunos
FOR SELECT TO authenticated USING (public.is_staff_escola(escola_id));

-- Staff/admin write for their tenant
DROP POLICY IF EXISTS import_migrations_staff_write ON public.import_migrations;
CREATE POLICY import_migrations_staff_write ON public.import_migrations
FOR INSERT TO authenticated WITH CHECK (public.is_staff_escola(escola_id));

DROP POLICY IF EXISTS import_errors_staff_write ON public.import_errors;
CREATE POLICY import_errors_staff_write ON public.import_errors
FOR INSERT TO authenticated WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.import_migrations m
    WHERE m.id = import_errors.import_id
      AND public.is_staff_escola(m.escola_id)
  )
);

DROP POLICY IF EXISTS staging_alunos_staff_write ON public.staging_alunos;
CREATE POLICY staging_alunos_staff_write ON public.staging_alunos
FOR INSERT TO authenticated WITH CHECK (public.is_staff_escola(escola_id));

-- Allow updates of status by staff/admin
DROP POLICY IF EXISTS import_migrations_staff_update ON public.import_migrations;
CREATE POLICY import_migrations_staff_update ON public.import_migrations
FOR UPDATE TO authenticated USING (public.is_staff_escola(escola_id)) WITH CHECK (public.is_staff_escola(escola_id));

-- Service role passthrough on alunos for imports
DROP POLICY IF EXISTS alunos_service_import ON public.alunos;
CREATE POLICY alunos_service_import ON public.alunos
FOR ALL TO service_role USING (true) WITH CHECK (true);
