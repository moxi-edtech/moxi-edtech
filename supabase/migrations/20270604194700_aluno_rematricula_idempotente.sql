BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS ux_candidaturas_portal_rematricula_aluno_ano
  ON public.candidaturas (escola_id, aluno_id, ano_letivo)
  WHERE aluno_id IS NOT NULL
    AND source = 'PORTAL_ALUNO_REMATRICULA'
    AND status <> 'rejeitada';

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

  SELECT al.ano
  INTO v_next_ano
  FROM public.anos_letivos al
  WHERE al.escola_id = v_escola_id
    AND al.ano > v_mat.ano_letivo
  ORDER BY al.ano ASC
  LIMIT 1;

  IF v_next_ano IS NULL THEN
    RAISE EXCEPTION 'DATA: próximo ano letivo não configurado';
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
