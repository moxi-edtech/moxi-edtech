-- apps/web/supabase/migrations/20250918_tenant_rls_and_indexes.sql
-- Tenant denormalization (escola_id), backfill, triggers, RLS policies, and
-- performance indexes aligned to escola_id-first filtering for low latency.

-- 0) Extensions for search/indexing
create extension if not exists pg_trgm;
create extension if not exists btree_gin;
create extension if not exists btree_gist;

-- 1) Add escola_id columns (nullable), backfill, then set NOT NULL + FK

-- Helper: ensure FK + not null in two steps, tolerating reruns
do $$ begin
  -- cursos_oferta.escola_id <- cursos.escola_id
  alter table if exists public.cursos_oferta add column if not exists escola_id uuid;
  update public.cursos_oferta co
    set escola_id = c.escola_id
  from public.cursos c
  where co.curso_id = c.id and co.escola_id is null;
  alter table if exists public.cursos_oferta
    alter column escola_id set not null,
    add constraint cursos_oferta_escola_fk foreign key (escola_id) references public.escolas(id) on delete cascade;

  -- atribuicoes_prof.escola_id <- cursos_oferta.escola_id
  alter table if exists public.atribuicoes_prof add column if not exists escola_id uuid;
  update public.atribuicoes_prof ap
    set escola_id = co.escola_id
  from public.cursos_oferta co
  where ap.curso_oferta_id = co.id and ap.escola_id is null;
  alter table if exists public.atribuicoes_prof
    alter column escola_id set not null,
    add constraint atribuicoes_prof_escola_fk foreign key (escola_id) references public.escolas(id) on delete cascade;

  -- rotinas.escola_id <- cursos_oferta.escola_id (fallback turmas.escola_id)
  alter table if exists public.rotinas add column if not exists escola_id uuid;
  update public.rotinas r
    set escola_id = co.escola_id
  from public.cursos_oferta co
  where r.curso_oferta_id = co.id and r.escola_id is null;
  update public.rotinas r
    set escola_id = t.escola_id
  from public.turmas t
  where r.turma_id = t.id and r.escola_id is null;
  alter table if exists public.rotinas
    alter column escola_id set not null,
    add constraint rotinas_escola_fk foreign key (escola_id) references public.escolas(id) on delete cascade;

  -- frequencias.escola_id <- matriculas.escola_id
  alter table if exists public.frequencias add column if not exists escola_id uuid;
  update public.frequencias f
    set escola_id = m.escola_id
  from public.matriculas m
  where f.matricula_id = m.id and f.escola_id is null;
  alter table if exists public.frequencias
    alter column escola_id set not null,
    add constraint frequencias_escola_fk foreign key (escola_id) references public.escolas(id) on delete cascade;

  -- lancamentos.escola_id <- matriculas.escola_id
  alter table if exists public.lancamentos add column if not exists escola_id uuid;
  update public.lancamentos l
    set escola_id = m.escola_id
  from public.matriculas m
  where l.matricula_id = m.id and l.escola_id is null;
  alter table if exists public.lancamentos
    alter column escola_id set not null,
    add constraint lancamentos_escola_fk foreign key (escola_id) references public.escolas(id) on delete cascade;

  -- sistemas_notas.escola_id <- turmas.escola_id (fallback via semestres -> session -> escola)
  alter table if exists public.sistemas_notas add column if not exists escola_id uuid;
  update public.sistemas_notas s
    set escola_id = t.escola_id
  from public.turmas t
  where s.turma_id = t.id and s.escola_id is null;
  update public.sistemas_notas s
    set escola_id = ss.escola_id
  from public.semestres se
  join public.school_sessions ss on ss.id = se.session_id
  where s.semestre_id = se.id and s.escola_id is null;
  alter table if exists public.sistemas_notas
    alter column escola_id set not null,
    add constraint sistemas_notas_escola_fk foreign key (escola_id) references public.escolas(id) on delete cascade;

  -- avaliacoes.escola_id <- cursos_oferta.escola_id
  alter table if exists public.avaliacoes add column if not exists escola_id uuid;
  update public.avaliacoes a
    set escola_id = co.escola_id
  from public.cursos_oferta co
  where a.curso_oferta_id = co.id and a.escola_id is null;
  alter table if exists public.avaliacoes
    alter column escola_id set not null,
    add constraint avaliacoes_escola_fk foreign key (escola_id) references public.escolas(id) on delete cascade;

  -- regras_escala.escola_id <- sistemas_notas.escola_id
  alter table if exists public.regras_escala add column if not exists escola_id uuid;
  update public.regras_escala r
    set escola_id = s.escola_id
  from public.sistemas_notas s
  where r.sistema_notas_id = s.id and r.escola_id is null;
  alter table if exists public.regras_escala
    alter column escola_id set not null,
    add constraint regras_escala_escola_fk foreign key (escola_id) references public.escolas(id) on delete cascade;

  -- syllabi.escola_id <- cursos_oferta.escola_id
  alter table if exists public.syllabi add column if not exists escola_id uuid;
  update public.syllabi sy
    set escola_id = co.escola_id
  from public.cursos_oferta co
  where sy.curso_oferta_id = co.id and sy.escola_id is null;
  alter table if exists public.syllabi
    alter column escola_id set not null,
    add constraint syllabi_escola_fk foreign key (escola_id) references public.escolas(id) on delete cascade;

  -- matriculas_cursos.escola_id <- matriculas.escola_id
  alter table if exists public.matriculas_cursos add column if not exists escola_id uuid;
  update public.matriculas_cursos mc
    set escola_id = m.escola_id
  from public.matriculas m
  where mc.matricula_id = m.id and mc.escola_id is null;
  alter table if exists public.matriculas_cursos
    alter column escola_id set not null,
    add constraint matriculas_cursos_escola_fk foreign key (escola_id) references public.escolas(id) on delete cascade;
