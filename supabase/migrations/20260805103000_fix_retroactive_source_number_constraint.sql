BEGIN;

DO $migration$
DECLARE
  v_definition text;
  v_updated text;
BEGIN
  SELECT pg_get_functiondef('public.cutover_ano_letivo_retroativo(uuid,uuid,uuid)'::regprocedure)
    INTO v_definition;

  v_updated := replace(
    v_definition,
    'SET status = ''transferido'', ativo = false, updated_at = now()',
    'SET status = ''transferido'', ativo = false, numero_matricula = NULL, updated_at = now()'
  );

  IF v_updated = v_definition
     AND position('status = ''transferido'', ativo = false, numero_matricula = NULL' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Definição inesperada de cutover_ano_letivo_retroativo; migration interrompida.';
  END IF;

  IF v_updated <> v_definition THEN
    EXECUTE v_updated;
  END IF;
END
$migration$;

COMMIT;
