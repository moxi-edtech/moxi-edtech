create or replace function public.financeiro_block_immutable_truncate()
returns trigger
language plpgsql
set search_path to 'pg_catalog','public'
as $$
begin
  raise exception 'IMMUTABILITY: histórico financeiro append-only não pode ser truncado';
end;
$$;

drop trigger if exists trg_fin_ledger_immutable_truncate on public.financeiro_ledger;
create trigger trg_fin_ledger_immutable_truncate
before truncate on public.financeiro_ledger
for each statement execute function public.financeiro_block_immutable_truncate();

drop trigger if exists trg_fin_estornos_immutable_truncate on public.financeiro_estornos;
create trigger trg_fin_estornos_immutable_truncate
before truncate on public.financeiro_estornos
for each statement execute function public.financeiro_block_immutable_truncate();

drop trigger if exists trg_fin_pag_reversao_immutable_truncate on public.financeiro_pagamento_reversoes;
create trigger trg_fin_pag_reversao_immutable_truncate
before truncate on public.financeiro_pagamento_reversoes
for each statement execute function public.financeiro_block_immutable_truncate();

drop trigger if exists trg_fin_pag_aloc_immutable_truncate on public.financeiro_pagamento_alocacoes;
create trigger trg_fin_pag_aloc_immutable_truncate
before truncate on public.financeiro_pagamento_alocacoes
for each statement execute function public.financeiro_block_immutable_truncate();

drop trigger if exists trg_fin_recibo_aloc_immutable_truncate on public.financeiro_recibo_alocacoes;
create trigger trg_fin_recibo_aloc_immutable_truncate
before truncate on public.financeiro_recibo_alocacoes
for each statement execute function public.financeiro_block_immutable_truncate();

revoke all on function public.financeiro_block_immutable_truncate()
  from public,anon,authenticated,service_role;
revoke all on function public.financeiro_block_immutable_row()
  from public,anon,authenticated,service_role;
revoke all on function public.fn_ledger_insert_once(
  uuid,uuid,text,text,text,uuid,text,integer,text,numeric,date,text,jsonb
) from public,anon,authenticated,service_role;

revoke references, trigger on table public.financeiro_ledger
  from anon,authenticated,service_role;
revoke references, trigger on table public.financeiro_estornos
  from anon,authenticated,service_role;
revoke references, trigger on table public.financeiro_pagamento_reversoes
  from anon,authenticated,service_role;
revoke references, trigger on table public.financeiro_pagamento_alocacoes
  from anon,authenticated,service_role;
revoke references, trigger on table public.financeiro_recibo_alocacoes
  from anon,authenticated,service_role;