end $$;

-- 2) BEFORE INSERT/UPDATE triggers to derive and enforce escola_id

-- cursos_oferta: from cursos
create or replace function public.trg_set_escola_cursos_oferta()
returns trigger language plpgsql as $$
begin
  select c.escola_id into new.escola_id from public.cursos c where c.id = new.curso_id;
  return new;
end; $$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_bi_cursos_oferta_escola') then
    create trigger trg_bi_cursos_oferta_escola before insert or update of curso_id on public.cursos_oferta
    for each row execute function public.trg_set_escola_cursos_oferta();
  end if;
end $$;

-- atribuicoes_prof: from cursos_oferta
create or replace function public.trg_set_escola_atribuicoes_prof()
returns trigger language plpgsql as $$
begin
  select co.escola_id into new.escola_id from public.cursos_oferta co where co.id = new.curso_oferta_id;
  return new;
end; $$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_bi_atribuicoes_prof_escola') then
    create trigger trg_bi_atribuicoes_prof_escola before insert or update of curso_oferta_id on public.atribuicoes_prof
    for each row execute function public.trg_set_escola_atribuicoes_prof();
  end if;
end $$;

-- rotinas: from cursos_oferta (fallback turmas)
create or replace function public.trg_set_escola_rotinas()
returns trigger language plpgsql as $$
begin
  if new.curso_oferta_id is not null then
    select co.escola_id into new.escola_id from public.cursos_oferta co where co.id = new.curso_oferta_id;
  end if;
  if new.escola_id is null and new.turma_id is not null then
    select t.escola_id into new.escola_id from public.turmas t where t.id = new.turma_id;
  end if;
  return new;
end; $$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_bi_rotinas_escola') then
    create trigger trg_bi_rotinas_escola before insert or update of curso_oferta_id, turma_id on public.rotinas
    for each row execute function public.trg_set_escola_rotinas();
  end if;
end $$;

-- frequencias: from matriculas
create or replace function public.trg_set_escola_frequencias()
returns trigger language plpgsql as $$
begin
  select m.escola_id into new.escola_id from public.matriculas m where m.id = new.matricula_id;
  return new;
end; $$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_bi_frequencias_escola') then
    create trigger trg_bi_frequencias_escola before insert or update of matricula_id on public.frequencias
    for each row execute function public.trg_set_escola_frequencias();
  end if;
end $$;

-- lancamentos: from matriculas
create or replace function public.trg_set_escola_lancamentos()
returns trigger language plpgsql as $$
begin
  select m.escola_id into new.escola_id from public.matriculas m where m.id = new.matricula_id;
  return new;
end; $$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_bi_lancamentos_escola') then
    create trigger trg_bi_lancamentos_escola before insert or update of matricula_id on public.lancamentos
    for each row execute function public.trg_set_escola_lancamentos();
  end if;
end $$;

-- sistemas_notas: from turma or semestre->session
create or replace function public.trg_set_escola_sistemas_notas()
returns trigger language plpgsql as $$
begin
  if new.turma_id is not null then
    select t.escola_id into new.escola_id from public.turmas t where t.id = new.turma_id;
  end if;
  if new.escola_id is null and new.semestre_id is not null then
    select ss.escola_id into new.escola_id from public.semestres se join public.school_sessions ss on ss.id = se.session_id where se.id = new.semestre_id;
  end if;
  return new;
