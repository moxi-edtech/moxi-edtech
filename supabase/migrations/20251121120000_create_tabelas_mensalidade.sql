-- Tabela de regras de mensalidade por escola/curso/classe
create table if not exists public.tabelas_mensalidade (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references public.escolas(id) on delete cascade,
  curso_id uuid null references public.cursos(id) on delete set null,
  classe_id uuid null references public.classes(id) on delete set null,
  valor numeric(14,2) not null,
  dia_vencimento smallint null check (dia_vencimento between 1 and 31),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes úteis
create index if not exists idx_tabmens_escola on public.tabelas_mensalidade (escola_id);
create index if not exists idx_tabmens_chave on public.tabelas_mensalidade (escola_id, curso_id, classe_id);

-- Habilita RLS multi-tenant
alter table public.tabelas_mensalidade enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'TabelasMens - Tenant Isolation' and tablename = 'tabelas_mensalidade'
  ) then
    create policy "TabelasMens - Tenant Isolation"
    on public.tabelas_mensalidade
    using (escola_id = public.current_tenant_escola_id())
    with check (escola_id = public.current_tenant_escola_id());
  end if;
end$$;
