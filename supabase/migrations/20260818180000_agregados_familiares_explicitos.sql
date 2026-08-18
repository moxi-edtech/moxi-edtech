-- Agrupamento familiar explícito. O telefone deixa de ser a chave automática.
CREATE TABLE IF NOT EXISTS public.financeiro_agregados_familiares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  telefone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.financeiro_agregados_membros (
  agregado_id uuid NOT NULL REFERENCES public.financeiro_agregados_familiares(id) ON DELETE CASCADE,
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (agregado_id, aluno_id),
  UNIQUE (aluno_id)
);

ALTER TABLE public.financeiro_agregados_familiares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_agregados_membros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS financeiro_agregados_school_access ON public.financeiro_agregados_familiares;
CREATE POLICY financeiro_agregados_school_access ON public.financeiro_agregados_familiares
  FOR ALL TO authenticated USING (EXISTS (
    SELECT 1 FROM public.escola_users eu
    WHERE eu.escola_id = financeiro_agregados_familiares.escola_id AND eu.user_id = auth.uid()
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM public.escola_users eu
    WHERE eu.escola_id = financeiro_agregados_familiares.escola_id AND eu.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS financeiro_agregados_membros_school_access ON public.financeiro_agregados_membros;
CREATE POLICY financeiro_agregados_membros_school_access ON public.financeiro_agregados_membros
  FOR ALL TO authenticated USING (EXISTS (
    SELECT 1 FROM public.financeiro_agregados_familiares af
    JOIN public.escola_users eu ON eu.escola_id = af.escola_id
    WHERE af.id = financeiro_agregados_membros.agregado_id AND eu.user_id = auth.uid()
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM public.financeiro_agregados_familiares af
    JOIN public.escola_users eu ON eu.escola_id = af.escola_id
    WHERE af.id = financeiro_agregados_membros.agregado_id AND eu.user_id = auth.uid()
  ));

CREATE OR REPLACE FUNCTION public.aplicar_desconto_familiar_interno(
  p_escola_id uuid, p_ano_letivo_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_matricula record;
  v_total integer;
  v_percent numeric;
  v_aplicados integer := 0;
  v_mensalidades integer := 0;
  v_changed integer;
BEGIN
  FOR v_matricula IN
    SELECT m.id, m.aluno_id, af.id AS agregado_id,
           COALESCE(m.motivo_desconto, '') AS motivo_desconto
    FROM public.matriculas m
    JOIN public.financeiro_agregados_membros am ON am.aluno_id = m.aluno_id
    JOIN public.financeiro_agregados_familiares af
      ON af.id = am.agregado_id AND af.escola_id = m.escola_id
    WHERE m.escola_id = p_escola_id
      AND m.session_id = p_ano_letivo_id
      AND m.status IN ('ativa', 'ativo', 'active', 'matriculado')
  LOOP
    SELECT COUNT(DISTINCT m2.aluno_id)::integer INTO v_total
    FROM public.matriculas m2
    JOIN public.financeiro_agregados_membros am2 ON am2.aluno_id = m2.aluno_id
    WHERE am2.agregado_id = v_matricula.agregado_id
      AND m2.escola_id = p_escola_id
      AND m2.session_id = p_ano_letivo_id
      AND m2.status IN ('ativa', 'ativo', 'active', 'matriculado');

    SELECT p.percentagem INTO v_percent
    FROM public.financeiro_politicas_desconto_familiar p
    WHERE p.escola_id = p_escola_id AND p.ano_letivo_id = p_ano_letivo_id
      AND p.ativo AND p.minimo_filhos <= v_total
    ORDER BY p.minimo_filhos DESC LIMIT 1;
    v_percent := COALESCE(v_percent, 0);

    IF v_matricula.motivo_desconto <> ''
       AND v_matricula.motivo_desconto NOT LIKE 'Desconto familiar automático%' THEN
      CONTINUE;
    END IF;

    UPDATE public.matriculas SET
      percentagem_desconto = v_percent,
      motivo_desconto = CASE WHEN v_percent > 0
        THEN format('Desconto familiar automático · %s filhos', v_total) ELSE NULL END,
      updated_at = now()
    WHERE id = v_matricula.id AND escola_id = p_escola_id;

    UPDATE public.mensalidades SET
      valor_original = COALESCE(valor_original, valor),
      desconto_aplicado = ROUND(COALESCE(valor_original, valor) * v_percent / 100, 2),
      valor = ROUND(COALESCE(valor_original, valor) * (1 - v_percent / 100), 2),
      valor_previsto = ROUND(COALESCE(valor_original, valor) * (1 - v_percent / 100), 2),
      observacoes = CASE WHEN v_percent > 0
        THEN format('Desconto familiar automático: %s%% (%s filhos)', v_percent, v_total)
        ELSE NULL END,
      updated_at = now()
    WHERE matricula_id = v_matricula.id AND escola_id = p_escola_id
      AND status = 'pendente' AND COALESCE(valor_pago_total, 0) = 0;
    GET DIAGNOSTICS v_changed = ROW_COUNT;
    v_mensalidades := v_mensalidades + v_changed;
    v_aplicados := v_aplicados + 1;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'matriculas_aplicadas', v_aplicados, 'mensalidades_atualizadas', v_mensalidades);
END;
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_agregados_familiares TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.financeiro_agregados_membros TO authenticated;
