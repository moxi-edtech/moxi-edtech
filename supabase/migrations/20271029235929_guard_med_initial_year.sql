BEGIN;
CREATE OR REPLACE FUNCTION internal.guard_med_year_activation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO pg_catalog,public,internal,pg_temp AS $$
DECLARE
  v_health jsonb;
  v_cal public.calendarios_oficiais_anos%ROWTYPE;
  v_profile uuid;
  v_terms integer;
BEGIN
  IF NEW.ativo IS DISTINCT FROM TRUE OR NEW.ano<2026
    OR (TG_OP='UPDATE' AND OLD.ativo IS TRUE) THEN
    RETURN NEW;
  END IF;
  IF TG_OP='INSERT' THEN
    IF EXISTS(SELECT 1 FROM public.cursos WHERE escola_id=NEW.escola_id)
      OR EXISTS(SELECT 1 FROM public.school_education_offerings WHERE escola_id=NEW.escola_id)
    THEN
      RAISE EXCEPTION 'MED_YEAR_NOT_READY: Instalação académica obrigatória antes da ativação.';
    END IF;
    SELECT * INTO v_cal FROM public.calendarios_oficiais_anos
      WHERE ano_base=NEW.ano AND estado='PUBLICADO';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'OFFICIAL_CALENDAR_NOT_PUBLISHED: Calendário do ano ainda não publicado.';
    END IF;
    SELECT t.id INTO v_profile FROM public.calendario_templates t
      WHERE t.ano_base=NEW.ano AND t.calendario_canonico_ano=NEW.ano
        AND t.is_oficial IS TRUE AND t.estado='PUBLICADO'
        AND t.data_inicio=v_cal.data_inicio AND t.data_fim=v_cal.data_fim
        AND t.versao_documento=v_cal.versao_documento
      ORDER BY (t.subsistema='REGULAR_ADULTOS') DESC,t.id LIMIT 1;
    IF v_profile IS NULL THEN
      RAISE EXCEPTION 'OFFICIAL_TRIMESTERS_INCOMPLETE: Fonte de trimestres ausente.';
    END IF;
    SELECT count(*) INTO v_terms FROM public.calendario_template_items i
      WHERE i.template_id=v_profile AND i.tipo::text='PERIODO_LETIVO';
    IF v_terms<>3 THEN
      RAISE EXCEPTION 'OFFICIAL_TRIMESTERS_INCOMPLETE: Trimestres oficiais ausentes.';
    END IF;
    NEW.data_inicio:=v_cal.data_inicio;
    NEW.data_fim:=v_cal.data_fim;
    RETURN NEW;
  END IF;
  v_health:=internal.med_year_readiness(NEW.escola_id,NEW.id);
  IF (v_health->>'ok')::boolean IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'MED_YEAR_NOT_READY: %',
      coalesce(v_health->>'code','UNKNOWN');
  END IF;
  RETURN NEW;
END;
$$;
COMMIT;