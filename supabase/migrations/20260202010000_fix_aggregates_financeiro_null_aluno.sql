ALTER TABLE public.aggregates_financeiro
  DROP CONSTRAINT IF EXISTS aggregates_financeiro_pkey;

ALTER TABLE public.aggregates_financeiro
  ALTER COLUMN aluno_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_aggregates_financeiro_aluno
  ON public.aggregates_financeiro (escola_id, data_referencia, aluno_id)
  WHERE aluno_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_aggregates_financeiro_escola_mes
  ON public.aggregates_financeiro (escola_id, data_referencia)
  WHERE aluno_id IS NULL;

CREATE OR REPLACE FUNCTION public.recalc_escola_financeiro_totals(
  p_escola_id uuid,
  p_data_referencia date
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_pendente numeric(12,2);
  v_pago numeric(12,2);
  v_inadimplentes integer;
  v_em_dia integer;
  v_inadimplente_valor numeric(12,2);
BEGIN
  SELECT
    COALESCE(SUM(l.valor_total) FILTER (WHERE l.tipo = 'debito' AND l.status = 'pendente'), 0),
    COALESCE(SUM(l.valor_total) FILTER (WHERE l.tipo = 'debito' AND l.status = 'pago'), 0),
    COUNT(DISTINCT CASE WHEN l.tipo = 'debito' AND l.status = 'pendente' AND l.data_vencimento < CURRENT_DATE THEN l.aluno_id END),
    COUNT(DISTINCT CASE WHEN l.tipo = 'debito' AND l.status = 'pago' THEN l.aluno_id END),
    COALESCE(SUM(l.valor_total) FILTER (WHERE l.tipo = 'debito' AND l.status = 'pendente' AND l.data_vencimento < CURRENT_DATE), 0)
  INTO v_pendente, v_pago, v_inadimplentes, v_em_dia, v_inadimplente_valor
  FROM public.financeiro_lancamentos l
  WHERE l.escola_id = p_escola_id
    AND date_trunc('month', l.data_vencimento)::date = date_trunc('month', p_data_referencia)::date;

  INSERT INTO public.aggregates_financeiro (
    escola_id, data_referencia, aluno_id,
    total_pendente, total_pago, total_inadimplente,
    alunos_inadimplentes, alunos_em_dia,
    sync_status, sync_updated_at, updated_at
  )
  VALUES (
    p_escola_id, date_trunc('month', p_data_referencia)::date, NULL,
    v_pendente, v_pago, v_inadimplente_valor,
    v_inadimplentes, v_em_dia,
    'synced', now(), now()
  )
  ON CONFLICT (escola_id, data_referencia)
  WHERE aluno_id IS NULL
  DO UPDATE SET
    total_pendente = EXCLUDED.total_pendente,
    total_pago = EXCLUDED.total_pago,
    total_inadimplente = EXCLUDED.total_inadimplente,
    alunos_inadimplentes = EXCLUDED.alunos_inadimplentes,
    alunos_em_dia = EXCLUDED.alunos_em_dia,
    sync_status = 'synced',
    sync_updated_at = now(),
    updated_at = now();
END;
$$;
