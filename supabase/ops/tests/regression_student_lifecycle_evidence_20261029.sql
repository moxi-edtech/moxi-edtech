-- Read-only regression of documented academic evidence and legal history authority.
-- Run against the installed KLASSE DB; does not mutate pupil status or grades.
DO $evidence_regression$
DECLARE
  v_grade text;
  v_lock text;
  v_rat text;
  v_reconcile text;
  v_anomalies bigint;
BEGIN
  SELECT pg_get_functiondef('public.gradeengine_calcular_situacao(uuid)'::regprocedure)
    INTO v_grade;
  IF v_grade NOT LIKE '%v_official_rows = 0%'
     OR v_grade NOT LIKE '%situacao_final%' THEN
    RAISE EXCEPTION 'EVIDENCE_REGRESSION: GradeEngine must fail closed on zero official bulletin rows';
  END IF;

  SELECT pg_get_functiondef('public.lifecycle_validate_historico_legal_lock()'::regprocedure)
    INTO v_lock;
  IF v_lock NOT LIKE '%ACADEMIC_DECISION_EVIDENCE_REQUIRED%'
     OR v_lock NOT LIKE '%NEW.historico_ano_id := v_historico.id%' THEN
    RAISE EXCEPTION 'EVIDENCE_REGRESSION: legal history lock may be emitted without proof/link';
  END IF;

  SELECT pg_get_functiondef('public.ratificar_resultado_historico_escola(uuid,uuid,text,text,text)'::regprocedure)
    INTO v_rat;
  IF v_rat NOT LIKE '%v_actor_id%'
     OR v_rat NOT LIKE '%RATIFICATION_DOCUMENT_REQUIRED%'
     OR v_rat NOT LIKE '%snapshot_status%' THEN
    RAISE EXCEPTION 'EVIDENCE_REGRESSION: school ratification requires accountable actor and evidence';
  END IF;

  SELECT pg_get_functiondef('public.finalizar_origem_academica(uuid,uuid,text,text,text,text)'::regprocedure)
    INTO v_reconcile;
  IF v_reconcile NOT LIKE '%v_status := CASE WHEN v_resultado=%'
     OR v_reconcile NOT LIKE '%matricula_id=excluded.matricula_id%' THEN
    RAISE EXCEPTION 'EVIDENCE_REGRESSION: failed outcomes must not be saved as concluded, and histories must be linked';
  END IF;

  SELECT count(*) INTO v_anomalies
  FROM public.historico_snapshot_locks sl
  LEFT JOIN public.historico_anos ha
    ON ha.id=sl.historico_ano_id
    AND ha.escola_id=sl.escola_id
    AND ha.matricula_id=sl.matricula_id
  LEFT JOIN public.matriculas m
    ON m.id=sl.matricula_id AND m.escola_id=sl.escola_id
  WHERE sl.status='fechado'
    AND (ha.id IS NULL OR ha.snapshot_status IS DISTINCT FROM 'fechado'
      OR m.id IS NULL OR m.ativo IS DISTINCT FROM false
      OR m.status NOT IN ('concluido','reprovado')
      OR (ha.resultado_final='reprovado' AND m.status<>'reprovado')
      OR (ha.resultado_final IN ('aprovado','concluido') AND m.status<>'concluido'));
  IF v_anomalies<>0 THEN
    RAISE EXCEPTION 'EVIDENCE_REGRESSION: % legally closed snapshots are inconsistent',v_anomalies;
  END IF;
END;
$evidence_regression$;

SELECT
 (SELECT count(*)::int FROM public.matriculas m
   WHERE m.escola_id='3744879f-2e19-4671-8995-78604302d8c5'
     AND m.ano_letivo=2025 AND m.status='pendente') AS curtume_2025_pendente,
 (SELECT count(*)::int FROM public.historico_anos h
   WHERE h.escola_id='3744879f-2e19-4671-8995-78604302d8c5'
     AND h.snapshot_status='aberto') AS curtume_historicos_abertos,
 (SELECT count(*)::int FROM public.historico_anos h
   JOIN public.matriculas m ON m.id=h.matricula_id
   WHERE h.escola_id='3744879f-2e19-4671-8995-78604302d8c5'
     AND h.resultado_final='reprovado' AND m.status='concluido') AS divergencias_a_ratificar,
 (SELECT count(*)::int FROM public.audit_logs a
   WHERE a.escola_id='3744879f-2e19-4671-8995-78604302d8c5'
     AND a.action='MATRICULA_ORIGEM_RESULTADO_ACADEMICO_REGISTADO'
     AND a.actor_id IS NULL) AS declaracoes_legadas_sem_autor;
