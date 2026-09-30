-- Regression test: WAHA inbound thread upsert is safe to repeat for one
-- school/contact pair and never creates a second communication_threads row.

BEGIN;

DO $$
DECLARE
  v_school_id uuid := gen_random_uuid();
  v_first public.communication_threads;
  v_second public.communication_threads;
  v_thread_count integer;
BEGIN
  INSERT INTO public.escolas (id, nome, status, onboarding_finalizado)
  VALUES (v_school_id, 'Escola WAHA Idempotency', 'ativa', true);

  v_first := public.upsert_communication_thread_for_inbound(
    v_school_id,
    'phone-hash-regression',
    '+244 *** 123',
    'Contacto de teste',
    'unknown',
    'unknown',
    NULL,
    'primeira mensagem',
    now()
  );

  v_second := public.upsert_communication_thread_for_inbound(
    v_school_id,
    'phone-hash-regression',
    '+244 *** 123',
    'Contacto de teste',
    'unknown',
    'unknown',
    NULL,
    'segunda mensagem',
    now()
  );

  SELECT count(*) INTO v_thread_count
  FROM public.communication_threads
  WHERE school_id = v_school_id
    AND contact_phone_hash = 'phone-hash-regression';

  IF v_first.id IS NULL OR v_second.id IS NULL OR v_first.id <> v_second.id THEN
    RAISE EXCEPTION 'Teste falhou: chamadas repetidas retornaram threads diferentes';
  END IF;

  IF v_thread_count <> 1 THEN
    RAISE EXCEPTION 'Teste falhou: esperava 1 thread, encontrei %', v_thread_count;
  END IF;

  IF v_second.unread_count <> 2 OR v_second.last_message_preview <> 'segunda mensagem' THEN
    RAISE EXCEPTION 'Teste falhou: upsert não atualizou estado da thread atomicamente';
  END IF;
END $$;

ROLLBACK;
