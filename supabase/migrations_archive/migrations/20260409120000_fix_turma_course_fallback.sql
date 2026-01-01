BEGIN;

-- Backfill course_code a partir de colunas já existentes para evitar erros em turmas/importação
UPDATE public.cursos
   SET course_code = upper(regexp_replace(trim(codigo), '\\s+', '', 'g'))
 WHERE course_code IS NULL
   AND codigo IS NOT NULL
   AND trim(codigo) <> '';

UPDATE public.cursos c
   SET course_code = CASE
     WHEN c.curriculum_key IN ('primario_base','primario_avancado') THEN 'EP'
     WHEN c.curriculum_key IN ('ciclo1') THEN 'ESG'
     WHEN c.curriculum_key = 'tecnico_informatica' THEN 'TI'
     WHEN c.curriculum_key = 'tecnico_gestao' THEN 'TG'
     WHEN c.curriculum_key = 'tecnico_construcao' THEN 'CC'
     WHEN c.curriculum_key = 'puniv' THEN 'CFB'
     WHEN c.curriculum_key = 'economicas' THEN 'CEJ'
     WHEN c.curriculum_key = 'saude_enfermagem' THEN 'ENF'
     WHEN c.curriculum_key = 'saude_farmacia_analises' THEN 'AC'
     ELSE c.course_code
   END
 WHERE c.course_code IS NULL
   AND c.curriculum_key IS NOT NULL;

-- Melhora create_or_get_turma_by_code para aceitar códigos de curso legados
-- (coluna codigo ou curriculum_key), usando a mesma normalização e preenchendo course_code automaticamente.
CREATE OR REPLACE FUNCTION public.create_or_get_turma_by_code(
  p_escola_id uuid,
  p_ano_letivo int,
  p_turma_code text
)
RETURNS public.turmas
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code text := public.normalize_turma_code(p_turma_code);
  v_compact text;
  v_parts text[];
  v_course_code text;
  v_class_num int;
  v_shift text;
  v_section text;
  v_curso_id uuid;
  v_turma public.turmas;
