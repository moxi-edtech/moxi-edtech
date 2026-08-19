BEGIN;

-- O balcão precisa mostrar a dívida aberta completa do aluno, não apenas a
-- competência do ano letivo atualmente selecionado. A UI já ordena e trava
-- a seleção da mensalidade mais antiga para a mais nova.
CREATE OR REPLACE FUNCTION public.get_aluno_dossier_contextual(
  p_escola_id uuid,
  p_aluno_id uuid,
  p_ano_letivo integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_base jsonb;
  v_matricula jsonb;
  v_matricula_id uuid;
  v_financeiro jsonb;
BEGIN
  v_base := public.get_aluno_dossier(p_escola_id, p_aluno_id);
  IF v_base IS NULL OR p_ano_letivo IS NULL THEN
    RETURN v_base;
  END IF;

  SELECT to_jsonb(selected_matricula.*)
    INTO v_matricula
  FROM (
    SELECT
      m.id,
      m.ano_letivo,
      m.status,
      m.data_matricula,
      m.numero_matricula,
      t.id AS turma_id,
      t.nome AS turma,
      t.turno,
      t.turma_codigo,
      t.turma_code,
      c.nome AS classe,
      t.ano_letivo AS turma_ano_letivo,
      cu.nome AS curso,
      COALESCE(cu.codigo, cu.course_code) AS curso_codigo
    FROM public.matriculas m
    LEFT JOIN public.turmas t ON t.id = m.turma_id
    LEFT JOIN public.classes c ON c.id = t.classe_id
    LEFT JOIN public.cursos cu ON cu.id = t.curso_id
    WHERE m.aluno_id = p_aluno_id
      AND m.escola_id = p_escola_id
      AND m.ano_letivo = p_ano_letivo
    ORDER BY m.data_matricula DESC NULLS LAST, m.created_at DESC NULLS LAST, m.id DESC
    LIMIT 1
  ) selected_matricula;

  v_matricula_id := NULLIF(v_matricula->>'id', '')::uuid;

  SELECT jsonb_build_object(
    'total_previsto', COALESCE(SUM(m.valor_previsto), 0),
    'total_pago', COALESCE(SUM(m.valor_pago_total), 0),
    'total_em_atraso', COALESCE(SUM(
      CASE
        WHEN m.status <> 'pago' AND m.data_vencimento < CURRENT_DATE
        THEN GREATEST(m.valor_previsto - m.valor_pago_total, 0)
        ELSE 0
      END
    ), 0),
    'mensalidades', COALESCE(jsonb_agg(jsonb_build_object(
      'id', m.id,
      'mes', m.mes_referencia,
      'ano', m.ano_referencia,
      'ano_letivo', m.ano_letivo,
      'valor', m.valor_previsto,
      'pago', m.valor_pago_total,
      'status', m.status,
      'vencimento', m.data_vencimento,
      'pago_em', m.data_pagamento_efetiva
    ) ORDER BY m.ano_referencia ASC, m.mes_referencia ASC, m.id ASC), '[]'::jsonb)
  )
    INTO v_financeiro
  FROM public.mensalidades m
  WHERE m.escola_id = p_escola_id
    AND m.aluno_id = p_aluno_id
    AND (m.status IS NULL OR m.status IN ('pendente', 'pago_parcial'));

  v_base := jsonb_set(v_base, '{matricula_ativa}', COALESCE(v_matricula, 'null'::jsonb), true);
  v_base := jsonb_set(v_base, '{ano_letivo_ativo}', to_jsonb(p_ano_letivo), true);
  v_base := jsonb_set(v_base, '{financeiro}', COALESCE(v_financeiro, '{}'::jsonb), true);

  RETURN v_base;
END;
$$;

REVOKE ALL ON FUNCTION public.get_aluno_dossier_contextual(uuid, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_aluno_dossier_contextual(uuid, uuid, integer) TO authenticated;

COMMIT;
