\set ON_ERROR_STOP on
-- Extend the original P0 fixture only after its existing tests/benchmark pass.
alter table public.matriculas add column session_id uuid;
update public.matriculas set session_id=public.fixture_id(191);
update public.matriculas set session_id=public.fixture_id(192) where id=public.fixture_id(33);
update public.matriculas set session_id=public.fixture_id(193) where id=public.fixture_id(34);
alter table public.periodos_letivos add column tipo text,add column numero integer;
update public.periodos_letivos set tipo='TRIMESTRE',numero=1;
insert into public.periodos_letivos values
(public.fixture_id(183),public.fixture_id(1),public.fixture_id(191),'TRIMESTRE',2),
(public.fixture_id(184),public.fixture_id(1),public.fixture_id(193),'TRIMESTRE',1),
(public.fixture_id(185),public.fixture_id(1),public.fixture_id(191),'TRIMESTRE',3);
alter table public.avaliacoes add column periodo_letivo_id uuid,add column trimestre integer;
update public.avaliacoes set periodo_letivo_id=public.fixture_id(181),trimestre=1;
update public.avaliacoes set periodo_letivo_id=public.fixture_id(183),trimestre=2 where id=public.fixture_id(102);
update public.avaliacoes set periodo_letivo_id=public.fixture_id(182),trimestre=1 where id=public.fixture_id(103);
alter table public.pautas_oficiais add column periodo_letivo_id uuid,add column tipo text,add column status text,add column pdf_path text;
update public.pautas_oficiais set periodo_letivo_id=public.fixture_id(181),tipo='trimestral',status='PROCESSING',pdf_path='synthetic/term1.pdf' where id=public.fixture_id(141);
update public.pautas_oficiais set periodo_letivo_id=public.fixture_id(182),tipo='trimestral',status='SUCCESS',pdf_path='synthetic/foreign.pdf' where id=public.fixture_id(142);
insert into public.pautas_oficiais values
(public.fixture_id(143),public.fixture_id(1),public.fixture_id(41),public.fixture_id(183),'trimestral','SUCCESS',' '),
(public.fixture_id(144),public.fixture_id(1),public.fixture_id(41),public.fixture_id(184),'trimestral','SUCCESS','synthetic/old.pdf'),
(public.fixture_id(145),public.fixture_id(1),public.fixture_id(41),public.fixture_id(185),'anual','PROCESSING','synthetic/annual.pdf');
-- The original MV fixture hardcoded trimester=1. Replace only its rows to
-- exercise actual trimester scope by recreating the fixture read model.
drop view public.vw_boletim_por_matricula;
drop materialized view internal.mv_boletim_por_matricula;
create materialized view internal.mv_boletim_por_matricula as
 select n.escola_id,n.matricula_id,m.aluno_id,m.turma_id,2026 as ano_letivo,cm.disciplina_id,
 'Synthetic'::text as disciplina_nome,'S'::text as disciplina_sigla,av.trimestre,true as conta_para_media_med,
 '{}'::jsonb as notas_por_tipo,n.valor as nota_final,null::text as status,false as needs_config,
 1::bigint as total_avaliacoes,1::bigint as total_notas,0::bigint as missing_count,false as has_missing
 from public.notas n join public.matriculas m on m.id=n.matricula_id join public.avaliacoes av on av.id=n.avaliacao_id
 join public.turma_disciplinas td on td.id=av.turma_disciplina_id join public.curso_matriz cm on cm.id=td.curso_matriz_id;
create unique index ux_mv_boletim_por_matricula on internal.mv_boletim_por_matricula(escola_id,matricula_id,disciplina_id,trimestre);
create view public.vw_boletim_por_matricula with(security_barrier=true) as select * from internal.mv_boletim_por_matricula where false;
grant select on public.vw_boletim_por_matricula to authenticated;
grant select on internal.mv_boletim_por_matricula to service_role;
create table public.historico_anos(id uuid primary key,escola_id uuid,matricula_id uuid,aluno_id uuid,ano_letivo_id uuid,turma_id uuid,snapshot_status text,media_geral numeric);
create table public.historico_disciplinas(id uuid primary key,historico_ano_id uuid,nota_final numeric,notas_detalhe jsonb);
create table public.reapreciacao_pedidos(id uuid primary key,escola_id uuid,matricula_id uuid,aluno_id uuid,ano_letivo_id uuid,turma_id uuid,turma_disciplina_id uuid,nota_referencia numeric);
insert into public.historico_anos select public.fixture_id(x.h),m.escola_id,m.id,m.aluno_id,m.session_id,m.turma_id,'fechado',15 from (values(201,31),(202,32),(203,33),(204,34)) x(h,m) join public.matriculas m on m.id=public.fixture_id(x.m);
insert into public.historico_disciplinas select public.fixture_id(x.d),public.fixture_id(x.h),15,'{"nota":15}' from (values(211,201),(212,202),(213,203),(214,204)) x(d,h);
insert into public.reapreciacao_pedidos select public.fixture_id(x.r),m.escola_id,m.id,m.aluno_id,m.session_id,m.turma_id,public.fixture_id(x.td),8 from (values(221,31,91),(222,32,91),(223,33,93),(224,34,91)) x(r,m,td) join public.matriculas m on m.id=public.fixture_id(x.m);
grant select on public.historico_anos,public.historico_disciplinas,public.reapreciacao_pedidos to authenticated,anon;
alter table public.historico_anos enable row level security;
alter table public.historico_disciplinas enable row level security;
alter table public.reapreciacao_pedidos enable row level security;
create policy tenant_or_super_admin_select on public.historico_anos for select to authenticated using(true);
create policy tenant_or_super_admin_select on public.historico_disciplinas for select to authenticated using(true);
create policy reapreciacao_pedidos_school_read on public.reapreciacao_pedidos for select to authenticated using(true);
create policy fixture_history_overlap on public.historico_anos for select to authenticated using(true);
create policy fixture_history_subject_overlap on public.historico_disciplinas for select to authenticated using(true);
create policy fixture_review_overlap on public.reapreciacao_pedidos for select to authenticated using(true);
