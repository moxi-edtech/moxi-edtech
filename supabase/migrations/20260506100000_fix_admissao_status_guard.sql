-- Fix: Enable internal RPC flag for admission status changes
-- This allows these functions to bypass the _guard_candidaturas_status_change trigger

-- 1. admissao_submit
CREATE OR REPLACE FUNCTION "public"."admissao_submit"("p_escola_id" "uuid", "p_candidatura_id" "uuid", "p_source" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public', 'extensions'
    AS $$
declare
  v_tenant_escola_id uuid := public.current_tenant_escola_id();
  v_cand record;
  v_turma record;
  v_classe record;
begin
  -- 1. Security Check: Tenant Isolation
  if p_escola_id is null or p_escola_id <> v_tenant_escola_id then
    raise exception 'Acesso negado: escola inválida';
  end if;

  if p_candidatura_id is null then
    raise exception 'p_candidatura_id é obrigatório';
  end if;

  -- 2. Lock & Load: Anti-race condition
  select
    c.status,
    c.curso_id,
    c.ano_letivo,
    c.classe_id,
    c.turma_preferencial_id,
    c.source
  into v_cand
  from public.candidaturas c
  where c.id = p_candidatura_id
    and c.escola_id = v_tenant_escola_id
  for update;

  if v_cand.status is null then
    raise exception 'Candidatura não encontrada ou acesso negado';
  end if;

  -- 3. Idempotency: Já submetida? Retorna OK.
  if v_cand.status = 'submetida' then
    return p_candidatura_id;
  end if;

  -- 4. State Transition Check: Só permite rascunho -> submetida
  if v_cand.status <> 'rascunho' then
    raise exception 'Transição inválida: status atual = %', v_cand.status;
  end if;

  -- 5. Business Validations (Hard Requirements for Submission)
  if v_cand.curso_id is null then
    raise exception 'Não é possível submeter: curso_id obrigatório';
  end if;

  if v_cand.ano_letivo is null then
    raise exception 'Não é possível submeter: ano_letivo obrigatório';
  end if;

  -- 6. Coherence Checks (P1)
  
  -- Valida Classe
  if v_cand.classe_id is not null then
    select cl.escola_id, cl.curso_id into v_classe
    from public.classes cl
    where cl.id = v_cand.classe_id;

    if v_classe.escola_id <> v_tenant_escola_id then
      raise exception 'Classe inválida para esta escola';
    end if;
    
    -- Se a classe tem curso vinculado, deve bater
    if v_classe.curso_id is not null and v_classe.curso_id <> v_cand.curso_id then
      raise exception 'Incoerência: Classe não pertence ao curso selecionado';
    end if;
  end if;

  -- Valida Turma Preferencial
  if v_cand.turma_preferencial_id is not null then
    select t.escola_id, t.curso_id, t.classe_id, t.ano_letivo into v_turma
    from public.turmas t
    where t.id = v_cand.turma_preferencial_id;

    if v_turma.escola_id <> v_tenant_escola_id then
      raise exception 'Turma preferencial inválida para esta escola';
    end if;

    if v_turma.curso_id <> v_cand.curso_id then
      raise exception 'Incoerência: Turma preferencial pertence a outro curso';
    end if;

    if v_cand.classe_id is not null and v_turma.classe_id <> v_cand.classe_id then
      raise exception 'Incoerência: Turma preferencial pertence a outra classe';
    end if;

    if v_turma.ano_letivo <> v_cand.ano_letivo then
      raise exception 'Incoerência: Turma preferencial pertence a outro ano letivo';
    end if;
  end if;

  -- 7. Execute Transition
  -- Enable internal RPC flag to bypass status change guard
  PERFORM set_config('app.rpc_internal', 'on', true);

  update public.candidaturas c
  set
    status = 'submetida',
    source = coalesce(nullif(p_source, ''), v_cand.source, 'walkin'),
    updated_at = now()
  where c.id = p_candidatura_id
    and c.escola_id = v_tenant_escola_id;

  return p_candidatura_id;
end;
$$;

-- 2. admissao_approve
CREATE OR REPLACE FUNCTION "public"."admissao_approve"("p_escola_id" "uuid", "p_candidatura_id" "uuid", "p_observacao" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_tenant uuid := public.current_tenant_escola_id();
  v_cand record;
  v_turma record;
  v_classe record;
  v_target_status text;
  v_has_pagamento boolean := false;
begin
  if p_escola_id is null or p_escola_id <> v_tenant then
    raise exception 'Acesso negado: escola inválida';
  end if;

  if not public.user_has_role_in_school(p_escola_id, array['secretaria','admin','admin_escola','staff_admin']) then
    raise exception 'Acesso negado: permissões insuficientes';
  end if;

  select *
  into v_cand
  from public.candidaturas
  where id = p_candidatura_id
    and escola_id = v_tenant
  for update;

  if v_cand.status is null then
    raise exception 'Candidatura não encontrada ou acesso negado';
  end if;

  if v_cand.status in ('aprovada','aguardando_pagamento') then
    return p_candidatura_id;
  end if;

  if v_cand.status not in ('submetida', 'em_analise', 'pendente') then
    raise exception 'Transição inválida: status atual = %', v_cand.status;
  end if;

  if v_cand.curso_id is null or v_cand.ano_letivo is null then
    raise exception 'Candidatura incompleta para aprovação';
  end if;

  if v_cand.classe_id is not null then
    select cl.escola_id, cl.curso_id into v_classe
    from public.classes cl
    where cl.id = v_cand.classe_id;

    if v_classe.escola_id <> v_tenant then
      raise exception 'Classe inválida para esta escola';
    end if;

    if v_classe.curso_id is not null and v_classe.curso_id <> v_cand.curso_id then
      raise exception 'Incoerência: Classe não pertence ao curso selecionado';
    end if;
  end if;

  if v_cand.turma_preferencial_id is not null then
    select t.escola_id, t.curso_id, t.classe_id, t.ano_letivo into v_turma
    from public.turmas t
    where t.id = v_cand.turma_preferencial_id;

    if v_turma.escola_id <> v_tenant then
      raise exception 'Turma preferencial inválida para esta escola';
    end if;

    if v_turma.curso_id <> v_cand.curso_id then
      raise exception 'Incoerência: Turma preferencial pertence a outro curso';
    end if;

    if v_cand.classe_id is not null and v_turma.classe_id <> v_cand.classe_id then
      raise exception 'Incoerência: Turma preferencial pertence a outra classe';
    end if;

    if v_turma.ano_letivo <> v_cand.ano_letivo then
      raise exception 'Incoerência: Turma preferencial pertence a outro ano letivo';
    end if;
  end if;

  v_has_pagamento :=
    nullif(trim(coalesce(v_cand.dados_candidato->'pagamento'->>'metodo', '')), '') is not null
    or nullif(trim(coalesce(v_cand.dados_candidato->'pagamento'->>'comprovativo_url', '')), '') is not null
    or nullif(trim(coalesce(v_cand.dados_candidato->'pagamento'->>'referencia', '')), '') is not null
    or nullif(trim(coalesce(v_cand.dados_candidato->'pagamento'->>'amount', '')), '') is not null;

  v_target_status := case when v_has_pagamento then 'aguardando_pagamento' else 'aprovada' end;

  insert into public.candidaturas_status_log (
    escola_id,
    candidatura_id,
    from_status,
    to_status,
    motivo
  ) values (
    p_escola_id,
    p_candidatura_id,
    v_cand.status,
    v_target_status,
    p_observacao
  );

  -- Enable internal RPC flag to bypass status change guard
  PERFORM set_config('app.rpc_internal', 'on', true);

  update public.candidaturas
  set
    status = v_target_status,
    dados_candidato = coalesce(dados_candidato, '{}'::jsonb) ||
      jsonb_build_object(
        'aprovacao_obs', p_observacao,
        'aprovada_at', now()
      ),
    updated_at = now()
  where id = p_candidatura_id;

  return p_candidatura_id;
end;
$$;

-- 3. admissao_unsubmit (reabrir)
CREATE OR REPLACE FUNCTION "public"."admissao_unsubmit"("p_escola_id" "uuid", "p_candidatura_id" "uuid", "p_motivo" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_tenant uuid := public.current_tenant_escola_id();
  v_cand record;
begin
  if p_escola_id is null or p_escola_id <> v_tenant then
    raise exception 'Acesso negado: escola inválida';
  end if;

  if not public.user_has_role_in_school(p_escola_id, array['secretaria','admin','admin_escola','staff_admin']) then
    raise exception 'Acesso negado: permissões insuficientes';
  end if;

  select *
  into v_cand
  from public.candidaturas
  where id = p_candidatura_id
    and escola_id = v_tenant
  for update;

  if v_cand.status is null then
    raise exception 'Candidatura não encontrada ou acesso negado';
  end if;

  if v_cand.status = 'rascunho' then
    return p_candidatura_id;
  end if;

  -- Status Log
  insert into public.candidaturas_status_log (
    escola_id,
    candidatura_id,
    from_status,
    to_status,
    motivo
  ) values (
    p_escola_id,
    p_candidatura_id,
    v_cand.status,
    'rascunho',
    p_motivo
  );

  -- Enable internal RPC flag to bypass status change guard
  PERFORM set_config('app.rpc_internal', 'on', true);

  -- Execute Update
  update public.candidaturas
  set
    status = 'rascunho',
    dados_candidato = coalesce(dados_candidato, '{}'::jsonb) || 
      jsonb_build_object(
        'last_unsubmit_motivo', p_motivo,
        'last_unsubmit_at', now()
      ),
    updated_at = now()
  where id = p_candidatura_id;

  return p_candidatura_id;
end;
$$;

-- 4. admissao_reject
CREATE OR REPLACE FUNCTION "public"."admissao_reject"("p_escola_id" "uuid", "p_candidatura_id" "uuid", "p_motivo" "text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_tenant uuid := public.current_tenant_escola_id();
  v_cand record;
begin
  if p_escola_id is null or p_escola_id <> v_tenant then
    raise exception 'Acesso negado: escola inválida';
  end if;

  if not public.user_has_role_in_school(p_escola_id, array['secretaria','admin','admin_escola','staff_admin']) then
    raise exception 'Acesso negado: permissões insuficientes';
  end if;

  select *
  into v_cand
  from public.candidaturas
  where id = p_candidatura_id
    and escola_id = v_tenant
  for update;

  if v_cand.status is null then
    raise exception 'Candidatura não encontrada ou acesso negado';
  end if;

  if v_cand.status = 'rejeitada' then
    return p_candidatura_id;
  end if;

  -- Status Log
  insert into public.candidaturas_status_log (
    escola_id,
    candidatura_id,
    from_status,
    to_status,
    motivo,
    metadata
  ) values (
    p_escola_id,
    p_candidatura_id,
    v_cand.status,
    'rejeitada',
    p_motivo,
    p_metadata
  );

  -- Enable internal RPC flag to bypass status change guard
  PERFORM set_config('app.rpc_internal', 'on', true);

  -- Execute Update
  update public.candidaturas
  set
    status = 'rejeitada',
    dados_candidato = coalesce(dados_candidato, '{}'::jsonb) || 
      jsonb_build_object(
        'rejeicao_motivo', p_motivo,
        'rejeitada_at', now()
      ),
    updated_at = now()
  where id = p_candidatura_id;

  return p_candidatura_id;
end;
$$;

-- 5. admissao_archive
CREATE OR REPLACE FUNCTION "public"."admissao_archive"("p_escola_id" "uuid", "p_candidatura_id" "uuid", "p_motivo" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_tenant uuid := public.current_tenant_escola_id();
  v_cand record;
  v_from text;
  v_to text := 'arquivado';
begin
  if p_escola_id is null or p_escola_id <> v_tenant then
    raise exception 'Acesso negado: escola inválida';
  end if;

  if not public.user_has_role_in_school(p_escola_id, array['secretaria', 'admin', 'admin_escola', 'staff_admin']) then
    raise exception 'Acesso negado: permissões insuficientes';
  end if;

  select status
  into v_cand
  from public.candidaturas
  where id = p_candidatura_id
    and escola_id = v_tenant
  for update;

  if v_cand.status is null then
    raise exception 'Candidatura não encontrada ou acesso negado';
  end if;

  v_from := v_cand.status;

  if v_from = v_to then
    return p_candidatura_id;
  end if;

  -- Status Log
  insert into public.candidaturas_status_log (
    escola_id,
    candidatura_id,
    from_status,
    to_status,
    motivo
  ) values (
    p_escola_id,
    p_candidatura_id,
    v_from,
    v_to,
    p_motivo
  );

  -- Enable internal RPC flag to bypass status change guard
  PERFORM set_config('app.rpc_internal', 'on', true);

  -- Execute Update
  update public.candidaturas
  set
    status = v_to,
    dados_candidato = coalesce(dados_candidato, '{}'::jsonb) || 
      jsonb_build_object(
        'arquivado_motivo', p_motivo,
        'arquivado_at', now()
      ),
    updated_at = now()
  where id = p_candidatura_id;

  return p_candidatura_id;
end;
$$;
