BEGIN;

-- ============================================================================
-- 1) CURSOS: course_code por escola (configurável)
-- ============================================================================

ALTER TABLE public.cursos
  ADD COLUMN IF NOT EXISTS course_code text,
  ADD COLUMN IF NOT EXISTS curriculum_key text;

CREATE OR REPLACE FUNCTION public.normalize_course_code()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.course_code IS NOT NULL THEN
    NEW.course_code := upper(regexp_replace(trim(NEW.course_code), '\\s+', '', 'g'));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_course_code ON public.cursos;
CREATE TRIGGER trg_normalize_course_code
BEFORE INSERT OR UPDATE OF course_code
ON public.cursos
FOR EACH ROW
EXECUTE FUNCTION public.normalize_course_code();

CREATE UNIQUE INDEX IF NOT EXISTS uq_cursos_escola_course_code
  ON public.cursos (escola_id, course_code)
  WHERE course_code IS NOT NULL;


-- ============================================================================
-- 2) TURMAS: turma_code normalizado + ano_letivo inteiro
-- ============================================================================

ALTER TABLE public.turmas
  ADD COLUMN IF NOT EXISTS turma_code text,
  ADD COLUMN IF NOT EXISTS ano_letivo int,
  ADD COLUMN IF NOT EXISTS classe_num int,
  ADD COLUMN IF NOT EXISTS turno text,
  ADD COLUMN IF NOT EXISTS letra text;

-- Backfill turma_code a partir de turma_codigo (quando existir)
UPDATE public.turmas
   SET turma_code = upper(regexp_replace(trim(COALESCE(turma_code, turma_codigo, '')), '\\s+', '', 'g'))
 WHERE (turma_code IS NULL OR turma_code = '')
   AND COALESCE(turma_codigo, '') <> '';

-- Tenta converter ano_letivo existente para inteiro
DO $$ BEGIN
  ALTER TABLE public.turmas
    ALTER COLUMN ano_letivo TYPE int USING nullif(ano_letivo::text, '')::int;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

CREATE OR REPLACE FUNCTION public.normalize_turma_code()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.turma_code IS NOT NULL THEN
    NEW.turma_code := upper(regexp_replace(trim(NEW.turma_code), '\\s+', '', 'g'));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_turma_code ON public.turmas;
CREATE TRIGGER trg_normalize_turma_code
BEFORE INSERT OR UPDATE OF turma_code
ON public.turmas
FOR EACH ROW
EXECUTE FUNCTION public.normalize_turma_code();

CREATE UNIQUE INDEX IF NOT EXISTS uq_turmas_escola_ano_code
  ON public.turmas (escola_id, ano_letivo, turma_code)
  WHERE turma_code IS NOT NULL AND ano_letivo IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_turmas_escola_ano
  ON public.turmas (escola_id, ano_letivo);


-- ============================================================================
-- 3) Função: create_or_get_turma_by_code
-- ============================================================================

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

  SELECT c.id INTO v_curso_id
    FROM public.cursos c
   WHERE c.escola_id = p_escola_id
     AND c.course_code = v_course_code
   LIMIT 1;

  IF v_curso_id IS NULL THEN
    RAISE EXCEPTION 'Curso não encontrado para course_code=% na escola', v_course_code USING ERRCODE = '23503';
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
