-- Atribuição de uma disciplina a várias turmas, numa única transação.
-- A função faz todas as validações no servidor, inclusive quando invocada
-- diretamente pela Data API (o guard da rota Next.js não é suficiente).
BEGIN;

CREATE OR REPLACE FUNCTION public.assign_professor_turmas_disciplina_batch(
  p_escola_id uuid,
  p_professor_id uuid,
  p_disciplina_id uuid,
  p_itens jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_item jsonb;
  v_turma_id uuid;
  v_matriz_id uuid;
  v_professor_atual uuid;
  v_tdp_professor uuid;
  v_disciplina_id uuid;
  v_total integer := 0;
  v_count integer;
  v_seen uuid[] := ARRAY[]::uuid[];
BEGIN
  IF auth.uid() IS NULL OR p_escola_id IS NULL OR p_professor_id IS NULL
     OR p_disciplina_id IS NULL THEN
    RAISE EXCEPTION 'ASSIGN_BATCH_FORBIDDEN';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.escola_users eu
    WHERE eu.escola_id = p_escola_id AND eu.user_id = auth.uid()
      AND coalesce(eu.papel, eu.role) IN
        ('admin', 'admin_escola', 'admin_secretaria', 'admin_financeiro', 'diretor')
  ) THEN
    RAISE EXCEPTION 'ASSIGN_BATCH_FORBIDDEN';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.professores p
    JOIN public.teachers t ON t.profile_id = p.profile_id AND t.escola_id = p.escola_id
    WHERE p.id = p_professor_id AND p.escola_id = p_escola_id
  ) THEN
    RAISE EXCEPTION 'ASSIGN_BATCH_PROFESSOR_NOT_FOUND';
  END IF;

  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' THEN
    RAISE EXCEPTION 'ASSIGN_BATCH_INVALID_INPUT';
  END IF;
  v_count := jsonb_array_length(p_itens);
  IF v_count < 1 OR v_count > 30 THEN
    RAISE EXCEPTION 'ASSIGN_BATCH_INVALID_COUNT';
  END IF;

  -- Serialize batches for this professor to protect the aggregate workload check.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_escola_id::text || ':' || p_professor_id::text, 0)
  );

  FOR v_item IN SELECT value FROM pg_catalog.jsonb_array_elements(p_itens)
  LOOP
    IF jsonb_typeof(v_item) <> 'object'
      OR NOT (v_item ? 'turma_id' AND v_item ? 'curso_matriz_id') THEN
      RAISE EXCEPTION 'ASSIGN_BATCH_INVALID_ITEM';
    END IF;
    v_turma_id := (v_item ->> 'turma_id')::uuid;
    v_matriz_id := (v_item ->> 'curso_matriz_id')::uuid;
    IF v_turma_id = ANY(v_seen) THEN
      RAISE EXCEPTION 'ASSIGN_BATCH_DUPLICATE_TURMA';
    END IF;
    v_seen := pg_catalog.array_append(v_seen, v_turma_id);

    -- Lock the concrete offering, never infer a matrix ID from the catalog.
    SELECT td.professor_id, cm.disciplina_id
      INTO v_professor_atual, v_disciplina_id
    FROM public.turma_disciplinas td
    JOIN public.turmas tu ON tu.id = td.turma_id AND tu.escola_id = p_escola_id
    JOIN public.curso_matriz cm ON cm.id = td.curso_matriz_id AND cm.escola_id = p_escola_id
    WHERE td.escola_id = p_escola_id AND td.turma_id = v_turma_id
      AND td.curso_matriz_id = v_matriz_id
    FOR UPDATE OF td;

    IF NOT FOUND OR v_disciplina_id IS DISTINCT FROM p_disciplina_id THEN
      RAISE EXCEPTION 'ASSIGN_BATCH_DISCIPLINA_INCOMPATIVEL: %', v_turma_id;
    END IF;

    SELECT tdp.professor_id INTO v_tdp_professor
    FROM public.turma_disciplinas_professores tdp
    WHERE tdp.escola_id = p_escola_id AND tdp.turma_id = v_turma_id
      AND tdp.disciplina_id = p_disciplina_id
    FOR UPDATE;

    IF (v_professor_atual IS NOT NULL AND v_professor_atual <> p_professor_id)
       OR (v_tdp_professor IS NOT NULL AND v_tdp_professor <> p_professor_id) THEN
      RAISE EXCEPTION 'ASSIGN_BATCH_JA_ATRIBUIDA: %', v_turma_id;
    END IF;

    IF v_professor_atual IS DISTINCT FROM p_professor_id
       OR v_tdp_professor IS DISTINCT FROM p_professor_id THEN
      PERFORM public.assign_professor_turma_disciplina_atomic(
        p_escola_id, v_turma_id, v_matriz_id, p_professor_id, NULL, NULL
      );
      v_total := v_total + 1;
    END IF;
  END LOOP;

  RETURN v_total;
