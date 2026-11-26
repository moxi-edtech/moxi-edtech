-- P0 complement: apply only after 20271204031000; never change academic
-- decisions, historical snapshots, fiscal state or payments.
begin;
set local lock_timeout='5s';

-- Publication is based on the exact school, enrollment, class and academic
-- session. Annual evidence is distinct from quarterly evidence.
create or replace function internal.klasse_grade_publication(p_escola uuid,p_matricula uuid,p_trimestre integer)
returns boolean language sql stable security definer set search_path='' as $$
 select exists (
  select 1 from public.matriculas m
  join public.pautas_oficiais p on p.escola_id=m.escola_id and p.turma_id=m.turma_id
  join public.periodos_letivos pl on pl.id=p.periodo_letivo_id and pl.escola_id=p.escola_id and pl.ano_letivo_id=m.session_id
  where m.escola_id=p_escola and m.id=p_matricula and p.status='SUCCESS'
  and nullif(btrim(p.pdf_path),'') is not null
  and ((p_trimestre between 1 and 3 and p.tipo='trimestral' and pl.tipo='TRIMESTRE' and pl.numero=p_trimestre)
    or (p_trimestre=0 and p.tipo='anual'))
 );
$$;

create or replace function internal.klasse_grade_portal_published(p_escola uuid,p_matricula uuid,p_trimestre integer)
returns boolean language sql stable security definer set search_path='' as $$
 select case when internal.klasse_grade_portal_paid(p_escola,p_matricula)
 then internal.klasse_grade_publication(p_escola,p_matricula,p_trimestre) else false end;
$$;

-- Internal sets reuse the same publication predicate as the direct RLS.
create or replace function internal.klasse_grade_published_terms(p_escola uuid)
returns table(matricula_id uuid,trimestre integer) language sql stable security definer set search_path='' as $$
 select ids.id,t.term from internal.klasse_grade_paid_matriculas(p_escola) ids(id)
 cross join generate_series(1,3) t(term)
 where internal.klasse_grade_publication(p_escola,ids.id,t.term);
$$;
revoke all on function internal.klasse_grade_publication(uuid,uuid,integer),internal.klasse_grade_portal_published(uuid,uuid,integer),
 internal.klasse_grade_published_terms(uuid) from public,anon,authenticated,service_role;
grant execute on function internal.klasse_grade_portal_published(uuid,uuid,integer),internal.klasse_grade_published_terms(uuid)
 to authenticated,service_role;

create index if not exists ix_klasse_pauta_publication
 on public.pautas_oficiais(escola_id,turma_id,tipo,periodo_letivo_id)
 where status='SUCCESS' and nullif(btrim(pdf_path),'') is not null;

-- Portal API consumes the database's publication decision, not a second
-- implementation based on locally fetched metadata.
create or replace function public.aluno_trimestres_publicados(p_escola_id uuid,p_matricula_id uuid)
returns integer[] language sql stable security definer set search_path='' as $$
 select coalesce(array_agg(t.term order by t.term),'{}'::integer[])
 from generate_series(1,3) t(term)
 where internal.klasse_grade_portal_published(p_escola_id,p_matricula_id,t.term);
