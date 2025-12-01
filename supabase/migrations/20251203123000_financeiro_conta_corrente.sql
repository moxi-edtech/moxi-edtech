-- =====================================================================
-- 💰 MÓDULO FINANCEIRO — CONTA CORRENTE (MoxiNexa)
-- Compatível com estrutura multi-tenant atual
-- =====================================================================

-- 0. EXTENSÕES (se ainda não estiverem criadas)
create extension if not exists "pgcrypto";

-- =====================================================================
-- 1. ENUMS ESPECÍFICOS DO FINANCEIRO
-- (criamos apenas se ainda não existirem)
-- =====================================================================

do $$
begin
  -- Categoria do item financeiro (uniforme, documento, etc.)
  if not exists (select 1 from pg_type where typname = 'financeiro_categoria_item') then
    create type financeiro_categoria_item as enum (
      'uniforme',
      'documento',
      'material',
      'transporte',
      'outros',
      'servico'
    );
  end if;

  -- Tipo de lançamento: débito (dívida) ou crédito (pagamento/ajuste)
  if not exists (select 1 from pg_type where typname = 'financeiro_tipo_transacao') then
    create type financeiro_tipo_transacao as enum ('debito', 'credito');
  end if;

  -- Origem da transação: de onde nasceu aquela linha
  if not exists (select 1 from pg_type where typname = 'financeiro_origem') then
    create type financeiro_origem as enum (
      'mensalidade',
      'matricula',
      'venda_avulsa',
      'multa',
      'taxa_extra'
    );
  end if;

  -- Status financeiro (para lançamentos de débito)
  if not exists (select 1 from pg_type where typname = 'financeiro_status') then
    create type financeiro_status as enum (
      'pendente',
      'pago',
      'parcial',
      'vencido',
      'cancelado'
    );
  end if;
end
$$;

-- Se já existir um metodo_pagamento_enum no projeto, apenas extendemos.
do $$
begin
  if exists (select 1 from pg_type where typname = 'metodo_pagamento_enum') then
    if not exists (
      select 1 from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      where t.typname = 'metodo_pagamento_enum' and e.enumlabel = 'deposito'
    ) then
      alter type metodo_pagamento_enum add value 'deposito';
    end if;
  else
    -- Se ainda não existir, criamos um padrão.
    create type metodo_pagamento_enum as enum (
      'numerario',
      'multicaixa',
      'transferencia',
      'deposito'
    );
  end if;
end
$$;

-- =====================================================================
-- 2. FUNÇÃO GENÉRICA DE TIMESTAMP (se ainda não existir)
-- =====================================================================

create or replace function set_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- =====================================================================
-- 3. TABELA DE PREÇOS (REGRAS POR ANO / CURSO / CLASSE)
-- =====================================================================

create table if not exists financeiro_tabelas (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references public.escolas(id) on delete cascade,

  ano_letivo int not null, -- ex: 2025

  -- Vínculos (se nulos, funciona como "regra geral" para a escola)
  curso_id uuid references public.cursos(id) on delete set null,
  classe_id uuid references public.classes(id) on delete set null,

  -- Valores
  valor_matricula numeric(12,2) not null default 0,
  valor_mensalidade numeric(12,2) not null default 0,

  -- Regras de cobrança
  dia_vencimento int default 10,                 -- dia do mês
  multa_atraso_percentual numeric(5,2) default 0, -- ex: 10 (%)
  multa_diaria numeric(10,2) default 0,          -- ex: 50 Kz/dia

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- Regra de ouro: não duplicar regra por ano/curso/classe na mesma escola
  unique(escola_id, ano_letivo, curso_id, classe_id)
);

drop trigger if exists set_timestamp_financeiro_tabelas on financeiro_tabelas;
create trigger set_timestamp_financeiro_tabelas
before update on financeiro_tabelas
for each row execute function set_timestamp();

-- =====================================================================
-- 4. CATÁLOGO DE PRODUTOS (ITENS AVULSOS)
-- =====================================================================

