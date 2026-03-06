-- Regression test: lancar_notas_batch accepts matriculas with ativo = true
-- regardless of legacy status variants (ativo/ativa/pendente).

BEGIN;

DO $$
DECLARE
  v_escola_id uuid := gen_random_uuid();
  v_user_id uuid := gen_random_uuid();
  v_curso_id uuid := gen_random_uuid();
  v_classe_id uuid := gen_random_uuid();
  v_disciplina_id uuid := gen_random_uuid();
  v_matriz_id uuid := gen_random_uuid();
  v_turma_id uuid := gen_random_uuid();
  v_turma_disciplina_id uuid := gen_random_uuid();
  v_ano_letivo int := 2024;
  v_ano_letivo_id uuid := gen_random_uuid();
  v_periodo_id uuid := gen_random_uuid();
  v_aluno1 uuid := gen_random_uuid();
  v_aluno2 uuid := gen_random_uuid();
  v_aluno3 uuid := gen_random_uuid();
  v_matricula1 uuid := gen_random_uuid();
  v_matricula2 uuid := gen_random_uuid();
  v_matricula3 uuid := gen_random_uuid();
  v_result jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_id)::text, true);

  INSERT INTO public.escolas (id, nome, status, onboarding_finalizado)
  VALUES (v_escola_id, 'Escola Teste', 'ativa', true);

  INSERT INTO public.profiles (user_id, email, nome, role, escola_id, current_escola_id)
  VALUES (v_user_id, 'tester@example.com', 'Tester', 'admin', v_escola_id, v_escola_id);

  INSERT INTO public.escola_users (escola_id, user_id, papel)
  VALUES (v_escola_id, v_user_id, 'admin_escola');

  INSERT INTO public.anos_letivos (id, escola_id, ano, data_inicio, data_fim, ativo)
  VALUES (v_ano_letivo_id, v_escola_id, v_ano_letivo, '2024-01-01', '2024-12-31', true);

  INSERT INTO public.periodos_letivos (id, escola_id, ano_letivo_id, tipo, numero, data_inicio, data_fim)
  VALUES (v_periodo_id, v_escola_id, v_ano_letivo_id, 'TRIMESTRE', 1, '2024-01-01', '2024-03-31');

  INSERT INTO public.cursos (id, escola_id, codigo, nome)
  VALUES (v_curso_id, v_escola_id, 'TST', 'Curso Teste');

  INSERT INTO public.classes (id, escola_id, nome, curso_id)
  VALUES (v_classe_id, v_escola_id, '1ª Classe', v_curso_id);

  INSERT INTO public.disciplinas_catalogo (id, escola_id, nome)
  VALUES (v_disciplina_id, v_escola_id, 'Matemática');

  INSERT INTO public.curso_matriz (id, escola_id, curso_id, classe_id, disciplina_id)
  VALUES (v_matriz_id, v_escola_id, v_curso_id, v_classe_id, v_disciplina_id);

  INSERT INTO public.turmas (id, escola_id, curso_id, classe_id, ano_letivo, nome, turno, status_validacao)
  VALUES (v_turma_id, v_escola_id, v_curso_id, v_classe_id, v_ano_letivo, 'A', 'M', 'ativo');

  INSERT INTO public.turma_disciplinas (id, escola_id, turma_id, curso_matriz_id)
  VALUES (v_turma_disciplina_id, v_escola_id, v_turma_id, v_matriz_id);

  INSERT INTO public.alunos (id, escola_id, nome)
  VALUES (v_aluno1, v_escola_id, 'Aluno Ativo'),
         (v_aluno2, v_escola_id, 'Aluno Ativa'),
         (v_aluno3, v_escola_id, 'Aluno Pendente');

  INSERT INTO public.matriculas (id, escola_id, aluno_id, turma_id, ano_letivo, status, ativo)
  VALUES
    (v_matricula1, v_escola_id, v_aluno1, v_turma_id, v_ano_letivo, 'ativo', true),
    (v_matricula2, v_escola_id, v_aluno2, v_turma_id, v_ano_letivo, 'ativa', true),
    (v_matricula3, v_escola_id, v_aluno3, v_turma_id, v_ano_letivo, 'pendente', true);

  SELECT public.lancar_notas_batch(
    v_escola_id,
    v_turma_id,
    v_disciplina_id,
    v_turma_disciplina_id,
    1,
    'MAC',
    jsonb_build_array(
      jsonb_build_object('aluno_id', v_aluno1, 'valor', 14),
      jsonb_build_object('aluno_id', v_aluno2, 'valor', 12),
      jsonb_build_object('aluno_id', v_aluno3, 'valor', 10)
    )
  ) INTO v_result;

  IF (v_result->>'inserted')::int <> 3 THEN
    RAISE EXCEPTION 'Teste falhou: esperado 3 notas inseridas, obtido %', v_result->>'inserted';
  END IF;
END $$;

ROLLBACK;
