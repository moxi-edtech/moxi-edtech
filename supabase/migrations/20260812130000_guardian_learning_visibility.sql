BEGIN;

-- Permite que um encarregado veja apenas os alunos ligados ao seu próprio
-- registo, mantendo o isolamento por escola e sem expor relações de terceiros.
DROP POLICY IF EXISTS aluno_conquistas_guardian_read ON public.aluno_conquistas;
CREATE POLICY aluno_conquistas_guardian_read
ON public.aluno_conquistas FOR SELECT
USING (
  public.is_escola_member(escola_id)
  AND EXISTS (
    SELECT 1
    FROM public.aluno_encarregados ae
    JOIN public.encarregados e ON e.id = ae.encarregado_id
    WHERE ae.aluno_id = aluno_conquistas.aluno_id
      AND ae.escola_id = aluno_conquistas.escola_id
      AND e.escola_id = aluno_conquistas.escola_id
      AND lower(e.email) = lower(auth.jwt() ->> 'email')
  )
);

DROP POLICY IF EXISTS diario_familiar_guardian_read ON public.diario_familiar_entries;
CREATE POLICY diario_familiar_guardian_read
ON public.diario_familiar_entries FOR SELECT
USING (
  public.is_escola_member(escola_id)
  AND visibilidade = 'familia'
  AND EXISTS (
    SELECT 1
    FROM public.aluno_encarregados ae
    JOIN public.encarregados e ON e.id = ae.encarregado_id
    WHERE ae.aluno_id = diario_familiar_entries.aluno_id
      AND ae.escola_id = diario_familiar_entries.escola_id
      AND e.escola_id = diario_familiar_entries.escola_id
      AND lower(e.email) = lower(auth.jwt() ->> 'email')
  )
);

COMMIT;
