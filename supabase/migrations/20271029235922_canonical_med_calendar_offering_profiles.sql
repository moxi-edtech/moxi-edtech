-- One MED calendar per academic year; existing subsystem documents become
-- regulatory profiles selected by course/offering, never competing year SSOTs.
-- Keep published historical template IDs and source_item_id FKs untouched.
BEGIN;

CREATE TABLE IF NOT EXISTS public.calendarios_oficiais_anos (
  ano_base integer PRIMARY KEY,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  versao_documento text NOT NULL,
  fonte_nome text NOT NULL,
  fonte_referencia text,
  fonte_documento_url text,
  estado text NOT NULL DEFAULT 'PUBLICADO',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT calendario_canonico_interval CHECK (data_fim >= data_inicio),
  CONSTRAINT calendario_canonico_publicado CHECK (estado = 'PUBLICADO')
);

ALTER TABLE public.calendario_templates
  ADD COLUMN IF NOT EXISTS calendario_canonico_ano integer
  REFERENCES public.calendarios_oficiais_anos(ano_base);

-- The 2026/27 official regular, preschool, teacher-training and technical
-- profiles have identical annual boundaries and three teaching terms.
-- Check this invariant before recording a single official source of truth.
DO $backfill$
DECLARE
  v_ano integer := 2026;
  v_model record;
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.calendario_templates
  WHERE ano_base=v_ano AND is_oficial IS TRUE AND estado='PUBLICADO';
  IF v_count <> 4 THEN
    RAISE EXCEPTION 'CALENDAR_RECONCILIATION_REQUIRED: expected 4 published MED profiles for 2026/27, found %', v_count;
  END IF;
  IF (
    SELECT count(DISTINCT (data_inicio,data_fim,versao_documento,fonte_nome))
    FROM public.calendario_templates
    WHERE ano_base=v_ano AND is_oficial IS TRUE AND estado='PUBLICADO'
  ) <> 1 THEN
    RAISE EXCEPTION 'CALENDAR_RECONCILIATION_REQUIRED: official 2026/27 profiles have differing calendar sources';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.calendario_templates t
    WHERE t.ano_base=v_ano AND t.is_oficial IS TRUE AND t.estado='PUBLICADO'
      AND (SELECT count(*) FROM public.calendario_template_items i
           WHERE i.template_id=t.id AND i.tipo::text='PERIODO_LETIVO') <> 3
  ) OR (
    SELECT count(DISTINCT (i.numero,i.data_inicio,i.data_fim,i.peso))
    FROM public.calendario_template_items i
    JOIN public.calendario_templates t ON t.id=i.template_id
    WHERE t.ano_base=v_ano AND t.is_oficial IS TRUE AND t.estado='PUBLICADO'
      AND i.tipo::text='PERIODO_LETIVO'
  ) <> 3 THEN
    RAISE EXCEPTION 'CALENDAR_RECONCILIATION_REQUIRED: MED trimester dates differ between profiles';
  END IF;
  SELECT t.ano_base,t.data_inicio,t.data_fim,t.versao_documento,
         t.fonte_nome,t.fonte_referencia,t.fonte_documento_url
    INTO STRICT v_model
    FROM public.calendario_templates t
    WHERE t.ano_base=v_ano AND t.is_oficial IS TRUE AND t.estado='PUBLICADO'
    ORDER BY t.id LIMIT 1;
  INSERT INTO public.calendarios_oficiais_anos
    (ano_base,data_inicio,data_fim,versao_documento,fonte_nome,fonte_referencia,fonte_documento_url)
  VALUES
    (v_model.ano_base,v_model.data_inicio,v_model.data_fim,v_model.versao_documento,
     v_model.fonte_nome,'Calendário Escolar Nacional 2026/2027 - MED (perfis por subsistema)',NULL)
  ON CONFLICT (ano_base) DO NOTHING;
  IF NOT EXISTS (
    SELECT 1 FROM public.calendarios_oficiais_anos c
    WHERE c.ano_base=v_model.ano_base
      AND c.data_inicio=v_model.data_inicio AND c.data_fim=v_model.data_fim
      AND c.versao_documento=v_model.versao_documento
  ) THEN
    RAISE EXCEPTION 'CALENDAR_RECONCILIATION_REQUIRED: existing canonical year differs';
  END IF;
  UPDATE public.calendario_templates
     SET calendario_canonico_ano=v_ano
   WHERE ano_base=v_ano AND is_oficial IS TRUE AND estado='PUBLICADO'
     AND calendario_canonico_ano IS DISTINCT FROM v_ano;
