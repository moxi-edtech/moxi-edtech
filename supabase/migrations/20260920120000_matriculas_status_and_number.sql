BEGIN;

-- 1) Defaults alinhados ao funil
ALTER TABLE public.alunos
  ALTER COLUMN status SET DEFAULT 'pendente';

ALTER TABLE public.matriculas
  ALTER COLUMN status SET DEFAULT 'pendente';

-- 2) Trigger de número: só quando ativa
CREATE OR REPLACE FUNCTION public.trg_set_matricula_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_seq bigint;
  v_ano int;
BEGIN
  -- Gera número apenas quando status vira 'ativa'
  IF NEW.status = 'ativa'
     AND (NEW.numero_matricula IS NULL OR btrim(NEW.numero_matricula) = '') THEN

    v_seq := public.next_matricula_number(NEW.escola_id);

    v_ano := COALESCE(
      NEW.ano_letivo,
      EXTRACT(YEAR FROM COALESCE(NEW.data_matricula, now()))::int
    );

    NEW.numero_matricula :=
      v_ano::text || '-' || lpad(v_seq::text, 6, '0') || '/' || v_ano::text;
  END IF;

  -- Se não estiver ativa, zera o número
  IF NEW.status <> 'ativa' THEN
    NEW.numero_matricula := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_matricula_number ON public.matriculas;

CREATE TRIGGER trg_20_set_matricula_number
BEFORE INSERT OR UPDATE ON public.matriculas
FOR EACH ROW
EXECUTE FUNCTION public.trg_set_matricula_number();

-- 3) Patch de dados
--   a) remove número quando não está ativa
UPDATE public.matriculas
SET numero_matricula = NULL
WHERE status <> 'ativa'
  AND numero_matricula IS NOT NULL
  AND btrim(numero_matricula) <> '';

--   b) gera número para ativas sem número
DO $$
DECLARE
  rec RECORD;
  v_seq bigint;
  v_ano int;
BEGIN
  FOR rec IN
    SELECT id,
           escola_id,
           COALESCE(
             ano_letivo,
             EXTRACT(YEAR FROM COALESCE(data_matricula, now()))::int
           ) AS ano
      FROM public.matriculas
     WHERE status = 'ativa'
       AND (numero_matricula IS NULL OR btrim(numero_matricula) = '')
  LOOP
    v_seq := public.next_matricula_number(rec.escola_id);
    v_ano := rec.ano;

    UPDATE public.matriculas m
       SET numero_matricula =
             v_ano::text || '-' || lpad(v_seq::text, 6, '0') || '/' || v_ano::text
     WHERE m.id = rec.id;
  END LOOP;
END;
$$;

-- 4) Constraint hard: número só quando ativa
ALTER TABLE public.matriculas
DROP CONSTRAINT IF EXISTS matriculas_numero_only_when_ativa;

ALTER TABLE public.matriculas
ADD CONSTRAINT matriculas_numero_only_when_ativa
CHECK (
  (status = 'ativa' AND numero_matricula IS NOT NULL AND btrim(numero_matricula) <> '')
  OR
  (status <> 'ativa' AND (numero_matricula IS NULL OR btrim(numero_matricula) = ''))
);

-- 5) Índice único parcial para ativas
CREATE UNIQUE INDEX IF NOT EXISTS uq_matriculas_numero_por_escola_ativa
ON public.matriculas (escola_id, numero_matricula)
WHERE status = 'ativa';

-- 6) Trigger de ativação do aluno: apenas matrícula ativa numerada
CREATE OR REPLACE FUNCTION public.activate_aluno_after_matricula()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'ativa'
     AND NEW.numero_matricula IS NOT NULL
     AND btrim(NEW.numero_matricula) <> '' THEN
    UPDATE public.alunos
       SET status = 'ativo'
     WHERE id = NEW.aluno_id
       AND status IS DISTINCT FROM 'ativo';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_activate_aluno_after_matricula ON public.matriculas;

CREATE TRIGGER trg_activate_aluno_after_matricula
AFTER INSERT OR UPDATE ON public.matriculas
FOR EACH ROW
EXECUTE FUNCTION public.activate_aluno_after_matricula();

-- 7) Patch de dados complementar
UPDATE public.alunos a
SET status = 'pendente'
WHERE status = 'ativo'
  AND NOT EXISTS (
    SELECT 1
    FROM public.matriculas m
    WHERE m.aluno_id = a.id
      AND m.status = 'ativa'
      AND m.numero_matricula IS NOT NULL
      AND btrim(m.numero_matricula) <> ''
  );

COMMIT;
