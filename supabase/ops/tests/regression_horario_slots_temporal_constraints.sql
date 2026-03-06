-- Regression test: horario_slots enforces inicio < fim and non-overlap per escola/turno/dia for non-intervals.

BEGIN;

DO $$
DECLARE
  v_escola uuid := gen_random_uuid();
  v_err text;
BEGIN
  INSERT INTO public.escolas (id, nome, status, onboarding_finalizado)
  VALUES (v_escola, 'Escola Slots', 'ativa', true);

  INSERT INTO public.horario_slots (escola_id, turno_id, ordem, inicio, fim, dia_semana, is_intervalo)
  VALUES (v_escola, 'M', 1, '08:00', '08:45', 1, false);

  BEGIN
    INSERT INTO public.horario_slots (escola_id, turno_id, ordem, inicio, fim, dia_semana, is_intervalo)
    VALUES (v_escola, 'M', 2, '08:30', '09:00', 1, false);

    RAISE EXCEPTION 'Teste falhou: deveria bloquear sobreposição temporal';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF position('excl_horario_slots_temporal' in lower(v_err)) = 0
       AND position('conflicting key value violates exclusion constraint' in lower(v_err)) = 0 THEN
      RAISE EXCEPTION 'Teste falhou: erro inesperado para sobreposição temporal: %', v_err;
    END IF;
  END;

  BEGIN
    INSERT INTO public.horario_slots (escola_id, turno_id, ordem, inicio, fim, dia_semana, is_intervalo)
    VALUES (v_escola, 'M', 3, '10:00', '09:50', 1, false);

    RAISE EXCEPTION 'Teste falhou: deveria bloquear inicio >= fim';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF position('horario_slots_inicio_fim_check' in lower(v_err)) = 0
       AND position('violates check constraint' in lower(v_err)) = 0 THEN
      RAISE EXCEPTION 'Teste falhou: erro inesperado para check inicio/fim: %', v_err;
    END IF;
  END;
END $$;

ROLLBACK;
