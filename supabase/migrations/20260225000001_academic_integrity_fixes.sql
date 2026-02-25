BEGIN;

ALTER TABLE public.curso_matriz
  ADD COLUMN IF NOT EXISTS conta_para_media_med boolean NOT NULL DEFAULT true;

ALTER TABLE public.turma_disciplinas
  ADD COLUMN IF NOT EXISTS conta_para_media_med boolean NOT NULL DEFAULT true;

DO $$
BEGIN
  IF to_regclass('public.school_subjects') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.school_subjects ADD COLUMN IF NOT EXISTS conta_para_media_med boolean NOT NULL DEFAULT false';
  END IF;
END $$;

DO $$
DECLARE
  v_orfaos bigint;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'avaliacoes_turma_disciplina_id_fkey'
      AND conrelid = 'public.avaliacoes'::regclass
  ) THEN
    SELECT COUNT(*)
      INTO v_orfaos
      FROM public.avaliacoes a
      LEFT JOIN public.turma_disciplinas td
        ON td.id = a.turma_disciplina_id
     WHERE td.id IS NULL;

    IF v_orfaos > 0 THEN
      RAISE EXCEPTION
        'Não foi possível criar avaliacoes_turma_disciplina_id_fkey: % avaliação(ões) órfã(s) em avaliacoes.turma_disciplina_id.',
        v_orfaos
        USING ERRCODE = 'P0001';
    END IF;

    ALTER TABLE public.avaliacoes
      ADD CONSTRAINT avaliacoes_turma_disciplina_id_fkey
      FOREIGN KEY (turma_disciplina_id)
      REFERENCES public.turma_disciplinas(id)
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;
END $$;


CREATE OR REPLACE FUNCTION public.ensure_curriculo_published_for_turma()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_ano_letivo_id uuid;
  v_has_published boolean := false;
BEGIN
  IF NEW.curso_id IS NULL OR NEW.escola_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_ano_letivo_id := NEW.ano_letivo_id;

  IF v_ano_letivo_id IS NULL AND NEW.ano_letivo IS NOT NULL THEN
    SELECT al.id
      INTO v_ano_letivo_id
      FROM public.anos_letivos al
     WHERE al.escola_id = NEW.escola_id
       AND al.ano = NEW.ano_letivo
     ORDER BY al.ativo DESC, al.created_at DESC
     LIMIT 1;
  END IF;

  IF v_ano_letivo_id IS NULL THEN
    RAISE EXCEPTION
      'Turma inválida: ano letivo não resolvido para escola % e ano %.',
      NEW.escola_id, NEW.ano_letivo
      USING ERRCODE = 'P0001';
  END IF;

  SELECT EXISTS (
    SELECT 1
      FROM public.curso_curriculos cc
     WHERE cc.escola_id = NEW.escola_id
       AND cc.curso_id = NEW.curso_id
       AND cc.ano_letivo_id = v_ano_letivo_id
       AND cc.status = 'published'
       AND (cc.classe_id IS NULL OR NEW.classe_id IS NULL OR cc.classe_id = NEW.classe_id)
  )
  INTO v_has_published;

  IF NOT v_has_published THEN
    RAISE EXCEPTION
      'Não é permitido criar turma sem currículo publicado para este curso/ano letivo.'
      USING ERRCODE = 'P0001';
  END IF;

  NEW.ano_letivo_id := v_ano_letivo_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_curriculo_published ON public.turmas;

CREATE TRIGGER trg_ensure_curriculo_published
  BEFORE INSERT ON public.turmas
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_curriculo_published_for_turma();

COMMIT;
