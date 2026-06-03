BEGIN;

DO $$
DECLARE
  v_escola_id uuid := gen_random_uuid();
  v_secretaria_id uuid := gen_random_uuid();
  v_admin_id uuid := gen_random_uuid();
  v_diretor_id uuid := gen_random_uuid();
  v_curso_id uuid := gen_random_uuid();
  v_classe_id uuid := gen_random_uuid();
  v_ano_letivo_id uuid := gen_random_uuid();
  v_curriculo_id uuid := gen_random_uuid();
  v_disciplina_id uuid := gen_random_uuid();
  v_turma_id uuid := gen_random_uuid();
  v_cand_1 uuid := gen_random_uuid();
  v_cand_2 uuid := gen_random_uuid();
  v_cand_3 uuid := gen_random_uuid();
  v_result jsonb;
  v_error text;
  v_count integer;
  v_status_metadata jsonb;
BEGIN
  INSERT INTO auth.users (
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  VALUES
    (v_secretaria_id, 'authenticated', 'authenticated', 'admissoes-secretaria-test@klasse.local', crypt('password', gen_salt('bf')), now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_admin_id, 'authenticated', 'authenticated', 'admissoes-admin-test@klasse.local', crypt('password', gen_salt('bf')), now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_diretor_id, 'authenticated', 'authenticated', 'admissoes-diretor-test@klasse.local', crypt('password', gen_salt('bf')), now(), '{}'::jsonb, '{}'::jsonb, now(), now());

  INSERT INTO public.escolas (id, nome, slug, status, onboarding_finalizado, plano_atual)
  VALUES (v_escola_id, 'KLASSE Teste Hard Gate', 'klasse-hard-gate-test', 'ativa', true, 'essencial');

  INSERT INTO public.escola_users (escola_id, user_id, papel, role)
  VALUES
    (v_escola_id, v_secretaria_id, 'secretaria', 'member'),
    (v_escola_id, v_admin_id, 'admin_escola', 'admin'),
    (v_escola_id, v_diretor_id, 'diretor', 'admin');

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', v_admin_id::text,
      'role', 'authenticated',
      'escola_id', v_escola_id::text,
      'app_metadata', jsonb_build_object('escola_id', v_escola_id::text)
    )::text,
    true
  );

  INSERT INTO public.anos_letivos (id, escola_id, ano, data_inicio, data_fim, ativo, descricao)
  VALUES (v_ano_letivo_id, v_escola_id, 2026, '2026-01-01', '2026-12-31', true, 'Ano teste hard gate');

  INSERT INTO public.cursos (id, escola_id, codigo, nome, tipo, nivel)
  VALUES (v_curso_id, v_escola_id, 'TST-HG', 'Curso Teste Hard Gate', 'regular', 'basico');

  INSERT INTO public.classes (id, escola_id, curso_id, nome, numero, nivel)
  VALUES (v_classe_id, v_escola_id, v_curso_id, '7 Classe Teste', 7, 'basico');

  INSERT INTO public.disciplinas_catalogo (id, escola_id, nome, sigla, is_core, is_avaliavel)
  VALUES (v_disciplina_id, v_escola_id, 'Matematica Teste', 'MAT', true, true);

  INSERT INTO public.curso_curriculos (
    id,
    escola_id,
    curso_id,
    ano_letivo_id,
    version,
    status,
    classe_id,
    created_by
  )
  VALUES (v_curriculo_id, v_escola_id, v_curso_id, v_ano_letivo_id, 1, 'published', v_classe_id, v_admin_id);

  INSERT INTO public.curso_matriz (
    escola_id,
    curso_id,
    classe_id,
    disciplina_id,
    curso_curriculo_id,
    carga_horaria,
    carga_horaria_semanal,
    classificacao,
    ativo
  )
  VALUES (v_escola_id, v_curso_id, v_classe_id, v_disciplina_id, v_curriculo_id, 4, 4, 'core', true);

  INSERT INTO public.turmas (
    id,
    escola_id,
    curso_id,
    classe_id,
    nome,
    ano_letivo,
    turno,
    capacidade_maxima
  )
  VALUES (v_turma_id, v_escola_id, v_curso_id, v_classe_id, 'Turma Capacidade 1', 2026, 'M', 1);

  INSERT INTO public.financeiro_tabelas (
    id,
    escola_id,
    ano_letivo,
    curso_id,
    classe_id,
    valor_matricula,
    valor_mensalidade
  )
  VALUES (gen_random_uuid(), v_escola_id, 2026, v_curso_id, v_classe_id, 1000, 5000);

  INSERT INTO public.candidaturas (
    id,
    escola_id,
    curso_id,
    classe_id,
    ano_letivo,
    status,
    turma_preferencial_id,
    nome_candidato,
    dados_candidato,
    source,
    protocolo_publico
  )
  VALUES
    (
      v_cand_1,
      v_escola_id,
      v_curso_id,
      v_classe_id,
      2026,
      'aprovada',
      v_turma_id,
      'Candidato Um',
      jsonb_build_object(
        'nome_completo', 'Candidato Um',
        'tipo_documento', 'BI',
        'numero_documento', 'HGTEST0001',
        'bi_numero', 'HGTEST0001',
        'telefone', '923000000',
        'data_nascimento', '2010-01-01',
        'responsavel_nome', 'Responsavel Teste',
        'responsavel_contato', '923000001',
        'turma_preferencial_id', v_turma_id::text
      ),
      'REGRESSION_TEST',
      'TST-' || upper(replace(v_cand_1::text, '-', ''))
    ),
    (
      v_cand_2,
      v_escola_id,
      v_curso_id,
      v_classe_id,
      2026,
      'aprovada',
      v_turma_id,
      'Candidato Dois',
      jsonb_build_object(
        'nome_completo', 'Candidato Dois',
        'tipo_documento', 'BI',
        'numero_documento', 'HGTEST0002',
        'bi_numero', 'HGTEST0002',
        'telefone', '923000000',
        'data_nascimento', '2010-01-01',
        'responsavel_nome', 'Responsavel Teste',
        'responsavel_contato', '923000001',
        'turma_preferencial_id', v_turma_id::text
      ),
      'REGRESSION_TEST',
      'TST-' || upper(replace(v_cand_2::text, '-', ''))
    ),
    (
      v_cand_3,
      v_escola_id,
      v_curso_id,
      v_classe_id,
      2026,
      'aprovada',
      v_turma_id,
      'Candidato Tres',
      jsonb_build_object(
        'nome_completo', 'Candidato Tres',
        'tipo_documento', 'BI',
        'numero_documento', 'HGTEST0003',
        'bi_numero', 'HGTEST0003',
        'telefone', '923000000',
        'data_nascimento', '2010-01-01',
        'responsavel_nome', 'Responsavel Teste',
        'responsavel_contato', '923000001',
        'turma_preferencial_id', v_turma_id::text
      ),
      'REGRESSION_TEST',
      'TST-' || upper(replace(v_cand_3::text, '-', ''))
    );

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', v_secretaria_id::text,
      'role', 'authenticated',
      'escola_id', v_escola_id::text,
      'app_metadata', jsonb_build_object('escola_id', v_escola_id::text)
    )::text,
    true
  );

  SELECT public.admissao_finalizar_matricula(
    v_escola_id,
    v_cand_1,
    v_turma_id,
    jsonb_build_object('metodo_pagamento', 'cash'),
    'hard-gate-' || v_cand_1::text,
    'Teste hard gate capacidade 1',
    false,
    null
  )
  INTO v_result;

  IF coalesce((v_result->>'ok')::boolean, false) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Primeira matricula deveria passar. Resultado: %', v_result;
  END IF;

  SELECT count(*)
  INTO v_count
  FROM public.matriculas
  WHERE escola_id = v_escola_id
    AND turma_id = v_turma_id
    AND lower(coalesce(status, '')) IN ('ativa', 'ativo', 'active');

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Esperado 1 matricula ativa antes do hard gate, obtido %.', v_count;
  END IF;

  BEGIN
    PERFORM public.admissao_finalizar_matricula(
      v_escola_id,
      v_cand_2,
      v_turma_id,
      jsonb_build_object('metodo_pagamento', 'cash'),
      'hard-gate-' || v_cand_2::text,
      'Teste hard gate lotado',
      false,
      null
    );
    RAISE EXCEPTION 'Segunda matricula sem override deveria falhar por capacidade.';
  EXCEPTION WHEN others THEN
    v_error := SQLERRM;
    IF v_error NOT ILIKE '%TURMA_LOTADA_CAPACIDADE%' THEN
      RAISE EXCEPTION 'Erro esperado TURMA_LOTADA_CAPACIDADE, obtido: %', v_error;
    END IF;
  END;

  BEGIN
    PERFORM public.admissao_finalizar_matricula(
      v_escola_id,
      v_cand_2,
      v_turma_id,
      jsonb_build_object('metodo_pagamento', 'cash'),
      'hard-gate-secretaria-override-' || v_cand_2::text,
      'Teste override secretaria',
      true,
      'Motivo de teste com tamanho suficiente'
    );
    RAISE EXCEPTION 'Secretaria normal nao deveria conseguir override.';
  EXCEPTION WHEN others THEN
    v_error := SQLERRM;
    IF v_error NOT ILIKE '%Override de capacidade não autorizado%' THEN
      RAISE EXCEPTION 'Erro esperado override nao autorizado, obtido: %', v_error;
    END IF;
  END;

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', v_admin_id::text,
      'role', 'authenticated',
      'escola_id', v_escola_id::text,
      'app_metadata', jsonb_build_object('escola_id', v_escola_id::text)
    )::text,
    true
  );

  SELECT public.admissao_finalizar_matricula(
    v_escola_id,
    v_cand_2,
    v_turma_id,
    jsonb_build_object('metodo_pagamento', 'cash'),
    'hard-gate-admin-override-' || v_cand_2::text,
    'Teste override admin',
    true,
    'Direcao autorizou excecao documentada'
  )
  INTO v_result;

  IF coalesce((v_result->>'override_capacidade')::boolean, false) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Override admin deveria retornar override_capacidade=true. Resultado: %', v_result;
  END IF;

  SELECT count(*)
  INTO v_count
  FROM public.audit_logs
  WHERE escola_id = v_escola_id
    AND (
      action = 'ADMISSAO_CAPACIDADE_OVERRIDE'
      OR acao = 'ADMISSAO_CAPACIDADE_OVERRIDE'
    );

  IF v_count < 1 THEN
    RAISE EXCEPTION 'Audit log ADMISSAO_CAPACIDADE_OVERRIDE nao encontrado.';
  END IF;

  SELECT metadata
  INTO v_status_metadata
  FROM public.candidaturas_status_log
  WHERE candidatura_id = v_cand_2
    AND escola_id = v_escola_id
    AND metadata @> jsonb_build_object('override_capacidade', true)
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_status_metadata IS NULL
    OR v_status_metadata->>'override_motivo' <> 'Direcao autorizou excecao documentada' THEN
    RAISE EXCEPTION 'Metadata de status log de override nao encontrada ou invalida: %', v_status_metadata;
  END IF;

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', v_diretor_id::text,
      'role', 'authenticated',
      'escola_id', v_escola_id::text,
      'app_metadata', jsonb_build_object('escola_id', v_escola_id::text)
    )::text,
    true
  );

  SELECT public.admissao_finalizar_matricula(
    v_escola_id,
    v_cand_3,
    v_turma_id,
    jsonb_build_object('metodo_pagamento', 'cash'),
    'hard-gate-diretor-override-' || v_cand_3::text,
    'Teste override diretor',
    true,
    'Diretor autorizou excecao documentada'
  )
  INTO v_result;

  IF coalesce((v_result->>'override_capacidade')::boolean, false) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Override diretor deveria passar. Resultado: %', v_result;
  END IF;

  RAISE NOTICE 'PASS admissoes capacidade hard gate: normal bloqueia, secretaria falha override, admin/diretor passam, audit/status metadata ok.';
END $$;

ROLLBACK;
