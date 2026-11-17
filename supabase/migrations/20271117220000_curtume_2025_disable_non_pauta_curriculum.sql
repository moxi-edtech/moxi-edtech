-- CURTUME 2025/2026 — retire only historical curriculum entries NOT
-- represented in the school's imported documentary pauta, by class.
--
-- Scope: 2025 curriculum version of CURTUME ONLY. Keep the catalog and all
-- turma_disciplinas, avaliacoes, notas, professor assignments, and snapshots.
-- Some legacy non-pauta links have 18 grade rows; do not delete or rewrite them.
-- Never change entries used by a 2026/2027 turma.
DO $curtume_2025_pauta_cleanup$
DECLARE
  v_escola constant uuid := '3744879f-2e19-4671-8995-78604302d8c5';
  v_ano uuid;
  v_target_count integer;
  v_total_excess integer;
  v_cross_year_count integer;
  v_updated integer;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended('curtume:pauta:2025:disable-non-pauta-curriculum', 0)
  );

  SELECT a.id INTO v_ano
    FROM public.anos_letivos a
   WHERE a.escola_id=v_escola AND a.ano=2025;

  -- A production tenant-specific data migration must not break fresh,
  -- unseeded KLASSE databases.
  IF v_ano IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.historico_anos h
     WHERE h.escola_id=v_escola AND h.ano_letivo=2025
  ) THEN
    RETURN;
  END IF;

  -- Same exact documented conditions are used for preflight and mutation.
  -- An active curriculum subject is surplus only if the class has no
  -- documentary 2025 grade row for that subject.
  SELECT count(*),count(*) FILTER (WHERE cm.ativo)
    INTO v_total_excess,v_target_count
    FROM public.curso_matriz cm
    JOIN public.curso_curriculos cc ON cc.id=cm.curso_curriculo_id
   WHERE cm.escola_id=v_escola
     AND cc.escola_id=v_escola
     AND cc.ano_letivo_id=v_ano
     AND cc.status='published'
     AND NOT EXISTS (
       SELECT 1
         FROM public.historico_anos h
         JOIN public.historico_disciplinas hd
           ON hd.historico_ano_id=h.id
         JOIN public.turmas t ON t.id=h.turma_id
        WHERE h.escola_id=v_escola
          AND h.ano_letivo=2025
          AND t.escola_id=v_escola
          AND t.ano_letivo=2025
          AND t.classe_id=cm.classe_id
          AND hd.disciplina_id=cm.disciplina_id
     );

  IF v_total_excess<>14 THEN
    RAISE EXCEPTION 'CURTUME_2025_UNEXPECTED_SURPLUS_COUNT: %',v_total_excess
      USING ERRCODE='23514';
  END IF;

  -- Safe on retry: the 14 identified 2025 entries can already be disabled.
  IF v_target_count=0 THEN
    RETURN;
  END IF;

  -- Do not change a matrix entry if any turma of another year relies on it.
  SELECT count(*) INTO v_cross_year_count
    FROM public.curso_matriz cm
    JOIN public.curso_curriculos cc ON cc.id=cm.curso_curriculo_id
    JOIN public.turma_disciplinas td ON td.curso_matriz_id=cm.id
    JOIN public.turmas t ON t.id=td.turma_id
   WHERE cm.escola_id=v_escola
     AND cc.escola_id=v_escola AND cc.ano_letivo_id=v_ano
     AND cc.status='published'
     AND cm.ativo
     AND t.ano_letivo IS DISTINCT FROM 2025
     AND NOT EXISTS (
       SELECT 1
         FROM public.historico_anos h
         JOIN public.historico_disciplinas hd
           ON hd.historico_ano_id=h.id
         JOIN public.turmas hist_t ON hist_t.id=h.turma_id
        WHERE h.escola_id=v_escola
          AND h.ano_letivo=2025
          AND hist_t.escola_id=v_escola
          AND hist_t.ano_letivo=2025
          AND hist_t.classe_id=cm.classe_id
          AND hd.disciplina_id=cm.disciplina_id
     );
  IF v_cross_year_count<>0 THEN
    RAISE EXCEPTION 'CURTUME_2025_SURPLUS_SHARED_WITH_ANOTHER_YEAR: %',v_cross_year_count
      USING ERRCODE='23514';
  END IF;

  UPDATE public.curso_matriz cm
     SET ativo=false
    FROM public.curso_curriculos cc
   WHERE cc.id=cm.curso_curriculo_id
     AND cm.escola_id=v_escola
     AND cc.escola_id=v_escola
     AND cc.ano_letivo_id=v_ano
     AND cc.status='published'
     AND cm.ativo
     AND NOT EXISTS (
       SELECT 1
         FROM public.historico_anos h
         JOIN public.historico_disciplinas hd
           ON hd.historico_ano_id=h.id
         JOIN public.turmas t ON t.id=h.turma_id
        WHERE h.escola_id=v_escola
          AND h.ano_letivo=2025
          AND t.escola_id=v_escola
          AND t.ano_letivo=2025
          AND t.classe_id=cm.classe_id
          AND hd.disciplina_id=cm.disciplina_id
     );
  GET DIAGNOSTICS v_updated=ROW_COUNT;
  IF v_updated<>v_target_count THEN
    RAISE EXCEPTION 'CURTUME_2025_SURPLUS_UPDATE_MISMATCH: %',v_updated
      USING ERRCODE='23514';
  END IF;
END;
$curtume_2025_pauta_cleanup$;
