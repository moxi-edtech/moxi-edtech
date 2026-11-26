\set ON_ERROR_STOP on
-- Synthetic benchmark only. Add ~6k rows without using real records.
insert into public.alunos select fixture_id(n+10000),fixture_id(1),null,null from generate_series(1,3000) n;
insert into public.matriculas select fixture_id(n+20000),fixture_id(1),fixture_id(n+10000),fixture_id(41) from generate_series(1,3000) n;
insert into public.notas select fixture_id(30000+n*2+i),fixture_id(1),fixture_id(101+i),fixture_id(n+20000),12 from generate_series(1,3000) n cross join generate_series(0,1) i;
refresh materialized view internal.mv_boletim_por_matricula;
analyze internal.mv_boletim_por_matricula;
analyze public.matriculas;
analyze public.alunos;
set role authenticated;
select set_config('test.school',fixture_id(1)::text,false),set_config('test.actor',fixture_id(11)::text,false);
-- One enrollment query must not scan the entire school; report actual buffers/time.
explain (analyze,buffers) select * from public.vw_boletim_por_matricula where escola_id=fixture_id(1) and matricula_id=fixture_id(31);
do $audit$
declare plan json; n bigint;
begin
 select count(*) into n from public.vw_boletim_por_matricula where escola_id=fixture_id(1);
 if n<>3 then raise exception 'large tenant pupil scope wrong: %',n; end if;
 execute 'explain (analyze,buffers,format json) select * from public.vw_boletim_por_matricula where escola_id=public.fixture_id(1) and matricula_id=public.fixture_id(31)' into plan;
 if plan::text not like '%ux_mv_boletim_por_matricula%' then raise exception 'scoped read model index not used'; end if;
 if (plan->0->>'Execution Time')::numeric > 1000 then raise exception 'scoped query exceeds generous CI budget'; end if;
 raise notice 'Protected scoped view benchmark (ms): %',plan->0->>'Execution Time';
end $audit$;
reset role;
