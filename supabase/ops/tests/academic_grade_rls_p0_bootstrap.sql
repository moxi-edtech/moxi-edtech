-- Disposable database only. No production data.
create role authenticated nologin;
create role anon nologin;
create role service_role nologin bypassrls;
create schema auth;
create schema internal;
create schema storage;
grant usage on schema auth,internal,storage to authenticated,anon,service_role;
create function public.fixture_id(n integer) returns uuid language sql immutable as $$select ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid$$;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('email',current_setting('test.email',true))$$;
create function public.current_tenant_escola_id() returns uuid language sql stable as $$select nullif(current_setting('test.school',true),'')::uuid$$;
create function public.is_super_admin() returns boolean language sql stable as $$select false$$;
create table public.escola_users(escola_id uuid,user_id uuid,papel text);
create table public.alunos(id uuid primary key,escola_id uuid,profile_id uuid,usuario_auth_id uuid);
create table public.aluno_encarregados(escola_id uuid,aluno_id uuid,encarregado_id uuid);
create table public.encarregados(id uuid primary key,escola_id uuid,email text);
create table public.matriculas(id uuid primary key,escola_id uuid,aluno_id uuid,turma_id uuid);
create table public.professores(id uuid primary key,escola_id uuid,profile_id uuid);
create table public.curso_matriz(id uuid primary key,escola_id uuid,disciplina_id uuid,avaliacao_disciplina_id uuid);
create table public.turma_disciplinas(id uuid primary key,escola_id uuid,turma_id uuid,curso_matriz_id uuid,professor_id uuid,avaliacao_disciplina_id uuid);
create table public.turma_disciplinas_professores(escola_id uuid,turma_id uuid,disciplina_id uuid,professor_id uuid);
create table public.avaliacoes(id uuid primary key,escola_id uuid,turma_disciplina_id uuid);
create table public.notas(id uuid primary key,escola_id uuid,avaliacao_id uuid,matricula_id uuid,valor numeric);
create table public.notas_avaliacoes(id uuid primary key,avaliacao_id uuid,matricula_id uuid,aluno_id uuid,valor numeric);
create table public.exame_resultados(id uuid primary key,escola_id uuid,turma_disciplina_id uuid,matricula_id uuid,nota numeric);
create table public.dependencias_academicas_transicao(id uuid primary key,escola_id uuid,matricula_origem_id uuid,resultado_nota numeric);
create table public.dependencias_academicas_transicao_eventos(id uuid primary key,escola_id uuid,dependencia_id uuid,resultado_snapshot jsonb);
create table public.pautas_oficiais(id uuid primary key,escola_id uuid,turma_id uuid);
create table public.servico_pedidos(id uuid primary key,escola_id uuid,aluno_id uuid,matricula_id uuid,status text,valor_cobrado numeric,servico_codigo text,contexto jsonb);
create table public.pagamento_intents(id uuid primary key,escola_id uuid,aluno_id uuid,servico_pedido_id uuid,status text);
create table storage.objects(id uuid primary key,bucket_id text,name text);

insert into public.escola_users select fixture_id(s),fixture_id(u),p from (values
(1,11,'aluno'),(1,12,'aluno'),(2,13,'aluno'),(1,14,'encarregado'),(1,15,'professor'),(1,16,'professor'),(1,17,'secretaria')) q(s,u,p);
insert into public.alunos select fixture_id(a),fixture_id(s),fixture_id(u),null from (values (21,1,11),(22,1,12),(23,2,13)) q(a,s,u);
insert into public.matriculas select fixture_id(m),fixture_id(s),fixture_id(a),fixture_id(t) from (values (31,1,21,41),(32,1,22,41),(33,2,23,42),(34,1,21,41)) q(m,s,a,t);
insert into public.encarregados values(fixture_id(51),fixture_id(1),'guardian@example.invalid');
insert into public.aluno_encarregados values(fixture_id(1),fixture_id(21),fixture_id(51));
insert into public.professores select fixture_id(p),fixture_id(1),fixture_id(u) from (values(61,15),(62,16)) q(p,u);
insert into public.curso_matriz select fixture_id(m),fixture_id(s),fixture_id(d),fixture_id(d) from (values(71,1,81),(72,1,82),(73,2,81)) q(m,s,d);
insert into public.turma_disciplinas select fixture_id(td),fixture_id(s),fixture_id(t),fixture_id(cm),case when pr is null then null else fixture_id(pr) end,fixture_id(d) from (values
(91,1,41,71,61,81),(92,1,41,72,62,82),(93,2,42,73,null,81)) q(td,s,t,cm,pr,d);
insert into public.avaliacoes select fixture_id(av),fixture_id(s),fixture_id(td) from (values (101,1,91),(102,1,92),(103,2,93)) q(av,s,td);
insert into public.notas select fixture_id(n),fixture_id(s),fixture_id(av),fixture_id(m),v from (values
(111,1,101,31,16),(112,1,102,31,17),(113,1,101,32,18),(114,2,103,33,19),(115,1,101,34,12)) q(n,s,av,m,v);
insert into public.notas_avaliacoes select n.id,n.avaliacao_id,n.matricula_id,m.aluno_id,n.valor from public.notas n join public.matriculas m on m.id=n.matricula_id;
insert into public.exame_resultados values(fixture_id(121),fixture_id(1),fixture_id(91),fixture_id(31),16);
insert into public.dependencias_academicas_transicao values(fixture_id(131),fixture_id(1),fixture_id(34),12);
insert into public.dependencias_academicas_transicao_eventos values(fixture_id(132),fixture_id(1),fixture_id(131),'{"nota":12}');
insert into public.pautas_oficiais values(fixture_id(141),fixture_id(1),fixture_id(41)),(fixture_id(142),fixture_id(2),fixture_id(42));
insert into public.servico_pedidos values
(fixture_id(151),fixture_id(1),fixture_id(21),fixture_id(31),'granted',100,'DOC_BOLETIM_TRIMESTRAL','{}'),
(fixture_id(152),fixture_id(1),fixture_id(22),fixture_id(32),'granted',100,'DOC_BOLETIM_TRIMESTRAL','{}'),
(fixture_id(153),fixture_id(1),fixture_id(21),fixture_id(34),'granted',100,'DOC_DECLARACAO_NOTAS','{"origem":"documentos_emissao_individual"}');
insert into public.pagamento_intents values
(fixture_id(161),fixture_id(1),fixture_id(21),fixture_id(151),'pending'),
(fixture_id(162),fixture_id(1),fixture_id(22),fixture_id(152),'settled'),
(fixture_id(163),fixture_id(1),fixture_id(21),fixture_id(153),'settled');
insert into storage.objects values
(fixture_id(171),'pautas_oficiais_fechadas',fixture_id(1)::text||'/class.pdf'),
(fixture_id(172),'pautas_zip',fixture_id(1)::text||'/class.zip'),
(fixture_id(173),'other',fixture_id(1)::text||'/other.pdf'),
(fixture_id(174),'pautas_oficiais_fechadas',fixture_id(2)::text||'/class.pdf');

