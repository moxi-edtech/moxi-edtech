-- ============================================================
-- PATCH CAMINHO C (Compatibilidade)
-- - Mantém curso_matriz como itens do currículo (não substitui)
-- - Cria header versionado curso_curriculos (draft/published/archived)
-- - Adiciona curso_curriculo_id em curso_matriz
-- - Backfill: cria currículos v1 publicados por escola+curso no ano ativo
-- - Trigger compat: inserts antigos em curso_matriz ganham curriculo_id automaticamente
-- - RLS: tenant + role via user_has_role_in_school
-- ============================================================

begin;

-- ----------------------------
-- 0) Pre-reqs (assumidos)
-- - public.current_tenant_escola_id() existe
-- - public.user_has_role_in_school(p_escola_id uuid, p_roles text[]) existe
-- ----------------------------

-- ----------------------------
-- 1) Enum de status (idempotente)
-- ----------------------------
do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'curriculo_status'
  ) then
    create type public.curriculo_status as enum ('draft', 'published', 'archived');
  end if;
end $$;

-- ----------------------------
-- 2) Header: curso_curriculos
-- ----------------------------
create table if not exists public.curso_curriculos (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references public.escolas(id) on delete cascade,
  curso_id uuid not null references public.cursos(id) on delete restrict,
  ano_letivo_id uuid not null references public.anos_letivos(id) on delete restrict,

  version integer not null,
  status public.curriculo_status not null default 'draft',

  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),

  -- evita duplicar versões do mesmo curso/ano
  constraint curso_curriculos_escola_curso_ano_version_uk
    unique (escola_id, curso_id, ano_letivo_id, version)
);

-- 1 published por curso/ano/escola
create unique index if not exists curso_curriculos_one_published_per_year_ux
  on public.curso_curriculos (escola_id, curso_id, ano_letivo_id)
  where (status = 'published');

-- Índice de lookup rápido
create index if not exists curso_curriculos_lookup_idx
  on public.curso_curriculos (escola_id, curso_id, ano_letivo_id, status, version desc);

-- ----------------------------
-- 3) Trigger anti-spoof: força escola_id + created_by
-- ----------------------------
create or replace function public.curso_curriculos_force_fields()
returns trigger
language plpgsql
as $$
begin
  -- tenant hardening
  new.escola_id := public.current_tenant_escola_id();

  -- se vier null, setar actor
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;

  -- versão mínima (se o caller não passar)
  if new.version is null or new.version < 1 then
    new.version := 1;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_curso_curriculos_force_fields on public.curso_curriculos;
create trigger trg_curso_curriculos_force_fields
before insert on public.curso_curriculos
for each row
execute function public.curso_curriculos_force_fields();

-- ----------------------------
-- 4) RLS: curso_curriculos (tenant + role canônico)
-- ----------------------------
alter table public.curso_curriculos enable row level security;

drop policy if exists curso_curriculos_select on public.curso_curriculos;
create policy curso_curriculos_select
on public.curso_curriculos
for select
to authenticated
using (
  escola_id = public.current_tenant_escola_id()
);

drop policy if exists curso_curriculos_insert_admin on public.curso_curriculos;
create policy curso_curriculos_insert_admin
on public.curso_curriculos
for insert
to authenticated
with check (
  escola_id = public.current_tenant_escola_id()
  and public.user_has_role_in_school(escola_id, array['admin_escola'])
);

drop policy if exists curso_curriculos_update_admin on public.curso_curriculos;
create policy curso_curriculos_update_admin
on public.curso_curriculos
for update
to authenticated
using (
  escola_id = public.current_tenant_escola_id()
  and public.user_has_role_in_school(escola_id, array['admin_escola'])
)
with check (
  escola_id = public.current_tenant_escola_id()
  and public.user_has_role_in_school(escola_id, array['admin_escola'])
);

drop policy if exists curso_curriculos_delete_admin on public.curso_curriculos;
create policy curso_curriculos_delete_admin
on public.curso_curriculos
for delete
to authenticated
using (
  escola_id = public.current_tenant_escola_id()
  and public.user_has_role_in_school(escola_id, array['admin_escola'])
);

-- ----------------------------
-- 5) Alter: curso_matriz ganha curso_curriculo_id (compat)
-- ----------------------------
alter table public.curso_matriz
  add column if not exists curso_curriculo_id uuid;

-- FK do item -> header
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'curso_matriz_curso_curriculo_id_fkey'
  ) then
    alter table public.curso_matriz
      add constraint curso_matriz_curso_curriculo_id_fkey
      foreign key (curso_curriculo_id)
      references public.curso_curriculos(id)
      on delete restrict;
  end if;
end $$;

create index if not exists idx_curso_matriz_curriculo_lookup
  on public.curso_matriz (escola_id, curso_curriculo_id, classe_id);

-- ----------------------------
-- 6) Helper: resolver ano_letivo “ativo” por escola (determinístico)
-- ----------------------------
create or replace view public.vw_escola_ano_letivo_preferido as
select distinct on (al.escola_id)
  al.escola_id,
  al.id as ano_letivo_id
from public.anos_letivos al
order by al.escola_id, al.ativo desc, al.created_at desc;

