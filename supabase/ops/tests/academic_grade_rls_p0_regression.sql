\set ON_ERROR_STOP on
-- Apply real migration to synthetic fixture first, then exercise effective RLS.
set role authenticated;
select set_config('test.school',fixture_id(1)::text,false),set_config('test.actor',fixture_id(11)::text,false);
do $$begin
 if exists(select 1 from public.notas) or exists(select 1 from public.notas_avaliacoes) or exists(select 1 from public.vw_boletim_por_matricula) or exists(select 1 from public.exame_resultados) then raise exception 'unpaid grades exposed'; end if;
 if exists(select 1 from public.dependencias_academicas_transicao) or exists(select 1 from public.dependencias_academicas_transicao_eventos) then raise exception 'unpaid historical results exposed'; end if;
 if has_table_privilege(current_user,'internal.mv_boletim_por_matricula','SELECT') then raise exception 'raw MV remains accessible'; end if;
 if (select count(*) from storage.objects)<>1 then raise exception 'class documents visible'; end if;
 if (select count(*) from public.avaliacoes)<>2 then raise exception 'own class metadata unavailable'; end if;
 begin perform public.resolve_estado_resultado_academico_base(fixture_id(31),fixture_id(81)); raise exception 'unpaid RPC allowed'; exception when insufficient_privilege then null; end;
 begin insert into public.avaliacoes values(fixture_id(999),fixture_id(1),fixture_id(91)); raise exception 'student assessment write allowed'; exception when insufficient_privilege then null; end;
end$$;
reset role;
update public.pagamento_intents set status='settled' where id=fixture_id(161);
set role authenticated;
do $$begin
 if (select count(*) from public.notas)<>2 or (select count(*) from public.notas_avaliacoes)<>2 or (select count(*) from public.vw_boletim_por_matricula)<>2 then raise exception 'paid pupil scope wrong'; end if;
 if exists(select 1 from public.notas where matricula_id<>fixture_id(31)) then raise exception 'other pupil/year exposed'; end if;
 if (select count(*) from public.exame_resultados)<>1 then raise exception 'paid exam unavailable'; end if;
 if exists(select 1 from public.dependencias_academicas_transicao) then raise exception 'payment reused across years'; end if;
 perform public.resolve_estado_resultado_academico_base(fixture_id(31),fixture_id(81));
 begin perform public.resolve_estado_resultado_academico_base(fixture_id(32),fixture_id(81)); raise exception 'other pupil RPC allowed'; exception when insufficient_privilege then null; end;
 begin perform public.resolve_estado_resultado_academico_base(fixture_id(33),fixture_id(81)); raise exception 'foreign school RPC allowed'; exception when insufficient_privilege then null; end;
end$$;
select set_config('test.actor',fixture_id(14)::text,false),set_config('test.email','guardian@example.invalid',false);
do $$begin if (select count(*) from public.vw_boletim_por_matricula)<>2 then raise exception 'guardian scope wrong'; end if;end$$;
select set_config('test.actor',fixture_id(15)::text,false),set_config('test.email','',false);
do $$begin
 if (select count(*) from public.notas)<>3 or (select count(*) from public.vw_boletim_por_matricula)<>3 then raise exception 'assigned teacher scope wrong'; end if;
 begin perform public.resolve_estado_resultado_academico_base(fixture_id(31),fixture_id(82)); raise exception 'unassigned discipline RPC allowed'; exception when insufficient_privilege then null; end;
 if (select count(*) from storage.objects)<>1 then raise exception 'teacher has class-wide files'; end if;
end$$;
select set_config('test.actor',fixture_id(16)::text,false);
do $$begin if (select count(*) from public.notas)<>1 then raise exception 'second teacher scope wrong'; end if;end$$;
select set_config('test.actor',fixture_id(17)::text,false);
do $$begin
 if (select count(*) from public.notas)<>4 or (select count(*) from public.vw_boletim_por_matricula)<>4 then raise exception 'staff scope wrong'; end if;
 if (select count(*) from storage.objects)<>3 then raise exception 'staff storage scope wrong'; end if;
end$$;
reset role;
-- genuine paid legacy order restores only source enrollment.
update public.servico_pedidos set contexto='{}' where id=fixture_id(153);
set role authenticated;
select set_config('test.actor',fixture_id(11)::text,false);
do $$begin
 if (select count(*) from public.notas)<>3 or (select count(*) from public.dependencias_academicas_transicao)<>1 then raise exception 'legacy paid access lost'; end if;
end$$;
reset role;
set role anon;
do $$begin
 if has_table_privilege(current_user,'public.notas','SELECT') or has_table_privilege(current_user,'internal.mv_boletim_por_matricula','SELECT') or has_table_privilege(current_user,'public.vw_boletim_por_matricula','SELECT') then raise exception 'anonymous grants retained'; end if;
 if (select count(*) from storage.objects)<>1 then raise exception 'anonymous class files exposed'; end if;
end$$;
reset role;
select 'PASS: academic grade RLS boundary' as result;
