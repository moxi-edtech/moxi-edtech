BEGIN;

DO $$
DECLARE
  v_escola_a uuid := '00000000-0000-0000-0000-000000001001';
  v_escola_b uuid := '00000000-0000-0000-0000-000000001002';
  v_secretaria uuid := '00000000-0000-0000-0000-000000001101';
  v_prof_user uuid := '00000000-0000-0000-0000-000000001102';
  v_rogue_user uuid := '00000000-0000-0000-0000-000000001103';
  v_other_staff uuid := '00000000-0000-0000-0000-000000001104';
  v_prof_id uuid := '00000000-0000-0000-0000-000000001201';
  v_year uuid := '00000000-0000-0000-0000-000000001301';
  v_period uuid := '00000000-0000-0000-0000-000000001302';
  v_turma uuid := '00000000-0000-0000-0000-000000001401';
  v_disc uuid := '00000000-0000-0000-0000-000000001501';
  v_matriz uuid := '00000000-0000-0000-0000-000000001502';
  v_td uuid := '00000000-0000-0000-0000-000000001503';
  v_aluno uuid := '00000000-0000-0000-0000-000000001601';
  v_aluno_inativo uuid := '00000000-0000-0000-0000-000000001602';
  v_mat uuid := '00000000-0000-0000-0000-000000001701';
  v_mat_inativa uuid := '00000000-0000-0000-0000-000000001702';
  v_result jsonb;
  v_nota_max numeric;
