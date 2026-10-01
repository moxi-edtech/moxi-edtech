-- Regression: rematrícula normal exige aprovação RAA fechada e saldo aberto zero.
-- Protege tanto o Balcão quanto a RPC do Portal do Aluno contra a reintrodução
-- do antigo fallback de retenção/notas pendentes.

BEGIN;

DO $$
DECLARE
  v_oid oid;
  v_def text;
BEGIN
  SELECT p.oid, pg_get_functiondef(p.oid)
    INTO v_oid, v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'finalizar_rematricula_balcao'
    AND pg_get_function_identity_arguments(p.oid) =
      'p_escola_id uuid, p_aluno_id uuid, p_matricula_origem_id uuid, p_ano_letivo_id uuid, p_destino_turma_id uuid, p_pedido_id uuid';

  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'strict rematricula regression: Balcao RPC not found';
  END IF;

  IF position('v_decision <> ''transitou''' in v_def) = 0 THEN
    RAISE EXCEPTION 'strict rematricula regression: Balcao approved-only RAA guard missing';
  END IF;

  IF position('REMATRICULA_ACADEMIC_NOT_APPROVED' in v_def) = 0 THEN
    RAISE EXCEPTION 'strict rematricula regression: Balcao academic error missing';
  END IF;

  IF position('v_numero_destino <> v_numero_origem + 1' in v_def) = 0 THEN
    RAISE EXCEPTION 'strict rematricula regression: sequential approved progression guard missing';
  END IF;

  IF position('CASE WHEN v_reprovado' in v_def) > 0 THEN
    RAISE EXCEPTION 'strict rematricula regression: retained-student destination fallback returned';
  END IF;
END;
$$;

DO $$
DECLARE
  v_oid oid;
  v_def text;
BEGIN
  SELECT p.oid, pg_get_functiondef(p.oid)
    INTO v_oid, v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'aluno_iniciar_rematricula'
    AND pg_get_function_identity_arguments(p.oid) =
      'p_matricula_id uuid, p_servicos_ids uuid[]';

  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'strict rematricula regression: student RPC not found';
  END IF;

  IF position('<> ''transitou''' in v_def) = 0 THEN
    RAISE EXCEPTION 'strict rematricula regression: student RPC approved-only guard missing';
  END IF;

  IF position('REMATRICULA_ACADEMIC_NOT_APPROVED' in v_def) = 0 THEN
    RAISE EXCEPTION 'strict rematricula regression: student RPC academic error missing';
  END IF;

  IF position('REMATRICULA_DEBT_REQUIRED' in v_def) = 0 THEN
    RAISE EXCEPTION 'strict rematricula regression: student RPC zero-debt guard missing';
  END IF;

  IF position('mesma_etapa' in v_def) > 0 THEN
    RAISE EXCEPTION 'strict rematricula regression: student RPC same-stage fallback returned';
  END IF;
END;
$$;

ROLLBACK;
