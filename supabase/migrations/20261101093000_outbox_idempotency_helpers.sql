create or replace function public.mark_outbox_event_processed(
  p_event_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_escola_id uuid;
begin
  select escola_id into v_escola_id
  from public.outbox_events
  where id = p_event_id;

  if v_escola_id is null then
    return;
  end if;

  if not public.user_has_role_in_school(
    v_escola_id,
    array['admin_escola','secretaria','admin','financeiro','professor','staff_admin']
  ) then
    raise exception 'sem permissão para escola %', v_escola_id;
  end if;

  update public.outbox_events
     set status = 'sent',
         processed_at = now(),
         last_error = null
   where id = p_event_id;
end;
$$;

create or replace function public.mark_outbox_event_failed(
  p_event_id uuid,
  p_error text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_escola_id uuid;
begin
  select escola_id into v_escola_id
  from public.outbox_events
  where id = p_event_id;

  if v_escola_id is null then
    return;
  end if;

  if not public.user_has_role_in_school(
    v_escola_id,
    array['admin_escola','secretaria','admin','financeiro','professor','staff_admin']
  ) then
    raise exception 'sem permissão para escola %', v_escola_id;
  end if;

  update public.outbox_events
     set status = 'failed',
         last_error = p_error,
         next_attempt_at = now(),
         locked_at = null,
         locked_by = null
   where id = p_event_id;
end;
$$;
