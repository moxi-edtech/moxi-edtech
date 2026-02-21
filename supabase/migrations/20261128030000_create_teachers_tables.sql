create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references public.escolas(id) on delete cascade,
  profile_id uuid not null references public.profiles(user_id) on delete cascade,
  nome_completo text not null,
  genero text not null check (genero in ('M', 'F')),
  data_nascimento date,
  numero_bi text,
  telefone_principal text,
  habilitacoes text not null check (habilitacoes in ('Ensino Médio', 'Bacharelato', 'Licenciatura', 'Mestrado', 'Doutoramento')),
  area_formacao text,
  vinculo_contratual text not null check (vinculo_contratual in ('Efetivo', 'Colaborador', 'Eventual')),
  carga_horaria_maxima integer not null check (carga_horaria_maxima > 0),
  turnos_disponiveis text[] not null default array[]::text[]
    check (turnos_disponiveis <@ array['Manhã', 'Tarde', 'Noite']),
  is_diretor_turma boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists teachers_escola_profile_uidx
  on public.teachers (escola_id, profile_id);

create unique index if not exists teachers_escola_numero_bi_uidx
  on public.teachers (escola_id, numero_bi)
  where numero_bi is not null;

create index if not exists idx_teachers_escola_id
  on public.teachers (escola_id);

create index if not exists idx_teachers_turnos
  on public.teachers using gin (turnos_disponiveis);

create trigger trg_teachers_updated
before update on public.teachers
for each row execute function public.set_updated_at();

alter table public.teachers enable row level security;

create policy teachers_tenant_isolation
  on public.teachers
  using (escola_id = current_tenant_escola_id())
  with check (escola_id = current_tenant_escola_id());

create table if not exists public.teacher_skills (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references public.escolas(id) on delete cascade,
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  disciplina_id uuid not null references public.disciplinas_catalogo(id) on delete restrict,
  created_at timestamptz not null default now()
);

create unique index if not exists teacher_skills_teacher_disciplina_uidx
  on public.teacher_skills (teacher_id, disciplina_id);

create index if not exists idx_teacher_skills_escola
  on public.teacher_skills (escola_id);

create index if not exists idx_teacher_skills_disciplina
  on public.teacher_skills (disciplina_id);

alter table public.teacher_skills enable row level security;

create policy teacher_skills_tenant_isolation
  on public.teacher_skills
  using (escola_id = current_tenant_escola_id())
  with check (escola_id = current_tenant_escola_id());
