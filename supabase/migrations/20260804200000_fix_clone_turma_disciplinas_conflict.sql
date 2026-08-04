BEGIN;

DO $migration$
DECLARE
  v_definition text;
  v_updated text;
BEGIN
  SELECT pg_get_functiondef('public.clone_academic_structure_v1(uuid,uuid,uuid,numeric)'::regprocedure)
    INTO v_definition;

  v_updated := replace(v_definition, 'ON CONFLICT (turma_id, disciplina_id) DO NOTHING', 'ON CONFLICT (escola_id, turma_id, curso_matriz_id) DO NOTHING');
  IF v_updated = v_definition THEN
    RAISE EXCEPTION 'Definição inesperada de clone_academic_structure_v1; migration interrompida.';
  END IF;
  EXECUTE v_updated;
END
$migration$;

COMMIT;
