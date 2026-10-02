BEGIN;

DO $$
DECLARE
  v_private uuid := gen_random_uuid();
  v_public_budget uuid := gen_random_uuid();
  v_public_emoluments uuid := gen_random_uuid();
  v_student uuid := gen_random_uuid();
  v_monthly uuid;
  v_def text;
BEGIN
  INSERT INTO public.school_operating_profiles(school_id, school_sector, finance_model)
  VALUES
    (v_private, 'private', 'tuition'),
    (v_public_budget, 'public', 'budget'),
    (v_public_emoluments, 'public', 'emoluments_only');

  BEGIN
    INSERT INTO public.school_operating_profiles(school_id, school_sector, finance_model)
    VALUES (gen_random_uuid(), 'public', 'tuition');
    RAISE EXCEPTION 'REGRESSION: public + tuition was accepted';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  IF NOT public.school_finance_allows_operation(v_private, 'recurring_tuition') THEN
    RAISE EXCEPTION 'REGRESSION: private tuition lost recurring tuition';
  END IF;
  IF public.school_finance_allows_operation(v_public_budget, 'student_payment') THEN
    RAISE EXCEPTION 'REGRESSION: public budget allows student payment';
  END IF;
  IF public.school_finance_allows_operation(v_public_budget, 'financial_suspension') THEN
    RAISE EXCEPTION 'REGRESSION: public budget allows financial suspension';
  END IF;
  IF NOT public.school_finance_allows_operation(v_public_emoluments, 'student_payment') THEN
    RAISE EXCEPTION 'REGRESSION: emoluments_only lost one-off payment';
  END IF;
  IF public.school_finance_allows_operation(v_public_emoluments, 'recurring_tuition') THEN
    RAISE EXCEPTION 'REGRESSION: emoluments_only inferred recurring tuition';
  END IF;

  INSERT INTO public.mensalidades(escola_id, aluno_id, valor_previsto)
  VALUES (v_private, v_student, 1000)
  RETURNING id INTO v_monthly;

  -- Legacy writer omits escola_id; payment guard must resolve it from mensalidade.
  INSERT INTO public.pagamentos(escola_id, aluno_id, mensalidade_id, valor_pago, status)
  VALUES (NULL, v_student, v_monthly, 1000, 'pendente');

  BEGIN
    INSERT INTO public.mensalidades(escola_id, aluno_id, valor_previsto)
    VALUES (v_public_budget, v_student, 1000);
    RAISE EXCEPTION 'REGRESSION: public budget created recurring tuition';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  BEGIN
    INSERT INTO public.pagamentos(escola_id, aluno_id, valor_pago, status)
    VALUES (v_public_budget, v_student, 500, 'pendente');
    RAISE EXCEPTION 'REGRESSION: public budget created student payment';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  INSERT INTO public.pagamentos(escola_id, aluno_id, valor_pago, status)
  VALUES (v_public_emoluments, v_student, 500, 'pendente');

  -- A payment created under tuition must not be liquidated after the school
  -- switches to a non-transactional budget profile.
  INSERT INTO public.pagamentos(escola_id, aluno_id, valor_pago, status)
  VALUES (v_private, v_student, 700, 'pendente');

  UPDATE public.school_operating_profiles
  SET school_sector = 'public', finance_model = 'budget'
  WHERE school_id = v_private AND status = 'active';

  BEGIN
    UPDATE public.pagamentos
    SET status = 'confirmado'
    WHERE escola_id = v_private
      AND aluno_id = v_student
      AND valor_pago = 700;
    RAISE EXCEPTION 'REGRESSION: pending payment settled after profile switched to budget';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'rematricula_em_massa';
  IF position('school_finance_allows_operation(p_escola_id, ''financial_suspension'')' IN v_def) = 0 THEN
    RAISE EXCEPTION 'REGRESSION: bulk rematriculation debt capability guard missing';
  END IF;

  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'finalizar_rematricula_balcao';
  IF position('p_pedido_id IS NOT NULL' IN v_def) = 0
     OR position('school_finance_allows_operation(p_escola_id, ''student_payment'')' IN v_def) = 0
     OR position('REMATRICULA_DEBT_REQUIRED' IN v_def) = 0 THEN
    RAISE EXCEPTION 'REGRESSION: Balcao non-financial rematriculation contract missing';
  END IF;

  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'aluno_iniciar_rematricula';
  IF position('school_finance_allows_operation(v_escola_id, ''financial_suspension'')' IN v_def) = 0
     OR position('school_finance_allows_operation(v_escola_id, ''student_payment'')' IN v_def) = 0
     OR position('''payment_required'', false' IN v_def) = 0 THEN
    RAISE EXCEPTION 'REGRESSION: student non-financial rematriculation contract missing';
  END IF;
END;
$$;

ROLLBACK;
