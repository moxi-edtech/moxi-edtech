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
