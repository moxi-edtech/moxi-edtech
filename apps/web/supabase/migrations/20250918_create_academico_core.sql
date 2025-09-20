-- apps/web/supabase/migrations/20250918_create_academico_core.sql
-- Creates core academic tables aligning with the provided ERD.
-- This migration only adds missing tables and constraints; it does not alter existing ones.

-- SCHOOL_SESSIONS
create table if not exists public.school_sessions (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references public.escolas(id) on delete cascade,
  nome text not null,
  data_inicio date not null,
  data_fim date not null,
  status text not null check (status in ('ativa','arquivada'))
);

-- One active session per school (optional but implemented)
create unique index if not exists uq_school_sessions_ativa_per_escola
  on public.school_sessions (escola_id)
  where status = 'ativa';

-- SEMESTRES
create table if not exists public.semestres (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.school_sessions(id) on delete cascade,
  nome text not null,
  data_inicio date not null,
  data_fim date not null,
  attendance_type text not null check (attendance_type in ('section','course')),
  permitir_submissao_final boolean not null default false
);

-- SEÇÕES (class sections)
create table if not exists public.secoes (
  id uuid primary key default gen_random_uuid(),
  turma_id uuid not null references public.turmas(id) on delete cascade,
  nome text not null,
  sala text
);

-- CURSOS (catalog)
create table if not exists public.cursos (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references public.escolas(id) on delete cascade,
  codigo text not null,
  nome text not null
);
create unique index if not exists uq_cursos_escola_codigo on public.cursos (escola_id, codigo);

-- CURSOS_OFERTA (course offerings)
create table if not exists public.cursos_oferta (
  id uuid primary key default gen_random_uuid(),
  curso_id uuid not null references public.cursos(id) on delete cascade,
  turma_id uuid not null references public.turmas(id) on delete cascade,
  semestre_id uuid not null references public.semestres(id) on delete cascade
);
create unique index if not exists uq_cursos_oferta_unique on public.cursos_oferta (curso_id, turma_id, semestre_id);

-- ATRIBUICOES_PROF (teacher assignments)
create table if not exists public.atribuicoes_prof (
  id uuid primary key default gen_random_uuid(),
  professor_user_id uuid not null references public.profiles(user_id) on delete cascade,
  curso_oferta_id uuid not null references public.cursos_oferta(id) on delete cascade,
  secao_id uuid not null references public.secoes(id) on delete cascade
);
create unique index if not exists uq_atribuicoes_prof_unique on public.atribuicoes_prof (professor_user_id, curso_oferta_id, secao_id);

-- MATRICULAS_CURSOS (electives linkage)
create table if not exists public.matriculas_cursos (
  id uuid primary key default gen_random_uuid(),
  matricula_id uuid not null references public.matriculas(id) on delete cascade,
  curso_oferta_id uuid not null references public.cursos_oferta(id) on delete cascade
);
create unique index if not exists uq_matriculas_cursos_unique on public.matriculas_cursos (matricula_id, curso_oferta_id);

-- ROTINAS (schedule)
create table if not exists public.rotinas (
  id uuid primary key default gen_random_uuid(),
  turma_id uuid not null references public.turmas(id) on delete cascade,
  secao_id uuid references public.secoes(id) on delete set null,
  curso_oferta_id uuid not null references public.cursos_oferta(id) on delete cascade,
  professor_user_id uuid not null references public.profiles(user_id) on delete cascade,
  weekday int not null check (weekday between 1 and 7),
  inicio time not null,
  fim time not null,
  sala text
);

-- FREQUENCIAS (attendance)
create table if not exists public.frequencias (
  id uuid primary key default gen_random_uuid(),
  matricula_id uuid not null references public.matriculas(id) on delete cascade,
  routine_id uuid references public.rotinas(id) on delete set null,
  curso_oferta_id uuid references public.cursos_oferta(id) on delete set null,
  data date not null,
  status text not null check (status in ('presente','ausente','atraso','justificado'))
);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'frequencias_ck_routine_or_curso') then
    alter table public.frequencias
      add constraint frequencias_ck_routine_or_curso check (routine_id is not null or curso_oferta_id is not null);
  end if;
end $$;

