-- apps/web/supabase/migrations/20250917_audit_triggers.sql
-- Gatilhos de auditoria para matriculas e pagamentos

create or replace function public.audit_dml_trigger()
returns trigger
language plpgsql
as $$
declare
  v_escola_id uuid;
  v_entity_id text;
  v_details jsonb;
  v_portal text;
  v_action text;
  v_entity text := tg_table_name;
begin
  v_action := case tg_op when 'INSERT' then 'CREATE' when 'UPDATE' then 'UPDATE' when 'DELETE' then 'DELETE' end;
  v_portal := case tg_table_name when 'pagamentos' then 'financeiro' when 'matriculas' then 'secretaria' else 'outro' end;

  if tg_op in ('INSERT','UPDATE') then
    -- assumes column escola_id exists
    begin v_escola_id := (new).escola_id; exception when others then v_escola_id := null; end;
    begin v_entity_id := (new).id::text; exception when others then v_entity_id := null; end;
    v_details := jsonb_build_object('op', tg_op, 'new', to_jsonb(new));
  else
    begin v_escola_id := (old).escola_id; exception when others then v_escola_id := null; end;
    begin v_entity_id := (old).id::text; exception when others then v_entity_id := null; end;
    v_details := jsonb_build_object('op', tg_op, 'old', to_jsonb(old));
  end if;

  insert into public.audit_logs (escola_id, user_id, portal, action, entity, entity_id, details)
  values (v_escola_id, auth.uid(), v_portal, v_action, v_entity, v_entity_id, v_details);

  if tg_op = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$;

-- Cria triggers apenas se as tabelas existirem e os triggers ainda não existirem
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

