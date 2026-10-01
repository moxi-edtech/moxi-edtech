BEGIN;

-- RAA carryovers: fecha o ciclo pós-rematrícula sem criar um segundo SSOT.
-- 1) recurso/extraordinário publicado passa a resolver a disciplina de origem;
-- 2) dependências são materializadas para operação/UX e auditadas por eventos;
-- 3) matrícula e resultados de exame sincronizam o índice automaticamente.

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

-- Lifecycle operacional de disciplinas carregadas na progressão condicional.
-- A tabela NÃO é SSOT de notas: resolve_estado_resultado() continua sendo a
-- autoridade. Aqui materializamos estado, vínculo origem/destino e auditoria.

CREATE TABLE IF NOT EXISTS public.dependencias_academicas_transicao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  matricula_origem_id uuid NOT NULL REFERENCES public.matriculas(id) ON DELETE CASCADE,
  matricula_destino_id uuid REFERENCES public.matriculas(id) ON DELETE SET NULL,
  disciplina_id uuid NOT NULL REFERENCES public.disciplinas_catalogo(id) ON DELETE RESTRICT,
  turma_disciplina_origem_id uuid REFERENCES public.turma_disciplinas(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','em_recurso','resolvida_aprovada','resolvida_reprovada','cancelada')),
  raa_decision_origem text,
  raa_motivo_origem text,
  resultado_status text,
  resultado_nota numeric,
  resultado_motivo text,
  fonte_resolucao text,
  exame_sessao_id uuid REFERENCES public.exame_sessoes(id) ON DELETE SET NULL,
  resultado_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  primeira_deteccao_em timestamptz NOT NULL DEFAULT now(),
  resolvido_em timestamptz,
  ultima_sincronizacao_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dependencias_academicas_transicao_unique
    UNIQUE (escola_id, matricula_origem_id, disciplina_id)
);

CREATE INDEX IF NOT EXISTS idx_dependencias_academicas_transicao_queue
  ON public.dependencias_academicas_transicao (escola_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_dependencias_academicas_transicao_aluno
  ON public.dependencias_academicas_transicao (escola_id, aluno_id, status);
CREATE INDEX IF NOT EXISTS idx_dependencias_academicas_transicao_destino
  ON public.dependencias_academicas_transicao (matricula_destino_id)
  WHERE matricula_destino_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.dependencias_academicas_transicao_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  dependencia_id uuid NOT NULL REFERENCES public.dependencias_academicas_transicao(id) ON DELETE CASCADE,
  status_anterior text,
  status_novo text NOT NULL,
  fonte text,
  actor_id uuid,
  resultado_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dependencias_academicas_eventos_dependencia
  ON public.dependencias_academicas_transicao_eventos (dependencia_id, created_at DESC);

ALTER TABLE public.dependencias_academicas_transicao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dependencias_academicas_transicao_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dependencias_academicas_transicao_select ON public.dependencias_academicas_transicao;
CREATE POLICY dependencias_academicas_transicao_select
ON public.dependencias_academicas_transicao
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.alunos a
    WHERE a.id = dependencias_academicas_transicao.aluno_id
      AND a.escola_id = dependencias_academicas_transicao.escola_id
      AND a.usuario_auth_id = (SELECT auth.uid())
  )
  OR (
    dependencias_academicas_transicao.escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(
      dependencias_academicas_transicao.escola_id,
      ARRAY['admin','admin_escola','staff_admin','admin_secretaria','diretor','secretaria','professor']::text[]
    )
  )
);

DROP POLICY IF EXISTS dependencias_academicas_eventos_select ON public.dependencias_academicas_transicao_eventos;
CREATE POLICY dependencias_academicas_eventos_select
ON public.dependencias_academicas_transicao_eventos
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.dependencias_academicas_transicao d
    JOIN public.alunos a ON a.id = d.aluno_id AND a.escola_id = d.escola_id
    WHERE d.id = dependencias_academicas_transicao_eventos.dependencia_id
      AND (
        a.usuario_auth_id = (SELECT auth.uid())
        OR (
          d.escola_id = public.current_tenant_escola_id()
          AND public.user_has_role_in_school(
            d.escola_id,
            ARRAY['admin','admin_escola','staff_admin','admin_secretaria','diretor','secretaria','professor']::text[]
          )
        )
      )
  )
);

