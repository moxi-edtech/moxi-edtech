-- Consolidated fix: keep candidatura status guarded, but let official RPCs
-- perform validated state transitions.
BEGIN;

CREATE OR REPLACE FUNCTION public._guard_candidaturas_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rpc_internal text;
  v_is_super_admin boolean := false;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    BEGIN
      v_rpc_internal := current_setting('app.rpc_internal', true);
    EXCEPTION WHEN others THEN
      v_rpc_internal := 'off';
    END;

    IF coalesce(v_rpc_internal, 'off') = 'on' THEN
      RETURN NEW;
    END IF;

    BEGIN
      v_is_super_admin := public.check_super_admin_role();
    EXCEPTION WHEN others THEN
      v_is_super_admin := false;
    END;

    IF v_is_super_admin THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION
      'Mudança de status da candidatura permitida apenas via RPCs oficiais. (status: % -> %)',
      coalesce(OLD.status, 'NULL'),
      coalesce(NEW.status, 'NULL')
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.admissao_submit(
  p_escola_id uuid,
  p_candidatura_id uuid,
  p_source text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $$
DECLARE
  v_tenant_escola_id uuid := public.current_tenant_escola_id();
  v_cand record;
  v_turma record;
  v_classe record;
BEGIN
  IF p_escola_id IS NULL OR p_escola_id <> v_tenant_escola_id THEN
    RAISE EXCEPTION 'Acesso negado: escola inválida';
  END IF;

  IF p_candidatura_id IS NULL THEN
    RAISE EXCEPTION 'p_candidatura_id é obrigatório';
  END IF;

  SELECT
    c.status,
    c.curso_id,
    c.ano_letivo,
    c.classe_id,
    c.turma_preferencial_id,
    c.source
  INTO v_cand
  FROM public.candidaturas c
  WHERE c.id = p_candidatura_id
    AND c.escola_id = v_tenant_escola_id
  FOR UPDATE;

  IF v_cand.status IS NULL THEN
    RAISE EXCEPTION 'Candidatura não encontrada ou acesso negado';
  END IF;

  IF v_cand.status = 'submetida' THEN
    RETURN p_candidatura_id;
  END IF;

  IF v_cand.status <> 'rascunho' THEN
    RAISE EXCEPTION 'Transição inválida: status atual = %', v_cand.status;
  END IF;

  IF v_cand.curso_id IS NULL THEN
    RAISE EXCEPTION 'Não é possível submeter: curso_id obrigatório';
  END IF;

  IF v_cand.ano_letivo IS NULL THEN
    RAISE EXCEPTION 'Não é possível submeter: ano_letivo obrigatório';
  END IF;

  IF v_cand.classe_id IS NOT NULL THEN
    SELECT cl.escola_id, cl.curso_id
    INTO v_classe
    FROM public.classes cl
    WHERE cl.id = v_cand.classe_id;

    IF v_classe.escola_id <> v_tenant_escola_id THEN
      RAISE EXCEPTION 'Classe inválida para esta escola';
    END IF;

    IF v_classe.curso_id IS NOT NULL AND v_classe.curso_id <> v_cand.curso_id THEN
      RAISE EXCEPTION 'Incoerência: Classe não pertence ao curso selecionado';
    END IF;
  END IF;

  IF v_cand.turma_preferencial_id IS NOT NULL THEN
    SELECT t.escola_id, t.curso_id, t.classe_id, t.ano_letivo
    INTO v_turma
    FROM public.turmas t
    WHERE t.id = v_cand.turma_preferencial_id;

    IF v_turma.escola_id <> v_tenant_escola_id THEN
      RAISE EXCEPTION 'Turma preferencial inválida para esta escola';
    END IF;

    IF v_turma.curso_id <> v_cand.curso_id THEN
      RAISE EXCEPTION 'Incoerência: Turma preferencial pertence a outro curso';
    END IF;

    IF v_cand.classe_id IS NOT NULL AND v_turma.classe_id <> v_cand.classe_id THEN
      RAISE EXCEPTION 'Incoerência: Turma preferencial pertence a outra classe';
    END IF;

    IF v_turma.ano_letivo <> v_cand.ano_letivo THEN
      RAISE EXCEPTION 'Incoerência: Turma preferencial pertence a outro ano letivo';
    END IF;
  END IF;

  PERFORM set_config('app.rpc_internal', 'on', true);

  UPDATE public.candidaturas c
  SET
    status = 'submetida',
    source = coalesce(nullif(p_source, ''), v_cand.source, 'walkin'),
    updated_at = now()
  WHERE c.id = p_candidatura_id
    AND c.escola_id = v_tenant_escola_id;

  RETURN p_candidatura_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admissao_approve(
  p_escola_id uuid,
  p_candidatura_id uuid,
  p_observacao text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tenant uuid := public.current_tenant_escola_id();
  v_cand record;
  v_turma record;
  v_classe record;
  v_target_status text;
  v_has_pagamento boolean := false;
BEGIN
  IF p_escola_id IS NULL OR p_escola_id <> v_tenant THEN
    RAISE EXCEPTION 'Acesso negado: escola inválida';
  END IF;

  IF NOT public.user_has_role_in_school(p_escola_id, array['secretaria','admin','admin_escola','staff_admin']) THEN
    RAISE EXCEPTION 'Acesso negado: permissões insuficientes';
  END IF;

  SELECT *
  INTO v_cand
  FROM public.candidaturas
  WHERE id = p_candidatura_id
    AND escola_id = v_tenant
  FOR UPDATE;

  IF v_cand.status IS NULL THEN
    RAISE EXCEPTION 'Candidatura não encontrada ou acesso negado';
  END IF;

  IF v_cand.status IN ('aprovada', 'aguardando_pagamento') THEN
    RETURN p_candidatura_id;
  END IF;

  IF v_cand.status NOT IN ('submetida', 'em_analise', 'pendente') THEN
    RAISE EXCEPTION 'Transição inválida: status atual = %', v_cand.status;
  END IF;

  IF v_cand.curso_id IS NULL OR v_cand.ano_letivo IS NULL THEN
    RAISE EXCEPTION 'Candidatura incompleta para aprovação';
  END IF;

  IF v_cand.classe_id IS NOT NULL THEN
    SELECT cl.escola_id, cl.curso_id
    INTO v_classe
    FROM public.classes cl
    WHERE cl.id = v_cand.classe_id;

    IF v_classe.escola_id <> v_tenant THEN
      RAISE EXCEPTION 'Classe inválida para esta escola';
    END IF;

    IF v_classe.curso_id IS NOT NULL AND v_classe.curso_id <> v_cand.curso_id THEN
      RAISE EXCEPTION 'Incoerência: Classe não pertence ao curso selecionado';
    END IF;
  END IF;

  IF v_cand.turma_preferencial_id IS NOT NULL THEN
    SELECT t.escola_id, t.curso_id, t.classe_id, t.ano_letivo
    INTO v_turma
    FROM public.turmas t
    WHERE t.id = v_cand.turma_preferencial_id;

    IF v_turma.escola_id <> v_tenant THEN
      RAISE EXCEPTION 'Turma preferencial inválida para esta escola';
    END IF;

    IF v_turma.curso_id <> v_cand.curso_id THEN
      RAISE EXCEPTION 'Incoerência: Turma preferencial pertence a outro curso';
    END IF;

    IF v_cand.classe_id IS NOT NULL AND v_turma.classe_id <> v_cand.classe_id THEN
      RAISE EXCEPTION 'Incoerência: Turma preferencial pertence a outra classe';
    END IF;

    IF v_turma.ano_letivo <> v_cand.ano_letivo THEN
      RAISE EXCEPTION 'Incoerência: Turma preferencial pertence a outro ano letivo';
    END IF;
  END IF;

  v_has_pagamento :=
    nullif(trim(coalesce(v_cand.dados_candidato->'pagamento'->>'metodo', '')), '') IS NOT NULL
    OR nullif(trim(coalesce(v_cand.dados_candidato->'pagamento'->>'comprovativo_url', '')), '') IS NOT NULL
    OR nullif(trim(coalesce(v_cand.dados_candidato->'pagamento'->>'referencia', '')), '') IS NOT NULL
    OR nullif(trim(coalesce(v_cand.dados_candidato->'pagamento'->>'amount', '')), '') IS NOT NULL;

  v_target_status := CASE WHEN v_has_pagamento THEN 'aguardando_pagamento' ELSE 'aprovada' END;

  INSERT INTO public.candidaturas_status_log (
    escola_id,
    candidatura_id,
    from_status,
    to_status,
    motivo
  ) VALUES (
    p_escola_id,
    p_candidatura_id,
    v_cand.status,
    v_target_status,
    p_observacao
  );

  PERFORM set_config('app.rpc_internal', 'on', true);

  UPDATE public.candidaturas
  SET
    status = v_target_status,
    dados_candidato = coalesce(dados_candidato, '{}'::jsonb) ||
      jsonb_build_object(
        'aprovacao_obs', p_observacao,
        'aprovada_at', now()
      ),
    updated_at = now()
  WHERE id = p_candidatura_id
    AND escola_id = v_tenant;

  RETURN p_candidatura_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admissao_unsubmit(
  p_escola_id uuid,
  p_candidatura_id uuid,
  p_motivo text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tenant uuid := public.current_tenant_escola_id();
  v_cand record;
BEGIN
  IF p_escola_id IS NULL OR p_escola_id <> v_tenant THEN
    RAISE EXCEPTION 'Acesso negado: escola inválida';
  END IF;

  IF NOT public.user_has_role_in_school(p_escola_id, array['secretaria','admin','admin_escola','staff_admin']) THEN
    RAISE EXCEPTION 'Acesso negado: permissões insuficientes';
  END IF;

  SELECT *
  INTO v_cand
  FROM public.candidaturas
  WHERE id = p_candidatura_id
    AND escola_id = v_tenant
  FOR UPDATE;

  IF v_cand.status IS NULL THEN
    RAISE EXCEPTION 'Candidatura não encontrada ou acesso negado';
  END IF;

  IF v_cand.status = 'rascunho' THEN
    RETURN p_candidatura_id;
  END IF;

  IF v_cand.status NOT IN ('submetida', 'em_analise', 'aprovada', 'aguardando_pagamento', 'aguardando_compensacao') THEN
    RAISE EXCEPTION 'Transição inválida: % -> rascunho', v_cand.status;
  END IF;

  INSERT INTO public.candidaturas_status_log (
    escola_id,
    candidatura_id,
    from_status,
    to_status,
    motivo
  ) VALUES (
    p_escola_id,
    p_candidatura_id,
    v_cand.status,
    'rascunho',
    p_motivo
  );

  PERFORM set_config('app.rpc_internal', 'on', true);

  UPDATE public.candidaturas
  SET
    status = 'rascunho',
    dados_candidato = coalesce(dados_candidato, '{}'::jsonb) ||
      jsonb_build_object(
        'last_unsubmit_motivo', p_motivo,
        'last_unsubmit_at', now()
      ),
    updated_at = now()
  WHERE id = p_candidatura_id
    AND escola_id = v_tenant;

  RETURN p_candidatura_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admissao_reject(
  p_escola_id uuid,
  p_candidatura_id uuid,
  p_motivo text,
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
BEGIN
  IF p_motivo IS NULL OR length(trim(p_motivo)) < 3 THEN
    RAISE EXCEPTION 'Motivo de rejeição é obrigatório.';
  END IF;

  IF p_escola_id IS NULL OR p_escola_id <> v_tenant THEN
    RAISE EXCEPTION 'Acesso negado: escola inválida';
  END IF;

  IF NOT public.user_has_role_in_school(p_escola_id, array['secretaria','admin','admin_escola','staff_admin','financeiro']) THEN
    RAISE EXCEPTION 'Acesso negado: permissões insuficientes';
  END IF;

  SELECT *
  INTO v_cand
  FROM public.candidaturas
  WHERE id = p_candidatura_id
    AND escola_id = v_tenant
  FOR UPDATE;

  IF v_cand.status IS NULL THEN
    RAISE EXCEPTION 'Candidatura não encontrada ou acesso negado';
  END IF;

  IF v_cand.status = 'rejeitada' THEN
    RETURN p_candidatura_id;
  END IF;

  IF v_cand.status NOT IN ('submetida', 'em_analise', 'aprovada', 'aguardando_pagamento', 'aguardando_compensacao') THEN
    RAISE EXCEPTION 'Transição inválida: % -> rejeitada', v_cand.status;
  END IF;

  INSERT INTO public.candidaturas_status_log (
    escola_id,
    candidatura_id,
    from_status,
    to_status,
    motivo,
    metadata
  ) VALUES (
    p_escola_id,
    p_candidatura_id,
    v_cand.status,
    'rejeitada',
    trim(p_motivo),
    coalesce(p_metadata, '{}'::jsonb)
  );

  PERFORM set_config('app.rpc_internal', 'on', true);

  UPDATE public.candidaturas
  SET
    status = 'rejeitada',
    dados_candidato = coalesce(dados_candidato, '{}'::jsonb) ||
      jsonb_build_object(
        'rejeicao_motivo', trim(p_motivo),
        'rejeitada_at', now()
      ),
    updated_at = now()
  WHERE id = p_candidatura_id
    AND escola_id = v_tenant;

  RETURN p_candidatura_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admissao_archive(
  p_escola_id uuid,
  p_candidatura_id uuid,
  p_motivo text DEFAULT NULL::text
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
  v_to text := 'arquivado';
BEGIN
  IF p_escola_id IS NULL OR p_escola_id <> v_tenant THEN
    RAISE EXCEPTION 'Acesso negado: escola inválida';
  END IF;

  IF NOT public.user_has_role_in_school(p_escola_id, array['secretaria','admin','admin_escola','staff_admin']) THEN
    RAISE EXCEPTION 'Acesso negado: permissões insuficientes';
  END IF;

  SELECT status
  INTO v_cand
  FROM public.candidaturas
  WHERE id = p_candidatura_id
    AND escola_id = v_tenant
  FOR UPDATE;

  IF v_cand.status IS NULL THEN
    RAISE EXCEPTION 'Candidatura não encontrada ou acesso negado';
  END IF;

  v_from := v_cand.status;

  IF v_from = v_to THEN
    RETURN p_candidatura_id;
  END IF;

  IF v_from NOT IN ('submetida', 'em_analise', 'aprovada', 'aguardando_pagamento', 'aguardando_compensacao') THEN
    RAISE EXCEPTION 'Transição inválida: % -> %', v_from, v_to;
  END IF;

  INSERT INTO public.candidaturas_status_log (
    escola_id,
    candidatura_id,
    from_status,
    to_status,
    motivo
  ) VALUES (
    p_escola_id,
    p_candidatura_id,
    v_from,
    v_to,
    p_motivo
  );

  PERFORM set_config('app.rpc_internal', 'on', true);

  UPDATE public.candidaturas
  SET
    status = v_to,
    dados_candidato = coalesce(dados_candidato, '{}'::jsonb) ||
      jsonb_build_object(
        'arquivado_motivo', p_motivo,
        'arquivado_at', now()
      ),
    updated_at = now()
  WHERE id = p_candidatura_id
    AND escola_id = v_tenant;

  RETURN p_candidatura_id;
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

    UPDATE public.candidaturas
    SET aluno_id = v_aluno_id
    WHERE id = p_candidatura_id
      AND escola_id = v_tenant;
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
      'numero_matricula', v_numero_matricula
    ) || coalesce(p_metadata, '{}'::jsonb)
  );

  PERFORM financeiro.gerar_carnet_anual(v_matricula_id);

  RETURN v_matricula_id;
END;
$$;

COMMIT;
