-- One fail-closed readiness contract for year activation and the Balcao cutover.
-- Never attempt to invent 2027/28 decree dates when MED has not published them.
BEGIN;
CREATE OR REPLACE FUNCTION internal.med_year_readiness(
  p_escola_id uuid,p_ano_letivo_id uuid
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO pg_catalog,public,internal,pg_temp
AS $readiness$
DECLARE
  v_year public.anos_letivos%ROWTYPE;
  v_terms integer;
  v_missing_terms integer;
  v_offerings integer;
  v_courses_unmapped integer;
  v_links_missing integer;
  v_official_events integer;
BEGIN
  SELECT * INTO v_year FROM public.anos_letivos
  WHERE id=p_ano_letivo_id AND escola_id=p_escola_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok',false,'code','ACADEMIC_TARGET_YEAR_NOT_FOUND');
  END IF;
  IF v_year.ano<2026 THEN
    RETURN jsonb_build_object('ok',true,'legacy',true,'ano_base',v_year.ano);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.calendarios_oficiais_anos c
    WHERE c.ano_base=v_year.ano AND c.estado='PUBLICADO'
      AND c.data_inicio=v_year.data_inicio AND c.data_fim=v_year.data_fim
  ) THEN
    RETURN jsonb_build_object('ok',false,'code','OFFICIAL_CALENDAR_NOT_PUBLISHED_OR_YEAR_MISMATCH',
      'ano_base',v_year.ano);
  END IF;

  SELECT count(*),count(*) FILTER (
    WHERE p.offering_id IS NOT NULL OR p.tipo::text<>'TRIMESTRE'
      OR p.numero NOT BETWEEN 1 AND 3 OR p.trava_notas_em IS NOT NULL
      OR t.id IS NULL OR t.ano_base IS DISTINCT FROM v_year.ano
      OR t.calendario_canonico_ano IS DISTINCT FROM v_year.ano
      OR t.is_oficial IS DISTINCT FROM true OR t.estado IS DISTINCT FROM 'PUBLICADO'
      OR i.id IS NULL OR i.template_id IS DISTINCT FROM t.id
      OR i.tipo::text<>'PERIODO_LETIVO'
      OR i.numero IS DISTINCT FROM p.numero
      OR i.data_inicio IS DISTINCT FROM p.data_inicio
      OR i.data_fim IS DISTINCT FROM p.data_fim
      OR i.peso IS DISTINCT FROM p.peso
  ) INTO v_terms,v_missing_terms
  FROM public.periodos_letivos p
  LEFT JOIN public.calendario_templates t ON t.id=p.source_template_id
  LEFT JOIN public.calendario_template_items i ON i.id=p.source_item_id
  WHERE p.escola_id=p_escola_id AND p.ano_letivo_id=p_ano_letivo_id;
  IF v_terms<>3 OR v_missing_terms>0 OR
     (SELECT count(DISTINCT numero) FROM public.periodos_letivos
       WHERE escola_id=p_escola_id AND ano_letivo_id=p_ano_letivo_id)<>3
  THEN
    RETURN jsonb_build_object('ok',false,'code','OFFICIAL_TRIMESTERS_INCOMPLETE',
      'ano_base',v_year.ano,'terms',v_terms,'invalid_terms',v_missing_terms);
  END IF;

  SELECT count(*) INTO v_courses_unmapped
  FROM public.cursos c
  WHERE c.escola_id=p_escola_id
    AND NOT EXISTS (
      SELECT 1 FROM public.school_education_offerings o
      WHERE o.escola_id=p_escola_id AND o.course_id=c.id AND o.status='active'
    );
  IF v_courses_unmapped>0 THEN
    RETURN jsonb_build_object('ok',false,'code','COURSES_WITHOUT_ACTIVE_OFFERING',
      'missing_courses',v_courses_unmapped);
  END IF;

  SELECT count(*) INTO v_offerings FROM public.school_education_offerings
  WHERE escola_id=p_escola_id AND status='active';
  IF v_offerings>500 THEN
    RETURN jsonb_build_object('ok',false,'code','TOO_MANY_ACTIVE_OFFERINGS');
  END IF;

  SELECT count(*) INTO v_links_missing
  FROM public.school_education_offerings o
  LEFT JOIN public.school_offering_med_year_profiles m
    ON m.escola_id=o.escola_id AND m.offering_id=o.id
    AND m.ano_letivo_id=p_ano_letivo_id
  LEFT JOIN public.calendario_templates t ON t.id=m.calendar_profile_id
  WHERE o.escola_id=p_escola_id AND o.status='active'
    AND (m.offering_id IS NULL OR t.id IS NULL OR t.ano_base<>v_year.ano
      OR t.subsistema IS DISTINCT FROM o.education_subsystem
      OR t.calendario_canonico_ano IS DISTINCT FROM v_year.ano);
  IF v_links_missing>0 THEN
    RETURN jsonb_build_object('ok',false,'code','MED_YEAR_OFFERING_PROFILES_MISSING',
      'ano_base',v_year.ano,'missing_offerings',v_links_missing);
  END IF;

  SELECT count(*) INTO v_official_events
  FROM public.calendario_eventos e
  JOIN public.calendario_templates t ON t.id=e.source_template_id
  JOIN public.calendario_template_items i ON i.id=e.source_item_id
  WHERE e.escola_id=p_escola_id AND e.ano_letivo_id=p_ano_letivo_id
    AND t.ano_base=v_year.ano AND t.calendario_canonico_ano=v_year.ano
    AND t.is_oficial IS TRUE AND t.estado='PUBLICADO'
    AND i.template_id=t.id
    AND i.tipo::text=e.tipo::text AND i.nome=e.nome
    AND i.data_inicio=e.data_inicio AND i.data_fim=e.data_fim;

  IF v_offerings>0 AND v_official_events=0 THEN
    RETURN jsonb_build_object('ok',false,'code','OFFICIAL_CALENDAR_EVENTS_NOT_APPLIED',
      'ano_base',v_year.ano);
  END IF;

  RETURN jsonb_build_object(
    'ok',true,'code','READY','ano_base',v_year.ano,
    'offering_count',v_offerings,'profile_count',v_offerings,
    'terms',v_terms,'official_events',v_official_events
  );
