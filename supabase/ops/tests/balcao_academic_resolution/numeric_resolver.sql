-- Exact installed numerical resolver, not a constant stub.
CREATE OR REPLACE FUNCTION public.resolve_estado_resultado_academico_base(p_matricula_id uuid, p_disciplina_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_escola_id uuid;
  v_turma_id uuid;
  v_ano_letivo_id uuid;
  v_turma_disciplina_id uuid;
  v_regime jsonb;
  v_nota numeric;
  v_nota_final numeric;
  v_exame_nota numeric;
  v_exame_componentes integer := 0;
  v_exame_componentes_completos integer := 0;
  v_exame_sessao_id uuid;
  v_exame_tipo text;
  v_corte numeric;
  v_escala text;
  v_peso_percurso numeric;
  v_peso_exame numeric;
BEGIN
  SELECT m.escola_id, m.turma_id, al.id
  INTO v_escola_id, v_turma_id, v_ano_letivo_id
  FROM public.matriculas m
  LEFT JOIN public.anos_letivos al
    ON al.escola_id = m.escola_id
   AND al.ano = m.ano_letivo
  WHERE m.id = p_matricula_id
    AND m.aluno_id IS NOT NULL;

  IF v_escola_id IS NULL OR v_turma_id IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'pendente_dados',
      'positivo', NULL,
      'cor', NULL,
      'motivo', 'matricula_nao_encontrada'
    );
  END IF;

  SELECT td.id
  INTO v_turma_disciplina_id
  FROM public.turma_disciplinas td
  WHERE td.escola_id = v_escola_id
    AND td.turma_id = v_turma_id
    AND td.avaliacao_disciplina_id = p_disciplina_id
  ORDER BY td.id
  LIMIT 1;

  v_regime := public.resolve_regime_academico(v_turma_id);
  v_escala := COALESCE(v_regime->>'escala', 'quantitativa_secundario');
  v_corte := CASE WHEN v_escala = 'quantitativa_primario' THEN 5 ELSE 10 END;
  v_peso_percurso := COALESCE((v_regime#>>'{formula_mfd,peso_percurso}')::numeric, 1);
  v_peso_exame := COALESCE((v_regime#>>'{formula_mfd,peso_exame}')::numeric, 0);

  SELECT AVG(v.nota_final)
  INTO v_nota
  FROM internal.mv_boletim_por_matricula v
  WHERE v.escola_id = v_escola_id
    AND v.matricula_id = p_matricula_id
    AND v.disciplina_id = p_disciplina_id
    AND v.nota_final IS NOT NULL;

  -- Recurso/extraordinário substitutivo também resolve dependências de
  -- classes que não são classes de exame. O SSOT continua sendo este
  -- resolvedor; o lifecycle apenas materializa o seu resultado.
  SELECT es.id, es.tipo
  INTO v_exame_sessao_id, v_exame_tipo
  FROM public.exame_sessoes es
  WHERE es.escola_id = v_escola_id
    AND es.turma_id = v_turma_id
    AND es.ano_letivo_id = v_ano_letivo_id
    AND es.estado IN ('publicada', 'encerrada')
    AND es.tipo IN ('recurso', 'extraordinario')
    AND EXISTS (
      SELECT 1
      FROM public.exame_resultados er
      WHERE er.escola_id = v_escola_id
        AND er.exame_sessao_id = es.id
        AND er.matricula_id = p_matricula_id
        AND er.turma_disciplina_id = v_turma_disciplina_id
        AND er.estado IN ('submetido', 'validado')
    )
  ORDER BY es.updated_at DESC, es.id DESC
  LIMIT 1;

  IF v_exame_sessao_id IS NOT NULL AND v_turma_disciplina_id IS NOT NULL THEN
    SELECT COUNT(DISTINCT ec.id), COUNT(DISTINCT ec.id) FILTER (WHERE er.nota IS NOT NULL)
    INTO v_exame_componentes, v_exame_componentes_completos
    FROM public.exame_componentes ec
    LEFT JOIN public.exame_resultados er
      ON er.exame_componente_id = ec.id
     AND er.exame_sessao_id = ec.exame_sessao_id
     AND er.matricula_id = p_matricula_id
     AND er.turma_disciplina_id = v_turma_disciplina_id
     AND er.estado IN ('submetido', 'validado')
    WHERE ec.escola_id = v_escola_id
      AND ec.exame_sessao_id = v_exame_sessao_id;

    IF v_exame_componentes = 0 OR v_exame_componentes <> v_exame_componentes_completos THEN
      RETURN jsonb_build_object(
        'status', 'pendente_formula',
        'positivo', NULL,
        'cor', NULL,
        'nota', v_nota,
        'corte', v_corte,
        'escala', v_escala,
        'regime', v_regime,
        'exame_sessao_id', v_exame_sessao_id,
        'exame_tipo', v_exame_tipo,
        'exame_componentes', v_exame_componentes,
        'exame_componentes_completos', v_exame_componentes_completos,
        'motivo', 'exame_substitutivo_aguarda_componentes'
      );
    END IF;

    SELECT SUM(er.nota * ec.peso) / NULLIF(SUM(ec.peso), 0)
    INTO v_exame_nota
    FROM public.exame_componentes ec
    JOIN public.exame_resultados er
      ON er.exame_componente_id = ec.id
     AND er.exame_sessao_id = ec.exame_sessao_id
     AND er.matricula_id = p_matricula_id
     AND er.turma_disciplina_id = v_turma_disciplina_id
     AND er.estado IN ('submetido', 'validado')
    WHERE ec.escola_id = v_escola_id
      AND ec.exame_sessao_id = v_exame_sessao_id;

    v_nota_final := round(v_exame_nota, 1);
    RETURN jsonb_build_object(
      'status', CASE WHEN v_nota_final >= v_corte THEN 'aprovado' ELSE 'reprovado' END,
      'positivo', (v_nota_final >= v_corte),
      'cor', CASE WHEN v_nota_final >= v_corte THEN 'azul' ELSE 'vermelho' END,
      'nota', v_nota_final,
      'corte', v_corte,
      'escala', v_escala,
      'regime', v_regime,
      'exame_sessao_id', v_exame_sessao_id,
      'exame_tipo', v_exame_tipo,
      'exame_nota', round(v_exame_nota, 1),
      'motivo', 'exame_substitutivo_resolvido'
    );
  END IF;

  v_exame_sessao_id := NULL;
  v_exame_tipo := NULL;
  v_exame_componentes := 0;
  v_exame_componentes_completos := 0;

  IF COALESCE((v_regime->>'eh_classe_exame')::boolean, false) THEN
    SELECT es.id, es.tipo
    INTO v_exame_sessao_id, v_exame_tipo
    FROM public.exame_sessoes es
    WHERE es.escola_id = v_escola_id
      AND es.turma_id = v_turma_id
      AND es.ano_letivo_id = v_ano_letivo_id
      AND es.estado IN ('publicada', 'encerrada')
      AND es.tipo = 'exame_nacional'
    ORDER BY CASE es.tipo
      WHEN 'recurso' THEN 1
      WHEN 'extraordinario' THEN 2
      ELSE 3
    END, es.updated_at DESC
    LIMIT 1;

    IF v_exame_sessao_id IS NULL OR v_turma_disciplina_id IS NULL THEN
      RETURN jsonb_build_object(
        'status', 'pendente_formula',
        'positivo', NULL,
        'cor', NULL,
        'nota', v_nota,
        'corte', v_corte,
        'escala', v_escala,
        'regime', v_regime,
        'motivo', 'exame_sem_sessao'
      );
    END IF;

    SELECT
      COUNT(ec.id)::integer,
      COUNT(er.id)::integer
    INTO
      v_exame_componentes,
      v_exame_componentes_completos
    FROM public.exame_componentes ec
    LEFT JOIN public.exame_resultados er
      ON er.exame_componente_id = ec.id
     AND er.exame_sessao_id = ec.exame_sessao_id
     AND er.matricula_id = p_matricula_id
     AND er.turma_disciplina_id = v_turma_disciplina_id
     AND er.estado IN ('submetido', 'validado')
    WHERE ec.escola_id = v_escola_id
      AND ec.exame_sessao_id = v_exame_sessao_id;

    IF v_exame_componentes = 0 OR v_exame_componentes <> v_exame_componentes_completos THEN
      RETURN jsonb_build_object(
        'status', 'pendente_formula',
        'positivo', NULL,
        'cor', NULL,
        'nota', v_nota,
        'corte', v_corte,
        'escala', v_escala,
        'regime', v_regime,
        'exame_sessao_id', v_exame_sessao_id,
        'exame_componentes', v_exame_componentes,
        'exame_componentes_completos', v_exame_componentes_completos,
        'motivo', 'exame_aguarda_componentes'
      );
    END IF;

    SELECT SUM(er.nota * ec.peso) / NULLIF(SUM(ec.peso), 0)
    INTO v_exame_nota
    FROM public.exame_componentes ec
    JOIN public.exame_resultados er
      ON er.exame_componente_id = ec.id
     AND er.exame_sessao_id = ec.exame_sessao_id
     AND er.matricula_id = p_matricula_id
     AND er.turma_disciplina_id = v_turma_disciplina_id
     AND er.estado IN ('submetido', 'validado')
    WHERE ec.escola_id = v_escola_id
      AND ec.exame_sessao_id = v_exame_sessao_id;

    IF v_exame_tipo IN ('recurso', 'extraordinario') THEN
      v_nota_final := v_exame_nota;
    ELSE
      IF v_nota IS NULL THEN
        RETURN jsonb_build_object(
          'status', 'pendente_formula',
          'positivo', NULL,
          'cor', NULL,
          'nota', NULL,
          'corte', v_corte,
          'escala', v_escala,
          'regime', v_regime,
          'exame_sessao_id', v_exame_sessao_id,
          'motivo', 'percurso_aguarda_mt3'
        );
      END IF;
      v_nota_final := (v_nota * v_peso_percurso) + (v_exame_nota * v_peso_exame);
    END IF;

    v_nota_final := round(v_nota_final, 1);
    RETURN jsonb_build_object(
      'status', CASE WHEN v_nota_final >= v_corte THEN 'aprovado' ELSE 'reprovado' END,
      'positivo', (v_nota_final >= v_corte),
      'cor', CASE WHEN v_nota_final >= v_corte THEN 'azul' ELSE 'vermelho' END,
      'nota', v_nota_final,
      'corte', v_corte,
      'escala', v_escala,
      'regime', v_regime,
      'exame_sessao_id', v_exame_sessao_id,
      'exame_nota', round(v_exame_nota, 1),
      'motivo', 'mfd_exame_resolvida'
    );
  END IF;

  IF v_nota IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'pendente_dados',
      'positivo', NULL,
      'cor', NULL,
      'nota', NULL,
      'corte', v_corte,
      'escala', v_escala,
      'regime', v_regime,
      'motivo', 'nota_nao_disponivel'
    );
  END IF;

  RETURN jsonb_build_object(
    'status', CASE WHEN v_nota >= v_corte THEN 'aprovado' ELSE 'reprovado' END,
    'positivo', (v_nota >= v_corte),
    'cor', CASE WHEN v_nota >= v_corte THEN 'azul' ELSE 'vermelho' END,
    'nota', round(v_nota, 1),
    'corte', v_corte,
    'escala', v_escala,
    'regime', v_regime,
    'motivo', 'nota_resolvida'
  );
END;
$function$;