REVOKE ALL ON public.dependencias_academicas_transicao FROM PUBLIC, anon;
REVOKE ALL ON public.dependencias_academicas_transicao_eventos FROM PUBLIC, anon;
GRANT SELECT ON public.dependencias_academicas_transicao TO authenticated;
GRANT SELECT ON public.dependencias_academicas_transicao_eventos TO authenticated;
GRANT ALL ON public.dependencias_academicas_transicao TO service_role;
GRANT ALL ON public.dependencias_academicas_transicao_eventos TO service_role;

CREATE OR REPLACE FUNCTION public.log_dependencia_academica_transicao_evento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF TG_OP = 'INSERT'
     OR OLD.status IS DISTINCT FROM NEW.status
     OR OLD.exame_sessao_id IS DISTINCT FROM NEW.exame_sessao_id THEN
    INSERT INTO public.dependencias_academicas_transicao_eventos (
      escola_id,
      dependencia_id,
      status_anterior,
      status_novo,
      fonte,
      actor_id,
      resultado_snapshot
    ) VALUES (
      NEW.escola_id,
      NEW.id,
      CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.status END,
      NEW.status,
      NEW.fonte_resolucao,
      public.safe_auth_uid(),
      NEW.resultado_snapshot
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.log_dependencia_academica_transicao_evento() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_dependencia_academica_transicao_evento() TO service_role;

DROP TRIGGER IF EXISTS trg_log_dependencia_academica_transicao_evento
  ON public.dependencias_academicas_transicao;
CREATE TRIGGER trg_log_dependencia_academica_transicao_evento
AFTER INSERT OR UPDATE OF status, exame_sessao_id
ON public.dependencias_academicas_transicao
FOR EACH ROW
EXECUTE FUNCTION public.log_dependencia_academica_transicao_evento();

CREATE OR REPLACE FUNCTION public.sync_dependencias_academicas_transicao(
  p_escola_id uuid,
  p_matricula_origem_id uuid,
  p_matricula_destino_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_origem record;
  v_destino_id uuid := p_matricula_destino_id;
  v_raa jsonb;
  v_disciplina_id uuid;
  v_td_id uuid;
  v_result jsonb;
  v_result_status text;
  v_lifecycle_status text;
  v_is_pending boolean;
  v_exame_sessao_id uuid;
  v_fonte text;
  v_resolved boolean;
  v_total integer := 0;
  v_abertas integer := 0;
  v_resolvidas integer := 0;
BEGIN
  SELECT m.id, m.escola_id, m.aluno_id, m.turma_id
    INTO v_origem
  FROM public.matriculas m
  WHERE m.id = p_matricula_origem_id
    AND m.escola_id = p_escola_id;

  IF v_origem.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ORIGIN_NOT_FOUND');
  END IF;

  IF v_destino_id IS NULL THEN
    SELECT m.id INTO v_destino_id
    FROM public.matriculas m
    WHERE m.escola_id = p_escola_id
      AND m.aluno_id = v_origem.aluno_id
      AND m.origem_transicao_matricula_id = p_matricula_origem_id
    ORDER BY m.created_at DESC NULLS LAST, m.id DESC
    LIMIT 1;
  ELSE
    IF NOT EXISTS (
      SELECT 1
      FROM public.matriculas m
      WHERE m.id = v_destino_id
        AND m.escola_id = p_escola_id
        AND m.aluno_id = v_origem.aluno_id
        AND m.origem_transicao_matricula_id = p_matricula_origem_id
    ) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'DESTINATION_MISMATCH');
    END IF;
  END IF;

  IF v_destino_id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'status', 'no_destination', 'total', 0);
  END IF;

  v_raa := public.resolve_raa_progression_for_matricula(
    p_escola_id,
    p_matricula_origem_id
  );

  FOR v_disciplina_id IN
    SELECT DISTINCT q.disciplina_id
    FROM (
      SELECT d.disciplina_id
      FROM public.dependencias_academicas_transicao d
      WHERE d.escola_id = p_escola_id
        AND d.matricula_origem_id = p_matricula_origem_id
      UNION ALL
      SELECT value::uuid
      FROM jsonb_array_elements_text(
        coalesce(v_raa->'disciplina_ids_pendentes', '[]'::jsonb)
      )
    ) q
  LOOP
    SELECT td.id INTO v_td_id
    FROM public.turma_disciplinas td
    WHERE td.escola_id = p_escola_id
      AND td.turma_id = v_origem.turma_id
      AND td.avaliacao_disciplina_id = v_disciplina_id
    ORDER BY td.id
    LIMIT 1;

    v_result := public.resolve_estado_resultado(
      p_matricula_origem_id,
      v_disciplina_id
    );
    v_result_status := lower(coalesce(v_result->>'status', 'pendente_dados'));
    v_exame_sessao_id := NULLIF(v_result->>'exame_sessao_id', '')::uuid;
    v_fonte := 'raa';

    IF v_exame_sessao_id IS NOT NULL THEN
      SELECT coalesce(es.tipo, 'raa') INTO v_fonte
      FROM public.exame_sessoes es
      WHERE es.id = v_exame_sessao_id
        AND es.escola_id = p_escola_id;
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(
        coalesce(v_raa->'disciplina_ids_pendentes', '[]'::jsonb)
      ) p(value)
      WHERE p.value = v_disciplina_id::text
    ) INTO v_is_pending;

    v_resolved := false;
    IF v_exame_sessao_id IS NOT NULL AND v_result_status = 'aprovado' THEN
      v_lifecycle_status := 'resolvida_aprovada';
      v_resolved := true;
    ELSIF v_exame_sessao_id IS NOT NULL
       AND v_result_status IN ('reprovado','reprovado_por_faltas','reprovado_por_indisciplina') THEN
      v_lifecycle_status := 'resolvida_reprovada';
      v_resolved := true;
    ELSIF v_result_status = 'aprovado' AND NOT v_is_pending THEN
      v_lifecycle_status := 'resolvida_aprovada';
      v_resolved := true;
    ELSIF v_result_status IN ('reprovado','reprovado_por_faltas','reprovado_por_indisciplina')
       AND NOT v_is_pending THEN
      v_lifecycle_status := 'resolvida_reprovada';
      v_resolved := true;
    ELSIF v_result_status = 'recurso' OR v_is_pending THEN
      v_lifecycle_status := 'em_recurso';
    ELSE
      v_lifecycle_status := 'pendente';
    END IF;

    INSERT INTO public.dependencias_academicas_transicao (
      escola_id,
      aluno_id,
      matricula_origem_id,
      matricula_destino_id,
      disciplina_id,
      turma_disciplina_origem_id,
      status,
      raa_decision_origem,
      raa_motivo_origem,
      resultado_status,
      resultado_nota,
      resultado_motivo,
      fonte_resolucao,
      exame_sessao_id,
      resultado_snapshot,
      resolvido_em,
      ultima_sincronizacao_em,
      updated_at
    ) VALUES (
      p_escola_id,
      v_origem.aluno_id,
      p_matricula_origem_id,
      v_destino_id,
      v_disciplina_id,
      v_td_id,
      v_lifecycle_status,
      v_raa->>'decision',
      v_raa->>'motivo',
      v_result_status,
      NULLIF(v_result->>'nota', '')::numeric,
      v_result->>'motivo',
      v_fonte,
      v_exame_sessao_id,
      coalesce(v_result, '{}'::jsonb),
      CASE WHEN v_resolved THEN now() ELSE NULL END,
      now(),
      now()
    )
    ON CONFLICT (escola_id, matricula_origem_id, disciplina_id)
    DO UPDATE SET
      matricula_destino_id = EXCLUDED.matricula_destino_id,
      turma_disciplina_origem_id = EXCLUDED.turma_disciplina_origem_id,
      status = EXCLUDED.status,
      raa_decision_origem = EXCLUDED.raa_decision_origem,
      raa_motivo_origem = EXCLUDED.raa_motivo_origem,
      resultado_status = EXCLUDED.resultado_status,
      resultado_nota = EXCLUDED.resultado_nota,
      resultado_motivo = EXCLUDED.resultado_motivo,
      fonte_resolucao = EXCLUDED.fonte_resolucao,
      exame_sessao_id = EXCLUDED.exame_sessao_id,
      resultado_snapshot = EXCLUDED.resultado_snapshot,
      resolvido_em = CASE
        WHEN EXCLUDED.status IN ('resolvida_aprovada','resolvida_reprovada') THEN
          CASE
            WHEN public.dependencias_academicas_transicao.status IS DISTINCT FROM EXCLUDED.status
              OR public.dependencias_academicas_transicao.resolvido_em IS NULL
            THEN now()
            ELSE public.dependencias_academicas_transicao.resolvido_em
          END
        ELSE NULL
      END,
      ultima_sincronizacao_em = now(),
      updated_at = now();
  END LOOP;

  SELECT
    count(*)::integer,
    count(*) FILTER (WHERE status IN ('pendente','em_recurso'))::integer,
    count(*) FILTER (WHERE status IN ('resolvida_aprovada','resolvida_reprovada'))::integer
  INTO v_total, v_abertas, v_resolvidas
  FROM public.dependencias_academicas_transicao d
  WHERE d.escola_id = p_escola_id
    AND d.matricula_origem_id = p_matricula_origem_id;

  RETURN jsonb_build_object(
    'ok', true,
    'matricula_origem_id', p_matricula_origem_id,
    'matricula_destino_id', v_destino_id,
    'total', v_total,
    'abertas', v_abertas,
    'resolvidas', v_resolvidas
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sync_dependencias_academicas_transicao(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_dependencias_academicas_transicao(uuid, uuid, uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.trigger_sync_dependencias_matricula()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NEW.origem_transicao_matricula_id IS NOT NULL THEN
    PERFORM public.sync_dependencias_academicas_transicao(
      NEW.escola_id,
      NEW.origem_transicao_matricula_id,
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trigger_sync_dependencias_matricula()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_sync_dependencias_matricula() TO service_role;

DROP TRIGGER IF EXISTS trg_sync_dependencias_matricula ON public.matriculas;
CREATE TRIGGER trg_sync_dependencias_matricula
AFTER INSERT OR UPDATE OF origem_transicao_matricula_id, status, ativo
ON public.matriculas
FOR EACH ROW
WHEN (NEW.origem_transicao_matricula_id IS NOT NULL)
EXECUTE FUNCTION public.trigger_sync_dependencias_matricula();

CREATE OR REPLACE FUNCTION public.trigger_sync_dependencias_exame_resultado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_matricula_id uuid := coalesce(NEW.matricula_id, OLD.matricula_id);
  v_escola_id uuid := coalesce(NEW.escola_id, OLD.escola_id);
  v_destino record;
BEGIN
  FOR v_destino IN
    SELECT m.id
    FROM public.matriculas m
    WHERE m.escola_id = v_escola_id
      AND m.origem_transicao_matricula_id = v_matricula_id
  LOOP
    PERFORM public.sync_dependencias_academicas_transicao(
      v_escola_id,
      v_matricula_id,
      v_destino.id
    );
  END LOOP;
  RETURN coalesce(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.trigger_sync_dependencias_exame_resultado()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_sync_dependencias_exame_resultado() TO service_role;

DROP TRIGGER IF EXISTS trg_sync_dependencias_exame_resultado ON public.exame_resultados;
CREATE TRIGGER trg_sync_dependencias_exame_resultado
AFTER INSERT OR UPDATE OF nota, estado, exame_sessao_id, turma_disciplina_id OR DELETE
ON public.exame_resultados
FOR EACH ROW
EXECUTE FUNCTION public.trigger_sync_dependencias_exame_resultado();

CREATE OR REPLACE FUNCTION public.trigger_sync_dependencias_exame_sessao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_item record;
BEGIN
  IF OLD.estado IS NOT DISTINCT FROM NEW.estado THEN
    RETURN NEW;
  END IF;

  IF NEW.estado NOT IN ('publicada','encerrada','cancelada') THEN
    RETURN NEW;
  END IF;

  FOR v_item IN
    SELECT DISTINCT
      er.escola_id,
      er.matricula_id,
      m.id AS matricula_destino_id
    FROM public.exame_resultados er
    JOIN public.matriculas m
      ON m.escola_id = er.escola_id
     AND m.origem_transicao_matricula_id = er.matricula_id
    WHERE er.exame_sessao_id = NEW.id
  LOOP
    PERFORM public.sync_dependencias_academicas_transicao(
      v_item.escola_id,
      v_item.matricula_id,
      v_item.matricula_destino_id
    );
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trigger_sync_dependencias_exame_sessao()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_sync_dependencias_exame_sessao() TO service_role;

DROP TRIGGER IF EXISTS trg_sync_dependencias_exame_sessao ON public.exame_sessoes;
CREATE TRIGGER trg_sync_dependencias_exame_sessao
AFTER UPDATE OF estado ON public.exame_sessoes
FOR EACH ROW
EXECUTE FUNCTION public.trigger_sync_dependencias_exame_sessao();

COMMENT ON TABLE public.dependencias_academicas_transicao IS
  'Índice operacional de disciplinas carregadas entre matrículas; resolve_estado_resultado permanece SSOT.';
COMMENT ON TABLE public.dependencias_academicas_transicao_eventos IS
  'Histórico append-only das transições de estado das dependências académicas.';

COMMIT;
