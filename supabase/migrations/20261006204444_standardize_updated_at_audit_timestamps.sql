set lock_timeout = '5s';

alter table public.matriculas
  alter column updated_at set default now();

update public.matriculas
set updated_at = now()
where updated_at is null;

alter table public.matriculas
  alter column updated_at set not null;

alter table public.servico_pedidos
  add column if not exists updated_at timestamptz;

update public.servico_pedidos
set updated_at = coalesce(created_at, now())
where updated_at is null;

update public.servico_pedidos sp
set updated_at = coalesce(
  (
    select al.created_at
    from public.audit_logs al
    where al.escola_id = sp.escola_id
      and al.entity_id = 'CURTUME_COHORT_20261006_V2'
      and al.action = 'CURTUME_COHORT_20261006_FINANCIAL_LINKS_VERIFIED'
    order by al.created_at desc
    limit 1
  ),
  sp.updated_at
)
where sp.contexto->>'operation_key' = 'CURTUME_COHORT_20261006_V2';

alter table public.servico_pedidos
  alter column updated_at set default now(),
  alter column updated_at set not null;

drop trigger if exists trg_servico_pedidos_set_updated_at on public.servico_pedidos;
create trigger trg_servico_pedidos_set_updated_at
before update on public.servico_pedidos
for each row
execute function public.set_updated_at();

comment on column public.matriculas.updated_at is
  'Timestamp da última alteração da matrícula; atualizado automaticamente em UPDATE.';

comment on column public.servico_pedidos.updated_at is
  'Timestamp da última alteração do pedido de serviço; atualizado automaticamente em UPDATE.';
