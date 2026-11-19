-- Calendário de avaliações: só aceitar turmas ativas no ano letivo corrente.
-- Não altera, desarquiva nem elimina turmas, notas ou eventos históricos.
-- Permite cancelar eventos previamente criados mesmo que a turma seja arquivada.
CREATE OR REPLACE FUNCTION public.calendario_avaliacoes_turma_ativa_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.estado = 'cancelado' THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.turmas AS t
      JOIN public.anos_letivos AS a
        ON a.id = t.ano_letivo_id
       AND a.escola_id = t.escola_id
     WHERE t.id = NEW.turma_id
       AND t.escola_id = NEW.escola_id
       AND t.ano_letivo_id = NEW.ano_letivo_id
       AND t.session_id = NEW.ano_letivo_id
       AND t.status_validacao = 'ativo'
       AND a.ativo IS TRUE
  ) THEN
    RAISE EXCEPTION 'CALENDARIO_TURMA_INATIVA_OU_ANO_INCORRETO'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.calendario_avaliacoes_turma_ativa_guard()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_calendario_avaliacoes_turma_ativa
  ON public.calendario_avaliacoes;

CREATE TRIGGER trg_calendario_avaliacoes_turma_ativa
BEFORE INSERT OR UPDATE ON public.calendario_avaliacoes
FOR EACH ROW
EXECUTE FUNCTION public.calendario_avaliacoes_turma_ativa_guard();