create table if not exists financeiro_itens (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references public.escolas(id) on delete cascade,

  nome text not null,
  categoria financeiro_categoria_item not null default 'outros',
  preco numeric(12,2) not null default 0,

  -- Gestão de estoque simples
  controla_estoque boolean not null default false,
  estoque_atual int not null default 0,

  ativo boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists financeiro_itens_escola_nome_uniq
  on financeiro_itens (escola_id, lower(nome));

drop trigger if exists set_timestamp_financeiro_itens on financeiro_itens;
create trigger set_timestamp_financeiro_itens
before update on financeiro_itens
for each row execute function set_timestamp();

-- =====================================================================
-- 5. CONTA CORRENTE DO ALUNO (LANÇAMENTOS)
-- =====================================================================

create table if not exists financeiro_lancamentos (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references public.escolas(id) on delete cascade,

  aluno_id uuid not null references public.alunos(id) on delete cascade,
  matricula_id uuid references public.matriculas(id) on delete set null, -- link opcional ao ano letivo

  -- Detalhes da transação
  tipo financeiro_tipo_transacao not null,   -- 'debito' ou 'credito'
  origem financeiro_origem not null,        -- de onde veio
  descricao text not null,                  -- ex: "Propina Outubro 2025"

  -- Valores
  valor_original numeric(12,2) not null default 0,
  valor_multa numeric(12,2) default 0,
  valor_desconto numeric(12,2) default 0,
  valor_total numeric(12,2)
    generated always as (valor_original + valor_multa - valor_desconto) stored,

  -- Controle de propinas (para idempotência)
  mes_referencia int, -- 1 a 12
  ano_referencia int, -- ex: 2025

  -- Estado (faz mais sentido para DÉBITO; para CRÉDITO pode ser sempre 'pago')
  status financeiro_status default 'pendente',

  data_vencimento date,
  data_pagamento timestamptz,

  -- Integrado com enum global de método de pagamento
  metodo_pagamento metodo_pagamento_enum,
  comprovativo_url text,

  created_at timestamptz default now(),
  created_by uuid, -- id do user que gerou (auth.users.id ou profiles.user_id, conforme padrão do projeto)

  -- Você pode adicionar updated_at se quiser rastrear alterações
  -- updated_at timestamptz default now()
);

-- (Opcional) se quiser versionar edits:
-- alter table financeiro_lancamentos add column updated_at timestamptz default now();
-- create trigger set_timestamp_financeiro_lancamentos
-- before update on financeiro_lancamentos
-- for each row execute function set_timestamp();

-- =====================================================================
-- 6. ÍNDICES DE PERFORMANCE
-- =====================================================================

create index if not exists idx_fin_lancamentos_aluno
  on financeiro_lancamentos (aluno_id);

create index if not exists idx_fin_lancamentos_escola_status
  on financeiro_lancamentos (escola_id, status);

create index if not exists idx_fin_lancamentos_escola_ano_mes
  on financeiro_lancamentos (escola_id, ano_referencia, mes_referencia);

create index if not exists idx_fin_tabelas_escola_ano
  on financeiro_tabelas (escola_id, ano_letivo);

-- =====================================================================
-- 7. CONSTRAINT DE IDEMPOTÊNCIA (PROPINA MENSAL)
-- =====================================================================

create unique index if not exists unique_mensalidade_aluno
on financeiro_lancamentos (escola_id, aluno_id, ano_referencia, mes_referencia)
where origem = 'mensalidade' and tipo = 'debito';

-- =====================================================================
-- 8. RLS (ROW LEVEL SECURITY) AJUSTADO AO PADRÃO MOXINEXA
--    Assumindo função: current_tenant_escola_id() -> uuid
-- =====================================================================

-- Função helper (se ainda não existir)
create or replace function current_tenant_escola_id()
returns uuid as $$
  select (auth.jwt() ->> 'escola_id')::uuid;
$$ language sql stable;

-- 8.1 financeiro_tabelas
alter table financeiro_tabelas enable row level security;

drop policy if exists financeiro_tabelas_select on financeiro_tabelas;
create policy financeiro_tabelas_select
  on financeiro_tabelas
  for select
  using (escola_id = current_tenant_escola_id());

drop policy if exists financeiro_tabelas_mutation on financeiro_tabelas;
create policy financeiro_tabelas_mutation
  on financeiro_tabelas
  for all
  using (escola_id = current_tenant_escola_id())
  with check (escola_id = current_tenant_escola_id());

-- 8.2 financeiro_itens
alter table financeiro_itens enable row level security;

drop policy if exists financeiro_itens_select on financeiro_itens;
create policy financeiro_itens_select
  on financeiro_itens
  for select
  using (escola_id = current_tenant_escola_id());

drop policy if exists financeiro_itens_mutation on financeiro_itens;
create policy financeiro_itens_mutation
  on financeiro_itens
  for all
  using (escola_id = current_tenant_escola_id())
  with check (escola_id = current_tenant_escola_id());

-- 8.3 financeiro_lancamentos
alter table financeiro_lancamentos enable row level security;

drop policy if exists financeiro_lancamentos_select on financeiro_lancamentos;
create policy financeiro_lancamentos_select
  on financeiro_lancamentos
  for select
  using (escola_id = current_tenant_escola_id());

drop policy if exists financeiro_lancamentos_mutation on financeiro_lancamentos;
create policy financeiro_lancamentos_mutation
  on financeiro_lancamentos
  for all
  using (escola_id = current_tenant_escola_id())
  with check (escola_id = current_tenant_escola_id());