END;
$backfill$;

ALTER TABLE public.calendario_templates
  ADD CONSTRAINT calendario_profile_same_year
  CHECK (calendario_canonico_ano IS NULL OR calendario_canonico_ano=ano_base)
  NOT VALID;
ALTER TABLE public.calendario_templates VALIDATE CONSTRAINT calendario_profile_same_year;

-- New published MED profiles must be registered against their sole parent.
ALTER TABLE public.calendario_templates
  ADD CONSTRAINT official_profile_canonical_required
  CHECK (ano_base < 2026 OR is_oficial IS DISTINCT FROM TRUE
         OR estado <> 'PUBLICADO' OR calendario_canonico_ano IS NOT NULL)
  NOT VALID;
ALTER TABLE public.calendario_templates VALIDATE CONSTRAINT official_profile_canonical_required;

-- Corrected regulatory profiles can be drafted, but a published profile cannot
-- silently change the official year metadata or terms used by existing pupils.
CREATE OR REPLACE FUNCTION public.guard_canonical_med_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  v record;
BEGIN
  IF NEW.ano_base >= 2026 AND NEW.is_oficial IS TRUE AND NEW.estado='PUBLICADO' THEN
    SELECT * INTO v FROM public.calendarios_oficiais_anos
    WHERE ano_base=NEW.calendario_canonico_ano;
    IF NOT FOUND OR v.ano_base IS DISTINCT FROM NEW.ano_base
      OR v.data_inicio IS DISTINCT FROM NEW.data_inicio
      OR v.data_fim IS DISTINCT FROM NEW.data_fim
      OR v.versao_documento IS DISTINCT FROM NEW.versao_documento THEN
      RAISE EXCEPTION 'OFFICIAL_CALENDAR_CANONICAL_MISMATCH: Perfil não corresponde ao calendário do ano.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_canonical_med_profile ON public.calendario_templates;
CREATE TRIGGER trg_guard_canonical_med_profile
BEFORE INSERT OR UPDATE ON public.calendario_templates
FOR EACH ROW EXECUTE FUNCTION public.guard_canonical_med_profile();

CREATE OR REPLACE FUNCTION public.guard_published_med_template_item()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  v_template_id uuid := CASE WHEN TG_OP='DELETE' THEN OLD.template_id ELSE NEW.template_id END;
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') AND EXISTS (
    SELECT 1 FROM public.calendario_templates
    WHERE id=v_template_id AND ano_base >= 2026
      AND is_oficial IS TRUE AND estado='PUBLICADO'
  ) THEN
    RAISE EXCEPTION 'OFFICIAL_CALENDAR_IMMUTABLE: Publique uma nova versão para alterar eventos do MED.';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_published_med_template_item ON public.calendario_template_items;
CREATE TRIGGER trg_guard_published_med_template_item
BEFORE UPDATE OR DELETE ON public.calendario_template_items
FOR EACH ROW EXECUTE FUNCTION public.guard_published_med_template_item();

-- One official event may legitimately occur in different courses, so the
-- old global unique constraint must not collapse scoped events across offers.
-- PostgreSQL 15+ NULLS NOT DISTINCT preserves idempotence for global rows.
ALTER TABLE public.calendario_eventos DROP CONSTRAINT IF EXISTS uq_calendario_eventos;
CREATE UNIQUE INDEX IF NOT EXISTS uq_calendario_eventos_por_oferta
  ON public.calendario_eventos
  (escola_id, ano_letivo_id, offering_id, nome, data_inicio) NULLS NOT DISTINCT;

