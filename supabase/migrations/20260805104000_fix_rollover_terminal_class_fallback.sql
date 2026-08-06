BEGIN;

DO $migration$
DECLARE
  v_definition text;
  v_updated text;
  v_old_block text := $old$
    JOIN public.turmas next_turma
      ON next_turma.escola_id = p_escola_id
     AND next_turma.session_id = p_to_session_id
     AND next_turma.curso_id = old_turma.curso_id
     AND public.turma_classe_numero(next_turma.id) = public.turma_classe_numero(old_turma.id) + 1
     AND next_turma.turno IS NOT DISTINCT FROM old_turma.turno
     AND next_turma.letra IS NOT DISTINCT FROM old_turma.letra
    WHERE old_turma.escola_id = p_escola_id
      AND old_turma.session_id = p_from_session_id
      AND public.turma_classe_numero(old_turma.id) IS NOT NULL
$old$;
  v_new_block text := $new$
    JOIN LATERAL (
      SELECT candidate.*
      FROM public.turmas candidate
      WHERE candidate.escola_id = p_escola_id
        AND candidate.session_id = p_to_session_id
        AND candidate.curso_id = old_turma.curso_id
        AND candidate.turno IS NOT DISTINCT FROM old_turma.turno
        AND candidate.letra IS NOT DISTINCT FROM old_turma.letra
        AND (
          public.turma_classe_numero(candidate.id) = public.turma_classe_numero(old_turma.id) + 1
          OR public.turma_classe_numero(candidate.id) = public.turma_classe_numero(old_turma.id)
          OR (public.turma_classe_numero(old_turma.id) IS NULL AND candidate.classe_id IS NOT DISTINCT FROM old_turma.classe_id)
        )
      ORDER BY CASE
        WHEN public.turma_classe_numero(candidate.id) = public.turma_classe_numero(old_turma.id) + 1 THEN 0
        ELSE 1
      END, candidate.id
      LIMIT 1
    ) next_turma ON true
    WHERE old_turma.escola_id = p_escola_id
      AND old_turma.session_id = p_from_session_id
$new$;
BEGIN
  SELECT pg_get_functiondef('public.cutover_ano_letivo_retroativo(uuid,uuid,uuid)'::regprocedure)
    INTO v_definition;

  v_updated := replace(v_definition, v_old_block, v_new_block);

  IF v_updated = v_definition
     AND position('JOIN LATERAL (' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Definição inesperada de cutover_ano_letivo_retroativo; migration interrompida.';
  END IF;

  IF v_updated <> v_definition THEN
    EXECUTE v_updated;
  END IF;
END
$migration$;

COMMIT;
