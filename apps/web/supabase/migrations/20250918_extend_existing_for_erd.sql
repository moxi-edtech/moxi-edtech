-- apps/web/supabase/migrations/20250918_extend_existing_for_erd.sql
-- Extends existing tables to align with ERD. Non-destructive and backwards compatible.

-- TURMAS: add session_id and turno
alter table if exists public.turmas
  add column if not exists session_id uuid null references public.school_sessions(id) on delete set null,
  add column if not exists turno text null;
create index if not exists idx_turmas_session on public.turmas(session_id);

-- MATRICULAS: add secao_id, session_id, status, numero_matricula, data_matricula
alter table if exists public.matriculas
  add column if not exists secao_id uuid null references public.secoes(id) on delete set null,
  add column if not exists session_id uuid null references public.school_sessions(id) on delete set null,
  add column if not exists status text not null default 'ativo' check (status in ('ativo','trancado','concluido','transferido')),
  add column if not exists numero_matricula text null,
  add column if not exists data_matricula date null;
create index if not exists idx_matriculas_session on public.matriculas(session_id);
create index if not exists idx_matriculas_secao on public.matriculas(secao_id);
do $$ begin
  if not exists (
    select 1 from pg_indexes where schemaname = 'public' and indexname = 'uq_matriculas_aluno_session'
  ) then
    create unique index uq_matriculas_aluno_session on public.matriculas (aluno_id, session_id)
      where session_id is not null;
  end if;
end $$;

-- PROFESSORES: add apelido
alter table if exists public.professores
  add column if not exists apelido text null;

-- PROFILES: add global_role, current_escola_id
alter table if exists public.profiles
  add column if not exists global_role text null,
  add column if not exists current_escola_id uuid null references public.escolas(id) on delete set null;
create index if not exists idx_profiles_current_escola on public.profiles(current_escola_id);

-- Unify disciplinas -> cursos: copy data if cursos exists and is empty
do $$
begin
  if to_regclass('public.disciplinas') is not null and to_regclass('public.cursos') is not null then
    if (select count(*) from public.cursos) = 0 then
      insert into public.cursos (id, escola_id, codigo, nome)
      select d.id, d.escola_id, substr(md5(d.id::text), 1, 8) as codigo, d.nome
      from public.disciplinas d
      on conflict do nothing;
    end if;
  end if;
end$$;

-- Optional: create compatibility view presencas over frequencias if presencas table does not exist
do $$
begin
  if to_regclass('public.presencas') is null and to_regclass('public.frequencias') is not null then
    execute $$create or replace view public.presencas as
      select
        id,
        matricula_id as aluno_id,
        null::uuid as turma_id,
        (case status when 'presente' then true else false end) as presente,
        data as created_at,
        null::uuid as escola_id
      from public.frequencias$$;
  end if;
end$$;

