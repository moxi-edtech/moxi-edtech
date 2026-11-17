-- CURTUME — pauta documental 2025/2026, 6.ª classe ONLY.
-- The imported 2025 records contain História, Geografia and Educação Visual e Plástica
-- for 43 pupils, and the alternative combined historical subjects for 10 pupils.
-- The school catalog already contains all names. Add ONLY missing 2025 curriculum
-- + 2025 turma mappings, retaining both historical variants and ALL existing grades.
-- No 2026/2027 curriculum, turma, grade, historical note or RAA decision is updated.
-- Document does not specify weekly hours: do not invent timetables.
DO $curtume_2025$
DECLARE
  v_escola constant uuid := '3744879f-2e19-4671-8995-78604302d8c5';
  v_ano uuid;
  v_curso uuid;
  v_classe uuid;
  v_curriculo uuid;
  v_turma uuid;
  v_nome text;
  v_disciplina uuid;
  v_matriz uuid;
  v_count integer;
  v_ano_turma integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('curtume:pauta:2025:classe6:curriculo',0));

  SELECT id INTO STRICT v_ano
    FROM public.anos_letivos WHERE escola_id=v_escola AND ano=2025;
  SELECT id,curso_id INTO STRICT v_classe,v_curso
    FROM public.classes WHERE escola_id=v_escola AND numero=6;
  SELECT id INTO STRICT v_curriculo
    FROM public.curso_curriculos
   WHERE escola_id=v_escola AND curso_id=v_curso AND classe_id=v_classe
     AND ano_letivo_id=v_ano AND status='published';
  SELECT id, ano_letivo INTO STRICT v_turma,v_ano_turma
    FROM public.turmas
   WHERE escola_id=v_escola AND classe_id=v_classe AND ano_letivo=2025
     AND ano_letivo_id=v_ano;
  IF v_ano_turma <> 2025 THEN
    RAISE EXCEPTION 'CURTUME_2025_WRONG_YEAR';
  END IF;

  FOREACH v_nome IN ARRAY ARRAY['História','Geografia','Educação Visual e Plástica']
  LOOP
    SELECT id INTO STRICT v_disciplina
      FROM public.disciplinas_catalogo
     WHERE escola_id=v_escola AND nome=v_nome;

    -- Only disciplines actually transcribed from real school source are admitted.
    SELECT count(*) INTO v_count
      FROM public.historico_anos h
      JOIN public.historico_disciplinas hd ON hd.historico_ano_id=h.id
     WHERE h.escola_id=v_escola AND h.ano_letivo=2025
       AND h.turma_id=v_turma AND hd.disciplina_id=v_disciplina
       AND hd.disciplina_nome=v_nome;
    IF v_count <> 43 THEN
      RAISE EXCEPTION 'CURTUME_2025_SOURCE_CHANGED: %, found % instead of 43', v_nome,v_count;
    END IF;

    INSERT INTO public.curso_matriz (
      escola_id,curso_id,classe_id,disciplina_id,curso_curriculo_id,
      obrigatoria,ativo,classificacao,conta_para_media_med,
      entra_no_horario,carga_horaria_semanal,avaliacao_mode,
      periodos_ativos,ordem
    ) VALUES (
      v_escola,v_curso,v_classe,v_disciplina,v_curriculo,
      false,true,'core',true,
      false,NULL,'inherit_school',
      ARRAY[1,2,3],CASE v_nome
        WHEN 'História' THEN 11 WHEN 'Geografia' THEN 12 ELSE 13 END
    )
    ON CONFLICT (escola_id,curso_curriculo_id,classe_id,disciplina_id) DO NOTHING;

    SELECT id INTO STRICT v_matriz
      FROM public.curso_matriz
     WHERE escola_id=v_escola AND curso_id=v_curso AND classe_id=v_classe
       AND curso_curriculo_id=v_curriculo AND disciplina_id=v_disciplina
       AND ativo=true;

    -- No bulk rebuild: never affect active-year turmas or their teacher bindings.
    INSERT INTO public.turma_disciplinas (
      escola_id,turma_id,curso_matriz_id,
      classificacao,conta_para_media_med,entra_no_horario,avaliacao_mode,periodos_ativos
    ) VALUES (
      v_escola,v_turma,v_matriz,
      'core',true,false,'inherit_school',ARRAY[1,2,3]
    )
    ON CONFLICT (escola_id,turma_id,curso_matriz_id) DO NOTHING;
  END LOOP;

  -- Idempotent self-check: exactly three source-backed links on the 2025 turma.
  SELECT count(DISTINCT cm.disciplina_id) INTO v_count
    FROM public.turma_disciplinas td
    JOIN public.curso_matriz cm ON cm.id=td.curso_matriz_id
    JOIN public.disciplinas_catalogo d ON d.id=cm.disciplina_id
   WHERE td.escola_id=v_escola AND td.turma_id=v_turma
     AND cm.curso_curriculo_id=v_curriculo
     AND d.nome IN ('História','Geografia','Educação Visual e Plástica');
  IF v_count <> 3 THEN
    RAISE EXCEPTION 'CURTUME_2025_MATRIX_RECONCILIATION_INCOMPLETE: %',v_count;
  END IF;
END;
$curtume_2025$;
