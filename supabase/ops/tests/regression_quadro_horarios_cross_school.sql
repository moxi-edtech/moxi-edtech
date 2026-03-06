-- Regression test: quadro_horarios rejects cross-school references with explicit domain errors.

BEGIN;

DO $$
DECLARE
  v_escola_a uuid := gen_random_uuid();
  v_escola_b uuid := gen_random_uuid();
  v_turma_a uuid := gen_random_uuid();
  v_turma_b uuid := gen_random_uuid();
  v_disc_a uuid := gen_random_uuid();
  v_disc_b uuid := gen_random_uuid();
  v_slot_a uuid := gen_random_uuid();
  v_slot_b uuid := gen_random_uuid();
  v_versao_a uuid := gen_random_uuid();
  v_err text;
BEGIN
  INSERT INTO public.escolas (id, nome, status, onboarding_finalizado)
  VALUES
    (v_escola_a, 'Escola A', 'ativa', true),
    (v_escola_b, 'Escola B', 'ativa', true);

  INSERT INTO public.turmas (id, escola_id, nome)
  VALUES
    (v_turma_a, v_escola_a, 'Turma A'),
    (v_turma_b, v_escola_b, 'Turma B');

  INSERT INTO public.disciplinas_catalogo (id, escola_id, nome)
  VALUES
    (v_disc_a, v_escola_a, 'Disciplina A'),
    (v_disc_b, v_escola_b, 'Disciplina B');

  INSERT INTO public.horario_slots (id, escola_id, turno_id, ordem, inicio, fim, dia_semana)
  VALUES
    (v_slot_a, v_escola_a, 'M', 1, '08:00', '08:45', 1),
    (v_slot_b, v_escola_b, 'M', 1, '08:00', '08:45', 1);

  INSERT INTO public.horario_versoes (id, escola_id, turma_id, status)
  VALUES (v_versao_a, v_escola_a, v_turma_a, 'draft');

  BEGIN
    INSERT INTO public.quadro_horarios (escola_id, turma_id, disciplina_id, slot_id, versao_id)
    VALUES (v_escola_a, v_turma_a, v_disc_b, v_slot_a, v_versao_a);

    RAISE EXCEPTION 'Teste falhou: inserção com disciplina de outra escola deveria falhar';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF position('DOMAIN_CROSS_TENANT_REFERENCE: disciplina_id' in v_err) = 0 THEN
      RAISE EXCEPTION 'Teste falhou: mensagem inesperada para disciplina cross-school: %', v_err;
    END IF;
  END;

  BEGIN
    INSERT INTO public.quadro_horarios (escola_id, turma_id, disciplina_id, slot_id, versao_id)
    VALUES (v_escola_a, v_turma_a, v_disc_a, v_slot_b, v_versao_a);

    RAISE EXCEPTION 'Teste falhou: inserção com slot de outra escola deveria falhar';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF position('DOMAIN_CROSS_TENANT_REFERENCE: slot_id' in v_err) = 0 THEN
      RAISE EXCEPTION 'Teste falhou: mensagem inesperada para slot cross-school: %', v_err;
    END IF;
  END;

  BEGIN
    INSERT INTO public.quadro_horarios (escola_id, turma_id, disciplina_id, slot_id, versao_id)
    VALUES (v_escola_a, v_turma_b, v_disc_a, v_slot_a, v_versao_a);

    RAISE EXCEPTION 'Teste falhou: inserção com turma de outra escola deveria falhar';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF position('DOMAIN_CROSS_TENANT_REFERENCE: turma_id' in v_err) = 0 THEN
      RAISE EXCEPTION 'Teste falhou: mensagem inesperada para turma cross-school: %', v_err;
    END IF;
  END;
END $$;

ROLLBACK;
