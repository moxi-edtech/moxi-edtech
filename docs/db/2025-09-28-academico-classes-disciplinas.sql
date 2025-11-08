-- Academico: classes e disciplinas (+ ajustes opcionais em cursos)
-- Executar no projeto Supabase (SQL Editor ou psql)

-- 1) Tabela: classes
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references public.escolas(id) on delete cascade,
  nome text not null,
  descricao text null,
  ordem int null,
  nivel text null,
  created_at timestamptz not null default now()
);

create index if not exists classes_escola_id_idx on public.classes(escola_id);
create index if not exists classes_escola_ordem_idx on public.classes(escola_id, ordem);

alter table public.classes enable row level security;

do $$ begin
  create policy "classes select membros escola"
  on public.classes for select
  using (
    exists (
      select 1 from public.escola_usuarios eu
      where eu.user_id = auth.uid() and eu.escola_id = classes.escola_id
    )
  );
exception when duplicate_object then null; end $$;

-- 2) Tabela: disciplinas
create table if not exists public.disciplinas (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references public.escolas(id) on delete cascade,
  nome text not null,
  tipo text not null check (tipo in ('core','eletivo')),
  curso_id uuid null references public.cursos(id) on delete set null,
  classe_id uuid null references public.classes(id) on delete set null,
  descricao text null,
  created_at timestamptz not null default now()
);

create index if not exists disciplinas_escola_idx on public.disciplinas(escola_id);
create index if not exists disciplinas_curso_idx on public.disciplinas(curso_id);
create index if not exists disciplinas_classe_idx on public.disciplinas(classe_id);

alter table public.disciplinas enable row level security;

do $$ begin
  create policy "disciplinas select membros escola"
  on public.disciplinas for select
  using (
    exists (
      select 1 from public.escola_usuarios eu
      where eu.user_id = auth.uid() and eu.escola_id = disciplinas.escola_id
    )
  );
exception when duplicate_object then null; end $$;

-- 3) Opcional: enriquecer cursos (se colunas não existirem)
alter table public.cursos
  add column if not exists tipo text,
  add column if not exists descricao text,
  add column if not exists nivel text,
  add column if not exists semestre_id uuid references public.semestres(id);

-- 4) (Opcional) Preferências de configuração da escola, caso ainda não tenha aplicado
-- Consulte: docs/db/2025-09-27-configuracoes_escola.sql

