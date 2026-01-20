begin;

create or replace function public.admissao_convert_to_matricula(
  p_escola_id uuid,
  p_candidatura_id uuid,
  p_metadata jsonb default '{}'::jsonb
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
  v_to text := 'matriculado';
  v_matricula_id uuid;
begin
  if p_escola_id is null or p_escola_id <> v_tenant then
    raise exception 'Acesso negado: escola inválida.';
  end if;

  if not public.user_has_role_in_school(p_escola_id, array['secretaria','admin','admin_escola','staff_admin','financeiro']) then
    raise exception 'Acesso negado: permissões insuficientes.';
  end if;

  select status, matricula_id, escola_id into v_cand
  from public.candidaturas
  where id = p_candidatura_id and escola_id = v_tenant
  for update;

  if v_cand.status is null then
    raise exception 'Candidatura não encontrada.';
  end if;

  v_from := v_cand.status;

  if v_from = 'matriculado' then
    return v_cand.matricula_id;
  end if;

  if v_from not in ('aprovada', 'aguardando_pagamento') then
    raise exception 'Transição inválida: % -> matriculado (requer aprovada)', v_from;
  end if;

  if v_from = 'aguardando_pagamento'
    and not public.user_has_role_in_school(
      p_escola_id,
      array['financeiro','admin','admin_escola','staff_admin']
    ) then
    raise exception 'Aguardando validação financeira.';
  end if;

  v_matricula_id := public.confirmar_matricula_core(p_candidatura_id);

  if v_matricula_id is null then
    raise exception 'Falha ao gerar matrícula.';
  end if;

  perform set_config('app.rpc_internal', 'on', true);

  update public.candidaturas
  set
    status = v_to,
    matricula_id = v_matricula_id,
    matriculado_em = now(),
    updated_at = now()
  where id = p_candidatura_id;

  insert into public.candidaturas_status_log (
    escola_id, candidatura_id, from_status, to_status, metadata
  ) values (
    p_escola_id, p_candidatura_id, v_from, v_to,
    jsonb_build_object('matricula_id', v_matricula_id) || coalesce(p_metadata, '{}'::jsonb)
  );

  return v_matricula_id;
end;
$$;

notify pgrst, 'reload schema';

commit;
