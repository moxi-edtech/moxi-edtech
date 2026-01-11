begin;

create or replace function public.get_recent_cron_runs(p_limit int default 30)
returns table (
  jobid bigint,
  status text,
  start_time timestamptz,
  end_time timestamptz,
  return_message text
)
language sql
security definer
set search_path = public
as $$
  select jobid, status, start_time, end_time, return_message
  from cron.job_run_details
  order by start_time desc
  limit greatest(1, least(p_limit, 100));
$$;

revoke all on function public.get_recent_cron_runs(int) from public;

commit;
