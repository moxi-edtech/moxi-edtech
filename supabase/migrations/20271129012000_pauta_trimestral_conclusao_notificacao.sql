-- One completion per school, teaching assignment and official trimester.
-- Partial grade writes remain independent; this function is the only notification gate.
BEGIN;

CREATE TABLE IF NOT EXISTS public.pauta_conclusoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id),
  turma_disciplina_id uuid NOT NULL REFERENCES public.turma_disciplinas(id),
  periodo_letivo_id uuid NOT NULL REFERENCES public.periodos_letivos(id),
  total_alunos integer NOT NULL CHECK (total_alunos > 0),
  total_componentes integer NOT NULL CHECK (total_componentes > 0),
  concluido_por uuid NOT NULL REFERENCES auth.users(id),
  concluido_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pauta_conclusoes_unica UNIQUE (escola_id, turma_disciplina_id, periodo_letivo_id)
);

CREATE INDEX IF NOT EXISTS idx_pauta_conclusoes_escola ON public.pauta_conclusoes(escola_id, concluido_em DESC);
ALTER TABLE public.pauta_conclusoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.pauta_conclusoes FROM PUBLIC, anon, authenticated;

-- Reuse the existing, recipient-filtered realtime inbox. No notification on grade INSERT.
CREATE OR REPLACE FUNCTION public.trg_evento_notas_lancadas_fn(ev public.eventos)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE
  v_destinatario uuid;
BEGIN
  IF ev.payload->>'workflow' = 'pauta_concluida' THEN
    FOR v_destinatario IN
      SELECT DISTINCT u.user_id FROM (
        SELECT eu.user_id FROM public.escola_users eu
        WHERE eu.escola_id = ev.escola_id
          AND eu.papel = ANY(ARRAY[
            'secretaria','admin_secretaria','admin_secretario','secretaria_financeiro',
            'admin','admin_escola','staff_admin','diretor'
          ])
        UNION
        SELECT p.user_id FROM public.profiles p
        WHERE p.escola_id = ev.escola_id AND p.deleted_at IS NULL
          AND p.role::text = ANY(ARRAY[
            'secretaria','secretaria_financeiro','admin','admin_escola','staff_admin'
          ])
      ) u
    LOOP
      PERFORM public.inserir_notificacao(
        ev.escola_id, ev.id, v_destinatario,
        'Notas concluídas — ' || coalesce(ev.payload->>'turma_nome','Turma'),
        coalesce(ev.payload->>'disciplina_nome','Disciplina') || ' · ' ||
          coalesce(ev.payload->>'trimestre','?') || '.º trimestre · ' ||
          coalesce(ev.payload->>'total_alunos','0') || ' alunos. ' ||
          coalesce(ev.payload->>'professor_nome','Professor') || ' concluiu o lançamento.',
        'info'::public.notificacao_prioridade,
        'Conferir pauta',
        '/secretaria/pautas?turma=' || coalesce(ev.payload->>'turma_id','')
      );
    END LOOP;
    RETURN;
  END IF;

  -- Preserve legacy callers of notas.lancadas.
  FOR v_destinatario IN
    SELECT user_id FROM public.get_users_by_role(
      ev.escola_id, ARRAY['secretaria','admin']::public.user_role[]
    )
  LOOP
    PERFORM public.inserir_notificacao(
      ev.escola_id, ev.id, v_destinatario,
      'Notas lançadas — ' || coalesce(ev.payload->>'turma_nome','Turma'),
      coalesce(ev.payload->>'professor_nome','Professor') || ' lançou notas. Disponível para conferência.',
      'info'::public.notificacao_prioridade, 'Conferir notas',
      '/secretaria/pautas?turma=' || coalesce(ev.payload->>'turma_id','')
    );
  END LOOP;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.trg_pauta_concluida_evento_fn()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE
  v_turma_nome text;
  v_turma_id uuid;
  v_disciplina_nome text;
  v_trimestre smallint;
  v_professor_nome text;
