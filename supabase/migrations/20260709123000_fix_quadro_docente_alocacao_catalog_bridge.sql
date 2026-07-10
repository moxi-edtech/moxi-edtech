BEGIN;

INSERT INTO public.turma_disciplinas_professores (
  escola_id,
  turma_id,
  disciplina_id,
  professor_id
)
SELECT
  td.escola_id,
  td.turma_id,
  cm.disciplina_id,
  pr.id
FROM public.turma_disciplinas td
JOIN public.curso_matriz cm
  ON cm.id = td.curso_matriz_id
 AND cm.escola_id = td.escola_id
JOIN public.professores pr
  ON pr.escola_id = td.escola_id
 AND (
   pr.id = td.professor_id
   OR pr.profile_id = td.professor_id
 )
LEFT JOIN public.turma_disciplinas_professores tdp
  ON tdp.escola_id = td.escola_id
 AND tdp.turma_id = td.turma_id
 AND tdp.disciplina_id = cm.disciplina_id
WHERE td.professor_id IS NOT NULL
  AND cm.disciplina_id IS NOT NULL
  AND tdp.id IS NULL;

CREATE OR REPLACE FUNCTION public.trg_validate_quadro_docente_alocacao()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.professor_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.turma_disciplinas td
    JOIN public.curso_matriz cm
      ON cm.id = td.curso_matriz_id
     AND cm.escola_id = td.escola_id
    JOIN public.professores pr
      ON pr.escola_id = td.escola_id
     AND (
       pr.id = td.professor_id
       OR pr.profile_id = td.professor_id
     )
    WHERE td.escola_id = NEW.escola_id
      AND td.turma_id = NEW.turma_id
      AND pr.id = NEW.professor_id
      AND (
        td.curso_matriz_id = NEW.disciplina_id
        OR cm.disciplina_id = NEW.disciplina_id
      )
  ) THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.turma_disciplinas_professores tdp
    WHERE tdp.escola_id = NEW.escola_id
      AND tdp.turma_id = NEW.turma_id
      AND tdp.disciplina_id = NEW.disciplina_id
      AND tdp.professor_id = NEW.professor_id
  ) THEN
    RAISE EXCEPTION 'DOCENTE_NAO_ALOCADO: professor % não está alocado à disciplina % na turma %',
      NEW.professor_id, NEW.disciplina_id, NEW.turma_id;
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
