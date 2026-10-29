-- Disposable PostgreSQL 17 regression for the 2026/2027 calendar boundary.
BEGIN;

CREATE TRIGGER trg_block_notas_after_lock_date
  BEFORE INSERT OR UPDATE ON public.notas
  FOR EACH ROW EXECUTE FUNCTION public.block_notas_after_lock_date();

DO $$
DECLARE
  v_school uuid := '30000000-0000-0000-0000-000000000001';
  v_user uuid := '30000000-0000-0000-0000-000000000002';
  v_year uuid := '30000000-0000-0000-0000-000000000003';
  v_wrong_year uuid := '30000000-0000-0000-0000-000000000004';
  v_turma uuid := '30000000-0000-0000-0000-000000000005';
  v_wrong_turma uuid := '30000000-0000-0000-0000-000000000006';
  v_disc uuid := '30000000-0000-0000-0000-000000000007';
  v_matriz uuid := '30000000-0000-0000-0000-000000000008';
  v_td uuid := '30000000-0000-0000-0000-000000000009';
  v_aluno uuid := '30000000-0000-0000-0000-000000000010';
  v_other_aluno uuid := '30000000-0000-0000-0000-000000000011';
  v_matricula uuid := '30000000-0000-0000-0000-000000000012';
  v_other_matricula uuid := '30000000-0000-0000-0000-000000000013';
  v_template uuid := '30000000-0000-0000-0000-000000000099';
  v_p1 uuid := '30000000-0000-0000-0000-000000000014';
  v_p2 uuid := '30000000-0000-0000-0000-000000000015';
  v_p3 uuid := '30000000-0000-0000-0000-000000000016';
  v_e1 uuid;
  v_e3 uuid;
  v_result jsonb;
  v_today date := (now() AT TIME ZONE 'Africa/Luanda')::date;
