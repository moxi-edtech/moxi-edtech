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

insert into public.escola_users select public.fixture_id(s),public.fixture_id(u),p from (values
(1,11,'aluno'),(1,12,'aluno'),(2,13,'aluno'),(1,14,'encarregado'),(1,15,'professor'),(1,16,'professor'),(1,17,'secretaria')) q(s,u,p);
insert into public.alunos select public.fixture_id(a),public.fixture_id(s),public.fixture_id(u),null from (values (21,1,11),(22,1,12),(23,2,13)) q(a,s,u);
insert into public.matriculas select public.fixture_id(m),public.fixture_id(s),public.fixture_id(a),public.fixture_id(t) from (values (31,1,21,41),(32,1,22,41),(33,2,23,42),(34,1,21,41)) q(m,s,a,t);
insert into public.encarregados values(public.fixture_id(51),public.fixture_id(1),'guardian@example.invalid');
insert into public.aluno_encarregados values(public.fixture_id(1),public.fixture_id(21),public.fixture_id(51));
insert into public.professores select public.fixture_id(p),public.fixture_id(1),public.fixture_id(u) from (values(61,15),(62,16)) q(p,u);
insert into public.curso_matriz select public.fixture_id(m),public.fixture_id(s),public.fixture_id(d),public.fixture_id(d) from (values(71,1,81),(72,1,82),(73,2,81)) q(m,s,d);
insert into public.turma_disciplinas select public.fixture_id(td),public.fixture_id(s),public.fixture_id(t),public.fixture_id(cm),case when pr is null then null else public.fixture_id(pr) end,public.fixture_id(d) from (values
(91,1,41,71,61,81),(92,1,41,72,62,82),(93,2,42,73,null,81)) q(td,s,t,cm,pr,d);
insert into public.avaliacoes select public.fixture_id(av),public.fixture_id(s),public.fixture_id(td) from (values (101,1,91),(102,1,92),(103,2,93)) q(av,s,td);
insert into public.notas select public.fixture_id(n),public.fixture_id(s),public.fixture_id(av),public.fixture_id(m),v from (values
(111,1,101,31,16),(112,1,102,31,17),(113,1,101,32,18),(114,2,103,33,19),(115,1,101,34,12)) q(n,s,av,m,v);
insert into public.notas_avaliacoes select n.id,n.avaliacao_id,n.matricula_id,m.aluno_id,n.valor from public.notas n join public.matriculas m on m.id=n.matricula_id;
insert into public.exame_resultados values(public.fixture_id(121),public.fixture_id(1),public.fixture_id(91),public.fixture_id(31),16);
insert into public.dependencias_academicas_transicao values(public.fixture_id(131),public.fixture_id(1),public.fixture_id(34),12);
insert into public.dependencias_academicas_transicao_eventos values(public.fixture_id(132),public.fixture_id(1),public.fixture_id(131),'{"nota":12}');
insert into public.pautas_oficiais values(public.fixture_id(141),public.fixture_id(1),public.fixture_id(41)),(public.fixture_id(142),public.fixture_id(2),public.fixture_id(42));
insert into public.servico_pedidos values
(public.fixture_id(151),public.fixture_id(1),public.fixture_id(21),public.fixture_id(31),'granted',100,'DOC_BOLETIM_TRIMESTRAL','{}'),
(public.fixture_id(152),public.fixture_id(1),public.fixture_id(22),public.fixture_id(32),'granted',100,'DOC_BOLETIM_TRIMESTRAL','{}'),
(public.fixture_id(153),public.fixture_id(1),public.fixture_id(21),public.fixture_id(34),'granted',100,'DOC_DECLARACAO_NOTAS','{"origem":"documentos_emissao_individual"}');
insert into public.pagamento_intents values
(public.fixture_id(161),public.fixture_id(1),public.fixture_id(21),public.fixture_id(151),'pending'),
(public.fixture_id(162),public.fixture_id(1),public.fixture_id(22),public.fixture_id(152),'settled'),
(public.fixture_id(163),public.fixture_id(1),public.fixture_id(21),public.fixture_id(153),'settled');
insert into storage.objects values
(public.fixture_id(171),'pautas_oficiais_fechadas',public.fixture_id(1)::text||'/class.pdf'),
(public.fixture_id(172),'pautas_zip',public.fixture_id(1)::text||'/class.zip'),
(public.fixture_id(173),'other',public.fixture_id(1)::text||'/other.pdf'),
(public.fixture_id(174),'pautas_oficiais_fechadas',public.fixture_id(2)::text||'/class.pdf');

