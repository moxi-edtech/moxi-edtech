BEGIN;
CREATE OR REPLACE FUNCTION internal.bootstrap_new_school_med_terms()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO pg_catalog,public,internal,pg_temp AS $$
DECLARE
  v_profile uuid;
  v_version text;
  v_inserted integer;
  v_health jsonb;
  v_distinct_terms integer;
BEGIN
  IF NEW.ativo IS DISTINCT FROM TRUE OR NEW.ano<2026 THEN RETURN NULL; END IF;
  SELECT t.id,t.versao_documento INTO v_profile,v_version
  FROM public.calendario_templates t
  WHERE t.ano_base=NEW.ano AND t.calendario_canonico_ano=NEW.ano
    AND t.is_oficial IS TRUE AND t.estado='PUBLICADO'
    AND t.data_inicio=NEW.data_inicio AND t.data_fim=NEW.data_fim
  ORDER BY (t.subsistema='REGULAR_ADULTOS') DESC,t.id LIMIT 1;
  SELECT count(DISTINCT (i.numero,i.data_inicio,i.data_fim,i.peso))
    INTO v_distinct_terms
  FROM public.calendario_template_items i
  JOIN public.calendario_templates t ON t.id=i.template_id
  WHERE t.ano_base=NEW.ano AND t.calendario_canonico_ano=NEW.ano
    AND t.is_oficial IS TRUE AND t.estado='PUBLICADO'
    AND i.tipo::text='PERIODO_LETIVO';
  IF v_profile IS NULL OR v_distinct_terms<>3 OR EXISTS (
    SELECT 1 FROM public.calendario_templates t
    WHERE t.ano_base=NEW.ano AND t.calendario_canonico_ano=NEW.ano
      AND t.is_oficial IS TRUE AND t.estado='PUBLICADO'
      AND (SELECT count(*) FROM public.calendario_template_items i
           WHERE i.template_id=t.id AND i.tipo::text='PERIODO_LETIVO')<>3
  ) THEN
    RAISE EXCEPTION 'OFFICIAL_TRIMESTERS_INCOMPLETE: Perfis MED divergentes.';
  END IF;

  INSERT INTO public.periodos_letivos(
    escola_id,ano_letivo_id,tipo,numero,data_inicio,data_fim,peso,
    source_template_id,source_item_id,source_version,applied_at
  )
  SELECT NEW.escola_id,NEW.id,'TRIMESTRE',i.numero,i.data_inicio,i.data_fim,i.peso,
         v_profile,i.id,v_version,now()
  FROM public.calendario_template_items i
  WHERE i.template_id=v_profile AND i.tipo::text='PERIODO_LETIVO';
  GET DIAGNOSTICS v_inserted=ROW_COUNT;
  IF v_inserted<>3 THEN
    RAISE EXCEPTION 'OFFICIAL_TRIMESTERS_INCOMPLETE: Inserção de % períodos.',v_inserted;
  END IF;
  v_health:=internal.med_year_readiness(NEW.escola_id,NEW.id);
  IF (v_health->>'ok')::boolean IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'MED_YEAR_NOT_READY: %',coalesce(v_health->>'code','UNKNOWN');
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_bootstrap_new_school_med_terms ON public.anos_letivos;
CREATE TRIGGER trg_bootstrap_new_school_med_terms
AFTER INSERT ON public.anos_letivos
FOR EACH ROW EXECUTE FUNCTION internal.bootstrap_new_school_med_terms();

REVOKE ALL ON FUNCTION internal.bootstrap_new_school_med_terms() FROM PUBLIC,anon,authenticated;
COMMIT;