BEGIN
  IF p_escola_id IS NULL THEN
    RAISE EXCEPTION 'escola_id é obrigatório' USING ERRCODE = '22023';
  END IF;

  IF p_ano_letivo IS NULL THEN
    RAISE EXCEPTION 'ano_letivo é obrigatório' USING ERRCODE = '22023';
  END IF;

  IF v_code IS NULL THEN
    RAISE EXCEPTION 'Código da Turma inválido: % (ex: TI-10-M-A)', p_turma_code
      USING ERRCODE = '22023';
  END IF;

  v_parts := string_to_array(v_code, '-');

  IF array_length(v_parts, 1) <> 4 THEN
    RAISE EXCEPTION 'Código da Turma inválido: % (ex: TI-10-M-A)', p_turma_code
      USING ERRCODE = '22023';
  END IF;

  v_course_code := v_parts[1];
  v_class_num   := nullif(v_parts[2], '')::int;
  v_shift       := v_parts[3];
  v_section     := v_parts[4];

  IF v_course_code IS NULL OR length(v_course_code) < 2 OR length(v_course_code) > 8 THEN
    RAISE EXCEPTION 'Código da Turma inválido: % (ex: TI-10-M-A)', p_turma_code
      USING ERRCODE = '22023';
  END IF;

  IF v_class_num < 1 OR v_class_num > 13 THEN
    RAISE EXCEPTION 'Classe inválida no código: %', v_class_num USING ERRCODE = '22023';
  END IF;

  IF v_shift NOT IN ('M', 'T', 'N') THEN
    RAISE EXCEPTION 'Código da Turma inválido: % (ex: TI-10-M-A)', p_turma_code
      USING ERRCODE = '22023';
  END IF;

  IF v_section IS NULL OR v_section !~ '^[A-Z]{1,2}$' THEN
    RAISE EXCEPTION 'Código da Turma inválido: % (ex: TI-10-M-A)', p_turma_code
      USING ERRCODE = '22023';
  END IF;

  v_compact := regexp_replace(v_code, '[^A-Z0-9]', '', 'g');

  -- 1) Busca course_code configurado
  SELECT c.id INTO v_curso_id
    FROM public.cursos c
   WHERE c.escola_id = p_escola_id
     AND c.course_code = v_course_code
   LIMIT 1;

  -- 2) Fallback para coluna codigo (legado) e preenche course_code
  IF v_curso_id IS NULL THEN
    SELECT c.id INTO v_curso_id
      FROM public.cursos c
     WHERE c.escola_id = p_escola_id
       AND upper(regexp_replace(trim(c.codigo), '\\s+', '', 'g')) = v_course_code
     LIMIT 1;

    IF v_curso_id IS NOT NULL THEN
      UPDATE public.cursos
         SET course_code = v_course_code
       WHERE id = v_curso_id
         AND course_code IS NULL;
    END IF;
  END IF;

  -- 3) Fallback para curriculum_key conhecido (usa o mesmo mapping do backfill)
  IF v_curso_id IS NULL THEN
    SELECT c.id INTO v_curso_id
      FROM public.cursos c
     WHERE c.escola_id = p_escola_id
       AND c.course_code IS NULL
       AND (
         CASE
           WHEN c.curriculum_key IN ('primario_base','primario_avancado') THEN 'EP'
           WHEN c.curriculum_key IN ('ciclo1') THEN 'ESG'
           WHEN c.curriculum_key = 'tecnico_informatica' THEN 'TI'
           WHEN c.curriculum_key = 'tecnico_gestao' THEN 'TG'
           WHEN c.curriculum_key = 'tecnico_construcao' THEN 'CC'
           WHEN c.curriculum_key = 'puniv' THEN 'CFB'
           WHEN c.curriculum_key = 'economicas' THEN 'CEJ'
           WHEN c.curriculum_key = 'saude_enfermagem' THEN 'ENF'
           WHEN c.curriculum_key = 'saude_farmacia_analises' THEN 'AC'
           ELSE NULL
         END
       ) = v_course_code
     LIMIT 1;

    IF v_curso_id IS NOT NULL THEN
      UPDATE public.cursos
         SET course_code = v_course_code
       WHERE id = v_curso_id
         AND course_code IS NULL;
    END IF;
  END IF;

  IF v_curso_id IS NULL THEN
    RAISE EXCEPTION 'Curso não encontrado para course_code=% na escola', v_course_code USING ERRCODE = '23503';
  END IF;

  -- Reaproveita turma existente com código equivalente (ignorando símbolos/variações)
  SELECT t.* INTO v_turma
    FROM public.turmas t
   WHERE t.escola_id = p_escola_id
     AND t.ano_letivo = p_ano_letivo
     AND (
       regexp_replace(COALESCE(t.turma_code, ''), '[^A-Z0-9]', '', 'g') = v_compact OR
       regexp_replace(COALESCE(t.turma_codigo, ''), '[^A-Z0-9]', '', 'g') = v_compact
     )
   LIMIT 1;

  IF FOUND THEN
    UPDATE public.turmas
       SET turma_code = v_code,
           turma_codigo = COALESCE(v_turma.turma_codigo, v_code),
           curso_id = v_curso_id,
           classe_num = v_class_num,
           turno = v_shift,
           letra = v_section,
           nome = COALESCE(v_turma.nome, v_code || ' (Auto)')
     WHERE id = v_turma.id
     RETURNING * INTO v_turma;

    RETURN v_turma;
  END IF;

  INSERT INTO public.turmas (
    escola_id, ano_letivo, turma_code,
    curso_id, classe_num, turno, letra,
    turma_codigo, nome
  )
  VALUES (
    p_escola_id, p_ano_letivo, v_code,
    v_curso_id, v_class_num, v_shift, v_section,
    v_code, coalesce(v_code || ' (Auto)', v_code)
  )
  ON CONFLICT (escola_id, ano_letivo, turma_code)
  DO UPDATE SET
    curso_id   = EXCLUDED.curso_id,
    classe_num = EXCLUDED.classe_num,
    turno      = EXCLUDED.turno,
    letra      = EXCLUDED.letra,
    turma_codigo = COALESCE(public.turmas.turma_codigo, EXCLUDED.turma_codigo),
    nome       = COALESCE(public.turmas.nome, EXCLUDED.nome)
  RETURNING * INTO v_turma;

  RETURN v_turma;
END;
$$;

COMMIT;
