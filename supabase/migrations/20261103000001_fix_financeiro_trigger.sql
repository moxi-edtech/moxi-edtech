begin;

create schema if not exists financeiro;

create or replace function financeiro.gerar_carnet_anual(p_matricula_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_matricula record;
  v_turma record;
  v_data_inicio date;
  v_data_fim date;
  v_valor numeric;
  v_dia_vencimento integer;
  v_total integer := 0;
begin
  select m.id, m.escola_id, m.aluno_id, m.turma_id, m.ano_letivo, m.status
    into v_matricula
  from public.matriculas m
  where m.id = p_matricula_id;

  if v_matricula.id is null then
    raise exception 'Matrícula não encontrada.';
  end if;

  select t.curso_id, t.classe_id
    into v_turma
  from public.turmas t
  where t.id = v_matricula.turma_id;

  if v_turma.curso_id is null and v_turma.classe_id is null then
    raise exception 'Turma não encontrada para matrícula.';
  end if;

  select al.data_inicio, al.data_fim
    into v_data_inicio, v_data_fim
  from public.anos_letivos al
  where al.escola_id = v_matricula.escola_id
    and al.ano = v_matricula.ano_letivo
  limit 1;

  if v_data_inicio is null or v_data_fim is null then
    v_data_inicio := make_date(v_matricula.ano_letivo, 1, 1);
    v_data_fim := make_date(v_matricula.ano_letivo, 12, 31);
  end if;

  with regras as (
    select
      ft.escola_id,
      ft.ano_letivo,
      ft.curso_id,
      ft.classe_id,
      ft.valor_mensalidade,
      ft.dia_vencimento,
      1 as prioridade
    from public.financeiro_tabelas ft
    union all
    select escola_id, ano_letivo, curso_id, null, valor_mensalidade, dia_vencimento, 2
    from public.financeiro_tabelas
    where classe_id is null
    union all
    select escola_id, ano_letivo, null, classe_id, valor_mensalidade, dia_vencimento, 3
    from public.financeiro_tabelas
    where curso_id is null
    union all
    select escola_id, ano_letivo, null, null, valor_mensalidade, dia_vencimento, 4
    from public.financeiro_tabelas
  )
  select
    coalesce(
      (select valor_mensalidade from regras r
       where r.escola_id = v_matricula.escola_id
         and r.ano_letivo = v_matricula.ano_letivo
         and r.curso_id = v_turma.curso_id
         and r.classe_id = v_turma.classe_id
       order by prioridade limit 1),
      (select valor_mensalidade from regras r
       where r.escola_id = v_matricula.escola_id
         and r.ano_letivo = v_matricula.ano_letivo
         and r.curso_id = v_turma.curso_id
         and r.classe_id is null
       order by prioridade limit 1),
      (select valor_mensalidade from regras r
       where r.escola_id = v_matricula.escola_id
         and r.ano_letivo = v_matricula.ano_letivo
         and r.curso_id is null
         and r.classe_id = v_turma.classe_id
       order by prioridade limit 1),
      (select valor_mensalidade from regras r
       where r.escola_id = v_matricula.escola_id
         and r.ano_letivo = v_matricula.ano_letivo
         and r.curso_id is null
         and r.classe_id is null
       order by prioridade limit 1),
      0
    ),
    coalesce(
      (select dia_vencimento from regras r
       where r.escola_id = v_matricula.escola_id
         and r.ano_letivo = v_matricula.ano_letivo
         and r.curso_id = v_turma.curso_id
         and r.classe_id = v_turma.classe_id
       order by prioridade limit 1),
      (select dia_vencimento from regras r
       where r.escola_id = v_matricula.escola_id
         and r.ano_letivo = v_matricula.ano_letivo
         and r.curso_id = v_turma.curso_id
         and r.classe_id is null
       order by prioridade limit 1),
      (select dia_vencimento from regras r
       where r.escola_id = v_matricula.escola_id
         and r.ano_letivo = v_matricula.ano_letivo
         and r.curso_id is null
         and r.classe_id = v_turma.classe_id
       order by prioridade limit 1),
      (select dia_vencimento from regras r
       where r.escola_id = v_matricula.escola_id
         and r.ano_letivo = v_matricula.ano_letivo
         and r.curso_id is null
         and r.classe_id is null
       order by prioridade limit 1),
      10
    )
    into v_valor, v_dia_vencimento;

  with meses as (
    select
      extract(month from gs)::int as mes_referencia,
      extract(year from gs)::int as ano_referencia
    from generate_series(
      date_trunc('month', v_data_inicio)::date,
      date_trunc('month', v_data_fim)::date,
      interval '1 month'
    ) gs
  ),
  inseridos as (
    insert into public.mensalidades (
      escola_id,
      aluno_id,
      turma_id,
      ano_letivo,
      mes_referencia,
      ano_referencia,
      valor,
      valor_previsto,
      valor_pago_total,
      status,
      data_vencimento,
      matricula_id
    )
    select
      v_matricula.escola_id,
      v_matricula.aluno_id,
      v_matricula.turma_id,
      v_matricula.ano_letivo::text,
      m.mes_referencia,
      m.ano_referencia,
      v_valor,
      v_valor,
      0,
      'pendente',
      make_date(
        m.ano_referencia,
        m.mes_referencia,
        least(greatest(coalesce(v_dia_vencimento, 10), 1), 28)
      ),
      v_matricula.id
    from meses m
    on conflict (escola_id, aluno_id, ano_referencia, mes_referencia) do nothing
    returning id
  )
  select count(*) into v_total from inseridos;

  return jsonb_build_object('ok', true, 'mensalidades', v_total);
end;
$$;

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

  perform financeiro.gerar_carnet_anual(v_matricula_id);

  return v_matricula_id;
end;
$$;

notify pgrst, 'reload schema';

commit;
