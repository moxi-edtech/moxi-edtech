BEGIN;

CREATE TABLE IF NOT EXISTS public.financeiro_reconciliacoes_mensalidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  mensalidade_id uuid NOT NULL REFERENCES public.mensalidades(id) ON DELETE CASCADE,
  problema text NOT NULL,
  status text NOT NULL DEFAULT 'aberta'
    CHECK (status IN ('aberta', 'em_revisao', 'resolvida', 'dispensada')),
  acao text,
  justificativa text,
  dados_antes jsonb NOT NULL DEFAULT '{}'::jsonb,
  dados_depois jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT financeiro_reconciliacoes_mensalidades_unique
    UNIQUE (escola_id, mensalidade_id, problema)
);

CREATE INDEX IF NOT EXISTS idx_fin_reconciliacao_mensalidade_status
  ON public.financeiro_reconciliacoes_mensalidades (escola_id, status, updated_at DESC);

ALTER TABLE public.financeiro_reconciliacoes_mensalidades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS financeiro_reconciliacoes_mensalidades_select
  ON public.financeiro_reconciliacoes_mensalidades;
CREATE POLICY financeiro_reconciliacoes_mensalidades_select
  ON public.financeiro_reconciliacoes_mensalidades
  FOR SELECT TO authenticated
  USING (escola_id = public.current_tenant_escola_id());

DROP VIEW IF EXISTS public.vw_financeiro_mensalidades_reconciliacao_assistida;
CREATE VIEW public.vw_financeiro_mensalidades_reconciliacao_assistida
WITH (security_invoker = true) AS
SELECT
  v.*,
  abertas.problemas_abertos
FROM public.vw_financeiro_mensalidades_reconciliacao v
CROSS JOIN LATERAL (
  SELECT COALESCE(
    array_agg(issue.problema ORDER BY issue.ord),
    ARRAY[]::text[]
  ) AS problemas_abertos
  FROM unnest(v.problemas) WITH ORDINALITY AS issue(problema, ord)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.financeiro_reconciliacoes_mensalidades r
    WHERE r.escola_id = v.escola_id
      AND r.mensalidade_id = v.mensalidade_id
      AND r.problema = issue.problema
      AND r.status IN ('resolvida', 'dispensada')
  )
) abertas
WHERE cardinality(abertas.problemas_abertos) > 0;

