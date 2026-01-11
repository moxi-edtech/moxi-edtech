begin;

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

  if auth.role() <> 'service_role' and not public.can_manage_school(v_intent.escola_id) then
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

      update public.pagamentos
         set status = 'concluido',
             conciliado = true,
             data_pagamento = current_date,
             metodo_pagamento = v_metodo_pagamento,
             metodo = v_intent.method,
             referencia = v_intent.external_ref,
             escola_id = coalesce(escola_id, v_intent.escola_id)
       where transacao_id_externo is not null
         and transacao_id_externo = v_intent.external_ref
         and mensalidade_id = v_intent.mensalidade_id
       returning id into v_payment_id;

      if v_payment_id is null then
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
      end if;

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

commit;
