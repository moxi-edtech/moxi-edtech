BEGIN;

-- Uma mensalidade só nasce de uma matrícula activa e só pode cobrir o período
-- financeiro dessa matrícula. O vínculo é resolvido aqui também para os
-- geradores legados que ainda não enviam matricula_id.
CREATE OR REPLACE FUNCTION public.enforce_mensalidade_matricula_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_matricula record;
  v_ano_letivo int;
  v_periodo_inicio date;
  v_periodo_fim date;
  v_inicio_cobranca date;
  v_competencia date;
BEGIN
  -- Linhas antigas/importadas sem turma continuam compatíveis; cobranças
  -- mensais operacionais, porém, precisam de uma matrícula identificável.
  IF NEW.matricula_id IS NULL AND NEW.turma_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.matricula_id IS NULL THEN
    IF NEW.ano_letivo IS NULL OR NEW.ano_letivo !~ '^[0-9]+$' THEN
      RAISE EXCEPTION 'Mensalidade sem ano letivo não pode ser associada a uma matrícula';
    END IF;

    SELECT m.*
      INTO v_matricula
    FROM public.matriculas m
    WHERE m.escola_id = NEW.escola_id
      AND m.aluno_id = NEW.aluno_id
      AND m.turma_id = NEW.turma_id
      AND m.ano_letivo = NEW.ano_letivo::int
      AND lower(coalesce(m.status, '')) IN ('ativo', 'ativa', 'active')
    ORDER BY coalesce(m.data_inicio_financeiro, m.data_matricula, m.created_at::date) DESC, m.created_at DESC
    LIMIT 1;

    IF v_matricula.id IS NULL THEN
      RAISE EXCEPTION 'Mensalidade sem matrícula activa para o aluno %, turma % e ano %', NEW.aluno_id, NEW.turma_id, NEW.ano_letivo;
    END IF;
    NEW.matricula_id := v_matricula.id;
  ELSE
    SELECT m.* INTO v_matricula
    FROM public.matriculas m
    WHERE m.id = NEW.matricula_id;
    IF v_matricula.id IS NULL THEN
      RAISE EXCEPTION 'Matrícula da mensalidade não encontrada: %', NEW.matricula_id;
    END IF;
  END IF;

  IF v_matricula.escola_id <> NEW.escola_id
     OR v_matricula.aluno_id <> NEW.aluno_id
     OR (NEW.turma_id IS NOT NULL AND v_matricula.turma_id IS DISTINCT FROM NEW.turma_id) THEN
    RAISE EXCEPTION 'Mensalidade não pertence à matrícula informada';
  END IF;

  IF lower(coalesce(v_matricula.status, '')) NOT IN ('ativo', 'ativa', 'active') THEN
    RAISE EXCEPTION 'Não é permitido lançar mensalidade para matrícula não activa (%)', v_matricula.status;
  END IF;

  IF NEW.ano_letivo IS NOT NULL
     AND (NEW.ano_letivo !~ '^[0-9]+$' OR NEW.ano_letivo::int <> v_matricula.ano_letivo) THEN
    RAISE EXCEPTION 'Ano letivo da mensalidade não corresponde à matrícula';
  END IF;

  NEW.turma_id := coalesce(NEW.turma_id, v_matricula.turma_id);
  NEW.ano_letivo := v_matricula.ano_letivo::text;
  v_ano_letivo := v_matricula.ano_letivo;

  SELECT al.data_inicio, al.data_fim
    INTO v_periodo_inicio, v_periodo_fim
  FROM public.anos_letivos al
  WHERE al.escola_id = v_matricula.escola_id
    AND al.ano = v_ano_letivo
  ORDER BY al.ativo DESC, al.created_at DESC
  LIMIT 1;

  IF NEW.mes_referencia IS NULL OR NEW.ano_referencia IS NULL
     OR NEW.mes_referencia NOT BETWEEN 1 AND 12 THEN
    RAISE EXCEPTION 'Competência de mensalidade inválida';
  END IF;

  v_competencia := make_date(NEW.ano_referencia, NEW.mes_referencia, 1);
  IF v_periodo_inicio IS NOT NULL AND v_periodo_fim IS NOT NULL
     AND (v_competencia < date_trunc('month', v_periodo_inicio)::date
       OR v_competencia > date_trunc('month', v_periodo_fim)::date) THEN
    RAISE EXCEPTION 'Competência %/% fora do calendário do ano letivo %', NEW.mes_referencia, NEW.ano_referencia, v_ano_letivo;
  END IF;

  v_inicio_cobranca := date_trunc(
    'month',
    greatest(
      coalesce(v_periodo_inicio, make_date(v_ano_letivo, 1, 1)),
      coalesce(v_matricula.data_inicio_financeiro, v_matricula.data_matricula, v_matricula.created_at::date)
    )
  )::date;
  IF v_competencia < v_inicio_cobranca THEN
    RAISE EXCEPTION 'Mensalidade anterior à entrada financeira do aluno (%)', v_inicio_cobranca;
  END IF;

  NEW.aluno_id := v_matricula.aluno_id;
  NEW.escola_id := v_matricula.escola_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_mensalidade_matricula_scope ON public.mensalidades;
CREATE TRIGGER trg_validate_mensalidade_matricula_scope
BEFORE INSERT OR UPDATE OF escola_id, aluno_id, turma_id, matricula_id, ano_letivo, mes_referencia, ano_referencia
ON public.mensalidades
FOR EACH ROW
EXECUTE FUNCTION public.enforce_mensalidade_matricula_scope();

COMMIT;