CREATE OR REPLACE FUNCTION public.get_financeiro_mensalidades_reconciliacao_resumo(
  p_escola_id uuid,
  p_ano_letivo_id uuid DEFAULT NULL
)
RETURNS TABLE(problema text, total bigint, saldo numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.current_tenant_escola_id() IS DISTINCT FROM p_escola_id THEN
    RAISE EXCEPTION 'AUTH: escola_id inválido';
  END IF;
  IF NOT public.user_has_role_in_school(
    p_escola_id,
    ARRAY['admin','admin_escola','staff_admin','admin_secretaria','admin_financeiro','diretor','secretaria_financeiro','secretaria']
  ) THEN
    RAISE EXCEPTION 'AUTH: permissão negada';
  END IF;

  RETURN QUERY
  SELECT issue.problema,
         COUNT(*)::bigint,
         COALESCE(SUM(v.saldo), 0)::numeric
  FROM public.vw_financeiro_mensalidades_reconciliacao_assistida v
  CROSS JOIN LATERAL unnest(v.problemas_abertos) AS issue(problema)
  WHERE v.escola_id = p_escola_id
    AND (p_ano_letivo_id IS NULL OR v.ano_letivo_id = p_ano_letivo_id)
  GROUP BY issue.problema
  ORDER BY issue.problema;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_financeiro_mensalidade_reconciliacao(
  p_escola_id uuid,
  p_mensalidade_id uuid,
  p_problema text,
  p_acao text,
  p_target_matricula_id uuid DEFAULT NULL,
  p_justificativa text DEFAULT NULL,
  p_confirmacao boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tenant uuid := public.current_tenant_escola_id();
  v_actor uuid := auth.uid();
  v_mensalidade public.mensalidades%ROWTYPE;
  v_matricula public.matriculas%ROWTYPE;
  v_target public.matriculas%ROWTYPE;
  v_before jsonb;
  v_after jsonb;
  v_status text;
  v_reconciliation_id uuid;
BEGIN
  IF v_tenant IS NULL OR v_tenant IS DISTINCT FROM p_escola_id THEN
    RAISE EXCEPTION 'AUTH: escola_id inválido';
  END IF;
  IF NOT public.user_has_role_in_school(
    p_escola_id,
    ARRAY['admin','admin_escola','staff_admin','admin_secretaria','admin_financeiro','diretor','secretaria_financeiro','secretaria']
  ) THEN
    RAISE EXCEPTION 'AUTH: permissão negada';
  END IF;
  IF NOT p_confirmacao THEN
    RAISE EXCEPTION 'CONFIRMATION_REQUIRED: confirme a ação antes de continuar';
  END IF;
  IF coalesce(length(trim(p_justificativa)), 0) < 10 THEN
    RAISE EXCEPTION 'JUSTIFICATION_REQUIRED: informe uma justificativa com pelo menos 10 caracteres';
  END IF;
  IF p_problema NOT IN ('SEM_MATRICULA','ANO_DIVERGENTE','TURMA_DIVERGENTE','SEM_DATA_VENCIMENTO','SEM_CALENDARIO','FORA_CALENDARIO') THEN
    RAISE EXCEPTION 'VALIDATION: problema não suportado';
  END IF;

  SELECT * INTO v_mensalidade
  FROM public.mensalidades
  WHERE id = p_mensalidade_id
    AND escola_id = p_escola_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DATA: mensalidade não encontrada';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.vw_financeiro_mensalidades_reconciliacao v
    WHERE v.mensalidade_id = p_mensalidade_id
      AND p_problema = ANY(v.problemas)
  ) THEN
    RAISE EXCEPTION 'STALE_RECONCILIATION: o problema já não está presente nesta mensalidade';
  END IF;

  SELECT to_jsonb(v) INTO v_before
  FROM public.vw_financeiro_mensalidades_reconciliacao v
  WHERE v.mensalidade_id = p_mensalidade_id;

  IF v_mensalidade.matricula_id IS NOT NULL THEN
    SELECT * INTO v_matricula
    FROM public.matriculas
    WHERE id = v_mensalidade.matricula_id
      AND escola_id = p_escola_id;
  END IF;

  IF p_problema = 'SEM_MATRICULA' THEN
    IF p_acao <> 'corrigir_vinculo' OR p_target_matricula_id IS NULL THEN
      RAISE EXCEPTION 'ACTION_REQUIRED: selecione uma matrícula para corrigir o vínculo';
    END IF;

    SELECT * INTO v_target
    FROM public.matriculas
    WHERE id = p_target_matricula_id
      AND escola_id = p_escola_id
      AND aluno_id = v_mensalidade.aluno_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'DATA: matrícula destino inválida para este aluno';
    END IF;
    IF v_mensalidade.ano_letivo ~ '^\d{4}$'
       AND v_target.ano_letivo IS DISTINCT FROM v_mensalidade.ano_letivo::integer THEN
      RAISE EXCEPTION 'CONFLICT: matrícula selecionada pertence a outro ano letivo';
    END IF;
    IF v_mensalidade.turma_id IS NOT NULL
       AND v_target.turma_id IS DISTINCT FROM v_mensalidade.turma_id THEN
      RAISE EXCEPTION 'CONFLICT: matrícula selecionada pertence a outra turma';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.mensalidades x
      WHERE x.escola_id = p_escola_id
        AND x.matricula_id = v_target.id
        AND x.ano_referencia IS NOT DISTINCT FROM v_mensalidade.ano_referencia
        AND x.mes_referencia IS NOT DISTINCT FROM v_mensalidade.mes_referencia
        AND x.id <> v_mensalidade.id
    ) THEN
      RAISE EXCEPTION 'CONFLICT: já existe mensalidade para a matrícula e competência selecionadas';
    END IF;
    UPDATE public.mensalidades
    SET matricula_id = v_target.id, updated_at = now()
    WHERE id = v_mensalidade.id;
    v_status := 'resolvida';
  ELSIF p_problema = 'ANO_DIVERGENTE' THEN
    IF p_acao <> 'corrigir_ano' OR v_matricula.id IS NULL THEN
      RAISE EXCEPTION 'ACTION_REQUIRED: esta divergência requer matrícula válida';
    END IF;
    UPDATE public.mensalidades
    SET ano_letivo = v_matricula.ano_letivo::text, updated_at = now()
    WHERE id = v_mensalidade.id;
    v_status := 'resolvida';
  ELSIF p_problema = 'TURMA_DIVERGENTE' THEN
    IF p_acao <> 'corrigir_turma' OR v_matricula.id IS NULL OR v_matricula.turma_id IS NULL THEN
      RAISE EXCEPTION 'ACTION_REQUIRED: esta divergência requer matrícula e turma válidas';
    END IF;
    UPDATE public.mensalidades
    SET turma_id = v_matricula.turma_id, updated_at = now()
    WHERE id = v_mensalidade.id;
    v_status := 'resolvida';
  ELSE
    IF p_acao <> 'justificar' THEN
      RAISE EXCEPTION 'ACTION_REQUIRED: este problema deve ser justificado pela secretaria/financeiro';
    END IF;
    v_status := 'dispensada';
  END IF;

  SELECT to_jsonb(v) INTO v_after
  FROM public.mensalidades v
  WHERE v.id = p_mensalidade_id;

  INSERT INTO public.financeiro_reconciliacoes_mensalidades (
    escola_id, mensalidade_id, problema, status, acao, justificativa,
    dados_antes, dados_depois, actor_id, resolved_at, updated_at
  ) VALUES (
    p_escola_id, p_mensalidade_id, p_problema, v_status, p_acao, trim(p_justificativa),
    coalesce(v_before, '{}'::jsonb), coalesce(v_after, '{}'::jsonb), v_actor, now(), now()
  )
  ON CONFLICT (escola_id, mensalidade_id, problema) DO UPDATE SET
    status = EXCLUDED.status,
    acao = EXCLUDED.acao,
    justificativa = EXCLUDED.justificativa,
    dados_antes = EXCLUDED.dados_antes,
    dados_depois = EXCLUDED.dados_depois,
    actor_id = EXCLUDED.actor_id,
    resolved_at = EXCLUDED.resolved_at,
    updated_at = now()
  RETURNING id INTO v_reconciliation_id;

  INSERT INTO public.audit_logs (
    escola_id, actor_id, action, entity, entity_id, portal, details
  ) VALUES (
    p_escola_id, v_actor, 'FINANCEIRO_MENSALIDADE_RECONCILIADA',
    'mensalidades', p_mensalidade_id::text, 'financeiro',
    jsonb_build_object(
      'reconciliation_id', v_reconciliation_id,
      'problema', p_problema,
      'acao', p_acao,
      'status', v_status,
      'justificativa', trim(p_justificativa),
      'dados_antes', coalesce(v_before, '{}'::jsonb),
      'dados_depois', coalesce(v_after, '{}'::jsonb)
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'mensalidade_id', p_mensalidade_id,
    'reconciliation_id', v_reconciliation_id,
    'problema', p_problema,
    'acao', p_acao,
    'status', v_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_financeiro_mensalidade_reconciliacao(uuid, uuid, text, text, uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_financeiro_mensalidade_reconciliacao(uuid, uuid, text, text, uuid, text, boolean) TO authenticated;
GRANT SELECT ON public.vw_financeiro_mensalidades_reconciliacao_assistida TO authenticated, service_role;

COMMIT;
