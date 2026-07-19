BEGIN;

DO $migration$
DECLARE signature regprocedure;
BEGIN
  FOR signature IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (ARRAY[
        'aluno_solicitar_servico','aluno_submeter_comprovativo_pagamento',
        'aluno_submeter_comprovativo_servico','build_numero_login','calcular_status_pedagogico',
        'create_audit_event','emitir_recibo','enqueue_outbox_event_professor','enqueue_outbox_event',
        'gradeengine_calcular_situacao','inserir_notificacao','matricula_counter_floor',
        'next_matricula_number','next_numero_counter','next_numero_processo','preview_matricula_number'
      ])
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', signature);
  END LOOP;
END
$migration$;

COMMIT;