BEGIN
  SELECT t.id, t.nome, dc.nome, p.numero
    INTO v_turma_id, v_turma_nome, v_disciplina_nome, v_trimestre
  FROM public.turma_disciplinas td
  JOIN public.turmas t ON t.id = td.turma_id AND t.escola_id = NEW.escola_id
  JOIN public.curso_matriz cm ON cm.id = td.curso_matriz_id AND cm.escola_id = NEW.escola_id
  JOIN public.disciplinas_catalogo dc ON dc.id = cm.disciplina_id
  JOIN public.periodos_letivos p ON p.id = NEW.periodo_letivo_id AND p.escola_id = NEW.escola_id
  WHERE td.id = NEW.turma_disciplina_id AND td.escola_id = NEW.escola_id;

  SELECT nome INTO v_professor_nome FROM public.profiles WHERE user_id = NEW.concluido_por;

  INSERT INTO public.eventos(escola_id,tipo,payload,actor_id,actor_role,entidade_tipo,entidade_id)
  VALUES (
    NEW.escola_id,
    'notas.lancadas'::public.evento_tipo,
    jsonb_build_object(
      'workflow','pauta_concluida','turma_id',v_turma_id,
      'turma_disciplina_id',NEW.turma_disciplina_id,
      'turma_nome',v_turma_nome,'disciplina_nome',v_disciplina_nome,
      'trimestre',v_trimestre,'total_alunos',NEW.total_alunos,
      'professor_nome',v_professor_nome
    ),
    NEW.concluido_por,'professor','pauta_concluida',NEW.id
  );
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_pauta_concluida_evento ON public.pauta_conclusoes;
CREATE TRIGGER trg_pauta_concluida_evento
AFTER INSERT ON public.pauta_conclusoes
FOR EACH ROW EXECUTE FUNCTION public.trg_pauta_concluida_evento_fn();