END;
$function$;

REVOKE ALL ON FUNCTION public.assign_professor_turmas_disciplina_batch(uuid,uuid,uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_professor_turmas_disciplina_batch(uuid,uuid,uuid,jsonb) TO authenticated;


-- A edição do cadastro e das competências também precisa ser indivisível.
CREATE OR REPLACE FUNCTION public.update_teacher_details_atomic(
  p_escola_id uuid,
  p_profile_id uuid,
  p_details jsonb,
  p_skill_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_teacher_id uuid;
  v_nome text := pg_catalog.btrim(p_details ->> 'nome_completo');
  v_skill_ids uuid[] := COALESCE(p_skill_ids, ARRAY[]::uuid[]);
BEGIN
  IF auth.uid() IS NULL OR p_escola_id IS NULL OR p_profile_id IS NULL THEN
    RAISE EXCEPTION 'UPDATE_TEACHER_FORBIDDEN';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.escola_users eu
    WHERE eu.escola_id = p_escola_id AND eu.user_id = auth.uid()
      AND coalesce(eu.papel, eu.role) IN
        ('admin', 'admin_escola', 'admin_secretaria', 'admin_financeiro', 'diretor')
  ) THEN
    RAISE EXCEPTION 'UPDATE_TEACHER_FORBIDDEN';
  END IF;
  IF p_details IS NULL OR jsonb_typeof(p_details) <> 'object'
    OR v_nome IS NULL OR char_length(v_nome) < 3 OR char_length(v_nome) > 160
    OR cardinality(v_skill_ids) > 200 THEN
    RAISE EXCEPTION 'UPDATE_TEACHER_INVALID_INPUT';
  END IF;

  SELECT t.id INTO v_teacher_id
  FROM public.teachers t
  JOIN public.professores p ON p.escola_id = t.escola_id AND p.profile_id = t.profile_id
  WHERE t.escola_id = p_escola_id AND t.profile_id = p_profile_id
  FOR UPDATE OF t;
  IF v_teacher_id IS NULL THEN
    RAISE EXCEPTION 'UPDATE_TEACHER_NOT_FOUND';
  END IF;

  IF (
    SELECT count(*) FROM public.disciplinas_catalogo d
    WHERE d.escola_id = p_escola_id AND d.id = ANY(v_skill_ids)
  ) <> cardinality(v_skill_ids) THEN
    RAISE EXCEPTION 'UPDATE_TEACHER_INVALID_SKILLS';
  END IF;

  UPDATE public.teachers SET
    nome_completo = v_nome,
    genero = p_details ->> 'genero',
    data_nascimento = nullif(p_details ->> 'data_nascimento', '')::date,
    numero_bi = nullif(p_details ->> 'numero_bi', ''),
    telefone_principal = nullif(p_details ->> 'telefone_principal', ''),
    habilitacoes = p_details ->> 'habilitacoes',
    area_formacao = nullif(p_details ->> 'area_formacao', ''),
    vinculo_contratual = p_details ->> 'vinculo_contratual',
    carga_horaria_maxima = (p_details ->> 'carga_horaria_maxima')::integer,
    turnos_disponiveis = ARRAY(
      SELECT jsonb_array_elements_text(COALESCE(p_details -> 'turnos_disponiveis', '[]'::jsonb))
    ),
    is_diretor_turma = COALESCE((p_details ->> 'is_diretor_turma')::boolean, false)
  WHERE id = v_teacher_id AND escola_id = p_escola_id;

  UPDATE public.profiles SET
    nome = v_nome,
    telefone = nullif(p_details ->> 'telefone_principal', '')
  WHERE user_id = p_profile_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'UPDATE_TEACHER_PROFILE_NOT_FOUND';
  END IF;

  DELETE FROM public.teacher_skills
  WHERE escola_id = p_escola_id AND teacher_id = v_teacher_id;

  INSERT INTO public.teacher_skills (escola_id, teacher_id, disciplina_id)
  SELECT p_escola_id, v_teacher_id, s.disciplina_id
  FROM pg_catalog.unnest(v_skill_ids) AS s(disciplina_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.update_teacher_details_atomic(uuid,uuid,jsonb,uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_teacher_details_atomic(uuid,uuid,jsonb,uuid[]) TO authenticated;

COMMIT;
