BEGIN;

ALTER TABLE public.matriculas
  DROP CONSTRAINT IF EXISTS matriculas_numero_only_when_ativa;

ALTER TABLE public.matriculas
  ADD CONSTRAINT matriculas_numero_only_when_ativa CHECK (
    ((status = 'ativo') AND numero_matricula IS NOT NULL AND btrim(numero_matricula) <> '')
    OR ((status <> 'ativo') AND (numero_matricula IS NULL OR btrim(numero_matricula) = ''))
  );

COMMIT;
