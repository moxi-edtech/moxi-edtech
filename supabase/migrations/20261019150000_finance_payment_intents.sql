begin;

create table if not exists public.finance_payment_intents (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references public.escolas(id) on delete cascade,
  aluno_id uuid references public.alunos(id) on delete set null,
  mensalidade_id uuid references public.mensalidades(id) on delete set null,
  amount numeric(14,2) not null,
  currency text not null default 'AOA',
  method text not null,
  external_ref text,
  proof_url text,
  status text not null default 'pending',
  confirmed_at timestamptz,
  confirmed_by uuid references auth.users(id),
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  constraint finance_payment_intents_status_check
    check (status in ('pending', 'confirmed', 'rejected', 'cancelled'))
);

create index if not exists idx_finance_payment_intents_escola_status
  on public.finance_payment_intents (escola_id, status, created_at desc);

create unique index if not exists ux_finance_payment_intents_dedupe
  on public.finance_payment_intents (escola_id, dedupe_key);

alter table public.finance_payment_intents enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'finance_payment_intents'
      and policyname = 'finance_payment_intents_select'
  ) then
    create policy finance_payment_intents_select
      on public.finance_payment_intents
      for select
      to authenticated
      using (public.can_manage_school(escola_id));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'finance_payment_intents'
      and policyname = 'finance_payment_intents_insert'
  ) then
    create policy finance_payment_intents_insert
      on public.finance_payment_intents
      for insert
      to authenticated
      with check (public.can_manage_school(escola_id));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'finance_payment_intents'
      and policyname = 'finance_payment_intents_update'
  ) then
    create policy finance_payment_intents_update
      on public.finance_payment_intents
      for update
      to authenticated
      using (public.can_manage_school(escola_id))
      with check (public.can_manage_school(escola_id));
  end if;
end $$;

create or replace function public.finance_confirm_payment(
  p_intent_id uuid,
  p_dedupe_key_override text default null
)
returns public.finance_payment_intents
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_intent public.finance_payment_intents;
  v_existing public.finance_payment_intents;
  v_dedupe text;
  v_before jsonb;
  v_after jsonb;
  v_mensalidade public.mensalidades%rowtype;
  v_total numeric(14,2);
  v_expected numeric(14,2);
  v_status text;
  v_payment_id uuid;
  v_metodo_pagamento text;
  v_data_pagamento date;
begin
  select *
    into v_intent
    from public.finance_payment_intents
   where id = p_intent_id
   for update;

  if not found then
    raise exception 'payment intent não encontrado';
  end if;

  if not public.can_manage_school(v_intent.escola_id) then
    raise exception 'sem permissão para escola %', v_intent.escola_id;
  end if;

  v_dedupe := coalesce(p_dedupe_key_override, v_intent.dedupe_key);

  select *
    into v_existing
    from public.finance_payment_intents
   where escola_id = v_intent.escola_id
     and dedupe_key = v_dedupe
     and id <> v_intent.id
     and status = 'confirmed'
   limit 1;

  if found then
    return v_existing;
  end if;

  if v_intent.status = 'confirmed' then
    return v_intent;
  end if;

  if v_intent.status <> 'pending' then
    raise exception 'intent status % não pode ser confirmado', v_intent.status;
  end if;

  if p_dedupe_key_override is not null and v_intent.dedupe_key <> p_dedupe_key_override then
    update public.finance_payment_intents
       set dedupe_key = p_dedupe_key_override
     where id = v_intent.id;
  end if;

  v_before := jsonb_build_object(
    'status', v_intent.status,
    'confirmed_at', v_intent.confirmed_at,
    'confirmed_by', v_intent.confirmed_by
  );

  update public.finance_payment_intents
     set status = 'confirmed',
         confirmed_at = now(),
         confirmed_by = auth.uid()
   where id = v_intent.id
   returning * into v_intent;

  v_after := jsonb_build_object(
    'status', v_intent.status,
    'confirmed_at', v_intent.confirmed_at,
    'confirmed_by', v_intent.confirmed_by
  );

  if v_intent.mensalidade_id is not null then
    select *
      into v_mensalidade
      from public.mensalidades
     where id = v_intent.mensalidade_id
     for update;

    if found then
      v_metodo_pagamento := case
        when v_intent.method in ('dinheiro', 'numerario', 'cash') then 'dinheiro'
        when v_intent.method in ('tpa', 'tpa_fisico', 'tp') then 'tpa_fisico'
        when v_intent.method in ('transferencia', 'transferencia_bancaria') then 'transferencia'
        when v_intent.method in ('referencia') then 'referencia'
        else null
      end;

      insert into public.pagamentos (
        mensalidade_id,
        valor_pago,
        data_pagamento,
        conciliado,
        transacao_id_externo,
        metodo_pagamento,
        metodo,
        referencia,
        status,
        escola_id
      ) values (
        v_intent.mensalidade_id,
        v_intent.amount,
        current_date,
        true,
        v_intent.external_ref,
        v_metodo_pagamento,
        v_intent.method,
        v_intent.external_ref,
        'concluido',
        v_intent.escola_id
      )
      returning id into v_payment_id;

      select coalesce(sum(valor_pago), 0)
        into v_total
        from public.pagamentos
       where mensalidade_id = v_intent.mensalidade_id
         and conciliado = true
         and status = 'concluido';

      v_expected := coalesce(v_mensalidade.valor_previsto, v_mensalidade.valor, 0);
      v_status := v_mensalidade.status;
      if v_expected > 0 and v_total >= v_expected then
        v_status := 'pago';
      elsif v_total > 0 then
        v_status := 'pago_parcial';
      end if;

      v_data_pagamento := case when v_status = 'pago' then current_date else v_mensalidade.data_pagamento_efetiva end;

      update public.mensalidades
         set valor_pago_total = v_total,
             status = v_status,
             data_pagamento_efetiva = v_data_pagamento,
             metodo_pagamento = v_intent.method
       where id = v_intent.mensalidade_id;

      perform public.create_audit_event(
        v_intent.escola_id,
        'FINANCE_PAYMENT_CONFIRMED',
        'mensalidades',
        v_intent.mensalidade_id::text,
        jsonb_build_object(
          'status', v_mensalidade.status,
          'valor_pago_total', v_mensalidade.valor_pago_total,
          'data_pagamento_efetiva', v_mensalidade.data_pagamento_efetiva
        ),
        jsonb_build_object(
          'status', v_status,
          'valor_pago_total', v_total,
          'data_pagamento_efetiva', v_data_pagamento
        ),
        'financeiro',
        jsonb_build_object(
          'intent_id', v_intent.id,
          'payment_id', v_payment_id
        )
      );
    end if;
  end if;

  perform public.create_audit_event(
    v_intent.escola_id,
    'FINANCE_PAYMENT_CONFIRMED',
    'finance_payment_intents',
    v_intent.id::text,
    v_before,
    v_after,
    'financeiro',
    jsonb_build_object(
      'mensalidade_id', v_intent.mensalidade_id
    )
  );

  insert into public.outbox_events (
    escola_id,
    event_type,
    dedupe_key,
    idempotency_key,
    payload
  ) values (
    v_intent.escola_id,
    'FINANCE_PAYMENT_CONFIRMED',
    v_intent.id,
    'finance_payment_confirmed:' || v_intent.id::text,
    jsonb_build_object(
      'intent_id', v_intent.id,
      'escola_id', v_intent.escola_id,
      'mensalidade_id', v_intent.mensalidade_id,
      'amount', v_intent.amount,
      'currency', v_intent.currency,
      'method', v_intent.method
    )
  )
  on conflict do nothing;

  return v_intent;
