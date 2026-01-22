-- KLASSE — Admissão: Arquivamento/Desistência (Radar cleanup)

begin;

create or replace function public.admissao_archive(
  p_escola_id uuid,
  p_candidatura_id uuid,
  p_motivo text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.current_tenant_escola_id();
  v_cand record;
  v_from text;
  v_to text := 'arquivado';
begin
  if p_escola_id is null or p_escola_id <> v_tenant then
    raise exception 'Acesso negado: escola inválida.';
  end if;

  if not public.user_has_role_in_school(p_escola_id, array['secretaria','admin','admin_escola','staff_admin']) then
    raise exception 'Acesso negado: permissões insuficientes.';
  end if;

  select status, escola_id into v_cand
  from public.candidaturas
  where id = p_candidatura_id and escola_id = v_tenant
  for update;

  if v_cand.status is null then
    raise exception 'Candidatura não encontrada.';
  end if;

  v_from := v_cand.status;

  if v_from = v_to then
    return p_candidatura_id;
  end if;

  if v_from not in ('submetida','em_analise','aprovada','aguardando_pagamento','aguardando_compensacao') then
    raise exception 'Transição inválida: % -> %', v_from, v_to;
  end if;

  perform set_config('app.rpc_internal', 'on', true);

  update public.candidaturas
  set status = v_to, updated_at = now()
  where id = p_candidatura_id;

  insert into public.candidaturas_status_log (
    escola_id, candidatura_id, from_status, to_status, motivo
  ) values (
    p_escola_id, p_candidatura_id, v_from, v_to, nullif(trim(p_motivo), '')
  );

  return p_candidatura_id;
end;
$$;

revoke all on function public.admissao_archive(uuid, uuid, text) from public;
grant execute on function public.admissao_archive(uuid, uuid, text) to authenticated;

commit;
