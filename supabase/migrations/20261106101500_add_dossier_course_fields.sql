CREATE OR REPLACE FUNCTION public.get_aluno_dossier(
  p_escola_id uuid,
  p_aluno_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_aluno jsonb;
  v_matriculas jsonb;
  v_financeiro jsonb;
BEGIN
  SELECT to_jsonb(a.*) INTO v_aluno
  FROM public.alunos a
  WHERE a.id = p_aluno_id
    AND a.escola_id = p_escola_id;

  IF v_aluno IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_agg(row_to_json(m.*) ORDER BY m.ano_letivo DESC, m.data_matricula DESC)
    INTO v_matriculas
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
    ORDER BY m.ano_letivo DESC, m.data_matricula DESC NULLS LAST
  ) m;

  SELECT jsonb_build_object(
    'total_previsto', coalesce(SUM(valor_previsto), 0),
    'total_pago', coalesce(SUM(valor_pago_total), 0),
    'total_em_atraso', coalesce(SUM(CASE WHEN status <> 'pago' AND data_vencimento < CURRENT_DATE THEN (valor_previsto - valor_pago_total) ELSE 0 END), 0),
    'mensalidades', COALESCE(jsonb_agg(jsonb_build_object(
      'id', id,
      'mes', mes_referencia,
      'ano', ano_referencia,
      'valor', valor_previsto,
      'pago', valor_pago_total,
      'status', status,
      'vencimento', data_vencimento,
      'pago_em', data_pagamento_efetiva
    ) ORDER BY ano_referencia DESC, mes_referencia DESC), '[]'::jsonb)
  )
  INTO v_financeiro
  FROM public.mensalidades
  WHERE aluno_id = p_aluno_id
    AND escola_id = p_escola_id;

  RETURN jsonb_build_object(
    'perfil', v_aluno,
    'historico', coalesce(v_matriculas, '[]'::jsonb),
    'financeiro', coalesce(v_financeiro, '{}'::jsonb)
  );
END;
$$;
