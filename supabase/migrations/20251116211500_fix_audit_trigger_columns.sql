-- Corrige o trigger de auditoria para usar colunas em PT (acao, tabela)
-- e manter compatibilidade com o schema atual da tabela public.audit_logs

create or replace function public.audit_dml_trigger()
returns trigger
language plpgsql
as $$
declare
  v_escola_id uuid;
  v_entity_id text;
  v_details jsonb;
  v_portal text;
  v_acao text;      -- PT: acao do evento
  v_tabela text := tg_table_name; -- PT: nome lógico/tabela
begin
  v_acao := case tg_op when 'INSERT' then 'CREATE' when 'UPDATE' then 'UPDATE' when 'DELETE' then 'DELETE' end;
  v_portal := case tg_table_name when 'pagamentos' then 'financeiro' when 'matriculas' then 'secretaria' else 'outro' end;

  if tg_op in ('INSERT','UPDATE') then
    begin v_escola_id := (new).escola_id; exception when others then v_escola_id := null; end;
    begin v_entity_id := (new).id::text; exception when others then v_entity_id := null; end;
    v_details := jsonb_build_object('op', tg_op, 'new', to_jsonb(new));
  else
    begin v_escola_id := (old).escola_id; exception when others then v_escola_id := null; end;
    begin v_entity_id := (old).id::text; exception when others then v_entity_id := null; end;
    v_details := jsonb_build_object('op', tg_op, 'old', to_jsonb(old));
  end if;

  -- Se a linha não tiver escola_id, tentar resolver pelo tenant atual
  v_escola_id := coalesce(v_escola_id, public.current_tenant_escola_id());

  -- Observação: usamos as colunas 'acao' e 'tabela' do schema atual.
  -- Mantemos 'entity' preenchida também caso exista e seja usada noutros pontos.
  insert into public.audit_logs (
    escola_id,
    user_id,
    portal,
    acao,
    tabela,
    entity,
    entity_id,
    details
  ) values (
    v_escola_id,
    auth.uid(),
    v_portal,
    v_acao,
    v_tabela,
    v_tabela,
    v_entity_id,
    v_details
  );

  if tg_op = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$;

-- Garante que os gatilhos existam para as tabelas alvo
do $$
begin
  if to_regclass('public.matriculas') is not null and not exists (
    select 1 from pg_trigger where tgname = 'trg_audit_matriculas'
  ) then
    create trigger trg_audit_matriculas
    after insert or update or delete on public.matriculas
    for each row execute function public.audit_dml_trigger();
  end if;

  if to_regclass('public.pagamentos') is not null and not exists (
    select 1 from pg_trigger where tgname = 'trg_audit_pagamentos'
  ) then
    create trigger trg_audit_pagamentos
    after insert or update or delete on public.pagamentos
    for each row execute function public.audit_dml_trigger();
  end if;
end$$;

notify pgrst, 'reload schema';
