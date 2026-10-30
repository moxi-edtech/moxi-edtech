-- All sample records stay in this rollback-only transaction.
BEGIN;
DO $$
DECLARE
  v_school uuid := '40000000-0000-0000-0000-000000000001';
  v_year uuid := '40000000-0000-0000-0000-000000000002';
  v_regular uuid := 'b5d7b33a-8a77-4d74-9c65-202620270001';
  v_technical uuid := 'b5d7b33a-8a77-4d74-9c65-202620270003';
  v_regular_course uuid := '40000000-0000-0000-0000-000000000003';
  v_technical_course uuid := '40000000-0000-0000-0000-000000000004';
  v_regular_offering uuid := '40000000-0000-0000-0000-000000000005';
  v_technical_offering uuid := '40000000-0000-0000-0000-000000000006';
  v_regular_event uuid;
  v_technical_event uuid;
BEGIN
  IF (SELECT count(*) FROM public.calendarios_oficiais_anos WHERE ano_base=2026)<>1 THEN
    RAISE EXCEPTION 'TEST: expected exactly one official MED year';
  END IF;
  IF (SELECT count(*) FROM public.calendario_templates
      WHERE ano_base=2026 AND calendario_canonico_ano=2026)<>4 THEN
    RAISE EXCEPTION 'TEST: all four historical profiles must inherit the same MED year';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.calendario_templates t
    JOIN public.calendarios_oficiais_anos c ON c.ano_base=t.calendario_canonico_ano
    WHERE t.ano_base=2026 AND
      (t.data_inicio IS DISTINCT FROM c.data_inicio OR t.data_fim IS DISTINCT FROM c.data_fim)
  ) THEN
    RAISE EXCEPTION 'TEST: published profiles still diverge from their canonical year';
  END IF;

  INSERT INTO public.anos_letivos(id,escola_id,ano,ativo)
  VALUES(v_year,v_school,2026,true);
  INSERT INTO public.cursos(id,escola_id,nome) VALUES
    (v_regular_course,v_school,'Ensino regular'),
    (v_technical_course,v_school,'Técnico-profissional');
  INSERT INTO public.school_education_offerings
    (id,escola_id,course_id,education_subsystem,calendar_profile_id)
  VALUES
    (v_regular_offering,v_school,v_regular_course,'REGULAR_ADULTOS',v_regular),
    (v_technical_offering,v_school,v_technical_course,'TECNICO_PROFISSIONAL',v_technical);

  INSERT INTO public.calendario_template_items
    (id,template_id,tipo,numero,nome,data_inicio,data_fim,peso)
  VALUES
    ('40000000-0000-0000-0000-000000000007',v_regular,'FERIADO',99,'Feriado da escola','2026-11-11','2026-11-11',NULL),
    ('40000000-0000-0000-0000-000000000008',v_technical,'FERIADO',99,'Feriado da escola','2026-11-11','2026-11-11',NULL);
  v_regular_event := '40000000-0000-0000-0000-000000000007';
  v_technical_event := '40000000-0000-0000-0000-000000000008';

  INSERT INTO public.calendario_eventos
    (escola_id,ano_letivo_id,offering_id,tipo,nome,data_inicio,data_fim,
     source_template_id,source_item_id)
  VALUES
    (v_school,v_year,v_regular_offering,'FERIADO','Feriado da escola','2026-11-11','2026-11-11',v_regular,v_regular_event),
    (v_school,v_year,v_technical_offering,'FERIADO','Feriado da escola','2026-11-11','2026-11-11',v_technical,v_technical_event);
  IF (SELECT count(*) FROM public.calendario_eventos WHERE escola_id=v_school)<>2 THEN
    RAISE EXCEPTION 'TEST: events in different courses were silently coalesced';
  END IF;

  -- On-conflict must be idempotent per course and for global (NULL) events.
  INSERT INTO public.calendario_eventos
    (escola_id,ano_letivo_id,offering_id,tipo,nome,data_inicio,data_fim,
     source_template_id,source_item_id)
  VALUES
    (v_school,v_year,v_regular_offering,'FERIADO','Feriado da escola','2026-11-11','2026-11-11',v_regular,v_regular_event)
  ON CONFLICT (escola_id,ano_letivo_id,offering_id,nome,data_inicio)
  DO UPDATE SET data_fim=EXCLUDED.data_fim;
  IF (SELECT count(*) FROM public.calendario_eventos WHERE escola_id=v_school)<>2 THEN
    RAISE EXCEPTION 'TEST: repeat of one course calendar created duplicates';
  END IF;

  BEGIN
    UPDATE public.calendario_templates SET data_inicio='2026-08-31' WHERE id=v_regular;
    RAISE EXCEPTION 'TEST: published profile changed the canonical year';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'TEST:%' OR SQLERRM NOT LIKE 'OFFICIAL_CALENDAR_CANONICAL_MISMATCH:%' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE public.calendario_template_items SET data_fim='2027-04-08'
    WHERE template_id=v_regular AND tipo='PERIODO_LETIVO' AND numero=2;
    RAISE EXCEPTION 'TEST: published teaching term was edited';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'TEST:%' OR SQLERRM NOT LIKE 'OFFICIAL_CALENDAR_IMMUTABLE:%' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE public.school_education_offerings SET calendar_profile_id=v_technical
    WHERE id=v_regular_offering;
    RAISE EXCEPTION 'TEST: regular course adopted the technical profile';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'TEST:%' OR SQLERRM NOT LIKE 'COURSE_CALENDAR_PROFILE_MISMATCH:%' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE public.calendario_eventos
      SET source_template_id=v_technical,source_item_id=v_technical_event
      WHERE offering_id=v_regular_offering;
    RAISE EXCEPTION 'TEST: scoped event migrated to another subsystem';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'TEST:%' OR SQLERRM NOT LIKE 'COURSE_CALENDAR_PROFILE_MISMATCH:%' THEN RAISE; END IF;
  END;
END;
$$;
ROLLBACK;
