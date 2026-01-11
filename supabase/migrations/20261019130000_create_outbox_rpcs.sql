begin;

-- Drop existing outbox RPCs
drop function if exists public.enqueue_outbox_event(uuid, text, text, text, jsonb);
drop function if exists public.claim_outbox_events(int);
drop function if exists public.retry_outbox_event(uuid, text, int);
drop function if exists public.outbox_requeue_stuck();
drop function if exists public.process_outbox_events(int);

-- Claim em lote com lock pessimista (SKIP LOCKED)
create or replace function public.outbox_claim(batch_size int default 25, worker_id text default null)
returns setof public.outbox_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_worker text := coalesce(worker_id, 'worker');
begin
  return query
  with cte as (
    select id
    from public.outbox_events
    where status in ('pending','failed')
      and next_attempt_at <= now()
      and attempt_count < max_attempts
    order by next_attempt_at asc, created_at asc
    for update skip locked
    limit greatest(1, least(batch_size, 50))
  )
  update public.outbox_events e
    set status = 'processing',
        locked_at = now(),
        locked_by = v_worker
  from cte
  where e.id = cte.id
  returning e.*;
end;
$$;

-- Report resultado: sent / failed / dead + calcula backoff
create or replace function public.outbox_report_result(
  p_id uuid,
  p_ok boolean,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt int;
  v_max int;
  v_backoff interval;
begin
  select attempt_count, max_attempts into v_attempt, v_max
  from public.outbox_events
  where id = p_id
  for update;

  if not found then
    return;
  end if;

  if p_ok then
    update public.outbox_events
      set status = 'sent',
          last_error = null,
          locked_at = null,
          locked_by = null
    where id = p_id;
    return;
  end if;

  -- falhou
  v_attempt := v_attempt + 1;

  -- backoff exponencial com teto (ex: 5m, 15m, 1h, 6h...)
  v_backoff :=
    case
      when v_attempt <= 1 then interval '2 minutes'
      when v_attempt = 2 then interval '5 minutes'
      when v_attempt = 3 then interval '15 minutes'
      when v_attempt = 4 then interval '1 hour'
      when v_attempt = 5 then interval '3 hours'
      else interval '6 hours'
    end;

  if v_attempt >= v_max then
    update public.outbox_events
      set status = 'dead',
          attempt_count = v_attempt,
          last_error = left(coalesce(p_error,'unknown error'), 2000),
          locked_at = null,
          locked_by = null
    where id = p_id;
  else
    update public.outbox_events
      set status = 'failed',
          attempt_count = v_attempt,
          next_attempt_at = now() + v_backoff,
          last_error = left(coalesce(p_error,'unknown error'), 2000),
          locked_at = null,
          locked_by = null
    where id = p_id;
  end if;
end;
$$;

revoke all on function public.outbox_claim(int,text) from public;
revoke all on function public.outbox_report_result(uuid,boolean,text) from public;

commit;
