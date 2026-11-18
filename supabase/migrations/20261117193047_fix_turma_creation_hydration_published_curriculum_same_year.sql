-- Single authoritative subject hydration for newly created academic classes.
-- The previously coexisting AFTER INSERT triggers selected matrices across all years.
-- Do not touch existing turma_disciplinas or academic records.

DROP TRIGGER IF EXISTS trg_auto_disciplinas ON public.turmas;
DROP FUNCTION IF EXISTS public.sync_disciplinas_ao_criar_turma();

CREATE OR REPLACE FUNCTION public.tg_fill_turma_disciplinas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'pg_catalog', 'public'
AS $hydrate$
DECLARE
  v_curriculo_id uuid;
BEGIN
  -- Preserve the previous behavior for incomplete class placeholders.
  IF NEW.escola_id IS NULL OR NEW.curso_id IS NULL
     OR NEW.classe_id IS NULL OR NEW.ano_letivo_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- The curriculum must match the specific tenant, academic year,
  -- course and class. Never select a curriculum merely by class/course.
  SELECT cc.id
    INTO v_curriculo_id
  FROM public.curso_curriculos AS cc
  WHERE cc.escola_id = NEW.escola_id
    AND cc.curso_id = NEW.curso_id
    AND cc.classe_id = NEW.classe_id
    AND cc.ano_letivo_id = NEW.ano_letivo_id
    AND cc.status = 'published'
  ORDER BY cc.version DESC, cc.created_at DESC, cc.id DESC
  LIMIT 1;

  IF v_curriculo_id IS NULL THEN
    RAISE EXCEPTION
      'Não existe currículo publicado para a escola, curso, classe e ano letivo da turma.'
      USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.turma_disciplinas (
    escola_id,
    turma_id,
    curso_matriz_id,
    professor_id,
    created_at
  )
  SELECT
    NEW.escola_id,
    NEW.id,
    cm.id,
    NULL,
    now()
  FROM public.curso_matriz AS cm
  WHERE cm.curso_curriculo_id = v_curriculo_id
    AND cm.escola_id = NEW.escola_id
    AND cm.curso_id = NEW.curso_id
    AND cm.classe_id = NEW.classe_id
    AND cm.ativo IS TRUE
  ON CONFLICT (escola_id, turma_id, curso_matriz_id) DO NOTHING;

  RETURN NEW;
END;
$hydrate$;
