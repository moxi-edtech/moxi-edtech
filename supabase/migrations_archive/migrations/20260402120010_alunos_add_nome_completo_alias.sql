-- Adiciona coluna compatível para imports que ainda referenciam nome_completo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'alunos'
      AND column_name = 'nome_completo'
  ) THEN
    ALTER TABLE public.alunos
      ADD COLUMN nome_completo text GENERATED ALWAYS AS (nome) STORED;
  END IF;
END$$;

