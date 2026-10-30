-- Historical MED profile is per school offering AND academic year.
-- calendar_profile_id on school_education_offerings remains a compatibility
-- pointer for the active year; preparing a future year must not change it.
BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS uq_education_offerings_id_escola
  ON public.school_education_offerings(id,escola_id);

CREATE TABLE IF NOT EXISTS public.school_offering_med_year_profiles (
  escola_id uuid NOT NULL,
  offering_id uuid NOT NULL,
  ano_letivo_id uuid NOT NULL,
  calendar_profile_id uuid NOT NULL REFERENCES public.calendario_templates(id) ON DELETE RESTRICT,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid DEFAULT auth.uid(),
  PRIMARY KEY (offering_id,ano_letivo_id),
  CONSTRAINT annual_med_school_offering_fk
    FOREIGN KEY (offering_id,escola_id)
    REFERENCES public.school_education_offerings(id,escola_id)
    ON DELETE RESTRICT,
  CONSTRAINT annual_med_school_year_fk
    FOREIGN KEY (ano_letivo_id,escola_id)
    REFERENCES public.anos_letivos(id,escola_id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_school_offering_med_year_profiles_school_year
  ON public.school_offering_med_year_profiles(escola_id,ano_letivo_id);

ALTER TABLE public.school_offering_med_year_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.school_offering_med_year_profiles FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.school_offering_med_year_profiles TO authenticated,service_role;
GRANT INSERT,UPDATE,DELETE ON public.school_offering_med_year_profiles TO service_role;
DROP POLICY IF EXISTS annual_med_school_reader ON public.school_offering_med_year_profiles;
CREATE POLICY annual_med_school_reader ON public.school_offering_med_year_profiles
FOR SELECT TO authenticated
USING (
  public.user_has_role_in_school(
    escola_id,ARRAY['admin','admin_escola','staff_admin','diretor','admin_secretaria','secretaria']
  )
);

-- Ensure a privileged SQL write cannot forge a profile from another school,
-- calendar year, subsistema, or different global curriculum preset.
CREATE OR REPLACE FUNCTION internal.guard_offering_med_annual_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO pg_catalog,public,internal,pg_temp
AS $guard$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.anos_letivos a
    JOIN public.school_education_offerings o
      ON o.id=NEW.offering_id AND o.escola_id=a.escola_id
    JOIN public.cursos c
      ON c.id=o.course_id AND c.escola_id=o.escola_id
    JOIN public.curriculum_preset_calendar_contract global_map
      ON global_map.preset_id=c.curriculum_key
     AND global_map.education_subsystem=o.education_subsystem
     AND global_map.education_level=o.education_level
    JOIN public.calendario_templates t
      ON t.id=NEW.calendar_profile_id
     AND t.ano_base=a.ano
     AND t.calendario_canonico_ano=a.ano
     AND t.subsistema=o.education_subsystem
     AND t.is_oficial IS TRUE AND t.estado='PUBLICADO'
    JOIN public.calendarios_oficiais_anos official
      ON official.ano_base=t.calendario_canonico_ano
     AND official.estado='PUBLICADO'
     AND official.data_inicio=t.data_inicio
     AND official.data_fim=t.data_fim
     AND official.versao_documento=t.versao_documento
    WHERE a.id=NEW.ano_letivo_id AND a.escola_id=NEW.escola_id
      AND a.data_inicio=official.data_inicio AND a.data_fim=official.data_fim
      AND o.curriculum_preset_id=c.curriculum_key
  ) THEN
    RAISE EXCEPTION 'MED_YEAR_PROFILE_INVALID: Curso, oferta, escola, ano ou perfil oficial incompatível.';
  END IF;
  IF TG_OP='UPDATE' AND (
       NEW.escola_id IS DISTINCT FROM OLD.escola_id
    OR NEW.offering_id IS DISTINCT FROM OLD.offering_id
    OR NEW.ano_letivo_id IS DISTINCT FROM OLD.ano_letivo_id
    OR NEW.calendar_profile_id IS DISTINCT FROM OLD.calendar_profile_id
  ) THEN
    RAISE EXCEPTION 'MED_YEAR_PROFILE_IMMUTABLE: Uma associação publicada não pode ser substituída.';
  END IF;
  RETURN NEW;
END;
$guard$;

DROP TRIGGER IF EXISTS trg_guard_offering_med_annual_profile
  ON public.school_offering_med_year_profiles;
CREATE TRIGGER trg_guard_offering_med_annual_profile
BEFORE INSERT OR UPDATE ON public.school_offering_med_year_profiles
FOR EACH ROW EXECUTE FUNCTION internal.guard_offering_med_annual_profile();

CREATE OR REPLACE FUNCTION internal.reject_delete_med_annual_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO pg_catalog,public,internal,pg_temp AS $deny$
BEGIN
  RAISE EXCEPTION 'MED_YEAR_PROFILE_IMMUTABLE: O histórico anual não pode ser removido.';
END;
$deny$;
DROP TRIGGER IF EXISTS trg_reject_delete_med_annual_profile
  ON public.school_offering_med_year_profiles;
CREATE TRIGGER trg_reject_delete_med_annual_profile
BEFORE DELETE ON public.school_offering_med_year_profiles
FOR EACH ROW EXECUTE FUNCTION internal.reject_delete_med_annual_profile();

-- Centralized idempotent, validated insertion; never overwrite an already
-- published historical relation.
CREATE OR REPLACE FUNCTION internal.record_med_annual_profile(
  p_escola_id uuid,p_offering_id uuid,p_calendar_profile_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO pg_catalog,public,internal,pg_temp AS $record$
DECLARE v_year public.anos_letivos%ROWTYPE;
BEGIN
  SELECT a.* INTO v_year
  FROM public.calendario_templates t
  JOIN public.anos_letivos a
    ON a.ano=t.ano_base AND a.escola_id=p_escola_id
  WHERE t.id=p_calendar_profile_id AND t.ano_base>=2026;
  IF NOT FOUND THEN RETURN; END IF;

  INSERT INTO public.school_offering_med_year_profiles(
    escola_id,offering_id,ano_letivo_id,calendar_profile_id
  ) VALUES(p_escola_id,p_offering_id,v_year.id,p_calendar_profile_id)
  ON CONFLICT (offering_id,ano_letivo_id) DO NOTHING;

  IF NOT EXISTS (
    SELECT 1 FROM public.school_offering_med_year_profiles
    WHERE offering_id=p_offering_id AND ano_letivo_id=v_year.id
      AND escola_id=p_escola_id AND calendar_profile_id=p_calendar_profile_id
  ) THEN
    RAISE EXCEPTION 'MED_YEAR_PROFILE_COLLISION: O ano já possui outro perfil nesta oferta.';
  END IF;
END;
$record$;

-- Capture the requested future profile during the authorized atomic MED RPC.
-- The active-year pointer stays unchanged until the final cutover transaction.
CREATE OR REPLACE FUNCTION internal.stage_med_annual_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO pg_catalog,public,internal,pg_temp AS $stage$
DECLARE
  v_requested_year integer;
  v_active_year integer;
BEGIN
  IF NEW.status='active' THEN
    SELECT t.ano_base INTO v_requested_year
      FROM public.calendario_templates t WHERE t.id=NEW.calendar_profile_id;
    IF v_requested_year>=2026 THEN
      PERFORM internal.record_med_annual_profile(
        NEW.escola_id,NEW.id,NEW.calendar_profile_id
      );
      IF TG_OP='UPDATE' AND v_requested_year IS DISTINCT FROM
         (SELECT a.ano FROM public.anos_letivos a
            WHERE a.escola_id=NEW.escola_id AND a.ativo IS TRUE LIMIT 1) THEN
        SELECT a.ano INTO v_active_year FROM public.anos_letivos a
          WHERE a.escola_id=NEW.escola_id AND a.ativo IS TRUE LIMIT 1;
        IF v_active_year IS NOT NULL AND v_requested_year>v_active_year THEN
          NEW.calendar_profile_id:=OLD.calendar_profile_id;
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$stage$;

DROP TRIGGER IF EXISTS trg_stage_med_annual_profile ON public.school_education_offerings;
CREATE TRIGGER trg_stage_med_annual_profile
BEFORE UPDATE OF calendar_profile_id,education_subsystem,education_level,status
ON public.school_education_offerings
FOR EACH ROW EXECUTE FUNCTION internal.stage_med_annual_profile();

-- On first installation the offering row must exist before its annual FK
-- can be recorded. Do not attempt the FK insert in a BEFORE INSERT trigger.
CREATE OR REPLACE FUNCTION internal.record_new_offering_med_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO pg_catalog,public,internal,pg_temp AS $new_offering$
BEGIN
  IF NEW.status='active' THEN
    PERFORM internal.record_med_annual_profile(
      NEW.escola_id,NEW.id,NEW.calendar_profile_id
    );
  END IF;
  RETURN NULL;
END;
$new_offering$;
DROP TRIGGER IF EXISTS trg_record_new_offering_med_profile ON public.school_education_offerings;
CREATE TRIGGER trg_record_new_offering_med_profile
AFTER INSERT ON public.school_education_offerings
FOR EACH ROW EXECUTE FUNCTION internal.record_new_offering_med_profile();

-- Snapshot currently verified 2026 associations. Older schools still using
-- 2025 calendars are not assigned a fictitious historical 2026 relation.
INSERT INTO public.school_offering_med_year_profiles(
  escola_id,offering_id,ano_letivo_id,calendar_profile_id
)
SELECT o.escola_id,o.id,a.id,t.id
FROM public.school_education_offerings o
JOIN public.anos_letivos a ON a.escola_id=o.escola_id AND a.ano=2026
JOIN public.calendario_templates t ON t.id=o.calendar_profile_id
 AND t.ano_base=a.ano AND t.calendario_canonico_ano=a.ano
WHERE o.status='active' AND t.is_oficial IS TRUE AND t.estado='PUBLICADO'
ON CONFLICT (offering_id,ano_letivo_id) DO NOTHING;

-- Rebind the compatibility pointer only AFTER the new year's activation
-- passed the canonical MED guard. The annual historical rows never change.
CREATE OR REPLACE FUNCTION internal.activate_med_annual_offering_pointers()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO pg_catalog,public,internal,pg_temp
AS $switch$
BEGIN
  IF NEW.ativo IS TRUE AND OLD.ativo IS DISTINCT FROM TRUE AND NEW.ano>=2026 THEN
    UPDATE public.school_education_offerings o
       SET calendar_profile_id=m.calendar_profile_id,updated_at=now()
      FROM public.school_offering_med_year_profiles m
     WHERE m.escola_id=NEW.escola_id AND m.ano_letivo_id=NEW.id
       AND m.offering_id=o.id AND o.escola_id=NEW.escola_id
       AND o.status='active' AND o.calendar_profile_id IS DISTINCT FROM m.calendar_profile_id;
  END IF;
  RETURN NULL;
END;
$switch$;

DROP TRIGGER IF EXISTS trg_activate_med_annual_offering_pointers ON public.anos_letivos;
CREATE TRIGGER trg_activate_med_annual_offering_pointers
AFTER UPDATE OF ativo ON public.anos_letivos
FOR EACH ROW EXECUTE FUNCTION internal.activate_med_annual_offering_pointers();

REVOKE ALL ON FUNCTION internal.guard_offering_med_annual_profile() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION internal.reject_delete_med_annual_profile() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION internal.record_med_annual_profile(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION internal.stage_med_annual_profile() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION internal.record_new_offering_med_profile() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION internal.activate_med_annual_offering_pointers() FROM PUBLIC,anon,authenticated;

COMMENT ON TABLE public.school_offering_med_year_profiles IS
  'Immutable MED calendar profile per KLASSE school offering and academic year; preserve historical provenance.';

COMMIT;