$$;
create or replace function public.aluno_resultado_publicado(p_escola_id uuid,p_matricula_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select internal.klasse_grade_portal_published(p_escola_id,p_matricula_id,0);
$$;
revoke all on function public.aluno_trimestres_publicados(uuid,uuid),public.aluno_resultado_publicado(uuid,uuid)
 from public,anon,authenticated,service_role;
grant execute on function public.aluno_trimestres_publicados(uuid,uuid),public.aluno_resultado_publicado(uuid,uuid)
 to authenticated,service_role;

-- Preserve exact teacher assignment and staff access; only the portal branch
-- requires publication. Assessment period must match the enrollment session.
create or replace function internal.klasse_grade_assessment(p_avaliacao uuid,p_matricula uuid,p_escola uuid,p_aluno uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists (
  select 1 from public.avaliacoes av join public.matriculas m on m.id=p_matricula and m.escola_id=av.escola_id
  join public.turma_disciplinas td on td.id=av.turma_disciplina_id and td.escola_id=av.escola_id and td.turma_id=m.turma_id
  where av.id=p_avaliacao and (p_escola is null or av.escola_id=p_escola)
  and (p_aluno is null or m.aluno_id=p_aluno)
  and (internal.klasse_grade_staff(av.escola_id) or internal.klasse_grade_teacher(av.escola_id,td.id)
       or (exists(select 1 from public.periodos_letivos pl where pl.id=av.periodo_letivo_id and pl.escola_id=m.escola_id
       and pl.ano_letivo_id=m.session_id and pl.tipo='TRIMESTRE' and pl.numero=av.trimestre)
       and internal.klasse_grade_portal_published(av.escola_id,m.id,av.trimestre)))
 );
$$;

-- The annual resolver returns an aggregate grade, so a quarterly sheet alone
-- never authorizes it. Use the exact canonical discipline for teacher scope.
create or replace function internal.klasse_grade_scope(p_escola uuid,p_matricula uuid,p_disciplina uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists (
  select 1 from public.matriculas m where m.id=p_matricula and m.escola_id=p_escola
   and (internal.klasse_grade_staff(p_escola) or internal.klasse_grade_portal_published(p_escola,m.id,0)
   or (p_disciplina is not null and exists (
    select 1 from public.turma_disciplinas td join public.curso_matriz cm on cm.id=td.curso_matriz_id and cm.escola_id=td.escola_id
    where td.escola_id=p_escola and td.turma_id=m.turma_id
    and coalesce(td.avaliacao_disciplina_id,cm.avaliacao_disciplina_id,cm.disciplina_id)=p_disciplina
    and internal.klasse_grade_teacher(p_escola,td.id)
   )))
 );
$$;

-- Operational eligibility remains available without publication/payment.
create or replace function internal.klasse_progression_projection(p_escola uuid,p_matricula uuid,p_result jsonb)
returns jsonb language sql stable security definer set search_path='' as $$
 select case when p_result is null then null
 when internal.klasse_grade_trusted() or internal.klasse_grade_staff(p_escola) or internal.klasse_grade_portal_published(p_escola,p_matricula,0)
 then p_result
 else jsonb_build_object(
 'decision',p_result->'decision','destino',p_result->'destino','motivo',p_result->'motivo',
 'regime',p_result->'regime','etapa_destino',p_result->'etapa_destino',
 'disciplina_ids_pendentes',coalesce(p_result->'disciplina_ids_pendentes','[]'::jsonb),
 'efetivacao_matricula_bloqueada',coalesce(p_result->'efetivacao_matricula_bloqueada','false'::jsonb),
 'disciplinas','[]'::jsonb,'grade_details_restricted',true) end;
$$;

create or replace view public.vw_boletim_por_matricula
 with (security_invoker=false,security_barrier=true) as
 select escola_id,matricula_id,aluno_id,turma_id,ano_letivo,disciplina_id,
 disciplina_nome,disciplina_sigla,trimestre,conta_para_media_med,notas_por_tipo,
 nota_final,status,needs_config,total_avaliacoes,total_notas,missing_count,has_missing
 from internal.mv_boletim_por_matricula b
 where b.escola_id=(select public.current_tenant_escola_id())
 and ((select internal.klasse_grade_staff(public.current_tenant_escola_id()))
 or (((b.matricula_id,b.trimestre) in (select t.matricula_id,t.trimestre from internal.klasse_grade_published_terms(public.current_tenant_escola_id()) t)
 or (b.turma_id,b.disciplina_id) in (select t.turma_id,t.disciplina_id from internal.klasse_grade_teacher_subjects(public.current_tenant_escola_id()) t))
 and exists (select 1 from public.matriculas m where m.id=b.matricula_id and m.escola_id=b.escola_id and m.turma_id=b.turma_id and m.aluno_id=b.aluno_id)));

-- Annual history is available through institutional roles or paid, published,
-- closed snapshots of the exact enrollment. Null or mismatched legacy IDs
-- are intentionally staff-only. Documents with separate service contracts
-- continue to be issued through their own guarded RPC, not these raw tables.
create or replace function internal.klasse_history_read(p_escola uuid,p_matricula uuid,p_aluno uuid,p_session uuid,p_turma uuid,p_snapshot text)
returns boolean language sql stable security definer set search_path='' as $$
 select internal.klasse_grade_staff(p_escola) or (
 p_snapshot='fechado' and exists(select 1 from public.matriculas m
 where m.id=p_matricula and m.escola_id=p_escola and m.aluno_id=p_aluno and m.session_id=p_session and m.turma_id=p_turma
 and internal.klasse_grade_portal_published(p_escola,m.id,0)));
$$;
revoke all on function internal.klasse_history_read(uuid,uuid,uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function internal.klasse_history_read(uuid,uuid,uuid,uuid,uuid,text) to authenticated,service_role;

alter table public.historico_anos enable row level security;
alter table public.historico_disciplinas enable row level security;
drop policy if exists tenant_or_super_admin_select on public.historico_anos;
create policy tenant_or_super_admin_select on public.historico_anos for select to authenticated
 using (internal.klasse_history_read(escola_id,matricula_id,aluno_id,ano_letivo_id,turma_id,snapshot_status));
create policy klasse_history_read_boundary on public.historico_anos as restrictive for select to authenticated
 using (internal.klasse_history_read(escola_id,matricula_id,aluno_id,ano_letivo_id,turma_id,snapshot_status));
drop policy if exists tenant_or_super_admin_select on public.historico_disciplinas;
create policy tenant_or_super_admin_select on public.historico_disciplinas for select to authenticated
 using (exists(select 1 from public.historico_anos h where h.id=historico_ano_id));
create policy klasse_history_subject_read_boundary on public.historico_disciplinas as restrictive for select to authenticated
 using (exists(select 1 from public.historico_anos h where h.id=historico_ano_id));

-- Reappraisal exposes a numeric reference and must not be tenant-wide.
-- Existing filing/decision permissions are unchanged.
create or replace function internal.klasse_review_read(p_escola uuid,p_matricula uuid,p_aluno uuid,p_session uuid,p_turma uuid,p_td uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.matriculas m join public.turma_disciplinas td
 on td.id=p_td and td.escola_id=m.escola_id and td.turma_id=m.turma_id
 where m.id=p_matricula and m.escola_id=p_escola and m.aluno_id=p_aluno and m.session_id=p_session and m.turma_id=p_turma
 and (internal.klasse_grade_staff(p_escola) or internal.klasse_grade_portal_published(p_escola,m.id,0)));
$$;
revoke all on function internal.klasse_review_read(uuid,uuid,uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function internal.klasse_review_read(uuid,uuid,uuid,uuid,uuid,uuid) to authenticated,service_role;
alter table public.reapreciacao_pedidos enable row level security;
drop policy if exists reapreciacao_pedidos_school_read on public.reapreciacao_pedidos;
create policy reapreciacao_pedidos_school_read on public.reapreciacao_pedidos for select to authenticated
 using (internal.klasse_review_read(escola_id,matricula_id,aluno_id,ano_letivo_id,turma_id,turma_disciplina_id));
create policy klasse_review_read_boundary on public.reapreciacao_pedidos as restrictive for select to authenticated
 using (internal.klasse_review_read(escola_id,matricula_id,aluno_id,ano_letivo_id,turma_id,turma_disciplina_id));

-- Exams/carryovers contain annual results or original-grade snapshots.
create policy klasse_exam_publication_boundary on public.exame_resultados as restrictive for select to authenticated
 using (internal.klasse_grade_staff(escola_id) or internal.klasse_grade_teacher(escola_id,turma_disciplina_id)
 or internal.klasse_grade_portal_published(escola_id,matricula_id,0));
create policy klasse_dependency_publication_boundary on public.dependencias_academicas_transicao as restrictive for select to authenticated
 using (internal.klasse_grade_staff(escola_id) or internal.klasse_grade_portal_published(escola_id,matricula_origem_id,0));

revoke all on public.historico_anos,public.historico_disciplinas,public.reapreciacao_pedidos from public,anon;
commit;
