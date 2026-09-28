-- Fiscal readiness DB invariants after BILL-010.
-- Run against a disposable staging/branch database.
-- This file intentionally performs negative mutation attempts and rolls back.

begin;

create temp table fiscal_readiness_results (
  case_name text primary key,
  passed boolean not null,
  detail text not null
) on commit drop;

-- Cross-tenant RLS: pick one company with documents and another company's operator.
select set_config(
  'app.readiness_target_empresa',
  (
    select empresa_id::text
    from public.fiscal_documentos
    group by empresa_id
    order by count(*) desc
    limit 1
  ),
  true
);

select set_config(
  'app.readiness_foreign_user',
  (
    select eu.user_id::text
    from public.fiscal_empresa_users eu
    where eu.empresa_id <> current_setting('app.readiness_target_empresa')::uuid
      and eu.role in ('owner','admin','operator')
    order by eu.created_at
    limit 1
  ),
  true
);

select set_config(
  'app.readiness_target_document',
  (
    select d.id::text
    from public.fiscal_documentos d
    where d.empresa_id=current_setting('app.readiness_target_empresa')::uuid
      and d.status='emitido'
    order by d.created_at desc
    limit 1
  ),
  true
);

select set_config(
  'app.readiness_target_item',
  (
    select i.id::text
    from public.fiscal_documento_itens i
    where i.documento_id=current_setting('app.readiness_target_document')::uuid
    order by i.linha_no
    limit 1
  ),
  true
);

select set_config(
  'app.readiness_target_event',
  (
    select e.id::text
    from public.fiscal_documentos_eventos e
    where e.documento_id=current_setting('app.readiness_target_document')::uuid
    order by e.created_at
    limit 1
  ),
  true
);

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('app.readiness_foreign_user'),true);
select set_config('request.jwt.claim.role','authenticated',true);

do $readiness$
declare
  v_count bigint;
  v_err text;
begin
  select count(*) into v_count
  from public.fiscal_documentos
  where empresa_id=current_setting('app.readiness_target_empresa')::uuid;

  insert into fiscal_readiness_results values(
    'cross_tenant_select',
    v_count=0,
    'visible foreign docs='||v_count
  );

  begin
    insert into public.fiscal_series(
      empresa_id,tipo_documento,prefixo,origem_documento
    ) values(
      current_setting('app.readiness_target_empresa')::uuid,
      'PP','READINESS-XTENANT','interno'
    );
    insert into fiscal_readiness_results values(
      'cross_tenant_insert',false,'foreign fiscal_series insert accepted'
    );
  exception when others then
    get stacked diagnostics v_err=message_text;
    insert into fiscal_readiness_results values(
      'cross_tenant_insert',
      position('permission' in lower(v_err))>0
        or position('row-level security' in lower(v_err))>0
        or position('policy' in lower(v_err))>0
        or position('AUTH:' in v_err)>0,
      v_err
    );
  end;

  begin
    perform public.fiscal_rectificar_documento(
      current_setting('app.readiness_target_document')::uuid,
      'cross tenant readiness',
      jsonb_build_object(
        'correction_document_id',
        current_setting('app.readiness_target_document')
      )
    );
    insert into fiscal_readiness_results values(
      'cross_tenant_rpc',false,'foreign rectification accepted'
    );
  exception when others then
    get stacked diagnostics v_err=message_text;
    insert into fiscal_readiness_results values(
      'cross_tenant_rpc',
      position('AUTH:' in v_err)>0
        or position('permissão' in lower(v_err))>0,
      v_err
    );
  end;
end
$readiness$;

reset role;

do $readiness$
declare
  v_err text;
  v_ledger_id uuid;
  v_ledger_value numeric;
begin
  begin
    delete from public.fiscal_documentos
    where id=current_setting('app.readiness_target_document')::uuid;
    insert into fiscal_readiness_results values(
      'delete_emitted_document',false,'DELETE accepted'
    );
  exception when others then
    get stacked diagnostics v_err=message_text;
    insert into fiscal_readiness_results values(
      'delete_emitted_document',
      position('IMMUTABILITY:' in v_err)>0,
      v_err
    );
  end;

  begin
    update public.fiscal_documento_itens
    set descricao=descricao||' MUTATED'
    where id=current_setting('app.readiness_target_item')::uuid;
    insert into fiscal_readiness_results values(
      'update_emitted_item',false,'UPDATE accepted'
    );
  exception when others then
    get stacked diagnostics v_err=message_text;
    insert into fiscal_readiness_results values(
      'update_emitted_item',
      position('IMMUTABILITY:' in v_err)>0,
      v_err
    );
  end;

  begin
    delete from public.fiscal_documentos_eventos
    where id=current_setting('app.readiness_target_event')::uuid;
    insert into fiscal_readiness_results values(
      'delete_fiscal_event',false,'DELETE accepted'
    );
  exception when others then
    get stacked diagnostics v_err=message_text;
    insert into fiscal_readiness_results values(
      'delete_fiscal_event',
      position('IMMUTABILITY:' in v_err)>0,
      v_err
    );
  end;

  select id,valor into v_ledger_id,v_ledger_value
  from public.financeiro_ledger
  order by created_at
  limit 1;

  if v_ledger_id is not null then
    begin
      update public.financeiro_ledger
      set valor=v_ledger_value+1
      where id=v_ledger_id;
      insert into fiscal_readiness_results values(
        'update_financial_ledger',false,'ledger UPDATE accepted'
      );
    exception when others then
      get stacked diagnostics v_err=message_text;
      insert into fiscal_readiness_results values(
        'update_financial_ledger',
        position('IMMUTABILITY:' in v_err)>0,
        v_err
      );
    end;

    begin
      delete from public.financeiro_ledger where id=v_ledger_id;
      insert into fiscal_readiness_results values(
        'delete_financial_ledger',false,'ledger DELETE accepted'
      );
    exception when others then
      get stacked diagnostics v_err=message_text;
      insert into fiscal_readiness_results values(
        'delete_financial_ledger',
        position('IMMUTABILITY:' in v_err)>0,
        v_err
      );
    end;
  end if;
