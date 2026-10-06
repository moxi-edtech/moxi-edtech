set lock_timeout = '5s';

create or replace function public.set_updated_by()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'public', 'extensions'
as $$
begin
  new.updated_by := public.safe_auth_uid();
  return new;
end;
$$;

create or replace function public.audit_dml_trigger()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_escola_id uuid;
  v_entity_id text;
  v_portal text;
  v_action text;
  v_entity text := tg_table_name;
  v_before jsonb;
  v_after jsonb;
  ctx jsonb;
  v_actor_id uuid;
  v_user_id uuid;
  v_actor_role text;
begin
  v_action := case tg_op
    when 'INSERT' then 'CREATE'
    when 'UPDATE' then 'UPDATE'
    when 'DELETE' then 'DELETE'
  end;

  if tg_op = 'INSERT' then
    begin v_escola_id := (new).escola_id; exception when others then v_escola_id := null; end;
    begin v_entity_id := (new).id::text; exception when others then v_entity_id := null; end;
    v_before := null;
    v_after := public.audit_redact_jsonb(v_entity, to_jsonb(new));
  elsif tg_op = 'UPDATE' then
    begin v_escola_id := (new).escola_id; exception when others then v_escola_id := null; end;
    begin v_entity_id := (new).id::text; exception when others then v_entity_id := null; end;

    if (to_jsonb(old) - 'updated_at' - 'updated_by')
       is not distinct from
       (to_jsonb(new) - 'updated_at' - 'updated_by') then
      return new;
    end if;

    v_before := public.audit_redact_jsonb(v_entity, to_jsonb(old));
    v_after := public.audit_redact_jsonb(v_entity, to_jsonb(new));
  else
    begin v_escola_id := (old).escola_id; exception when others then v_escola_id := null; end;
    begin v_entity_id := (old).id::text; exception when others then v_entity_id := null; end;
    v_before := public.audit_redact_jsonb(v_entity, to_jsonb(old));
    v_after := null;
  end if;

  ctx := coalesce(public.audit_request_context(), '{}'::jsonb);
  v_actor_id := public.safe_auth_uid();

  if v_actor_id is not null and exists (
    select 1 from public.profiles p where p.user_id = v_actor_id
  ) then
    v_user_id := v_actor_id;
  else
    v_user_id := null;
  end if;

  v_portal := coalesce(
    nullif(ctx->>'portal', ''),
    case tg_table_name
      when 'pagamentos' then 'financeiro'
      when 'matriculas' then 'secretaria'
      else 'outro'
    end
  );

  v_actor_role := coalesce(
    nullif(ctx->>'actor_role', ''),
    case when v_actor_id is null then 'system' else 'authenticated' end
  );

  insert into public.audit_logs (
    escola_id, actor_id, actor_role, user_id, portal,
    action, entity, entity_id, details, before, after,
    ip, user_agent, acao, tabela, registro_id, meta
  ) values (
    v_escola_id, v_actor_id, v_actor_role, v_user_id, v_portal,
    v_action, v_entity, v_entity_id, jsonb_build_object('op', tg_op),
    v_before, v_after, ctx->>'ip', ctx->>'user_agent',
    v_action, v_entity, v_entity_id, jsonb_build_object('op', tg_op)
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

do $$
declare
  r record;
  v_has_audit boolean;
begin
  for r in
    select c.oid, c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and exists (
        select 1
        from information_schema.columns x
        where x.table_schema = 'public'
          and x.table_name = c.relname
          and x.column_name = 'updated_at'
      )
      and c.relname not like '\\_bk\\_%' escape '\\'
      and c.relname not like '%\\_archive' escape '\\'
      and c.relname not like '%\\_audit' escape '\\'
    order by c.relname
  loop
    execute format(
      'alter table public.%I add column if not exists updated_by uuid',
      r.table_name
    );

    execute format(
      'alter table public.%I alter column updated_by set default public.safe_auth_uid()',
      r.table_name
    );

    execute format(
      'comment on column public.%I.updated_by is %L',
      r.table_name,
      'Utilizador autenticado que realizou a última alteração. Preenchido automaticamente por safe_auth_uid(); NULL representa operação de sistema ou autoria histórica desconhecida.'
    );

    execute format(
      'drop trigger if exists trg_set_updated_by on public.%I',
      r.table_name
    );

    execute format(
      'create trigger trg_set_updated_by before insert or update on public.%I for each row execute function public.set_updated_by()',
      r.table_name
    );

    select exists (
      select 1
      from pg_trigger t
      where t.tgrelid = r.oid
        and not t.tgisinternal
        and pg_get_triggerdef(t.oid) ilike '%audit_dml_trigger%'
    ) into v_has_audit;

    if not v_has_audit then
      execute format(
        'create trigger trg_audit_dml_complete after insert or delete or update on public.%I for each row execute function public.audit_dml_trigger()',
        r.table_name
      );
    end if;
  end loop;
end
$$;
