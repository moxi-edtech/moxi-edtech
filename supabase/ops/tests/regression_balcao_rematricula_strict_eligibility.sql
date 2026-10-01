-- Regression: a rematrícula obedece ao RAA e não aceita bypass manual.
-- Progressão regular e inscrição condicional efetivável podem avançar.
-- Recurso, pendência, retenção, conclusão e inscrição condicional bloqueada
-- permanecem fora do fluxo de efetivação. Saldo aberto continua bloqueando.

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
    RAISE EXCEPTION 'RAA rematricula regression: Balcao RPC not found';
  END IF;

  IF position('v_decision NOT IN (''transitou'', ''inscricao_condicional'')' in v_def) = 0 THEN
    RAISE EXCEPTION 'RAA rematricula regression: Balcao allowed-decision guard missing';
  END IF;

  IF position('efetivacao_matricula_bloqueada' in v_def) = 0 THEN
    RAISE EXCEPTION 'RAA rematricula regression: Balcao conditional activation guard missing';
  END IF;

  IF position('v_decision = ''inscricao_condicional''' in v_def) = 0
     OR position('proxima_etapa' in v_def) = 0 THEN
    RAISE EXCEPTION 'RAA rematricula regression: Balcao conditional destination guard missing';
  END IF;

  IF position('REMATRICULA_ACADEMIC_BLOCKED' in v_def) = 0 THEN
    RAISE EXCEPTION 'RAA rematricula regression: Balcao canonical academic error missing';
  END IF;

  IF position('v_numero_destino <> v_numero_origem + 1' in v_def) = 0 THEN
    RAISE EXCEPTION 'RAA rematricula regression: next-stage progression guard missing';
  END IF;

  IF position('CASE WHEN v_reprovado' in v_def) > 0 THEN
    RAISE EXCEPTION 'RAA rematricula regression: retained-student destination fallback returned';
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
    RAISE EXCEPTION 'RAA rematricula regression: student RPC not found';
  END IF;

  IF position('NOT IN (''transitou'', ''inscricao_condicional'')' in v_def) = 0 THEN
    RAISE EXCEPTION 'RAA rematricula regression: student RPC allowed-decision guard missing';
  END IF;

  IF position('efetivacao_matricula_bloqueada' in v_def) = 0
     OR position('proxima_etapa' in v_def) = 0 THEN
    RAISE EXCEPTION 'RAA rematricula regression: student conditional activation guard missing';
  END IF;

  IF position('REMATRICULA_ACADEMIC_BLOCKED' in v_def) = 0 THEN
    RAISE EXCEPTION 'RAA rematricula regression: student RPC academic error missing';
  END IF;

  IF position('REMATRICULA_DEBT_REQUIRED' in v_def) = 0 THEN
    RAISE EXCEPTION 'RAA rematricula regression: student RPC zero-debt guard missing';
  END IF;

  IF position('mesma_etapa' in v_def) > 0 THEN
    RAISE EXCEPTION 'RAA rematricula regression: student RPC same-stage fallback returned';
  END IF;
END;
$$;

ROLLBACK;
