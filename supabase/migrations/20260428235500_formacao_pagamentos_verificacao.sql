create table if not exists public.formacao_pagamentos_verificacao (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references public.escolas(id) on delete cascade,
  fatura_item_id uuid not null references public.formacao_faturas_lote_itens(id) on delete cascade,
  formando_user_id uuid not null,
  comprovativo_url text not null,
  valor_informado numeric(14,2),
  mensagem_aluno text,
  status text not null default 'submetido' check (status in ('submetido','em_analise','aprovado','rejeitado','contestacao')),
  motivo_rejeicao text,
  analisado_por uuid,
  analisado_em timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_formacao_pagamentos_verificacao_escola_status
  on public.formacao_pagamentos_verificacao (escola_id, status, created_at desc);

create index if not exists idx_formacao_pagamentos_verificacao_item
  on public.formacao_pagamentos_verificacao (fatura_item_id, created_at desc);

create index if not exists idx_formacao_pagamentos_verificacao_formando
  on public.formacao_pagamentos_verificacao (formando_user_id, created_at desc);

create or replace function public.set_updated_at_formacao_pagamentos_verificacao()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_updated_at_formacao_pagamentos_verificacao on public.formacao_pagamentos_verificacao;
create trigger trg_set_updated_at_formacao_pagamentos_verificacao
before update on public.formacao_pagamentos_verificacao
for each row
execute function public.set_updated_at_formacao_pagamentos_verificacao();
