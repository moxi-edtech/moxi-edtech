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
  v_cand record;
  v_from text;
  v_to text := 'matriculado';
  v_matricula_id uuid;
  v_turma_id uuid := NULLIF(p_metadata->>'turma_id', '')::uuid;
  v_dados jsonb := '{}'::jsonb;
  v_nome text;
  v_email text;
  v_telefone text;
  v_bi text;
  v_data_nascimento date;
  v_sexo text;
  v_responsavel_nome text;
  v_responsavel_contato text;
  v_naturalidade text;
  v_provincia text;
  v_encarregado_relacao text;
  v_profile_id uuid;
BEGIN
  IF p_escola_id IS NULL OR p_escola_id <> v_tenant THEN
    RAISE EXCEPTION 'Acesso negado: escola inválida.';
  END IF;

  IF NOT public.user_has_role_in_school(p_escola_id, array['secretaria','admin','admin_escola','staff_admin','financeiro']) THEN
    RAISE EXCEPTION 'Acesso negado: permissões insuficientes.';
  END IF;

  SELECT status, matricula_id, escola_id, aluno_id, ano_letivo, nome_candidato, dados_candidato INTO v_cand
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

  v_matricula_id := public.confirmar_matricula_core(
    v_cand.aluno_id,
    v_cand.ano_letivo,
    v_turma_id,
    NULL
  );

  IF v_matricula_id IS NULL THEN
    RAISE EXCEPTION 'Falha ao gerar matrícula.';
  END IF;

  v_dados := COALESCE(v_cand.dados_candidato, '{}'::jsonb);
  v_nome := COALESCE(
    NULLIF(v_cand.nome_candidato, ''),
    NULLIF(v_dados->>'nome_completo', ''),
    NULLIF(v_dados->>'nome', '')
  );
  v_email := NULLIF(v_dados->>'email', '');
  v_telefone := NULLIF(v_dados->>'telefone', '');
  v_bi := NULLIF(v_dados->>'bi_numero', '');
  v_data_nascimento := NULLIF(v_dados->>'data_nascimento', '')::date;
  v_sexo := NULLIF(v_dados->>'sexo', '');
  v_responsavel_nome := NULLIF(v_dados->>'responsavel_nome', '');
  v_responsavel_contato := NULLIF(v_dados->>'responsavel_contato', '');
  v_naturalidade := NULLIF(v_dados->>'naturalidade', '');
  v_provincia := NULLIF(v_dados->>'provincia', '');
  v_encarregado_relacao := NULLIF(v_dados->>'encarregado_relacao', '');

  UPDATE public.alunos
  SET
    nome = COALESCE(nome, v_nome),
    email = COALESCE(email, v_email),
    telefone = COALESCE(telefone, v_telefone),
    bi_numero = COALESCE(bi_numero, v_bi),
    data_nascimento = COALESCE(data_nascimento, v_data_nascimento),
    sexo = COALESCE(sexo, v_sexo),
    naturalidade = COALESCE(naturalidade, v_naturalidade),
    responsavel = COALESCE(responsavel, v_responsavel_nome),
    responsavel_nome = COALESCE(responsavel_nome, v_responsavel_nome),
    responsavel_contato = COALESCE(responsavel_contato, v_responsavel_contato),
    telefone_responsavel = COALESCE(telefone_responsavel, v_responsavel_contato),
    encarregado_nome = COALESCE(encarregado_nome, v_responsavel_nome),
    encarregado_telefone = COALESCE(encarregado_telefone, v_responsavel_contato)
  WHERE id = v_cand.aluno_id;

  SELECT profile_id INTO v_profile_id
  FROM public.alunos
  WHERE id = v_cand.aluno_id;

  IF v_profile_id IS NOT NULL THEN
    UPDATE public.profiles
    SET
      nome = COALESCE(nome, v_nome),
      email = COALESCE(email, v_email),
      telefone = COALESCE(telefone, v_telefone),
      data_nascimento = COALESCE(data_nascimento, v_data_nascimento),
      sexo = COALESCE(sexo, v_sexo),
      bi_numero = COALESCE(bi_numero, v_bi),
      naturalidade = COALESCE(naturalidade, v_naturalidade),
      provincia = COALESCE(provincia, v_provincia),
      encarregado_relacao = COALESCE(encarregado_relacao, v_encarregado_relacao)
    WHERE user_id = v_profile_id;
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
    jsonb_build_object('matricula_id', v_matricula_id) || coalesce(p_metadata, '{}'::jsonb)
  );

  PERFORM financeiro.gerar_carnet_anual(v_matricula_id);

  RETURN v_matricula_id;
END;
$$;

COMMIT;
