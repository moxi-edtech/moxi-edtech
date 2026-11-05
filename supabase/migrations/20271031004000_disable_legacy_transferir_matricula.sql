-- AUT-001/002: retire the legacy RPC that creates a second enrollment.
-- The supported transfer APIs preserve the enrollment ID and reject any
-- existing academic evidence until the temporal source-of-truth is approved.
--
-- The legacy implementation used status='ativa', guessed the year via LIMIT 1,
-- created a new enrollment, and did not preserve the same academic/financial
-- invariants as the installed atomic transfer RPCs.
--
-- No student, enrollment, grade, attendance or financial data is modified.
BEGIN;
REVOKE EXECUTE ON FUNCTION public.transferir_matricula(uuid,uuid,uuid)
  FROM PUBLIC, anon, authenticated;
-- service_role retains its existing grant for controlled recovery only;
-- never expose the service_role key to the browser.
DO $$
BEGIN
  IF has_function_privilege('anon',
       'public.transferir_matricula(uuid,uuid,uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated',
       'public.transferir_matricula(uuid,uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'AUT-001: legacy transfer RPC still executable via Data API';
  END IF;
  IF NOT has_function_privilege('authenticated',
       'public.transferir_aluno_turma(uuid,uuid,text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated',
       'public.transferir_turma_em_lote(uuid,uuid,uuid,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'AUT-001: safe transfer RPCs are unavailable';
  END IF;
END;
$$;
COMMIT;