END;
$readiness$;

CREATE OR REPLACE FUNCTION public.med_year_cutover_preflight(
  p_escola_id uuid,p_ano_letivo_id uuid
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO pg_catalog,public,internal,pg_temp
AS $preflight$
BEGIN
  IF auth.uid() IS NULL OR NOT public.user_has_role_in_school(
    p_escola_id,ARRAY['admin','admin_escola','staff_admin','diretor','admin_secretaria','secretaria']
  ) THEN
    RAISE EXCEPTION 'AUTH: Consulta de virada não autorizada.' USING ERRCODE='42501';
  END IF;
  RETURN internal.med_year_readiness(p_escola_id,p_ano_letivo_id);
END;
$preflight$;
REVOKE ALL ON FUNCTION public.med_year_cutover_preflight(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.med_year_cutover_preflight(uuid,uuid) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION internal.guard_med_year_activation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO pg_catalog,public,internal,pg_temp AS $activation$
DECLARE v_health jsonb;
BEGIN
  IF NEW.ativo IS TRUE AND NEW.ano>=2026
    AND (TG_OP='INSERT' OR (TG_OP='UPDATE' AND OLD.ativo IS DISTINCT FROM TRUE)) THEN
    IF TG_OP='INSERT' THEN
      RAISE EXCEPTION 'MED_YEAR_NOT_READY: Prepare o calendário oficial e os trimestres antes de ativar o ano.';
    END IF;
    v_health:=internal.med_year_readiness(NEW.escola_id,NEW.id);
    IF (v_health->>'ok')::boolean IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION 'MED_YEAR_NOT_READY: %',
        coalesce(v_health->>'code','UNKNOWN');
    END IF;
  END IF;
  RETURN NEW;
END;
$activation$;
DROP TRIGGER IF EXISTS trg_guard_med_year_activation ON public.anos_letivos;
CREATE TRIGGER trg_guard_med_year_activation
BEFORE INSERT OR UPDATE OF ativo ON public.anos_letivos
FOR EACH ROW EXECUTE FUNCTION internal.guard_med_year_activation();

REVOKE ALL ON FUNCTION internal.med_year_readiness(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION internal.guard_med_year_activation() FROM PUBLIC,anon,authenticated;
COMMIT;
