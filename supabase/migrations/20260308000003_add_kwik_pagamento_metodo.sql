DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pagamento_metodo') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum
      WHERE enumlabel = 'kwik'
        AND enumtypid = 'pagamento_metodo'::regtype
    ) THEN
      ALTER TYPE public.pagamento_metodo ADD VALUE 'kwik';
    END IF;
  END IF;
END
$$;
