BEGIN;

ALTER TABLE public.turmas
  ADD COLUMN IF NOT EXISTS status_fecho text DEFAULT 'ABERTO'::text NOT NULL;

CREATE OR REPLACE FUNCTION public.guard_notas_when_turma_fechada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_turma_id uuid;
  v_status text;
BEGIN
  SELECT td.turma_id INTO v_turma_id
  FROM public.avaliacoes a
  JOIN public.turma_disciplinas td ON td.id = a.turma_disciplina_id
  WHERE a.id = NEW.avaliacao_id;

  IF v_turma_id IS NULL THEN
    RAISE EXCEPTION 'Turma não encontrada para validação de notas.';
  END IF;

  SELECT status_fecho INTO v_status FROM public.turmas WHERE id = v_turma_id;
  IF v_status IS DISTINCT FROM 'ABERTO' THEN
    RAISE EXCEPTION 'Turma fechada para lançamento de notas.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_avaliacoes_when_turma_fechada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_turma_id uuid;
  v_status text;
BEGIN
  SELECT turma_id INTO v_turma_id
  FROM public.turma_disciplinas
  WHERE id = NEW.turma_disciplina_id;

  IF v_turma_id IS NULL THEN
    RAISE EXCEPTION 'Turma não encontrada para avaliação.';
  END IF;

  SELECT status_fecho INTO v_status FROM public.turmas WHERE id = v_turma_id;
  IF v_status IS DISTINCT FROM 'ABERTO' THEN
    RAISE EXCEPTION 'Turma fechada para lançamento de avaliações.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_notas_turma_fecho ON public.notas;
CREATE TRIGGER trg_guard_notas_turma_fecho
  BEFORE INSERT OR UPDATE ON public.notas
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_notas_when_turma_fechada();

DROP TRIGGER IF EXISTS trg_guard_avaliacoes_turma_fecho ON public.avaliacoes;
CREATE TRIGGER trg_guard_avaliacoes_turma_fecho
  BEFORE INSERT OR UPDATE ON public.avaliacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_avaliacoes_when_turma_fechada();

COMMIT;
