-- Execute in disposable PostgreSQL 17 AFTER all MED calendar migrations.
-- All test records are rolled back after the assertions.
BEGIN;
DO $atomic$
DECLARE
  v_user uuid := '30000000-0000-0000-0000-000000000001';
  v_school uuid := '30000000-0000-0000-0000-000000000002';
  v_school_fail uuid := '30000000-0000-0000-0000-000000000003';
  v_regular uuid := 'b5d7b33a-8a77-4d74-9c65-202620270001';
  v_technical uuid := 'b5d7b33a-8a77-4d74-9c65-202620270003';
  v_course_a uuid := '30000000-0000-0000-0000-000000000004';
  v_course_b uuid := '30000000-0000-0000-0000-000000000005';
  v_course_fail uuid := '30000000-0000-0000-0000-000000000006';
  v_off_a uuid := '30000000-0000-0000-0000-000000000007';
  v_off_b uuid := '30000000-0000-0000-0000-000000000008';
  v_off_fail uuid := '30000000-0000-0000-0000-000000000009';
  v_item_a uuid := '30000000-0000-0000-0000-000000000010';
  v_item_b uuid := '30000000-0000-0000-0000-000000000011';
  v_periods jsonb;
  v_events jsonb;
  v_offerings jsonb;
  v_result jsonb;
  v_id uuid;
  v_period_uuid uuid;