-- SISTEMAS DE NOTAS
create table if not exists public.sistemas_notas (
  id uuid primary key default gen_random_uuid(),
  turma_id uuid references public.turmas(id) on delete cascade,
  semestre_id uuid references public.semestres(id) on delete cascade,
  nome text not null,
  tipo text not null check (tipo in ('numerico','percentual','menção'))
);

-- REGRAS DE ESCALA
create table if not exists public.regras_escala (
  id uuid primary key default gen_random_uuid(),
  sistema_notas_id uuid not null references public.sistemas_notas(id) on delete cascade,
  grade text not null,
  point numeric not null,
  start int not null,
  "end" int not null
);

-- AVALIAÇÕES
create table if not exists public.avaliacoes (
  id uuid primary key default gen_random_uuid(),
  curso_oferta_id uuid not null references public.cursos_oferta(id) on delete cascade,
  sistema_notas_id uuid references public.sistemas_notas(id) on delete set null,
  nome text not null,
  peso numeric not null,
  data_prevista date
);

-- LANÇAMENTOS (grades entries)
create table if not exists public.lancamentos (
  id uuid primary key default gen_random_uuid(),
  avaliacao_id uuid not null references public.avaliacoes(id) on delete cascade,
  matricula_id uuid not null references public.matriculas(id) on delete cascade,
  valor numeric not null,
  final boolean not null default false,
  criado_em timestamptz not null default now()
);
create unique index if not exists uq_lancamentos_unique on public.lancamentos (matricula_id, avaliacao_id);

-- SYLLABI
create table if not exists public.syllabi (
  id uuid primary key default gen_random_uuid(),
  curso_oferta_id uuid not null references public.cursos_oferta(id) on delete cascade,
  nome text not null,
  arquivo_url text not null,
  criado_em date not null default current_date
);

-- NOTICES
create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references public.escolas(id) on delete cascade,
  titulo text not null,
  conteudo text not null,
  publico_alvo text not null check (publico_alvo in ('todos','professores','alunos','responsaveis')),
  criado_em timestamptz not null default now()
);

-- EVENTS
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references public.escolas(id) on delete cascade,
  titulo text not null,
  descricao text,
  inicio_at timestamptz not null,
  fim_at timestamptz,
  publico_alvo text not null
);

-- Ensure composite uniqueness for escola_usuarios if table exists
do $$ begin
  if to_regclass('public.escola_usuarios') is not null then
    create unique index if not exists uq_escola_usuarios_unique on public.escola_usuarios (escola_id, user_id);
  end if;
end $$;

-- Helpful indexes on FKs
create index if not exists idx_semestres_session on public.semestres (session_id);
create index if not exists idx_secoes_turma on public.secoes (turma_id);
create index if not exists idx_cursos_escola on public.cursos (escola_id);
create index if not exists idx_cursos_oferta_curso on public.cursos_oferta (curso_id);
create index if not exists idx_cursos_oferta_turma on public.cursos_oferta (turma_id);
create index if not exists idx_cursos_oferta_semestre on public.cursos_oferta (semestre_id);
create index if not exists idx_atribuicoes_prof_prof on public.atribuicoes_prof (professor_user_id);
create index if not exists idx_matriculas_cursos_matricula on public.matriculas_cursos (matricula_id);
create index if not exists idx_rotinas_turma on public.rotinas (turma_id);
create index if not exists idx_rotinas_secao on public.rotinas (secao_id);
create index if not exists idx_rotinas_curso_oferta on public.rotinas (curso_oferta_id);
create index if not exists idx_frequencias_matricula on public.frequencias (matricula_id);
create index if not exists idx_frequencias_data on public.frequencias (data);
create index if not exists idx_sistemas_notas_turma on public.sistemas_notas (turma_id);
create index if not exists idx_sistemas_notas_semestre on public.sistemas_notas (semestre_id);
create index if not exists idx_regras_escala_sistema on public.regras_escala (sistema_notas_id);
create index if not exists idx_avaliacoes_curso_oferta on public.avaliacoes (curso_oferta_id);
create index if not exists idx_lancamentos_avaliacao on public.lancamentos (avaliacao_id);
create index if not exists idx_syllabi_curso_oferta on public.syllabi (curso_oferta_id);
create index if not exists idx_notices_escola on public.notices (escola_id);
create index if not exists idx_events_escola on public.events (escola_id);

