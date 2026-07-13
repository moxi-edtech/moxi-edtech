BEGIN;

-- Classes de exame cobram o mes final do ano letivo. Por agora, a regra
-- inicial considera 6a e 9a classe, alem de turmas marcadas manualmente.
CREATE OR REPLACE FUNCTION public.is_turma_classe_exame(p_turma_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT coalesce(
    (
      coalesce(t.is_classe_exame, false)
      OR coalesce(t.classe_num, c.numero, 0) IN (6, 9)
      OR t.nome ILIKE '%6ª Classe%'
      OR t.nome ILIKE '%6a Classe%'
      OR t.nome ILIKE '%6 Classe%'
      OR t.nome ILIKE '%9ª Classe%'
      OR t.nome ILIKE '%9a Classe%'
      OR t.nome ILIKE '%9 Classe%'
      OR c.nome ILIKE '%6ª Classe%'
      OR c.nome ILIKE '%6a Classe%'
      OR c.nome ILIKE '%6 Classe%'
      OR c.nome ILIKE '%9ª Classe%'
      OR c.nome ILIKE '%9a Classe%'
      OR c.nome ILIKE '%9 Classe%'
    ),
    false
  )
  FROM public.turmas t
  LEFT JOIN public.classes c ON c.id = t.classe_id
  WHERE t.id = p_turma_id
$$;

CREATE OR REPLACE FUNCTION public.gerar_mensalidades_nova_matricula()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
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
BEGIN
  SELECT
    m.id,
    m.aluno_id,
    m.turma_id,
    m.ano_letivo,
    m.escola_id,
    m.percentagem_desconto,
    t.curso_id,
    t.classe_id,
    public.is_turma_classe_exame(t.id) AS is_classe_exame
  INTO v_matricula
  FROM public.matriculas m
  JOIN public.turmas t ON m.turma_id = t.id
  WHERE m.id = NEW.id;

  SELECT al.data_inicio, al.data_fim INTO v_ano_letivo_config
  FROM public.anos_letivos al
  WHERE al.escola_id = v_matricula.escola_id AND al.ano = v_matricula.ano_letivo;

  IF v_ano_letivo_config IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT valor_mensalidade, dia_vencimento INTO v_tabela_preco FROM public.financeiro_tabelas
  WHERE escola_id = v_matricula.escola_id AND ano_letivo = v_matricula.ano_letivo AND curso_id = v_matricula.curso_id AND classe_id = v_matricula.classe_id LIMIT 1;

  IF v_tabela_preco IS NULL THEN
    SELECT valor_mensalidade, dia_vencimento INTO v_tabela_preco FROM public.financeiro_tabelas
    WHERE escola_id = v_matricula.escola_id AND ano_letivo = v_matricula.ano_letivo AND curso_id = v_matricula.curso_id AND classe_id IS NULL LIMIT 1;
  END IF;

  IF v_tabela_preco IS NULL THEN
    SELECT valor_mensalidade, dia_vencimento INTO v_tabela_preco FROM public.financeiro_tabelas
    WHERE escola_id = v_matricula.escola_id AND ano_letivo = v_matricula.ano_letivo AND curso_id IS NULL AND classe_id IS NULL LIMIT 1;
  END IF;

  IF v_tabela_preco IS NULL THEN
    v_valor_base := 45000;
    v_dia_vencimento := 10;
  ELSE
    v_valor_base := v_tabela_preco.valor_mensalidade;
    v_dia_vencimento := coalesce(v_tabela_preco.dia_vencimento, 10);
  END IF;

  v_valor_final := v_valor_base * (1 - (coalesce(v_matricula.percentagem_desconto, 0) / 100));
  v_desconto_kz := v_valor_base - v_valor_final;
  v_mes_final := date_trunc('month', v_ano_letivo_config.data_fim)::date;

  FOR v_mes IN
    SELECT date_trunc('month', d)::date
    FROM generate_series(v_ano_letivo_config.data_inicio, v_ano_letivo_config.data_fim, '1 month'::interval) d
  LOOP
    IF v_mes >= date_trunc('month', NEW.created_at)
       AND (v_matricula.is_classe_exame OR v_mes < v_mes_final) THEN
      v_inserted_id := NULL;
      INSERT INTO public.mensalidades (
        aluno_id, matricula_id, escola_id,
        ano_letivo, mes_referencia, ano_referencia,
        valor, valor_previsto, valor_original, desconto_aplicado,
        data_vencimento, status
      ) VALUES (
        NEW.aluno_id, NEW.id, v_matricula.escola_id,
        v_matricula.ano_letivo::text, extract(month from v_mes)::int, extract(year from v_mes)::int,
        v_valor_final, v_valor_final, v_valor_base, v_desconto_kz,
        make_date(extract(year from v_mes)::int, extract(month from v_mes)::int, least(greatest(v_dia_vencimento, 1), 28)),
        'pendente'
      )
      ON CONFLICT (escola_id, matricula_id, ano_referencia, mes_referencia) DO NOTHING
      RETURNING id INTO v_inserted_id;

      IF v_inserted_id IS NOT NULL THEN
        v_inserted_count := v_inserted_count + 1;
      END IF;
    END IF;
  END LOOP;

  IF v_inserted_count > 0 THEN
    INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details)
    VALUES (
      v_matricula.escola_id, auth.uid(), 'MENSALIDADES_GERADAS', 'matriculas', NEW.id::text, 'system',
      jsonb_build_object(
        'mensalidades_criadas', v_inserted_count,
        'valor_base', v_valor_base,
        'valor_final', v_valor_final,
        'percentagem_desconto', v_matricula.percentagem_desconto,
        'is_classe_exame', v_matricula.is_classe_exame,
        'mes_final_cobrado', v_matricula.is_classe_exame
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

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
  v_mes_final date;
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

  select
    t.curso_id,
    t.classe_id,
    public.is_turma_classe_exame(t.id) AS is_classe_exame
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

  v_mes_final := date_trunc('month', v_data_fim)::date;

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
    select ft.escola_id, ft.ano_letivo, ft.curso_id, ft.classe_id, ft.valor_mensalidade, ft.dia_vencimento, 2
    from public.financeiro_tabelas ft
    where ft.escola_id = v_matricula.escola_id
      and ft.ano_letivo = v_matricula.ano_letivo
      and ft.curso_id = v_turma.curso_id
      and ft.classe_id is null
    union all
    select ft.escola_id, ft.ano_letivo, ft.curso_id, ft.classe_id, ft.valor_mensalidade, ft.dia_vencimento, 3
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
  select coalesce(valor_mensalidade, 0), coalesce(dia_vencimento, 10)
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
    where v_turma.is_classe_exame OR date_trunc('month', gs)::date < v_mes_final
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

  return jsonb_build_object(
    'ok', true,
    'mensalidades', v_total,
    'is_classe_exame', v_turma.is_classe_exame,
    'mes_final_cobrado', v_turma.is_classe_exame
  );
end;
$$;

CREATE OR REPLACE FUNCTION public.gerar_mensalidades_lote(
  p_escola_id uuid,
  p_ano_letivo integer,
  p_mes_referencia integer,
  p_dia_vencimento_default integer DEFAULT 10,
  p_turma_id uuid DEFAULT NULL::uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_data_vencimento date;
  v_mes smallint;
  v_ano int;
  v_inseridas int := 0;
  v_periodo_inicio date;
  v_periodo_fim date;
  v_mes_final date;
  v_competencia date;
BEGIN
  v_mes := LEAST(GREATEST(p_mes_referencia, 1), 12);

  SELECT al.data_inicio, al.data_fim
    INTO v_periodo_inicio, v_periodo_fim
  FROM public.anos_letivos al
  WHERE al.escola_id = p_escola_id
    AND al.ano = p_ano_letivo
  ORDER BY al.ativo DESC, al.created_at DESC
  LIMIT 1;

  v_ano := p_ano_letivo;
  IF v_periodo_inicio IS NOT NULL
     AND v_periodo_fim IS NOT NULL
     AND EXTRACT(YEAR FROM v_periodo_inicio) <> EXTRACT(YEAR FROM v_periodo_fim) THEN
    v_ano := CASE
      WHEN v_mes >= EXTRACT(MONTH FROM v_periodo_inicio)::int
        THEN EXTRACT(YEAR FROM v_periodo_inicio)::int
      ELSE EXTRACT(YEAR FROM v_periodo_fim)::int
    END;
  END IF;

  v_mes_final := date_trunc('month', v_periodo_fim)::date;
  v_competencia := make_date(v_ano, v_mes, 1);

  v_data_vencimento := make_date(
    v_ano,
    v_mes,
    LEAST(GREATEST(coalesce(p_dia_vencimento_default, 10), 1), 28)
  );

  WITH regras AS (
    SELECT
      ft.id AS tabela_id,
      ft.escola_id,
      ft.ano_letivo,
      ft.curso_id,
      ft.classe_id,
      ft.valor_mensalidade,
      ft.dia_vencimento,
      1 AS prioridade
    FROM public.financeiro_tabelas ft
    UNION ALL
    SELECT id, escola_id, ano_letivo, curso_id, NULL, valor_mensalidade, dia_vencimento, 2
    FROM public.financeiro_tabelas
    WHERE classe_id IS NULL
    UNION ALL
    SELECT id, escola_id, ano_letivo, NULL, classe_id, valor_mensalidade, dia_vencimento, 3
    FROM public.financeiro_tabelas
    WHERE curso_id IS NULL
    UNION ALL
    SELECT id, escola_id, ano_letivo, NULL, NULL, valor_mensalidade, dia_vencimento, 4
    FROM public.financeiro_tabelas
  ),
  precos AS (
    SELECT
      m.id AS matricula_id,
      m.aluno_id,
      m.turma_id,
      t.curso_id,
      t.classe_id,
      public.is_turma_classe_exame(t.id) AS is_classe_exame,
      coalesce(
        (SELECT tabela_id FROM regras r
         WHERE r.escola_id = p_escola_id
           AND r.ano_letivo = p_ano_letivo
           AND r.curso_id = t.curso_id
           AND r.classe_id = t.classe_id
         ORDER BY prioridade LIMIT 1),
        (SELECT tabela_id FROM regras r
         WHERE r.escola_id = p_escola_id
           AND r.ano_letivo = p_ano_letivo
           AND r.curso_id = t.curso_id
           AND r.classe_id IS NULL
         ORDER BY prioridade LIMIT 1),
        (SELECT tabela_id FROM regras r
         WHERE r.escola_id = p_escola_id
           AND r.ano_letivo = p_ano_letivo
           AND r.curso_id IS NULL
           AND r.classe_id = t.classe_id
         ORDER BY prioridade LIMIT 1),
        (SELECT tabela_id FROM regras r
         WHERE r.escola_id = p_escola_id
           AND r.ano_letivo = p_ano_letivo
           AND r.curso_id IS NULL
           AND r.classe_id IS NULL
         ORDER BY prioridade LIMIT 1)
      ) AS tabela_id,
      coalesce(
        (SELECT valor_mensalidade FROM regras r
         WHERE r.escola_id = p_escola_id
           AND r.ano_letivo = p_ano_letivo
           AND r.curso_id = t.curso_id
           AND r.classe_id = t.classe_id
         ORDER BY prioridade LIMIT 1),
        (SELECT valor_mensalidade FROM regras r
         WHERE r.escola_id = p_escola_id
           AND r.ano_letivo = p_ano_letivo
           AND r.curso_id = t.curso_id
           AND r.classe_id IS NULL
         ORDER BY prioridade LIMIT 1),
        (SELECT valor_mensalidade FROM regras r
         WHERE r.escola_id = p_escola_id
           AND r.ano_letivo = p_ano_letivo
           AND r.curso_id IS NULL
           AND r.classe_id = t.classe_id
         ORDER BY prioridade LIMIT 1),
        (SELECT valor_mensalidade FROM regras r
         WHERE r.escola_id = p_escola_id
           AND r.ano_letivo = p_ano_letivo
           AND r.curso_id IS NULL
           AND r.classe_id IS NULL
         ORDER BY prioridade LIMIT 1),
        0
      ) AS valor_mensalidade,
      coalesce(
        (SELECT dia_vencimento FROM regras r
         WHERE r.escola_id = p_escola_id
           AND r.ano_letivo = p_ano_letivo
           AND r.curso_id = t.curso_id
           AND r.classe_id = t.classe_id
         ORDER BY prioridade LIMIT 1),
        (SELECT dia_vencimento FROM regras r
         WHERE r.escola_id = p_escola_id
           AND r.ano_letivo = p_ano_letivo
           AND r.curso_id = t.curso_id
           AND r.classe_id IS NULL
         ORDER BY prioridade LIMIT 1),
        (SELECT dia_vencimento FROM regras r
         WHERE r.escola_id = p_escola_id
           AND r.ano_letivo = p_ano_letivo
           AND r.curso_id IS NULL
           AND r.classe_id = t.classe_id
         ORDER BY prioridade LIMIT 1),
        (SELECT dia_vencimento FROM regras r
         WHERE r.escola_id = p_escola_id
           AND r.ano_letivo = p_ano_letivo
           AND r.curso_id IS NULL
           AND r.classe_id IS NULL
         ORDER BY prioridade LIMIT 1),
        p_dia_vencimento_default
      ) AS dia_vencimento_resolvido
    FROM public.matriculas m
    JOIN public.turmas t ON t.id = m.turma_id
    WHERE m.escola_id = p_escola_id
      AND m.ano_letivo::text = p_ano_letivo::text
      AND m.status IN ('ativo', 'ativa')
      AND (p_turma_id IS NULL OR m.turma_id = p_turma_id)
      AND (
        v_periodo_fim IS NULL
        OR v_competencia < v_mes_final
        OR public.is_turma_classe_exame(t.id)
      )
  ),
  inseridos AS (
    INSERT INTO public.mensalidades (
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
      tabela_id
    )
    SELECT
      p_escola_id,
      p.aluno_id,
      p.turma_id,
      p_ano_letivo::text,
      v_mes,
      v_ano,
      p.valor_mensalidade,
      p.valor_mensalidade,
      0,
      'pendente',
      make_date(v_ano, v_mes, LEAST(GREATEST(coalesce(p.dia_vencimento_resolvido, p_dia_vencimento_default), 1), 28)),
      p.tabela_id
    FROM precos p
    WHERE NOT EXISTS (
      SELECT 1 FROM public.mensalidades m2
      WHERE m2.escola_id = p_escola_id
        AND m2.aluno_id = p.aluno_id
        AND m2.ano_referencia = v_ano
        AND m2.mes_referencia = v_mes
    )
    RETURNING 1
  )
  SELECT count(*) INTO v_inseridas FROM inseridos;

  RETURN jsonb_build_object(
    'ok', true,
    'geradas', coalesce(v_inseridas, 0),
    'ano', v_ano,
    'mes', v_mes,
    'vencimento', v_data_vencimento,
    'mes_final', v_mes_final
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'erro', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_mensalidade_classe_exame_mes_final()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_turma_id uuid;
  v_ano_letivo int;
  v_data_fim date;
  v_mes_final date;
  v_competencia date;
  v_is_classe_exame boolean;
BEGIN
  IF NEW.escola_id IS NULL
     OR NEW.mes_referencia IS NULL
     OR NEW.ano_referencia IS NULL
     OR NEW.mes_referencia NOT BETWEEN 1 AND 12 THEN
    RETURN NEW;
  END IF;

  v_turma_id := NEW.turma_id;

  IF NEW.ano_letivo IS NOT NULL AND NEW.ano_letivo ~ '^[0-9]+$' THEN
    v_ano_letivo := NEW.ano_letivo::int;
  END IF;

  IF (v_turma_id IS NULL OR v_ano_letivo IS NULL) AND NEW.matricula_id IS NOT NULL THEN
    SELECT
      coalesce(v_turma_id, m.turma_id),
      coalesce(v_ano_letivo, m.ano_letivo)
      INTO v_turma_id, v_ano_letivo
    FROM public.matriculas m
    WHERE m.id = NEW.matricula_id;
  END IF;

  IF v_turma_id IS NULL OR v_ano_letivo IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT al.data_fim
    INTO v_data_fim
  FROM public.anos_letivos al
  WHERE al.escola_id = NEW.escola_id
    AND al.ano = v_ano_letivo
  ORDER BY al.ativo DESC, al.created_at DESC
  LIMIT 1;

  IF v_data_fim IS NULL THEN
    RETURN NEW;
  END IF;

  v_mes_final := date_trunc('month', v_data_fim)::date;
  v_competencia := make_date(NEW.ano_referencia, NEW.mes_referencia, 1);

  IF v_competencia <> v_mes_final THEN
    RETURN NEW;
  END IF;

  SELECT public.is_turma_classe_exame(v_turma_id)
    INTO v_is_classe_exame;

  IF NOT coalesce(v_is_classe_exame, false) THEN
    NEW.status := 'isento';
    NEW.valor := 0;
    NEW.valor_previsto := 0;
    NEW.valor_pago_total := 0;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_mensalidade_classe_exame_mes_final ON public.mensalidades;

CREATE TRIGGER trg_enforce_mensalidade_classe_exame_mes_final
BEFORE INSERT OR UPDATE OF
  escola_id,
  turma_id,
  matricula_id,
  ano_letivo,
  mes_referencia,
  ano_referencia,
  valor,
  valor_previsto,
  valor_pago_total,
  status
ON public.mensalidades
FOR EACH ROW
EXECUTE FUNCTION public.enforce_mensalidade_classe_exame_mes_final();

COMMIT;