BEGIN
  INSERT INTO public.escola_users(escola_id,user_id,papel)
  VALUES(v_school,v_user,'admin'),(v_school_fail,v_user,'admin');
  INSERT INTO public.cursos(id,escola_id,nome)
  VALUES (v_course_a,v_school,'Regular'),
         (v_course_b,v_school,'Técnico'),
         (v_course_fail,v_school_fail,'Regular de teste');
  INSERT INTO public.school_education_offerings(
    id,escola_id,course_id,education_subsystem,calendar_profile_id,status
  ) VALUES
    (v_off_a,v_school,v_course_a,'REGULAR_ADULTOS',v_regular,'active'),
    (v_off_b,v_school,v_course_b,'TECNICO_PROFISSIONAL',v_technical,'active'),
    (v_off_fail,v_school_fail,v_course_fail,'REGULAR_ADULTOS',v_regular,'active');
  INSERT INTO public.calendario_template_items
    (id,template_id,tipo,numero,nome,data_inicio,data_fim,peso,applies_to_all_offerings)
  VALUES
    (v_item_a,v_regular,'EXAME_ESCRITO',99,'Exames regulares','2027-06-20','2027-06-23',NULL,false),
    (v_item_b,v_technical,'EXAME_ESCRITO',99,'Exames técnicos','2027-06-20','2027-06-23',NULL,false);

  SELECT jsonb_agg(jsonb_build_object(
    'numero', i.numero, 'tipo','TRIMESTRE',
    'data_inicio',i.data_inicio,'data_fim',i.data_fim,'peso',i.peso,
    'source_template_id',v_regular,'source_item_id',i.id,
    'source_version','FINAL-ACTUALIZADO'
  ) ORDER BY i.numero) INTO v_periods
    FROM public.calendario_template_items i
   WHERE i.template_id=v_regular AND i.tipo::text='PERIODO_LETIVO';

  v_events := jsonb_build_array(
    jsonb_build_object(
      'offering_id',v_off_a,'tipo','EXAME_ESCRITO',
      'nome','Exames regulares','data_inicio','2027-06-20',
      'data_fim','2027-06-23','source_template_id',v_regular,
      'source_item_id',v_item_a
    ),
    jsonb_build_object(
      'offering_id',v_off_b,'tipo','EXAME_ESCRITO',
      'nome','Exames técnicos','data_inicio','2027-06-20',
      'data_fim','2027-06-23','source_template_id',v_technical,
      'source_item_id',v_item_b
    )
  );
  v_offerings := jsonb_build_array(
    jsonb_build_object('offering_id',v_off_a,'template_id',v_regular),
    jsonb_build_object('offering_id',v_off_b,'template_id',v_technical)
  );
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub',v_user,'escola_id',v_school)::text,true);

  SELECT public.aplicar_calendario_med_canonico_v1(
    v_school,2026,v_periods,v_events,v_offerings
  ) INTO v_result;
  IF v_result->>'ok' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'TEST: first canonical application not confirmed';
  END IF;
  v_id := (v_result->>'target_id')::uuid;
  SELECT p.id INTO v_period_uuid FROM public.periodos_letivos p
    WHERE p.escola_id=v_school AND p.ano_letivo_id=v_id AND p.numero=1;
  IF v_period_uuid IS NULL OR (
      SELECT count(*) FROM public.periodos_letivos
      WHERE escola_id=v_school AND ano_letivo_id=v_id
    )<>3 OR (
      SELECT count(*) FROM public.calendario_eventos
      WHERE escola_id=v_school AND ano_letivo_id=v_id
    )<>2 THEN
    RAISE EXCEPTION 'TEST: initial year/term/event counts incorrect';
  END IF;

  SELECT public.aplicar_calendario_med_canonico_v1(
    v_school,2026,v_periods,v_events,v_offerings
  ) INTO v_result;
  IF v_result->>'reused' IS DISTINCT FROM 'true' OR (
      SELECT count(*) FROM public.periodos_letivos
      WHERE escola_id=v_school AND ano_letivo_id=v_id
    )<>3 OR (
      SELECT id FROM public.periodos_letivos
      WHERE escola_id=v_school AND ano_letivo_id=v_id AND numero=1
    ) IS DISTINCT FROM v_period_uuid OR (
      SELECT count(*) FROM public.calendario_eventos
      WHERE escola_id=v_school AND ano_letivo_id=v_id
    )<>2 THEN
    RAISE EXCEPTION 'TEST: replay changed academic identities or duplicated events';
  END IF;

  BEGIN
    PERFORM public.aplicar_calendario_med_canonico_v1(
      v_school,2026,v_periods,v_events,
      jsonb_build_array(jsonb_build_object('offering_id',v_off_a,'template_id',v_regular))
    );
    RAISE EXCEPTION 'TEST: incomplete course mappings were accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'TEST:%' OR SQLERRM NOT LIKE 'CALENDAR_COURSE_MAPPING_INCOMPLETE:%' THEN
      RAISE;
    END IF;
  END;
  BEGIN
    PERFORM set_config('request.jwt.claims',
      jsonb_build_object('sub','30000000-0000-0000-0000-000000000099',
        'escola_id',v_school)::text,true);
    PERFORM public.aplicar_calendario_med_canonico_v1(
      v_school,2026,v_periods,v_events,v_offerings
    );
    RAISE EXCEPTION 'TEST: unauthorised user was allowed to apply MED calendar';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'TEST:%' OR SQLERRM NOT LIKE 'AUTH:%' THEN RAISE; END IF;
  END;
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub',v_user,'escola_id',v_school)::text,true);

  -- Force a late failure during event insertion, after the year and its
  -- periods were inserted. PostgreSQL must roll back the entire RPC.
  CREATE OR REPLACE FUNCTION public.test_atomic_med_fail_event()
  RETURNS trigger LANGUAGE plpgsql AS $fail$
  BEGIN
    IF NEW.escola_id='30000000-0000-0000-0000-000000000003'::uuid THEN
      RAISE EXCEPTION 'TEST_ATOMIC_INJECTED_FAILURE';
    END IF;
    RETURN NEW;
  END;
  $fail$;
  CREATE TRIGGER test_atomic_med_fail_event
  BEFORE INSERT ON public.calendario_eventos
  FOR EACH ROW EXECUTE FUNCTION public.test_atomic_med_fail_event();

  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub',v_user,'escola_id',v_school_fail)::text,true);
  BEGIN
    PERFORM public.aplicar_calendario_med_canonico_v1(
      v_school_fail,2026,v_periods,
      jsonb_build_array(jsonb_build_object(
        'offering_id',v_off_fail,'tipo','EXAME_ESCRITO',
        'nome','Exames regulares','data_inicio','2027-06-20',
        'data_fim','2027-06-23',
        'source_template_id',v_regular,'source_item_id',v_item_a
      )),
      jsonb_build_array(jsonb_build_object(
        'offering_id',v_off_fail,'template_id',v_regular
      ))
    );
    RAISE EXCEPTION 'TEST: late failure did not cancel the transaction';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'TEST:%' OR SQLERRM <> 'TEST_ATOMIC_INJECTED_FAILURE' THEN
      RAISE;
    END IF;
  END;

  IF EXISTS (SELECT 1 FROM public.anos_letivos
             WHERE escola_id=v_school_fail AND ano=2026)
     OR EXISTS (SELECT 1 FROM public.periodos_letivos
             WHERE escola_id=v_school_fail) THEN
    RAISE EXCEPTION 'TEST: failed event write left a partial year or period behind';
  END IF;
  DROP TRIGGER test_atomic_med_fail_event ON public.calendario_eventos;
  DROP FUNCTION public.test_atomic_med_fail_event();
END;
$atomic$;
ROLLBACK;
