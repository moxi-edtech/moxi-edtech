DO $$
DECLARE
 school uuid := '00000000-0000-4000-8000-000000000101';
 aluno uuid := '00000000-0000-4000-8000-000000000102';
 current_year uuid := '00000000-0000-4000-8000-000000000104';
 old_year uuid := '00000000-0000-4000-8000-000000000105';
 current_enrollment uuid := '00000000-0000-4000-8000-000000000106';
 closed_enrollment uuid := '00000000-0000-4000-8000-000000000107';
 transfer_enrollment uuid := '00000000-0000-4000-8000-000000000108';
 first_json jsonb;
 replay jsonb;
 rejected boolean;
BEGIN
 PERFORM set_config('test.actor','00000000-0000-4000-8000-000000000103',true);
 PERFORM set_config('test.school',school::text,true);
 first_json := public.aluno_solicitar_boletim_matricula(school,aluno,current_enrollment,current_year);
 replay := public.aluno_solicitar_boletim_matricula(school,aluno,current_enrollment,current_year);
 IF first_json->>'matricula_id' <> current_enrollment::text OR first_json->>'session_id' <> current_year::text
    OR first_json->>'pedido_id' IS DISTINCT FROM replay->>'pedido_id'
    OR first_json->>'pagamento_id' IS DISTINCT FROM replay->>'pagamento_id'
    OR (replay->>'idempotent')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'wrong enrollment or duplicate order'; END IF;
 IF (SELECT count(*) FROM public.servico_pedidos) <> 1 OR (SELECT count(*) FROM public.pagamento_intents) <> 1 THEN
   RAISE EXCEPTION 'double click created duplicate'; END IF;
 rejected := false;
 BEGIN PERFORM public.aluno_solicitar_boletim_matricula(school,aluno,closed_enrollment,old_year);
 EXCEPTION WHEN OTHERS THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'closed enrollment accepted'; END IF;
 rejected := false;
 BEGIN PERFORM public.aluno_solicitar_boletim_matricula(school,aluno,transfer_enrollment,current_year);
 EXCEPTION WHEN OTHERS THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'transferred enrollment accepted'; END IF;
 rejected := false;
 BEGIN PERFORM public.aluno_solicitar_boletim_matricula(school,aluno,current_enrollment,old_year);
 EXCEPTION WHEN OTHERS THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'cross year enrollment accepted'; END IF;
 PERFORM set_config('test.school','00000000-0000-4000-8000-000000000199',true);
 rejected := false;
 BEGIN PERFORM public.aluno_solicitar_boletim_matricula(school,aluno,current_enrollment,current_year);
 EXCEPTION WHEN OTHERS THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'cross tenant accepted'; END IF;
END
$$;
