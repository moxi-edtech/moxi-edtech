BEGIN;

CREATE OR REPLACE FUNCTION public.guard_notas_when_turma_fechada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_turma_id uuid;
  v_status text;
  v_periodo_id uuid;
  v_trava timestamptz;
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

  SELECT a.periodo_letivo_id INTO v_periodo_id
  FROM public.avaliacoes a
  WHERE a.id = NEW.avaliacao_id;

  IF v_periodo_id IS NOT NULL THEN
    SELECT trava_notas_em INTO v_trava
    FROM public.periodos_letivos
    WHERE id = v_periodo_id;

    IF v_trava IS NOT NULL AND v_trava <= now() THEN
      RAISE EXCEPTION 'Período letivo fechado para lançamento de notas.';
    END IF;
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
  v_trava timestamptz;
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

  IF NEW.periodo_letivo_id IS NOT NULL THEN
    SELECT trava_notas_em INTO v_trava
    FROM public.periodos_letivos
    WHERE id = NEW.periodo_letivo_id;

    IF v_trava IS NOT NULL AND v_trava <= now() THEN
      RAISE EXCEPTION 'Período letivo fechado para lançamento de avaliações.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
