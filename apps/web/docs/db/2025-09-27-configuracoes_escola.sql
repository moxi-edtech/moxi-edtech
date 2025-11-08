-- Configurações de Escola (Onboarding • Passo 2)
-- Cria/garante a tabela usada pelos endpoints:
--   - GET/PATCH /api/escolas/[id]/onboarding/preferences
-- Esta tabela guarda as preferências de estrutura acadêmica por escola.

-- 1) Criação idempotente da tabela base
create table if not exists public.configuracoes_escola (
  escola_id uuid primary key references public.escolas(id) on delete cascade,
  -- Estrutura acadêmica principal adotada pela escola
  -- Valores esperados: 'classes' | 'secoes' | 'cursos'
  estrutura text check (estrutura in ('classes','secoes','cursos')),

  -- Como a presença é registrada
  -- Valores esperados: 'secao' | 'curso'
  tipo_presenca text check (tipo_presenca in ('secao','curso')),

  -- Tipo de período letivo
  -- Valores esperados: 'semestre' | 'trimestre'
  periodo_tipo text check (periodo_tipo in ('semestre','trimestre')),

  -- Se a escola deseja autogerar períodos ao configurar o ano
  autogerar_periodos boolean default false,

  -- Carimbo de atualização
  updated_at timestamptz default now()
);

-- 2) Garantias idempotentes de colunas (caso a tabela já exista sem alguma coluna)
alter table public.configuracoes_escola add column if not exists estrutura text;
alter table public.configuracoes_escola add column if not exists tipo_presenca text;
alter table public.configuracoes_escola add column if not exists periodo_tipo text;
alter table public.configuracoes_escola add column if not exists autogerar_periodos boolean default false;
alter table public.configuracoes_escola add column if not exists updated_at timestamptz default now();

-- Observações:
-- - Os CHECKs definidos na criação garantem domínios válidos nas instalações novas.
-- - Em instalações existentes que já tinham as colunas sem CHECK, os ALTERs acima
--   não os reimpõem para evitar erros em execuções repetidas. Caso deseje reforçar
--   as restrições em bases antigas, adicione constraints manualmente conforme a sua
--   política de migração.

-- Após executar:
-- - No Supabase, acesse Settings > API e clique em "Reload" para recarregar o cache
--   do PostgREST, garantindo que as novas relações/colunas fiquem visíveis à API.

