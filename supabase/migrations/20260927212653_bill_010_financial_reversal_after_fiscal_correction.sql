create or replace function public.financeiro_guard_fiscalized_payment_reversal()
returns trigger
language plpgsql
set search_path to 'pg_catalog','public'
as $function$
declare
  v_doc public.fiscal_documentos%rowtype;
  v_original_agt_accepted boolean := false;
  v_effective_credit numeric(18,4) := 0;
begin
  if OLD.status in ('settled','concluido','pago')
     and NEW.status in ('voided','estornado','cancelado')
     and OLD.fiscal_documento_id is not null then

    select *
    into v_doc
    from public.fiscal_documentos
    where id=OLD.fiscal_documento_id;

    if not found then
      raise exception
        'STATE: pagamento referencia documento fiscal inexistente';
    end if;

    if v_doc.status='anulado' then
      return NEW;
    end if;

    if v_doc.tipo_documento='FR' and v_doc.status='rectificado' then
      select exists (
        select 1
        from public.fiscal_agt_submission_documentos sd
        join public.fiscal_agt_submissions s on s.id=sd.submission_id
        where sd.documento_id=v_doc.id
          and sd.validation_status='valid'
          and s.status='accepted'
      )
      into v_original_agt_accepted;

      select coalesce(sum(nc.total_liquido_aoa),0)
      into v_effective_credit
      from public.fiscal_documentos nc
      where nc.empresa_id=v_doc.empresa_id
        and nc.tipo_documento='NC'
        and nc.rectifica_documento_id=v_doc.id
        and nc.status in ('emitido','rectificado')
        and not exists (
          select 1
          from public.fiscal_agt_submission_documentos sd
          join public.fiscal_agt_submissions s on s.id=sd.submission_id
          where sd.documento_id=nc.id
            and sd.validation_status='invalid'
            and s.status='rejected'
        )
        and (
          not v_original_agt_accepted
          or exists (
            select 1
            from public.fiscal_agt_submission_documentos sd
            join public.fiscal_agt_submissions s on s.id=sd.submission_id
            where sd.documento_id=nc.id
              and sd.validation_status='valid'
              and s.status='accepted'
          )
        );

      if round(v_effective_credit,2) >= round(v_doc.total_liquido_aoa,2) then
        return NEW;
      end if;

      raise exception
        'STATE: FR rectificada ainda não possui NC efectiva integral para reversão financeira';
    end if;

    if v_doc.tipo_documento='RC' then
      raise exception
        'STATE: RC fiscalizado exige anulação ou RE fiscal homologado antes da reversão financeira';
    end if;

    raise exception
      'STATE: pagamento fiscalizado exige anulação/correcção fiscal integral antes da reversão financeira';
  end if;

  return NEW;
end;
$function$;
