begin;

create or replace function public.admissao_approve(
  p_escola_id uuid,
  p_candidatura_id uuid,
  p_observacao text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.current_tenant_escola_id();
  v_cand record;
  v_turma record;
  v_classe record;
  v_target_status text;
  v_has_pagamento boolean := false;
begin
  if p_escola_id is null or p_escola_id <> v_tenant then
    raise exception 'Acesso negado: escola inválida';
  end if;

  if not public.user_has_role_in_school(p_escola_id, array['secretaria','admin','admin_escola','staff_admin']) then
    raise exception 'Acesso negado: permissões insuficientes';
  end if;

  select *
  into v_cand
  from public.candidaturas
  where id = p_candidatura_id
    and escola_id = v_tenant
  for update;

  if v_cand.status is null then
    raise exception 'Candidatura não encontrada ou acesso negado';
  end if;

  if v_cand.status in ('aprovada','aguardando_pagamento') then
    return p_candidatura_id;
  end if;

  if v_cand.status not in ('submetida', 'em_analise', 'pendente') then
    raise exception 'Transição inválida: status atual = %', v_cand.status;
  end if;

  if v_cand.curso_id is null or v_cand.ano_letivo is null then
    raise exception 'Candidatura incompleta para aprovação';
  end if;

  if v_cand.classe_id is not null then
    select cl.escola_id, cl.curso_id into v_classe
    from public.classes cl
    where cl.id = v_cand.classe_id;

    if v_classe.escola_id <> v_tenant then
      raise exception 'Classe inválida para esta escola';
    end if;

    if v_classe.curso_id is not null and v_classe.curso_id <> v_cand.curso_id then
      raise exception 'Incoerência: Classe não pertence ao curso selecionado';
    end if;
  end if;

  if v_cand.turma_preferencial_id is not null then
    select t.escola_id, t.curso_id, t.classe_id, t.ano_letivo into v_turma
    from public.turmas t
    where t.id = v_cand.turma_preferencial_id;

    if v_turma.escola_id <> v_tenant then
      raise exception 'Turma preferencial inválida para esta escola';
    end if;

    if v_turma.curso_id <> v_cand.curso_id then
      raise exception 'Incoerência: Turma preferencial pertence a outro curso';
    end if;

    if v_cand.classe_id is not null and v_turma.classe_id <> v_cand.classe_id then
      raise exception 'Incoerência: Turma preferencial pertence a outra classe';
    end if;

    if v_turma.ano_letivo <> v_cand.ano_letivo then
      raise exception 'Incoerência: Turma preferencial pertence a outro ano letivo';
    end if;
  end if;

  v_has_pagamento :=
    nullif(trim(coalesce(v_cand.dados_candidato->'pagamento'->>'metodo', '')), '') is not null
    or nullif(trim(coalesce(v_cand.dados_candidato->'pagamento'->>'comprovativo_url', '')), '') is not null
    or nullif(trim(coalesce(v_cand.dados_candidato->'pagamento'->>'referencia', '')), '') is not null
    or nullif(trim(coalesce(v_cand.dados_candidato->'pagamento'->>'amount', '')), '') is not null;

  v_target_status := case when v_has_pagamento then 'aguardando_pagamento' else 'aprovada' end;

  insert into public.candidaturas_status_log (
    escola_id,
    candidatura_id,
    from_status,
    to_status,
    motivo
  ) values (
    p_escola_id,
    p_candidatura_id,
    v_cand.status,
    v_target_status,
    p_observacao
  );

  update public.candidaturas
  set
    status = v_target_status,
    dados_candidato = coalesce(dados_candidato, '{}'::jsonb) ||
      jsonb_build_object(
        'aprovacao_obs', p_observacao,
        'aprovada_at', now()
      ),
    updated_at = now()
  where id = p_candidatura_id;

  return p_candidatura_id;
end;
$$;

notify pgrst, 'reload schema';

commit;
