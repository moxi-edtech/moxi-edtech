-- Política de desconto para irmãos da mesma instituição.
ALTER TABLE public.matriculas
  ADD COLUMN IF NOT EXISTS percentagem_desconto numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS motivo_desconto text;

ALTER TABLE public.mensalidades
  ADD COLUMN IF NOT EXISTS desconto_aplicado numeric(12,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.financeiro_politicas_desconto_familiar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  ano_letivo_id uuid NOT NULL REFERENCES public.anos_letivos(id) ON DELETE CASCADE,
  minimo_filhos integer NOT NULL CHECK (minimo_filhos >= 2),
  percentagem numeric(5,2) NOT NULL CHECK (percentagem >= 0 AND percentagem <= 100),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (escola_id, ano_letivo_id, minimo_filhos)
);

CREATE INDEX IF NOT EXISTS idx_financeiro_politica_familiar_scope
  ON public.financeiro_politicas_desconto_familiar (escola_id, ano_letivo_id, ativo, minimo_filhos DESC);

ALTER TABLE public.financeiro_politicas_desconto_familiar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS financeiro_politica_familiar_school_access
  ON public.financeiro_politicas_desconto_familiar;
CREATE POLICY financeiro_politica_familiar_school_access
  ON public.financeiro_politicas_desconto_familiar
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.escola_users eu
    WHERE eu.escola_id = financeiro_politicas_desconto_familiar.escola_id
      AND eu.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.escola_users eu
    WHERE eu.escola_id = financeiro_politicas_desconto_familiar.escola_id
      AND eu.user_id = auth.uid()
  ));

CREATE OR REPLACE FUNCTION public.aplicar_desconto_familiar_interno(
  p_escola_id uuid,
  p_ano_letivo_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_matricula record;
  v_familia record;
  v_percent numeric := 0;
  v_desconto numeric := 0;
  v_aplicados integer := 0;
  v_mensalidades integer := 0;
BEGIN
  FOR v_matricula IN
    SELECT m.id, m.aluno_id, m.escola_id, m.session_id,
           COALESCE(m.percentagem_desconto, 0) AS percentagem_desconto,
           COALESCE(m.motivo_desconto, '') AS motivo_desconto,
           NULLIF(regexp_replace(COALESCE(a.encarregado_telefone, a.responsavel_contato, a.telefone_responsavel, ''), '[^0-9]', '', 'g'), '') AS familia_chave
    FROM public.matriculas m
    JOIN public.alunos a ON a.id = m.aluno_id AND a.escola_id = m.escola_id
    WHERE m.escola_id = p_escola_id
      AND m.session_id = p_ano_letivo_id
      AND m.status IN ('ativa', 'ativo', 'active', 'matriculado')
  LOOP
    IF v_matricula.familia_chave IS NULL THEN
      CONTINUE;
    END IF;

    SELECT COUNT(DISTINCT m2.aluno_id)::integer AS total
    INTO v_familia
    FROM public.matriculas m2
    JOIN public.alunos a2 ON a2.id = m2.aluno_id AND a2.escola_id = m2.escola_id
    WHERE m2.escola_id = p_escola_id
      AND m2.session_id = p_ano_letivo_id
      AND m2.status IN ('ativa', 'ativo', 'active', 'matriculado')
      AND NULLIF(regexp_replace(COALESCE(a2.encarregado_telefone, a2.responsavel_contato, a2.telefone_responsavel, ''), '[^0-9]', '', 'g'), '') = v_matricula.familia_chave;

    SELECT p.percentagem INTO v_percent
    FROM public.financeiro_politicas_desconto_familiar p
    WHERE p.escola_id = p_escola_id
      AND p.ano_letivo_id = p_ano_letivo_id
      AND p.ativo
      AND p.minimo_filhos <= v_familia.total
    ORDER BY p.minimo_filhos DESC
    LIMIT 1;
    v_percent := COALESCE(v_percent, 0);

    -- Desconto manual nunca é substituído pela política familiar.
    IF v_matricula.motivo_desconto <> ''
       AND v_matricula.motivo_desconto NOT LIKE 'Desconto familiar automático%'
    THEN
      CONTINUE;
    END IF;

    UPDATE public.matriculas
    SET percentagem_desconto = v_percent,
        motivo_desconto = CASE WHEN v_percent > 0
          THEN format('Desconto familiar automático · %s filhos', v_familia.total)
          ELSE NULL END,
        updated_at = now()
    WHERE id = v_matricula.id
      AND escola_id = p_escola_id;

    UPDATE public.mensalidades
    SET valor_original = COALESCE(valor_original, valor),
        desconto_aplicado = ROUND(COALESCE(valor_original, valor) * v_percent / 100, 2),
        valor = ROUND(COALESCE(valor_original, valor) * (1 - v_percent / 100), 2),
        valor_previsto = ROUND(COALESCE(valor_original, valor) * (1 - v_percent / 100), 2),
        observacoes = CASE WHEN v_percent > 0
          THEN format('Desconto familiar automático: %s%% (%s filhos)', v_percent, v_familia.total)
          ELSE NULL END,
        updated_at = now()
    WHERE matricula_id = v_matricula.id
      AND escola_id = p_escola_id
      AND status = 'pendente'
      AND COALESCE(valor_pago_total, 0) = 0;

    GET DIAGNOSTICS v_mensalidades = ROW_COUNT;
    v_aplicados := v_aplicados + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'matriculas_aplicadas', v_aplicados, 'mensalidades_atualizadas', v_mensalidades);
END;
$$;

CREATE OR REPLACE FUNCTION public.aplicar_desconto_familiar(
  p_escola_id uuid,
  p_ano_letivo_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.escola_users eu
    WHERE eu.escola_id = p_escola_id
      AND eu.user_id = auth.uid()
      AND eu.papel IN ('admin_escola', 'secretaria', 'admin', 'staff_admin', 'financeiro', 'admin_financeiro')
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  RETURN public.aplicar_desconto_familiar_interno(p_escola_id, p_ano_letivo_id);
END;
$$;

REVOKE ALL ON FUNCTION public.aplicar_desconto_familiar(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.aplicar_desconto_familiar(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.trg_aplicar_desconto_familiar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.session_id IS NOT NULL AND pg_trigger_depth() = 1 THEN
    PERFORM public.aplicar_desconto_familiar_interno(NEW.escola_id, NEW.session_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_matriculas_desconto_familiar ON public.matriculas;
CREATE TRIGGER trg_matriculas_desconto_familiar
AFTER INSERT OR UPDATE OF aluno_id, session_id ON public.matriculas
FOR EACH ROW EXECUTE FUNCTION public.trg_aplicar_desconto_familiar();

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.financeiro_politicas_desconto_familiar TO authenticated;
