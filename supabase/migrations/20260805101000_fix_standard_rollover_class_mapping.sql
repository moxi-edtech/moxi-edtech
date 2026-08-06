BEGIN;

-- Align the standard cutover prerequisites and turma pairing with the same
-- legacy-safe class resolver used by the retroactive cutover.
DO $migration$
DECLARE
  v_definition text;
  v_updated text;
BEGIN
  SELECT pg_get_functiondef('public.cutover_ano_letivo_v3(uuid,uuid,uuid)'::regprocedure)
    INTO v_definition;

  v_updated := replace(
    replace(
      replace(
        v_definition,
        'c_next.numero = t.classe_num + 1',
        'c_next.numero = public.turma_classe_numero(t.id) + 1'
      ),
      't_dest.classe_num = s.classe_num + 1',
      'public.turma_classe_numero(t_dest.id) = public.turma_classe_numero(s.id) + 1'
    ),
    't_dest.classe_num = t_old.classe_num + 1',
    'public.turma_classe_numero(t_dest.id) = public.turma_classe_numero(t_old.id) + 1'
  );

  IF v_updated = v_definition
     AND position('public.turma_classe_numero' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Definição inesperada de cutover_ano_letivo_v3; migration interrompida.';
  END IF;

  IF v_updated <> v_definition THEN
    EXECUTE v_updated;
  END IF;
END
$migration$;

COMMIT;
