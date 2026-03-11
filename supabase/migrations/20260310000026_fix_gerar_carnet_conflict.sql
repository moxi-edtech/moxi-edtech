BEGIN;

CREATE OR REPLACE FUNCTION financeiro.gerar_carnet_anual(p_matricula_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    where ft.escola_id = v_matricula.escola_id
      and ft.ano_letivo = v_matricula.ano_letivo
      and ft.curso_id = v_turma.curso_id
      and ft.classe_id = v_turma.classe_id
    union all
    select
      ft.escola_id,
      ft.ano_letivo,
      ft.curso_id,
      ft.classe_id,
      ft.valor_mensalidade,
      ft.dia_vencimento,
      2 as prioridade
    from public.financeiro_tabelas ft
    where ft.escola_id = v_matricula.escola_id
      and ft.ano_letivo = v_matricula.ano_letivo
      and ft.curso_id = v_turma.curso_id
      and ft.classe_id is null
    union all
    select
      ft.escola_id,
      ft.ano_letivo,
      ft.curso_id,
      ft.classe_id,
      ft.valor_mensalidade,
      ft.dia_vencimento,
      3 as prioridade
    from public.financeiro_tabelas ft
    where ft.escola_id = v_matricula.escola_id
      and ft.ano_letivo = v_matricula.ano_letivo
      and ft.curso_id is null
      and ft.classe_id is null
  ),
  escolhida as (
    select valor_mensalidade, dia_vencimento
    from regras
    order by prioridade
    limit 1
  )
  select
    coalesce(valor_mensalidade, 0),
    coalesce(dia_vencimento, 10)
    into v_valor, v_dia_vencimento
  from escolhida;

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
    on conflict (escola_id, matricula_id, ano_referencia, mes_referencia) do nothing
    returning id
  )
  select count(*) into v_total from inseridos;

  return jsonb_build_object('ok', true, 'mensalidades', v_total);
end;
$$;

COMMIT;
