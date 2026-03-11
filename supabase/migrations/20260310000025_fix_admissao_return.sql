BEGIN;

CREATE OR REPLACE FUNCTION public.admissao_convert_to_matricula(
  p_escola_id uuid,
  p_candidatura_id uuid,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tenant uuid := public.current_tenant_escola_id();
  v_cand public.candidaturas%ROWTYPE;
  v_from text;
  v_to text := 'matriculado';
  v_matricula_id uuid;
  v_turma_id uuid;
  v_turma_raw text;
  v_aluno_id uuid;
  v_numero_matricula bigint;
BEGIN
  IF p_escola_id IS NULL OR p_escola_id <> v_tenant THEN
    RAISE EXCEPTION 'Acesso negado: escola inválida.';
  END IF;

  IF NOT public.user_has_role_in_school(p_escola_id, array['secretaria','admin','admin_escola','staff_admin','financeiro']) THEN
    RAISE EXCEPTION 'Acesso negado: permissões insuficientes.';
  END IF;

  SELECT * INTO v_cand
  FROM public.candidaturas
  WHERE id = p_candidatura_id AND escola_id = v_tenant
  FOR UPDATE;

  IF v_cand.status IS NULL THEN
    RAISE EXCEPTION 'Candidatura não encontrada.';
  END IF;

  v_from := v_cand.status;

  IF v_from = 'matriculado' THEN
    RETURN v_cand.matricula_id;
  END IF;

  IF v_from NOT IN ('aprovada', 'aguardando_pagamento') THEN
    RAISE EXCEPTION 'Transição inválida: % -> matriculado (requer aprovada)', v_from;
  END IF;

  IF v_from = 'aguardando_pagamento'
    AND NOT public.user_has_role_in_school(
      p_escola_id,
      array['financeiro','admin','admin_escola','staff_admin']
    ) THEN
    RAISE EXCEPTION 'Aguardando validação financeira.';
  END IF;

  v_turma_raw := nullif(p_metadata->>'turma_id', '');
  IF v_turma_raw IS NULL THEN
    v_turma_raw := nullif(v_cand.turma_preferencial_id::text, '');
  END IF;
  IF v_turma_raw IS NULL THEN
    v_turma_raw := nullif(v_cand.dados_candidato->>'turma_preferencial_id', '');
  END IF;
  BEGIN
    v_turma_id := v_turma_raw::uuid;
  EXCEPTION WHEN others THEN
    v_turma_id := NULL;
  END;
  IF v_turma_id IS NULL THEN
    RAISE EXCEPTION 'Turma inválida.';
  END IF;

  IF v_cand.aluno_id IS NOT NULL THEN
    v_aluno_id := v_cand.aluno_id;
  ELSE
    INSERT INTO public.alunos (
      escola_id,
      nome,
      bi_numero,
      telefone_responsavel,
      email,
      status,
      created_at
    ) VALUES (
      v_cand.escola_id,
      coalesce(v_cand.nome_candidato, v_cand.dados_candidato->>'nome_candidato'),
      v_cand.dados_candidato->>'bi_numero',
      v_cand.dados_candidato->>'telefone',
      v_cand.dados_candidato->>'email',
      'ativo',
      now()
    )
    RETURNING id INTO v_aluno_id;

    UPDATE public.candidaturas
    SET aluno_id = v_aluno_id
    WHERE id = p_candidatura_id;
  END IF;

  v_numero_matricula := public.confirmar_matricula_core(
    v_aluno_id,
    v_cand.ano_letivo,
    v_turma_id,
    NULL
  );

  IF v_numero_matricula IS NULL THEN
    RAISE EXCEPTION 'Falha ao gerar matrícula.';
  END IF;

  SELECT m.id
    INTO v_matricula_id
  FROM public.matriculas m
  WHERE m.aluno_id = v_aluno_id
    AND m.ano_letivo = v_cand.ano_letivo
    AND m.escola_id = p_escola_id
  ORDER BY (m.status IN ('ativo','pendente')) DESC, m.created_at DESC
  LIMIT 1;

  IF v_matricula_id IS NULL THEN
    RAISE EXCEPTION 'Falha ao localizar matrícula.';
  END IF;

  PERFORM set_config('app.rpc_internal', 'on', true);

  UPDATE public.candidaturas
  SET
    status = v_to,
    matricula_id = v_matricula_id,
    matriculado_em = now(),
    updated_at = now()
  WHERE id = p_candidatura_id;

  INSERT INTO public.candidaturas_status_log (
    escola_id, candidatura_id, from_status, to_status, metadata
  ) VALUES (
    p_escola_id, p_candidatura_id, v_from, v_to,
    jsonb_build_object('matricula_id', v_matricula_id, 'numero_matricula', v_numero_matricula) || coalesce(p_metadata, '{}'::jsonb)
  );

  PERFORM financeiro.gerar_carnet_anual(v_matricula_id);

  RETURN v_matricula_id;
END;
$$;

COMMIT;
