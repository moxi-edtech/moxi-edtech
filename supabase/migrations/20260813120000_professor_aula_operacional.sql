-- Ciclo operacional da aula: o horário sugere, o professor confirma,
-- a chamada comprova e o relatório encerra a ocorrência.
ALTER TABLE public.aulas
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'agendada',
  ADD COLUMN IF NOT EXISTS slot_id uuid,
  ADD COLUMN IF NOT EXISTS professor_id uuid,
  ADD COLUMN IF NOT EXISTS inicio_previsto time,
  ADD COLUMN IF NOT EXISTS fim_previsto time,
  ADD COLUMN IF NOT EXISTS inicio_real timestamptz,
  ADD COLUMN IF NOT EXISTS fim_real timestamptz,
  ADD COLUMN IF NOT EXISTS finalizado_por uuid,
  ADD COLUMN IF NOT EXISTS resumo text,
  ADD COLUMN IF NOT EXISTS observacoes text;

ALTER TABLE public.aulas
  DROP CONSTRAINT IF EXISTS aulas_status_check;

ALTER TABLE public.aulas
  ADD CONSTRAINT aulas_status_check CHECK (
    status IN ('agendada', 'aguardando_confirmacao', 'em_andamento', 'finalizada', 'cancelada', 'nao_realizada')
  );

CREATE UNIQUE INDEX IF NOT EXISTS ux_aulas_operacionais_slot
  ON public.aulas (escola_id, turma_disciplina_id, data, slot_id)
  WHERE slot_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_aulas_operacionais_escola_data_status
  ON public.aulas (escola_id, data, status);

CREATE INDEX IF NOT EXISTS idx_aulas_operacionais_professor_data
  ON public.aulas (escola_id, professor_id, data);