end
$readiness$;

do $readiness$
declare
  v_insert_guard text;
  v_update_guard text;
  v_payment_id uuid;
  v_school_id uuid;
  v_err text;
begin
  insert into fiscal_readiness_results
  select
    'bill018_payment_unique_index',
    exists(
      select 1
      from pg_indexes
      where schemaname='public'
        and tablename='pagamentos'
        and indexname='ux_pagamentos_escola_idempotency'
    ),
    'ux_pagamentos_escola_idempotency';

  select pg_get_functiondef(
    'public.financeiro_guard_pagamento_insert()'::regprocedure
  ) into v_insert_guard;

  insert into fiscal_readiness_results values(
    'bill018_new_payment_guard',
    position('IDEMPOTENCY:' in v_insert_guard)>0
      and position('idempotency_key' in v_insert_guard)>0,
    'prospective insert guard'
  );

  select pg_get_functiondef(
    'public.financeiro_guard_pagamento_update()'::regprocedure
  ) into v_update_guard;

  insert into fiscal_readiness_results values(
    'bill018_identity_immutable',
    position('idempotency_key do pagamento não pode ser alterada' in v_update_guard)>0,
    'immutable operation identity'
  );

  insert into fiscal_readiness_results
  select
    'bill018_historical_nulls_preserved',
    not a.attnotnull,
    'pagamentos.idempotency_key stays physically nullable; INSERT guard is prospective'
  from pg_attribute a
  where a.attrelid='public.pagamentos'::regclass
    and a.attname='idempotency_key'
    and not a.attisdropped;

  insert into fiscal_readiness_results values(
    'bill018_legacy_rpc_revoked',
    not has_function_privilege(
      'authenticated',
      'public.registrar_pagamento(uuid,text,text,numeric,date)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'authenticated',
      'public.realizar_pagamento_balcao(uuid,uuid,jsonb,text,numeric)',
      'EXECUTE'
    ),
    'legacy non-idempotent RPCs are not executable by authenticated'
  );

  select escola_id,id
    into v_school_id,v_payment_id
  from public.pagamentos
  order by created_at
  limit 1;

  if v_school_id is null or v_payment_id is null then
    insert into fiscal_readiness_results values(
      'bill018_negative_guards',false,'no pagamentos fixture'
    );
  else
    begin
      insert into public.pagamentos(
        escola_id,valor_pago,status,metodo,meta
      ) values (
        v_school_id,1.00,'pending','cash','{}'::jsonb
      );
      insert into fiscal_readiness_results values(
        'bill018_insert_without_key',false,'INSERT accepted'
      );
    exception when others then
      get stacked diagnostics v_err=message_text;
      insert into fiscal_readiness_results values(
        'bill018_insert_without_key',
        position('IDEMPOTENCY:' in v_err)>0,
        v_err
      );
    end;

    begin
      update public.pagamentos
      set idempotency_key='readiness:forbidden-reidentity'
      where id=v_payment_id;
      insert into fiscal_readiness_results values(
        'bill018_reidentity_existing_payment',false,'UPDATE accepted'
      );
    exception when others then
      get stacked diagnostics v_err=message_text;
      insert into fiscal_readiness_results values(
        'bill018_reidentity_existing_payment',
        position('IMMUTABILITY:' in v_err)>0,
        v_err
      );
    end;
  end if;
end
$readiness$;

do $readiness$
declare
  v_tax_engine text;
begin
  insert into fiscal_readiness_results values(
    'agt_tax_contribution_ceil_examples',
    public.fiscal_tax_ceil_cent(23.144::numeric)=23.15::numeric
      and public.fiscal_tax_ceil_cent(0.001844::numeric)=0.01::numeric
      and public.fiscal_tax_ceil_cent(5.9999999::numeric)=6.00::numeric,
    'official registarFactura examples: 23.144->23.15; 0.001844->0.01; 5.9999999->6.00'
  );

  select pg_get_functiondef(
    'public.fiscal_tax_compute_document(jsonb,date,text,text,numeric)'::regprocedure
  ) into v_tax_engine;

  insert into fiscal_readiness_results values(
    'agt_tax_engine_uses_ceil_cent',
    position('v_line_tax := public.fiscal_tax_ceil_cent' in v_tax_engine)>0,
    'taxContribution must round upward to the next cent'
  );

  insert into fiscal_readiness_results values(
    'agt_fx_rounds_to_two_decimals',
    position('v_gross_aoa := round(v_gross*v_exchange,2)' in v_tax_engine)>0,
    'foreign-currency countervalue uses mathematical rounding to 2 decimals'
  );
end
$readiness$;

select *
from fiscal_readiness_results
order by case_name;

do $assert$
begin
  if exists(select 1 from fiscal_readiness_results where not passed) then
    raise exception 'FISCAL_READINESS_DB_FAILED';
  end if;
end
$assert$;

rollback;
