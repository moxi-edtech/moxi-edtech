BEGIN;

CREATE TABLE IF NOT EXISTS public.rematricula_janelas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  ano_letivo integer NOT NULL,
  data_inicio timestamptz NOT NULL,
  data_fim timestamptz NOT NULL,
  ativa boolean NOT NULL DEFAULT false,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT public.safe_auth_uid(),
  updated_by uuid DEFAULT public.safe_auth_uid(),
  CONSTRAINT rematricula_janelas_periodo_check CHECK (data_fim > data_inicio),
  CONSTRAINT rematricula_janelas_ano_check CHECK (ano_letivo BETWEEN 2000 AND 2100),
  CONSTRAINT rematricula_janelas_ano_fk
    FOREIGN KEY (escola_id, ano_letivo)
    REFERENCES public.anos_letivos(escola_id, ano)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rematricula_janelas_escola_periodo
  ON public.rematricula_janelas (escola_id, ativa, ano_letivo, data_inicio, data_fim);

CREATE UNIQUE INDEX IF NOT EXISTS ux_rematricula_janelas_ativa_escola_ano
  ON public.rematricula_janelas (escola_id, ano_letivo)
  WHERE ativa = true;

ALTER TABLE public.rematricula_janelas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rematricula_janelas_select_tenant ON public.rematricula_janelas;
CREATE POLICY rematricula_janelas_select_tenant
  ON public.rematricula_janelas
  FOR SELECT
  TO authenticated
  USING (escola_id = public.current_tenant_escola_id() OR public.is_super_admin());

DROP POLICY IF EXISTS rematricula_janelas_insert_staff ON public.rematricula_janelas;
CREATE POLICY rematricula_janelas_insert_staff
  ON public.rematricula_janelas
  FOR INSERT
  TO authenticated
  WITH CHECK (
    escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(
      escola_id,
      ARRAY['admin','admin_escola','staff_admin','secretaria','diretor']::text[]
    )
  );

DROP POLICY IF EXISTS rematricula_janelas_update_staff ON public.rematricula_janelas;
CREATE POLICY rematricula_janelas_update_staff
  ON public.rematricula_janelas
  FOR UPDATE
  TO authenticated
  USING (
    escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(
      escola_id,
      ARRAY['admin','admin_escola','staff_admin','secretaria','diretor']::text[]
    )
  )
  WITH CHECK (
    escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(
      escola_id,
      ARRAY['admin','admin_escola','staff_admin','secretaria','diretor']::text[]
    )
  );

DROP POLICY IF EXISTS rematricula_janelas_delete_staff ON public.rematricula_janelas;
CREATE POLICY rematricula_janelas_delete_staff
  ON public.rematricula_janelas
  FOR DELETE
  TO authenticated
  USING (
    escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(
      escola_id,
      ARRAY['admin','admin_escola','staff_admin','secretaria','diretor']::text[]
    )
  );

