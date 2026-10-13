-- Minimal disposable contract for public-school capability regressions.
-- Production is never touched by this harness.

CREATE TABLE IF NOT EXISTS public.school_operating_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  school_sector text NOT NULL DEFAULT 'private',
  finance_model text NOT NULL DEFAULT 'tuition',
  assessment_policy text NOT NULL DEFAULT 'custom',
  regulatory_profile text NOT NULL DEFAULT 'angola_private_default',
  document_profile text NOT NULL DEFAULT 'private_default',
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_until date,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.matriculas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL,
  aluno_id uuid NOT NULL,
  ano_letivo integer,
  turma_id uuid,
  status text,
  valor_pago_total numeric DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.mensalidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL,
  aluno_id uuid NOT NULL,
  matricula_id uuid,
  ano_referencia integer,
  mes_referencia integer,
  valor_previsto numeric DEFAULT 0,
  valor numeric DEFAULT 0,
  valor_pago_total numeric DEFAULT 0,
  status text DEFAULT 'pendente',
  data_vencimento date
);

CREATE TABLE IF NOT EXISTS public.pagamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid,
  aluno_id uuid,
  mensalidade_id uuid,
  valor_pago numeric DEFAULT 0,
  status text DEFAULT 'pendente',
  meta jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.servico_pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL,
  aluno_id uuid NOT NULL,
  matricula_id uuid,
  servico_codigo text,
  status text,
  contexto jsonb DEFAULT '{}'::jsonb
);

CREATE OR REPLACE FUNCTION public.rematricula_em_massa(
  p_escola_id uuid,
  p_origem_turma_id uuid,
  p_destino_turma_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_balance numeric := 0;
BEGIN
  IF v_balance > 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'saldo_devedor');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.finalizar_rematricula_balcao(
  p_escola_id uuid,
  p_aluno_id uuid,
  p_matricula_origem_id uuid,
  p_ano_letivo_id uuid,
  p_destino_turma_id uuid,
  p_pedido_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_decision text := 'transitou';
  v_decisao_origem text;
  v_origem record;
  v_destino record;
  v_criada boolean := false;
BEGIN
  SELECT 2026 AS ano_letivo INTO v_origem;
  SELECT gen_random_uuid() AS id INTO v_destino;
  v_decisao_origem := v_decision;

  UPDATE public.servico_pedidos
     SET status = 'granted', matricula_id = v_destino.id,
         contexto = coalesce(contexto, '{}'::jsonb) || jsonb_build_object(
           'matricula_destino_id', v_destino.id,
           'ano_letivo_id', p_ano_letivo_id,
           'destino_turma_id', p_destino_turma_id,
           'matricula_criada', v_criada,
           'decisao_academica', v_decisao_origem
         )
   WHERE id = p_pedido_id AND escola_id = p_escola_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido de rematrícula não encontrado'; END IF;

  RETURN jsonb_build_object('ok', true, 'matricula_id', v_destino.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.aluno_iniciar_rematricula(
  p_matricula_id uuid,
  p_servicos_ids uuid[] DEFAULT '{}'::uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_escola_id uuid := gen_random_uuid();
  v_mat record;
  v_aluno record;
  v_ano_destino integer := 2027;
  v_curso_destino_id uuid := gen_random_uuid();
  v_classe_destino_id uuid := gen_random_uuid();
  v_classe_destino_numero integer := 2;
  v_raa jsonb := '{"decision":"transitou","destino":"proxima_etapa"}'::jsonb;
  v_candidatura_id uuid;
  v_servico_rematricula record;
BEGIN
  SELECT p_matricula_id AS id, gen_random_uuid() AS aluno_id, 2026 AS ano_letivo INTO v_mat;
  SELECT 'Aluno teste'::text AS nome, NULL::text AS bi_numero, NULL::text AS telefone,
         NULL::text AS responsavel_nome, NULL::text AS responsavel_contato INTO v_aluno;

  IF EXISTS (
    SELECT 1
    FROM public.mensalidades men
    WHERE men.escola_id = v_escola_id
      AND men.aluno_id = v_mat.aluno_id
      AND (men.matricula_id = v_mat.id OR men.ano_referencia = v_mat.ano_letivo)
      AND greatest(
        coalesce(men.valor_previsto, men.valor, 0) - coalesce(men.valor_pago_total, 0),
        0
      ) > 0
      AND lower(coalesce(men.status, '')) NOT IN ('pago', 'isento', 'cancelado')
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'REMATRICULA_DEBT_REQUIRED',
      DETAIL = 'Existem saldos em aberto na matrícula de origem.';
  END IF;

  SELECT * INTO v_servico_rematricula
  FROM public.servico_pedidos
  LIMIT 1;

  RETURN jsonb_build_object('ok', true);
END;
$$;
