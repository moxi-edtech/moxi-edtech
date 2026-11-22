-- Disposable PostgreSQL 17: the synthetic school has six open histories.
-- All writes happen inside fixture-data BEGIN and are rolled back at the end.
DO $first$
DECLARE
  v_escola uuid := '3744879f-2e19-4671-8995-78604302d8c5';
  v_first jsonb;
  v_again jsonb;
BEGIN
  v_first := public.curtume_fechar_pautas_2025_lote(
    v_escola,'b0000000-0000-4000-8000-000000000301',NULL,25);
  IF (v_first->>'processados')::integer<>6
      OR (v_first->>'fechados')::integer<>2
      OR (v_first->>'bloqueados')::integer<>4 THEN
    RAISE EXCEPTION 'AUTOCLOSE_INVALID_COUNTS: %',v_first;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_first->'pendencias') AS issue
    WHERE issue->>'matricula_id'='60000000-0000-4000-8000-000000000002'
      AND issue->>'codigo'='PAUTA_ANO_DIVERGENTE_EXIGE_CONFERENCIA'
  ) THEN RAISE EXCEPTION 'DOC_YEAR_CONTRADICTION_NOT_BLOCKED: %',v_first; END IF;
  IF EXISTS (SELECT 1 FROM public.historico_anos
    WHERE id='91000000-0000-4000-8000-000000000002'
      AND snapshot_status<>'aberto'
  ) THEN RAISE EXCEPTION 'CONTRADICTORY_DOCUMENT_LEGALLY_CLOSED'; END IF;
  IF (SELECT count(*) FROM public.audit_logs
      WHERE action='MATRICULA_ORIGEM_RESULTADO_ACADEMICO_REGISTADO')<>2
  THEN RAISE EXCEPTION 'UNAUTHORISED_LEGAL_CLOSE'; END IF;
  IF (SELECT count(*) FROM public.historico_snapshot_locks WHERE status='fechado')<>2
  THEN RAISE EXCEPTION 'ILLEGAL_SNAPSHOT_LOCK'; END IF;

  v_again := public.curtume_fechar_pautas_2025_lote(
    v_escola,'b0000000-0000-4000-8000-000000000302',NULL,25);
  IF (v_again->>'fechados')::integer<>0 THEN
    RAISE EXCEPTION 'IDEMPOTENCY_BROKEN: %',v_again;
  END IF;
END
$first$;

-- Simulate an independently proven school documentary correction ONLY in a
-- disposable test fixture. A real school must use the authorized UI/RPC.
RESET ROLE;
UPDATE public.historico_disciplinas
SET notas_detalhe=notas_detalhe || jsonb_build_object(
  'correcao_tipo','ano_documental',
  'ano_referencia_confirmado','2025/2026')
WHERE historico_ano_id='91000000-0000-4000-8000-000000000002';
SET ROLE authenticated;

DO $after$
DECLARE
  v_result jsonb;
BEGIN
  v_result := public.curtume_fechar_pautas_2025_lote(
    '3744879f-2e19-4671-8995-78604302d8c5'::uuid,
    'b0000000-0000-4000-8000-000000000303',NULL,25);
  IF (v_result->>'fechados')::integer<>1
      OR (v_result->>'bloqueados')::integer<>3 THEN
    RAISE EXCEPTION 'APPROVED_DOCUMENT_NOT_CLOSED: %',v_result;
  END IF;
  IF (SELECT count(*) FROM public.historico_snapshot_locks WHERE status='fechado')<>3 THEN
    RAISE EXCEPTION 'EXTRA_LOCK_OR_MISSING_LOCK';
  END IF;
  IF (SELECT count(*) FROM public.notas)<>1 THEN
    RAISE EXCEPTION 'AUTOCLOSE_WROTE_OPERATIONAL_GRADES';
  END IF;
END
$after$;
ROLLBACK;