CREATE OR REPLACE FUNCTION public.aluno_confirmar_rematricula(
  p_matricula_id uuid
)
RETURNS TABLE (
  candidatura_id uuid,
  next_ano integer,
  reused boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public.safe_auth_uid();
  v_escola_id uuid := public.current_tenant_escola_id();
  v_mat record;
  v_aluno record;
  v_next_ano integer;
  v_candidatura_id uuid;
BEGIN
  IF v_uid IS NULL OR v_escola_id IS NULL THEN
    RAISE EXCEPTION 'AUTH: não autenticado';
  END IF;

  SELECT
    m.id,
    m.escola_id,
    m.aluno_id,
    m.ano_letivo,
    t.curso_id
  INTO v_mat
  FROM public.matriculas m
  JOIN public.turmas t
    ON t.id = m.turma_id
   AND t.escola_id = m.escola_id
  WHERE m.id = p_matricula_id
    AND m.escola_id = v_escola_id
    AND m.status IN ('ativo', 'ativa', 'active')
  FOR UPDATE OF m;

  IF v_mat.id IS NULL THEN
    RAISE EXCEPTION 'DATA: matrícula atual não encontrada';
  END IF;

  SELECT
    a.nome,
    a.bi_numero,
    a.telefone,
    a.responsavel_nome,
    a.responsavel_contato
  INTO v_aluno
  FROM public.alunos a
  WHERE a.id = v_mat.aluno_id
    AND a.escola_id = v_escola_id
    AND (a.profile_id = v_uid OR a.usuario_auth_id = v_uid);

  IF v_aluno.nome IS NULL THEN
    RAISE EXCEPTION 'AUTH: aluno não autorizado';
  END IF;

  SELECT rj.ano_letivo
  INTO v_next_ano
  FROM public.rematricula_janelas rj
  JOIN public.anos_letivos al
    ON al.escola_id = rj.escola_id
   AND al.ano = rj.ano_letivo
  WHERE rj.escola_id = v_escola_id
    AND rj.ativa = true
    AND rj.ano_letivo > v_mat.ano_letivo
    AND now() >= rj.data_inicio
    AND now() <= rj.data_fim
  ORDER BY rj.ano_letivo ASC, rj.data_inicio DESC
  LIMIT 1;

  IF v_next_ano IS NULL THEN
    RAISE EXCEPTION 'DATA: período de rematrícula não está aberto';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(v_escola_id::text || ':' || v_mat.aluno_id::text || ':' || v_next_ano::text, 0)
  );

  IF EXISTS (
    SELECT 1
    FROM public.mensalidades men
    WHERE men.escola_id = v_escola_id
      AND men.aluno_id = v_mat.aluno_id
      AND men.status IN ('pendente', 'atrasado')
  ) THEN
    RAISE EXCEPTION 'FINANCEIRO: possui pendências financeiras';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.matriculas m
    WHERE m.escola_id = v_escola_id
      AND m.aluno_id = v_mat.aluno_id
      AND m.ano_letivo = v_next_ano
  ) THEN
    RAISE EXCEPTION 'CONFLICT: rematrícula já efetivada';
  END IF;

  SELECT c.id
  INTO v_candidatura_id
  FROM public.candidaturas c
  WHERE c.escola_id = v_escola_id
    AND c.aluno_id = v_mat.aluno_id
    AND c.ano_letivo = v_next_ano
    AND c.source = 'PORTAL_ALUNO_REMATRICULA'
    AND c.status <> 'rejeitada'
  ORDER BY c.created_at DESC
  LIMIT 1;

  IF v_candidatura_id IS NOT NULL THEN
    candidatura_id := v_candidatura_id;
    next_ano := v_next_ano;
    reused := true;
    RETURN NEXT;
    RETURN;
  END IF;

  INSERT INTO public.candidaturas (
    escola_id,
    aluno_id,
    curso_id,
    ano_letivo,
    status,
    nome_candidato,
    source,
    dados_candidato
  )
  VALUES (
    v_escola_id,
    v_mat.aluno_id,
    v_mat.curso_id,
    v_next_ano,
    'submetida',
    v_aluno.nome,
    'PORTAL_ALUNO_REMATRICULA',
    jsonb_build_object(
      'nome_completo', v_aluno.nome,
      'bi_numero', v_aluno.bi_numero,
      'telefone', v_aluno.telefone,
      'responsavel_nome', v_aluno.responsavel_nome,
      'responsavel_contato', v_aluno.responsavel_contato,
      'tipo', 'rematricula',
      'matricula_origem_id', v_mat.id
    )
  )
  RETURNING id INTO v_candidatura_id;

  INSERT INTO public.candidaturas_status_log (
    escola_id,
    candidatura_id,
    from_status,
    to_status,
    actor_user_id,
    motivo,
    metadata
  )
  VALUES (
    v_escola_id,
    v_candidatura_id,
    NULL,
    'submetida',
    v_uid,
    'Rematrícula solicitada pelo portal do aluno',
    jsonb_build_object('aluno_id', v_mat.aluno_id, 'next_ano', v_next_ano)
  );

  INSERT INTO public.audit_logs (
    escola_id,
    user_id,
    action,
    entity,
    entity_id,
    portal,
    details
  )
  VALUES (
    v_escola_id,
    v_uid,
    'REMATRICULA_SOLICITADA_PORTAL',
    'candidaturas',
    v_candidatura_id::text,
    'aluno',
    jsonb_build_object('aluno_id', v_mat.aluno_id, 'next_ano', v_next_ano)
  );

  candidatura_id := v_candidatura_id;
  next_ano := v_next_ano;
  reused := false;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.aluno_confirmar_rematricula(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.aluno_confirmar_rematricula(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.aluno_confirmar_rematricula(uuid) TO authenticated;

COMMIT;