-- ----------------------------
-- 7) Backfill: cria currículo v1 published por (escola, curso, ano_preferido)
--    e aponta curso_matriz existentes pra esse header.
-- ----------------------------

-- Desabilitar o trigger temporariamente para o backfill
alter table public.curso_curriculos disable trigger trg_curso_curriculos_force_fields;

-- 7.1 cria headers (apenas onde existe ano_letivo)
insert into public.curso_curriculos (escola_id, curso_id, ano_letivo_id, version, status, created_by)
select
  cm.escola_id,
  cm.curso_id,
  v.ano_letivo_id,
  1 as version,
  'published'::public.curriculo_status as status,
  null::uuid as created_by
from (
  select distinct escola_id, curso_id
  from public.curso_matriz
) cm
join public.vw_escola_ano_letivo_preferido v
  on v.escola_id = cm.escola_id
on conflict on constraint curso_curriculos_escola_curso_ano_version_uk
do nothing;

-- 7.2 aponta items antigos para o header v1 published do ano preferido
update public.curso_matriz cm
set curso_curriculo_id = (
  select cc.id
  from public.curso_curriculos cc
  where
    cc.escola_id = cm.escola_id
    and cc.curso_id = cm.curso_id
    and cc.ano_letivo_id = (select v.ano_letivo_id from public.vw_escola_ano_letivo_preferido v where v.escola_id = cm.escola_id)
    and cc.version = 1
)
where cm.curso_curriculo_id is null;

-- Reabilitar o trigger
alter table public.curso_curriculos enable trigger trg_curso_curriculos_force_fields;

-- ----------------------------
-- 8) Unicidade: mover UNIQUE para incluir currículo
--    Obs: hoje existem 2 UNIQUE redundantes na curso_matriz.
--    Vamos manter só 1 (currículo-aware).
-- ----------------------------

-- drop redundantes se existirem
alter table public.curso_matriz drop constraint if exists uq_curso_matriz_unique;
alter table public.curso_matriz drop constraint if exists curso_matriz_escola_id_curso_id_classe_id_disciplina_id_key;

-- novo UNIQUE (currículo-aware) - só aplica quando curriculo_id preenchido
create unique index if not exists curso_matriz_curriculo_unique_ux
  on public.curso_matriz (escola_id, curso_curriculo_id, classe_id, disciplina_id)
  where (curso_curriculo_id is not null);

-- ----------------------------
-- 9) Compat: Trigger em curso_matriz para auto-atribuir curriculo_id
--    (mantém instalador atual funcionando sem mudanças imediatas)
-- ----------------------------
create or replace function public.curso_matriz_fill_curriculo_id()
returns trigger
language plpgsql
as $$
declare
  v_ano uuid;
  v_cc uuid;
begin
  if new.curso_curriculo_id is not null then
    return new;
  end if;

  -- determina ano letivo preferido da escola
  select ano_letivo_id into v_ano
  from public.vw_escola_ano_letivo_preferido
  where escola_id = new.escola_id;

  if v_ano is null then
    -- Sem ano letivo: não inventar. Mantém null e deixa o app tratar como FAIL de setup.
    return new;
  end if;

  -- pega published atual; se não existir, cria v1 draft? NÃO. Só draft.
  select id into v_cc
  from public.curso_curriculos
  where escola_id = new.escola_id
    and curso_id = new.curso_id
    and ano_letivo_id = v_ano
    and status = 'published'
  order by version desc
  limit 1;

  if v_cc is null then
    -- fallback compat: criar draft v1 (não published), para não quebrar inserts.
    insert into public.curso_curriculos (escola_id, curso_id, ano_letivo_id, version, status, created_by)
    values (new.escola_id, new.curso_id, v_ano, 1, 'draft', auth.uid())
    on conflict on constraint curso_curriculos_escola_curso_ano_version_uk
    do update set status = excluded.status
    returning id into v_cc;
  end if;

  new.curso_curriculo_id := v_cc;
  return new;
end;
$$;

drop trigger if exists trg_curso_matriz_fill_curriculo_id on public.curso_matriz;
create trigger trg_curso_matriz_fill_curriculo_id
before insert on public.curso_matriz
for each row
execute function public.curso_matriz_fill_curriculo_id();

-- ----------------------------
-- 10) Anti-cross-tenant: garante escola_id do item = escola_id do header
-- ----------------------------
create or replace function public.curso_matriz_assert_same_escola()
returns trigger
language plpgsql
as $$
declare
  v_escola uuid;
begin
  if new.curso_curriculo_id is null then
    return new;
  end if;

  select escola_id into v_escola
  from public.curso_curriculos
  where id = new.curso_curriculo_id;

  if v_escola is null or v_escola <> new.escola_id then
    raise exception 'cross-tenant violation: curso_matriz.escola_id != curso_curriculos.escola_id';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_curso_matriz_assert_same_escola on public.curso_matriz;
create trigger trg_curso_matriz_assert_same_escola
before insert or update of curso_curriculo_id, escola_id on public.curso_matriz
for each row
execute function public.curso_matriz_assert_same_escola();

commit;