end; $$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_bi_sistemas_notas_escola') then
    create trigger trg_bi_sistemas_notas_escola before insert or update of turma_id, semestre_id on public.sistemas_notas
    for each row execute function public.trg_set_escola_sistemas_notas();
  end if;
end $$;

-- avaliacoes: from cursos_oferta
create or replace function public.trg_set_escola_avaliacoes()
returns trigger language plpgsql as $$
begin
  select co.escola_id into new.escola_id from public.cursos_oferta co where co.id = new.curso_oferta_id;
  return new;
end; $$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_bi_avaliacoes_escola') then
    create trigger trg_bi_avaliacoes_escola before insert or update of curso_oferta_id on public.avaliacoes
    for each row execute function public.trg_set_escola_avaliacoes();
  end if;
end $$;

-- regras_escala: from sistemas_notas
create or replace function public.trg_set_escola_regras_escala()
returns trigger language plpgsql as $$
begin
  select s.escola_id into new.escola_id from public.sistemas_notas s where s.id = new.sistema_notas_id;
  return new;
end; $$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_bi_regras_escala_escola') then
    create trigger trg_bi_regras_escala_escola before insert or update of sistema_notas_id on public.regras_escala
    for each row execute function public.trg_set_escola_regras_escala();
  end if;
end $$;

-- syllabi: from cursos_oferta
create or replace function public.trg_set_escola_syllabi()
returns trigger language plpgsql as $$
begin
  select co.escola_id into new.escola_id from public.cursos_oferta co where co.id = new.curso_oferta_id;
  return new;
end; $$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_bi_syllabi_escola') then
    create trigger trg_bi_syllabi_escola before insert or update of curso_oferta_id on public.syllabi
    for each row execute function public.trg_set_escola_syllabi();
  end if;
end $$;

-- matriculas_cursos: from matriculas
create or replace function public.trg_set_escola_matriculas_cursos()
returns trigger language plpgsql as $$
begin
  select m.escola_id into new.escola_id from public.matriculas m where m.id = new.matricula_id;
  return new;
end; $$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_bi_matriculas_cursos_escola') then
    create trigger trg_bi_matriculas_cursos_escola before insert or update of matricula_id on public.matriculas_cursos
    for each row execute function public.trg_set_escola_matriculas_cursos();
  end if;
end $$;

-- 3) RLS helper + policies
create or replace function public.current_tenant_escola_id()
returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'escola_id', '')::uuid
$$;

-- Enable RLS and add tenant policies on hot tables
do $$ begin
  -- List of tables to enforce tenant isolation
  perform 1;
end $$;

-- Helper to enable policy on a table (repeat per table)
-- Frequencias
alter table if exists public.frequencias enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='frequencias' and policyname='tenant_isolation') then
    create policy tenant_isolation on public.frequencias using (escola_id = public.current_tenant_escola_id()) with check (escola_id = public.current_tenant_escola_id());
  end if;
end $$;

-- Lancamentos
alter table if exists public.lancamentos enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='lancamentos' and policyname='tenant_isolation') then
    create policy tenant_isolation on public.lancamentos using (escola_id = public.current_tenant_escola_id()) with check (escola_id = public.current_tenant_escola_id());
  end if;
end $$;

-- Cursos / Oferta / Atribuições
alter table if exists public.cursos enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='cursos' and policyname='tenant_isolation') then
    create policy tenant_isolation on public.cursos using (escola_id = public.current_tenant_escola_id()) with check (escola_id = public.current_tenant_escola_id());
  end if;
end $$;

alter table if exists public.cursos_oferta enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='cursos_oferta' and policyname='tenant_isolation') then
    create policy tenant_isolation on public.cursos_oferta using (escola_id = public.current_tenant_escola_id()) with check (escola_id = public.current_tenant_escola_id());
  end if;
end $$;

alter table if exists public.atribuicoes_prof enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='atribuicoes_prof' and policyname='tenant_isolation') then
    create policy tenant_isolation on public.atribuicoes_prof using (escola_id = public.current_tenant_escola_id()) with check (escola_id = public.current_tenant_escola_id());
  end if;
end $$;

-- Rotinas
alter table if exists public.rotinas enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='rotinas' and policyname='tenant_isolation') then
    create policy tenant_isolation on public.rotinas using (escola_id = public.current_tenant_escola_id()) with check (escola_id = public.current_tenant_escola_id());
  end if;
