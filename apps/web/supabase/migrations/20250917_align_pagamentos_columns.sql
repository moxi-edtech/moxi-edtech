-- Align pagamentos table to app expectations (metodo/referencia)

do $$ begin
  -- Add columns if they don't exist
  alter table public.pagamentos add column if not exists metodo text;
  alter table public.pagamentos add column if not exists referencia text;
exception when others then null; end $$;

-- Backfill from legacy columns if present
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pagamentos' and column_name = 'forma_pagamento'
  ) then
    update public.pagamentos
      set metodo = forma_pagamento
      where metodo is null and forma_pagamento is not null;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pagamentos' and column_name = 'referencia_transacao'
  ) then
    update public.pagamentos
      set referencia = referencia_transacao
      where referencia is null and referencia_transacao is not null;
  end if;
end $$;

-- Optional: keep columns in sync via triggers (lightweight). Skipped for now to avoid complexity.

notify pgrst, 'reload schema';