BEGIN
  INSERT INTO public.escola_users(escola_id,user_id,papel) VALUES(v_school,v_user,'secretaria');
  INSERT INTO public.anos_letivos(id,escola_id,ano,ativo) VALUES
    (v_year,v_school,2026,true),(v_wrong_year,v_school,2025,true);
  INSERT INTO public.periodos_letivos(id,escola_id,ano_letivo_id,tipo,numero,data_inicio,data_fim,source_template_id)
  VALUES
    (v_p1,v_school,v_year,'TRIMESTRE',1,v_today-5,v_today+5,v_template),
    (v_p2,v_school,v_year,'TRIMESTRE',2,v_today+10,v_today+20,v_template),
    (v_p3,v_school,v_year,'TRIMESTRE',3,v_today-20,v_today-10,v_template);
  INSERT INTO public.turmas(id,escola_id,session_id,ano_letivo,status_fecho,nivel_ensino)
  VALUES
    (v_turma,v_school,v_year,2026,'ABERTO','primario'),
    (v_wrong_turma,v_school,v_year,2026,'ABERTO','primario');
  INSERT INTO public.disciplinas_catalogo(id,escola_id,nome)
  VALUES(v_disc,v_school,'Matemática');
  INSERT INTO public.curso_matriz(id,escola_id,disciplina_id)
  VALUES(v_matriz,v_school,v_disc);
  INSERT INTO public.turma_disciplinas(id,escola_id,turma_id,curso_matriz_id)
  VALUES(v_td,v_school,v_turma,v_matriz);
  INSERT INTO public.alunos(id,escola_id,nome)
  VALUES(v_aluno,v_school,'Aluno'),(v_other_aluno,v_school,'Outro aluno');
  INSERT INTO public.matriculas(id,escola_id,aluno_id,turma_id,session_id,ano_letivo,status,ativo)
  VALUES
    (v_matricula,v_school,v_aluno,v_turma,v_year,2026,'ativo',true),
    (v_other_matricula,v_school,v_other_aluno,v_wrong_turma,v_year,2026,'ativo',true);

  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub',v_user,'escola_id',v_school,'role','authenticated')::text,true);

  SELECT public.lancar_notas_batch(v_school,v_turma,v_disc,v_td,1,'MAC',
    jsonb_build_array(jsonb_build_object('aluno_id',v_aluno,'valor',8)),false)
  INTO v_result;
  IF (v_result->>'inserted')::int <> 1 THEN
    RAISE EXCEPTION 'TEST: current-trimester grade did not persist';
  END IF;
  SELECT id INTO STRICT v_e1 FROM public.avaliacoes
   WHERE turma_disciplina_id=v_td AND trimestre=1;

  -- In 2026/27, the client or RPC cannot bypass a missing official source.
  UPDATE public.periodos_letivos SET source_template_id=NULL WHERE id=v_p1;
  BEGIN
    PERFORM public.lancar_notas_batch(v_school,v_turma,v_disc,v_td,1,'MAC',
      jsonb_build_array(jsonb_build_object('aluno_id',v_aluno,'valor',9)),false);
    RAISE EXCEPTION 'TEST: unlinked 2026/27 calendar was accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'TEST:%' OR SQLERRM NOT LIKE 'OFFICIAL_CALENDAR_NOT_RECONCILED:%' THEN RAISE; END IF;
  END;
  UPDATE public.periodos_letivos SET source_template_id=v_template WHERE id=v_p1;

  -- Future periods must fail even when the caller selects them manually.
  BEGIN
    PERFORM public.lancar_notas_batch(v_school,v_turma,v_disc,v_td,2,'MAC',
      jsonb_build_array(jsonb_build_object('aluno_id',v_aluno,'valor',7)),false);
    RAISE EXCEPTION 'TEST: future trimester accepted a grade';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'TEST:%' OR SQLERRM NOT LIKE 'DATA:%trimestre ainda%' THEN RAISE; END IF;
  END;

  -- A past period is not writable without its formal pauta exception.
  BEGIN
    PERFORM public.lancar_notas_batch(v_school,v_turma,v_disc,v_td,3,'MAC',
      jsonb_build_array(jsonb_build_object('aluno_id',v_aluno,'valor',7)),false);
    RAISE EXCEPTION 'TEST: closed trimester accepted an unauthorized grade';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'TEST:%' OR SQLERRM NOT LIKE 'ACADEMIC_PERIOD_LOCKED:%' THEN RAISE; END IF;
  END;

  INSERT INTO public.avaliacoes(escola_id,turma_disciplina_id,periodo_letivo_id,ano_letivo,trimestre,nome,tipo,peso,nota_max)
    VALUES(v_school,v_td,v_p3,2026,3,'MAC','MAC',1,10)
    RETURNING id INTO v_e3;
  INSERT INTO public.test_grade_reopen(escola_id,turma_id,avaliacao_id,user_id)
  VALUES(v_school,v_turma,v_e3,v_user);
  SELECT public.lancar_notas_batch(v_school,v_turma,v_disc,v_td,3,'MAC',
    jsonb_build_array(jsonb_build_object('aluno_id',v_aluno,'valor',7)),false)
  INTO v_result;
  IF (v_result->>'inserted')::int <> 1 THEN
    RAISE EXCEPTION 'TEST: formally reopened period could not be corrected';
  END IF;

  -- A missing or mismatched year must never fall back to an active year.
  UPDATE public.turmas SET session_id=v_wrong_year WHERE id=v_turma;
  BEGIN
    PERFORM public.lancar_notas_batch(v_school,v_turma,v_disc,v_td,1,'MAC',
      jsonb_build_array(jsonb_build_object('aluno_id',v_aluno,'valor',9)),false);
    RAISE EXCEPTION 'TEST: mismatched school year was silently accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'TEST:%' OR SQLERRM NOT LIKE 'ACADEMIC_YEAR_READ_ONLY:%' THEN RAISE; END IF;
  END;
  UPDATE public.turmas SET session_id=v_year WHERE id=v_turma;

  -- Direct Supabase note writes cannot combine an evaluation with another
  -- student's enrollment, even when both belong to the same tenant.
  BEGIN
    INSERT INTO public.notas(escola_id,avaliacao_id,matricula_id,valor)
      VALUES(v_school,v_e1,v_other_matricula,8);
    RAISE EXCEPTION 'TEST: wrong-turma enrollment accepted a grade';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'TEST:%' OR SQLERRM NOT LIKE 'DATA:%incompatíveis%' THEN RAISE; END IF;
  END;

  -- Explicit calendar lock inside a live trimester requires a formal exception.
  UPDATE public.periodos_letivos SET trava_notas_em=now()-interval '1 minute'
  WHERE id=v_p1;
  BEGIN
    PERFORM public.lancar_notas_batch(v_school,v_turma,v_disc,v_td,1,'MAC',
      jsonb_build_array(jsonb_build_object('aluno_id',v_aluno,'valor',9)),false);
    RAISE EXCEPTION 'TEST: locked grade was overwritten';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'TEST:%' OR SQLERRM NOT LIKE '%período para lançamento de notas está fechado%' THEN RAISE; END IF;
  END;

  INSERT INTO public.test_grade_reopen(escola_id,turma_id,avaliacao_id,user_id)
  VALUES(v_school,v_turma,v_e1,v_user);
  SELECT public.lancar_notas_batch(v_school,v_turma,v_disc,v_td,1,'MAC',
    jsonb_build_array(jsonb_build_object('aluno_id',v_aluno,'valor',9)),false)
  INTO v_result;
  IF (v_result->>'updated')::int <> 1 THEN
    RAISE EXCEPTION 'TEST: formal reabertura não permitiu corrigir nota';
  END IF;

  IF (SELECT count(*) FROM public.notas WHERE escola_id=v_school) <> 2 THEN
    RAISE EXCEPTION 'TEST: notas futuras/duplicadas were persisted';
  END IF;
END;
$$;
ROLLBACK;
