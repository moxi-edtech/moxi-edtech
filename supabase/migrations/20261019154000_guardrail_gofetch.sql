begin;

create or replace function public.get_outbox_status_summary()
returns table (
  status text,
  total bigint,
  oldest timestamptz,
  newest timestamptz
)
language sql
security definer
set search_path = public
as $$
  select status::text,
         count(*) as total,
         min(created_at) as oldest,
         max(created_at) as newest
    from public.outbox_events
   group by status
   order by total desc;
$$;

revoke all on function public.get_outbox_status_summary() from public;

commit;