CREATE TABLE IF NOT EXISTS public.aula_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  aula_id uuid NOT NULL REFERENCES public.aulas(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  actor_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aula_eventos_aula_created
  ON public.aula_eventos (escola_id, aula_id, created_at DESC);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.aulas;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.aula_eventos;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

ALTER TABLE public.aulas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aula_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS aulas_operacionais_select ON public.aulas;
CREATE POLICY aulas_operacionais_select ON public.aulas
  FOR SELECT TO authenticated
  USING (escola_id = public.current_tenant_escola_id());

DROP POLICY IF EXISTS aulas_operacionais_insert ON public.aulas;
CREATE POLICY aulas_operacionais_insert ON public.aulas
  FOR INSERT TO authenticated
  WITH CHECK (
    escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(escola_id, ARRAY['professor'::text, 'secretaria'::text, 'secretaria_financeiro'::text, 'admin_financeiro'::text, 'admin_secretaria'::text, 'admin_escola'::text, 'admin'::text, 'staff_admin'::text])
  );

DROP POLICY IF EXISTS aulas_operacionais_update ON public.aulas;
CREATE POLICY aulas_operacionais_update ON public.aulas
  FOR UPDATE TO authenticated
  USING (
    escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(escola_id, ARRAY['professor'::text, 'secretaria'::text, 'secretaria_financeiro'::text, 'admin_financeiro'::text, 'admin_secretaria'::text, 'admin_escola'::text, 'admin'::text, 'staff_admin'::text])
  )
  WITH CHECK (escola_id = public.current_tenant_escola_id());

DROP POLICY IF EXISTS aula_eventos_operacionais_select ON public.aula_eventos;
CREATE POLICY aula_eventos_operacionais_select ON public.aula_eventos
  FOR SELECT TO authenticated
  USING (escola_id = public.current_tenant_escola_id());

DROP POLICY IF EXISTS aula_eventos_operacionais_insert ON public.aula_eventos;
CREATE POLICY aula_eventos_operacionais_insert ON public.aula_eventos
  FOR INSERT TO authenticated
  WITH CHECK (
    escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(escola_id, ARRAY['professor'::text, 'secretaria'::text, 'secretaria_financeiro'::text, 'admin_financeiro'::text, 'admin_secretaria'::text, 'admin_escola'::text, 'admin'::text, 'staff_admin'::text])
  );

CREATE OR REPLACE FUNCTION public.professor_iniciar_aula(
  p_escola_id uuid,
  p_aula_id uuid,
  p_professor_id uuid,
  p_inicio_real timestamptz DEFAULT now()
)
RETURNS public.aulas
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_aula public.aulas;
BEGIN
  SELECT a.* INTO v_aula
  FROM public.aulas a
  WHERE a.id = p_aula_id
    AND a.escola_id = p_escola_id
  FOR UPDATE;

  IF v_aula.id IS NULL THEN
    RAISE EXCEPTION 'Aula não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  IF v_aula.professor_id IS DISTINCT FROM p_professor_id THEN
    RAISE EXCEPTION 'Professor não autorizado para esta aula.' USING ERRCODE = '42501';
  END IF;

  IF v_aula.status = 'em_andamento' THEN
    RETURN v_aula;
  END IF;

  IF v_aula.status NOT IN ('agendada', 'aguardando_confirmacao') THEN
    RAISE EXCEPTION 'Aula não pode ser iniciada no estado actual: %.', v_aula.status USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.aulas
  SET status = 'em_andamento',
      inicio_real = COALESCE(inicio_real, p_inicio_real),
      created_by = COALESCE(created_by, auth.uid())
  WHERE id = v_aula.id
  RETURNING * INTO v_aula;

  INSERT INTO public.aula_eventos (escola_id, aula_id, tipo, actor_id)
  VALUES (p_escola_id, v_aula.id, 'aula_iniciada', auth.uid());

  RETURN v_aula;
END;
$$;

CREATE OR REPLACE FUNCTION public.professor_iniciar_aula_contexto(
  p_escola_id uuid,
  p_professor_id uuid,
  p_turma_id uuid,
  p_disciplina_id uuid,
  p_data date,
  p_slot_id uuid DEFAULT NULL,
  p_inicio_previsto time DEFAULT NULL,
  p_fim_previsto time DEFAULT NULL
)
RETURNS public.aulas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_turma public.turmas;
  v_matriz_id uuid;
  v_turma_disciplina public.turma_disciplinas;
  v_aula public.aulas;
BEGIN
  IF p_escola_id IS DISTINCT FROM public.current_tenant_escola_id() THEN
    RAISE EXCEPTION 'Escola inválida para o contexto actual.' USING ERRCODE = '42501';
  END IF;

  SELECT t.* INTO v_turma
  FROM public.turmas t
  WHERE t.id = p_turma_id AND t.escola_id = p_escola_id;
  IF v_turma.id IS NULL THEN
    RAISE EXCEPTION 'Turma não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  SELECT cm.id INTO v_matriz_id
  FROM public.curso_matriz cm
  WHERE cm.escola_id = p_escola_id
    AND cm.curso_id = v_turma.curso_id
    AND cm.classe_id = v_turma.classe_id
    AND cm.disciplina_id = p_disciplina_id
    AND cm.ativo = true
  LIMIT 1;
  IF v_matriz_id IS NULL THEN
    RAISE EXCEPTION 'Disciplina não pertence à turma.' USING ERRCODE = 'P0002';
  END IF;

  SELECT td.* INTO v_turma_disciplina
  FROM public.turma_disciplinas td
  WHERE td.escola_id = p_escola_id
    AND td.turma_id = p_turma_id
    AND td.curso_matriz_id = v_matriz_id
    AND (
      td.professor_id = p_professor_id
      OR EXISTS (
        SELECT 1 FROM public.turma_disciplinas_professores shared
        WHERE shared.escola_id = p_escola_id
          AND shared.turma_id = p_turma_id
          AND shared.disciplina_id = p_disciplina_id
          AND shared.professor_id = p_professor_id
      )
    )
  LIMIT 1;
  IF v_turma_disciplina.id IS NULL THEN
    RAISE EXCEPTION 'Professor não atribuído a esta disciplina.' USING ERRCODE = '42501';
  END IF;

  IF p_slot_id IS NOT NULL THEN
    SELECT a.* INTO v_aula FROM public.aulas a
    WHERE a.escola_id = p_escola_id AND a.turma_disciplina_id = v_turma_disciplina.id
      AND a.data = p_data AND a.slot_id = p_slot_id
    LIMIT 1;
  ELSE
    SELECT a.* INTO v_aula FROM public.aulas a
    WHERE a.escola_id = p_escola_id AND a.turma_disciplina_id = v_turma_disciplina.id
      AND a.data = p_data AND a.slot_id IS NULL
    LIMIT 1;
  END IF;

  IF v_aula.id IS NULL THEN
    INSERT INTO public.aulas (
      escola_id, turma_disciplina_id, data, slot_id, professor_id,
      inicio_previsto, fim_previsto, status, created_by
    ) VALUES (
      p_escola_id, v_turma_disciplina.id, p_data, p_slot_id, p_professor_id,
      p_inicio_previsto, p_fim_previsto, 'aguardando_confirmacao', auth.uid()
    ) RETURNING * INTO v_aula;
  END IF;

  RETURN public.professor_iniciar_aula(p_escola_id, v_aula.id, p_professor_id, now());
END;
$$;

CREATE OR REPLACE FUNCTION public.professor_finalizar_aula(
  p_escola_id uuid,
  p_aula_id uuid,
  p_professor_id uuid,
  p_resumo text DEFAULT NULL,
  p_observacoes text DEFAULT NULL,
  p_conteudo text DEFAULT NULL,
  p_fim_real timestamptz DEFAULT now()
)
RETURNS public.aulas
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_aula public.aulas;
BEGIN
  SELECT a.* INTO v_aula
  FROM public.aulas a
  WHERE a.id = p_aula_id
    AND a.escola_id = p_escola_id
  FOR UPDATE;

  IF v_aula.id IS NULL THEN
    RAISE EXCEPTION 'Aula não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  IF v_aula.professor_id IS DISTINCT FROM p_professor_id THEN
    RAISE EXCEPTION 'Professor não autorizado para esta aula.' USING ERRCODE = '42501';
  END IF;

  IF v_aula.status = 'finalizada' THEN
    RETURN v_aula;
  END IF;

  IF v_aula.status <> 'em_andamento' THEN
    RAISE EXCEPTION 'Aula só pode ser finalizada quando está em andamento.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.aulas
  SET status = 'finalizada',
      fim_real = COALESCE(fim_real, p_fim_real),
      resumo = COALESCE(p_resumo, resumo),
      observacoes = COALESCE(p_observacoes, observacoes),
      conteudo = COALESCE(p_conteudo, conteudo),
      finalizado_por = auth.uid()
  WHERE id = v_aula.id
  RETURNING * INTO v_aula;

  INSERT INTO public.aula_eventos (escola_id, aula_id, tipo, actor_id, metadata)
  VALUES (
    p_escola_id,
    v_aula.id,
    'aula_finalizada',
    auth.uid(),
    jsonb_build_object('resumo', p_resumo, 'observacoes', p_observacoes)
  );

  RETURN v_aula;
END;
$$;

GRANT EXECUTE ON FUNCTION public.professor_iniciar_aula(uuid, uuid, uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.professor_iniciar_aula_contexto(uuid, uuid, uuid, uuid, date, uuid, time, time) TO authenticated;
GRANT EXECUTE ON FUNCTION public.professor_finalizar_aula(uuid, uuid, uuid, text, text, text, timestamptz) TO authenticated;
