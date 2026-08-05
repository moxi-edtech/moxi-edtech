BEGIN;

DO $migration$
DECLARE
  v_definition text;
  v_updated text;
BEGIN
  SELECT pg_get_functiondef('public.cutover_ano_letivo_retroativo(uuid,uuid,uuid)'::regprocedure)
    INTO v_definition;

  v_updated := replace(
    replace(
      v_definition,
      'SET status = ''pendente'', ativo = false, updated_at = now()',
      'SET status = ''pendente'', ativo = false, numero_matricula = NULL, updated_at = now()'
    ),
    'COALESCE(v_source.numero_matricula, v_to_year::text || ''-'' || substr(v_source.aluno_id::text, 1, 8))',
    'public.next_matricula_number(p_escola_id)::text'
  );

  IF v_updated = v_definition THEN
    IF position('numero_matricula = NULL' IN v_definition) = 0
       OR position('public.next_matricula_number(p_escola_id)::text' IN v_definition) = 0 THEN
      RAISE EXCEPTION 'Definição inesperada de cutover_ano_letivo_retroativo; migration interrompida.';
    END IF;
  ELSE
    EXECUTE v_updated;
  END IF;
END
$migration$;

DO $migration$
DECLARE
  v_definition text;
  v_updated text;
BEGIN
  SELECT pg_get_functiondef('public.promover_aluno_pos_pagamento(uuid,uuid,uuid,uuid)'::regprocedure)
    INTO v_definition;

  v_updated := replace(
    v_definition,
    'COALESCE(v_source.numero_matricula, v_to_year::text || ''-'' || substr(p_aluno_id::text, 1, 8))',
    'public.next_matricula_number(p_escola_id)::text'
  );

  IF v_updated = v_definition THEN
    IF position('public.next_matricula_number(p_escola_id)::text' IN v_definition) = 0 THEN
      RAISE EXCEPTION 'Definição inesperada de promover_aluno_pos_pagamento; migration interrompida.';
    END IF;
  ELSE
    EXECUTE v_updated;
  END IF;
END
$migration$;

COMMIT;