create materialized view internal.mv_boletim_por_matricula as
 select n.escola_id,n.matricula_id,m.aluno_id,m.turma_id,2026 as ano_letivo,cm.disciplina_id,
 'Synthetic'::text as disciplina_nome,'S'::text as disciplina_sigla,1 as trimestre,true as conta_para_media_med,
 '{}'::jsonb as notas_por_tipo,n.valor as nota_final,null::text as status,false as needs_config,
 1::bigint as total_avaliacoes,1::bigint as total_notas,0::bigint as missing_count,false as has_missing
 from public.notas n join public.matriculas m on m.id=n.matricula_id join public.avaliacoes av on av.id=n.avaliacao_id
 join public.turma_disciplinas td on td.id=av.turma_disciplina_id join public.curso_matriz cm on cm.id=td.curso_matriz_id;
create view public.vw_boletim_por_matricula with(security_invoker=true) as select * from internal.mv_boletim_por_matricula where escola_id=public.current_tenant_escola_id();
create view public.vw_boletim_consolidado with(security_invoker=true) as select * from public.notas;
create view public.vw_boletim_por_matricula_legacy with(security_invoker=true) as select * from public.notas;
create function public.resolve_estado_resultado_academico_base(p_matricula_id uuid,p_disciplina_id uuid) returns jsonb
language plpgsql security definer set search_path='public' as $$
declare v_escola uuid; v_turma uuid; v_ano uuid;
BEGIN
  SELECT m.escola_id, m.turma_id, al.id into v_escola,v_turma,v_ano from public.matriculas m cross join (select null::uuid as id) al where m.id=p_matricula_id;
  return jsonb_build_object('nota',16);
end $$;
grant select,insert,update,delete on all tables in schema public,storage to authenticated,anon;
grant select on internal.mv_boletim_por_matricula to authenticated,anon;
alter table public.notas enable row level security;
alter table public.notas_avaliacoes enable row level security;
alter table public.avaliacoes enable row level security;
alter table public.exame_resultados enable row level security;
alter table public.dependencias_academicas_transicao enable row level security;
alter table public.dependencias_academicas_transicao_eventos enable row level security;
alter table public.pautas_oficiais enable row level security;
alter table storage.objects enable row level security;
create policy notas_select_tenant on public.notas for select to authenticated using(true);
create policy tenant_or_super_admin_select on public.notas_avaliacoes for select to authenticated using(true);
create policy tenant_all_access on public.avaliacoes for all to authenticated using(true) with check(true);
create policy exame_resultados_read_v2 on public.exame_resultados for select to authenticated using(true);
create policy dependencias_academicas_transicao_select on public.dependencias_academicas_transicao for select to authenticated using(true);
create policy dependencias_academicas_eventos_select on public.dependencias_academicas_transicao_eventos for select to authenticated using(true);
create policy pautas_oficiais_select on public.pautas_oficiais for select to authenticated using(true);
create policy pautas_oficiais_insert on public.pautas_oficiais for insert to authenticated with check(true);
create policy pautas_oficiais_update on public.pautas_oficiais for update to authenticated using(true) with check(true);
create policy fixture_storage_permissive on storage.objects for all to authenticated,anon using(true) with check(true);
-- Deliberately overlapping policies verify the restrictive guards.
create policy fixture_legacy_notas on public.notas for select to authenticated using(true);
create policy fixture_legacy_avaliacoes on public.avaliacoes for all to authenticated using(true) with check(true);
