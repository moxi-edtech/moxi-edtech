BEGIN;

-- Matrículas activas podem usar os aliases legados/canónicos do sistema.
-- O número deve existir em qualquer estado activo e permanecer vazio nos
-- estados pendente, rascunho, transferido ou concluído.
ALTER TABLE public.matriculas
  DROP CONSTRAINT IF EXISTS matriculas_numero_only_when_ativa;

ALTER TABLE public.matriculas
  ADD CONSTRAINT matriculas_numero_only_when_ativa CHECK (
    (
      status IN ('ativo', 'ativa', 'active')
      AND numero_matricula IS NOT NULL
      AND btrim(numero_matricula) <> ''
    )
    OR (
      status NOT IN ('ativo', 'ativa', 'active')
      AND (numero_matricula IS NULL OR btrim(numero_matricula) = '')
    )
  );

COMMIT;