create materialized view internal.mv_boletim_por_matricula as
 select n.escola_id,n.matricula_id,m.aluno_id,m.turma_id,2026 as ano_letivo,cm.disciplina_id,
 'Synthetic'::text as disciplina_nome,'S'::text as disciplina_sigla,1 as trimestre,true as conta_para_media_med,
 '{}'::jsonb as notas_por_tipo,n.valor as nota_final,null::text as status,false as needs_config,
 1::bigint as total_avaliacoes,1::bigint as total_notas,0::bigint as missing_count,false as has_missing
 from public.notas n join public.matriculas m on m.id=n.matricula_id join public.avaliacoes av on av.id=n.avaliacao_id
 join public.turma_disciplinas td on td.id=av.turma_disciplina_id join public.curso_matriz cm on cm.id=td.curso_matriz_id;
create unique index ux_mv_boletim_por_matricula on internal.mv_boletim_por_matricula(escola_id,matricula_id,disciplina_id,trimestre);
create view public.vw_boletim_por_matricula with(security_invoker=true) as select * from internal.mv_boletim_por_matricula where escola_id=public.current_tenant_escola_id();
create view public.vw_boletim_consolidado with(security_invoker=true) as select * from public.notas;
create view public.vw_boletim_por_matricula_legacy with(security_invoker=true) as select * from public.notas;
create function public.resolve_estado_resultado_academico_base(p_matricula_id uuid,p_disciplina_id uuid) returns jsonb
language plpgsql security definer set search_path='public' as $$
declare v_escola uuid; v_turma uuid; v_ano uuid;
BEGIN
  SELECT m.escola_id, m.turma_id, al.id into v_escola,v_turma,v_ano from public.matriculas m cross join (select null::uuid as id) al where m.id=p_matricula_id;
  return jsonb_build_object('nota',16,'status','aprovado');
end $$;
-- Synthetic legal-engine shapes mirror production call graph; actual migration
-- clones them and replaces the public entry points.
create function public.resolve_estado_resultado(p_matricula_id uuid,p_disciplina_id uuid) returns jsonb
language sql stable as $$ select public.resolve_estado_resultado_academico_base(p_matricula_id,p_disciplina_id) $$;
create function public.resolve_raa_eja_oficial(p_escola_id uuid,p_matricula_id uuid) returns jsonb
language plpgsql stable security definer as $$
begin
 IF NOT EXISTS(SELECT 1 FROM public.escola_users eu WHERE eu.escola_id=p_escola_id AND eu.user_id=auth.uid() AND eu.papel='secretaria')
 AND NOT (auth.uid() IS NULL AND coalesce(current_setting('role',true),'')='service_role') THEN
 raise exception 'ACADEMIC_FORBIDDEN' using errcode='42501'; end if;
 return jsonb_build_object('decision','transitou','destino','proxima_etapa','disciplinas',jsonb_build_array(jsonb_build_object('suficiente',true,'evidence_id',public.fixture_id(81))));
end $$;
create function public.resolve_raa_decreto_for_matricula(p_escola_id uuid,p_matricula_id uuid) returns jsonb
language sql stable security definer as $$
 select jsonb_build_object('decision','transitou','destino','proxima_etapa','motivo','sem_pendencias',
 'regime',jsonb_build_object('nivel_ensino','secundario','classe_num',7),'disciplinas',
 jsonb_build_array(public.resolve_estado_resultado(p_matricula_id,public.fixture_id(81)) || jsonb_build_object('nota_final',16)),
 'disciplina_ids_pendentes','[]'::jsonb,'efetivacao_matricula_bloqueada',false)
$$;
create function public.resolve_raa_progression_for_matricula_generic(p_escola_id uuid,p_matricula_id uuid) returns jsonb
language sql stable security definer as $$ select public.resolve_raa_decreto_for_matricula(p_escola_id,p_matricula_id) $$;
create function public.resolve_raa_progression_for_matricula(p_escola_id uuid,p_matricula_id uuid) returns jsonb
language sql stable security definer as $$ select public.resolve_raa_decreto_for_matricula(p_escola_id,p_matricula_id) $$;
create function public.aluno_iniciar_rematricula(p_matricula_id uuid,p_servicos_ids uuid[]) returns jsonb
language sql security definer as $$ select jsonb_build_object('eligible',public.resolve_raa_progression_for_matricula(public.current_tenant_escola_id(),p_matricula_id)->>'decision'='transitou') $$;
create table public.periodos_letivos(id uuid primary key,escola_id uuid,ano_letivo_id uuid);
insert into public.periodos_letivos values(public.fixture_id(181),public.fixture_id(1),public.fixture_id(191)),(public.fixture_id(182),public.fixture_id(2),public.fixture_id(192));
create function public.get_teacher_compliance_status(p_teacher_ids uuid[],p_trimestre_id uuid) returns table(teacher_id uuid,status text)
language plpgsql security definer as $$
declare v_escola_id uuid; v_ano_letivo_id uuid;
begin
 select escola_id,ano_letivo_id into v_escola_id,v_ano_letivo_id from public.periodos_letivos where id=p_trimestre_id;
  -- Se não encontrar o trimestre, retorna tudo como OK para não alarmar
 return query select unnest(p_teacher_ids),'OK'::text;
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
