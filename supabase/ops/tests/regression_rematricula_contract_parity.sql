-- Regression: rematrícula deve manter paridade entre portal, balcão e lote.
DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public'
    AND p.proname='prevent_rematricula_grant_with_origin_debt'
    AND pg_get_function_identity_arguments(p.oid)='';

  IF position('data_vencimento < CURRENT_DATE' in v_def) = 0 THEN
    RAISE EXCEPTION 'rematricula regression: trigger still blocks future charges';
  END IF;

  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public'
    AND p.proname='aluno_iniciar_rematricula'
    AND pg_get_function_identity_arguments(p.oid)='p_matricula_id uuid, p_servicos_ids uuid[]';

  IF position('data_vencimento < CURRENT_DATE' in v_def) = 0 THEN
    RAISE EXCEPTION 'rematricula regression: portal RPC still blocks future charges';
  END IF;

  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public'
    AND p.proname='rematricula_em_massa'
    AND pg_get_function_identity_arguments(p.oid)='p_escola_id uuid, p_origem_turma_id uuid, p_destino_turma_id uuid';

  IF position('data_vencimento < CURRENT_DATE' in v_def) = 0 THEN
    RAISE EXCEPTION 'rematricula regression: bulk still blocks future charges';
  END IF;
  IF position('efetivacao_matricula_bloqueada' in v_def) = 0
     OR position('inscricao_condicional' in v_def) = 0
     OR position('proxima_etapa' in v_def) = 0 THEN
    RAISE EXCEPTION 'rematricula regression: bulk conditional guard missing';
  END IF;
  IF position('CASE WHEN v_retido THEN ''reprovado'' ELSE ''concluido'' END' in v_def) = 0 THEN
    RAISE EXCEPTION 'rematricula regression: annual progression still loses historical result';
  END IF;
END;
$$;