end;
$$;

create or replace function public.process_outbox_batch(p_limit int default 50)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.outbox_events%rowtype;
  v_processed int := 0;
  v_backoff interval;
  v_lock boolean;
begin
  v_lock := pg_try_advisory_lock(hashtext('outbox_finance_worker'));
  if not v_lock then
    return 0;
  end if;

  for v_event in
    with candidate as (
      select id
        from public.outbox_events
       where status in ('pending', 'failed')
         and next_attempt_at <= now()
         and attempts < max_attempts
         and event_type = 'FINANCE_PAYMENT_CONFIRMED'
       order by next_attempt_at asc, created_at asc
       limit greatest(1, least(p_limit, 50))
       for update skip locked
    )
    update public.outbox_events o
       set status = 'processing',
           locked_at = now(),
           locked_by = 'cron',
           attempts = o.attempts + 1
     where o.id in (select id from candidate)
    returning o.*
  loop
    begin
      perform public.refresh_mv_pagamentos_status();
      perform public.refresh_mv_radar_inadimplencia();

      update public.outbox_events
         set status = 'sent',
             processed_at = now(),
             last_error = null,
             locked_at = null,
             locked_by = null
       where id = v_event.id;

      v_processed := v_processed + 1;
    exception when others then
      v_backoff :=
        case
          when v_event.attempts <= 1 then interval '2 minutes'
          when v_event.attempts = 2 then interval '5 minutes'
          when v_event.attempts = 3 then interval '15 minutes'
          when v_event.attempts = 4 then interval '1 hour'
          when v_event.attempts = 5 then interval '3 hours'
          else interval '6 hours'
        end;

      if v_event.attempts >= v_event.max_attempts then
        update public.outbox_events
           set status = 'dead',
               last_error = left(sqlerrm, 2000),
               locked_at = null,
               locked_by = null
         where id = v_event.id;
      else
        update public.outbox_events
           set status = 'failed',
               next_attempt_at = now() + v_backoff,
               last_error = left(sqlerrm, 2000),
               locked_at = null,
               locked_by = null
         where id = v_event.id;
      end if;
    end;
  end loop;

  perform pg_advisory_unlock(hashtext('outbox_finance_worker'));
  return v_processed;
end;
$$;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    if not exists (select 1 from cron.job where jobname = 'process_outbox_batch_finance') then
      perform cron.schedule(
        'process_outbox_batch_finance',
        '*/1 * * * *',
        'select public.process_outbox_batch(50);'
      );
    end if;
  end if;
end $$;

commit;