BEGIN
  INSERT INTO public.escola_users (escola_id, user_id, papel) VALUES
    (v_escola_a, v_secretaria, 'secretaria'),
    (v_escola_a, v_prof_user, 'professor'),
    (v_escola_b, v_other_staff, 'secretaria');

  INSERT INTO public.professores (id, escola_id, profile_id)
  VALUES (v_prof_id, v_escola_a, v_prof_user);

  INSERT INTO public.anos_letivos (id, escola_id, ano, ativo)
  VALUES (v_year, v_escola_a, 2026, true);

  INSERT INTO public.periodos_letivos (id, escola_id, ano_letivo_id, tipo, numero)
  VALUES (v_period, v_escola_a, v_year, 'TRIMESTRE', 1);

  INSERT INTO public.turmas (id, escola_id, session_id, ano_letivo, status_fecho, nivel_ensino)
  VALUES (v_turma, v_escola_a, v_year, 2026, 'ABERTO', 'primario');

  INSERT INTO public.disciplinas_catalogo (id, escola_id, nome)
  VALUES (v_disc, v_escola_a, 'Matemática');

  INSERT INTO public.curso_matriz (id, escola_id, disciplina_id)
  VALUES (v_matriz, v_escola_a, v_disc);

  INSERT INTO public.turma_disciplinas (id, escola_id, turma_id, curso_matriz_id, professor_id)
  VALUES (v_td, v_escola_a, v_turma, v_matriz, v_prof_id);

  INSERT INTO public.alunos (id, escola_id, nome) VALUES
    (v_aluno, v_escola_a, 'Aluno Ativo'),
    (v_aluno_inativo, v_escola_a, 'Aluno Inativo');

  INSERT INTO public.matriculas (id, escola_id, aluno_id, turma_id, session_id, ano_letivo, status, ativo) VALUES
    (v_mat, v_escola_a, v_aluno, v_turma, v_year, 2026, 'ativo', true),
    (v_mat_inativa, v_escola_a, v_aluno_inativo, v_turma, v_year, 2026, 'concluido', false);

  -- Unauthenticated / unrelated users cannot call the SECURITY DEFINER writer.
  PERFORM set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_rogue_user, 'escola_id', v_escola_a, 'role', 'authenticated'
  )::text, true);
  BEGIN
    PERFORM public.lancar_notas_batch(
      v_escola_a, v_turma, v_disc, v_td, 1, 'MAC',
      jsonb_build_array(jsonb_build_object('aluno_id', v_aluno, 'valor', 8)), false
    );
    RAISE EXCEPTION 'TEST: utilizador sem papel conseguiu lançar nota';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'TEST:%' OR SQLERRM NOT LIKE 'AUTH:%' THEN RAISE; END IF;
  END;

  -- A role in another school cannot cross the active tenant boundary.
  PERFORM set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_other_staff, 'escola_id', v_escola_b, 'role', 'authenticated'
  )::text, true);
  BEGIN
    PERFORM public.lancar_notas_batch(
      v_escola_a, v_turma, v_disc, v_td, 1, 'MAC',
      jsonb_build_array(jsonb_build_object('aluno_id', v_aluno, 'valor', 8)), false
    );
    RAISE EXCEPTION 'TEST: cross-tenant conseguiu lançar nota';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'TEST:%' OR SQLERRM NOT LIKE 'AUTH:%' THEN RAISE; END IF;
  END;

  -- Assigned professor can write inside the active tenant.
  PERFORM set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_prof_user, 'escola_id', v_escola_a, 'role', 'authenticated'
  )::text, true);
  SELECT public.lancar_notas_batch(
    v_escola_a, v_turma, v_disc, v_td, 1, 'MAC',
    jsonb_build_array(jsonb_build_object('aluno_id', v_aluno, 'valor', 8)), false
  ) INTO v_result;

  IF COALESCE((v_result->>'inserted')::int, 0) <> 1 THEN
    RAISE EXCEPTION 'TEST: professor atribuído não inseriu a nota';
  END IF;

  -- Primary scale is 0-10; 11 must be rejected by the RPC itself.
  BEGIN
    PERFORM public.lancar_notas_batch(
      v_escola_a, v_turma, v_disc, v_td, 1, 'NPP',
      jsonb_build_array(jsonb_build_object('aluno_id', v_aluno, 'valor', 11)), false
    );
    RAISE EXCEPTION 'TEST: escala primária aceitou nota acima de 10';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'TEST:%' OR SQLERRM NOT LIKE 'DATA:%entre 0 e 10%' THEN RAISE; END IF;
  END;

  -- Inactive/historical enrollment cannot receive a new current-year grade.
  BEGIN
    PERFORM public.lancar_notas_batch(
      v_escola_a, v_turma, v_disc, v_td, 1, 'MAC',
      jsonb_build_array(jsonb_build_object('aluno_id', v_aluno_inativo, 'valor', 7)), false
    );
    RAISE EXCEPTION 'TEST: matrícula inativa recebeu nota';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'TEST:%' OR SQLERRM NOT LIKE 'DATA:%matrícula ativa%' THEN RAISE; END IF;
  END;

  -- Secretaria uses the same canonical writer.
  PERFORM set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_secretaria, 'escola_id', v_escola_a, 'role', 'authenticated'
  )::text, true);
  SELECT public.lancar_notas_batch(
    v_escola_a, v_turma, v_disc, v_td, 1, 'NPT',
    jsonb_build_array(jsonb_build_object('aluno_id', v_aluno, 'valor', 9)), false
  ) INTO v_result;

  SELECT a.nota_max
  INTO v_nota_max
  FROM public.avaliacoes a
  WHERE a.escola_id = v_escola_a
    AND a.turma_disciplina_id = v_td
    AND a.tipo = 'NPT';

  IF v_nota_max IS DISTINCT FROM 10::numeric THEN
    RAISE EXCEPTION 'TEST: nota_max primária esperada 10, obtido %', v_nota_max;
  END IF;

  -- Isenção is allowed with null numeric value.
  PERFORM public.lancar_notas_batch(
    v_escola_a, v_turma, v_disc, v_td, 1, 'MAC',
    jsonb_build_array(jsonb_build_object('aluno_id', v_aluno, 'valor', NULL)), true
  );

  IF NOT EXISTS (
    SELECT 1
    FROM public.notas n
    JOIN public.avaliacoes a ON a.id = n.avaliacao_id
    WHERE n.matricula_id = v_mat
      AND a.tipo = 'MAC'
      AND n.is_isento = true
      AND n.valor IS NULL
  ) THEN
    RAISE EXCEPTION 'TEST: isenção não foi persistida corretamente';
  END IF;
END;
$$;

DO $$
BEGIN
  IF has_function_privilege(
    'anon',
    'public.lancar_notas_batch(uuid,uuid,uuid,uuid,integer,text,jsonb,boolean)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'TEST: anon ainda pode executar lancar_notas_batch';
  END IF;

  IF NOT has_function_privilege(
    'authenticated',
    'public.lancar_notas_batch(uuid,uuid,uuid,uuid,integer,text,jsonb,boolean)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'TEST: authenticated perdeu EXECUTE no writer canónico';
  END IF;
END;
$$;

ROLLBACK;
