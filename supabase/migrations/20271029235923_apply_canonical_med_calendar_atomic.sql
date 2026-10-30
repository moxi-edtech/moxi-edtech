-- Single transaction for the MED year, term provenance, course events and
-- school offering profile links. Prevents half-created academic calendars if
-- a period, event or course profile fails after the year has been inserted.
BEGIN;

CREATE OR REPLACE FUNCTION public.aplicar_calendario_med_canonico_v1(
  p_escola_id uuid,
  p_ano_base integer,
  p_periodos jsonb,
  p_eventos jsonb,
  p_ofertas jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $canonical$
DECLARE
  v_actor uuid := auth.uid();
  v_calendar public.calendarios_oficiais_anos%ROWTYPE;
  v_year_id uuid;
  v_existing boolean := FALSE;
  v_offer_count integer;
  v_period_count integer;
  v_period jsonb;
  v_event jsonb;
  v_mapping jsonb;
  v_existing_period public.periodos_letivos%ROWTYPE;
  v_existing_event public.calendario_eventos%ROWTYPE;
  v_offering_id uuid;
  v_template_id uuid;
  v_item_id uuid;
  v_num integer;
  v_seen_periods integer[] := ARRAY[]::integer[];
  v_seen_offerings uuid[] := ARRAY[]::uuid[];
  v_event_keys text[] := ARRAY[]::text[];
  v_event_key text;
BEGIN
  IF v_actor IS NULL
    OR public.current_tenant_escola_id() IS DISTINCT FROM p_escola_id
    OR NOT public.user_has_role_in_school(p_escola_id,
       ARRAY['admin','admin_escola','staff_admin','diretor','admin_secretaria','secretaria','admin_financeiro']) THEN
    RAISE EXCEPTION 'AUTH: Configuração do calendário não autorizada.';
  END IF;
  IF p_ano_base < 2026 OR p_ano_base > 2100 OR
     jsonb_typeof(p_periodos) IS DISTINCT FROM 'array' OR
     jsonb_typeof(p_eventos) IS DISTINCT FROM 'array' OR
     jsonb_typeof(p_ofertas) IS DISTINCT FROM 'array' OR
     jsonb_array_length(p_periodos) <> 3 THEN
    RAISE EXCEPTION 'DATA: Contrato do calendário canónico inválido.';
  END IF;

  SELECT * INTO STRICT v_calendar
    FROM public.calendarios_oficiais_anos
   WHERE ano_base=p_ano_base AND estado='PUBLICADO'
   FOR SHARE;
  SELECT count(*) INTO v_offer_count
    FROM public.school_education_offerings o
   WHERE o.escola_id=p_escola_id AND o.status='active';
  IF v_offer_count > 500 OR jsonb_array_length(p_ofertas) <> v_offer_count THEN
    RAISE EXCEPTION 'CALENDAR_COURSE_MAPPING_INCOMPLETE: Todos os cursos ativos devem receber um perfil.';
  END IF;

  FOR v_mapping IN SELECT value FROM jsonb_array_elements(p_ofertas) LOOP
    v_offering_id := (v_mapping->>'offering_id')::uuid;
    v_template_id := (v_mapping->>'template_id')::uuid;
    IF v_offering_id = ANY(v_seen_offerings) OR NOT EXISTS (
      SELECT 1 FROM public.school_education_offerings o
      JOIN public.cursos c ON c.id=o.course_id AND c.escola_id=o.escola_id
      JOIN public.calendario_templates t ON t.id=v_template_id
      WHERE o.id=v_offering_id AND o.escola_id=p_escola_id AND o.status='active'
        AND o.education_subsystem=t.subsistema
        AND t.ano_base=p_ano_base AND t.calendario_canonico_ano=p_ano_base
        AND t.estado='PUBLICADO' AND t.is_oficial IS TRUE
        AND t.data_inicio=v_calendar.data_inicio AND t.data_fim=v_calendar.data_fim
        AND t.versao_documento=v_calendar.versao_documento
    ) THEN
      RAISE EXCEPTION 'CALENDAR_COURSE_PROFILE_MISMATCH: A oferta não corresponde ao perfil deste ano.';
    END IF;
    v_seen_offerings := array_append(v_seen_offerings,v_offering_id);
  END LOOP;

  IF (SELECT count(DISTINCT item->>'source_template_id')
        FROM jsonb_array_elements(p_periodos) item) <> 1 THEN
    RAISE EXCEPTION 'OFFICIAL_TRIMESTER_MISMATCH: Os três trimestres precisam da mesma fonte canónica.';
  END IF;
  FOR v_period IN SELECT value FROM jsonb_array_elements(p_periodos) LOOP
    v_num := (v_period->>'numero')::integer;
    v_template_id := (v_period->>'source_template_id')::uuid;
    v_item_id := (v_period->>'source_item_id')::uuid;
    IF v_num NOT IN (1,2,3) OR v_num = ANY(v_seen_periods)
       OR v_period->>'tipo' IS DISTINCT FROM 'TRIMESTRE'
       OR NOT EXISTS (
         SELECT 1
         FROM public.calendario_template_items i
         JOIN public.calendario_templates t ON t.id=i.template_id
         WHERE t.id=v_template_id AND i.id=v_item_id
           AND t.ano_base=p_ano_base AND t.calendario_canonico_ano=p_ano_base
           AND t.is_oficial IS TRUE AND t.estado='PUBLICADO'
           AND i.tipo::text='PERIODO_LETIVO' AND i.numero=v_num
           AND i.data_inicio=(v_period->>'data_inicio')::date
           AND i.data_fim=(v_period->>'data_fim')::date
           AND i.peso IS NOT DISTINCT FROM (v_period->>'peso')::smallint
       ) THEN
      RAISE EXCEPTION 'OFFICIAL_TRIMESTER_MISMATCH: O trimestre difere do decreto.';
    END IF;
    v_seen_periods := array_append(v_seen_periods,v_num);
  END LOOP;

  -- Every submitted event must be an unchanged official item. An event with
  -- offering_id must use the exact profile selected for that course.
  FOR v_event IN SELECT value FROM jsonb_array_elements(p_eventos) LOOP
    v_template_id := (v_event->>'source_template_id')::uuid;
    v_item_id := (v_event->>'source_item_id')::uuid;
    v_offering_id := nullif(v_event->>'offering_id','')::uuid;
    v_event_key := concat_ws('|',coalesce(v_offering_id::text,'GLOBAL'),
      v_event->>'nome',v_event->>'data_inicio');
    IF v_event_key = ANY(v_event_keys) THEN
      RAISE EXCEPTION 'CALENDAR_EVENT_COLLISION: Evento duplicado no mesmo curso.';
    END IF;
    v_event_keys := array_append(v_event_keys,v_event_key);
    IF NOT EXISTS (
      SELECT 1 FROM public.calendario_template_items i
      JOIN public.calendario_templates t ON t.id=i.template_id
      WHERE i.id=v_item_id AND t.id=v_template_id
        AND t.ano_base=p_ano_base AND t.calendario_canonico_ano=p_ano_base
        AND t.is_oficial IS TRUE AND t.estado='PUBLICADO'
        AND i.tipo::text=v_event->>'tipo'
        AND i.tipo::text<>'PERIODO_LETIVO'
        AND i.nome=v_event->>'nome'
        AND i.data_inicio=(v_event->>'data_inicio')::date
        AND i.data_fim=(v_event->>'data_fim')::date
    ) THEN
      RAISE EXCEPTION 'OFFICIAL_CALENDAR_EVENT_MISMATCH: Evento sem fonte MED válida.';
    END IF;
    IF v_offering_id IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_ofertas) chosen
      JOIN public.school_education_offerings o
        ON o.id=(chosen->>'offering_id')::uuid AND o.escola_id=p_escola_id
      JOIN public.cursos c ON c.id=o.course_id AND c.escola_id=o.escola_id
      JOIN public.calendario_template_items i ON i.id=v_item_id
      WHERE (chosen->>'offering_id')::uuid=v_offering_id
        AND (chosen->>'template_id')::uuid=v_template_id
        AND (i.applies_to_all_offerings IS TRUE
          OR coalesce(cardinality(i.education_subsystems),0)>0
          OR coalesce(cardinality(i.education_levels),0)>0
          OR coalesce(cardinality(i.cycles),0)>0
          OR coalesce(cardinality(i.grade_codes),0)>0
          OR coalesce(cardinality(i.course_types),0)>0)
        AND (coalesce(cardinality(i.education_subsystems),0)=0
          OR o.education_subsystem=ANY(i.education_subsystems))
        AND (coalesce(cardinality(i.education_levels),0)=0
          OR o.education_level=ANY(i.education_levels))
        AND (coalesce(cardinality(i.cycles),0)=0
          OR o.cycle=ANY(i.cycles))
        AND (coalesce(cardinality(i.grade_codes),0)=0
          OR coalesce(o.grades,ARRAY[]::text[]) && i.grade_codes)
        AND (coalesce(cardinality(i.course_types),0)=0
          OR c.tipo=ANY(i.course_types))
    ) THEN
      RAISE EXCEPTION 'CALENDAR_COURSE_PROFILE_MISMATCH: Evento não se aplica ao curso ou à classe.';
    END IF;
    IF v_offering_id IS NULL AND NOT EXISTS (
      SELECT 1 FROM public.calendario_template_items i
       WHERE i.id=v_item_id
         AND i.applies_to_all_offerings IS TRUE
         AND coalesce(cardinality(i.education_subsystems),0)=0
         AND coalesce(cardinality(i.education_levels),0)=0
         AND coalesce(cardinality(i.cycles),0)=0
         AND coalesce(cardinality(i.grade_codes),0)=0
         AND coalesce(cardinality(i.course_types),0)=0
    ) THEN
      RAISE EXCEPTION 'CALENDAR_EVENT_SCOPE_MISMATCH: Evento de curso não pode ser global.';
    END IF;
    -- A shared event must actually exist with the same dates in every
    -- currently selected course profile, otherwise it is not schoolwide.
    IF v_offering_id IS NULL AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_ofertas) selected
      WHERE NOT EXISTS (
        SELECT 1 FROM public.calendario_template_items peer
        WHERE peer.template_id=(selected->>'template_id')::uuid
          AND peer.tipo::text=v_event->>'tipo'
          AND peer.nome=v_event->>'nome'
          AND peer.data_inicio=(v_event->>'data_inicio')::date
          AND peer.data_fim=(v_event->>'data_fim')::date
          AND peer.applies_to_all_offerings IS TRUE
          AND coalesce(cardinality(peer.education_subsystems),0)=0
          AND coalesce(cardinality(peer.education_levels),0)=0
          AND coalesce(cardinality(peer.cycles),0)=0
          AND coalesce(cardinality(peer.grade_codes),0)=0
          AND coalesce(cardinality(peer.course_types),0)=0
      )
    ) THEN
      RAISE EXCEPTION 'CALENDAR_EVENT_SCOPE_MISMATCH: O evento não é comum a todos os cursos.';
    END IF;
  END LOOP;

  -- A newer active school year must never be rolled backwards by this RPC.
  IF EXISTS (SELECT 1 FROM public.anos_letivos
             WHERE escola_id=p_escola_id AND ativo IS TRUE AND ano>p_ano_base) THEN
    RAISE EXCEPTION 'ACADEMIC_YEAR_IN_THE_PAST: Ano inferior ao ano ativo.';
  END IF;
  SELECT id INTO v_year_id FROM public.anos_letivos
   WHERE escola_id=p_escola_id AND ano=p_ano_base FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.anos_letivos(escola_id,ano,data_inicio,data_fim,ativo)
      VALUES(p_escola_id,p_ano_base,v_calendar.data_inicio,v_calendar.data_fim,FALSE)
      ON CONFLICT(escola_id,ano) DO NOTHING
      RETURNING id INTO v_year_id;
    IF v_year_id IS NULL THEN
      SELECT id INTO STRICT v_year_id FROM public.anos_letivos
       WHERE escola_id=p_escola_id AND ano=p_ano_base FOR UPDATE;
    END IF;
  ELSE
    v_existing := TRUE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.anos_letivos a
     WHERE a.id=v_year_id AND a.escola_id=p_escola_id
       AND a.data_inicio=v_calendar.data_inicio AND a.data_fim=v_calendar.data_fim
  ) THEN
    RAISE EXCEPTION 'ACADEMIC_YEAR_CALENDAR_MISMATCH: Ano de destino diverge da fonte MED.';
  END IF;

  -- Preserve UUIDs referenced by notes and historical snapshots: only
  -- install absent periods, never delete/recreate, edit locks or re-key.
  SELECT count(*) INTO v_period_count FROM public.periodos_letivos
    WHERE escola_id=p_escola_id AND ano_letivo_id=v_year_id;
  IF v_period_count NOT IN (0,3) OR EXISTS (
    SELECT 1 FROM public.periodos_letivos p
    WHERE p.escola_id=p_escola_id AND p.ano_letivo_id=v_year_id
      AND (p.tipo::text<>'TRIMESTRE' OR p.offering_id IS NOT NULL
        OR p.trava_notas_em IS NOT NULL OR NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(p_periodos) item
          WHERE (item->>'numero')::integer=p.numero
            AND (item->>'source_template_id')::uuid=p.source_template_id
            AND (item->>'source_item_id')::uuid=p.source_item_id
            AND (item->>'data_inicio')::date=p.data_inicio
            AND (item->>'data_fim')::date=p.data_fim
            AND (item->>'peso')::smallint IS NOT DISTINCT FROM p.peso
        ))
  ) THEN
    RAISE EXCEPTION 'ACADEMIC_PERIOD_RECONCILIATION_REQUIRED: Existem períodos incompatíveis ou fechados.';
  END IF;
  FOR v_period IN SELECT value FROM jsonb_array_elements(p_periodos) LOOP
    INSERT INTO public.periodos_letivos(
      escola_id,ano_letivo_id,tipo,numero,data_inicio,data_fim,peso,
      source_template_id,source_item_id,source_version,applied_at,applied_by
    ) VALUES (
      p_escola_id,v_year_id,'TRIMESTRE',
      (v_period->>'numero')::smallint,
      (v_period->>'data_inicio')::date,
      (v_period->>'data_fim')::date,
      (v_period->>'peso')::smallint,
      (v_period->>'source_template_id')::uuid,
      (v_period->>'source_item_id')::uuid,
      v_calendar.versao_documento,now(),v_actor
    )
    ON CONFLICT (escola_id,ano_letivo_id,tipo,numero) DO NOTHING;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM public.calendario_eventos old
    WHERE old.escola_id=p_escola_id AND old.ano_letivo_id=v_year_id
      AND old.source_template_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_eventos) ev
        WHERE old.offering_id IS NOT DISTINCT FROM nullif(ev->>'offering_id','')::uuid
          AND old.nome=ev->>'nome'
          AND old.data_inicio=(ev->>'data_inicio')::date
          AND old.data_fim=(ev->>'data_fim')::date
          AND old.tipo::text=ev->>'tipo'
          AND old.source_template_id=(ev->>'source_template_id')::uuid
          AND old.source_item_id=(ev->>'source_item_id')::uuid
      )
  ) THEN
    RAISE EXCEPTION 'ACADEMIC_CALENDAR_EXISTING_EVENTS_REVIEW_REQUIRED: Eventos oficiais divergentes.';
  END IF;
  FOR v_event IN SELECT value FROM jsonb_array_elements(p_eventos) LOOP
    v_offering_id := nullif(v_event->>'offering_id','')::uuid;
    SELECT * INTO v_existing_event FROM public.calendario_eventos
      WHERE escola_id=p_escola_id AND ano_letivo_id=v_year_id
      AND offering_id IS NOT DISTINCT FROM v_offering_id
      AND nome=v_event->>'nome' AND data_inicio=(v_event->>'data_inicio')::date;
    IF FOUND AND (
      v_existing_event.source_template_id IS DISTINCT FROM (v_event->>'source_template_id')::uuid
      OR v_existing_event.source_item_id IS DISTINCT FROM (v_event->>'source_item_id')::uuid
      OR v_existing_event.data_fim IS DISTINCT FROM (v_event->>'data_fim')::date
      OR v_existing_event.tipo::text IS DISTINCT FROM v_event->>'tipo'
    ) THEN
      RAISE EXCEPTION 'ACADEMIC_CALENDAR_EVENT_COLLISION: Evento existente usa outra origem.';
    END IF;
    INSERT INTO public.calendario_eventos(
      escola_id,ano_letivo_id,offering_id,tipo,nome,data_inicio,data_fim,
      source_template_id,source_item_id,source_version,applied_at,applied_by
    ) VALUES (
      p_escola_id,v_year_id,v_offering_id,
      (v_event->>'tipo')::public.tipo_evento_calendario,
      v_event->>'nome',(v_event->>'data_inicio')::date,
      (v_event->>'data_fim')::date,
      (v_event->>'source_template_id')::uuid,
      (v_event->>'source_item_id')::uuid,
      v_calendar.versao_documento,now(),v_actor
    )
    ON CONFLICT (escola_id,ano_letivo_id,offering_id,nome,data_inicio)
    DO NOTHING;
  END LOOP;
  FOR v_mapping IN SELECT value FROM jsonb_array_elements(p_ofertas) LOOP
    UPDATE public.school_education_offerings
      SET calendar_profile_id=(v_mapping->>'template_id')::uuid,updated_at=now()
      WHERE id=(v_mapping->>'offering_id')::uuid
        AND escola_id=p_escola_id AND status='active';
  END LOOP;
  RETURN jsonb_build_object(
    'ok',TRUE, 'target_id',v_year_id, 'reused',v_existing,
    'trimestres',jsonb_array_length(p_periodos),
    'eventos',jsonb_array_length(p_eventos),
    'ofertas_atualizadas',jsonb_array_length(p_ofertas)
  );
END;
$canonical$;

REVOKE ALL ON FUNCTION public.aplicar_calendario_med_canonico_v1(uuid,integer,jsonb,jsonb,jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aplicar_calendario_med_canonico_v1(uuid,integer,jsonb,jsonb,jsonb)
  TO authenticated, service_role;

COMMIT;
