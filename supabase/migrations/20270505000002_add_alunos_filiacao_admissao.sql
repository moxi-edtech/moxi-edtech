BEGIN;

ALTER TABLE public.alunos
  ADD COLUMN IF NOT EXISTS pai_nome text,
  ADD COLUMN IF NOT EXISTS mae_nome text;

CREATE OR REPLACE FUNCTION public.admissao_upsert_draft(
  p_escola_id uuid,
  p_candidatura_id uuid DEFAULT NULL::uuid,
  p_source text DEFAULT 'walkin'::text,
  p_dados_candidato jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $$
DECLARE
  v_id uuid;
  v_tenant_escola_id uuid := public.current_tenant_escola_id();

  v_nome text := nullif(trim(p_dados_candidato->>'nome_candidato'), '');
  v_turno text := nullif(trim(p_dados_candidato->>'turno'), '');

  v_curso_id uuid := null;
  v_classe_id uuid := null;
  v_turma_pref_id uuid := null;

  v_clean jsonb;
BEGIN
  IF p_escola_id IS NULL OR p_escola_id <> v_tenant_escola_id THEN
    RAISE EXCEPTION 'Acesso negado: escola inválida';
  END IF;

  BEGIN
    IF nullif(p_dados_candidato->>'curso_id', '') IS NOT NULL THEN
      v_curso_id := (p_dados_candidato->>'curso_id')::uuid;
    END IF;
    IF nullif(p_dados_candidato->>'classe_id', '') IS NOT NULL THEN
      v_classe_id := (p_dados_candidato->>'classe_id')::uuid;
    END IF;
    IF nullif(p_dados_candidato->>'turma_preferencial_id', '') IS NOT NULL THEN
      v_turma_pref_id := (p_dados_candidato->>'turma_preferencial_id')::uuid;
    END IF;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Payload inválido: UUID malformado';
  END;

  v_clean := jsonb_strip_nulls(jsonb_build_object(
    'nome_candidato', v_nome,
    'bi_numero', nullif(trim(p_dados_candidato->>'bi_numero'), ''),
    'tipo_documento', nullif(trim(p_dados_candidato->>'tipo_documento'), ''),
    'numero_documento', nullif(trim(p_dados_candidato->>'numero_documento'), ''),
    'telefone', nullif(trim(p_dados_candidato->>'telefone'), ''),
    'email', nullif(lower(trim(p_dados_candidato->>'email')), ''),
    'curso_id', v_curso_id,
    'classe_id', v_classe_id,
    'turma_preferencial_id', v_turma_pref_id,
    'turno', v_turno,
    'data_nascimento', nullif(trim(p_dados_candidato->>'data_nascimento'), ''),
    'sexo', nullif(trim(p_dados_candidato->>'sexo'), ''),
    'nif', nullif(trim(p_dados_candidato->>'nif'), ''),
    'endereco', nullif(trim(p_dados_candidato->>'endereco'), ''),
    'naturalidade', nullif(trim(p_dados_candidato->>'naturalidade'), ''),
    'provincia', nullif(trim(p_dados_candidato->>'provincia'), ''),
    'pai_nome', nullif(trim(p_dados_candidato->>'pai_nome'), ''),
    'mae_nome', nullif(trim(p_dados_candidato->>'mae_nome'), ''),
    'encarregado_relacao', nullif(trim(p_dados_candidato->>'encarregado_relacao'), ''),
    'responsavel_nome', nullif(trim(p_dados_candidato->>'responsavel_nome'), ''),
    'responsavel_contato', nullif(trim(p_dados_candidato->>'responsavel_contato'), ''),
    'encarregado_email', nullif(lower(trim(p_dados_candidato->>'encarregado_email')), ''),
    'responsavel_financeiro_nome', nullif(trim(p_dados_candidato->>'responsavel_financeiro_nome'), ''),
    'responsavel_financeiro_nif', nullif(trim(p_dados_candidato->>'responsavel_financeiro_nif'), ''),
    'mesmo_que_encarregado',
      CASE
        WHEN p_dados_candidato ? 'mesmo_que_encarregado'
          THEN (p_dados_candidato->>'mesmo_que_encarregado')::boolean
        ELSE null
      END
  ));

  IF p_candidatura_id IS NULL THEN
    INSERT INTO public.candidaturas (
      escola_id,
      status,
      ano_letivo,
      source,
      nome_candidato,
      curso_id,
      classe_id,
      turma_preferencial_id,
      turno,
      dados_candidato
    ) VALUES (
      p_escola_id,
      'rascunho',
      coalesce(extract(year from current_date)::int, null),
      coalesce(nullif(p_source, ''), 'walkin'),
      v_nome,
      v_curso_id,
      v_classe_id,
      v_turma_pref_id,
      v_turno,
      coalesce(v_clean, '{}'::jsonb)
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.candidaturas c
    SET
      source = coalesce(nullif(p_source, ''), c.source),
      nome_candidato = coalesce(v_nome, c.nome_candidato),
      curso_id = coalesce(v_curso_id, c.curso_id),
      classe_id = coalesce(v_classe_id, c.classe_id),
      turma_preferencial_id = coalesce(v_turma_pref_id, c.turma_preferencial_id),
      turno = coalesce(v_turno, c.turno),
      dados_candidato = coalesce(c.dados_candidato, '{}'::jsonb) || coalesce(v_clean, '{}'::jsonb)
    WHERE c.id = p_candidatura_id
      AND c.escola_id = v_tenant_escola_id
    RETURNING c.id INTO v_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Candidatura não encontrada ou acesso negado';
    END IF;
  END IF;

  RETURN v_id;
END;
$$;

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
  v_turma_id uuid;
  v_turma_raw text;
  v_aluno_id uuid;
  v_numero_matricula bigint;
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
  v_pai_nome text;
  v_mae_nome text;
  v_encarregado_relacao text;
  v_profile_id uuid;
BEGIN
  IF p_escola_id IS NULL OR p_escola_id <> v_tenant THEN
    RAISE EXCEPTION 'Acesso negado: escola inválida.';
  END IF;

  IF NOT public.user_has_role_in_school(p_escola_id, array['secretaria','admin','admin_escola','staff_admin','financeiro']) THEN
    RAISE EXCEPTION 'Acesso negado: permissões insuficientes.';
  END IF;

  SELECT status, matricula_id, escola_id, aluno_id, ano_letivo, nome_candidato, dados_candidato, turma_preferencial_id
  INTO v_cand
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

  v_aluno_id := v_cand.aluno_id;
  IF v_aluno_id IS NULL THEN
    v_dados := COALESCE(v_cand.dados_candidato, '{}'::jsonb);
    v_nome := COALESCE(NULLIF(v_cand.nome_candidato, ''), NULLIF(v_dados->>'nome_completo', ''), NULLIF(v_dados->>'nome', ''));
    v_email := NULLIF(v_dados->>'email', '');
    v_telefone := NULLIF(v_dados->>'telefone', '');
    v_bi := COALESCE(NULLIF(v_dados->>'bi_numero', ''), NULLIF(v_dados->>'numero_documento', ''));
    v_data_nascimento := NULLIF(v_dados->>'data_nascimento', '')::date;
    v_sexo := NULLIF(v_dados->>'sexo', '');
    v_responsavel_nome := NULLIF(v_dados->>'responsavel_nome', '');
    v_responsavel_contato := NULLIF(v_dados->>'responsavel_contato', '');
    v_naturalidade := NULLIF(v_dados->>'naturalidade', '');
    v_provincia := NULLIF(v_dados->>'provincia', '');
    v_pai_nome := NULLIF(v_dados->>'pai_nome', '');
    v_mae_nome := NULLIF(v_dados->>'mae_nome', '');
    v_encarregado_relacao := NULLIF(v_dados->>'encarregado_relacao', '');

    INSERT INTO public.alunos (
      escola_id,
      nome,
      bi_numero,
      telefone,
      email,
      data_nascimento,
      sexo,
      naturalidade,
      provincia,
      pai_nome,
      mae_nome,
      responsavel_nome,
      responsavel_contato,
      encarregado_relacao,
      status,
      created_at
    ) VALUES (
      v_cand.escola_id,
      v_nome,
      v_bi,
      v_telefone,
      v_email,
      v_data_nascimento,
      v_sexo,
      v_naturalidade,
      v_provincia,
      v_pai_nome,
      v_mae_nome,
      v_responsavel_nome,
      v_responsavel_contato,
      v_encarregado_relacao,
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

  v_dados := COALESCE(v_cand.dados_candidato, '{}'::jsonb);
  v_nome := COALESCE(NULLIF(v_cand.nome_candidato, ''), NULLIF(v_dados->>'nome_completo', ''), NULLIF(v_dados->>'nome', ''));
  v_email := NULLIF(v_dados->>'email', '');
  v_telefone := NULLIF(v_dados->>'telefone', '');
  v_bi := COALESCE(NULLIF(v_dados->>'bi_numero', ''), NULLIF(v_dados->>'numero_documento', ''));
  v_data_nascimento := NULLIF(v_dados->>'data_nascimento', '')::date;
  v_sexo := NULLIF(v_dados->>'sexo', '');
  v_responsavel_nome := NULLIF(v_dados->>'responsavel_nome', '');
  v_responsavel_contato := NULLIF(v_dados->>'responsavel_contato', '');
  v_naturalidade := NULLIF(v_dados->>'naturalidade', '');
  v_provincia := NULLIF(v_dados->>'provincia', '');
  v_pai_nome := NULLIF(v_dados->>'pai_nome', '');
  v_mae_nome := NULLIF(v_dados->>'mae_nome', '');
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
    provincia = COALESCE(provincia, v_provincia),
    pai_nome = COALESCE(pai_nome, v_pai_nome),
    mae_nome = COALESCE(mae_nome, v_mae_nome),
    responsavel = COALESCE(responsavel, v_responsavel_nome),
    responsavel_nome = COALESCE(responsavel_nome, v_responsavel_nome),
    responsavel_contato = COALESCE(responsavel_contato, v_responsavel_contato),
    telefone_responsavel = COALESCE(telefone_responsavel, v_responsavel_contato),
    encarregado_nome = COALESCE(encarregado_nome, v_responsavel_nome),
    encarregado_telefone = COALESCE(encarregado_telefone, v_responsavel_contato),
    encarregado_relacao = COALESCE(encarregado_relacao, v_encarregado_relacao)
  WHERE id = v_aluno_id;

  SELECT profile_id INTO v_profile_id
  FROM public.alunos
  WHERE id = v_aluno_id;

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
    jsonb_build_object('matricula_id', v_matricula_id, 'numero_matricula', v_numero_matricula) || coalesce(p_metadata, '{}'::jsonb)
  );

  PERFORM financeiro.gerar_carnet_anual(v_matricula_id);

  RETURN v_matricula_id;
END;
$$;

COMMIT;
