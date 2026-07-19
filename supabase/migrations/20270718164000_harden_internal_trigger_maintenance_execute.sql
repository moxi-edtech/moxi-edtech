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
        'fill_frequencias_periodo_letivo','seed_onboarding_steps_v2',
        'sync_escola_plano_from_assinatura','trg_evento_curriculo_published_fn',
        'trg_evento_notas_lancadas_fn','trg_evento_pagamento_confirmado_fn',
        'trg_evento_turmas_generated_fn'
      ])
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', signature);
  END LOOP;
END
$migration$;

COMMIT;