-- The canonical model, roster, grades and permissions are all checked in the DB.
-- A direct RPC call cannot bypass grade completeness by omitting components.
CREATE OR REPLACE FUNCTION public.concluir_pauta_trimestral(
  p_escola_id uuid,
  p_turma_disciplina_id uuid,
  p_periodo_letivo_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_ctx record;
  v_cfg jsonb;
  v_cfg_model text;
  v_comp jsonb := '[]'::jsonb;
  v_formula jsonb;
  v_model_components jsonb;
  v_model_type text;
  v_model_id uuid;
  v_override_id uuid;
  v_required text[];
  v_ano_id uuid;
  v_trimestre integer;
  v_total integer;
  v_missing integer;
  v_new_id uuid;
  v_assigned boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Sessão não autenticada.';
  END IF;

  SELECT td.turma_id, td.periodos_ativos, t.nome AS turma_nome,
         t.curso_id, t.classe_id, coalesce(t.ano_letivo_id,t.session_id) AS ano_id,
         cm.disciplina_id, cm.avaliacao_mode, cm.avaliacao_modelo_id,
         cm.avaliacao_disciplina_id
  INTO v_ctx
  FROM public.turma_disciplinas td
  JOIN public.turmas t ON t.id = td.turma_id AND t.escola_id = p_escola_id
  JOIN public.curso_matriz cm ON cm.id = td.curso_matriz_id AND cm.escola_id = p_escola_id
  WHERE td.id = p_turma_disciplina_id AND td.escola_id = p_escola_id;

  IF NOT FOUND OR v_ctx.ano_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Disciplina/turma/ano não encontrados nesta escola.';
  END IF;
  v_ano_id := v_ctx.ano_id;

  SELECT pl.numero INTO v_trimestre
  FROM public.periodos_letivos pl
  WHERE pl.id = p_periodo_letivo_id AND pl.escola_id = p_escola_id
    AND pl.ano_letivo_id = v_ano_id
    AND pl.tipo::text = 'TRIMESTRE'
    AND pl.offering_id IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Trimestre não corresponde à turma e ao ano letivo.';
  END IF;

  IF coalesce(array_length(v_ctx.periodos_ativos,1),0) > 0
     AND NOT v_trimestre = ANY(v_ctx.periodos_ativos) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Esta disciplina não é oferecida neste trimestre.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.professores pr
    JOIN public.turma_disciplinas_professores tdp
      ON tdp.professor_id = pr.id AND tdp.escola_id = p_escola_id
    WHERE pr.profile_id = v_uid AND pr.escola_id = p_escola_id
      AND tdp.turma_id = v_ctx.turma_id AND tdp.disciplina_id = v_ctx.disciplina_id
  ) OR EXISTS (
    SELECT 1 FROM public.escola_users eu
    WHERE eu.escola_id = p_escola_id AND eu.user_id = v_uid
      AND eu.papel = ANY(ARRAY['secretaria','admin_secretaria','admin_secretario',
                               'admin','admin_escola','staff_admin','diretor'])
  ) INTO v_assigned;
  IF NOT v_assigned THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Sem permissão para concluir esta pauta.';
  END IF;

  -- One transaction wins a completion. Repeated clicks cannot publish twice.
  PERFORM pg_advisory_xact_lock(hashtextextended(
    p_escola_id::text || ':' || p_turma_disciplina_id::text || ':' || p_periodo_letivo_id::text,0
  ));
  IF EXISTS (
    SELECT 1 FROM public.pauta_conclusoes pc
    WHERE pc.escola_id = p_escola_id AND pc.turma_disciplina_id = p_turma_disciplina_id
      AND pc.periodo_letivo_id = p_periodo_letivo_id
  ) THEN
    RETURN jsonb_build_object('ok',true,'already_completed',true);
  END IF;

  SELECT c.avaliacao_config, c.modelo_avaliacao
  INTO v_cfg, v_cfg_model
  FROM public.configuracoes_escola c WHERE c.escola_id = p_escola_id;

  v_comp := coalesce(v_cfg,'[]'::jsonb);
  IF jsonb_typeof(v_comp) = 'object' THEN v_comp := v_comp->'componentes'; END IF;
  IF jsonb_typeof(v_comp) IS DISTINCT FROM 'array' THEN v_comp := '[]'::jsonb; END IF;

  IF jsonb_array_length(v_comp) = 0 THEN
    SELECT m.id INTO v_model_id
      FROM public.modelos_avaliacao m
      WHERE m.escola_id = p_escola_id AND m.curso_id = v_ctx.curso_id AND m.is_default
      ORDER BY m.updated_at DESC LIMIT 1;
    IF v_model_id IS NULL AND v_cfg_model IS NOT NULL THEN
      SELECT m.id INTO v_model_id
      FROM public.modelos_avaliacao m
      WHERE m.escola_id = p_escola_id
        AND (m.id::text = v_cfg_model OR m.nome = v_cfg_model)
      ORDER BY m.updated_at DESC LIMIT 1;
    END IF;
    IF v_model_id IS NULL THEN
      SELECT m.id INTO v_model_id
      FROM public.modelos_avaliacao m
      WHERE m.escola_id = p_escola_id AND m.curso_id IS NULL AND m.is_default
      ORDER BY m.updated_at DESC LIMIT 1;
    END IF;
  END IF;

  IF v_ctx.avaliacao_mode = 'custom' AND v_ctx.avaliacao_modelo_id IS NOT NULL THEN
    SELECT m.id INTO v_override_id FROM public.modelos_avaliacao m
      WHERE m.id = v_ctx.avaliacao_modelo_id AND m.escola_id = p_escola_id;
  ELSIF v_ctx.avaliacao_mode = 'inherit_disciplina'
        AND v_ctx.avaliacao_disciplina_id IS NOT NULL THEN
    SELECT cm.avaliacao_modelo_id INTO v_override_id
    FROM public.curso_matriz cm
    WHERE cm.escola_id = p_escola_id AND cm.curso_id = v_ctx.curso_id
      AND cm.classe_id = v_ctx.classe_id
      AND cm.disciplina_id = v_ctx.avaliacao_disciplina_id AND cm.ativo
    LIMIT 1;
    IF NOT EXISTS (
      SELECT 1 FROM public.modelos_avaliacao m
      WHERE m.id = v_override_id AND m.escola_id = p_escola_id
    ) THEN v_override_id := NULL; END IF;
  END IF;

  IF v_override_id IS NOT NULL THEN v_model_id := v_override_id; END IF;

  IF v_model_id IS NOT NULL THEN
    SELECT m.componentes, m.formula, m.tipo INTO v_model_components,v_formula,v_model_type
    FROM public.modelos_avaliacao m WHERE m.id = v_model_id AND m.escola_id = p_escola_id;
    IF v_model_type <> 'trimestral' THEN
      RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='O modelo académico não é trimestral.';
    END IF;
    v_comp := CASE
      WHEN jsonb_typeof(v_formula->'componentes') = 'array' THEN v_formula->'componentes'
      WHEN jsonb_typeof(v_formula->'components') = 'array' THEN v_formula->'components'
      WHEN jsonb_typeof(v_model_components) = 'array' THEN v_model_components
      WHEN jsonb_typeof(v_model_components->'componentes') = 'array' THEN v_model_components->'componentes'
      ELSE '[]'::jsonb
    END;
  END IF;

  SELECT array_agg(DISTINCT upper(trim(e->>'code')))
  INTO v_required
  FROM jsonb_array_elements(v_comp) e
  WHERE nullif(trim(e->>'code'),'') IS NOT NULL
    AND coalesce(e->>'ativo','true') <> 'false';

  IF coalesce(array_length(v_required,1),0) = 0 THEN
    RAISE EXCEPTION USING ERRCODE='P0001',
      MESSAGE='Configure os componentes da avaliação antes de concluir a pauta.';
  END IF;

  SELECT count(*)::integer INTO v_total
  FROM public.matriculas m
  WHERE m.escola_id = p_escola_id AND m.turma_id = v_ctx.turma_id
    AND m.session_id = v_ano_id AND m.ativo IS TRUE;
  IF v_total = 0 THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='A turma não possui matrículas ativas.';
  END IF;

  SELECT count(*)::integer INTO v_missing
  FROM public.matriculas m
  CROSS JOIN unnest(v_required) required(tipo)
  WHERE m.escola_id = p_escola_id AND m.turma_id = v_ctx.turma_id
    AND m.session_id = v_ano_id AND m.ativo IS TRUE
    AND NOT EXISTS (
      SELECT 1 FROM public.notas n
      JOIN public.avaliacoes a ON a.id = n.avaliacao_id AND a.escola_id = p_escola_id
      WHERE n.escola_id = p_escola_id AND n.matricula_id = m.id
        AND a.turma_disciplina_id = p_turma_disciplina_id
        AND a.periodo_letivo_id = p_periodo_letivo_id
        AND a.trimestre = v_trimestre
        AND (upper(trim(a.tipo)) = required.tipo
          OR (required.tipo IN ('NPT','PT') AND upper(trim(a.tipo)) IN ('NPT','PT')))
        AND n.valor IS NOT NULL
    );
  IF v_missing > 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001',
      MESSAGE = format('Ainda faltam %s notas/componentes nesta pauta. Guarde-as antes de concluir.',v_missing);
  END IF;

  INSERT INTO public.pauta_conclusoes(
    escola_id,turma_disciplina_id,periodo_letivo_id,total_alunos,total_componentes,concluido_por
  ) VALUES (
    p_escola_id,p_turma_disciplina_id,p_periodo_letivo_id,v_total,array_length(v_required,1),v_uid
  )
  ON CONFLICT (escola_id,turma_disciplina_id,periodo_letivo_id) DO NOTHING
  RETURNING id INTO v_new_id;
  RETURN jsonb_build_object(
    'ok',true,'already_completed',v_new_id IS NULL,
    'total_alunos',v_total,'total_componentes',array_length(v_required,1)
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.concluir_pauta_trimestral(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.concluir_pauta_trimestral(uuid,uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.trg_pauta_concluida_evento_fn() FROM PUBLIC,anon,authenticated;
-- A SECURITY DEFINER handler must never be directly callable through the Data API.
REVOKE ALL ON FUNCTION public.trg_evento_notas_lancadas_fn(public.eventos) FROM PUBLIC,anon,authenticated;

COMMIT;
