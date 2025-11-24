-- Normalização de status em public.matriculas
-- Objetivo: evitar duplicidades ("ativo", "ativa", "ACTIVE", etc.) e consolidar em chaves canônicas

-- 0) Diagnóstico (opcional)
-- SELECT trim(lower(coalesce(status, ''))) AS raw_status, count(*)
-- FROM public.matriculas
-- GROUP BY 1
-- ORDER BY 2 DESC;

-- 1) Função de canonicalização (pura)
CREATE OR REPLACE FUNCTION public.canonicalize_matricula_status_text(input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
DECLARE v text := lower(trim(coalesce(input, '')));
BEGIN
  IF v = '' THEN RETURN 'indefinido'; END IF;
  IF v IN ('ativa','ativo','active') THEN RETURN 'ativo'; END IF;
  IF v IN ('concluida','concluido','graduado') THEN RETURN 'concluido'; END IF;
  IF v IN ('transferido','transferida') THEN RETURN 'transferido'; END IF;
  IF v IN ('pendente','aguardando') THEN RETURN 'pendente'; END IF;
  IF v IN ('trancado','suspenso','desistente','inativo') THEN RETURN 'inativo'; END IF;
  RETURN 'indefinido';
END
$$;

-- 2) Backfill dos dados existentes
UPDATE public.matriculas
   SET status = public.canonicalize_matricula_status_text(status)
 WHERE TRUE;

-- 3) Trigger para manter canônico em INSERT/UPDATE
CREATE OR REPLACE FUNCTION public.matriculas_status_before_ins_upd()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.status := public.canonicalize_matricula_status_text(NEW.status);
  IF NEW.status IS NULL OR btrim(NEW.status) = '' THEN
    NEW.status := 'indefinido';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_matriculas_status_canonical ON public.matriculas;
CREATE TRIGGER trg_matriculas_status_canonical
BEFORE INSERT OR UPDATE OF status ON public.matriculas
FOR EACH ROW
EXECUTE FUNCTION public.matriculas_status_before_ins_upd();

-- 4) Constraint para garantir apenas valores canônicos
ALTER TABLE public.matriculas DROP CONSTRAINT IF EXISTS matriculas_status_check;
ALTER TABLE public.matriculas
  ADD CONSTRAINT matriculas_status_check
  CHECK (status IN ('ativo','concluido','transferido','pendente','inativo','indefinido'));

-- (Opcional) impedir NULLs e definir default
ALTER TABLE public.matriculas
  ALTER COLUMN status SET DEFAULT 'indefinido';
UPDATE public.matriculas
   SET status = 'indefinido'
 WHERE status IS NULL OR btrim(status) = '';

-- 5) Índice para acelerar filtros/agregações por escola/status
-- IMPORTANTE: não usar CONCURRENTLY em migrations do Supabase (rodam em transação)
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_matriculas_escola_status
--   ON public.matriculas (escola_id, status);

