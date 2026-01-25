do $$
begin
  if exists (
    select 1
    from pg_matviews
    where schemaname = 'public'
      and matviewname = 'mv_turmas_para_matricula'
  ) then
    create index if not exists idx_mv_turmas_para_matricula_escola_nome
      on public.mv_turmas_para_matricula (escola_id, turma_nome, id);
  end if;

  if exists (
    select 1
    from pg_matviews
    where schemaname = 'internal'
      and matviewname = 'mv_turmas_para_matricula'
  ) then
    create index if not exists idx_mv_turmas_para_matricula_escola_nome
      on internal.mv_turmas_para_matricula (escola_id, turma_nome, id);
  end if;
end $$;
