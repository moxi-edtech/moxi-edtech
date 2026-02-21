create table if not exists public.teacher_courses (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references public.escolas(id) on delete cascade,
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  curso_id uuid not null references public.cursos(id) on delete restrict,
  created_at timestamptz not null default now()
);

create unique index if not exists teacher_courses_teacher_curso_uidx
  on public.teacher_courses (teacher_id, curso_id);

create index if not exists idx_teacher_courses_escola
  on public.teacher_courses (escola_id);

create index if not exists idx_teacher_courses_curso
  on public.teacher_courses (curso_id);

alter table public.teacher_courses enable row level security;

create policy teacher_courses_tenant_isolation
  on public.teacher_courses
  using (escola_id = current_tenant_escola_id())
  with check (escola_id = current_tenant_escola_id());
