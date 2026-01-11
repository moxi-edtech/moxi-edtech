begin;

-- Drop existing indexes
drop index if exists idx_outbox_events_status_run;
drop index if exists idx_outbox_events_topic_status;
drop index if exists ux_outbox_events_idempotency;

-- Create outbox_status enum type
do $$
begin
  if not exists (select 1 from pg_type where typname = 'outbox_status') then
    create type public.outbox_status as enum ('pending', 'processing', 'sent', 'failed', 'dead');
  end if;
end$$;

-- Add new columns and change existing ones
alter table public.outbox_events
  add column if not exists tenant_scope text null,
  add column if not exists locked_at timestamptz null,
  add column if not exists locked_by text null;

-- Rename existing columns
alter table public.outbox_events rename column topic to event_type;
alter table public.outbox_events rename column request_id to dedupe_key;
alter table public.outbox_events rename column next_run_at to next_attempt_at;

-- Alter status column to use new enum type
-- First, add a temporary new column to store converted enum values
alter table public.outbox_events add column status_new public.outbox_status;

-- Convert existing text statuses to enum values
update public.outbox_events set status_new =
  case status
    when 'pending' then 'pending'::public.outbox_status
    when 'running' then 'processing'::public.outbox_status
    when 'completed' then 'sent'::public.outbox_status
    when 'failed' then 'failed'::public.outbox_status
    when 'dead' then 'dead'::public.outbox_status
    else 'pending'::public.outbox_status -- Default or handle other cases
  end;

-- Drop existing text status column
alter table public.outbox_events drop column status;

-- Rename new enum status column to status
alter table public.outbox_events rename column status_new to status;

-- Ensure not null constraint and default value
alter table public.outbox_events alter column status set not null;
alter table public.outbox_events alter column status set default 'pending'::public.outbox_status;


-- Recreate indexes with new column names and types
create index if not exists ix_outbox_ready
on public.outbox_events (status, next_attempt_at)
where status in ('pending','failed');

create index if not exists ix_outbox_processing
on public.outbox_events (status, locked_at)
where status = 'processing';

create unique index if not exists ux_outbox_dedupe
on public.outbox_events (coalesce(escola_id, '00000000-0000-0000-0000-000000000000'::uuid), event_type, dedupe_key)
where dedupe_key is not null and status <> 'dead';

-- RLS: ensure policy is correct
drop policy if exists "deny all" on public.outbox_events;
create policy "deny all" on public.outbox_events for all using (false);

commit;
