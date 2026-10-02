-- Regression: REM-GR-003 — retenção repete a mesma classe e não progride.
DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef('public.preparar_aluno_para_rematricula(uuid,uuid,uuid,uuid,uuid)'::regprocedure)
    INTO v_def;
  IF position('v_decision = ''retido''' in v_def) = 0
     OR position('''mesma_etapa''' in v_def) = 0 THEN
    RAISE EXCEPTION 'REM-GR-003: preparar não permite retenção na mesma etapa';
  END IF;
  IF position('FROM public.mensalidades' in v_def) > 0 THEN
    RAISE EXCEPTION 'REM-GR-003: reserva ainda está bloqueada por dívida';
  END IF;
  IF position('retido_por_faltas' in v_def) > 0
     OR position('retido_por_indisciplina' in v_def) > 0 THEN
    RAISE EXCEPTION 'REM-GR-003: preparar automatiza uma retenção excepcional';
  END IF;

  SELECT pg_get_functiondef('public.finalizar_rematricula_balcao(uuid,uuid,uuid,uuid,uuid,uuid)'::regprocedure)
    INTO v_def;
  IF position('aluno retido deve repetir a mesma classe' in v_def) = 0 THEN
    RAISE EXCEPTION 'REM-GR-003: balcão não força a mesma classe';
  END IF;
  IF position('CASE WHEN v_retido THEN ''reprovado'' ELSE ''concluido'' END' in v_def) = 0 THEN
    RAISE EXCEPTION 'REM-GR-003: balcão perde o resultado histórico reprovado';
  END IF;

  SELECT pg_get_functiondef('public.rematricula_em_massa(uuid,uuid,uuid)'::regprocedure)
    INTO v_def;
  IF position('v_retido := v_decision = ''retido''' in v_def) = 0
     OR position('v_expected_number := CASE WHEN v_retido THEN v_source_number ELSE v_source_number + 1 END' in v_def) = 0 THEN
    RAISE EXCEPTION 'REM-GR-003: lote não mantém retido na mesma classe';
  END IF;

  SELECT pg_get_functiondef('public.aluno_iniciar_rematricula(uuid,uuid[])'::regprocedure)
    INTO v_def;
  IF position('WHEN v_retido THEN v_classe_origem_numero' in v_def) = 0
     OR position('''mesma_etapa''' in v_def) = 0 THEN
    RAISE EXCEPTION 'REM-GR-003: portal não calcula repetição na mesma classe';
  END IF;

  IF to_regprocedure('public.aluno_confirmar_rematricula(uuid)') IS NOT NULL
     AND has_function_privilege('authenticated', 'public.aluno_confirmar_rematricula(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'REM-GR-003: RPC legado de confirmação continua exposto a authenticated';
  END IF;
END;
$$;
