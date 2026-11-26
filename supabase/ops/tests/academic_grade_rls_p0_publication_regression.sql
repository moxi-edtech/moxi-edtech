\set ON_ERROR_STOP on
set role authenticated;
select set_config('test.school',public.fixture_id(1)::text,false),set_config('test.actor',public.fixture_id(11)::text,false),set_config('test.email','',false);
do $audit$ begin
 if not public.aluno_boletim_pago(public.fixture_id(1),public.fixture_id(21),public.fixture_id(31)) then raise exception 'paid entitlement lost'; end if;
 if public.aluno_trimestres_publicados(public.fixture_id(1),public.fixture_id(31))<>'{}'::integer[] then raise exception 'processing, empty path or wrong-year sheet unlocked'; end if;
 if exists(select 1 from public.notas) or exists(select 1 from public.notas_avaliacoes) or exists(select 1 from public.vw_boletim_por_matricula where matricula_id=public.fixture_id(31)) then raise exception 'unpublished grades leaked'; end if;
 if exists(select 1 from public.historico_anos) or exists(select 1 from public.historico_disciplinas) or exists(select 1 from public.reapreciacao_pedidos) then raise exception 'unpublished historical/review data leaked'; end if;
 if exists(select 1 from public.exame_resultados) or exists(select 1 from public.dependencias_academicas_transicao) then raise exception 'annual grade leaked'; end if;
 if public.resolve_raa_progression_for_matricula(public.fixture_id(1),public.fixture_id(31))->>'grade_details_restricted' is distinct from 'true' then raise exception 'paid unpublished progression leaked'; end if;
 if public.aluno_iniciar_rematricula(public.fixture_id(31),'{}'::uuid[])->>'eligible' is distinct from 'true' then raise exception 'rematricula regressed'; end if;
 begin perform public.resolve_estado_resultado(public.fixture_id(31),public.fixture_id(81)); raise exception 'unpublished annual RPC leaked'; exception when insufficient_privilege then if SQLERRM<>'ACADEMIC_FORBIDDEN' then raise;end if;end;
end $audit$;
reset role;
update public.pautas_oficiais set status='SUCCESS' where id=public.fixture_id(141);
set role authenticated;
do $audit$ begin
 if public.aluno_trimestres_publicados(public.fixture_id(1),public.fixture_id(31))<>array[1] then raise exception 'published term missing'; end if;
 if (select count(*) from public.notas)<>1 or (select count(*) from public.notas_avaliacoes)<>1 or (select count(*) from public.vw_boletim_por_matricula where matricula_id=public.fixture_id(31))<>1 then raise exception 'term scope mismatch'; end if;
 if public.aluno_resultado_publicado(public.fixture_id(1),public.fixture_id(31)) then raise exception 'quarterly evidence unlocked annual'; end if;
 if public.aluno_trimestres_publicados(public.fixture_id(1),public.fixture_id(32))<>'{}'::integer[] then raise exception 'other student publication scope leaked';end if;
end $audit$;
reset role;
update public.pautas_oficiais set status='SUCCESS' where id=public.fixture_id(145);
set role authenticated;
do $audit$ begin
 if not public.aluno_resultado_publicado(public.fixture_id(1),public.fixture_id(31)) then raise exception 'annual evidence unavailable'; end if;
 if (select count(*) from public.historico_anos)<>1 or (select count(*) from public.historico_disciplinas)<>1 or (select count(*) from public.reapreciacao_pedidos)<>1 then raise exception 'history/review isolation failed';end if;
 if public.resolve_estado_resultado(public.fixture_id(31),public.fixture_id(81))->>'nota' is distinct from '16' then raise exception 'authorized annual RPC unavailable';end if;
 if (select count(*) from public.notas)<>1 then raise exception 'annual evidence unlocked unpublished trimester';end if;
 if exists(select 1 from public.dependencias_academicas_transicao) then raise exception 'annual publication reused across academic year';end if;
end $audit$;
select set_config('test.actor',public.fixture_id(14)::text,false),set_config('test.email','guardian@example.invalid',false);
do $audit$ begin
 if (select count(*) from public.historico_disciplinas)<>1 or (select count(*) from public.reapreciacao_pedidos)<>1 then raise exception 'guardian scope mismatch';end if;
end $audit$;
select set_config('test.actor',public.fixture_id(15)::text,false),set_config('test.email','',false);
do $audit$ begin
 if not exists(select 1 from public.notas where matricula_id=public.fixture_id(32)) or exists(select 1 from public.notas where avaliacao_id=public.fixture_id(102)) then raise exception 'teacher assignment regressed';end if;
 if exists(select 1 from public.historico_disciplinas) or exists(select 1 from public.reapreciacao_pedidos) then raise exception 'teacher received schoolwide history';end if;
end $audit$;
select set_config('test.actor',public.fixture_id(17)::text,false);
do $audit$ begin
 if (select count(*) from public.historico_anos)<>3 or (select count(*) from public.historico_disciplinas)<>3 or (select count(*) from public.reapreciacao_pedidos)<>3 then raise exception 'staff history/review access regressed';end if;
end $audit$;
reset role;
update public.pagamento_intents set status='pending' where id=public.fixture_id(161);
set role authenticated;
select set_config('test.actor',public.fixture_id(11)::text,false);
do $audit$ begin
 if exists(select 1 from public.historico_disciplinas) or exists(select 1 from public.reapreciacao_pedidos) or exists(select 1 from public.notas where matricula_id=public.fixture_id(31)) then raise exception 'revoked payment retained access';end if;
end $audit$;
reset role;
set role anon;
do $audit$ begin
 if has_table_privilege(current_user,'public.historico_anos','SELECT') or has_table_privilege(current_user,'public.historico_disciplinas','SELECT') or has_table_privilege(current_user,'public.reapreciacao_pedidos','SELECT') or has_function_privilege(current_user,'public.aluno_trimestres_publicados(uuid,uuid)','EXECUTE') then raise exception 'anon grants retained';end if;
end $audit$;
reset role;
select 'PASS: publication, history and reappraisal boundaries' as result;