-- Already-bound profile IDs continue to identify the regulatory variation.
-- A course cannot point to a profile from a different education subsystem.
CREATE OR REPLACE FUNCTION public.guard_course_calendar_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  v_template record;
BEGIN
  SELECT t.subsistema,t.ano_base,t.calendario_canonico_ano
  INTO v_template
  FROM public.calendario_templates t WHERE t.id=NEW.calendar_profile_id;
  IF NOT FOUND OR v_template.subsistema IS DISTINCT FROM NEW.education_subsystem OR
      (v_template.ano_base >= 2026 AND v_template.calendario_canonico_ano IS NULL) THEN
    RAISE EXCEPTION 'COURSE_CALENDAR_PROFILE_MISMATCH: O perfil não corresponde à oferta educativa.';
  END IF;
  IF NEW.course_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.cursos c
    WHERE c.id=NEW.course_id AND c.escola_id=NEW.escola_id
  ) THEN
    RAISE EXCEPTION 'COURSE_CALENDAR_PROFILE_MISMATCH: Curso fora da escola.';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_course_calendar_profile ON public.school_education_offerings;
CREATE TRIGGER trg_guard_course_calendar_profile
BEFORE INSERT OR UPDATE OF calendar_profile_id,course_id,education_subsystem,escola_id
ON public.school_education_offerings
FOR EACH ROW EXECUTE FUNCTION public.guard_course_calendar_profile();

-- Existing grade/event guards verify the specific official source item.
-- Also verify that its profile belongs to the unique year and, if scoped,
-- that this is the profile assigned to this course/offering.
CREATE OR REPLACE FUNCTION public.guard_canonical_calendar_origin()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  v_year integer;
BEGIN
  SELECT a.ano INTO v_year FROM public.anos_letivos a
  WHERE a.id=NEW.ano_letivo_id AND a.escola_id=NEW.escola_id;
  IF v_year IS NULL THEN
    RAISE EXCEPTION 'DATA: Calendário fora do ano letivo da escola.';
  END IF;
  IF v_year < 2026 THEN RETURN NEW; END IF;

  IF NEW.source_template_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.calendario_templates t
    JOIN public.calendarios_oficiais_anos c ON c.ano_base=t.calendario_canonico_ano
    WHERE t.id=NEW.source_template_id AND t.ano_base=v_year
      AND t.is_oficial IS TRUE AND t.estado='PUBLICADO'
      AND c.data_inicio=t.data_inicio AND c.data_fim=t.data_fim
  ) THEN
    RAISE EXCEPTION 'OFFICIAL_CALENDAR_CANONICAL_MISMATCH: A origem não pertence ao calendário único.';
  END IF;
  IF NEW.offering_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.school_education_offerings o
    JOIN public.calendario_templates t ON t.id=NEW.source_template_id
    WHERE o.id=NEW.offering_id AND o.escola_id=NEW.escola_id
      AND o.education_subsystem=t.subsistema
  ) THEN
    RAISE EXCEPTION 'COURSE_CALENDAR_PROFILE_MISMATCH: Evento fora do perfil do curso.';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_canonical_period_origin ON public.periodos_letivos;
CREATE TRIGGER trg_guard_canonical_period_origin
BEFORE INSERT OR UPDATE ON public.periodos_letivos
FOR EACH ROW EXECUTE FUNCTION public.guard_canonical_calendar_origin();
DROP TRIGGER IF EXISTS trg_guard_canonical_event_origin ON public.calendario_eventos;
CREATE TRIGGER trg_guard_canonical_event_origin
BEFORE INSERT OR UPDATE ON public.calendario_eventos
FOR EACH ROW EXECUTE FUNCTION public.guard_canonical_calendar_origin();

ALTER TABLE public.calendarios_oficiais_anos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.calendarios_oficiais_anos FROM anon;
GRANT SELECT ON TABLE public.calendarios_oficiais_anos TO authenticated, service_role;
DROP POLICY IF EXISTS canonicos_med_read ON public.calendarios_oficiais_anos;
CREATE POLICY canonicos_med_read ON public.calendarios_oficiais_anos
  FOR SELECT TO authenticated USING (estado='PUBLICADO');

COMMIT;
