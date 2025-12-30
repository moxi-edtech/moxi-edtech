BEGIN;

CREATE OR REPLACE FUNCTION public.assert_course_class_range(
  p_curriculum_key text,
  p_class_num int
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_min int;
  v_max int;
BEGIN
  IF p_curriculum_key IS NULL THEN
    RETURN;
  END IF;

  CASE p_curriculum_key
    WHEN 'primario_base', 'primario_avancado' THEN v_min := 1; v_max := 6;
    WHEN 'ciclo1' THEN v_min := 7; v_max := 9;
    WHEN 'puniv', 'economicas' THEN v_min := 10; v_max := 12;
    WHEN 'tecnico_informatica', 'tecnico_gestao', 'tecnico_construcao', 'tecnico_base', 'saude_enfermagem', 'saude_farmacia_analises' THEN v_min := 10; v_max := 13;
    ELSE
      RETURN;
  END CASE;

  IF p_class_num < v_min OR p_class_num > v_max THEN
    RAISE EXCEPTION 'Classe % fora do intervalo permitido (%-%) para currículo %', p_class_num, v_min, v_max, p_curriculum_key
      USING ERRCODE = '22023';
  END IF;
END;
$$;

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
  v_code text := upper(regexp_replace(trim(p_turma_code), '\\s+', '', 'g'));
  v_course_code text;
  v_class_num int;
  v_shift text;
  v_section text;
  v_curso_id uuid;
  v_curriculum_key text;
  v_turma public.turmas;
BEGIN
  IF p_escola_id IS NULL THEN
    RAISE EXCEPTION 'escola_id é obrigatório' USING ERRCODE = '22023';
  END IF;

  IF p_ano_letivo IS NULL THEN
    RAISE EXCEPTION 'ano_letivo é obrigatório' USING ERRCODE = '22023';
  END IF;

  IF v_code !~ '^[A-Z0-9]{2,8}-\\d{1,2}-(M|T|N)-[A-Z]{1,2}$' THEN
    RAISE EXCEPTION 'Código da Turma inválido: % (ex: TI-10-M-A)', p_turma_code
      USING ERRCODE = '22023';
  END IF;

  v_course_code := split_part(v_code, '-', 1);
  v_class_num   := split_part(v_code, '-', 2)::int;
  v_shift       := split_part(v_code, '-', 3);
  v_section     := split_part(v_code, '-', 4);

  IF v_class_num < 1 OR v_class_num > 13 THEN
    RAISE EXCEPTION 'Classe inválida no código: %', v_class_num USING ERRCODE = '22023';
  END IF;

  SELECT c.id, c.curriculum_key INTO v_curso_id, v_curriculum_key
    FROM public.cursos c
   WHERE c.escola_id = p_escola_id
     AND c.course_code = v_course_code
   LIMIT 1;

  IF v_curso_id IS NULL THEN
    RAISE EXCEPTION 'Curso não encontrado para course_code=% na escola', v_course_code USING ERRCODE = '23503';
  END IF;

  PERFORM public.assert_course_class_range(v_curriculum_key, v_class_num);

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
