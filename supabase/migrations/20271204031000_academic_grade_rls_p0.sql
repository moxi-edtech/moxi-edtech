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

-- Scoped payment predicate; granted + settled + positive charge; preserve only actual legacy payments.
-- The helper returns a boolean, never a payment record.
create or replace function internal.klasse_grade_portal_paid(p_escola uuid,p_matricula uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select coalesce(p_escola=public.current_tenant_escola_id(),false) and exists (
  select 1 from public.matriculas m join public.alunos a on a.id=m.aluno_id and a.escola_id=m.escola_id
  where m.id=p_matricula and m.escola_id=p_escola and (select auth.uid()) is not null
    and (a.profile_id=(select auth.uid()) or a.usuario_auth_id=(select auth.uid()) or exists (
      select 1 from public.aluno_encarregados ae join public.encarregados e on e.id=ae.encarregado_id and e.escola_id=ae.escola_id
      where ae.escola_id=p_escola and ae.aluno_id=a.id
        and nullif(lower(trim(auth.jwt()->>'email')),'') is not null
        and lower(trim(e.email))=lower(trim(auth.jwt()->>'email'))
    ))
    and exists (
      select 1 from public.servico_pedidos s join public.pagamento_intents pi
       on pi.servico_pedido_id=s.id and pi.escola_id=s.escola_id and pi.aluno_id=s.aluno_id and pi.status='settled'
      where s.escola_id=p_escola and s.aluno_id=m.aluno_id and s.matricula_id=m.id
        and s.status='granted' and s.valor_cobrado>0
        and (s.servico_codigo='DOC_BOLETIM_TRIMESTRAL' or (
          s.servico_codigo='DOC_DECLARACAO_NOTAS'
          and coalesce(s.contexto->>'origem','') not in ('documentos_emissao_individual','portal_aluno_documentos')
          and coalesce(s.contexto->>'tipo_documento','')<>'declaracao_notas'
        ))
    )
 );
$$;

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
 from internal.mv_boletim_por_matricula
 where escola_id=public.current_tenant_escola_id()
 and internal.klasse_grade_scope(escola_id,matricula_id,disciplina_id);
revoke all on internal.mv_boletim_por_matricula from public,anon,authenticated;
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

-- Preserve OID, privileges and the existing legal result engine; fail migration
-- if its known entry point drifted. Check before reading any grade.
do $migration$
declare src text; anchor text := E'BEGIN\n  SELECT m.escola_id, m.turma_id, al.id';
begin
 select pg_get_functiondef('public.resolve_estado_resultado_academico_base(uuid,uuid)'::regprocedure) into src;
 if strpos(src,anchor)=0 then raise exception 'grade resolver drift: review authorization injection'; end if;
 execute replace(src,anchor, E'BEGIN\n  IF NOT (coalesce(current_setting(''role'',true),'''') = ''service_role'' OR (auth.uid() IS NULL AND coalesce(current_setting(''role'',true),'''') IN (''none'',''postgres'',''supabase_admin'') AND session_user IN (''postgres'',''supabase_admin''))) AND NOT EXISTS (SELECT 1 FROM public.matriculas m WHERE m.id=p_matricula_id AND internal.klasse_grade_scope(m.escola_id,m.id,p_disciplina_id)) THEN\n    RAISE EXCEPTION ''ACADEMIC_FORBIDDEN'' USING ERRCODE=''42501'';\n  END IF;\n  SELECT m.escola_id, m.turma_id, al.id');
end $migration$;
revoke execute on function public.resolve_estado_resultado_academico_base(uuid,uuid) from public,anon;

commit;
