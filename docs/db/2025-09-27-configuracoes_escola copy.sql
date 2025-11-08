-- Criação da tabela de preferências de configuração da escola
-- Referenciada por /api/escolas/[id]/onboarding/preferences (GET/PATCH)

create table if not exists public.configuracoes_escola (
  escola_id uuid primary key,
  estrutura text check (estrutura in ('classes','secoes','cursos')) null,
  tipo_presenca text check (tipo_presenca in ('secao','curso')) null,
  periodo_tipo text check (periodo_tipo in ('semestre','trimestre')) null,
  autogerar_periodos boolean default false,
  updated_at timestamptz default now()
);

-- Índice auxiliar para buscas por escola
create unique index if not exists configuracoes_escola_escola_id_idx
  on public.configuracoes_escola (escola_id);

-- RLS opcional (os handlers usam service role); ajuste conforme política do projeto
alter table public.configuracoes_escola enable row level security;

-- POLÍTICAS (exemplos):
-- Permitir leitura para usuários autenticados da mesma escola, se aplicável ao seu modelo:
-- create policy if not exists "read_by_escola"
--   on public.configuracoes_escola for select
--   using (true);

-- Permitir escrita apenas via service role (já garantido pelos handlers)
-- ou defina políticas específicas para administradores:
-- create policy if not exists "write_by_service_role"
--   on public.configuracoes_escola for all
--   using (auth.role() = 'service_role')
--   with check (auth.role() = 'service_role');

