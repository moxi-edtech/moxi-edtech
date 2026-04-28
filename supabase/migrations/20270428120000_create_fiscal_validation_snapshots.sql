-- Snapshot imutável para validações KLASSE vs oráculo externo
create table if not exists public.fiscal_validation_snapshots (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references public.escolas(id) on delete restrict,
  empresa_id uuid not null,
  idempotency_key text not null,
  scenario_code text not null,
  klasse_result jsonb not null,
  provider_result jsonb not null,
  divergence_total numeric(18,4) not null default 0,
  payload_hash text not null,
  created_by uuid null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint fiscal_validation_snapshots_divergence_zero_chk check (divergence_total = 0),
  constraint fiscal_validation_snapshots_idempotency_uk unique (escola_id, idempotency_key)
);

create index if not exists ix_fiscal_validation_snapshots_escola_created
  on public.fiscal_validation_snapshots (escola_id, created_at desc);

create or replace function public.fiscal_validation_snapshots_block_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'IMMUTABLE_SNAPSHOT: fiscal_validation_snapshots is append-only';
end;
$$;

drop trigger if exists trg_fiscal_validation_snapshots_no_update
  on public.fiscal_validation_snapshots;
create trigger trg_fiscal_validation_snapshots_no_update
before update on public.fiscal_validation_snapshots
for each row execute function public.fiscal_validation_snapshots_block_mutation();

drop trigger if exists trg_fiscal_validation_snapshots_no_delete
  on public.fiscal_validation_snapshots;
create trigger trg_fiscal_validation_snapshots_no_delete
before delete on public.fiscal_validation_snapshots
for each row execute function public.fiscal_validation_snapshots_block_mutation();

alter table public.fiscal_validation_snapshots enable row level security;

drop policy if exists "fiscal_validation_snapshots_select" on public.fiscal_validation_snapshots;
create policy "fiscal_validation_snapshots_select"
  on public.fiscal_validation_snapshots
  for select
  using (escola_id = public.current_escola_id());

drop policy if exists "fiscal_validation_snapshots_insert" on public.fiscal_validation_snapshots;
create policy "fiscal_validation_snapshots_insert"
  on public.fiscal_validation_snapshots
  for insert
  with check (escola_id = public.current_escola_id());
