begin;

create or replace function public.lock_curriculo_install(
  p_escola_id uuid,
  p_preset_key text,
  p_ano_letivo_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_escola_id uuid := public.current_tenant_escola_id();
begin
  if v_escola_id is null then
    raise exception 'tenant not resolved';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      v_escola_id::text || ':' || coalesce(p_preset_key, '') || ':' || coalesce(p_ano_letivo_id::text, ''),
      0
    )
  );
end;
$$;

grant execute on function public.lock_curriculo_install(uuid, text, uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
