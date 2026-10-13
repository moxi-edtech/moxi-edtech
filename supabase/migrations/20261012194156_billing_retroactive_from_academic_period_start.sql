BEGIN;

-- Monthly tuition is retroactive to the start of the academic period.
-- Enrollment date no longer truncates the billing window.

CREATE OR REPLACE FUNCTION financeiro.gerar_carnet_anual(p_matricula_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_matricula record;
  v_turma record;
  v_data_inicio date;
  v_data_fim date;
  v_mes_final date;
  v_valor numeric;
  v_dia_vencimento integer;
  v_total integer := 0;
begin
  select
    m.id, m.escola_id, m.aluno_id, m.turma_id, m.ano_letivo, m.status,
    m.data_inicio_financeiro, m.data_matricula, m.created_at
  into v_matricula
  from public.matriculas m
  where m.id = p_matricula_id;

  if v_matricula.id is null then
    raise exception 'Matrícula não encontrada.';
  end if;

  select
    t.curso_id,
    t.classe_id,
    t.ano_letivo_id,
    public.is_turma_classe_exame(t.id) as is_classe_exame
  into v_turma
  from public.turmas t
  where t.id = v_matricula.turma_id;

  if v_turma.curso_id is null and v_turma.classe_id is null then
    raise exception 'Turma não encontrada para matrícula.';
  end if;

  select al.data_inicio, coalesce(j.data_fim, al.data_fim)
    into v_data_inicio, v_data_fim
  from public.anos_letivos al
  left join public.turma_janelas_cobranca j
    on j.ano_letivo_id = al.id
   and j.turma_id = v_matricula.turma_id
   and public.is_turma_classe_exame(v_matricula.turma_id)
  where al.id = v_turma.ano_letivo_id
    and al.escola_id = v_matricula.escola_id
  limit 1;

  if v_turma.ano_letivo_id is null or v_data_inicio is null or v_data_fim is null then
    raise exception 'Calendário académico não configurado para a turma do ano letivo %',
      v_matricula.ano_letivo;
  end if;

  if exists (
    select 1
    from public.anos_letivos al
    where al.id = v_turma.ano_letivo_id
      and al.ano is distinct from v_matricula.ano_letivo
  ) then
    raise exception 'Calendário académico da turma não corresponde ao ano letivo da matrícula (%)',
      v_matricula.ano_letivo;
  end if;

  -- A cobrança começa sempre no início do período letivo, mesmo para matrículas tardias.
  v_data_inicio := date_trunc('month', v_data_inicio)::date;
  v_mes_final := date_trunc('month', v_data_fim)::date;

  with regras as (
    select ft.valor_mensalidade, ft.dia_vencimento, 1 as prioridade
    from public.financeiro_tabelas ft
    where ft.escola_id = v_matricula.escola_id
      and ft.ano_letivo = v_matricula.ano_letivo
      and ft.curso_id = v_turma.curso_id
      and ft.classe_id = v_turma.classe_id
    union all
    select ft.valor_mensalidade, ft.dia_vencimento, 2
    from public.financeiro_tabelas ft
    where ft.escola_id = v_matricula.escola_id
      and ft.ano_letivo = v_matricula.ano_letivo
      and ft.curso_id = v_turma.curso_id
      and ft.classe_id is null
    union all
    select ft.valor_mensalidade, ft.dia_vencimento, 3
    from public.financeiro_tabelas ft
    where ft.escola_id = v_matricula.escola_id
      and ft.ano_letivo = v_matricula.ano_letivo
      and ft.curso_id is null
      and ft.classe_id is null
  ), escolhida as (
    select valor_mensalidade, dia_vencimento
    from regras
    order by prioridade
    limit 1
  )
  select coalesce(valor_mensalidade, 0), coalesce(dia_vencimento, 10)
    into v_valor, v_dia_vencimento
  from escolhida;

  with meses as (
    select
      extract(month from gs)::int as mes_referencia,
      extract(year from gs)::int as ano_referencia
    from generate_series(v_data_inicio, v_mes_final, interval '1 month') gs
    where v_turma.is_classe_exame or date_trunc('month', gs)::date < v_mes_final
  ), inseridos as (
    insert into public.mensalidades (
      escola_id, aluno_id, turma_id, ano_letivo,
      mes_referencia, ano_referencia,
      valor, valor_previsto, valor_pago_total,
      status, data_vencimento, matricula_id
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
    on conflict (escola_id, matricula_id, ano_referencia, mes_referencia) do nothing
    returning id
  )
  select count(*) into v_total from inseridos;

  return jsonb_build_object(
    'ok', true,
    'mensalidades', v_total,
    'mes_inicio_cobrado', v_data_inicio,
    'mes_final_cobrado', v_mes_final,
    'is_classe_exame', v_turma.is_classe_exame,
    'retroativo_ao_inicio_periodo', true
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_mensalidade_matricula_scope()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_matricula record;
  v_ano_letivo int;
  v_periodo_inicio date;
  v_periodo_fim date;
  v_inicio_cobranca date;
  v_competencia date;
begin
  if new.matricula_id is null and new.turma_id is null then
    return new;
  end if;

  if new.matricula_id is null then
    if new.ano_letivo is null or new.ano_letivo !~ '^[0-9]+$' then
      raise exception 'Mensalidade sem ano letivo não pode ser associada a uma matrícula';
    end if;

    select m.*
      into v_matricula
    from public.matriculas m
    where m.escola_id = new.escola_id
      and m.aluno_id = new.aluno_id
      and m.turma_id = new.turma_id
      and m.ano_letivo = new.ano_letivo::int
      and lower(coalesce(m.status, '')) in ('ativo', 'ativa', 'active')
    order by coalesce(m.data_inicio_financeiro, m.data_matricula, m.created_at::date) desc,
             m.created_at desc
    limit 1;

    if v_matricula.id is null then
      raise exception 'Mensalidade sem matrícula activa para o aluno %, turma % e ano %',
        new.aluno_id, new.turma_id, new.ano_letivo;
    end if;
    new.matricula_id := v_matricula.id;
  else
    select m.*
      into v_matricula
    from public.matriculas m
    where m.id = new.matricula_id;

    if v_matricula.id is null then
      raise exception 'Matrícula da mensalidade não encontrada: %', new.matricula_id;
    end if;
  end if;

  if v_matricula.escola_id <> new.escola_id
     or v_matricula.aluno_id <> new.aluno_id
     or (new.turma_id is not null and v_matricula.turma_id is distinct from new.turma_id) then
    raise exception 'Mensalidade não pertence à matrícula informada';
  end if;

  if lower(coalesce(v_matricula.status, '')) not in ('ativo', 'ativa', 'active') then
    raise exception 'Não é permitido lançar mensalidade para matrícula não activa (%)', v_matricula.status;
  end if;

  if new.ano_letivo is not null
     and (new.ano_letivo !~ '^[0-9]+$' or new.ano_letivo::int <> v_matricula.ano_letivo) then
    raise exception 'Ano letivo da mensalidade não corresponde à matrícula';
  end if;

  new.turma_id := coalesce(new.turma_id, v_matricula.turma_id);
  new.ano_letivo := v_matricula.ano_letivo::text;
  v_ano_letivo := v_matricula.ano_letivo;

  select al.data_inicio, al.data_fim
    into v_periodo_inicio, v_periodo_fim
  from public.anos_letivos al
  where al.escola_id = v_matricula.escola_id
    and al.ano = v_ano_letivo
  order by al.ativo desc, al.created_at desc
  limit 1;

  if new.mes_referencia is null
     or new.ano_referencia is null
     or new.mes_referencia not between 1 and 12 then
    raise exception 'Competência de mensalidade inválida';
  end if;

  v_competencia := make_date(new.ano_referencia, new.mes_referencia, 1);

  if v_periodo_inicio is not null and v_periodo_fim is not null
     and (
       v_competencia < date_trunc('month', v_periodo_inicio)::date
       or v_competencia > date_trunc('month', v_periodo_fim)::date
     ) then
    raise exception 'Competência %/% fora do calendário do ano letivo %',
      new.mes_referencia, new.ano_referencia, v_ano_letivo;
  end if;

  v_inicio_cobranca := date_trunc(
    'month',
    coalesce(v_periodo_inicio, make_date(v_ano_letivo, 1, 1))
  )::date;

  if v_competencia < v_inicio_cobranca then
    raise exception 'Mensalidade anterior ao início do período letivo (%)', v_inicio_cobranca;
  end if;

  new.aluno_id := v_matricula.aluno_id;
  new.escola_id := v_matricula.escola_id;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.gerar_mensalidades_nova_matricula()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_matricula record;
  v_ano_letivo_config record;
  v_tabela_preco record;
  v_valor_base numeric;
  v_valor_final numeric;
  v_desconto_kz numeric;
  v_dia_vencimento int;
  v_mes date;
  v_mes_final date;
  v_inserted_count int := 0;
  v_inserted_id uuid;
begin
  select
    m.id,
    m.aluno_id,
    m.turma_id,
    m.ano_letivo,
    m.escola_id,
    m.percentagem_desconto,
    t.curso_id,
    t.classe_id,
    public.is_turma_classe_exame(t.id) as is_classe_exame
  into v_matricula
  from public.matriculas m
  join public.turmas t on m.turma_id = t.id
  where m.id = new.id;

  select al.data_inicio, al.data_fim
    into v_ano_letivo_config
  from public.anos_letivos al
  where al.escola_id = v_matricula.escola_id
    and al.ano = v_matricula.ano_letivo;

  if v_ano_letivo_config is null then
    return new;
  end if;

  select valor_mensalidade, dia_vencimento
    into v_tabela_preco
  from public.financeiro_tabelas
  where escola_id = v_matricula.escola_id
    and ano_letivo = v_matricula.ano_letivo
    and curso_id = v_matricula.curso_id
    and classe_id = v_matricula.classe_id
  limit 1;

  if v_tabela_preco is null then
    select valor_mensalidade, dia_vencimento
      into v_tabela_preco
    from public.financeiro_tabelas
    where escola_id = v_matricula.escola_id
      and ano_letivo = v_matricula.ano_letivo
      and curso_id = v_matricula.curso_id
      and classe_id is null
    limit 1;
  end if;

  if v_tabela_preco is null then
    select valor_mensalidade, dia_vencimento
      into v_tabela_preco
    from public.financeiro_tabelas
    where escola_id = v_matricula.escola_id
      and ano_letivo = v_matricula.ano_letivo
      and curso_id is null
      and classe_id is null
    limit 1;
  end if;

  if v_tabela_preco is null then
    v_valor_base := 45000;
    v_dia_vencimento := 10;
  else
    v_valor_base := v_tabela_preco.valor_mensalidade;
    v_dia_vencimento := coalesce(v_tabela_preco.dia_vencimento, 10);
  end if;

  v_valor_final := v_valor_base * (1 - (coalesce(v_matricula.percentagem_desconto, 0) / 100));
  v_desconto_kz := v_valor_base - v_valor_final;
  v_mes_final := date_trunc('month', v_ano_letivo_config.data_fim)::date;

  for v_mes in
    select date_trunc('month', d)::date
    from generate_series(
      date_trunc('month', v_ano_letivo_config.data_inicio)::date,
      v_ano_letivo_config.data_fim,
      '1 month'::interval
    ) d
  loop
    if v_matricula.is_classe_exame or v_mes < v_mes_final then
      v_inserted_id := null;

      insert into public.mensalidades (
        aluno_id, matricula_id, escola_id,
        ano_letivo, mes_referencia, ano_referencia,
        valor, valor_previsto, valor_original, desconto_aplicado,
        data_vencimento, status
      ) values (
        new.aluno_id, new.id, v_matricula.escola_id,
        v_matricula.ano_letivo::text,
        extract(month from v_mes)::int,
        extract(year from v_mes)::int,
        v_valor_final, v_valor_final, v_valor_base, v_desconto_kz,
        make_date(
          extract(year from v_mes)::int,
          extract(month from v_mes)::int,
          least(greatest(v_dia_vencimento, 1), 28)
        ),
        'pendente'
      )
      on conflict (escola_id, matricula_id, ano_referencia, mes_referencia) do nothing
      returning id into v_inserted_id;

      if v_inserted_id is not null then
        v_inserted_count := v_inserted_count + 1;
      end if;
    end if;
  end loop;

  if v_inserted_count > 0 then
    insert into public.audit_logs (
      escola_id, actor_id, action, entity, entity_id, portal, details
    ) values (
      v_matricula.escola_id,
      auth.uid(),
      'MENSALIDADES_GERADAS',
      'matriculas',
      new.id::text,
      'system',
      jsonb_build_object(
        'mensalidades_criadas', v_inserted_count,
        'valor_base', v_valor_base,
        'valor_final', v_valor_final,
        'percentagem_desconto', v_matricula.percentagem_desconto,
        'is_classe_exame', v_matricula.is_classe_exame,
        'inicio_financeiro', v_ano_letivo_config.data_inicio,
        'retroativo_ao_inicio_periodo', true
      )
    );
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_matricula_financial_start()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_calendario_inicio date;
begin
  select al.data_inicio
    into v_calendario_inicio
  from public.turmas t
  join public.anos_letivos al
    on al.id = t.ano_letivo_id
   and al.escola_id = t.escola_id
  where t.id = new.turma_id
    and t.escola_id = new.escola_id
  limit 1;

  if v_calendario_inicio is not null then
    new.data_inicio_financeiro := date_trunc('month', v_calendario_inicio)::date;
  end if;

  return new;
end;
$function$;

COMMIT;