end $$;

-- Sistemas de notas / Regras / Avaliacoes
alter table if exists public.sistemas_notas enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='sistemas_notas' and policyname='tenant_isolation') then
    create policy tenant_isolation on public.sistemas_notas using (escola_id = public.current_tenant_escola_id()) with check (escola_id = public.current_tenant_escola_id());
  end if;
end $$;

alter table if exists public.regras_escala enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='regras_escala' and policyname='tenant_isolation') then
    create policy tenant_isolation on public.regras_escala using (escola_id = public.current_tenant_escola_id()) with check (escola_id = public.current_tenant_escola_id());
  end if;
end $$;

alter table if exists public.avaliacoes enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='avaliacoes' and policyname='tenant_isolation') then
    create policy tenant_isolation on public.avaliacoes using (escola_id = public.current_tenant_escola_id()) with check (escola_id = public.current_tenant_escola_id());
  end if;
end $$;

-- Syllabi
alter table if exists public.syllabi enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='syllabi' and policyname='tenant_isolation') then
    create policy tenant_isolation on public.syllabi using (escola_id = public.current_tenant_escola_id()) with check (escola_id = public.current_tenant_escola_id());
  end if;
end $$;

-- Matriculas_cursos
alter table if exists public.matriculas_cursos enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='matriculas_cursos' and policyname='tenant_isolation') then
    create policy tenant_isolation on public.matriculas_cursos using (escola_id = public.current_tenant_escola_id()) with check (escola_id = public.current_tenant_escola_id());
  end if;
end $$;

-- Notices / Events
alter table if exists public.notices enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='notices' and policyname='tenant_isolation') then
    create policy tenant_isolation on public.notices using (escola_id = public.current_tenant_escola_id()) with check (escola_id = public.current_tenant_escola_id());
  end if;
end $$;

alter table if exists public.events enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='events' and policyname='tenant_isolation') then
    create policy tenant_isolation on public.events using (escola_id = public.current_tenant_escola_id()) with check (escola_id = public.current_tenant_escola_id());
  end if;
end $$;

-- 4) Use-case indexes, escola_id first

-- Alunos search (FTS + helper index)
alter table if exists public.alunos add column if not exists tsv tsvector
  generated always as (to_tsvector('simple', coalesce((alunos.nome)::text, '') || ' ' || coalesce((alunos.responsavel_nome)::text, '') || ' ' || coalesce((alunos.nome_responsavel)::text, ''))) stored;
create index if not exists ix_alunos_tsv on public.alunos using gin (tsv);
-- If your schema uses profile_id instead of user_id, index it for quick lookups
create index if not exists ix_alunos_profile on public.alunos (profile_id);

-- Listagem de alunos por turma/secao
create index if not exists ix_matriculas_escola_turma_secao on public.matriculas (escola_id, turma_id, secao_id, status);

-- Frequencias (diários)
create index if not exists ix_freq_escola_routine_data on public.frequencias (escola_id, routine_id, data);
create index if not exists ix_freq_escola_curso_data on public.frequencias (escola_id, curso_oferta_id, data);
create index if not exists brin_freq_data on public.frequencias using brin (data) with (pages_per_range=16);

-- Lancamentos (boletim)
create index if not exists ix_lanc_escola_avaliacao_matricula on public.lancamentos (escola_id, avaliacao_id, matricula_id);
create index if not exists ix_lanc_escola_matricula on public.lancamentos (escola_id, matricula_id);

-- Rotinas (timetable)
create index if not exists ix_rotinas_escola_secao_weekday_inicio on public.rotinas (escola_id, secao_id, weekday, inicio);
create unique index if not exists uq_rotina_sala_tempo on public.rotinas (escola_id, sala, weekday, inicio, fim);

-- Ofertas e Atribuições
create index if not exists ix_oferta_escola_curso_turma_semestre on public.cursos_oferta (escola_id, curso_id, turma_id, semestre_id);
create index if not exists ix_attrprof_escola_prof_oferta on public.atribuicoes_prof (escola_id, professor_user_id, curso_oferta_id, secao_id);

-- Avisos/Eventos
create index if not exists ix_events_escola_inicio on public.events (escola_id, inicio_at desc);
create index if not exists ix_notices_escola_criado on public.notices (escola_id, criado_em desc);

-- Cursos search by nome (trigram)
create index if not exists ix_cursos_nome_trgm on public.cursos using gin (nome gin_trgm_ops);

