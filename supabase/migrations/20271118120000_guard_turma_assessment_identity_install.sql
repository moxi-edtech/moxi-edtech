-- Instalação SSOT: toda disciplina de turma criada aponta para a
-- identidade de avaliação efectiva da mesma matriz/escola.
-- Sem backfill, DELETE, alterações de notas ou reconstrução de turmas.
BEGIN;

CREATE OR REPLACE FUNCTION public.klasse_resolver_avaliacao_turma_disciplina_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_escola_id uuid;
  v_disciplina_id uuid;
  v_disciplina_escola_id uuid;
BEGIN
  IF NEW.curso_matriz_id IS NULL OR NEW.escola_id IS NULL THEN
    RAISE EXCEPTION 'Vínculo curricular sem matriz ou escola'
      USING ERRCODE = '23514';
  END IF;

  SELECT cm.escola_id,
         COALESCE(cm.avaliacao_disciplina_id, cm.disciplina_id),
         dc.escola_id
    INTO v_escola_id, v_disciplina_id, v_disciplina_escola_id
    FROM public.curso_matriz cm
    LEFT JOIN public.disciplinas_catalogo dc
      ON dc.id = COALESCE(cm.avaliacao_disciplina_id, cm.disciplina_id)
   WHERE cm.id = NEW.curso_matriz_id;

  IF v_escola_id IS NULL
     OR v_disciplina_id IS NULL
     OR v_escola_id IS DISTINCT FROM NEW.escola_id
     OR v_disciplina_escola_id IS DISTINCT FROM NEW.escola_id THEN
    RAISE EXCEPTION 'Matriz ou disciplina de avaliação fora da escola'
      USING ERRCODE = '23514';
  END IF;

  -- A troca explícita de matriz invalida a identidade anterior. Recalcular
  -- somente quando o chamador manteve o ID anterior, sem mexer nas notas.
  IF TG_OP = 'UPDATE'
     AND NEW.curso_matriz_id IS DISTINCT FROM OLD.curso_matriz_id
     AND NEW.avaliacao_disciplina_id IS NOT DISTINCT FROM OLD.avaliacao_disciplina_id THEN
    NEW.avaliacao_disciplina_id := v_disciplina_id;
  END IF;

  IF NEW.avaliacao_disciplina_id IS NULL THEN
    NEW.avaliacao_disciplina_id := v_disciplina_id;
  ELSIF NEW.avaliacao_disciplina_id IS DISTINCT FROM v_disciplina_id THEN
    RAISE EXCEPTION 'Disciplina de avaliação não corresponde à matriz curricular'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

-- SECURITY INVOKER: não introduzir bypass de tenant nem grants novos.
DROP TRIGGER IF EXISTS trg_turma_disciplinas_assessment_identity
  ON public.turma_disciplinas;
CREATE TRIGGER trg_turma_disciplinas_assessment_identity
BEFORE INSERT OR UPDATE OF curso_matriz_id, avaliacao_disciplina_id
ON public.turma_disciplinas
FOR EACH ROW EXECUTE FUNCTION public.klasse_resolver_avaliacao_turma_disciplina_v1();

-- Defesa adicional mesmo se a chamada omitir a coluna. NOT VALID evita
-- validação antecipada durante o ADD; VALIDATE confirma a base integral.
DO $guard$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.turma_disciplinas'::regclass
      AND conname = 'turma_disciplinas_avaliacao_identidade_nn'
  ) THEN
    ALTER TABLE public.turma_disciplinas
      ADD CONSTRAINT turma_disciplinas_avaliacao_identidade_nn
      CHECK (avaliacao_disciplina_id IS NOT NULL) NOT VALID;
  END IF;
END;
$guard$;
ALTER TABLE public.turma_disciplinas
  VALIDATE CONSTRAINT turma_disciplinas_avaliacao_identidade_nn;

COMMENT ON FUNCTION public.klasse_resolver_avaliacao_turma_disciplina_v1() IS
  'SSOT de instalação: identifica a disciplina avaliada pela matriz da mesma escola; sem alterações em notas.';

COMMIT;
