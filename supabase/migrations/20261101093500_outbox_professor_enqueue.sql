create or replace function public.can_professor_school(p_escola_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.user_has_role_in_school(p_escola_id, array['professor']);
$$;

create or replace function public.enqueue_outbox_event_professor(
  p_escola_id uuid,
  p_event_type text,
  p_payload jsonb,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.user_has_role_in_school(
    p_escola_id,
    array['admin_escola','secretaria','admin','financeiro','professor','staff_admin']
  ) then
    raise exception 'sem permissão para escola %', p_escola_id;
  end if;

  insert into public.outbox_events (escola_id, event_type, dedupe_key, idempotency_key, payload)
  values (p_escola_id, p_event_type, p_idempotency_key, p_idempotency_key, p_payload)
  on conflict do nothing
  returning id into v_id;

  if v_id is null then
    select id
      into v_id
      from public.outbox_events
     where escola_id = p_escola_id
       and event_type = p_event_type
       and dedupe_key = p_idempotency_key
     limit 1;
  end if;

  return v_id;
end;
$$;
