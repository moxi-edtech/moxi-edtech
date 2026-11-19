-- End-to-end regression in disposable PG17. Never run with customer data.
\ir ../../../migrations/20271119110000_curtume_mirror_signed_final_grades.sql

GRANT SELECT ON public.matriculas,public.historico_anos,public.notas,
  public.avaliacoes,public.outbox_events,public.audit_logs TO authenticated;
GRANT UPDATE ON public.notas TO authenticated;
SELECT set_config('request.jwt.claim.sub',
 '10000000-0000-4000-8000-000000000001',false);
SET ROLE authenticated;

DO $verify$
DECLARE
  v_school uuid:='3744879f-2e19-4671-8995-78604302d8c5';
  v_m uuid:='60000000-0000-4000-8000-000000000001';
  v_pre jsonb;v_write jsonb;v_again jsonb;v_post jsonb;
  v_before jsonb;v_after jsonb;v_notes integer;v_bad integer;
  v_blocked boolean:=false;
BEGIN
  v_pre:=public.curtume_2025_prever_espelhamento_notas(v_school);
  IF (v_pre->>'total')::integer<>3
     OR (v_pre->>'elegiveis')::integer<>1
     OR (v_pre->>'documento_ano_divergente')::integer<>1
     OR (v_pre->>'historico_aberto')::integer<>1 THEN
    RAISE EXCEPTION 'PREVIEW_COUNTS_WRONG %',v_pre;
  END IF;
  v_before:=public.resolve_raa_progression_for_matricula(v_school,v_m);
  IF v_before->>'decision'<>'transitou' THEN
    RAISE EXCEPTION 'BEFORE_RAA_INVALID %',v_before;
  END IF;
  v_write:=public.curtume_2025_espelhar_notas_finais(v_school,80);
  IF (v_write->>'criadas')::integer<>1 OR (v_write->>'restantes')::integer<>0 THEN
    RAISE EXCEPTION 'FIRST_WRITE_WRONG %',v_write;
  END IF;
  v_again:=public.curtume_2025_espelhar_notas_finais(v_school,80);
  IF (v_again->>'criadas')::integer<>0 THEN
    RAISE EXCEPTION 'WRITE_NOT_IDEMPOTENT %',v_again;
  END IF;
  SELECT count(*) INTO v_notes FROM public.notas n
    JOIN public.avaliacoes a ON a.id=n.avaliacao_id
    WHERE n.escola_id=v_school AND n.matricula_id=v_m AND n.valor=10
      AND n.metadata->>'tipo_nota'='HIST_FINAL'
      AND n.metadata->>'fonte'='historico_disciplinas'
      AND n.metadata->>'historico_ano_id'='80000000-0000-4000-8000-000000000001'
      AND n.metadata->>'historico_disciplina_id'='d0000000-0000-4000-8000-000000000001'
      AND a.tipo='HIST_FINAL' AND a.peso=0 AND a.trimestre=3;
  IF v_notes<>1 THEN RAISE EXCEPTION 'NOTES_MISSING_OR_INCORRECT'; END IF;
  SELECT count(*) INTO v_bad FROM public.notas n
    WHERE n.escola_id=v_school
      AND n.matricula_id IN (
        '60000000-0000-4000-8000-000000000002',
        '60000000-0000-4000-8000-000000000003');
  IF v_bad<>0 THEN RAISE EXCEPTION 'BLOCKED_SOURCES_WRITTEN'; END IF;
  v_after:=public.resolve_raa_progression_for_matricula(v_school,v_m);
  IF v_before->>'decision' IS DISTINCT FROM v_after->>'decision'
    OR v_before->>'destino' IS DISTINCT FROM v_after->>'destino' THEN
    RAISE EXCEPTION 'RATIFIED_RAA_CHANGED % -> %',v_before,v_after;
  END IF;
  SELECT count(*) INTO v_bad FROM public.outbox_events;
  IF v_bad<>0 THEN RAISE EXCEPTION 'RETROACTIVE_NOTIFICATION_CREATED'; END IF;
  SELECT count(*) INTO v_bad FROM public.audit_logs
    WHERE action='CURTUME_2025_NOTAS_FINAIS_ESPELHADAS';
  IF v_bad<>1 THEN RAISE EXCEPTION 'AUDIT_LOG_MISSING'; END IF;
  BEGIN
    UPDATE public.notas SET valor=8 WHERE matricula_id=v_m;
  EXCEPTION WHEN OTHERS THEN v_blocked:=true; END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'MIRROR_TAMPER_WAS_ALLOWED'; END IF;
  SELECT count(*) INTO v_notes FROM public.notas WHERE matricula_id=v_m AND valor=10;
  IF v_notes<>1 THEN RAISE EXCEPTION 'ORIGINAL_MIRROR_WAS_CHANGED'; END IF;
END;
$verify$;

SELECT set_config('request.jwt.claim.sub',
 '10000000-0000-4000-8000-000000000002',false);
DO $isolation$
DECLARE v_denied boolean:=false;
BEGIN
  BEGIN
    PERFORM public.curtume_2025_prever_espelhamento_notas(
      '3744879f-2e19-4671-8995-78604302d8c5');
  EXCEPTION WHEN insufficient_privilege THEN v_denied:=true; END;
  IF NOT v_denied THEN RAISE EXCEPTION 'CROSS_SCHOOL_PREVIEW_NOT_DENIED'; END IF;
  v_denied:=false;
  BEGIN
    PERFORM public.curtume_2025_espelhar_notas_finais(
      '3744879f-2e19-4671-8995-78604302d8c5',1);
  EXCEPTION WHEN insufficient_privilege THEN v_denied:=true; END;
  IF NOT v_denied THEN RAISE EXCEPTION 'CROSS_SCHOOL_WRITE_NOT_DENIED'; END IF;
END;
$isolation$;
RESET ROLE;
