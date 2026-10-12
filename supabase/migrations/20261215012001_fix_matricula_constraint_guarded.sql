BEGIN;
DO $guard$
DECLARE actual text;
BEGIN
  SELECT pg_get_constraintdef(con.oid,true) INTO actual
  FROM pg_constraint con
  WHERE con.conrelid='public.matriculas'::regclass
    AND con.conname='matriculas_numero_only_when_ativa';
  -- Production already includes 'transferido'; this condition is a no-op
  -- on the verified production definition.
  IF actual IS NULL OR actual NOT LIKE '%transferido%' THEN
    ALTER TABLE public.matriculas
      DROP CONSTRAINT IF EXISTS matriculas_numero_only_when_ativa;
    ALTER TABLE public.matriculas ADD CONSTRAINT matriculas_numero_only_when_ativa CHECK (
      ((status IN ('ativo','ativa','active','transferido')) AND
         numero_matricula IS NOT NULL AND btrim(numero_matricula) <> '')
      OR
      ((status NOT IN ('ativo','ativa','active','transferido')) AND
         (numero_matricula IS NULL OR btrim(numero_matricula) = ''))
    ) NOT VALID;
  END IF;
END $guard$;
COMMIT;
