BEGIN;

-- A completed rematriculation closes the origin as `transferido`, but the
-- origin still carries its historical matrícula number. The previous check
-- rejected that legitimate transition after the destination was created.
ALTER TABLE public.matriculas
  DROP CONSTRAINT IF EXISTS matriculas_numero_only_when_ativa;

ALTER TABLE public.matriculas
  ADD CONSTRAINT matriculas_numero_only_when_ativa CHECK (
    (
      status IN ('ativo', 'ativa', 'active', 'transferido')
      AND numero_matricula IS NOT NULL
      AND btrim(numero_matricula) <> ''
    )
    OR (
      status NOT IN ('ativo', 'ativa', 'active', 'transferido')
      AND (numero_matricula IS NULL OR btrim(numero_matricula) = '')
    )
  ) NOT VALID;

COMMIT;
