BEGIN;

CREATE TABLE IF NOT EXISTS public.turma_janelas_cobranca (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  turma_id uuid NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  ano_letivo_id uuid NOT NULL REFERENCES public.anos_letivos(id) ON DELETE CASCADE,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  motivo text NOT NULL DEFAULT 'exame',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT public.safe_auth_uid(),
  updated_by uuid DEFAULT public.safe_auth_uid(),
  CONSTRAINT turma_janela_cobranca_datas_ck CHECK (data_fim >= data_inicio),
  CONSTRAINT turma_janela_cobranca_unq UNIQUE (escola_id, turma_id, ano_letivo_id)
);

CREATE INDEX IF NOT EXISTS idx_turma_janelas_cobranca_lookup
  ON public.turma_janelas_cobranca (escola_id, turma_id, ano_letivo_id);

ALTER TABLE public.turma_janelas_cobranca ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS turma_janelas_cobranca_select_tenant ON public.turma_janelas_cobranca;
CREATE POLICY turma_janelas_cobranca_select_tenant
  ON public.turma_janelas_cobranca FOR SELECT TO authenticated
  USING (escola_id = public.current_tenant_escola_id() OR public.is_super_admin());

DROP POLICY IF EXISTS turma_janelas_cobranca_write_staff ON public.turma_janelas_cobranca;
CREATE POLICY turma_janelas_cobranca_write_staff
  ON public.turma_janelas_cobranca FOR ALL TO authenticated
  USING (
    escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(
      escola_id,
      ARRAY['admin','admin_escola','staff_admin','secretaria','diretor','financeiro']::text[]
    )
  )
  WITH CHECK (
    escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(
      escola_id,
      ARRAY['admin','admin_escola','staff_admin','secretaria','diretor','financeiro']::text[]
    )
  );

COMMENT ON TABLE public.turma_janelas_cobranca IS
  'Janela financeira explícita para turmas de exame; sem registro, usa-se o fim do ano letivo.';

CREATE OR REPLACE FUNCTION public.turma_janela_fim_cobranca(
  p_turma_id uuid,
  p_ano_letivo_id uuid,
  p_fim_padrao date
)
RETURNS date
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN public.is_turma_classe_exame(p_turma_id)
      THEN coalesce(j.data_fim, p_fim_padrao)
    ELSE p_fim_padrao
  END
  FROM (SELECT 1) AS ignored
  LEFT JOIN public.turma_janelas_cobranca j
    ON j.turma_id = p_turma_id
   AND j.ano_letivo_id = p_ano_letivo_id
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
  v_ano_letivo_id uuid;
  v_data_inicio date;
  v_data_fim date;
  v_mes_final date;
  v_mes_inicio date;
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
    SELECT coalesce(v_turma_id, m.turma_id), coalesce(v_ano_letivo, m.ano_letivo)
      INTO v_turma_id, v_ano_letivo
    FROM public.matriculas m
    WHERE m.id = NEW.matricula_id;
  END IF;

  IF v_turma_id IS NULL OR v_ano_letivo IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT al.id, al.data_inicio, al.data_fim
    INTO v_ano_letivo_id, v_data_inicio, v_data_fim
  FROM public.anos_letivos al
  WHERE al.escola_id = NEW.escola_id
    AND al.ano = v_ano_letivo
  ORDER BY al.ativo DESC, al.created_at DESC
  LIMIT 1;

  IF v_data_inicio IS NULL OR v_data_fim IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT public.is_turma_classe_exame(v_turma_id)
    INTO v_is_classe_exame;

  SELECT coalesce(j.data_inicio, v_data_inicio), coalesce(j.data_fim, v_data_fim)
    INTO v_data_inicio, v_data_fim
  FROM (SELECT 1) AS ignored
  LEFT JOIN public.turma_janelas_cobranca j
    ON j.turma_id = v_turma_id
   AND j.ano_letivo_id = v_ano_letivo_id
   AND coalesce(v_is_classe_exame, false);

  v_mes_inicio := date_trunc('month', v_data_inicio)::date;
  v_mes_final := date_trunc('month', v_data_fim)::date;
  v_competencia := make_date(NEW.ano_referencia, NEW.mes_referencia, 1);

  IF v_competencia < v_mes_inicio OR v_competencia > v_mes_final THEN
    NEW.status := 'isento';
    NEW.valor := 0;
    NEW.valor_previsto := 0;
    NEW.valor_pago_total := 0;
    RETURN NEW;
  END IF;

  IF v_competencia = v_mes_final AND NOT coalesce(v_is_classe_exame, false) THEN
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
  escola_id, turma_id, matricula_id, ano_letivo, mes_referencia,
  ano_referencia, valor, valor_previsto, valor_pago_total, status
ON public.mensalidades
FOR EACH ROW
EXECUTE FUNCTION public.enforce_mensalidade_classe_exame_mes_final();

