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
  v_tipo_documento text;
  v_numero_documento text;
  v_data_nascimento date;
  v_sexo text;
  v_responsavel_nome text;
  v_responsavel_contato text;
  v_naturalidade text;
  v_provincia text;
  v_pai_nome text;
  v_mae_nome text;
  v_nif text;
  v_endereco text;
  v_encarregado_email text;
  v_encarregado_relacao text;
  v_responsavel_financeiro_nome text;
  v_responsavel_financeiro_nif text;
  v_mesmo_que_encarregado boolean;
  v_documentos jsonb;
  v_campos_extras jsonb;
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
  WHERE id = p_candidatura_id
    AND escola_id = v_tenant
  FOR UPDATE;

  IF v_cand.status IS NULL THEN
    RAISE EXCEPTION 'Candidatura não encontrada.';
  END IF;

  v_from := v_cand.status;

  IF v_from = 'matriculado' THEN
    RETURN v_cand.matricula_id;
  END IF;

  IF v_from NOT IN ('aprovada', 'aguardando_pagamento', 'aguardando_compensacao') THEN
    RAISE EXCEPTION 'Transição inválida: % -> matriculado (requer aprovada)', v_from;
  END IF;

  IF v_from IN ('aguardando_pagamento', 'aguardando_compensacao')
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

  v_dados := coalesce(v_cand.dados_candidato, '{}'::jsonb);
  v_nome := coalesce(nullif(v_cand.nome_candidato, ''), nullif(v_dados->>'nome_completo', ''), nullif(v_dados->>'nome', ''), nullif(v_dados->>'nome_candidato', ''));
  v_email := nullif(v_dados->>'email', '');
  v_telefone := nullif(v_dados->>'telefone', '');
  v_bi := coalesce(nullif(v_dados->>'bi_numero', ''), nullif(v_dados->>'numero_documento', ''));
  v_tipo_documento := nullif(v_dados->>'tipo_documento', '');
  v_numero_documento := coalesce(nullif(v_dados->>'numero_documento', ''), nullif(v_dados->>'bi_numero', ''));
  v_data_nascimento := nullif(v_dados->>'data_nascimento', '')::date;
  v_sexo := nullif(v_dados->>'sexo', '');
  v_responsavel_nome := nullif(v_dados->>'responsavel_nome', '');
  v_responsavel_contato := nullif(v_dados->>'responsavel_contato', '');
  v_naturalidade := nullif(v_dados->>'naturalidade', '');
  v_provincia := nullif(v_dados->>'provincia', '');
  v_pai_nome := nullif(v_dados->>'pai_nome', '');
  v_mae_nome := nullif(v_dados->>'mae_nome', '');
  v_nif := nullif(v_dados->>'nif', '');
  v_endereco := nullif(v_dados->>'endereco', '');
  v_encarregado_email := nullif(v_dados->>'encarregado_email', '');
  v_encarregado_relacao := nullif(v_dados->>'encarregado_relacao', '');
  v_responsavel_financeiro_nome := nullif(v_dados->>'responsavel_financeiro_nome', '');
  v_responsavel_financeiro_nif := nullif(v_dados->>'responsavel_financeiro_nif', '');
  v_mesmo_que_encarregado :=
    CASE
      WHEN v_dados ? 'mesmo_que_encarregado' THEN (v_dados->>'mesmo_que_encarregado')::boolean
      ELSE NULL
    END;
  v_documentos :=
    CASE
      WHEN jsonb_typeof(v_dados->'documentos') = 'object' THEN v_dados->'documentos'
      ELSE NULL
    END;
  v_campos_extras :=
    CASE
      WHEN jsonb_typeof(v_dados->'campos_extras') = 'object' THEN v_dados->'campos_extras'
      ELSE NULL
    END;

  v_aluno_id := v_cand.aluno_id;
  IF v_aluno_id IS NULL THEN
    SELECT a.id
    INTO v_aluno_id
    FROM public.alunos a
    WHERE a.escola_id = v_cand.escola_id
      AND (
        (v_bi IS NOT NULL AND a.bi_numero = v_bi)
        OR (v_numero_documento IS NOT NULL AND a.numero_documento = v_numero_documento)
      )
    ORDER BY a.created_at DESC NULLS LAST
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF v_aluno_id IS NULL THEN
    BEGIN
      INSERT INTO public.alunos (
        escola_id,
        nome,
        bi_numero,
        tipo_documento,
        numero_documento,
        telefone,
        email,
        data_nascimento,
        sexo,
        naturalidade,
        provincia,
        pai_nome,
        mae_nome,
        nif,
        endereco,
        responsavel_nome,
        responsavel_contato,
        telefone_responsavel,
        encarregado_nome,
        encarregado_telefone,
        encarregado_email,
        encarregado_relacao,
        responsavel_financeiro_nome,
        responsavel_financeiro_nif,
        mesmo_que_encarregado,
        documentos,
        campos_extras,
        status,
        created_at
      ) VALUES (
        v_cand.escola_id,
        v_nome,
        v_bi,
        v_tipo_documento,
        v_numero_documento,
        v_telefone,
        v_email,
        v_data_nascimento,
        v_sexo,
        v_naturalidade,
        v_provincia,
        v_pai_nome,
        v_mae_nome,
        v_nif,
        v_endereco,
        v_responsavel_nome,
        v_responsavel_contato,
        v_responsavel_contato,
        v_responsavel_nome,
        v_responsavel_contato,
        v_encarregado_email,
        v_encarregado_relacao,
        v_responsavel_financeiro_nome,
        v_responsavel_financeiro_nif,
        v_mesmo_que_encarregado,
        coalesce(v_documentos, '{}'::jsonb),
        coalesce(v_campos_extras, '{}'::jsonb),
        'ativo',
        now()
      )
      RETURNING id INTO v_aluno_id;
    EXCEPTION WHEN unique_violation THEN
      SELECT a.id
      INTO v_aluno_id
      FROM public.alunos a
      WHERE a.escola_id = v_cand.escola_id
        AND (
          (v_bi IS NOT NULL AND a.bi_numero = v_bi)
          OR (v_numero_documento IS NOT NULL AND a.numero_documento = v_numero_documento)
        )
      ORDER BY a.created_at DESC NULLS LAST
      LIMIT 1
      FOR UPDATE;

      IF v_aluno_id IS NULL THEN
        RAISE;
      END IF;
    END;
  END IF;

  UPDATE public.candidaturas
  SET aluno_id = v_aluno_id
  WHERE id = p_candidatura_id
    AND escola_id = v_tenant
    AND aluno_id IS DISTINCT FROM v_aluno_id;

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

  UPDATE public.alunos
  SET
    nome = coalesce(nome, v_nome),
    email = coalesce(email, v_email),
    telefone = coalesce(telefone, v_telefone),
    bi_numero = coalesce(bi_numero, v_bi),
    tipo_documento = coalesce(tipo_documento, v_tipo_documento),
    numero_documento = coalesce(numero_documento, v_numero_documento),
    data_nascimento = coalesce(data_nascimento, v_data_nascimento),
    sexo = coalesce(sexo, v_sexo),
    naturalidade = coalesce(naturalidade, v_naturalidade),
    provincia = coalesce(provincia, v_provincia),
    pai_nome = coalesce(pai_nome, v_pai_nome),
    mae_nome = coalesce(mae_nome, v_mae_nome),
    nif = coalesce(nif, v_nif),
    endereco = coalesce(endereco, v_endereco),
    responsavel = coalesce(responsavel, v_responsavel_nome),
    responsavel_nome = coalesce(responsavel_nome, v_responsavel_nome),
    responsavel_contato = coalesce(responsavel_contato, v_responsavel_contato),
    telefone_responsavel = coalesce(telefone_responsavel, v_responsavel_contato),
    encarregado_nome = coalesce(encarregado_nome, v_responsavel_nome),
    encarregado_telefone = coalesce(encarregado_telefone, v_responsavel_contato),
    encarregado_email = coalesce(encarregado_email, v_encarregado_email),
    encarregado_relacao = coalesce(encarregado_relacao, v_encarregado_relacao),
    responsavel_financeiro_nome = coalesce(responsavel_financeiro_nome, v_responsavel_financeiro_nome),
    responsavel_financeiro_nif = coalesce(responsavel_financeiro_nif, v_responsavel_financeiro_nif),
    mesmo_que_encarregado = coalesce(mesmo_que_encarregado, v_mesmo_que_encarregado),
    documentos =
      CASE
        WHEN documentos IS NULL OR documentos = '{}'::jsonb THEN coalesce(v_documentos, documentos, '{}'::jsonb)
        ELSE documentos
      END,
    campos_extras =
      CASE
        WHEN campos_extras IS NULL OR campos_extras = '{}'::jsonb THEN coalesce(v_campos_extras, campos_extras, '{}'::jsonb)
        ELSE campos_extras
      END
  WHERE id = v_aluno_id
    AND escola_id = v_tenant;

  SELECT profile_id
  INTO v_profile_id
  FROM public.alunos
  WHERE id = v_aluno_id
    AND escola_id = v_tenant;

  IF v_profile_id IS NOT NULL THEN
    UPDATE public.profiles
    SET
      nome = coalesce(nome, v_nome),
      email = coalesce(email, v_email),
      telefone = coalesce(telefone, v_telefone),
      data_nascimento = coalesce(data_nascimento, v_data_nascimento),
      sexo = coalesce(sexo, v_sexo),
      bi_numero = coalesce(bi_numero, v_bi),
      naturalidade = coalesce(naturalidade, v_naturalidade),
      provincia = coalesce(provincia, v_provincia),
      encarregado_relacao = coalesce(encarregado_relacao, v_encarregado_relacao)
    WHERE user_id = v_profile_id;
  END IF;

  PERFORM set_config('app.rpc_internal', 'on', true);

  UPDATE public.candidaturas
  SET
    status = v_to,
    matricula_id = v_matricula_id,
    matriculado_em = now(),
    updated_at = now()
  WHERE id = p_candidatura_id
    AND escola_id = v_tenant;

  INSERT INTO public.candidaturas_status_log (
    escola_id,
    candidatura_id,
    from_status,
    to_status,
    metadata
  ) VALUES (
    p_escola_id,
    p_candidatura_id,
    v_from,
    v_to,
    jsonb_build_object(
      'matricula_id', v_matricula_id,
      'numero_matricula', v_numero_matricula,
      'aluno_id', v_aluno_id
    ) || coalesce(p_metadata, '{}'::jsonb)
  );

  PERFORM financeiro.gerar_carnet_anual(v_matricula_id);

  RETURN v_matricula_id;
END;
$$;

COMMIT;
