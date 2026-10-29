-- MANUAL OPERATIONS ONLY. Never import this file from a migration or CI.
-- Target: existing Escola KLASSE 2026/2027 demo tenant, not all tenants.
-- Prerequisites: compare the official MED template with the existing calendar;
-- review academic records and obtain explicit operational approval.
-- In the SAME privileged database transaction, before running this block:
--   BEGIN;
--   SET LOCAL klasse.approve_calendar_2026_2027 = 'Escola KLASSE';
--   -- run this script
--   COMMIT;
-- If a guard fails, ROLLBACK and re-audit. No school/student IDs are hardcoded.
DO $reconcile$
DECLARE
  v_school_id uuid;
  v_year_id uuid;
  v_template record;
  v_periods int;
  v_events int;
  v_items int;
  v_changed int;
BEGIN
  IF current_setting('klasse.approve_calendar_2026_2027', true)
     IS DISTINCT FROM 'Escola KLASSE' THEN
    RAISE EXCEPTION 'OPERATION_NOT_APPROVED: Explicit Escola KLASSE calendar approval required.';
  END IF;
  SELECT e.id, a.id INTO STRICT v_school_id, v_year_id
    FROM public.escolas e
    JOIN public.anos_letivos a ON a.escola_id=e.id
   WHERE e.nome='Escola KLASSE' AND a.ano=2026 AND a.ativo IS TRUE;
  SELECT t.id,t.data_inicio,t.data_fim,t.versao_documento INTO STRICT v_template
    FROM public.calendario_templates t
   WHERE t.ano_base=2026 AND t.subsistema='REGULAR_ADULTOS'
     AND t.is_oficial IS TRUE AND t.estado='PUBLICADO'
     AND t.versao_documento='FINAL-ACTUALIZADO';

  SELECT count(*) INTO v_periods
    FROM public.periodos_letivos p
   WHERE p.escola_id=v_school_id AND p.ano_letivo_id=v_year_id
     AND p.tipo='TRIMESTRE' AND p.numero BETWEEN 1 AND 3
     AND p.offering_id IS NULL AND p.source_template_id IS NULL
     AND p.trava_notas_em IS NULL;
  SELECT count(*) INTO v_events FROM public.calendario_eventos
    WHERE escola_id=v_school_id AND ano_letivo_id=v_year_id;
  SELECT count(*) INTO v_items FROM public.calendario_template_items i
    WHERE i.template_id=v_template.id AND i.tipo::text='PERIODO_LETIVO'
      AND i.numero BETWEEN 1 AND 3;
  IF v_periods <> 3 OR v_events <> 0 OR v_items <> 3 THEN
    RAISE EXCEPTION 'CALENDAR_RECONCILIATION_STALE: expected 3 unlinked/unlocked periods, 0 events and 3 official items; found %, %, %',
      v_periods,v_events,v_items;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.periodos_letivos p
    WHERE p.escola_id=v_school_id AND p.ano_letivo_id=v_year_id
      AND (p.tipo<>'TRIMESTRE' OR p.numero NOT BETWEEN 1 AND 3 OR p.offering_id IS NOT NULL)
  ) THEN RAISE EXCEPTION 'Scoped or irregular academic periods require an offering-specific reconciliation.'; END IF;

  -- Update dates and provenance, preserving the period UUIDs referenced by
  -- existing evaluations, grades, attendance and transcripts.
  UPDATE public.anos_letivos
     SET data_inicio=v_template.data_inicio, data_fim=v_template.data_fim,
         updated_at=now()
   WHERE id=v_year_id AND escola_id=v_school_id;

  UPDATE public.periodos_letivos p
     SET data_inicio=i.data_inicio, data_fim=i.data_fim,
         source_template_id=v_template.id, source_item_id=i.id,
         source_version=v_template.versao_documento,
         applied_at=now(),applied_by=auth.uid(),updated_at=now()
    FROM public.calendario_template_items i
   WHERE p.escola_id=v_school_id AND p.ano_letivo_id=v_year_id
     AND p.tipo='TRIMESTRE' AND i.template_id=v_template.id
     AND i.tipo::text='PERIODO_LETIVO' AND i.numero=p.numero;
  GET DIAGNOSTICS v_changed=ROW_COUNT;
  IF v_changed<>3 THEN
    RAISE EXCEPTION 'Unexpected academic-period update count: %',v_changed;
  END IF;

  -- The official template's non-period events (exams, breaks, notices)
  -- must appear in the academic calendar of this same school/year.
  INSERT INTO public.calendario_eventos (
    escola_id,ano_letivo_id,tipo,nome,data_inicio,data_fim,
    source_template_id,source_item_id,source_version,applied_at,applied_by
  )
  SELECT v_school_id,v_year_id,i.tipo,i.nome,i.data_inicio,i.data_fim,
         v_template.id,i.id,v_template.versao_documento,now(),auth.uid()
    FROM public.calendario_template_items i
   WHERE i.template_id=v_template.id AND i.tipo::text<>'PERIODO_LETIVO'
     AND i.applies_to_all_offerings IS TRUE;
  GET DIAGNOSTICS v_changed=ROW_COUNT;
  IF v_changed<>29 THEN
    RAISE EXCEPTION 'Official event count changed (%); re-audit the MED template before applying.',v_changed;
  END IF;
  RAISE NOTICE 'Escola KLASSE academic year and three trimesters reconciled; 29 official events imported. Existing grades untouched.';
END;
$reconcile$;