-- O carnê de uma matrícula nova também precisa alcançar a janela customizada.
CREATE OR REPLACE FUNCTION financeiro.gerar_carnet_anual(p_matricula_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_matricula record;
  v_turma record;
  v_data_inicio date;
  v_data_fim date;
  v_inicio_financeiro date;
  v_mes_final date;
  v_valor numeric;
  v_dia_vencimento integer;
  v_total integer := 0;
BEGIN
  SELECT m.id, m.escola_id, m.aluno_id, m.turma_id, m.ano_letivo, m.status,
         m.data_inicio_financeiro, m.data_matricula, m.created_at
    INTO v_matricula
  FROM public.matriculas m
  WHERE m.id = p_matricula_id;

  IF v_matricula.id IS NULL THEN
    RAISE EXCEPTION 'Matrícula não encontrada.';
  END IF;

  SELECT t.curso_id, t.classe_id, t.ano_letivo_id,
         public.is_turma_classe_exame(t.id) AS is_classe_exame
    INTO v_turma
  FROM public.turmas t
  WHERE t.id = v_matricula.turma_id;

  IF v_turma.curso_id IS NULL AND v_turma.classe_id IS NULL THEN
    RAISE EXCEPTION 'Turma não encontrada para matrícula.';
  END IF;

  SELECT al.data_inicio, coalesce(j.data_fim, al.data_fim)
    INTO v_data_inicio, v_data_fim
  FROM public.anos_letivos al
  LEFT JOIN public.turma_janelas_cobranca j
    ON j.ano_letivo_id = al.id
   AND j.turma_id = v_matricula.turma_id
   AND public.is_turma_classe_exame(v_matricula.turma_id)
  WHERE al.id = v_turma.ano_letivo_id
    AND al.escola_id = v_matricula.escola_id
  LIMIT 1;

  IF v_turma.ano_letivo_id IS NULL OR v_data_inicio IS NULL OR v_data_fim IS NULL THEN
    RAISE EXCEPTION 'Calendário académico não configurado para a turma do ano letivo %', v_matricula.ano_letivo;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.anos_letivos al
    WHERE al.id = v_turma.ano_letivo_id
      AND al.ano IS DISTINCT FROM v_matricula.ano_letivo
  ) THEN
    RAISE EXCEPTION 'Calendário académico da turma não corresponde ao ano letivo da matrícula (%)', v_matricula.ano_letivo;
  END IF;

  v_inicio_financeiro := coalesce(
    v_matricula.data_inicio_financeiro,
    date_trunc('month', coalesce(v_matricula.data_matricula, v_matricula.created_at::date, v_data_inicio) - interval '1 month')::date,
    v_data_inicio
  );
  v_data_inicio := greatest(v_data_inicio, v_inicio_financeiro);
  IF v_data_inicio > v_data_fim THEN
    RAISE EXCEPTION 'Data de início financeiro (%) está depois do fim da janela da turma (%)', v_inicio_financeiro, v_data_fim;
  END IF;
  v_mes_final := date_trunc('month', v_data_fim)::date;

  WITH regras AS (
    SELECT ft.valor_mensalidade, ft.dia_vencimento, 1 AS prioridade
    FROM public.financeiro_tabelas ft
    WHERE ft.escola_id = v_matricula.escola_id AND ft.ano_letivo = v_matricula.ano_letivo
      AND ft.curso_id = v_turma.curso_id AND ft.classe_id = v_turma.classe_id
    UNION ALL
    SELECT ft.valor_mensalidade, ft.dia_vencimento, 2
    FROM public.financeiro_tabelas ft
    WHERE ft.escola_id = v_matricula.escola_id AND ft.ano_letivo = v_matricula.ano_letivo
      AND ft.curso_id = v_turma.curso_id AND ft.classe_id IS NULL
    UNION ALL
    SELECT ft.valor_mensalidade, ft.dia_vencimento, 3
    FROM public.financeiro_tabelas ft
    WHERE ft.escola_id = v_matricula.escola_id AND ft.ano_letivo = v_matricula.ano_letivo
      AND ft.curso_id IS NULL AND ft.classe_id IS NULL
  ), escolhida AS (
    SELECT valor_mensalidade, dia_vencimento FROM regras ORDER BY prioridade LIMIT 1
  )
  SELECT coalesce(valor_mensalidade, 0), coalesce(dia_vencimento, 10)
    INTO v_valor, v_dia_vencimento
  FROM escolhida;

  WITH meses AS (
    SELECT extract(month FROM gs)::int AS mes_referencia,
           extract(year FROM gs)::int AS ano_referencia
    FROM generate_series(date_trunc('month', v_data_inicio)::date, v_mes_final, interval '1 month') gs
    WHERE v_turma.is_classe_exame OR date_trunc('month', gs)::date < v_mes_final
  ), inseridos AS (
    INSERT INTO public.mensalidades (
      escola_id, aluno_id, turma_id, ano_letivo, mes_referencia, ano_referencia,
      valor, valor_previsto, valor_pago_total, status, data_vencimento, matricula_id
    )
    SELECT v_matricula.escola_id, v_matricula.aluno_id, v_matricula.turma_id,
           v_matricula.ano_letivo::text, m.mes_referencia, m.ano_referencia,
           v_valor, v_valor, 0, 'pendente',
           make_date(m.ano_referencia, m.mes_referencia, least(greatest(coalesce(v_dia_vencimento, 10), 1), 28)),
           v_matricula.id
    FROM meses m
    ON CONFLICT (escola_id, matricula_id, ano_referencia, mes_referencia) DO NOTHING
    RETURNING id
  )
  SELECT count(*) INTO v_total FROM inseridos;

  RETURN jsonb_build_object(
    'ok', true,
    'mensalidades', v_total,
    'mes_inicio_cobrado', date_trunc('month', v_data_inicio)::date,
    'mes_final_cobrado', v_mes_final,
    'is_classe_exame', v_turma.is_classe_exame
  );
END;
$$;

COMMIT;
