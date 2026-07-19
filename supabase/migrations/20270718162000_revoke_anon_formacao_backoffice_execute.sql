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
        'formacao_create_inscricao','formacao_emitir_certificados_batch','formacao_extend_trial',
        'formacao_formadores_por_centro','formacao_get_subscription_info',
        'formacao_update_dados_pagamento','formacao_update_landing_config',
        'formacao_upsert_formando_profile','sync_formacao_fiscal_memberships_for_escola'
      ])
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', signature);
  END LOOP;
END
$migration$;

COMMIT;
