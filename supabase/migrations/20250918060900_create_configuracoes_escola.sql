-- apps/web/supabase/migrations/20250918060900_create_configuracoes_escola.sql
-- Cria tabela para armazenar preferências de configuração da escola (onboarding etapa 2)

create table if not exists public.configuracoes_escola (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references public.escolas(id) on delete cascade,
  estrutura text not null check (estrutura in ('classes','secoes','cursos')),
  tipo_presenca text not null check (tipo_presenca in ('secao','curso')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint configuracoes_escola_unique_escola unique (escola_id)
);

-- RLS por tenant (escola)
alter table if exists public.configuracoes_escola enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='configuracoes_escola' and policyname='tenant_isolation'
  ) then
    create policy tenant_isolation on public.configuracoes_escola
      using (escola_id = public.current_tenant_escola_id())
      with check (escola_id = public.current_tenant_escola_id());
  end if;
end $$;

-- Trigger para manter updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_bu_config_escola_updated_at') then
    create trigger trg_bu_config_escola_updated_at
    before update on public.configuracoes_escola
    for each row execute function public.set_updated_at();
  end if;
end $$;

-- Força PostgREST a recarregar o cache
notify pgrst, 'reload schema';

