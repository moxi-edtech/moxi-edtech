CREATE OR REPLACE FUNCTION "public"."admissao_upsert_draft"(
  "p_escola_id" "uuid",
  "p_candidatura_id" "uuid" DEFAULT NULL::"uuid",
  "p_source" "text" DEFAULT 'walkin'::"text",
  "p_dados_candidato" "jsonb" DEFAULT '{}'::"jsonb"
) RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public', 'extensions'
    AS $$
declare
  v_id uuid;
  v_tenant_escola_id uuid := public.current_tenant_escola_id();

  v_nome text := nullif(trim(p_dados_candidato->>'nome_candidato'), '');
  v_turno text := nullif(trim(p_dados_candidato->>'turno'), '');

  v_curso_id uuid := null;
  v_classe_id uuid := null;
  v_turma_pref_id uuid := null;

  v_clean jsonb;
begin
  -- Tenant guard hard (defense-in-depth contra qualquer bypass de contexto)
  if p_escola_id is null or p_escola_id <> v_tenant_escola_id then
    raise exception 'Acesso negado: escola inválida';
  end if;

  -- Casts seguros pra uuid (evita 500 por "" / lixo)
  begin
    if nullif(p_dados_candidato->>'curso_id','') is not null then
      v_curso_id := (p_dados_candidato->>'curso_id')::uuid;
    end if;
    if nullif(p_dados_candidato->>'classe_id','') is not null then
      v_classe_id := (p_dados_candidato->>'classe_id')::uuid;
    end if;
    if nullif(p_dados_candidato->>'turma_preferencial_id','') is not null then
      v_turma_pref_id := (p_dados_candidato->>'turma_preferencial_id')::uuid;
    end if;
  exception when invalid_text_representation then
    raise exception 'Payload inválido: UUID malformado';
  end;

  -- Whitelist do JSON (não grava qualquer chave arbitrária)
  v_clean := jsonb_strip_nulls(jsonb_build_object(
    'nome_candidato', v_nome,
    'bi_numero', nullif(trim(p_dados_candidato->>'bi_numero'), ''),
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
    'responsavel_nome', nullif(trim(p_dados_candidato->>'responsavel_nome'), ''),
    'responsavel_contato', nullif(trim(p_dados_candidato->>'responsavel_contato'), ''),
    'encarregado_email', nullif(lower(trim(p_dados_candidato->>'encarregado_email')), ''),
    'responsavel_financeiro_nome', nullif(trim(p_dados_candidato->>'responsavel_financeiro_nome'), ''),
    'responsavel_financeiro_nif', nullif(trim(p_dados_candidato->>'responsavel_financeiro_nif'), ''),
    'mesmo_que_encarregado',
      case
        when p_dados_candidato ? 'mesmo_que_encarregado'
          then (p_dados_candidato->>'mesmo_que_encarregado')::boolean
        else null
      end
  ));

  if p_candidatura_id is null then
    insert into public.candidaturas (
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
    ) values (
      p_escola_id,
      'rascunho',
      coalesce(extract(year from current_date)::int, null),
      coalesce(nullif(p_source,''), 'walkin'),
      v_nome,
      v_curso_id,
      v_classe_id,
      v_turma_pref_id,
      v_turno,
      coalesce(v_clean, '{}'::jsonb)
    )
    returning id into v_id;

  else
    update public.candidaturas c
    set
      source = coalesce(nullif(p_source,''), c.source),
      nome_candidato = coalesce(v_nome, c.nome_candidato),
      curso_id = coalesce(v_curso_id, c.curso_id),
      classe_id = coalesce(v_classe_id, c.classe_id),
      turma_preferencial_id = coalesce(v_turma_pref_id, c.turma_preferencial_id),
      turno = coalesce(v_turno, c.turno),
      dados_candidato = coalesce(c.dados_candidato,'{}'::jsonb) || coalesce(v_clean,'{}'::jsonb)
    where c.id = p_candidatura_id
      and c.escola_id = v_tenant_escola_id
    returning c.id into v_id;

    if not found then
      raise exception 'Candidatura não encontrada ou acesso negado';
    end if;
  end if;

  return v_id;
end;
$$;
