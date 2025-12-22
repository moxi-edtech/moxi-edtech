BEGIN;

-- Função utilitária para normalizar códigos de turma, aceitando hífens variados
CREATE OR REPLACE FUNCTION public.normalize_turma_code(p_code text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_code text := COALESCE(p_code, '');
BEGIN
  v_code := upper(trim(v_code));

  -- Converte variações de hífen (en/em dash, minus sign, non-breaking) para '-'
  v_code := translate(v_code, '–—−‑', '----');

  -- Espaços/underscores viram hífen e qualquer símbolo vira separador
  v_code := regexp_replace(v_code, '[\s_]+', '-', 'g');
  v_code := regexp_replace(v_code, '[^A-Z0-9-]', '-', 'g');

  -- Evita múltiplos hífens e remove nos extremos
  v_code := regexp_replace(v_code, '-+', '-', 'g');
  v_code := regexp_replace(v_code, '^-|-$', '', 'g');

  IF v_code = '' THEN
    RETURN NULL;
  END IF;

  RETURN v_code;
END;
$$;


-- Atualiza create_or_get_turma_by_code para usar a normalização
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

  IF v_code !~ '^[A-Z0-9]{2,8}-\d{1,2}-(M|T|N)-[A-Z]{1,2}$' THEN
    RAISE EXCEPTION 'Código da Turma inválido: % (ex: TI-10-M-A)', p_turma_code
      USING ERRCODE = '22023';
  END IF;

  v_compact := regexp_replace(v_code, '[^A-Z0-9]', '', 'g');

  v_course_code := split_part(v_code, '-', 1);
  v_class_num   := split_part(v_code, '-', 2)::int;
  v_shift       := split_part(v_code, '-', 3);
  v_section     := split_part(v_code, '-', 4);

  IF v_class_num < 1 OR v_class_num > 13 THEN
    RAISE EXCEPTION 'Classe inválida no código: %', v_class_num USING ERRCODE = '22023';
  END IF;

  SELECT c.id INTO v_curso_id
    FROM public.cursos c
   WHERE c.escola_id = p_escola_id
     AND c.course_code = v_course_code
   LIMIT 1;

  IF v_curso_id IS NULL THEN
    RAISE EXCEPTION 'Curso não encontrado para course_code=% na escola', v_course_code USING ERRCODE = '23503';
  END IF;

  -- Tenta reaproveitar turma existente com código equivalente (ignorando símbolos)
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


-- Ajusta importar_alunos para usar a mesma normalização
CREATE OR REPLACE FUNCTION public.importar_alunos(
  p_import_id uuid,
  p_escola_id uuid,
  p_ano_letivo int
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  r RECORD;
  v_aluno_id uuid;
  v_turma_id uuid;
  v_total_imported int := 0;
  v_total_errors int := 0;
  v_turmas_created int := 0;

  v_clean_nome text;
  v_clean_telefone text;
  v_clean_turma_codigo text;
  v_had_turma boolean;
  v_turma_exists boolean;
BEGIN
  FOR r IN SELECT * FROM public.staging_alunos WHERE import_id = p_import_id LOOP
    BEGIN
      v_clean_nome := public.initcap_angola(r.nome);
      v_clean_telefone := regexp_replace(r.encarregado_telefone, '[^0-9+]', '', 'g');
      v_clean_turma_codigo := public.normalize_turma_code(r.turma_codigo);
      v_had_turma := (v_clean_turma_codigo IS NOT NULL);

      IF v_clean_telefone = '' OR v_clean_telefone IS NULL THEN
        RAISE EXCEPTION 'Telefone inválido';
      END IF;

      -- Upsert Aluno
      INSERT INTO public.alunos (
        escola_id, numero_processo, nome, bi_numero, nif,
        encarregado_nome, encarregado_telefone, encarregado_email
      )
      VALUES (
        p_escola_id, r.numero_processo, v_clean_nome,
        upper(trim(r.bi_numero)), upper(trim(COALESCE(r.nif, r.bi_numero))),
        public.initcap_angola(r.encarregado_nome), v_clean_telefone, lower(trim(r.encarregado_email))
      )
      ON CONFLICT (escola_id, numero_processo) DO UPDATE SET
        nome = EXCLUDED.nome,
        bi_numero = EXCLUDED.bi_numero,
        encarregado_nome = COALESCE(EXCLUDED.encarregado_nome, public.alunos.encarregado_nome),
        encarregado_telefone = EXCLUDED.encarregado_telefone,
        updated_at = now()
      RETURNING id INTO v_aluno_id;

      IF v_had_turma THEN
        SELECT EXISTS(
          SELECT 1
          FROM public.turmas
          WHERE escola_id = p_escola_id
            AND ano_letivo = p_ano_letivo
            AND public.normalize_turma_code(turma_code) = v_clean_turma_codigo
        ) INTO v_turma_exists;

        SELECT id INTO v_turma_id FROM public.create_or_get_turma_by_code(p_escola_id, p_ano_letivo, r.turma_codigo);

        IF NOT v_turma_exists AND v_turma_id IS NOT NULL THEN
          v_turmas_created := v_turmas_created + 1;
        END IF;

        INSERT INTO public.matriculas (
          escola_id, aluno_id, turma_id, ano_letivo, status, ativo,
          numero_matricula, data_matricula
        ) VALUES (
          p_escola_id, v_aluno_id, v_turma_id, p_ano_letivo, 'ativo', true,
          (SELECT numero_processo FROM public.alunos WHERE id = v_aluno_id) || '/' || p_ano_letivo, now()
        ) ON CONFLICT (escola_id, aluno_id, ano_letivo) DO NOTHING;
      END IF;

      v_total_imported := v_total_imported + 1;
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.import_errors (import_id, row_number, message, raw_value)
      VALUES (p_import_id, r.row_number, SQLERRM, COALESCE(r.numero_processo, r.nome));
      v_total_errors := v_total_errors + 1;
    END;
  END LOOP;

  RETURN json_build_object('imported', v_total_imported, 'errors', v_total_errors, 'turmas_created', v_turmas_created);
END;
$$;

-- Força recarregamento de schema no PostgREST/Supabase
NOTIFY pgrst, 'reload schema';

COMMIT;
