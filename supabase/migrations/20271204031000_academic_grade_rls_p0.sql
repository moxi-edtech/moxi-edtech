-- P0: grade data authorization is enforced at the database boundary.
-- No fiscal tables, payment writes, historical records, or MV refresh logic changed.
begin;

create or replace function internal.klasse_grade_staff(p_escola uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select coalesce(p_escola = public.current_tenant_escola_id(), false)
 and (public.is_super_admin() or exists (
   select 1 from public.escola_users eu where eu.escola_id=p_escola and eu.user_id=(select auth.uid())
   and eu.papel::text in ('admin','admin_escola','staff_admin','diretor','diretor_pedagogico','secretaria','admin_secretaria','admin_secretario','admin_financeiro','secretaria_financeiro')
 ));
$$;

create or replace function internal.klasse_grade_teacher(p_escola uuid,p_td uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select coalesce(p_escola=public.current_tenant_escola_id(),false) and exists (
  select 1 from public.turma_disciplinas td
  join public.curso_matriz cm on cm.id=td.curso_matriz_id and cm.escola_id=td.escola_id
  join public.professores pr on pr.escola_id=td.escola_id and pr.profile_id=(select auth.uid())
  join public.escola_users eu on eu.escola_id=pr.escola_id and eu.user_id=pr.profile_id and eu.papel::text='professor'
  where td.id=p_td and td.escola_id=p_escola
    and (td.professor_id=pr.id or exists (
      select 1 from public.turma_disciplinas_professores tdp where tdp.escola_id=td.escola_id
      and tdp.turma_id=td.turma_id and tdp.disciplina_id=cm.disciplina_id and tdp.professor_id=pr.id
    ))
 );
$$;

-- Separate identity, payment and eligibility. No caller-controlled bypass flags.
create or replace function internal.klasse_grade_portal_owner(p_escola uuid,p_matricula uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select coalesce(p_escola=public.current_tenant_escola_id(),false) and (select auth.uid()) is not null and exists (
 select 1 from public.matriculas m join public.alunos a on a.id=m.aluno_id and a.escola_id=m.escola_id
 where m.id=p_matricula and m.escola_id=p_escola and
 (a.profile_id=(select auth.uid()) or a.usuario_auth_id=(select auth.uid()) or exists (
 select 1 from public.aluno_encarregados ae join public.encarregados e on e.id=ae.encarregado_id and e.escola_id=ae.escola_id
 where ae.escola_id=p_escola and ae.aluno_id=a.id
 and nullif(lower(trim(auth.jwt()->>'email')),'') is not null
 and lower(trim(e.email))=lower(trim(auth.jwt()->>'email'))
 )));
$$;

-- A single financial predicate shared by direct RLS, the read model and the portal.
create or replace function internal.klasse_boletim_settled(p_escola uuid,p_aluno uuid,p_matricula uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists (
 select 1 from public.servico_pedidos s join public.pagamento_intents pi
 on pi.servico_pedido_id=s.id and pi.escola_id=s.escola_id and pi.aluno_id=s.aluno_id
 where s.escola_id=p_escola and s.aluno_id=p_aluno and s.matricula_id=p_matricula
 and s.status='granted' and s.valor_cobrado>0 and pi.status='settled'
 and s.servico_codigo in ('DOC_BOLETIM_TRIMESTRAL','DOC_DECLARACAO_NOTAS')
 and (s.servico_codigo='DOC_BOLETIM_TRIMESTRAL' or (
 coalesce(s.contexto->>'origem','') not in ('documentos_emissao_individual','portal_aluno_documentos')
 and coalesce(s.contexto->>'tipo_documento','')<>'declaracao_notas')));
$$;

create or replace function internal.klasse_grade_portal_paid(p_escola uuid,p_matricula uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select case when internal.klasse_grade_portal_owner(p_escola,p_matricula)
 then exists (select 1 from public.matriculas m where m.id=p_matricula and m.escola_id=p_escola
 and internal.klasse_boletim_settled(m.escola_id,m.aluno_id,m.id)) else false end;
$$;

create index if not exists ix_klasse_boletim_granted_scope
 on public.servico_pedidos(escola_id,aluno_id,matricula_id,servico_codigo)
 where status='granted' and valor_cobrado>0 and servico_codigo in ('DOC_BOLETIM_TRIMESTRAL','DOC_DECLARACAO_NOTAS');
create index if not exists ix_klasse_boletim_settled_intent
 on public.pagamento_intents(escola_id,aluno_id,servico_pedido_id) where status='settled';

-- Uncorrelated sets allow the planner to authorize a student's enrollments and
-- teacher's subject assignments once per view query, rather than per grade row.
create or replace function internal.klasse_grade_paid_matriculas(p_escola uuid)
returns setof uuid language sql stable security definer set search_path = '' as $$
 select m.id from public.matriculas m
 where m.escola_id=p_escola and coalesce(p_escola=public.current_tenant_escola_id(),false)
 and (select auth.uid()) is not null
 and m.aluno_id in (
 select a.id from public.alunos a where a.escola_id=p_escola and
 (a.profile_id=(select auth.uid()) or a.usuario_auth_id=(select auth.uid()))
 union
 select ae.aluno_id from public.aluno_encarregados ae join public.encarregados e
 on e.id=ae.encarregado_id and e.escola_id=ae.escola_id
 where ae.escola_id=p_escola and nullif(lower(trim(auth.jwt()->>'email')),'') is not null
 and lower(trim(e.email))=lower(trim(auth.jwt()->>'email'))
 )
 and internal.klasse_boletim_settled(m.escola_id,m.aluno_id,m.id);
$$;

create or replace function internal.klasse_grade_teacher_subjects(p_escola uuid)
returns table(turma_id uuid,disciplina_id uuid) language sql stable security definer set search_path = '' as $$
 select distinct td.turma_id,d.disciplina_id
 from public.professores pr join public.escola_users eu on eu.escola_id=pr.escola_id and eu.user_id=pr.profile_id and eu.papel::text='professor'
 join public.turma_disciplinas td on td.escola_id=pr.escola_id
 join public.curso_matriz cm on cm.id=td.curso_matriz_id and cm.escola_id=td.escola_id
 cross join lateral (values (cm.disciplina_id),(td.avaliacao_disciplina_id),(cm.avaliacao_disciplina_id)) d(disciplina_id)
 where pr.escola_id=p_escola and p_escola=public.current_tenant_escola_id() and pr.profile_id=(select auth.uid())
 and d.disciplina_id is not null
 and (td.professor_id=pr.id or exists (select 1 from public.turma_disciplinas_professores tdp
 where tdp.escola_id=td.escola_id and tdp.turma_id=td.turma_id and tdp.disciplina_id=cm.disciplina_id and tdp.professor_id=pr.id));
$$;

-- Only privileged server sessions may bypass identity checks, never payment.
create or replace function internal.klasse_grade_trusted()
returns boolean language sql stable set search_path = '' as $$
 select coalesce(current_setting('role',true),'')='service_role'
 or ((select auth.uid()) is null and coalesce(current_setting('role',true),'') in ('none','postgres','supabase_admin')
 and session_user in ('postgres','supabase_admin'));
$$;

revoke all on function internal.klasse_grade_portal_owner(uuid,uuid),internal.klasse_boletim_settled(uuid,uuid,uuid),
 internal.klasse_grade_paid_matriculas(uuid),internal.klasse_grade_teacher_subjects(uuid),internal.klasse_grade_trusted()
 from public,anon,authenticated,service_role;
grant execute on function internal.klasse_grade_paid_matriculas(uuid),internal.klasse_grade_teacher_subjects(uuid)
 to authenticated,service_role;

create or replace function public.aluno_boletim_pago(p_escola_id uuid,p_aluno_id uuid,p_matricula_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists (select 1 from public.matriculas m where m.escola_id=p_escola_id and m.id=p_matricula_id and m.aluno_id=p_aluno_id
 and (internal.klasse_grade_trusted() or internal.klasse_grade_staff(m.escola_id) or internal.klasse_grade_portal_owner(m.escola_id,m.id))
 and internal.klasse_boletim_settled(m.escola_id,m.aluno_id,m.id));
$$;
revoke all on function public.aluno_boletim_pago(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.aluno_boletim_pago(uuid,uuid,uuid) to authenticated,service_role;

create or replace function internal.klasse_grade_scope(p_escola uuid,p_matricula uuid,p_disciplina uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists (
  select 1 from public.matriculas m where m.id=p_matricula and m.escola_id=p_escola
   and (internal.klasse_grade_staff(p_escola) or internal.klasse_grade_portal_paid(p_escola,m.id)
   or (p_disciplina is not null and exists (
    select 1 from public.turma_disciplinas td join public.curso_matriz cm on cm.id=td.curso_matriz_id and cm.escola_id=td.escola_id
    where td.escola_id=p_escola and td.turma_id=m.turma_id
    and p_disciplina in (cm.disciplina_id,td.avaliacao_disciplina_id,cm.avaliacao_disciplina_id)
    and internal.klasse_grade_teacher(p_escola,td.id)
   )))
 );
$$;

create or replace function internal.klasse_grade_assessment(p_avaliacao uuid,p_matricula uuid,p_escola uuid,p_aluno uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists (
  select 1 from public.avaliacoes av join public.matriculas m on m.id=p_matricula and m.escola_id=av.escola_id
  join public.turma_disciplinas td on td.id=av.turma_disciplina_id and td.escola_id=av.escola_id and td.turma_id=m.turma_id
  where av.id=p_avaliacao and (p_escola is null or av.escola_id=p_escola)
  and (p_aluno is null or m.aluno_id=p_aluno)
  and (internal.klasse_grade_staff(av.escola_id) or internal.klasse_grade_teacher(av.escola_id,td.id)
       or internal.klasse_grade_portal_paid(av.escola_id,m.id))
 );
$$;

-- Curriculum/assessment metadata is visible only to a student's own class.
create or replace function internal.klasse_grade_portal_turma(p_escola uuid,p_turma uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select coalesce(p_escola=public.current_tenant_escola_id(),false) and (select auth.uid()) is not null and exists (
  select 1 from public.matriculas m join public.alunos a on a.id=m.aluno_id and a.escola_id=m.escola_id
  where m.escola_id=p_escola and m.turma_id=p_turma and
  (a.profile_id=(select auth.uid()) or a.usuario_auth_id=(select auth.uid()) or exists (
    select 1 from public.aluno_encarregados ae join public.encarregados e on e.id=ae.encarregado_id and e.escola_id=ae.escola_id
    where ae.escola_id=p_escola and ae.aluno_id=a.id and nullif(lower(trim(auth.jwt()->>'email')),'') is not null
      and lower(trim(e.email))=lower(trim(auth.jwt()->>'email'))
  ))
 );
$$;

create or replace function internal.klasse_grade_assessment_metadata(p_escola uuid,p_td uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select internal.klasse_grade_staff(p_escola) or internal.klasse_grade_teacher(p_escola,p_td) or exists (
 select 1 from public.turma_disciplinas td where td.escola_id=p_escola and td.id=p_td
 and internal.klasse_grade_portal_turma(p_escola,td.turma_id)
 );
$$;

create or replace function internal.klasse_grade_pauta_metadata(p_escola uuid,p_turma uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select internal.klasse_grade_staff(p_escola) or internal.klasse_grade_portal_turma(p_escola,p_turma)
 or exists (select 1 from public.turma_disciplinas td where td.escola_id=p_escola and td.turma_id=p_turma
   and internal.klasse_grade_teacher(p_escola,td.id));
$$;

-- The internal schema is already used by the existing read model. Only explicit
-- helpers are executable; no raw MV grant is retained for end-user roles.
revoke all on function internal.klasse_grade_staff(uuid),internal.klasse_grade_teacher(uuid,uuid),
 internal.klasse_grade_portal_paid(uuid,uuid),internal.klasse_grade_scope(uuid,uuid,uuid),
 internal.klasse_grade_assessment(uuid,uuid,uuid,uuid),internal.klasse_grade_portal_turma(uuid,uuid),
 internal.klasse_grade_assessment_metadata(uuid,uuid),internal.klasse_grade_pauta_metadata(uuid,uuid)
 from public,anon,authenticated;
grant execute on function internal.klasse_grade_staff(uuid),internal.klasse_grade_teacher(uuid,uuid),
 internal.klasse_grade_portal_paid(uuid,uuid),internal.klasse_grade_scope(uuid,uuid,uuid),
 internal.klasse_grade_assessment(uuid,uuid,uuid,uuid),internal.klasse_grade_portal_turma(uuid,uuid),
 internal.klasse_grade_assessment_metadata(uuid,uuid),internal.klasse_grade_pauta_metadata(uuid,uuid)
 to authenticated,service_role;

-- RESTRICTIVE policies cannot be bypassed by another permissive SELECT policy.
-- Replace known legacy policies as well, including the old tenant-wide ALL policy.
drop policy if exists notas_select_tenant on public.notas;
create policy notas_select_tenant on public.notas for select to authenticated
 using (internal.klasse_grade_assessment(avaliacao_id,matricula_id,escola_id,null));
create policy klasse_notas_read_boundary on public.notas as restrictive for select to authenticated
 using (internal.klasse_grade_assessment(avaliacao_id,matricula_id,escola_id,null));

drop policy if exists tenant_or_super_admin_select on public.notas_avaliacoes;
create policy tenant_or_super_admin_select on public.notas_avaliacoes for select to authenticated
 using (internal.klasse_grade_assessment(avaliacao_id,matricula_id,null,aluno_id));
create policy klasse_notas_avaliacoes_read_boundary on public.notas_avaliacoes as restrictive for select to authenticated
 using (internal.klasse_grade_assessment(avaliacao_id,matricula_id,null,aluno_id));

drop policy if exists tenant_all_access on public.avaliacoes;
create policy klasse_avaliacoes_read on public.avaliacoes for select to authenticated
 using (internal.klasse_grade_assessment_metadata(escola_id,turma_disciplina_id));
create policy klasse_avaliacoes_read_boundary on public.avaliacoes as restrictive for select to authenticated
 using (internal.klasse_grade_assessment_metadata(escola_id,turma_disciplina_id));
create policy klasse_avaliacoes_insert on public.avaliacoes for insert to authenticated
 with check (internal.klasse_grade_staff(escola_id) or internal.klasse_grade_teacher(escola_id,turma_disciplina_id));
create policy klasse_avaliacoes_update on public.avaliacoes for update to authenticated
 using (internal.klasse_grade_staff(escola_id) or internal.klasse_grade_teacher(escola_id,turma_disciplina_id))
 with check (internal.klasse_grade_staff(escola_id) or internal.klasse_grade_teacher(escola_id,turma_disciplina_id));
create policy klasse_avaliacoes_delete on public.avaliacoes for delete to authenticated
 using (internal.klasse_grade_staff(escola_id) or internal.klasse_grade_teacher(escola_id,turma_disciplina_id));

drop policy if exists exame_resultados_read_v2 on public.exame_resultados;
create policy exame_resultados_read_v2 on public.exame_resultados for select to authenticated
 using (internal.klasse_grade_staff(escola_id) or internal.klasse_grade_teacher(escola_id,turma_disciplina_id)
 or internal.klasse_grade_portal_paid(escola_id,matricula_id));
create policy klasse_exame_resultados_read_boundary on public.exame_resultados as restrictive for select to authenticated
 using (internal.klasse_grade_staff(escola_id) or internal.klasse_grade_teacher(escola_id,turma_disciplina_id)
 or internal.klasse_grade_portal_paid(escola_id,matricula_id));

-- Prevent a second permissive write policy from reopening tenant-wide writes.
create policy klasse_avaliacoes_insert_boundary on public.avaliacoes as restrictive for insert to authenticated
 with check (internal.klasse_grade_staff(escola_id) or internal.klasse_grade_teacher(escola_id,turma_disciplina_id));
create policy klasse_avaliacoes_update_boundary on public.avaliacoes as restrictive for update to authenticated
 using (internal.klasse_grade_staff(escola_id) or internal.klasse_grade_teacher(escola_id,turma_disciplina_id))
 with check (internal.klasse_grade_staff(escola_id) or internal.klasse_grade_teacher(escola_id,turma_disciplina_id));
create policy klasse_avaliacoes_delete_boundary on public.avaliacoes as restrictive for delete to authenticated
 using (internal.klasse_grade_staff(escola_id) or internal.klasse_grade_teacher(escola_id,turma_disciplina_id));
create policy klasse_exame_resultados_insert_boundary on public.exame_resultados as restrictive for insert to authenticated
 with check (internal.klasse_grade_staff(escola_id) or internal.klasse_grade_teacher(escola_id,turma_disciplina_id));

-- A dependency carries the source grade; payment for a different year's
-- enrollment must not unlock it.
drop policy if exists dependencias_academicas_transicao_select on public.dependencias_academicas_transicao;
create policy dependencias_academicas_transicao_select on public.dependencias_academicas_transicao for select to authenticated
 using (internal.klasse_grade_staff(escola_id) or internal.klasse_grade_portal_paid(escola_id,matricula_origem_id));
create policy klasse_dependencias_read_boundary on public.dependencias_academicas_transicao as restrictive for select to authenticated
 using (internal.klasse_grade_staff(escola_id) or internal.klasse_grade_portal_paid(escola_id,matricula_origem_id));
drop policy if exists dependencias_academicas_eventos_select on public.dependencias_academicas_transicao_eventos;
create policy dependencias_academicas_eventos_select on public.dependencias_academicas_transicao_eventos for select to authenticated
 using (exists(select 1 from public.dependencias_academicas_transicao d
   where d.id=dependencia_id and d.escola_id=dependencias_academicas_transicao_eventos.escola_id));

create policy klasse_dependencias_eventos_read_boundary on public.dependencias_academicas_transicao_eventos as restrictive for select to authenticated
 using (exists(select 1 from public.dependencias_academicas_transicao d
 where d.id=dependencia_id and d.escola_id=dependencias_academicas_transicao_eventos.escola_id));

-- Materialized views have no row-level security. Do not expose raw MV access.
-- Deliberately owner-executed security-barrier view: explicit row authorization
-- is required because invoker access to the underlying MV would re-open the leak.
create or replace view public.vw_boletim_por_matricula
 with (security_invoker=false,security_barrier=true) as
 select escola_id,matricula_id,aluno_id,turma_id,ano_letivo,disciplina_id,
 disciplina_nome,disciplina_sigla,trimestre,conta_para_media_med,notas_por_tipo,
 nota_final,status,needs_config,total_avaliacoes,total_notas,missing_count,has_missing
 from internal.mv_boletim_por_matricula b
 where b.escola_id=(select public.current_tenant_escola_id())
 and ((select internal.klasse_grade_staff(public.current_tenant_escola_id()))
 or ((b.matricula_id in (select internal.klasse_grade_paid_matriculas(public.current_tenant_escola_id()))
 or (b.turma_id,b.disciplina_id) in (select t.turma_id,t.disciplina_id from internal.klasse_grade_teacher_subjects(public.current_tenant_escola_id()) t))
 and exists (select 1 from public.matriculas m where m.id=b.matricula_id and m.escola_id=b.escola_id and m.turma_id=b.turma_id and m.aluno_id=b.aluno_id)));
revoke all on internal.mv_boletim_por_matricula from public,anon,authenticated;
grant select on internal.mv_boletim_por_matricula to service_role;
revoke all on public.vw_boletim_por_matricula from public,anon;
grant select on public.vw_boletim_por_matricula to authenticated;
revoke all on public.notas,public.notas_avaliacoes,public.avaliacoes,public.exame_resultados,public.pautas_oficiais from anon;
revoke select on public.vw_boletim_consolidado,public.vw_boletim_por_matricula_legacy from anon;

-- Keep official publication metadata for the student's own class; class PDFs
-- contain other pupils' data and are staff-only in Storage.
drop policy if exists pautas_oficiais_select on public.pautas_oficiais;
create policy pautas_oficiais_select on public.pautas_oficiais for select to authenticated
 using (internal.klasse_grade_pauta_metadata(escola_id,turma_id));
drop policy if exists pautas_oficiais_insert on public.pautas_oficiais;
create policy pautas_oficiais_insert on public.pautas_oficiais for insert to authenticated
 with check (internal.klasse_grade_staff(escola_id));
drop policy if exists pautas_oficiais_update on public.pautas_oficiais;
create policy pautas_oficiais_update on public.pautas_oficiais for update to authenticated
 using (internal.klasse_grade_staff(escola_id)) with check (internal.klasse_grade_staff(escola_id));

-- Use text matching to avoid invalid UUID casts on arbitrary object paths.
create or replace function internal.klasse_grade_storage_staff(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists (select 1 from public.escola_users eu
 where eu.user_id=(select auth.uid()) and eu.escola_id::text=split_part(p_name,'/',1)
 and internal.klasse_grade_staff(eu.escola_id))
 or (public.is_super_admin() and public.current_tenant_escola_id()::text=split_part(p_name,'/',1));
$$;
revoke all on function internal.klasse_grade_storage_staff(text) from public,anon,authenticated;
grant execute on function internal.klasse_grade_storage_staff(text) to authenticated,service_role;

-- Restrictive storage guard protects against any overlapping permissive policy.
create policy klasse_pauta_storage_boundary on storage.objects as restrictive for all to authenticated
 using (bucket_id not in ('pautas_oficiais_fechadas','pautas_zip') or internal.klasse_grade_storage_staff(name))
 with check (bucket_id not in ('pautas_oficiais_fechadas','pautas_zip') or internal.klasse_grade_storage_staff(name));
create policy klasse_pauta_storage_anon_boundary on storage.objects as restrictive for all to anon
 using (bucket_id not in ('pautas_oficiais_fechadas','pautas_zip'))
 with check (bucket_id not in ('pautas_oficiais_fechadas','pautas_zip'));

-- Move copies of the existing legal engine into the non-exposed schema. Keep
-- original public OIDs/signatures for callers; no formula is duplicated in TS.
-- Only the owner may execute raw functions; no GUC or client parameter can
-- opt into raw access. Copy from the version present at migration time.
do $migration$
declare fn text; src text; dep text; sig text; fns text[]:=array[
 'resolve_estado_resultado_academico_base','resolve_estado_resultado','resolve_raa_eja_oficial',
 'resolve_raa_decreto_for_matricula','resolve_raa_progression_for_matricula_generic','resolve_raa_progression_for_matricula'];
begin
 foreach fn in array fns loop
   sig:='public.'||fn||'(uuid,uuid)';
   select pg_get_functiondef(to_regprocedure(sig)) into src;
   if src is null or strpos(src,'FUNCTION public.'||fn||'(')=0 then
     raise exception 'academic engine drift: %',sig;
   end if;
   foreach dep in array fns loop
     src:=replace(src,'public.'||dep||'(','internal.klasse_raw_'||dep||'(');
   end loop;
   if fn='resolve_raa_eja_oficial' then
     -- The private EJA calculation is reached only after public ownership or
     -- staff/teacher authorization; retain its original staff checks and add
     -- the authorized pupil/guardian for operational eligibility.
     if strpos(src,'AND NOT (auth.uid() IS NULL')=0 then raise exception 'EJA authorization drift'; end if;
     src:=replace(src,'AND NOT (auth.uid() IS NULL','AND NOT internal.klasse_grade_portal_owner(p_escola_id,p_matricula_id) AND NOT (auth.uid() IS NULL');
   end if;
   execute src;
   execute format('revoke all on function internal.%I(uuid,uuid) from public,anon,authenticated,service_role','klasse_raw_'||fn);
 end loop;
end $migration$;

-- Individual classification RPCs require paid ownership or exact staff/
-- teaching assignment. The raw engine is not a PostgREST RPC.
create or replace function public.resolve_estado_resultado_academico_base(p_matricula_id uuid,p_disciplina_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not internal.klasse_grade_trusted() and not exists(select 1 from public.matriculas m where m.id=p_matricula_id
 and internal.klasse_grade_scope(m.escola_id,m.id,p_disciplina_id)) then
 raise exception 'ACADEMIC_FORBIDDEN' using errcode='42501'; end if;
 return internal.klasse_raw_resolve_estado_resultado_academico_base(p_matricula_id,p_disciplina_id);
end $$;

create or replace function public.resolve_estado_resultado(p_matricula_id uuid,p_disciplina_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not internal.klasse_grade_trusted() and not exists(select 1 from public.matriculas m where m.id=p_matricula_id
 and internal.klasse_grade_scope(m.escola_id,m.id,p_disciplina_id)) then
 raise exception 'ACADEMIC_FORBIDDEN' using errcode='42501'; end if;
 return internal.klasse_raw_resolve_estado_resultado(p_matricula_id,p_disciplina_id);
end $$;

-- Aggregate progression is separate from the paid grade contract. Full-class
-- results are not a professor's per-subject entitlement.
create or replace function internal.klasse_progression_allowed(p_escola uuid,p_matricula uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.matriculas m where m.escola_id=p_escola and m.id=p_matricula
 and (internal.klasse_grade_trusted() or internal.klasse_grade_staff(p_escola) or internal.klasse_grade_portal_owner(p_escola,p_matricula)));
$$;

-- Allowlist, not recursive key stripping: no grade, evidence or assessment
-- payload can escape if the raw legal engine gains new fields.
create or replace function internal.klasse_progression_projection(p_escola uuid,p_matricula uuid,p_result jsonb)
returns jsonb language sql stable security definer set search_path='' as $$
 select case when p_result is null then null
 when internal.klasse_grade_trusted() or internal.klasse_grade_staff(p_escola) or internal.klasse_grade_portal_paid(p_escola,p_matricula)
 then p_result
 else jsonb_build_object(
 'decision',p_result->'decision','destino',p_result->'destino','motivo',p_result->'motivo',
 'regime',p_result->'regime','etapa_destino',p_result->'etapa_destino',
 'disciplina_ids_pendentes',coalesce(p_result->'disciplina_ids_pendentes','[]'::jsonb),
 'efetivacao_matricula_bloqueada',coalesce(p_result->'efetivacao_matricula_bloqueada','false'::jsonb),
 'disciplinas','[]'::jsonb,'grade_details_restricted',true) end;
$$;
revoke all on function internal.klasse_progression_allowed(uuid,uuid),internal.klasse_progression_projection(uuid,uuid,jsonb)
 from public,anon,authenticated,service_role;

create or replace function public.resolve_raa_progression_for_matricula(p_escola_id uuid,p_matricula_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not internal.klasse_progression_allowed(p_escola_id,p_matricula_id) then raise exception 'ACADEMIC_FORBIDDEN' using errcode='42501'; end if;
 return internal.klasse_progression_projection(p_escola_id,p_matricula_id,internal.klasse_raw_resolve_raa_progression_for_matricula(p_escola_id,p_matricula_id));
end $$;
create or replace function public.resolve_raa_progression_for_matricula_generic(p_escola_id uuid,p_matricula_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not internal.klasse_progression_allowed(p_escola_id,p_matricula_id) then raise exception 'ACADEMIC_FORBIDDEN' using errcode='42501'; end if;
 return internal.klasse_progression_projection(p_escola_id,p_matricula_id,internal.klasse_raw_resolve_raa_progression_for_matricula_generic(p_escola_id,p_matricula_id));
end $$;
create or replace function public.resolve_raa_decreto_for_matricula(p_escola_id uuid,p_matricula_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not internal.klasse_progression_allowed(p_escola_id,p_matricula_id) then raise exception 'ACADEMIC_FORBIDDEN' using errcode='42501'; end if;
 return internal.klasse_progression_projection(p_escola_id,p_matricula_id,internal.klasse_raw_resolve_raa_decreto_for_matricula(p_escola_id,p_matricula_id));
end $$;
create or replace function public.resolve_raa_eja_oficial(p_escola_id uuid,p_matricula_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not internal.klasse_progression_allowed(p_escola_id,p_matricula_id) then raise exception 'ACADEMIC_FORBIDDEN' using errcode='42501'; end if;
 return internal.klasse_progression_projection(p_escola_id,p_matricula_id,internal.klasse_raw_resolve_raa_eja_oficial(p_escola_id,p_matricula_id));
end $$;

revoke all on function public.resolve_estado_resultado_academico_base(uuid,uuid),public.resolve_estado_resultado(uuid,uuid),
 public.resolve_raa_progression_for_matricula(uuid,uuid),public.resolve_raa_progression_for_matricula_generic(uuid,uuid),
 public.resolve_raa_decreto_for_matricula(uuid,uuid),public.resolve_raa_eja_oficial(uuid,uuid)
 from public,anon,authenticated,service_role;
grant execute on function public.resolve_estado_resultado_academico_base(uuid,uuid),public.resolve_estado_resultado(uuid,uuid),
 public.resolve_raa_progression_for_matricula(uuid,uuid),public.resolve_raa_progression_for_matricula_generic(uuid,uuid),
 public.resolve_raa_decreto_for_matricula(uuid,uuid),public.resolve_raa_eja_oficial(uuid,uuid)
 to authenticated,service_role;

-- Teacher compliance reports accept only in-tenant staff or the teacher's own
-- identifier. Unknown periods fail closed rather than returning fake OK.
do $migration$
declare src text; anchor text:='  -- Se não encontrar o trimestre, retorna tudo como OK para não alarmar';
begin
 select pg_get_functiondef(to_regprocedure('public.get_teacher_compliance_status(uuid[],uuid)')) into src;
 if src is null or strpos(src,anchor)=0 then raise exception 'teacher compliance engine drift'; end if;
 execute replace(src,anchor, E'  IF v_escola_id IS NULL OR (NOT internal.klasse_grade_trusted() AND (v_escola_id IS DISTINCT FROM public.current_tenant_escola_id() OR (NOT internal.klasse_grade_staff(v_escola_id) AND NOT EXISTS (SELECT 1 FROM public.professores pr JOIN public.escola_users eu ON eu.escola_id=pr.escola_id AND eu.user_id=pr.profile_id AND eu.papel::text=''professor'' WHERE pr.escola_id=v_escola_id AND pr.profile_id=auth.uid() AND NOT EXISTS (SELECT 1 FROM unnest(p_teacher_ids) x(id) WHERE x.id IS DISTINCT FROM pr.id))))) OR EXISTS (SELECT 1 FROM unnest(p_teacher_ids) x(id) WHERE NOT EXISTS (SELECT 1 FROM public.professores pr WHERE pr.id=x.id AND pr.escola_id=v_escola_id)) THEN\n    RAISE EXCEPTION ''ACADEMIC_FORBIDDEN'' USING ERRCODE=''42501'';\n  END IF;\n'||anchor);
end $migration$;
revoke all on function public.get_teacher_compliance_status(uuid[],uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_teacher_compliance_status(uuid[],uuid) to authenticated,service_role;

commit;
