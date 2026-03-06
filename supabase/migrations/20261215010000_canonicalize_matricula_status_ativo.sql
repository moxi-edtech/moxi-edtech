BEGIN;

CREATE OR REPLACE FUNCTION public.canonicalize_matricula_status_text(input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE PARALLEL SAFE
SET search_path TO 'public'
AS $$
DECLARE v text := lower(trim(coalesce(input, '')));
BEGIN
  IF v = '' THEN RETURN 'indefinido'; END IF;

  IF v IN ('ativa','ativo','active','em_andamento','matriculado') THEN RETURN 'ativo'; END IF;
  IF v IN ('concluida','concluido','graduado','aprovado') THEN RETURN 'concluido'; END IF;
  IF v IN ('reprovada','reprovado') THEN RETURN 'reprovado'; END IF;
  IF v IN ('reprovado_por_faltas') THEN RETURN 'reprovado_por_faltas'; END IF;
  IF v IN ('transferido','transferida') THEN RETURN 'transferido'; END IF;
  IF v IN ('anulado','anulada') THEN RETURN 'anulado'; END IF;
  IF v IN ('pendente','aguardando') THEN RETURN 'pendente'; END IF;
  IF v IN ('trancado','suspenso','desistente','inativo') THEN RETURN 'inativo'; END IF;
  RETURN 'indefinido';
END
$$;

COMMIT;
