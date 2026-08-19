BEGIN;

-- Corrige o resolvedor jurídico aplicado: quantidade de negativas não basta;
-- cada regime também exige uma faixa de nota própria.
DO $$
DECLARE
  v_definition text;
BEGIN
  SELECT pg_get_functiondef('public.resolve_raa_decreto_for_matricula(uuid, uuid)'::regprocedure)
    INTO v_definition;

  v_definition := replace(
    v_definition,
    'IF v_nota < 3 AND v_regime_codigo IN (''classe_6'', ''eja_modulo_3'') THEN',
    'IF (v_regime_codigo IN (''classe_7'', ''classe_8'', ''classe_10'', ''classe_11'', ''eja_ano_1'') AND v_nota < 7) OR (v_regime_codigo IN (''classe_9'', ''classe_12'', ''eja_ano_2'') AND v_nota < 6) OR (v_nota < 3 AND v_regime_codigo IN (''classe_6'', ''eja_modulo_3'')) THEN'
  );

  EXECUTE v_definition;
END;
$$;

COMMIT;
