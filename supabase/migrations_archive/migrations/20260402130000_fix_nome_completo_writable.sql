BEGIN;

-- Torna a coluna nome_completo gravável (era GENERATED) e sincroniza com nome
DO $$
BEGIN
  -- Se já existir como coluna gerada, remove a expressão para permitir INSERT/UPDATE
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'alunos'
      AND column_name = 'nome_completo'
      AND is_generated = 'ALWAYS'
  ) THEN
    ALTER TABLE public.alunos
      ALTER COLUMN nome_completo DROP EXPRESSION;
  ELSIF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'alunos'
      AND column_name = 'nome_completo'
  ) THEN
    ALTER TABLE public.alunos
      ADD COLUMN nome_completo text;
  END IF;
END$$;

-- Trigger para manter nome_completo alinhado com nome
CREATE OR REPLACE FUNCTION public.sync_alunos_nome_completo()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  -- Se apenas nome_completo vier preenchido, usa-o para popular nome
  IF (NEW.nome IS NULL OR btrim(NEW.nome) = '') AND NEW.nome_completo IS NOT NULL THEN
    NEW.nome := btrim(NEW.nome_completo);
  END IF;

  -- Sempre espelha nome em nome_completo para compatibilidade
  IF NEW.nome IS NOT NULL THEN
    NEW.nome_completo := NEW.nome;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_nome_completo ON public.alunos;
CREATE TRIGGER trg_sync_nome_completo
BEFORE INSERT OR UPDATE ON public.alunos
FOR EACH ROW EXECUTE PROCEDURE public.sync_alunos_nome_completo();

-- Garante consistência dos dados existentes
UPDATE public.alunos
SET nome_completo = nome
WHERE nome IS NOT NULL AND (nome_completo IS DISTINCT FROM nome OR nome_completo IS NULL);

-- Força recarregamento de schema no PostgREST/Supabase
NOTIFY pgrst, 'reload schema';

COMMIT;
