--
-- PostgreSQL database dump
--

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.7 (Debian 17.7-3.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: graphql_public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS graphql_public;


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;

CREATE SCHEMA IF NOT EXISTS extensions;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: app_plan_tier; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_plan_tier AS ENUM (
    'essencial',
    'profissional',
    'premium'
);


--
-- Name: cobranca_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.cobranca_status AS ENUM (
    'enviada',
    'entregue',
    'respondida',
    'paga',
    'falha'
);


--
-- Name: curso_update; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.curso_update AS (
	id uuid,
	nome text,
	status_aprovacao text
);


--
-- Name: financeiro_categoria_item; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.financeiro_categoria_item AS ENUM (
    'uniforme',
    'documento',
    'material',
    'transporte',
    'outros',
    'servico'
);


--
-- Name: financeiro_origem; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.financeiro_origem AS ENUM (
    'mensalidade',
    'matricula',
    'venda_avulsa',
    'multa',
    'taxa_extra'
);


--
-- Name: financeiro_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.financeiro_status AS ENUM (
    'pendente',
    'pago',
    'parcial',
    'vencido',
    'cancelado'
);


--
-- Name: financeiro_tipo_transacao; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.financeiro_tipo_transacao AS ENUM (
    'debito',
    'credito'
);


--
-- Name: mensalidade_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.mensalidade_status AS ENUM (
    'pendente',
    'pago_parcial',
    'pago',
    'isento',
    'cancelado'
);


--
-- Name: metodo_pagamento_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.metodo_pagamento_enum AS ENUM (
    'numerario',
    'multicaixa',
    'transferencia',
    'deposito'
);


--
-- Name: periodo_tipo; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.periodo_tipo AS ENUM (
    'SEMESTRE',
    'TRIMESTRE',
    'BIMESTRE'
);


--
-- Name: tipo_documento; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tipo_documento AS ENUM (
    'recibo',
    'declaracao',
    'certificado',
    'historico'
);


--
-- Name: turma_update; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.turma_update AS (
	id uuid,
	nome text,
	curso_id uuid,
	classe_id uuid,
	turno text,
	status_validacao text
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'super_admin',
    'global_admin',
    'admin',
    'professor',
    'aluno',
    'secretaria',
    'financeiro',
    'encarregado'
);


--
-- Name: _each_month(date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._each_month(start_date date, end_date date) RETURNS TABLE(month_start date, month_end date)
    LANGUAGE plpgsql
    SET search_path TO 'pg_temp'
    AS $$
begin
  month_start := date_trunc('month', start_date)::date;
  while month_start < end_date loop
    month_end := (month_start + interval '1 month')::date;
    return next;
    month_start := month_end;
  end loop;
end$$;


--
-- Name: activate_aluno_after_matricula(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.activate_aluno_after_matricula() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_numero text;
  v_status text;
BEGIN
  v_numero := NEW.numero_matricula;
  v_status := NEW.status;

  -- precisa ter número de matrícula e estar ativa
  IF v_numero IS NOT NULL
     AND btrim(v_numero) <> ''
     AND (v_status = 'ativo' OR v_status = 'ativa') THEN
    UPDATE public.alunos
       SET status = 'ativo'
     WHERE id = NEW.aluno_id
       AND status IS DISTINCT FROM 'ativo';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: aprovar_turmas(uuid[], uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.aprovar_turmas(p_turma_ids uuid[], p_escola_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  is_admin bool;
BEGIN
  -- Verificação de segurança crucial: Garante que apenas um administrador da escola
  -- pode executar esta operação. A função is_escola_admin já existe no projeto.
  SELECT public.is_escola_admin(p_escola_id, auth.uid()) INTO is_admin;

  IF NOT is_admin THEN
    RAISE EXCEPTION 'Apenas administradores podem aprovar turmas.';
  END IF;

  -- Atualiza o status das turmas fornecidas para 'aprovado'
  UPDATE public.turmas
  SET
    status_validacao = 'aprovado',
    updated_at = now()
  WHERE
    id = ANY(p_turma_ids) AND escola_id = p_escola_id;

END;
$$;


--
-- Name: assert_course_class_range(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assert_course_class_range(p_curriculum_key text, p_class_num integer) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  v_min int;
  v_max int;
BEGIN
  IF p_curriculum_key IS NULL THEN
    RETURN;
  END IF;

  CASE p_curriculum_key
    WHEN 'primario_base', 'primario_avancado' THEN v_min := 1; v_max := 6;
    WHEN 'ciclo1' THEN v_min := 7; v_max := 9;
    WHEN 'puniv', 'economicas' THEN v_min := 10; v_max := 12;
    WHEN 'tecnico_informatica', 'tecnico_gestao', 'tecnico_construcao', 'tecnico_base', 'saude_enfermagem', 'saude_farmacia_analises' THEN v_min := 10; v_max := 13;
    ELSE
      RETURN;
  END CASE;

  IF p_class_num < v_min OR p_class_num > v_max THEN
    RAISE EXCEPTION 'Classe % fora do intervalo permitido (%-%) para currículo %', p_class_num, v_min, v_max, p_curriculum_key
      USING ERRCODE = '22023';
  END IF;
END;
$$;


--
-- Name: atualiza_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atualiza_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    begin
      new.updated_at = timezone('utc'::text, now());
      return new;
    end;
    $$;


--
-- Name: audit_dml_trigger(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.audit_dml_trigger() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_temp'
    AS $$
declare
  v_escola_id uuid;
  v_entity_id text;
  v_details jsonb;
  v_portal text;
  v_action text;
  v_entity text := tg_table_name;
begin
  v_action := case tg_op when 'INSERT' then 'CREATE' when 'UPDATE' then 'UPDATE' when 'DELETE' then 'DELETE' end;
  v_portal := case tg_table_name when 'pagamentos' then 'financeiro' when 'matriculas' then 'secretaria' else 'outro' end;

  if tg_op in ('INSERT','UPDATE') then
    -- assumes column escola_id exists
    begin v_escola_id := (new).escola_id; exception when others then v_escola_id := null; end;
    begin v_entity_id := (new).id::text; exception when others then v_entity_id := null; end;
    v_details := jsonb_build_object('op', tg_op, 'new', to_jsonb(new));
  else
    begin v_escola_id := (old).escola_id; exception when others then v_escola_id := null; end;
    begin v_entity_id := (old).id::text; exception when others then v_entity_id := null; end;
    v_details := jsonb_build_object('op', tg_op, 'old', to_jsonb(old));
  end if;

  insert into public.audit_logs (escola_id, user_id, portal, action, entity, entity_id, details)
  values (v_escola_id, auth.uid(), v_portal, v_action, v_entity, v_entity_id, v_details);

  if tg_op = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$;


--
-- Name: before_insert_alunos_set_processo(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.before_insert_alunos_set_processo() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.numero_processo IS NULL OR btrim(NEW.numero_processo) = '' THEN
    NEW.numero_processo := public.next_numero_processo(NEW.escola_id, EXTRACT(YEAR FROM now())::int);
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: can_access(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_access(eid uuid) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'pg_temp'
    AS $$
  select exists (
    select 1 from public.escola_members em
    where em.escola_id = eid and em.user_id = auth.uid()
  ) or public.is_super_admin();
$$;


--
-- Name: canonicalize_matricula_status_text(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.canonicalize_matricula_status_text(input text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
    SET search_path TO 'public'
    AS $$
DECLARE v text := lower(trim(coalesce(input, '')));
BEGIN
  IF v = '' THEN RETURN 'indefinido'; END IF;
  IF v IN ('ativa','ativo','active') THEN RETURN 'ativo'; END IF;
  IF v IN ('concluida','concluido','graduado') THEN RETURN 'concluido'; END IF;
  IF v IN ('transferido','transferida') THEN RETURN 'transferido'; END IF;
  IF v IN ('pendente','aguardando') THEN RETURN 'pendente'; END IF;
  IF v IN ('trancado','suspenso','desistente','inativo') THEN RETURN 'inativo'; END IF;
  RETURN 'indefinido';
END
$$;


--
-- Name: check_super_admin_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_super_admin_role() RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_temp'
    AS $$
BEGIN
  RETURN (SELECT public.current_user_role() = 'super_admin');
END;
$$;


--
-- Name: create_escola_with_admin(text, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_escola_with_admin(p_nome text, p_nif text DEFAULT NULL::text, p_endereco text DEFAULT NULL::text, p_admin_email text DEFAULT NULL::text, p_admin_telefone text DEFAULT NULL::text, p_admin_nome text DEFAULT NULL::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_temp'
    AS $$
declare
  v_escola_id uuid;
  v_escola_nome text;
  v_msg text := '';
  v_user_id uuid;
  v_user_escola_id uuid;
  v_exists int;
  v_reutilizada boolean := false;
begin
  if p_nome is null or trim(p_nome) = '' then
    raise exception 'nome obrigatório' using errcode = 'P0001';
  end if;

  if p_nif is not null then
    p_nif := regexp_replace(p_nif, '\\D', '', 'g');
    if length(p_nif) <> 9 then
      raise exception 'NIF inválido (9 dígitos)' using errcode = 'P0001';
    end if;

    -- verifica existência por NIF
    select id, nome
    into v_escola_id, v_escola_nome
    from public.escolas
    where nif = p_nif
    limit 1;

    if found then
      v_reutilizada := true;
      v_msg := 'ℹ️ Escola já existente com este NIF';

      -- log específico de reutilização (não há trigger para isso)
      insert into public.escola_auditoria (escola_id, acao, mensagem, dados)
      values (v_escola_id, 'reutilizada', 'Tenant reutilizado em criação via RPC', jsonb_build_object('nif', p_nif, 'nome_solicitado', p_nome));
    else
      insert into public.escolas (nome, nif, endereco, status, onboarding_finalizado)
      values (
        trim(p_nome),
        nullif(p_nif, ''),
        nullif(trim(coalesce(p_endereco, '')), ''),
        'ativa',
        false
      )
      returning id, nome into v_escola_id, v_escola_nome;
      -- log 'criada' sai pela trigger de escolas
    end if;
  else
    -- sem NIF informado, cria sempre
    insert into public.escolas (nome, nif, endereco, status, onboarding_finalizado)
    values (
      trim(p_nome),
      null,
      nullif(trim(coalesce(p_endereco, '')), ''),
      'ativa',
      false
    )
    returning id, nome into v_escola_id, v_escola_nome;
    -- trigger registra 'criada'
  end if;

  -- vínculo opcional do admin (se existe profile por email)
  if coalesce(trim(p_admin_email), '') <> '' then
    begin
      select user_id, escola_id
        into v_user_id, v_user_escola_id
      from public.profiles
      where email = lower(trim(p_admin_email))
      limit 1;

      if found and v_user_id is not null then
        update public.profiles
           set telefone = coalesce(regexp_replace(coalesce(p_admin_telefone, ''), '\\D', '', 'g'), telefone),
               nome = coalesce(nullif(trim(coalesce(p_admin_nome, '')), ''), nome),
               role = 'admin'::public.user_role,
               escola_id = coalesce(escola_id, v_escola_id)
         where user_id = v_user_id;

        select 1 into v_exists
        from public.escola_administradores
        where escola_id = v_escola_id and user_id = v_user_id
        limit 1;

        if not found then
          insert into public.escola_administradores (escola_id, user_id, cargo)
          values (v_escola_id, v_user_id, 'administrador_principal');
        end if;

        v_msg := v_msg || ' ✅ Administrador vinculado: ' || lower(trim(p_admin_email));
      else
        v_msg := v_msg || ' ⚠️ Usuário não encontrado. Vincule manualmente depois.';
      end if;
    exception when others then
      v_msg := v_msg || ' ⚠️ Erro ao vincular administrador.';
    end;
  end if;

  return json_build_object(
    'ok', true,
    'escolaId', v_escola_id,
    'escolaNome', v_escola_nome,
    'reutilizada', v_reutilizada,
    'mensagemAdmin', coalesce(v_msg, '')
  );
end;
$$;


--
-- Name: create_month_partition(text, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_month_partition(tbl text, month_start date) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'pg_temp'
    AS $$
declare
  start_d date := date_trunc('month', month_start)::date;
  end_d date := (date_trunc('month', month_start) + interval '1 month')::date;
  part_name text := format('%s_%s', tbl, to_char(start_d, 'YYYY_MM'));
  sql text;
begin
  if to_regclass(format('public.%I', part_name)) is null then
    sql := format('create table public.%I partition of public.%I for values from (%L) to (%L)', part_name, tbl, start_d, end_d);
    execute sql;
    -- indexes aligned to use-cases
    if tbl = 'frequencias' then
      execute format('create index if not exists %I on public.%I (escola_id, routine_id, data)', 'ix_'||part_name||'_escola_routine_data', part_name);
      execute format('create index if not exists %I on public.%I (escola_id, curso_oferta_id, data)', 'ix_'||part_name||'_escola_curso_data', part_name);
    end if;

    -- RLS + Unified policies on the new partition (kept consistent with latest definition)
    execute format('alter table public.%I enable row level security', part_name);
    execute format('alter table public.%I force row level security', part_name);
    if tbl = 'frequencias' then
      execute format('create policy unified_select_frequencias on public.%I for select using ((public.is_escola_admin(escola_id)) or (public.is_escola_member(escola_id)))', part_name);
      execute format('create policy unified_insert_frequencias on public.%I for insert with check ((public.is_escola_admin(escola_id)) or (public.is_escola_member(escola_id)))', part_name);
      execute format('create policy unified_update_frequencias on public.%I for update using ((public.is_escola_admin(escola_id)) or (public.is_escola_member(escola_id))) with check ((public.is_escola_admin(escola_id)) or (public.is_escola_member(escola_id)))', part_name);
      execute format('create policy unified_delete_frequencias on public.%I for delete using ((public.is_escola_admin(escola_id)) or (public.is_escola_member(escola_id)))', part_name);
    end if;
    if tbl = 'lancamentos' then
      execute format('create policy unified_select_lancamentos on public.%I for select using ((public.is_escola_admin(escola_id)) or (public.is_escola_member(escola_id)))', part_name);
      execute format('create policy unified_insert_lancamentos on public.%I for insert with check ((public.is_escola_admin(escola_id)) or (public.is_escola_member(escola_id)))', part_name);
      execute format('create policy unified_update_lancamentos on public.%I for update using ((public.is_escola_admin(escola_id)) or (public.is_escola_member(escola_id))) with check ((public.is_escola_admin(escola_id)) or (public.is_escola_member(escola_id)))', part_name);
      execute format('create policy unified_delete_lancamentos on public.%I for delete using ((public.is_escola_admin(escola_id)) or (public.is_escola_member(escola_id)))', part_name);
    end if;

    perform pg_notify('pgrst', 'reload schema');
  end if;
end$$;


--
-- Name: create_month_partition_ts(text, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_month_partition_ts(tbl text, month_start date) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'pg_temp'
    AS $$
declare
  start_ts timestamptz := date_trunc('month', month_start)::timestamptz;
  end_ts timestamptz := (date_trunc('month', month_start) + interval '1 month')::timestamptz;
  part_name text := format('%s_%s', tbl, to_char(start_ts, 'YYYY_MM'));
  sql text;
begin
  if to_regclass(format('public.%I', part_name)) is null then
    sql := format('create table public.%I partition of public.%I for values from (%L) to (%L)', part_name, tbl, start_ts, end_ts);
    execute sql;
    if tbl = 'lancamentos' then
      execute format('create index if not exists %I on public.%I (escola_id, avaliacao_id, matricula_id)', 'ix_'||part_name||'_escola_avaliacao_matricula', part_name);
      execute format('create index if not exists %I on public.%I (escola_id, matricula_id)', 'ix_'||part_name||'_escola_matricula', part_name);
    end if;

    -- RLS + Unified policies on the new partition (kept consistent with latest definition)
    execute format('alter table public.%I enable row level security', part_name);
    execute format('alter table public.%I force row level security', part_name);
    if tbl = 'frequencias' then
      execute format('create policy unified_select_frequencias on public.%I for select using ((public.is_escola_admin(escola_id)) or (public.is_escola_member(escola_id)))', part_name);
      execute format('create policy unified_insert_frequencias on public.%I for insert with check ((public.is_escola_admin(escola_id)) or (public.is_escola_member(escola_id)))', part_name);
      execute format('create policy unified_update_frequencias on public.%I for update using ((public.is_escola_admin(escola_id)) or (public.is_escola_member(escola_id))) with check ((public.is_escola_admin(escola_id)) or (public.is_escola_member(escola_id)))', part_name);
      execute format('create policy unified_delete_frequencias on public.%I for delete using ((public.is_escola_admin(escola_id)) or (public.is_escola_member(escola_id)))', part_name);
    end if;
    if tbl = 'lancamentos' then
      execute format('create policy unified_select_lancamentos on public.%I for select using ((public.is_escola_admin(escola_id)) or (public.is_escola_member(escola_id)))', part_name);
      execute format('create policy unified_insert_lancamentos on public.%I for insert with check ((public.is_escola_admin(escola_id)) or (public.is_escola_member(escola_id)))', part_name);
      execute format('create policy unified_update_lancamentos on public.%I for update using ((public.is_escola_admin(escola_id)) or (public.is_escola_member(escola_id))) with check ((public.is_escola_admin(escola_id)) or (public.is_escola_member(escola_id)))', part_name);
      execute format('create policy unified_delete_lancamentos on public.%I for delete using ((public.is_escola_admin(escola_id)) or (public.is_escola_member(escola_id)))', part_name);
    end if;

    perform pg_notify('pgrst', 'reload schema');
  end if;
end$$;


--
-- Name: create_or_confirm_matricula(uuid, uuid, integer, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_or_confirm_matricula(p_aluno_id uuid, p_turma_id uuid, p_ano_letivo integer, p_matricula_id uuid DEFAULT NULL::uuid) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_escola_id uuid;
  v_matricula_id uuid;
  v_numero_matricula bigint;
BEGIN
  -- A) Validar Aluno
  SELECT a.escola_id
    INTO v_escola_id
  FROM public.alunos a
  WHERE a.id = p_aluno_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aluno não encontrado';
  END IF;

  -- B) Validar Turma (se informada)
  IF p_turma_id IS NOT NULL THEN
    PERFORM 1
    FROM public.turmas t
    WHERE t.id = p_turma_id
      AND t.escola_id = v_escola_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Turma não pertence à escola do aluno';
    END IF;
  END IF;

  -- C) Buscar matrícula existente (determinístico)
  IF p_matricula_id IS NOT NULL THEN
    SELECT m.id, m.numero_matricula
      INTO v_matricula_id, v_numero_matricula
    FROM public.matriculas m
    WHERE m.id = p_matricula_id
      AND m.escola_id = v_escola_id
    FOR UPDATE;
  ELSE
    SELECT m.id, m.numero_matricula
      INTO v_matricula_id, v_numero_matricula
    FROM public.matriculas m
    WHERE m.aluno_id  = p_aluno_id
      AND m.ano_letivo = p_ano_letivo
      AND m.escola_id  = v_escola_id
    ORDER BY
      (m.status IN ('ativo','pendente')) DESC,
      m.created_at DESC NULLS LAST
    LIMIT 1
    FOR UPDATE;
  END IF;

  -- D) Criar ou atualizar
  IF v_matricula_id IS NULL THEN
    v_numero_matricula := public.next_matricula_number(v_escola_id);

    INSERT INTO public.matriculas (
      id, escola_id, aluno_id, turma_id, ano_letivo,
      status, numero_matricula, data_matricula, created_at
    ) VALUES (
      gen_random_uuid(), v_escola_id, p_aluno_id, p_turma_id, p_ano_letivo,
      'ativo', v_numero_matricula, current_date, now()
    )
    RETURNING id INTO v_matricula_id;

  ELSE
    IF v_numero_matricula IS NULL THEN
      v_numero_matricula := public.next_matricula_number(v_escola_id);
    END IF;

    UPDATE public.matriculas
    SET
      numero_matricula = v_numero_matricula,
      status = 'ativo',
      turma_id = COALESCE(p_turma_id, turma_id),
      updated_at = now()
    WHERE id = v_matricula_id;
  END IF;

  -- E) Sincronizar Login
  UPDATE public.profiles p
  SET numero_login = v_numero_matricula::text
  FROM public.alunos a
  WHERE a.id = p_aluno_id
    AND p.user_id = a.profile_id
    AND p.role = 'aluno'
    AND (p.numero_login IS DISTINCT FROM v_numero_matricula::text);

  RETURN v_numero_matricula;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: turmas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.turmas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    escola_id uuid NOT NULL,
    nome text NOT NULL,
    ano_letivo integer,
    turno text,
    sala text,
    session_id uuid,
    classe_id uuid,
    capacidade_maxima integer,
    curso_id uuid,
    coordenador_pedagogico_id uuid,
    diretor_turma_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    turma_codigo text,
    status_validacao text DEFAULT 'ativo'::text,
    turma_code text,
    classe_num integer,
    letra text,
    import_id uuid,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT turmas_turno_check CHECK ((turno = ANY (ARRAY['M'::text, 'T'::text, 'N'::text])))
);

ALTER TABLE ONLY public.turmas FORCE ROW LEVEL SECURITY;


--
-- Name: create_or_get_turma_by_code(uuid, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_or_get_turma_by_code(p_escola_id uuid, p_ano_letivo integer, p_turma_code text) RETURNS public.turmas
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  v_code text := upper(regexp_replace(trim(p_turma_code), '\\s+', '', 'g'));
  v_course_code text;
  v_class_num int;
  v_shift text;
  v_section text;
  v_curso_id uuid;
  v_curriculum_key text;
  v_turma public.turmas;
BEGIN
  IF p_escola_id IS NULL THEN
    RAISE EXCEPTION 'escola_id é obrigatório' USING ERRCODE = '22023';
  END IF;

  IF p_ano_letivo IS NULL THEN
    RAISE EXCEPTION 'ano_letivo é obrigatório' USING ERRCODE = '22023';
  END IF;

  IF v_code !~ '^[A-Z0-9]{2,8}-\\d{1,2}-(M|T|N)-[A-Z]{1,2}$' THEN
    RAISE EXCEPTION 'Código da Turma inválido: % (ex: TI-10-M-A)', p_turma_code
      USING ERRCODE = '22023';
  END IF;

  v_course_code := split_part(v_code, '-', 1);
  v_class_num   := split_part(v_code, '-', 2)::int;
  v_shift       := split_part(v_code, '-', 3);
  v_section     := split_part(v_code, '-', 4);

  IF v_class_num < 1 OR v_class_num > 13 THEN
    RAISE EXCEPTION 'Classe inválida no código: %', v_class_num USING ERRCODE = '22023';
  END IF;

  SELECT c.id, c.curriculum_key INTO v_curso_id, v_curriculum_key
    FROM public.cursos c
   WHERE c.escola_id = p_escola_id
     AND c.course_code = v_course_code
   LIMIT 1;

  IF v_curso_id IS NULL THEN
    RAISE EXCEPTION 'Curso não encontrado para course_code=% na escola', v_course_code USING ERRCODE = '23503';
  END IF;

  PERFORM public.assert_course_class_range(v_curriculum_key, v_class_num);

  INSERT INTO public.turmas (
    escola_id, ano_letivo, turma_code,
    curso_id, classe_num, turno, letra,
    turma_codigo, nome
  )
  VALUES (
    p_escola_id, p_ano_letivo, v_code,
    v_curso_id, v_class_num, v_shift, v_section,
    v_code, coalesce(v_code || ' (Auto)', v_code)
  )
  ON CONFLICT (escola_id, ano_letivo, turma_code)
  DO UPDATE SET
    curso_id   = EXCLUDED.curso_id,
    classe_num = EXCLUDED.classe_num,
    turno      = EXCLUDED.turno,
    letra      = EXCLUDED.letra,
    turma_codigo = COALESCE(public.turmas.turma_codigo, EXCLUDED.turma_codigo),
    nome       = COALESCE(public.turmas.nome, EXCLUDED.nome)
  RETURNING * INTO v_turma;

  RETURN v_turma;
END;
$_$;


--
-- Name: current_escola_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_escola_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT (auth.jwt() -> 'raw_app_meta_data' ->> 'escola_id')::uuid;
$$;


--
-- Name: current_tenant_escola_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_tenant_escola_id() RETURNS uuid
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_claims jsonb := '{}'::jsonb;
  v_escola uuid := null;
  v_profile_escola uuid := null;
begin
  -- Claims directly from the request (Supabase injects these for auth users)
  begin
    v_claims := current_setting('request.jwt.claims', true)::jsonb;
  exception when others then
    v_claims := '{}'::jsonb;
  end;

  -- 1) Prefer explicit top-level claim
  if (v_claims ? 'escola_id') then
    v_escola := nullif(v_claims->>'escola_id', '')::uuid;
    if v_escola is not null then
      return v_escola;
    end if;
  end if;

  -- 2) Fallback to app_metadata.escola_id (common custom-claim pattern)
  if (v_claims ? 'app_metadata') and ((v_claims->'app_metadata') ? 'escola_id') then
    v_escola := nullif((v_claims->'app_metadata')->>'escola_id', '')::uuid;
    if v_escola is not null then
      return v_escola;
    end if;
  end if;

  -- 3) Preferred school from profile (current_escola_id > escola_id)
  begin
    select coalesce(p.current_escola_id, p.escola_id)::uuid
      into v_profile_escola
    from public.profiles p
    where p.user_id = auth.uid()
    order by p.created_at desc
    limit 1;
  exception when others then
    v_profile_escola := null;
  end;

  -- 4a) Validate profile school against escola_usuarios membership
  if v_profile_escola is not null then
    begin
      select eu.escola_id::uuid
        into v_escola
      from public.escola_usuarios eu
      where eu.user_id = auth.uid()
        and eu.escola_id = v_profile_escola
      order by eu.created_at nulls first
      limit 1;
    exception when others then
      v_escola := null;
    end;

    if v_escola is not null then
      return v_escola;
    end if;
  end if;

  -- 4b) Otherwise take the first escola_usuarios link
  begin
    select eu.escola_id::uuid
      into v_escola
    from public.escola_usuarios eu
    where eu.user_id = auth.uid()
    order by eu.created_at nulls first
    limit 1;
  exception when others then
    v_escola := null;
  end;

  if v_escola is not null then
    return v_escola;
  end if;

  -- 5) Last resort: trust the profile preference alone
  if v_profile_escola is not null then
    return v_profile_escola;
  end if;

  return null;
end;
$$;


--
-- Name: current_user_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_user_id() RETURNS uuid
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  SELECT
    NULLIF(
      current_setting('request.jwt.claims', true)::jsonb->>'sub',
      ''
    )::uuid;
$$;


--
-- Name: current_user_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_user_role() RETURNS text
    LANGUAGE sql STABLE
    SET search_path TO 'pg_temp'
    AS $$
  SELECT COALESCE(
    (CURRENT_SETTING('request.jwt.claims', TRUE)::JSONB -> 'app_metadata' ->> 'role'),
    ''
  );
$$;


--
-- Name: dashboard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.dashboard() RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'pg_temp'
    AS $$
begin
  return jsonb_build_object(
    'totais', jsonb_build_object(
      'escolas', (select count(*) from escolas),
      'alunos', (select count(*) from alunos),
      'turmas', (select count(*) from turmas),
      'matriculas', (select count(*) from matriculas)
    ),
    'notas', (
      select coalesce(
        jsonb_agg(jsonb_build_object(
          'turma', t.nome,
          'disciplina', n.disciplina,
          'periodo', p.nome,  -- 🔥 agora traz o trimestre
          'media', avg(n.nota)
        )),
        '[]'::jsonb
      )
      from notas n
      join turmas t on t.id = n.turma_id
      join periodos_letivos p on p.id = n.periodo_id
      group by t.nome, n.disciplina, p.nome
    ),
    'pagamentos', jsonb_build_object(
      'status', (
        select coalesce(
          jsonb_agg(jsonb_build_object(
            'status', status,
            'qtd', count(*),
            'total', sum(valor)
          )),
          '[]'::jsonb
        )
        from pagamentos
        group by status
      ),
      'percentual_pago', (
        select coalesce(
          100.0 * sum(case when status = 'pago' then 1 else 0 end)::float / nullif(count(*),0),
          0
        )
        from pagamentos
      )
    )
  );
end;
$$;


--
-- Name: emitir_recibo(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.emitir_recibo(p_mensalidade_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_id uuid;
  v_m public.mensalidades%ROWTYPE;
  v_doc record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'UNAUTHENTICATED');
  END IF;

  SELECT *
    INTO v_m
  FROM public.mensalidades
  WHERE id = p_mensalidade_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Mensalidade não encontrada');
  END IF;

  -- User deve pertencer à escola da mensalidade
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = v_user_id
      AND (p.escola_id = v_m.escola_id OR p.current_escola_id = v_m.escola_id)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'FORBIDDEN');
  END IF;

  -- Plano precisa liberar o recurso
  IF NOT public.escola_has_feature(v_m.escola_id, 'fin_recibo_pdf') THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Plano não inclui Recibo PDF');
  END IF;

  -- Apenas mensalidades pagas
  IF v_m.status <> 'pago' THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Mensalidade não está paga');
  END IF;

  -- Idempotência: retorna recibo existente
  SELECT id, public_id, created_at
    INTO v_doc
  FROM public.documentos_emitidos
  WHERE tipo = 'recibo'
    AND mensalidade_id = p_mensalidade_id
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'doc_id', v_doc.id,
      'public_id', v_doc.public_id,
      'emitido_em', v_doc.created_at
    );
  END IF;

  -- Cria snapshot do recibo
  INSERT INTO public.documentos_emitidos (
    escola_id, aluno_id, mensalidade_id, tipo, dados_snapshot, created_by
  ) VALUES (
    v_m.escola_id,
    v_m.aluno_id,
    v_m.id,
    'recibo',
    jsonb_build_object(
      'mensalidade_id', v_m.id,
      'referencia', to_char(make_date(v_m.ano_referencia, v_m.mes_referencia, 1), 'TMMon/YYYY'),
      'valor_pago', v_m.valor_pago_total,
      'data_pagamento', v_m.data_pagamento_efetiva,
      'metodo', v_m.metodo_pagamento
    ),
    v_user_id
  )
  RETURNING id, public_id, created_at INTO v_doc;

  RETURN jsonb_build_object(
    'ok', true,
    'doc_id', v_doc.id,
    'public_id', v_doc.public_id,
    'emitido_em', v_doc.created_at
  );
END;
$$;


--
-- Name: enforce_avaliacoes_consistency(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_avaliacoes_consistency() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  td_escola uuid;
  p_escola uuid;
begin
  select escola_id into td_escola
  from public.turma_disciplinas
  where id = new.turma_disciplina_id;

  select escola_id into p_escola
  from public.periodos_letivos
  where id = new.periodo_letivo_id;

  if td_escola is null or p_escola is null then
    raise exception 'FK inválida em avaliacoes (turma_disciplina/periodo não encontrado)';
  end if;

  if new.escola_id <> td_escola or new.escola_id <> p_escola then
    raise exception 'Violação multi-tenant: escola_id inconsistente (avaliacoes)';
  end if;

  return new;
end;
$$;


--
-- Name: enforce_notas_consistency(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_notas_consistency() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  a_escola uuid;
  m_escola uuid;
begin
  select escola_id into a_escola
  from public.avaliacoes
  where id = new.avaliacao_id;

  select escola_id into m_escola
  from public.matriculas
  where id = new.matricula_id;

  if a_escola is null or m_escola is null then
    raise exception 'FK inválida em notas (avaliacao/matricula não encontrada)';
  end if;

  if new.escola_id <> a_escola or new.escola_id <> m_escola then
    raise exception 'Violação multi-tenant: escola_id inconsistente (notas)';
  end if;

  return new;
end;
$$;


--
-- Name: enforce_turma_disciplina_consistency(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_turma_disciplina_consistency() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  t_escola uuid;
  t_curso  uuid;
  t_classe uuid;

  m_escola uuid;
  m_curso  uuid;
  m_classe uuid;
begin
  select escola_id, curso_id, classe_id
    into t_escola, t_curso, t_classe
  from public.turmas
  where id = new.turma_id;

  select escola_id, curso_id, classe_id
    into m_escola, m_curso, m_classe
  from public.curso_matriz
  where id = new.curso_matriz_id;

  if t_escola is null or m_escola is null then
    raise exception 'FK inválida em turma_disciplinas (turma/matriz não encontrada)';
  end if;

  if new.escola_id <> t_escola or t_escola <> m_escola then
    raise exception 'Violação multi-tenant: escola_id inconsistente (turma_disciplinas)';
  end if;

  if t_curso <> m_curso or t_classe <> m_classe then
    raise exception 'Disciplina não pertence ao curso/classe da turma (turma_disciplinas)';
  end if;

  return new;
end;
$$;


--
-- Name: ensure_aluno_from_escola_usuario(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ensure_aluno_from_escola_usuario() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_nome      text;
  v_telefone  text;
BEGIN
  IF NEW.papel IS DISTINCT FROM 'aluno' THEN
    RETURN NEW;
  END IF;

  SELECT p.nome, p.telefone
  INTO v_nome, v_telefone
  FROM public.profiles p
  WHERE p.user_id = NEW.user_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.alunos (
    profile_id,
    escola_id,
    nome,
    telefone_responsavel,
    status,
    created_at
  )
  VALUES (
    NEW.user_id,
    NEW.escola_id,
    COALESCE(v_nome, 'Aluno sem nome'),
    v_telefone,
    'pendente',
    NOW()
  )
  ON CONFLICT (profile_id, escola_id)
  DO UPDATE SET
    nome                 = EXCLUDED.nome,
    telefone_responsavel = EXCLUDED.telefone_responsavel;

  RETURN NEW;
END;
$$;


--
-- Name: escola_has_feature(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.escola_has_feature(p_escola_id uuid, p_feature text) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_plan public.app_plan_tier := 'essencial';
  v_feature text := lower(btrim(coalesce(p_feature, '')));
BEGIN
  SELECT plano_atual INTO v_plan FROM public.escolas WHERE id = p_escola_id LIMIT 1;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  CASE v_feature
    WHEN 'fin_recibo_pdf' THEN RETURN v_plan IN ('profissional', 'premium');
    WHEN 'sec_upload_docs' THEN RETURN v_plan IN ('profissional', 'premium');
    WHEN 'sec_matricula_online' THEN RETURN v_plan = 'premium';
    WHEN 'doc_qr_code' THEN RETURN v_plan = 'premium';
    WHEN 'app_whatsapp_auto' THEN RETURN v_plan = 'premium';
    WHEN 'suporte_prioritario' THEN RETURN v_plan = 'premium';
    ELSE RETURN FALSE;
  END CASE;
END;
$$;


--
-- Name: estornar_mensalidade(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.estornar_mensalidade(p_mensalidade_id uuid, p_motivo text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_m public.mensalidades%ROWTYPE;
  v_valor numeric(14,2);
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_m
  FROM public.mensalidades
  WHERE id = p_mensalidade_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Mensalidade não encontrada');
  END IF;

  IF v_m.status <> 'pago' THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Apenas mensalidades pagas podem ser estornadas');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = v_user_id
      AND (p.escola_id = v_m.escola_id OR p.current_escola_id = v_m.escola_id)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'FORBIDDEN');
  END IF;

  v_valor := COALESCE(v_m.valor_pago_total, v_m.valor_previsto, 0);

  INSERT INTO public.financeiro_estornos (
    escola_id,
    mensalidade_id,
    valor,
    motivo,
    created_by
  ) VALUES (
    v_m.escola_id,
    v_m.id,
    v_valor,
    NULLIF(btrim(p_motivo), ''),
    v_user_id
  );

  UPDATE public.pagamentos
  SET status = 'cancelado'
  WHERE mensalidade_id = v_m.id
    AND status = 'pago';

  UPDATE public.mensalidades
  SET
    status = 'pendente',
    valor_pago_total = 0,
    data_pagamento_efetiva = NULL,
    metodo_pagamento = NULL,
    observacao = CASE
      WHEN COALESCE(btrim(p_motivo), '') = '' THEN
        COALESCE(observacao, '') || ' [ESTORNO]'
      ELSE
        COALESCE(observacao, '') || ' [ESTORNO] ' || btrim(p_motivo)
    END,
    updated_at = now(),
    updated_by = v_user_id
  WHERE id = v_m.id;

  RETURN jsonb_build_object(
    'ok', true,
    'mensalidade_id', v_m.id,
    'valor_estornado', v_valor
  );
END;
$$;


--
-- Name: generate_unique_numero_login(uuid, public.user_role, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_unique_numero_login(p_escola_id uuid, p_role public.user_role, p_prefix text, p_start integer) RETURNS text
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $_$
DECLARE
  used_suffixes INTEGER[];
  next_number INTEGER;
  max_attempts INTEGER := 1000;
  attempt INTEGER := 0;
  next_role_start INTEGER;
  role_starts INTEGER[];
BEGIN
  -- Buscar todos os sufixos em uso
  SELECT ARRAY_AGG(
    CAST(SUBSTRING(numero_login FROM '(\d{4})$') AS INTEGER)
  ) INTO used_suffixes
  FROM profiles
  WHERE escola_id = p_escola_id 
    AND role = p_role 
    AND numero_login LIKE p_prefix || '%'
    AND SUBSTRING(numero_login FROM '(\d{4})$') ~ '^\d{4}$';
  
  used_suffixes := COALESCE(used_suffixes, ARRAY[]::INTEGER[]);
  
  -- Definir faixas de roles (equivalente ao ROLE_START no TypeScript)
  role_starts := ARRAY[1, 1001, 2001, 3001, 4001]; -- admin, aluno, professor, secretaria, financeiro
  
  -- Encontrar primeiro número disponível
  next_number := p_start;
  WHILE next_number = ANY(used_suffixes) AND attempt < max_attempts LOOP
    next_number := next_number + 1;
    attempt := attempt + 1;
    
    -- Verificar limites entre faixas de roles
    SELECT MIN(start_val) INTO next_role_start
    FROM unnest(role_starts) AS start_val
    WHERE start_val > p_start;
    
    IF next_role_start IS NOT NULL AND next_number >= next_role_start THEN
      RAISE EXCEPTION 'Limite de números para o role % (faixa %-%) atingido', 
        p_role, p_start, next_role_start - 1;
    END IF;
  END LOOP;
  
  IF attempt >= max_attempts THEN
    RAISE EXCEPTION 'Não foi possível gerar número único para login após % tentativas', max_attempts;
  END IF;
  
  RETURN p_prefix || LPAD(next_number::TEXT, 4, '0');
END;
$_$;


--
-- Name: gerar_mensalidades_lote(uuid, integer, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.gerar_mensalidades_lote(p_escola_id uuid, p_ano_letivo integer, p_mes_referencia integer, p_dia_vencimento_default integer DEFAULT 10) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_data_vencimento date;
  v_mes smallint;
  v_ano int;
  v_inseridas int := 0;
BEGIN
  -- Sanitiza parâmetros
  v_mes := LEAST(GREATEST(p_mes_referencia, 1), 12);
  v_ano := p_ano_letivo;

  -- Vencimento seguro (limita a 28 para meses curtos)
  v_data_vencimento := make_date(v_ano, v_mes, LEAST(GREATEST(coalesce(p_dia_vencimento_default, 10), 1), 28));

  WITH regras AS (
    -- Regra mais específica: curso + classe
    SELECT
      ft.escola_id,
      ft.ano_letivo,
      ft.curso_id,
      ft.classe_id,
      ft.valor_mensalidade,
      ft.dia_vencimento,
      1 AS prioridade
    FROM public.financeiro_tabelas ft
    UNION ALL
    -- Curso
    SELECT escola_id, ano_letivo, curso_id, NULL, valor_mensalidade, dia_vencimento, 2
    FROM public.financeiro_tabelas
    WHERE classe_id IS NULL
    UNION ALL
    -- Classe
    SELECT escola_id, ano_letivo, NULL, classe_id, valor_mensalidade, dia_vencimento, 3
    FROM public.financeiro_tabelas
    WHERE curso_id IS NULL
    UNION ALL
    -- Geral da escola
    SELECT escola_id, ano_letivo, NULL, NULL, valor_mensalidade, dia_vencimento, 4
    FROM public.financeiro_tabelas
  ),
  precos AS (
    SELECT
      m.id AS matricula_id,
      m.aluno_id,
      m.turma_id,
      t.curso_id,
      t.classe_id,
      coalesce(
        (SELECT valor_mensalidade FROM regras r
         WHERE r.escola_id = p_escola_id
           AND r.ano_letivo = p_ano_letivo
           AND r.curso_id = t.curso_id
           AND r.classe_id = t.classe_id
         ORDER BY prioridade LIMIT 1),
        (SELECT valor_mensalidade FROM regras r
         WHERE r.escola_id = p_escola_id
           AND r.ano_letivo = p_ano_letivo
           AND r.curso_id = t.curso_id
           AND r.classe_id IS NULL
         ORDER BY prioridade LIMIT 1),
        (SELECT valor_mensalidade FROM regras r
         WHERE r.escola_id = p_escola_id
           AND r.ano_letivo = p_ano_letivo
           AND r.curso_id IS NULL
           AND r.classe_id = t.classe_id
         ORDER BY prioridade LIMIT 1),
        (SELECT valor_mensalidade FROM regras r
         WHERE r.escola_id = p_escola_id
           AND r.ano_letivo = p_ano_letivo
           AND r.curso_id IS NULL
           AND r.classe_id IS NULL
         ORDER BY prioridade LIMIT 1),
        0
      ) AS valor_mensalidade,
      coalesce(
        (SELECT dia_vencimento FROM regras r
         WHERE r.escola_id = p_escola_id
           AND r.ano_letivo = p_ano_letivo
           AND r.curso_id = t.curso_id
           AND r.classe_id = t.classe_id
         ORDER BY prioridade LIMIT 1),
        (SELECT dia_vencimento FROM regras r
         WHERE r.escola_id = p_escola_id
           AND r.ano_letivo = p_ano_letivo
           AND r.curso_id = t.curso_id
           AND r.classe_id IS NULL
         ORDER BY prioridade LIMIT 1),
        (SELECT dia_vencimento FROM regras r
         WHERE r.escola_id = p_escola_id
           AND r.ano_letivo = p_ano_letivo
           AND r.curso_id IS NULL
           AND r.classe_id = t.classe_id
         ORDER BY prioridade LIMIT 1),
        (SELECT dia_vencimento FROM regras r
         WHERE r.escola_id = p_escola_id
           AND r.ano_letivo = p_ano_letivo
           AND r.curso_id IS NULL
           AND r.classe_id IS NULL
         ORDER BY prioridade LIMIT 1),
        p_dia_vencimento_default
      ) AS dia_vencimento_resolvido
    FROM public.matriculas m
    JOIN public.turmas t ON t.id = m.turma_id
    WHERE m.escola_id = p_escola_id
      AND m.ano_letivo::text = p_ano_letivo::text
      AND m.status IN ('ativo', 'ativa')
  ),
  inseridos AS (
    INSERT INTO public.mensalidades (
      escola_id,
      aluno_id,
      turma_id,
      ano_letivo,
      mes_referencia,
      ano_referencia,
      valor,
      valor_previsto,
      valor_pago_total,
      status,
      data_vencimento
    )
    SELECT
      p_escola_id,
      p.aluno_id,
      p.turma_id,
      p_ano_letivo::text,
      v_mes,
      v_ano,
      p.valor_mensalidade,
      p.valor_mensalidade,
      0,
      'pendente',
      make_date(v_ano, v_mes, LEAST(GREATEST(coalesce(p.dia_vencimento_resolvido, p_dia_vencimento_default), 1), 28))
    FROM precos p
    WHERE NOT EXISTS (
      SELECT 1 FROM public.mensalidades m2
      WHERE m2.escola_id = p_escola_id
        AND m2.aluno_id = p.aluno_id
        AND m2.ano_referencia = v_ano
        AND m2.mes_referencia = v_mes
     )
    RETURNING 1
  )
  SELECT count(*) INTO v_inseridas FROM inseridos;

  RETURN jsonb_build_object(
    'ok', true,
    'geradas', coalesce(v_inseridas, 0),
    'ano', v_ano,
    'mes', v_mes,
    'vencimento', v_data_vencimento
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'erro', SQLERRM);
END;
$$;


--
-- Name: gerar_mensalidades_lote(uuid, integer, integer, integer, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.gerar_mensalidades_lote(p_escola_id uuid, p_ano_letivo integer, p_mes_referencia integer, p_dia_vencimento_default integer DEFAULT 10, p_turma_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_data_vencimento date;
  v_mes smallint;
  v_ano int;
  v_inseridas int := 0;
BEGIN
  v_mes := LEAST(GREATEST(p_mes_referencia, 1), 12);
  v_ano := p_ano_letivo;

  v_data_vencimento := make_date(v_ano, v_mes, LEAST(GREATEST(coalesce(p_dia_vencimento_default, 10), 1), 28));

  WITH regras AS (
    SELECT
      ft.escola_id,
      ft.ano_letivo,
      ft.curso_id,
      ft.classe_id,
      ft.valor_mensalidade,
      ft.dia_vencimento,
      1 AS prioridade
    FROM public.financeiro_tabelas ft
    UNION ALL
    SELECT escola_id, ano_letivo, curso_id, NULL, valor_mensalidade, dia_vencimento, 2
    FROM public.financeiro_tabelas
    WHERE classe_id IS NULL
    UNION ALL
    SELECT escola_id, ano_letivo, NULL, classe_id, valor_mensalidade, dia_vencimento, 3
    FROM public.financeiro_tabelas
    WHERE curso_id IS NULL
    UNION ALL
    SELECT escola_id, ano_letivo, NULL, NULL, valor_mensalidade, dia_vencimento, 4
    FROM public.financeiro_tabelas
  ),
  precos AS (
    SELECT
      m.id AS matricula_id,
      m.aluno_id,
      m.turma_id,
      t.curso_id,
      t.classe_id,
      coalesce(
        (SELECT valor_mensalidade FROM regras r
         WHERE r.escola_id = p_escola_id
           AND r.ano_letivo = p_ano_letivo
           AND r.curso_id = t.curso_id
           AND r.classe_id = t.classe_id
         ORDER BY prioridade LIMIT 1),
        (SELECT valor_mensalidade FROM regras r
         WHERE r.escola_id = p_escola_id
           AND r.ano_letivo = p_ano_letivo
           AND r.curso_id = t.curso_id
           AND r.classe_id IS NULL
         ORDER BY prioridade LIMIT 1),
        (SELECT valor_mensalidade FROM regras r
         WHERE r.escola_id = p_escola_id
           AND r.ano_letivo = p_ano_letivo
           AND r.curso_id IS NULL
           AND r.classe_id = t.classe_id
         ORDER BY prioridade LIMIT 1),
        (SELECT valor_mensalidade FROM regras r
         WHERE r.escola_id = p_escola_id
           AND r.ano_letivo = p_ano_letivo
           AND r.curso_id IS NULL
           AND r.classe_id IS NULL
         ORDER BY prioridade LIMIT 1),
        0
      ) AS valor_mensalidade,
      coalesce(
        (SELECT dia_vencimento FROM regras r
         WHERE r.escola_id = p_escola_id
           AND r.ano_letivo = p_ano_letivo
           AND r.curso_id = t.curso_id
           AND r.classe_id = t.classe_id
         ORDER BY prioridade LIMIT 1),
        (SELECT dia_vencimento FROM regras r
         WHERE r.escola_id = p_escola_id
           AND r.ano_letivo = p_ano_letivo
           AND r.curso_id = t.curso_id
           AND r.classe_id IS NULL
         ORDER BY prioridade LIMIT 1),
        (SELECT dia_vencimento FROM regras r
         WHERE r.escola_id = p_escola_id
           AND r.ano_letivo = p_ano_letivo
           AND r.curso_id IS NULL
           AND r.classe_id = t.classe_id
         ORDER BY prioridade LIMIT 1),
        (SELECT dia_vencimento FROM regras r
         WHERE r.escola_id = p_escola_id
           AND r.ano_letivo = p_ano_letivo
           AND r.curso_id IS NULL
           AND r.classe_id IS NULL
         ORDER BY prioridade LIMIT 1),
        p_dia_vencimento_default
      ) AS dia_vencimento_resolvido
    FROM public.matriculas m
    JOIN public.turmas t ON t.id = m.turma_id
    WHERE m.escola_id = p_escola_id
      AND m.ano_letivo::text = p_ano_letivo::text
      AND m.status IN ('ativo', 'ativa')
      AND (p_turma_id IS NULL OR m.turma_id = p_turma_id)
  ),
  inseridos AS (
    INSERT INTO public.mensalidades (
      escola_id,
      aluno_id,
      turma_id,
      ano_letivo,
      mes_referencia,
      ano_referencia,
      valor,
      valor_previsto,
      valor_pago_total,
      status,
      data_vencimento
    )
    SELECT
      p_escola_id,
      p.aluno_id,
      p.turma_id,
      p_ano_letivo::text,
      v_mes,
      v_ano,
      p.valor_mensalidade,
      p.valor_mensalidade,
      0,
      'pendente',
      make_date(v_ano, v_mes, LEAST(GREATEST(coalesce(p.dia_vencimento_resolvido, p_dia_vencimento_default), 1), 28))
    FROM precos p
    WHERE NOT EXISTS (
      SELECT 1 FROM public.mensalidades m2
      WHERE m2.escola_id = p_escola_id
        AND m2.aluno_id = p.aluno_id
        AND m2.ano_referencia = v_ano
        AND m2.mes_referencia = v_mes
    )
    RETURNING 1
  )
  SELECT count(*) INTO v_inseridas FROM inseridos;

  RETURN jsonb_build_object(
    'ok', true,
    'geradas', coalesce(v_inseridas, 0),
    'ano', v_ano,
    'mes', v_mes,
    'vencimento', v_data_vencimento
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'erro', SQLERRM);
END;
$$;


--
-- Name: get_aluno_dossier(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_aluno_dossier(p_escola_id uuid, p_aluno_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_aluno jsonb;
  v_matriculas jsonb;
  v_financeiro jsonb;
BEGIN
  -- Perfil do aluno dentro da escola
  SELECT to_jsonb(a.*) INTO v_aluno
  FROM public.alunos a
  WHERE a.id = p_aluno_id
    AND a.escola_id = p_escola_id;

  IF v_aluno IS NULL THEN
    RETURN NULL;
  END IF;

  -- Histórico de matrículas (mais recente primeiro)
  SELECT jsonb_agg(row_to_json(m.*) ORDER BY m.ano_letivo DESC, m.data_matricula DESC)
    INTO v_matriculas
  FROM (
    SELECT
      m.id,
      m.ano_letivo,
      m.status,
      m.data_matricula,
      m.numero_matricula,
      t.id AS turma_id,
      t.nome AS turma,
      t.turno,
      c.nome AS classe,
      t.ano_letivo AS turma_ano_letivo
    FROM public.matriculas m
    LEFT JOIN public.turmas t ON t.id = m.turma_id
    LEFT JOIN public.classes c ON c.id = t.classe_id
    WHERE m.aluno_id = p_aluno_id
      AND m.escola_id = p_escola_id
    ORDER BY m.ano_letivo DESC, m.data_matricula DESC NULLS LAST
  ) m;

  -- Resumo financeiro simples (mensalidades)
  SELECT jsonb_build_object(
    'total_previsto', coalesce(SUM(valor_previsto), 0),
    'total_pago', coalesce(SUM(valor_pago_total), 0),
    'total_em_atraso', coalesce(SUM(CASE WHEN status <> 'pago' AND data_vencimento < CURRENT_DATE THEN (valor_previsto - 
      valor_pago_total) ELSE 0 END), 0),
    'mensalidades', COALESCE(jsonb_agg(jsonb_build_object(
      'id', id,
      'mes', mes_referencia,
      'ano', ano_referencia,
      'valor', valor_previsto,
      'pago', valor_pago_total,
      'status', status,
      'vencimento', data_vencimento,
      'pago_em', data_pagamento_efetiva
    ) ORDER BY ano_referencia DESC, mes_referencia DESC), '[]'::jsonb)
  )
  INTO v_financeiro
  FROM public.mensalidades
  WHERE aluno_id = p_aluno_id
    AND escola_id = p_escola_id;

  RETURN jsonb_build_object(
    'perfil', v_aluno,
    'historico', coalesce(v_matriculas, '[]'::jsonb),
    'financeiro', coalesce(v_financeiro, '{}'::jsonb)
  );
END;
$$;


--
-- Name: get_import_summary(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_import_summary(p_import_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_cursos json;
  v_turmas json;
BEGIN
  -- Coleta todos os cursos criados nesta importação
  SELECT json_agg(c.*)
  INTO v_cursos
  FROM public.cursos c
  WHERE c.import_id = p_import_id;

  -- Coleta todas as turmas criadas nesta importação
  -- Adiciona informações úteis de tabelas relacionadas (cursos, classes)
  SELECT json_agg(t_agg)
  INTO v_turmas
  FROM (
    SELECT 
      t.*,
      c.nome as curso_nome,
      c.status_aprovacao as curso_status,
      cl.nome as classe_nome
    FROM public.turmas t
    LEFT JOIN public.cursos c ON t.curso_id = c.id
    LEFT JOIN public.classes cl ON t.classe_id = cl.id
    WHERE t.import_id = p_import_id
  ) t_agg;

  -- Retorna um objeto JSON com as duas listas
  RETURN json_build_object(
    'cursos', COALESCE(v_cursos, '[]'::json),
    'turmas', COALESCE(v_turmas, '[]'::json)
  );
END;
$$;


--
-- Name: get_my_escola_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_escola_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT escola_id FROM public.profiles WHERE user_id = auth.uid();
$$;


--
-- Name: get_my_escola_ids(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_escola_ids() RETURNS uuid[]
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select array_agg(distinct coalesce(p.current_escola_id, p.escola_id))
  from public.profiles p
  where p.user_id = (select auth.uid());
$$;


--
-- Name: get_pending_turmas_count(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_pending_turmas_count(p_escola_id uuid) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_count bigint;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM public.turmas
  WHERE escola_id = p_escola_id AND status_validacao = 'rascunho';

  RETURN v_count;
END;
$$;


--
-- Name: get_profile_dependencies(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_profile_dependencies(p_user_id uuid) RETURNS TABLE(table_name text, cnt bigint)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY VALUES ('profiles', (SELECT COUNT(*) FROM public.profiles WHERE user_id = p_user_id));
  RETURN QUERY VALUES ('escola_members', (SELECT COUNT(*) FROM public.escola_members WHERE user_id = p_user_id));
  RETURN QUERY VALUES ('escola_administradores', (SELECT COUNT(*) FROM public.escola_administradores WHERE user_id = p_user_id));
  RETURN QUERY VALUES ('escola_usuarios', (SELECT COUNT(*) FROM public.escola_usuarios WHERE user_id = p_user_id));
  RETURN QUERY VALUES ('alunos', (SELECT COUNT(*) FROM public.alunos WHERE profile_id = p_user_id));
  RETURN QUERY VALUES ('professores', (SELECT COUNT(*) FROM public.professores WHERE profile_id = p_user_id));
  RETURN QUERY VALUES ('matriculas', (SELECT COUNT(*) FROM public.matriculas WHERE exists (SELECT 1 FROM public.alunos a WHERE a.id = public.matriculas.aluno_id AND a.profile_id = p_user_id)));
  RETURN QUERY VALUES ('audit_logs', (SELECT COUNT(*) FROM public.audit_logs WHERE user_id = p_user_id));
END;
$$;


--
-- Name: get_propinas_por_turma(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_propinas_por_turma(p_ano_letivo integer) RETURNS TABLE(escola_id uuid, ano_letivo integer, turma_id uuid, turma_nome text, classe_label text, turno text, qtd_mensalidades bigint, qtd_em_atraso bigint, total_previsto numeric, total_pago numeric, total_em_atraso numeric, inadimplencia_pct numeric)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        l.escola_id,
        l.ano_referencia AS ano_letivo,
        t.id AS turma_id,
        t.nome AS turma_nome,
        c.nome AS classe_label,
        t.turno,
        count(l.id) AS qtd_mensalidades,
        count(l.id) FILTER (WHERE l.status IN ('atrasado', 'vencido')) AS qtd_em_atraso,
        COALESCE(sum(l.valor), 0) AS total_previsto,
        COALESCE(sum(l.valor_pago), 0) AS total_pago,
        COALESCE(sum(l.valor - l.valor_pago), 0) AS total_em_atraso,
        CASE
            WHEN count(l.id) > 0 THEN
                ROUND(
                    (count(l.id) FILTER (WHERE l.status IN ('atrasado', 'vencido')) * 100.0 / count(l.id))
                , 2)
            ELSE 0
        END AS inadimplencia_pct
    FROM
        public.financeiro_lancamentos l
    LEFT JOIN
        public.matriculas m ON l.matricula_id = m.id
    LEFT JOIN
        public.turmas t ON m.turma_id = t.id
    LEFT JOIN
        public.classes c ON t.classe_id = c.id
    WHERE
        l.escola_id = public.current_tenant_escola_id()
        AND l.ano_referencia = p_ano_letivo
        AND l.categoria = 'mensalidade'
        AND t.id IS NOT NULL
    GROUP BY
        l.escola_id,
        l.ano_referencia,
        t.id,
        c.id;
END;
$$;


--
-- Name: get_staging_alunos_summary(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_staging_alunos_summary(p_import_id uuid, p_escola_id uuid) RETURNS TABLE(turma_codigo text, ano_letivo integer, total_alunos bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
    SELECT
      sa.turma_codigo,
      sa.ano_letivo,
      count(sa.id)::bigint as total_alunos
    FROM
      public.staging_alunos sa
    WHERE
      sa.import_id = p_import_id
      AND sa.escola_id = p_escola_id
      AND sa.turma_codigo IS NOT NULL
    GROUP BY
      sa.turma_codigo,
      sa.ano_letivo;
END;
$$;


--
-- Name: get_user_escola_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_escola_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT escola_id
  FROM public.profiles
  WHERE user_id = (SELECT auth.uid());
$$;


--
-- Name: get_user_escola_id(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_escola_id(p_user_id uuid) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN (
    SELECT e.id
    FROM public.escolas e
    WHERE e.owner_id = p_user_id
    LIMIT 1
  );
END;
$$;


--
-- Name: get_user_export_json(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_export_json(p_user_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
SELECT jsonb_agg(t) FROM (
  SELECT jsonb_build_object('table','profiles','rows', (SELECT jsonb_agg(row_to_json(p)) FROM public.profiles p WHERE p.user_id = p_user_id)) AS t
  UNION ALL
  SELECT jsonb_build_object('table','audit_logs','rows', (SELECT jsonb_agg(row_to_json(a)) FROM public.audit_logs a WHERE a.user_id = p_user_id))
  UNION ALL
  SELECT jsonb_build_object('table','escola_usuarios','rows', (SELECT jsonb_agg(row_to_json(e)) FROM public.escola_usuarios e WHERE e.user_id = p_user_id))
  UNION ALL
  SELECT jsonb_build_object('table','alunos','rows', (SELECT jsonb_agg(row_to_json(al)) FROM public.alunos al WHERE al.profile_id = p_user_id))
  UNION ALL
  SELECT jsonb_build_object('table','professores','rows', (SELECT jsonb_agg(row_to_json(pr)) FROM public.professores pr WHERE pr.profile_id = p_user_id))
) s;
$$;


--
-- Name: get_user_tenant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_tenant() RETURNS uuid
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'pg_temp'
    AS $$
DECLARE
  result uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_profiles'
  ) THEN
    RETURN NULL;
  END IF;

  SELECT tenant_id
    INTO result
    FROM public.user_profiles
   WHERE auth_user_id = auth.uid()
   LIMIT 1;

  RETURN result;
END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (
    user_id, nome, email, role, numero_login, telefone, onboarding_finalizado
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Novo Usuário'),
    NEW.email,
    'encarregado'::user_role,
    COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone, NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone),
    false
  )
  ON CONFLICT (user_id) DO UPDATE SET
    nome = EXCLUDED.nome,
    email = EXCLUDED.email,
    numero_login = COALESCE(EXCLUDED.numero_login, public.profiles.numero_login),
    telefone = COALESCE(EXCLUDED.telefone, public.profiles.telefone);
  RETURN NEW;
END;
$$;


--
-- Name: handle_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: has_access_to_escola(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_access_to_escola(_escola_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select _escola_id = any(public.get_my_escola_ids());
$$;


--
-- Name: immutable_unaccent(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.immutable_unaccent(text) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    SET search_path TO 'public'
    AS $_$
  select public.unaccent($1);
$_$;


--
-- Name: importar_alunos(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.importar_alunos(p_import_id uuid, p_escola_id uuid) RETURNS TABLE(imported integer, skipped integer, errors integer)
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  v_imported integer := 0;
  v_skipped  integer := 0;
  v_errors   integer := 0;
  v_rec      public.staging_alunos%ROWTYPE;
  v_aluno_id uuid;
  v_target_profile_id uuid;
BEGIN
  -- Confere existência do registro de importação
  PERFORM 1 FROM public.import_migrations m WHERE m.id = p_import_id AND m.escola_id = p_escola_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Import % para escola % não encontrada', p_import_id, p_escola_id;
  END IF;

  -- Permite reprocessar o mesmo import limpando erros anteriores
  DELETE FROM public.import_errors WHERE import_id = p_import_id;

  FOR v_rec IN
    SELECT * FROM public.staging_alunos WHERE import_id = p_import_id
  LOOP
    -- Regras mínimas: precisa ao menos nome OU bi/email para criar
    IF v_rec.nome IS NULL AND v_rec.bi IS NULL AND v_rec.email IS NULL THEN
      v_errors := v_errors + 1;
      INSERT INTO public.import_errors(import_id, row_number, column_name, message, raw_value)
      VALUES (
        p_import_id,
        v_rec.id::int,
        'nome/bi/email',
        'Não há dados suficientes para criar/atualizar aluno (informe ao menos nome e BI ou email)',
        row_to_json(v_rec)::text
      );
      CONTINUE;
    END IF;

    BEGIN
      v_aluno_id := NULL;
      v_target_profile_id := NULL;

      -- 1) Tenta por profile_id
      IF v_rec.profile_id IS NOT NULL THEN
        SELECT a.id INTO v_aluno_id
        FROM public.alunos a
        WHERE a.escola_id = p_escola_id AND a.profile_id = v_rec.profile_id
        LIMIT 1;
      END IF;

      -- 2) Senão, por BI
      IF v_aluno_id IS NULL AND v_rec.bi IS NOT NULL THEN
        SELECT a.id INTO v_aluno_id
        FROM public.alunos a
        WHERE a.escola_id = p_escola_id AND a.bi_numero = v_rec.bi
        LIMIT 1;
      END IF;

      -- 3) Senão, por email
      IF v_aluno_id IS NULL AND v_rec.email IS NOT NULL THEN
        SELECT a.id INTO v_aluno_id
        FROM public.alunos a
        WHERE a.escola_id = p_escola_id AND a.email = v_rec.email
        LIMIT 1;
      END IF;

      IF v_aluno_id IS NULL THEN
        -- Inserir novo
        INSERT INTO public.alunos (
          id, escola_id, profile_id, data_nascimento, nome, bi_numero, email, telefone, import_id
        ) VALUES (
          gen_random_uuid(),
          p_escola_id,
          v_rec.profile_id,
          v_rec.data_nascimento,
          v_rec.nome,
          v_rec.bi,
          v_rec.email,
          v_rec.telefone,
          p_import_id
        );
        v_target_profile_id := v_rec.profile_id; -- pode ser NULL
      ELSE
        -- Atualizar existente (preenche apenas se vier valor; não sobrescreve com NULL)
        UPDATE public.alunos a SET
          nome            = COALESCE(v_rec.nome, a.nome),
          data_nascimento = COALESCE(v_rec.data_nascimento, a.data_nascimento),
          bi_numero       = COALESCE(v_rec.bi, a.bi_numero),
          email           = COALESCE(v_rec.email, a.email),
          telefone        = COALESCE(v_rec.telefone, a.telefone),
          profile_id      = COALESCE(a.profile_id, v_rec.profile_id),  -- só preenche se estava NULL
          import_id       = p_import_id
        WHERE a.id = v_aluno_id;
        SELECT a.profile_id INTO v_target_profile_id FROM public.alunos a WHERE a.id = v_aluno_id;
      END IF;

      -- Sincroniza email para profiles quando houver profile_id e email no staging
      IF v_rec.email IS NOT NULL AND v_target_profile_id IS NOT NULL THEN
        UPDATE public.profiles p
           SET email = v_rec.email
         WHERE p.user_id = v_target_profile_id
           AND COALESCE(btrim(p.email), '') = '';
      END IF;

      v_imported := v_imported + 1;

    EXCEPTION
      WHEN others THEN
        v_errors := v_errors + 1;
        INSERT INTO public.import_errors(import_id, row_number, column_name, message, raw_value)
        VALUES (
          p_import_id,
          v_rec.id::int,
          'alunos',
          SQLERRM,
          row_to_json(v_rec)::text
        );
    END;
  END LOOP;

  v_skipped := (SELECT COUNT(*) FROM public.staging_alunos WHERE import_id = p_import_id) - v_imported - v_errors;

  UPDATE public.import_migrations
     SET status       = 'imported',
         processed_at = now(),
         imported_rows= v_imported,
         error_rows   = v_errors
   WHERE id = p_import_id;

  RETURN QUERY SELECT v_imported, v_skipped, v_errors;
END;
$$;


--
-- Name: importar_alunos(uuid, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.importar_alunos(p_import_id uuid, p_escola_id uuid, p_ano_letivo integer) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  r RECORD;
  v_aluno_id uuid;
  v_turma_id uuid;
  v_curso_id uuid;
  
  v_total_imported int := 0;
  v_total_errors int := 0;
  v_turmas_created int := 0;
  v_cursos_created int := 0;
  
  v_clean_nome text;
  v_clean_telefone text;
  v_clean_aluno_telefone text;
  v_clean_turma_codigo text;
  v_clean_curso_codigo text;
  v_curso_codigo_mapeado text;
  v_clean_responsavel text;
  v_clean_nif text;
  v_clean_email text;
  v_clean_data_nascimento date;
  v_clean_sexo text;

  v_user_role text;
  v_new_curso_status text;
BEGIN
  SELECT current_setting('request.jwt.claims', true)::jsonb ->> 'role' INTO v_user_role;
  IF v_user_role = 'admin' OR v_user_role = 'super_admin' THEN
    v_new_curso_status := 'aprovado';
  ELSE
    v_new_curso_status := 'pendente';
  END IF;

  FOR r IN SELECT * FROM public.staging_alunos WHERE import_id = p_import_id LOOP
    BEGIN
      v_clean_nome := public.initcap_angola(r.nome);
      v_clean_responsavel := public.initcap_angola(r.encarregado_nome);
      v_clean_telefone := regexp_replace(r.encarregado_telefone, '[^0-9+]', '', 'g');
      v_clean_aluno_telefone := regexp_replace(r.telefone, '[^0-9+]', '', 'g');
      v_clean_turma_codigo := upper(regexp_replace(r.turma_codigo, '[^a-zA-Z0-9]', '', 'g'));
      v_clean_curso_codigo := upper(regexp_replace(r.curso_codigo, '[^a-zA-Z0-9]', '', 'g'));

      -- Map common Excel siglas to official curriculum presets
      v_curso_codigo_mapeado := coalesce(v_clean_curso_codigo, '');
      IF v_curso_codigo_mapeado <> '' THEN
        v_curso_codigo_mapeado := CASE v_curso_codigo_mapeado
          WHEN 'TI' THEN 'tecnico_informatica'
          WHEN 'INF' THEN 'tecnico_informatica'
          WHEN 'INFORMATICA' THEN 'tecnico_informatica'
          WHEN 'TINF' THEN 'tecnico_informatica'
          WHEN 'TG' THEN 'tecnico_gestao'
          WHEN 'GESTAO' THEN 'tecnico_gestao'
          WHEN 'TECGEST' THEN 'tecnico_gestao'
          WHEN 'EP' THEN 'primario_base'
          WHEN 'EPB' THEN 'primario_base'
          WHEN 'EPU' THEN 'primario_base'
          WHEN 'EB' THEN 'primario_base'
          WHEN 'CFB' THEN 'puniv'
          WHEN 'PUNIV' THEN 'puniv'
          ELSE v_curso_codigo_mapeado
        END;
      END IF;

      v_clean_nif := NULLIF(upper(trim(r.nif)), '');
      v_clean_email := lower(NULLIF(trim(r.email), ''));
      v_clean_data_nascimento := NULLIF(r.data_nascimento, '')::date;
      v_clean_sexo := UPPER(NULLIF(trim(r.sexo), ''));

      IF v_clean_telefone IS NULL OR v_clean_telefone = '' THEN 
         RAISE EXCEPTION 'Telefone do encarregado é inválido ou vazio.'; 
      END IF;
      
      IF v_clean_turma_codigo IS NULL OR v_clean_turma_codigo = '' THEN
        RAISE EXCEPTION 'O código da turma é obrigatório.';
      END IF;

      INSERT INTO public.alunos (
        escola_id, numero_processo, nome, nome_completo, data_nascimento, sexo,
        telefone, bi_numero, nif, email,
        encarregado_nome, encarregado_telefone, encarregado_email,
        responsavel, responsavel_nome, responsavel_contato, telefone_responsavel,
        status, import_id
      )
      VALUES (
        p_escola_id, r.numero_processo, v_clean_nome, v_clean_nome, v_clean_data_nascimento, v_clean_sexo,
        NULLIF(v_clean_aluno_telefone, ''), upper(trim(r.bi_numero)), v_clean_nif, v_clean_email,
        v_clean_responsavel,
        v_clean_telefone,
        lower(trim(r.encarregado_email)),
        v_clean_responsavel, v_clean_responsavel, v_clean_telefone, v_clean_telefone,
        'ativo', p_import_id
      )
      ON CONFLICT (escola_id, numero_processo) DO UPDATE SET
        nome = EXCLUDED.nome,
        nome_completo = EXCLUDED.nome_completo,
        data_nascimento = COALESCE(EXCLUDED.data_nascimento, public.alunos.data_nascimento),
        sexo = COALESCE(EXCLUDED.sexo, public.alunos.sexo),
        telefone = COALESCE(EXCLUDED.telefone, public.alunos.telefone),
        bi_numero = EXCLUDED.bi_numero,
        nif = COALESCE(EXCLUDED.nif, public.alunos.nif),
        email = COALESCE(EXCLUDED.email, public.alunos.email),
        encarregado_nome = COALESCE(EXCLUDED.encarregado_nome, public.alunos.encarregado_nome),
        encarregado_telefone = COALESCE(EXCLUDED.encarregado_telefone, public.alunos.encarregado_telefone),
        encarregado_email = COALESCE(EXCLUDED.encarregado_email, public.alunos.encarregado_email),
        responsavel = COALESCE(EXCLUDED.responsavel, public.alunos.responsavel),
        responsavel_nome = COALESCE(EXCLUDED.responsavel_nome, public.alunos.responsavel_nome),
        responsavel_contato = COALESCE(EXCLUDED.responsavel_contato, public.alunos.responsavel_contato),
        telefone_responsavel = COALESCE(EXCLUDED.telefone_responsavel, public.alunos.telefone_responsavel),
        status = COALESCE(EXCLUDED.status, public.alunos.status),
        import_id = COALESCE(EXCLUDED.import_id, public.alunos.import_id),
        updated_at = now()
      RETURNING id INTO v_aluno_id;

      v_curso_id := NULL;
      IF v_curso_codigo_mapeado IS NOT NULL AND v_curso_codigo_mapeado <> '' THEN
        SELECT id INTO v_curso_id FROM public.cursos
        WHERE escola_id = p_escola_id
          AND upper(regexp_replace(codigo, '[^a-zA-Z0-9]', '', 'g')) = v_curso_codigo_mapeado;

        IF v_curso_id IS NULL THEN
          INSERT INTO public.cursos (escola_id, nome, codigo, status_aprovacao, import_id)
          VALUES (
            p_escola_id,
            'Curso ' || v_curso_codigo_mapeado,
            v_curso_codigo_mapeado,
            v_new_curso_status,
            p_import_id
          )
          RETURNING id INTO v_curso_id;
          v_cursos_created := v_cursos_created + 1;
        END IF;
      END IF;

      v_turma_id := NULL;
      SELECT id INTO v_turma_id FROM public.turmas 
      WHERE escola_id = p_escola_id 
        AND ano_letivo = p_ano_letivo
        AND upper(regexp_replace(turma_codigo, '[^a-zA-Z0-9]', '', 'g')) = v_clean_turma_codigo;

      IF v_turma_id IS NULL THEN
        INSERT INTO public.turmas (
          escola_id, ano_letivo, turma_codigo, nome, 
          status_validacao, curso_id, import_id
        )
        VALUES (
          p_escola_id, p_ano_letivo, r.turma_codigo, 
          r.turma_codigo || ' (Imp. Auto)', 'rascunho', 
          v_curso_id,
          p_import_id
        )
        RETURNING id INTO v_turma_id;
        
        v_turmas_created := v_turmas_created + 1;
      END IF;

      INSERT INTO public.matriculas (
        escola_id, aluno_id, turma_id, ano_letivo, status, ativo, 
        numero_matricula, data_matricula
      )
      VALUES (
        p_escola_id, v_aluno_id, v_turma_id, p_ano_letivo, 'ativo', true,
        (SELECT numero_processo FROM public.alunos WHERE id = v_aluno_id) || '/' || p_ano_letivo, now()
      )
      ON CONFLICT (escola_id, aluno_id, ano_letivo) DO NOTHING;

      v_total_imported := v_total_imported + 1;

    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.import_errors (import_id, row_number, message, raw_value)
      VALUES (p_import_id, r.row_number, SQLERRM, r.nome);
      v_total_errors := v_total_errors + 1;
    END;
  END LOOP;

  RETURN json_build_object(
    'imported', v_total_imported, 
    'errors', v_total_errors, 
    'turmas_created', v_turmas_created,
    'cursos_created', v_cursos_created
  );
END;
$$;


--
-- Name: importar_alunos_v2(uuid, integer, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.importar_alunos_v2(p_escola_id uuid, p_ano_letivo integer, p_import_id uuid DEFAULT NULL::uuid, p_alunos jsonb DEFAULT '[]'::jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_ano_id uuid;
  v_total int := 0;
  v_sucesso int := 0;
  v_erros int := 0;
  v_detail jsonb := '[]'::jsonb;
  rec jsonb;
  v_aluno_id uuid;
  v_turma_id uuid;
  v_turma_nome text;
  v_curso_id uuid;
  v_classe_id uuid;
  v_bi text;
  v_nome text;
begin
  if p_escola_id is null then
    raise exception 'p_escola_id é obrigatório';
  end if;
  if p_ano_letivo is null then
    raise exception 'p_ano_letivo é obrigatório';
  end if;

  -- Garante ano letivo e ativa-o
  insert into anos_letivos (escola_id, ano, data_inicio, data_fim, ativo)
  values (p_escola_id, p_ano_letivo, to_date(p_ano_letivo::text || '-01-01','YYYY-MM-DD'), to_date((p_ano_letivo+1)::text || '-12-31','YYYY-MM-DD'), true)
  on conflict (escola_id, ano) do update set ativo = true
  returning id into v_ano_id;

  -- Desativa outros anos da escola
  update anos_letivos set ativo = false where escola_id = p_escola_id and id <> v_ano_id;

  -- Loop alunos
  for rec in select * from jsonb_array_elements(p_alunos) loop
    v_total := v_total + 1;
    v_aluno_id := coalesce((rec->>'aluno_id')::uuid, gen_random_uuid());
    v_turma_id := (rec->>'turma_id')::uuid;
    v_turma_nome := nullif(rec->>'turma_nome','');
    v_curso_id := (rec->>'curso_id')::uuid;
    v_classe_id := (rec->>'classe_id')::uuid;
    v_bi := nullif(rec->>'bi','');
    v_nome := nullif(rec->>'nome','');

    begin
      if v_nome is null then
        raise exception 'Nome do aluno ausente';
      end if;

      -- Upsert aluno
      insert into alunos(id, escola_id, nome, bi_numero, import_id)
      values (v_aluno_id, p_escola_id, v_nome, v_bi, p_import_id)
      on conflict (id) do update set nome = excluded.nome, bi_numero = excluded.bi_numero;

      -- Resolver turma se não enviada
      if v_turma_id is null then
        if v_curso_id is not null and v_classe_id is not null then
          select id into v_turma_id
          from turmas
          where escola_id = p_escola_id
            and curso_id = v_curso_id
            and classe_id = v_classe_id
            and ano_letivo = p_ano_letivo
          limit 1;
        end if;

        if v_turma_id is null and v_turma_nome is not null then
          select id into v_turma_id
          from turmas
          where escola_id = p_escola_id
            and nome = v_turma_nome
            and ano_letivo = p_ano_letivo
          limit 1;
        end if;
      end if;

      -- Cria turma mínima se necessário (turno M padrão)
      if v_turma_id is null then
        if v_curso_id is null or v_classe_id is null then
          raise exception 'Sem turma e sem curso/classe para criar';
        end if;
        insert into turmas (escola_id, nome, curso_id, classe_id, turno, ano_letivo)
        values (p_escola_id, coalesce(v_turma_nome, 'Turma '||v_classe_id||' '||p_ano_letivo), v_curso_id, v_classe_id, 'M', p_ano_letivo)
        returning id into v_turma_id;
      end if;

      -- Matricula
      insert into matriculas (id, escola_id, aluno_id, turma_id, ano_letivo, ano_letivo_id, status, import_id)
      values (gen_random_uuid(), p_escola_id, v_aluno_id, v_turma_id, p_ano_letivo, v_ano_id, 'ativa', p_import_id)
      on conflict (aluno_id, turma_id) do nothing;

      v_sucesso := v_sucesso + 1;
      v_detail := v_detail || jsonb_build_array(jsonb_build_object('aluno', v_nome, 'status', 'ok'));
    exception when others then
      v_erros := v_erros + 1;
      v_detail := v_detail || jsonb_build_array(jsonb_build_object('aluno', v_nome, 'status', 'erro', 'msg', SQLERRM));
    end;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'total', v_total,
    'sucesso', v_sucesso,
    'erros', v_erros,
    'detail', v_detail
  );
end;
$$;


--
-- Name: FUNCTION importar_alunos_v2(p_escola_id uuid, p_ano_letivo integer, p_import_id uuid, p_alunos jsonb); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.importar_alunos_v2(p_escola_id uuid, p_ano_letivo integer, p_import_id uuid, p_alunos jsonb) IS 'Importa alunos alinhando com anos_letivos, turmas e matriculas (modelo novo)';


--
-- Name: initcap_angola(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.initcap_angola(text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public'
    AS $_$
BEGIN
  -- Converte "JOÃO DA SILVA" para "João da Silva"
  RETURN initcap(lower(trim($1)));
END;
$_$;


--
-- Name: is_admin_escola(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin_escola() RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select public.is_escola_admin(public.current_tenant_escola_id());
$$;


--
-- Name: is_escola_admin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_escola_admin(p_escola_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_temp'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.escola_usuarios
    WHERE escola_id = p_escola_id
      AND user_id = auth.uid()
      AND papel IN ('admin', 'admin_escola')
  );
END;
$$;


--
-- Name: is_escola_diretor(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_escola_diretor(p_escola_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_temp'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.escola_usuarios
    WHERE escola_id = p_escola_id
      AND user_id = auth.uid()
      AND papel = 'staff_admin'
  );
END;
$$;


--
-- Name: is_escola_member(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_escola_member(p_escola_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_temp'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.escola_usuarios
    WHERE escola_id = p_escola_id
      AND user_id = auth.uid()
  );
END;
$$;


--
-- Name: is_membro_escola(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_membro_escola(escola_uuid uuid) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.escola_usuarios eu
    where eu.user_id = (select auth.uid())
      and eu.escola_id = escola_uuid
  );
$$;


--
-- Name: is_staff_escola(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_staff_escola(escola_uuid uuid) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.escola_usuarios eu
    where eu.user_id = (select auth.uid())
      and eu.escola_id = escola_uuid
      and eu.papel in ('admin_escola', 'secretaria', 'staff_admin')
  );
$$;


--
-- Name: is_super_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_super_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'super_admin'
  );
$$;


--
-- Name: log_audit_event(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_audit_event() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_temp'
    AS $$
begin
  insert into public.audit_logs (user_id, acao, tabela, registro_id, meta)
  values (
    auth.uid(),
    tg_op,
    tg_table_name,
    coalesce(new.id::text, old.id::text),
    case 
      when tg_op = 'INSERT' then to_jsonb(new)
      when tg_op = 'DELETE' then to_jsonb(old)
      else jsonb_build_object('old', old, 'new', new)
    end
  );
  return coalesce(new, old);
end;
$$;


--
-- Name: log_disciplina_auditoria(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_disciplina_auditoria() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_temp'
    AS $$
begin
  if TG_OP = 'INSERT' then
    insert into public.disciplinas_auditoria (disciplina_id, escola_id, acao, dados)
    values (NEW.id, NEW.escola_id, 'criada', to_jsonb(NEW));
    return NEW;
  elsif TG_OP = 'UPDATE' then
    insert into public.disciplinas_auditoria (disciplina_id, escola_id, acao, dados)
    values (NEW.id, NEW.escola_id, 'atualizada', to_jsonb(NEW));
    return NEW;
  elsif TG_OP = 'DELETE' then
    insert into public.disciplinas_auditoria (disciplina_id, escola_id, acao, dados)
    values (OLD.id, OLD.escola_id, 'deletada', to_jsonb(OLD));
    return OLD;
  end if;
  return null;
end;
$$;


--
-- Name: log_escola_auditoria(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_escola_auditoria() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_temp'
    AS $$
begin
  if TG_OP = 'INSERT' then
    insert into public.escola_auditoria (escola_id, acao, mensagem, dados)
    values (NEW.id, 'criada', 'Escola criada', to_jsonb(NEW));
    return NEW;
  elsif TG_OP = 'UPDATE' then
    insert into public.escola_auditoria (escola_id, acao, mensagem, dados)
    values (NEW.id, 'atualizada', 'Escola atualizada', to_jsonb(NEW));
    return NEW;
  elsif TG_OP = 'DELETE' then
    insert into public.escola_auditoria (escola_id, acao, mensagem, dados)
    values (OLD.id, 'deletada', 'Escola removida', to_jsonb(OLD));
    return OLD;
  end if;
  return null;
end;
$$;


--
-- Name: log_turma_auditoria(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_turma_auditoria() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_temp'
    AS $$
begin
  if TG_OP = 'INSERT' then
    insert into public.turmas_auditoria (turma_id, escola_id, acao, dados)
    values (NEW.id, NEW.escola_id, 'criada', to_jsonb(NEW));
    return NEW;
  elsif TG_OP = 'UPDATE' then
    insert into public.turmas_auditoria (turma_id, escola_id, acao, dados)
    values (NEW.id, NEW.escola_id, 'atualizada', to_jsonb(NEW));
    return NEW;
  elsif TG_OP = 'DELETE' then
    insert into public.turmas_auditoria (turma_id, escola_id, acao, dados)
    values (OLD.id, OLD.escola_id, 'deletada', to_jsonb(OLD));
    return OLD;
  end if;
  return null;
end;
$$;


--
-- Name: matricula_counter_floor(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.matricula_counter_floor(p_escola_id uuid) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_floor bigint := 0;
BEGIN
  v_floor := GREATEST(
    COALESCE((
      SELECT MAX(NULLIF(regexp_replace(m.numero_matricula::text, '[^0-9]', '', 'g'), '')::bigint)
      FROM public.matriculas m
      WHERE m.escola_id = p_escola_id
    ), 0),
    COALESCE((
      SELECT MAX(NULLIF(regexp_replace(p.numero_login::text, '[^0-9]', '', 'g'), '')::bigint)
      FROM public.profiles p
      WHERE p.numero_login IS NOT NULL AND p.escola_id = p_escola_id
    ), 0),
    COALESCE((
      SELECT MAX(NULLIF(regexp_replace(p2.numero_login::text, '[^0-9]', '', 'g'), '')::bigint)
      FROM public.profiles p2
      WHERE p2.numero_login IS NOT NULL
    ), 0)
  );

  RETURN v_floor;
END;
$$;


--
-- Name: matricular_em_massa(uuid, uuid, text, integer, text, text, integer, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.matricular_em_massa(p_import_id uuid, p_escola_id uuid, p_curso_codigo text, p_classe_numero integer, p_turno_codigo text, p_turma_letra text, p_ano_letivo integer, p_turma_id uuid) RETURNS TABLE(success_count integer, error_count integer, errors jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_row record;
  v_success integer := 0;
  v_errors  integer := 0;
  v_error_details jsonb := '[]'::jsonb;
BEGIN
  -- Valida turma
  IF NOT EXISTS (SELECT 1 FROM public.turmas t WHERE t.id = p_turma_id AND t.escola_id = p_escola_id) THEN
    RAISE EXCEPTION 'Turma inválida para esta escola';
  END IF;

  -- Loop no Staging
  FOR v_row IN
    SELECT sa.id AS staging_id, sa.nome AS staging_nome, sa.bi, sa.email, sa.telefone, sa.profile_id, a.id AS aluno_id
    FROM public.staging_alunos sa
    LEFT JOIN public.alunos a ON a.escola_id = p_escola_id AND (
       (sa.profile_id IS NOT NULL AND a.profile_id = sa.profile_id) OR
       (sa.bi IS NOT NULL AND a.bi_numero = sa.bi) OR
       (sa.email IS NOT NULL AND a.email = sa.email) OR
       (sa.telefone IS NOT NULL AND a.telefone = sa.telefone)
    )
    WHERE sa.import_id = p_import_id AND sa.escola_id = p_escola_id
      AND sa.ano_letivo = p_ano_letivo AND sa.curso_codigo = p_curso_codigo
      AND sa.classe_numero = p_classe_numero AND sa.turno_codigo = p_turno_codigo
      AND sa.turma_letra = p_turma_letra
  LOOP
    IF v_row.aluno_id IS NULL THEN
      v_errors := v_errors + 1;
      v_error_details := v_error_details || jsonb_build_array(jsonb_build_object(
        'staging_id', v_row.staging_id, 'nome', v_row.staging_nome, 'erro', 'Aluno não encontrado'
      ));
      CONTINUE;
    END IF;

    BEGIN
      -- Delega tudo para a função central (gera número e sincroniza login)
      PERFORM public.create_or_confirm_matricula(v_row.aluno_id, p_turma_id, p_ano_letivo);

      v_success := v_success + 1;

      -- (Opcional) marcar linha do staging como processada
      UPDATE public.staging_alunos
      SET processed_at = now()
      WHERE id = v_row.staging_id;

    EXCEPTION WHEN others THEN
      v_errors := v_errors + 1;
      v_error_details := v_error_details || jsonb_build_array(jsonb_build_object(
        'staging_id', v_row.staging_id,
        'aluno', v_row.staging_nome,
        'erro', SQLERRM
      ));
    END;
  END LOOP;

  RETURN QUERY SELECT v_success, v_errors, v_error_details;
END;
$$;


--
-- Name: matricular_em_massa_por_turma(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.matricular_em_massa_por_turma(p_import_id uuid, p_escola_id uuid, p_turma_id uuid) RETURNS TABLE(success_count integer, error_count integer, errors jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_row record;
  v_success integer := 0;
  v_errors integer := 0;
  v_error_details jsonb := '[]'::jsonb;
  v_turma record;
  v_ano_letivo_num integer;
  v_classe_num integer;
  v_turno_codigo text;
  v_letra text;
  v_aluno_id uuid;
BEGIN
  -- Validação básica da turma
  SELECT * INTO v_turma FROM public.turmas t WHERE t.id = p_turma_id AND t.escola_id = p_escola_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Turma inválida para esta escola';
  END IF;

  v_ano_letivo_num := v_turma.ano_letivo;
  v_classe_num := v_turma.classe_numero;
  v_turno_codigo := v_turma.turno_codigo;

  -- Derivar letra da turma a partir do nome (último token maiúsculo)
  v_letra := NULL;
  IF v_turma.nome IS NOT NULL THEN
    SELECT UPPER(regexp_replace(trim(regexp_replace(v_turma.nome, '^.*\s', '')), '[^A-Z]', '', 'g')) INTO v_letra;
    IF v_letra = '' THEN v_letra := NULL; END IF;
  END IF;

  -- Loop pelos registros do staging compatíveis
  FOR v_row IN
    SELECT sa.*
    FROM public.staging_alunos sa
    WHERE sa.import_id = p_import_id
      AND sa.escola_id = p_escola_id
      AND (v_ano_letivo_num IS NULL OR sa.ano_letivo = v_ano_letivo_num)
      AND (v_classe_num    IS NULL OR sa.classe_numero = v_classe_num)
      AND (v_turno_codigo  IS NULL OR sa.turno_codigo = v_turno_codigo)
      AND (v_letra         IS NULL OR sa.turma_letra = v_letra)
  LOOP
    -- Matching de aluno existente
    v_aluno_id := NULL;
    IF v_row.profile_id IS NOT NULL THEN
      SELECT a.id INTO v_aluno_id FROM public.alunos a WHERE a.escola_id = p_escola_id AND a.profile_id = v_row.profile_id LIMIT 1;
    END IF;
    IF v_aluno_id IS NULL AND v_row.bi IS NOT NULL THEN
      SELECT a.id INTO v_aluno_id FROM public.alunos a WHERE a.escola_id = p_escola_id AND a.bi_numero = v_row.bi LIMIT 1;
    END IF;
    IF v_aluno_id IS NULL AND v_row.email IS NOT NULL THEN
      SELECT a.id INTO v_aluno_id FROM public.alunos a WHERE a.escola_id = p_escola_id AND a.email = v_row.email LIMIT 1;
    END IF;

    IF v_aluno_id IS NULL THEN
      v_errors := v_errors + 1;
      v_error_details := v_error_details || jsonb_build_array(jsonb_build_object(
        'staging_id', v_row.id,
        'nome', v_row.nome,
        'erro', 'Aluno não encontrado (profile/BI/email)'
      ));
      CONTINUE;
    END IF;

    BEGIN
      PERFORM public.create_or_confirm_matricula(v_aluno_id, p_turma_id, v_turma.ano_letivo);
      v_success := v_success + 1;
    EXCEPTION WHEN others THEN
      v_errors := v_errors + 1;
      v_error_details := v_error_details || jsonb_build_array(jsonb_build_object(
        'staging_id', v_row.id,
        'aluno', v_row.nome,
        'erro', SQLERRM
      ));
    END;
  END LOOP;

  RETURN QUERY SELECT v_success, v_errors, v_error_details;
END;
$$;


--
-- Name: matricular_lista_alunos(uuid, uuid, integer, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.matricular_lista_alunos(p_escola_id uuid, p_turma_id uuid, p_ano_letivo integer, p_aluno_ids uuid[]) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_sucesso int := 0;
  v_erros int := 0;
  v_aluno_id uuid;
  v_processo text;
BEGIN
  PERFORM 1 FROM public.turmas WHERE id = p_turma_id AND escola_id = p_escola_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Turma não pertence a esta escola'; END IF;

  FOREACH v_aluno_id IN ARRAY p_aluno_ids LOOP
    BEGIN
      SELECT numero_processo INTO v_processo FROM public.alunos WHERE id = v_aluno_id;

      INSERT INTO public.matriculas (
        escola_id, aluno_id, turma_id, ano_letivo, status, ativo,
        numero_matricula, data_matricula
      )
      VALUES (
        p_escola_id, v_aluno_id, p_turma_id, p_ano_letivo, 'ativo', true,
        v_processo || '/' || p_ano_letivo, now()
      )
      ON CONFLICT (escola_id, aluno_id, ano_letivo)
      DO UPDATE SET
        turma_id = EXCLUDED.turma_id,
        status = 'ativo',
        ativo = true,
        data_matricula = COALESCE(public.matriculas.data_matricula, EXCLUDED.data_matricula);

      v_sucesso := v_sucesso + 1;
    EXCEPTION WHEN OTHERS THEN
      v_erros := v_erros + 1;
    END;
  END LOOP;

  RETURN json_build_object('sucesso', v_sucesso, 'erros', v_erros);
END;
$$;


--
-- Name: matriculas_status_before_ins_upd(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.matriculas_status_before_ins_upd() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.status := public.canonicalize_matricula_status_text(NEW.status);
  IF NEW.status IS NULL OR btrim(NEW.status) = '' THEN
    NEW.status := 'indefinido';
  END IF;
  RETURN NEW;
END
$$;


--
-- Name: move_profile_to_archive(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.move_profile_to_archive(p_user_id uuid, p_performed_by uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  -- insert into archive if exists
  INSERT INTO public.profiles_archive (
    user_id, nome, avatar_url, created_at, updated_at, role, email, escola_id,
    onboarding_finalizado, telefone, global_role, current_escola_id, numero_login, deleted_at, archived_by
  )
  SELECT user_id, nome, avatar_url, created_at, updated_at, role, email, escola_id,
    onboarding_finalizado, telefone, global_role, current_escola_id, numero_login, deleted_at, p_performed_by
  FROM public.profiles
  WHERE user_id = p_user_id
  ON CONFLICT (user_id) DO UPDATE SET
    nome = EXCLUDED.nome,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = EXCLUDED.updated_at,
    role = EXCLUDED.role,
    email = EXCLUDED.email,
    escola_id = EXCLUDED.escola_id,
    onboarding_finalizado = EXCLUDED.onboarding_finalizado,
    telefone = EXCLUDED.telefone,
    global_role = EXCLUDED.global_role,
    current_escola_id = EXCLUDED.current_escola_id,
    numero_login = EXCLUDED.numero_login,
    deleted_at = EXCLUDED.deleted_at,
    archived_at = now(),
    archived_by = EXCLUDED.archived_by;

  -- set soft-delete on original row
  UPDATE public.profiles SET deleted_at = now() WHERE user_id = p_user_id;

  -- insert audit
  INSERT INTO public.audit_logs(user_id, acao, tabela, registro_id, meta, created_at)
  VALUES (p_performed_by, 'archive_profile', 'profiles', p_user_id::text, jsonb_build_object('action','archive','target_user', p_user_id::text), now());
END;
$$;


--
-- Name: next_matricula_number(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.next_matricula_number(p_escola_id uuid) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_floor bigint := public.matricula_counter_floor(p_escola_id);
  v_next bigint;
BEGIN
  INSERT INTO public.matricula_counters(escola_id, last_value, updated_at)
  VALUES (
    p_escola_id,
    GREATEST(v_floor + 1, 1),
    now()
  )
  ON CONFLICT (escola_id) DO UPDATE
    SET last_value = GREATEST(matricula_counters.last_value + 1, v_floor + 1),
        updated_at = now()
  RETURNING last_value INTO v_next;

  RETURN v_next;
END;
$$;


--
-- Name: next_numero_processo(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.next_numero_processo(p_escola_id uuid, p_year integer) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_next bigint;
BEGIN
  INSERT INTO public.aluno_processo_counters (escola_id, last_value) VALUES (p_escola_id, 0) ON CONFLICT (escola_id) DO NOTHING;
  UPDATE public.aluno_processo_counters SET last_value = last_value + 1 WHERE escola_id = p_escola_id RETURNING last_value INTO v_next;
  RETURN p_year::text || '-' || lpad(v_next::text, 6, '0');
END;
$$;


--
-- Name: normalize_course_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalize_course_code() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.course_code IS NOT NULL THEN
    NEW.course_code := upper(regexp_replace(trim(NEW.course_code), '\\s+', '', 'g'));
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: normalize_date(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalize_date(input_text text) RETURNS date
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  candidate date;
  formats text[] := ARRAY['YYYY-MM-DD', 'DD/MM/YYYY', 'DD-MM-YYYY', 'MM/DD/YYYY', 'YYYY/MM/DD'];
  fmt text;
BEGIN
  IF input_text IS NULL OR trim(input_text) = '' THEN
    RETURN NULL;
  END IF;

  FOR fmt IN SELECT unnest(formats) LOOP
    BEGIN
      candidate := to_date(input_text, fmt);
      EXIT WHEN candidate IS NOT NULL;
    EXCEPTION
      WHEN others THEN
        candidate := NULL;
    END;
  END LOOP;

  RETURN candidate;
END;
$$;


--
-- Name: normalize_text(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalize_text(input_text text) RETURNS text
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  cleaned text;
BEGIN
  IF input_text IS NULL THEN
    RETURN NULL;
  END IF;

  cleaned := lower(unaccent(input_text));
  cleaned := regexp_replace(cleaned, '\\s+', ' ', 'g');
  cleaned := trim(cleaned);
  IF cleaned = '' THEN
    RETURN NULL;
  END IF;
  RETURN cleaned;
END;
$$;


--
-- Name: normalize_turma_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalize_turma_code() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.turma_code IS NOT NULL THEN
    NEW.turma_code := upper(regexp_replace(trim(NEW.turma_code), '\\s+', '', 'g'));
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: normalize_turma_code(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalize_turma_code(p_code text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public'
    AS $_$
DECLARE
  v_code text := COALESCE(p_code, '');
BEGIN
  v_code := upper(trim(v_code));

  -- Converte variações de hífen (en/em dash, minus sign, non-breaking) para '-'
  v_code := translate(v_code, '–—−‑', '----');

  -- Espaços/underscores viram hífen e qualquer símbolo vira separador
  v_code := regexp_replace(v_code, '[\s_]+', '-', 'g');
  v_code := regexp_replace(v_code, '[^A-Z0-9-]', '-', 'g');

  -- Evita múltiplos hífens e remove nos extremos
  v_code := regexp_replace(v_code, '-+', '-', 'g');
  v_code := regexp_replace(v_code, '^-|-$', '', 'g');

  IF v_code = '' THEN
    RETURN NULL;
  END IF;

  RETURN v_code;
END;
$_$;


--
-- Name: partitions_info(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.partitions_info() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  result jsonb := '[]'::jsonb;
begin
  with part_tables as (
    select c.oid, n.nspname as schema, c.relname as name
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname='public' and c.relname in ('frequencias','lancamentos')
  ), parts as (
    select pt.name as parent, c.relname as partition
    from part_tables pt
    join pg_inherits i on i.inhparent = pt.oid
    join pg_class c on c.oid = i.inhrelid
  ), agg as (
    select parent, array_agg(partition order by partition) as partitions
    from parts group by parent
  )
  select jsonb_agg(jsonb_build_object('parent', parent, 'partitions', partitions)) into result from agg;

  return coalesce(result, '[]'::jsonb);
end;
$$;


--
-- Name: preview_matricula_number(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.preview_matricula_number(p_escola_id uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  v_last bigint;
  v_init bigint;
BEGIN
  -- 1) Tenta usar o contador oficial, se existir
  SELECT last_value
  INTO v_last
  FROM public.matricula_counters
  WHERE escola_id = p_escola_id;

  -- 2) Se não houver contador ainda, baseia-se no histórico legado
  IF v_last IS NULL THEN
    SELECT COALESCE(
      MAX(
        (regexp_replace(numero_matricula, '[^0-9]', '', 'g'))::bigint
      ),
      0
    )
    INTO v_init
    FROM public.matriculas
    WHERE escola_id = p_escola_id
      AND numero_matricula IS NOT NULL
      -- garante que a string reduzida contenha apenas dígitos
      AND regexp_replace(numero_matricula, '[^0-9]', '', 'g') ~ '^[0-9]+$';

    v_last := v_init;
  END IF;

  -- 2.1) Blindagem extra: se ainda assim vier NULL por algum dado estranho, zera.
  IF v_last IS NULL THEN
    v_last := 0;
  END IF;

  -- 3) Retorna o próximo sugerido sem consumir/alterar estado
  RETURN lpad((v_last + 1)::text, 6, '0');
END;
$_$;


--
-- Name: refresh_all_materialized_views(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_all_materialized_views() RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'pg_temp'
    AS $$
begin
  begin execute 'refresh materialized view public.mv_financeiro_escola_dia'; exception when undefined_table then null; end;
  begin execute 'refresh materialized view public.mv_freq_por_turma_dia'; exception when undefined_table then null; end;
  begin execute 'refresh materialized view public.mv_media_por_curso'; exception when undefined_table then null; end;
end$$;


--
-- Name: registrar_pagamento(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.registrar_pagamento(p_mensalidade_id uuid, p_metodo_pagamento text, p_observacao text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_mensalidade public.mensalidades%ROWTYPE;
  v_user_id uuid := auth.uid();
BEGIN
  -- Lock otimista para evitar concorrência em múltiplas baixas
  SELECT * INTO v_mensalidade
  FROM public.mensalidades
  WHERE id = p_mensalidade_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Mensalidade não encontrada.');
  END IF;

  IF v_mensalidade.status = 'pago' THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Esta mensalidade já foi paga.');
  END IF;

  UPDATE public.mensalidades
  SET
    status = 'pago',
    valor_pago_total = COALESCE(v_mensalidade.valor_previsto, v_mensalidade.valor),
    data_pagamento_efetiva = CURRENT_DATE,
    metodo_pagamento = p_metodo_pagamento,
    observacao = p_observacao,
    updated_at = now(),
    updated_by = v_user_id
  WHERE id = p_mensalidade_id;

  RETURN jsonb_build_object(
    'ok', true,
    'id', p_mensalidade_id,
    'valor', COALESCE(v_mensalidade.valor_previsto, v_mensalidade.valor),
    'mensagem', 'Pagamento registado com sucesso.'
  );
END;
$$;


--
-- Name: registrar_venda_avulsa(uuid, uuid, uuid, integer, numeric, numeric, public.metodo_pagamento_enum, public.financeiro_status, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.registrar_venda_avulsa(p_escola_id uuid, p_aluno_id uuid, p_item_id uuid, p_quantidade integer, p_valor_unit numeric, p_desconto numeric DEFAULT 0, p_metodo_pagamento public.metodo_pagamento_enum DEFAULT 'numerario'::public.metodo_pagamento_enum, p_status public.financeiro_status DEFAULT 'pago'::public.financeiro_status, p_descricao text DEFAULT NULL::text, p_created_by uuid DEFAULT NULL::uuid) RETURNS TABLE(lancamento_id uuid, estoque_atual integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_item financeiro_itens%rowtype;
  v_total numeric(12,2);
  v_desc text;
begin
  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'Quantidade inválida';
  end if;

  select *
    into v_item
    from financeiro_itens
   where id = p_item_id
     and escola_id = p_escola_id
   for update;

  if not found then
    raise exception 'Item não encontrado para a escola';
  end if;

  if v_item.controla_estoque and v_item.estoque_atual < p_quantidade then
    raise exception 'Estoque insuficiente';
  end if;

  v_total := coalesce(p_valor_unit, v_item.preco) * p_quantidade;
  v_desc := coalesce(p_descricao, 'Venda de ' || v_item.nome);

  update financeiro_itens
     set estoque_atual = estoque_atual - case when v_item.controla_estoque then p_quantidade else 0 end,
         updated_at = now()
   where id = v_item.id
   returning estoque_atual into estoque_atual;

  insert into financeiro_lancamentos(
    escola_id,
    aluno_id,
    matricula_id,
    tipo,
    origem,
    descricao,
    valor_original,
    valor_multa,
    valor_desconto,
    status,
    data_pagamento,
    metodo_pagamento,
    created_by
  ) values (
    p_escola_id,
    p_aluno_id,
    null,
    'debito',
    'venda_avulsa',
    v_desc,
    v_total,
    0,
    coalesce(p_desconto, 0),
    coalesce(p_status, 'pago'),
    case when coalesce(p_status, 'pago') = 'pago' then now() else null end,
    p_metodo_pagamento,
    p_created_by
  ) returning id into lancamento_id;

  return next;
end;
$$;


--
-- Name: rematricula_em_massa(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rematricula_em_massa(p_escola_id uuid, p_origem_turma_id uuid, p_destino_turma_id uuid) RETURNS TABLE(inserted integer, skipped integer, errors jsonb)
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  v_dest_session uuid;
  v_errs jsonb := '[]'::jsonb;
  v_inserted int := 0;
  v_skipped int := 0;
BEGIN
  -- Validar turmas & escola
  IF NOT EXISTS (SELECT 1 FROM public.turmas t WHERE t.id = p_origem_turma_id AND t.escola_id = p_escola_id) THEN
    RAISE EXCEPTION 'Turma de origem não pertence à escola';
  END IF;
  SELECT t.session_id INTO v_dest_session FROM public.turmas t WHERE t.id = p_destino_turma_id AND t.escola_id = p_escola_id LIMIT 1;
  IF v_dest_session IS NULL THEN
    RAISE EXCEPTION 'Turma de destino inválida ou sem sessão vinculada';
  END IF;

  -- Inserir matrículas para quem ainda não está ativo na sessão destino
  WITH origem_alunos AS (
    SELECT DISTINCT m.aluno_id
    FROM public.matriculas m
    WHERE m.escola_id = p_escola_id
      AND m.turma_id  = p_origem_turma_id
      AND m.status IN ('ativo','ativa','active')
  ), ja_ativos_dest AS (
    SELECT m.aluno_id
    FROM public.matriculas m
    WHERE m.escola_id  = p_escola_id
      AND m.session_id = v_dest_session
      AND m.status IN ('ativo','ativa','active')
  ), candidatos AS (
    SELECT o.aluno_id,
           CASE WHEN j.aluno_id IS NOT NULL THEN true ELSE false END AS exists_dest
    FROM origem_alunos o
    LEFT JOIN ja_ativos_dest j ON j.aluno_id = o.aluno_id
  )
  INSERT INTO public.matriculas (id, escola_id, aluno_id, turma_id, session_id, status, ativo, created_at)
  SELECT gen_random_uuid(), p_escola_id, c.aluno_id, p_destino_turma_id, v_dest_session, 'ativo', true, now()
  FROM candidatos c
  WHERE c.exists_dest = false;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  -- skipped = total origem - inserted
  SELECT COALESCE(COUNT(*),0) - COALESCE(v_inserted,0)
    INTO v_skipped
  FROM (
    SELECT DISTINCT m.aluno_id FROM public.matriculas m
    WHERE m.escola_id = p_escola_id AND m.turma_id = p_origem_turma_id AND m.status IN ('ativo','ativa','active')
  ) x;

  -- Atualiza matrículas antigas para transferido somente dos inseridos
  UPDATE public.matriculas m
     SET status = 'transferido', updated_at = now()
   WHERE m.escola_id = p_escola_id
     AND m.turma_id  = p_origem_turma_id
     AND m.aluno_id IN (
       SELECT m2.aluno_id FROM public.matriculas m2
       WHERE m2.escola_id = p_escola_id AND m2.turma_id = p_destino_turma_id AND m2.session_id = v_dest_session
     );

  RETURN QUERY SELECT COALESCE(v_inserted,0) AS inserted,
                      COALESCE(v_skipped,0)  AS skipped,
                      v_errs                 AS errors;
END;
$$;


--
-- Name: resync_matricula_counter(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resync_matricula_counter(p_escola_id uuid) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_floor bigint := public.matricula_counter_floor(p_escola_id);
BEGIN
  INSERT INTO public.matricula_counters (escola_id, last_value, updated_at)
  VALUES (p_escola_id, v_floor, now())
  ON CONFLICT (escola_id) DO UPDATE
    SET last_value = GREATEST(v_floor, matricula_counters.last_value),
        updated_at = now()
  RETURNING last_value INTO v_floor;

  RETURN v_floor;
END;
$$;


--
-- Name: search_alunos_global(uuid, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_alunos_global(p_escola_id uuid, p_query text, p_limit integer DEFAULT 10) RETURNS TABLE(id uuid, nome text, processo text, turma text, status text, aluno_status text, turma_id uuid, aluno_bi text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_query text := coalesce(trim(p_query), '');
  v_tsquery tsquery := NULL;
BEGIN
  -- Normaliza consulta para prefix matching (token*:*)
  IF v_query <> '' THEN
    v_query := replace(v_query, '''', ' ');
    v_tsquery := to_tsquery(
      'simple',
      regexp_replace(v_query, '\\s+', ' & ', 'g') || ':*'
    );
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    coalesce(a.nome_completo, a.nome) AS nome,
    a.numero_processo AS processo,
    coalesce(t.nome, 'Sem turma') AS turma,
    coalesce(m.status, 'sem_matricula') AS status,
    a.status AS aluno_status,
    t.id AS turma_id,
    a.bi_numero AS aluno_bi
  FROM public.alunos a
  LEFT JOIN LATERAL (
    SELECT m.id, m.turma_id, m.status, m.data_matricula
    FROM public.matriculas m
    WHERE m.aluno_id = a.id
      AND m.escola_id = p_escola_id
    ORDER BY m.data_matricula DESC NULLS LAST, m.created_at DESC
    LIMIT 1
  ) m ON TRUE
  LEFT JOIN public.turmas t ON t.id = m.turma_id
  WHERE a.escola_id = p_escola_id
    AND a.deleted_at IS NULL
    AND (
      v_tsquery IS NULL
      OR to_tsvector('simple', a.search_text) @@ v_tsquery
      OR a.numero_processo ILIKE '%' || v_query || '%'
      OR a.bi_numero ILIKE '%' || v_query || '%'
      OR a.nome ILIKE '%' || v_query || '%'
    )
  ORDER BY a.updated_at DESC NULLS LAST, a.created_at DESC
  LIMIT LEAST(GREATEST(coalesce(p_limit, 10), 1), 50);
END;
$$;


--
-- Name: secretaria_audit_by_aluno_matricula(uuid, uuid, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.secretaria_audit_by_aluno_matricula(p_aluno_id uuid DEFAULT NULL::uuid, p_matricula_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 100, p_offset integer DEFAULT 0) RETURNS TABLE(created_at timestamp with time zone, portal text, acao text, tabela text, entity_id text, matricula_id uuid, aluno_id uuid, aluno_nome text, user_id uuid, user_email text, details jsonb)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select
    created_at,
    portal,
    acao,
    tabela,
    entity_id,
    matricula_id,
    aluno_id,
    aluno_nome,
    user_id,
    user_email,
    details
  from public.secretaria_audit_feed
  where (p_matricula_id is null or matricula_id = p_matricula_id)
    and (p_aluno_id is null or aluno_id = p_aluno_id)
  order by created_at desc
  limit greatest(1, least(1000, coalesce(p_limit, 100)))
  offset greatest(0, coalesce(p_offset, 0));
$$;


--
-- Name: set_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_temp'
    AS $$
begin
  new.updated_at = now();
  return new;
end; $$;


--
-- Name: soft_delete_aluno(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.soft_delete_aluno(p_id uuid, p_deleted_by uuid, p_reason text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.alunos
  SET deleted_at = timezone('utc', now()),
      status = 'inativo',
      deleted_by = p_deleted_by,
      deletion_reason = p_reason
  WHERE id = p_id;

  INSERT INTO public.alunos_excluidos (id, escola_id, aluno_id, nome, aluno_deleted_at, exclusao_motivo, excluido_por, snapshot)
  SELECT gen_random_uuid(), escola_id, id, nome, timezone('utc', now()), p_reason, p_deleted_by, row_to_json(public.alunos.*)::jsonb
  FROM public.alunos WHERE id = p_id;
END;
$$;


--
-- Name: sync_alunos_nome_completo(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_alunos_nome_completo() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Se apenas nome_completo vier preenchido, usa-o para popular nome
  IF (NEW.nome IS NULL OR btrim(NEW.nome) = '') AND NEW.nome_completo IS NOT NULL THEN
    NEW.nome := btrim(NEW.nome_completo);
  END IF;

  -- Sempre espelha nome em nome_completo para compatibilidade
  IF NEW.nome IS NOT NULL THEN
    NEW.nome_completo := NEW.nome;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: sync_disciplinas_ao_criar_turma(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_disciplinas_ao_criar_turma() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    IF NEW.classe_id IS NULL THEN
        RETURN NEW;
    END IF;

    INSERT INTO public.turma_disciplinas (escola_id, turma_id, disciplina_id)
    SELECT NEW.escola_id, NEW.id, d.id
    FROM public.disciplinas d
    WHERE d.classe_id = NEW.classe_id
    ON CONFLICT DO NOTHING;

    RETURN NEW;
END;
$$;


--
-- Name: trg_set_escola_atribuicoes_prof(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_set_escola_atribuicoes_prof() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_temp'
    AS $$
begin
  select co.escola_id into new.escola_id from public.cursos_oferta co where co.id = new.curso_oferta_id;
  return new;
end; $$;


--
-- Name: trg_set_escola_avaliacoes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_set_escola_avaliacoes() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_temp'
    AS $$
begin
  select co.escola_id into new.escola_id from public.cursos_oferta co where co.id = new.curso_oferta_id;
  return new;
end; $$;


--
-- Name: trg_set_escola_cursos_oferta(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_set_escola_cursos_oferta() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_temp'
    AS $$
begin
  select c.escola_id into new.escola_id from public.cursos c where c.id = new.curso_id;
  return new;
end; $$;


--
-- Name: trg_set_escola_frequencias(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_set_escola_frequencias() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_temp'
    AS $$
begin
  select m.escola_id into new.escola_id from public.matriculas m where m.id = new.matricula_id;
  return new;
end; $$;


--
-- Name: trg_set_escola_lancamentos(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_set_escola_lancamentos() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_temp'
    AS $$
begin
  select m.escola_id into new.escola_id from public.matriculas m where m.id = new.matricula_id;
  return new;
end; $$;


--
-- Name: trg_set_escola_matriculas_cursos(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_set_escola_matriculas_cursos() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_temp'
    AS $$
begin
  select m.escola_id into new.escola_id from public.matriculas m where m.id = new.matricula_id;
  return new;
end; $$;


--
-- Name: trg_set_escola_regras_escala(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_set_escola_regras_escala() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_temp'
    AS $$
begin
  select s.escola_id into new.escola_id from public.sistemas_notas s where s.id = new.sistema_notas_id;
  return new;
end; $$;


--
-- Name: trg_set_escola_rotinas(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_set_escola_rotinas() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_temp'
    AS $$
begin
  if new.curso_oferta_id is not null then
    select co.escola_id into new.escola_id from public.cursos_oferta co where co.id = new.curso_oferta_id;
  end if;
  if new.escola_id is null and new.turma_id is not null then
    select t.escola_id into new.escola_id from public.turmas t where t.id = new.turma_id;
  end if;
  return new;
end; $$;


--
-- Name: trg_set_escola_sistemas_notas(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_set_escola_sistemas_notas() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_temp'
    AS $$
begin
  if new.turma_id is not null then
    select t.escola_id into new.escola_id from public.turmas t where t.id = new.turma_id;
  end if;
  if new.escola_id is null and new.semestre_id is not null then
    select ss.escola_id into new.escola_id from public.semestres se join public.school_sessions ss on ss.id = se.session_id where se.id = new.semestre_id;
  end if;
  return new;
end; $$;


--
-- Name: trg_set_escola_syllabi(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_set_escola_syllabi() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_temp'
    AS $$
begin
  select co.escola_id into new.escola_id from public.cursos_oferta co where co.id = new.curso_oferta_id;
  return new;
end; $$;


--
-- Name: trg_set_matricula_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_set_matricula_number() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_num bigint;
BEGIN
  IF NEW.numero_matricula IS NULL THEN
    v_num := public.next_matricula_number(NEW.escola_id);
    NEW.numero_matricula := v_num;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: trg_touch_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  new.updated_at := now();
  return new;
end$$;


--
-- Name: update_import_configuration(uuid, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_import_configuration(p_import_id uuid, p_cursos_data jsonb, p_turmas_data jsonb) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_role text;
  curso_rec record;
  turma_rec record;
  v_cursos_updated int := 0;
  v_turmas_updated int := 0;
BEGIN
  -- 1. Obter a role do usuário para validação de permissões
  SELECT current_setting('request.jwt.claims', true)::jsonb ->> 'role' INTO v_user_role;

  -- 2. Atualizar Cursos Pendentes
  IF p_cursos_data IS NOT NULL AND jsonb_array_length(p_cursos_data) > 0 THEN
    FOR curso_rec IN SELECT * FROM jsonb_to_recordset(p_cursos_data) AS x(id uuid, nome text, status_aprovacao text) LOOP
      
      -- Apenas admins podem aprovar um curso
      IF curso_rec.status_aprovacao = 'aprovado' AND (v_user_role <> 'admin' AND v_user_role <> 'super_admin') THEN
        -- Não faz nada ou pode-se lançar um erro. Por segurança, vamos ignorar a alteração de status.
        UPDATE public.cursos
        SET nome = curso_rec.nome
        WHERE id = curso_rec.id AND import_id = p_import_id;
      ELSE
        -- Admin pode aprovar e qualquer um pode atualizar o nome
        UPDATE public.cursos
        SET
          nome = COALESCE(curso_rec.nome, nome),
          status_aprovacao = COALESCE(curso_rec.status_aprovacao, status_aprovacao)
        WHERE id = curso_rec.id AND import_id = p_import_id;
      END IF;

      v_cursos_updated := v_cursos_updated + 1;
    END LOOP;
  END IF;

  -- 3. Atualizar Turmas em Rascunho
  IF p_turmas_data IS NOT NULL AND jsonb_array_length(p_turmas_data) > 0 THEN
    FOR turma_rec IN SELECT * FROM jsonb_to_recordset(p_turmas_data) AS x(id uuid, nome text, curso_id uuid, classe_id uuid, turno text, status_validacao text) LOOP
      
      UPDATE public.turmas
      SET
        nome = COALESCE(turma_rec.nome, nome),
        curso_id = COALESCE(turma_rec.curso_id, curso_id),
        classe_id = COALESCE(turma_rec.classe_id, classe_id),
        turno = COALESCE(turma_rec.turno, turno),
        status_validacao = COALESCE(turma_rec.status_validacao, status_validacao) -- ex: 'ativo'
      WHERE id = turma_rec.id AND import_id = p_import_id;

      v_turmas_updated := v_turmas_updated + 1;
    END LOOP;
  END IF;

  -- 4. Retornar o resultado
  RETURN json_build_object(
    'success', true,
    'cursos_updated', v_cursos_updated,
    'turmas_updated', v_turmas_updated
  );
END;
$$;


--
-- Name: verificar_documento_publico(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.verificar_documento_publico(p_public_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  v_doc record;
  v_escola_nome text;
  v_aluno_nome text;
BEGIN
  SELECT de.public_id, de.tipo, de.created_at, de.revoked_at, de.escola_id, de.dados_snapshot, a.nome_completo
    INTO v_doc
  FROM public.documentos_emitidos de
  JOIN public.alunos a ON a.id = de.aluno_id
  WHERE de.public_id = p_public_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valido', false, 'mensagem', 'Documento não encontrado');
  END IF;

  SELECT nome INTO v_escola_nome
  FROM public.escolas
  WHERE id = v_doc.escola_id;

  v_aluno_nome := coalesce(v_doc.nome_completo, '');

  RETURN jsonb_build_object(
    'valido', (v_doc.revoked_at IS NULL),
    'status', CASE WHEN v_doc.revoked_at IS NULL THEN 'VALIDO' ELSE 'REVOGADO' END,
    'tipo', v_doc.tipo,
    'emitido_em', v_doc.created_at,
    'escola', v_escola_nome,
    'aluno', regexp_replace(v_aluno_nome, '(^.).*( .*$)', '\\1***\\2'),
    'referencia', v_doc.dados_snapshot->>'referencia',
    'valor_pago', v_doc.dados_snapshot->>'valor_pago'
  );
END;
$_$;


--
-- Name: aluno_processo_counters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.aluno_processo_counters (
    escola_id uuid NOT NULL,
    last_value bigint DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: alunos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alunos (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    nome text NOT NULL,
    responsavel text,
    telefone_responsavel text,
    status text DEFAULT 'ativo'::text,
    profile_id uuid,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    deletion_reason text,
    escola_id uuid,
    updated_at timestamp with time zone,
    import_id uuid,
    telefone text,
    bi_numero text,
    data_nascimento date,
    email text,
    sexo text,
    responsavel_nome text,
    responsavel_contato text,
    tsv tsvector GENERATED ALWAYS AS (to_tsvector('simple'::regconfig, ((COALESCE(nome, ''::text) || ' '::text) || COALESCE(responsavel_nome, ''::text)))) STORED,
    naturalidade text,
    numero_processo text,
    nif text,
    encarregado_nome text,
    encarregado_telefone text,
    encarregado_email text,
    nome_completo text,
    search_text text GENERATED ALWAYS AS (((((((COALESCE(nome_completo, nome, ''::text) || ' '::text) || COALESCE(numero_processo, ''::text)) || ' '::text) || COALESCE(bi_numero, ''::text)) || ' '::text) || COALESCE(encarregado_nome, ''::text))) STORED,
    CONSTRAINT alunos_status_check CHECK (((status IS NULL) OR (status = ANY (ARRAY['ativo'::text, 'inativo'::text, 'suspenso'::text, 'pendente'::text, 'trancado'::text, 'concluido'::text, 'transferido'::text, 'desistente'::text]))))
);

ALTER TABLE ONLY public.alunos FORCE ROW LEVEL SECURITY;


--
-- Name: alunos_excluidos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alunos_excluidos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    escola_id uuid NOT NULL,
    aluno_id uuid,
    profile_id uuid,
    numero_login text,
    nome text,
    aluno_created_at timestamp with time zone,
    aluno_deleted_at timestamp with time zone,
    exclusao_motivo text,
    excluido_por uuid,
    dados_anonimizados boolean DEFAULT false NOT NULL,
    anonimizacao_data timestamp with time zone,
    snapshot jsonb
);


--
-- Name: anos_letivos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.anos_letivos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    escola_id uuid NOT NULL,
    ano integer NOT NULL,
    data_inicio date NOT NULL,
    data_fim date NOT NULL,
    ativo boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT anos_letivos_ano_check CHECK (((ano >= 2000) AND (ano <= 2100))),
    CONSTRAINT anos_letivos_check CHECK ((data_fim > data_inicio))
);


--
-- Name: atribuicoes_prof; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.atribuicoes_prof (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    professor_user_id uuid NOT NULL,
    curso_oferta_id uuid NOT NULL,
    secao_id uuid NOT NULL,
    escola_id uuid NOT NULL
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id bigint NOT NULL,
    user_id uuid DEFAULT auth.uid(),
    acao text,
    tabela text,
    registro_id text,
    meta jsonb,
    created_at timestamp with time zone DEFAULT now(),
    escola_id uuid,
    portal text,
    action text,
    entity text,
    entity_id text,
    details jsonb
);


--
-- Name: TABLE audit_logs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.audit_logs IS 'Eventos de auditoria por escola/portal/usuário';


--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.audit_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: aulas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.aulas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    escola_id uuid NOT NULL,
    turma_disciplina_id uuid NOT NULL,
    data date NOT NULL,
    conteudo text,
    numero_aula integer,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: avaliacoes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.avaliacoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    escola_id uuid NOT NULL,
    turma_disciplina_id uuid NOT NULL,
    periodo_letivo_id uuid NOT NULL,
    nome text NOT NULL,
    peso numeric(6,2) DEFAULT 1 NOT NULL,
    nota_max numeric(6,2) DEFAULT 20 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: avaliacoes_legacy; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.avaliacoes_legacy (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    curso_oferta_id uuid NOT NULL,
    sistema_notas_id uuid,
    nome text NOT NULL,
    peso numeric NOT NULL,
    data_prevista date,
    escola_id uuid NOT NULL,
    turma_disciplina_id uuid,
    tipo text,
    bimestre integer,
    max_valor numeric(6,2) DEFAULT 20.0 NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: classes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.classes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    escola_id uuid NOT NULL,
    nome text NOT NULL,
    descricao text,
    ordem integer DEFAULT 0,
    nivel text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    numero integer,
    curso_id uuid,
    CONSTRAINT classes_curso_obrigatorio_10a_13a CHECK ((NOT (((nome ~ '(^|\s)(10|11|12|13)'::text) OR (nome ~~* '10%classe'::text) OR (nome ~~* '11%classe'::text) OR (nome ~~* '12%classe'::text) OR (nome ~~* '13%classe'::text)) AND (curso_id IS NULL)))),
    CONSTRAINT classes_numero_range_check CHECK (((numero IS NULL) OR ((numero >= 1) AND (numero <= 13))))
);


--
-- Name: configuracoes_curriculo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.configuracoes_curriculo (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    escola_id uuid NOT NULL,
    curso_id uuid NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: configuracoes_escola; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.configuracoes_escola (
    escola_id uuid NOT NULL,
    estrutura text NOT NULL,
    tipo_presenca text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    periodo_tipo text,
    autogerar_periodos boolean DEFAULT false,
    CONSTRAINT configuracoes_escola_estrutura_check CHECK ((estrutura = ANY (ARRAY['classes'::text, 'secoes'::text, 'cursos'::text]))),
    CONSTRAINT configuracoes_escola_periodo_tipo_check CHECK ((periodo_tipo = ANY (ARRAY['semestre'::text, 'trimestre'::text]))),
    CONSTRAINT configuracoes_escola_tipo_presenca_check CHECK ((tipo_presenca = ANY (ARRAY['secao'::text, 'curso'::text])))
);


--
-- Name: TABLE configuracoes_escola; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.configuracoes_escola IS 'Preferências acadêmicas por escola (onboarding etapa 2)';


--
-- Name: COLUMN configuracoes_escola.estrutura; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.configuracoes_escola.estrutura IS 'Estrutura acadêmica principal: classes | secoes | cursos';


--
-- Name: COLUMN configuracoes_escola.tipo_presenca; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.configuracoes_escola.tipo_presenca IS 'Registro de presença por secao ou por curso';


--
-- Name: curso_matriz; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.curso_matriz (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    escola_id uuid NOT NULL,
    curso_id uuid NOT NULL,
    classe_id uuid NOT NULL,
    disciplina_id uuid NOT NULL,
    carga_horaria integer,
    obrigatoria boolean DEFAULT true NOT NULL,
    ordem integer,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cursos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cursos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    escola_id uuid NOT NULL,
    codigo text NOT NULL,
    nome text NOT NULL,
    tipo text,
    descricao text,
    nivel text,
    semestre_id uuid,
    curso_global_id text,
    is_custom boolean DEFAULT false,
    updated_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    course_code text,
    curriculum_key text,
    status_aprovacao text DEFAULT 'aprovado'::text,
    import_id uuid
);


--
-- Name: cursos_globais_cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cursos_globais_cache (
    hash text NOT NULL,
    nome text NOT NULL,
    tipo text NOT NULL,
    usage_count integer DEFAULT 1,
    first_seen_at timestamp with time zone DEFAULT now(),
    last_used_at timestamp with time zone DEFAULT now(),
    created_by_escola uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT cursos_globais_cache_tipo_check CHECK ((tipo = ANY (ARRAY['primario'::text, 'ciclo1'::text, 'puniv'::text, 'tecnico'::text, 'geral'::text])))
);


--
-- Name: cursos_oferta_legacy; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cursos_oferta_legacy (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    curso_id uuid NOT NULL,
    turma_id uuid NOT NULL,
    semestre_id uuid NOT NULL,
    escola_id uuid NOT NULL
);


--
-- Name: disciplinas_catalogo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.disciplinas_catalogo (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    escola_id uuid NOT NULL,
    nome text NOT NULL,
    sigla text,
    nome_norm text GENERATED ALWAYS AS (lower(regexp_replace(public.immutable_unaccent(TRIM(BOTH FROM nome)), '\s+'::text, ' '::text, 'g'::text))) STORED,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: disciplinas_legacy; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.disciplinas_legacy (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    escola_id uuid NOT NULL,
    curso_escola_id uuid NOT NULL,
    nome text NOT NULL,
    classe_nome text NOT NULL,
    nivel_ensino text DEFAULT 'base'::text,
    tipo text DEFAULT 'nuclear'::text,
    carga_horaria integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    curso_id uuid,
    classe_id uuid,
    sigla text,
    CONSTRAINT disciplinas_tipo_valid CHECK ((tipo = ANY (ARRAY['nuclear'::text, 'atraso'::text, 'opcao'::text, 'core'::text, 'eletivo'::text, 'extra'::text])))
);


--
-- Name: documentos_emitidos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documentos_emitidos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    public_id uuid DEFAULT gen_random_uuid() NOT NULL,
    escola_id uuid NOT NULL,
    aluno_id uuid NOT NULL,
    mensalidade_id uuid,
    tipo public.tipo_documento NOT NULL,
    dados_snapshot jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    CONSTRAINT chk_revoked_consistency CHECK ((((revoked_at IS NULL) AND (revoked_by IS NULL)) OR ((revoked_at IS NOT NULL) AND (revoked_by IS NOT NULL))))
);


--
-- Name: escola_administradores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.escola_administradores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    escola_id uuid,
    user_id uuid,
    cargo text DEFAULT 'administrador_escolar'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: escola_auditoria; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.escola_auditoria (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    escola_id uuid NOT NULL,
    acao text NOT NULL,
    mensagem text,
    criado_em timestamp with time zone DEFAULT now(),
    dados jsonb
);

ALTER TABLE ONLY public.escola_auditoria FORCE ROW LEVEL SECURITY;


--
-- Name: escola_configuracoes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.escola_configuracoes (
    escola_id uuid NOT NULL,
    tema_interface jsonb DEFAULT '{"primaryColor": "#3b82f6"}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.escola_configuracoes FORCE ROW LEVEL SECURITY;


--
-- Name: escola_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.escola_members (
    escola_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.escola_members FORCE ROW LEVEL SECURITY;


--
-- Name: escola_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.escola_users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    escola_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text DEFAULT 'staff'::text,
    created_at timestamp with time zone DEFAULT now(),
    papel text DEFAULT 'secretaria'::text NOT NULL,
    CONSTRAINT escola_users_papel_check CHECK ((papel = ANY (ARRAY['admin'::text, 'staff_admin'::text, 'financeiro'::text, 'secretaria'::text, 'aluno'::text, 'professor'::text, 'admin_escola'::text])))
);


--
-- Name: escola_usuarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.escola_usuarios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    escola_id uuid NOT NULL,
    user_id uuid NOT NULL,
    papel text DEFAULT 'aluno'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT escola_usuarios_papel_check CHECK ((papel = ANY (ARRAY['admin'::text, 'staff_admin'::text, 'financeiro'::text, 'secretaria'::text, 'aluno'::text, 'professor'::text, 'admin_escola'::text])))
);


--
-- Name: escolas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.escolas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    nif text,
    endereco text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    status text DEFAULT 'ativa'::text,
    cor_primaria text,
    onboarding_finalizado boolean DEFAULT false NOT NULL,
    plano_atual public.app_plan_tier DEFAULT 'essencial'::public.app_plan_tier NOT NULL,
    aluno_portal_enabled boolean DEFAULT false NOT NULL,
    logo_url text,
    use_mv_dashboards boolean DEFAULT true NOT NULL
);


--
-- Name: COLUMN escolas.plano_atual; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.escolas.plano_atual IS 'Plano da escola: basico | standard | premium';


--
-- Name: COLUMN escolas.aluno_portal_enabled; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.escolas.aluno_portal_enabled IS 'Libera o acesso ao Portal do Aluno para esta escola';


--
-- Name: COLUMN escolas.use_mv_dashboards; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.escolas.use_mv_dashboards IS 'Quando true, páginas preferem ler views MV (v_*) para baixa latência.';


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    user_id uuid NOT NULL,
    nome text NOT NULL,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    role public.user_role DEFAULT 'aluno'::public.user_role NOT NULL,
    email text,
    escola_id uuid,
    onboarding_finalizado boolean DEFAULT false,
    telefone text,
    global_role text,
    current_escola_id uuid,
    numero_login text,
    deleted_at timestamp with time zone,
    data_nascimento date,
    sexo text,
    bi_numero text,
    naturalidade text,
    provincia text,
    encarregado_relacao text
);

ALTER TABLE ONLY public.profiles FORCE ROW LEVEL SECURITY;


--
-- Name: escolas_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.escolas_view WITH (security_invoker='true') AS
 SELECT e.id,
    e.nome,
    e.status,
    e.plano_atual,
    (e.plano_atual)::text AS plano,
    NULL::timestamp without time zone AS last_access,
    COALESCE(a.total_alunos, 0) AS total_alunos,
    COALESCE(pf.total_professores, 0) AS total_professores,
    e.endereco AS cidade,
    NULL::text AS estado
   FROM ((public.escolas e
     LEFT JOIN ( SELECT alunos.escola_id,
            (count(*))::integer AS total_alunos
           FROM public.alunos
          GROUP BY alunos.escola_id) a ON ((a.escola_id = e.id)))
     LEFT JOIN ( SELECT p.escola_id,
            (count(*))::integer AS total_professores
           FROM public.profiles p
          WHERE (p.role = 'professor'::public.user_role)
          GROUP BY p.escola_id) pf ON ((pf.escola_id = e.id)));


--
-- Name: events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    escola_id uuid NOT NULL,
    titulo text NOT NULL,
    descricao text,
    inicio_at timestamp with time zone NOT NULL,
    fim_at timestamp with time zone,
    publico_alvo text NOT NULL
);


--
-- Name: financeiro_cobrancas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financeiro_cobrancas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    escola_id uuid NOT NULL,
    aluno_id uuid NOT NULL,
    mensalidade_id uuid,
    canal text NOT NULL,
    status public.cobranca_status DEFAULT 'enviada'::public.cobranca_status NOT NULL,
    mensagem text,
    resposta text,
    enviado_em timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT financeiro_cobrancas_canal_check CHECK ((canal = ANY (ARRAY['whatsapp'::text, 'sms'::text, 'email'::text, 'manual'::text])))
);


--
-- Name: financeiro_contratos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financeiro_contratos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    escola_id uuid NOT NULL,
    aluno_id uuid NOT NULL,
    matricula_id uuid NOT NULL,
    ano_letivo integer NOT NULL,
    plano text,
    desconto_percentual numeric(5,2) DEFAULT 0,
    status text DEFAULT 'ativo'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: financeiro_estornos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financeiro_estornos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    escola_id uuid NOT NULL,
    mensalidade_id uuid NOT NULL,
    valor numeric(14,2) DEFAULT 0 NOT NULL,
    motivo text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: financeiro_itens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financeiro_itens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    escola_id uuid NOT NULL,
    nome text NOT NULL,
    categoria public.financeiro_categoria_item DEFAULT 'outros'::public.financeiro_categoria_item NOT NULL,
    preco numeric(12,2) DEFAULT 0 NOT NULL,
    controla_estoque boolean DEFAULT false NOT NULL,
    estoque_atual integer DEFAULT 0 NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: financeiro_lancamentos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financeiro_lancamentos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    escola_id uuid NOT NULL,
    aluno_id uuid NOT NULL,
    matricula_id uuid,
    tipo public.financeiro_tipo_transacao NOT NULL,
    origem public.financeiro_origem NOT NULL,
    descricao text NOT NULL,
    valor_original numeric(12,2) DEFAULT 0 NOT NULL,
    valor_multa numeric(12,2) DEFAULT 0,
    valor_desconto numeric(12,2) DEFAULT 0,
    valor_total numeric(12,2) GENERATED ALWAYS AS (((valor_original + valor_multa) - valor_desconto)) STORED,
    mes_referencia integer,
    ano_referencia integer,
    status public.financeiro_status DEFAULT 'pendente'::public.financeiro_status,
    data_vencimento date,
    data_pagamento timestamp with time zone,
    metodo_pagamento public.metodo_pagamento_enum,
    comprovativo_url text,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now(),
    categoria public.financeiro_categoria_item DEFAULT 'outros'::public.financeiro_categoria_item NOT NULL
);


--
-- Name: financeiro_tabelas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financeiro_tabelas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    escola_id uuid NOT NULL,
    ano_letivo integer NOT NULL,
    curso_id uuid,
    classe_id uuid,
    valor_mensalidade numeric(12,2) DEFAULT 0 NOT NULL,
    dia_vencimento integer DEFAULT 10,
    multa_atraso_percentual numeric(5,2) DEFAULT 0,
    multa_diaria numeric(10,2) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    valor_matricula numeric(12,2) DEFAULT 0 NOT NULL,
    CONSTRAINT financeiro_tabelas_dia_vencimento_chk CHECK (((dia_vencimento IS NULL) OR ((dia_vencimento >= 1) AND (dia_vencimento <= 31))))
);


--
-- Name: financeiro_titulos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financeiro_titulos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    escola_id uuid NOT NULL,
    contrato_id uuid,
    aluno_id uuid NOT NULL,
    tipo text NOT NULL,
    competencia text,
    vencimento date NOT NULL,
    valor_original numeric(12,2) NOT NULL,
    valor_desconto numeric(12,2) DEFAULT 0,
    valor_pago numeric(12,2) DEFAULT 0,
    status text DEFAULT 'pendente'::text NOT NULL,
    pago_em date,
    referencia text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT financeiro_titulos_status_check CHECK ((status = ANY (ARRAY['pendente'::text, 'pago'::text, 'atrasado'::text, 'cancelado'::text]))),
    CONSTRAINT financeiro_titulos_tipo_check CHECK ((tipo = ANY (ARRAY['matricula'::text, 'mensalidade'::text, 'multa'::text, 'outro'::text])))
);


--
-- Name: frequencias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.frequencias (
    id uuid NOT NULL,
    matricula_id uuid NOT NULL,
    routine_id uuid,
    curso_oferta_id uuid,
    data date NOT NULL,
    status text NOT NULL,
    escola_id uuid NOT NULL,
    aula_id uuid,
    observacao text
)
PARTITION BY RANGE (data);

ALTER TABLE ONLY public.frequencias FORCE ROW LEVEL SECURITY;


--
-- Name: frequencias_2025_09; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.frequencias_2025_09 (
    id uuid NOT NULL,
    matricula_id uuid NOT NULL,
    routine_id uuid,
    curso_oferta_id uuid,
    data date NOT NULL,
    status text NOT NULL,
    escola_id uuid NOT NULL,
    aula_id uuid,
    observacao text
);

ALTER TABLE ONLY public.frequencias_2025_09 FORCE ROW LEVEL SECURITY;


--
-- Name: frequencias_2025_10; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.frequencias_2025_10 (
    id uuid NOT NULL,
    matricula_id uuid NOT NULL,
    routine_id uuid,
    curso_oferta_id uuid,
    data date NOT NULL,
    status text NOT NULL,
    escola_id uuid NOT NULL,
    aula_id uuid,
    observacao text
);

ALTER TABLE ONLY public.frequencias_2025_10 FORCE ROW LEVEL SECURITY;


--
-- Name: frequencias_2025_11; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.frequencias_2025_11 (
    id uuid NOT NULL,
    matricula_id uuid NOT NULL,
    routine_id uuid,
    curso_oferta_id uuid,
    data date NOT NULL,
    status text NOT NULL,
    escola_id uuid NOT NULL,
    aula_id uuid,
    observacao text
);

ALTER TABLE ONLY public.frequencias_2025_11 FORCE ROW LEVEL SECURITY;


--
-- Name: frequencias_2025_12; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.frequencias_2025_12 (
    id uuid NOT NULL,
    matricula_id uuid NOT NULL,
    routine_id uuid,
    curso_oferta_id uuid,
    data date NOT NULL,
    status text NOT NULL,
    escola_id uuid NOT NULL,
    aula_id uuid,
    observacao text
);

ALTER TABLE ONLY public.frequencias_2025_12 FORCE ROW LEVEL SECURITY;


--
-- Name: frequencias_2026_01; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.frequencias_2026_01 (
    id uuid NOT NULL,
    matricula_id uuid NOT NULL,
    routine_id uuid,
    curso_oferta_id uuid,
    data date NOT NULL,
    status text NOT NULL,
    escola_id uuid NOT NULL,
    aula_id uuid,
    observacao text
);

ALTER TABLE ONLY public.frequencias_2026_01 FORCE ROW LEVEL SECURITY;


--
-- Name: frequencias_default; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.frequencias_default (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    matricula_id uuid NOT NULL,
    routine_id uuid,
    curso_oferta_id uuid,
    data date NOT NULL,
    status text NOT NULL,
    escola_id uuid NOT NULL,
    aula_id uuid,
    observacao text,
    CONSTRAINT frequencias_ck_routine_or_curso CHECK (((routine_id IS NOT NULL) OR (curso_oferta_id IS NOT NULL))),
    CONSTRAINT frequencias_status_check CHECK ((status = ANY (ARRAY['presente'::text, 'ausente'::text, 'atraso'::text, 'justificado'::text])))
);

ALTER TABLE ONLY public.frequencias_default FORCE ROW LEVEL SECURITY;


--
-- Name: historico_anos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.historico_anos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    escola_id uuid NOT NULL,
    aluno_id uuid NOT NULL,
    ano_letivo integer NOT NULL,
    turma_id uuid NOT NULL,
    resultado_final text NOT NULL,
    media_geral numeric(6,2),
    data_fechamento date DEFAULT CURRENT_DATE NOT NULL
);


--
-- Name: historico_disciplinas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.historico_disciplinas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    historico_ano_id uuid NOT NULL,
    disciplina_id uuid NOT NULL,
    media_final numeric(6,2),
    resultado text,
    faltas_totais integer
);


--
-- Name: import_errors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.import_errors (
    id bigint NOT NULL,
    import_id uuid NOT NULL,
    row_number integer,
    column_name text,
    message text NOT NULL,
    raw_value text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: import_errors_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.import_errors_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: import_errors_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.import_errors_id_seq OWNED BY public.import_errors.id;


--
-- Name: import_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.import_migrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    escola_id uuid NOT NULL,
    created_by uuid,
    file_name text,
    file_hash text,
    storage_path text,
    status text DEFAULT 'uploaded'::text NOT NULL,
    total_rows integer DEFAULT 0,
    imported_rows integer DEFAULT 0,
    error_rows integer DEFAULT 0,
    processed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    column_map jsonb
);


--
-- Name: lancamentos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lancamentos (
    id uuid NOT NULL,
    avaliacao_id uuid NOT NULL,
    matricula_id uuid NOT NULL,
    valor numeric NOT NULL,
    final boolean NOT NULL,
    criado_em timestamp with time zone NOT NULL,
    escola_id uuid NOT NULL,
    tenant_id uuid
)
PARTITION BY RANGE (criado_em);

ALTER TABLE ONLY public.lancamentos FORCE ROW LEVEL SECURITY;


--
-- Name: lancamentos_2025_09; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lancamentos_2025_09 (
    id uuid NOT NULL,
    avaliacao_id uuid NOT NULL,
    matricula_id uuid NOT NULL,
    valor numeric NOT NULL,
    final boolean NOT NULL,
    criado_em timestamp with time zone NOT NULL,
    escola_id uuid NOT NULL,
    tenant_id uuid
);

ALTER TABLE ONLY public.lancamentos_2025_09 FORCE ROW LEVEL SECURITY;


--
-- Name: lancamentos_2025_10; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lancamentos_2025_10 (
    id uuid NOT NULL,
    avaliacao_id uuid NOT NULL,
    matricula_id uuid NOT NULL,
    valor numeric NOT NULL,
    final boolean NOT NULL,
    criado_em timestamp with time zone NOT NULL,
    escola_id uuid NOT NULL,
    tenant_id uuid
);

ALTER TABLE ONLY public.lancamentos_2025_10 FORCE ROW LEVEL SECURITY;


--
-- Name: lancamentos_2025_11; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lancamentos_2025_11 (
    id uuid NOT NULL,
    avaliacao_id uuid NOT NULL,
    matricula_id uuid NOT NULL,
    valor numeric NOT NULL,
    final boolean NOT NULL,
    criado_em timestamp with time zone NOT NULL,
    escola_id uuid NOT NULL,
    tenant_id uuid
);

ALTER TABLE ONLY public.lancamentos_2025_11 FORCE ROW LEVEL SECURITY;


--
-- Name: lancamentos_2025_12; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lancamentos_2025_12 (
    id uuid NOT NULL,
    avaliacao_id uuid NOT NULL,
    matricula_id uuid NOT NULL,
    valor numeric NOT NULL,
    final boolean NOT NULL,
    criado_em timestamp with time zone NOT NULL,
    escola_id uuid NOT NULL,
    tenant_id uuid
);

ALTER TABLE ONLY public.lancamentos_2025_12 FORCE ROW LEVEL SECURITY;


--
-- Name: lancamentos_2026_01; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lancamentos_2026_01 (
    id uuid NOT NULL,
    avaliacao_id uuid NOT NULL,
    matricula_id uuid NOT NULL,
    valor numeric NOT NULL,
    final boolean NOT NULL,
    criado_em timestamp with time zone NOT NULL,
    escola_id uuid NOT NULL,
    tenant_id uuid
);

ALTER TABLE ONLY public.lancamentos_2026_01 FORCE ROW LEVEL SECURITY;


--
-- Name: lancamentos_default; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lancamentos_default (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    avaliacao_id uuid NOT NULL,
    matricula_id uuid NOT NULL,
    valor numeric NOT NULL,
    final boolean DEFAULT false NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    escola_id uuid NOT NULL,
    tenant_id uuid
);

ALTER TABLE ONLY public.lancamentos_default FORCE ROW LEVEL SECURITY;


--
-- Name: matricula_counters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.matricula_counters (
    escola_id uuid NOT NULL,
    last_value bigint DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: matricula_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.matricula_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: matriculas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.matriculas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    escola_id uuid NOT NULL,
    aluno_id uuid NOT NULL,
    turma_id uuid NOT NULL,
    ativo boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    secao_id uuid,
    session_id uuid,
    status text DEFAULT 'indefinido'::text NOT NULL,
    numero_matricula text,
    data_matricula date,
    ano_letivo integer,
    numero_chamada integer,
    CONSTRAINT matriculas_status_check CHECK ((status = ANY (ARRAY['ativo'::text, 'trancado'::text, 'concluido'::text, 'transferido'::text, 'desistente'::text])))
);

ALTER TABLE ONLY public.matriculas FORCE ROW LEVEL SECURITY;


--
-- Name: matriculas_cursos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.matriculas_cursos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    matricula_id uuid NOT NULL,
    curso_oferta_id uuid NOT NULL,
    escola_id uuid NOT NULL
);


--
-- Name: matriculas_por_ano; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.matriculas_por_ano WITH (security_invoker='true') AS
 SELECT escola_id,
    to_char(COALESCE(created_at, now()), 'YYYY'::text) AS ano,
    (count(*))::integer AS total
   FROM public.matriculas m
  GROUP BY escola_id, (to_char(COALESCE(created_at, now()), 'YYYY'::text));


--
-- Name: mensalidades; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mensalidades (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    aluno_id uuid NOT NULL,
    valor numeric(10,2) NOT NULL,
    data_vencimento date NOT NULL,
    status text,
    escola_id uuid,
    turma_id uuid,
    ano_letivo text,
    mes_referencia smallint,
    ano_referencia integer,
    valor_previsto numeric(14,2),
    valor_pago_total numeric(14,2) DEFAULT 0,
    data_pagamento_efetiva date,
    observacoes text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    matricula_id uuid,
    metodo_pagamento text,
    observacao text,
    updated_by uuid,
    CONSTRAINT mensalidades_status_check CHECK ((status = ANY (ARRAY['pendente'::text, 'pago_parcial'::text, 'pago'::text, 'isento'::text, 'cancelado'::text])))
);


--
-- Name: pagamentos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pagamentos (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    mensalidade_id uuid,
    valor_pago numeric(10,2) NOT NULL,
    data_pagamento date DEFAULT CURRENT_DATE,
    conciliado boolean DEFAULT false,
    transacao_id_externo text,
    metodo_pagamento text,
    telemovel_origem text,
    status text DEFAULT 'concluido'::text,
    metodo text,
    referencia text,
    escola_id uuid,
    CONSTRAINT pagamentos_metodo_pagamento_check CHECK ((metodo_pagamento = ANY (ARRAY['dinheiro'::text, 'tpa_fisico'::text, 'mcx_express'::text, 'transferencia'::text, 'referencia'::text]))),
    CONSTRAINT pagamentos_status_check CHECK ((status = ANY (ARRAY['pendente'::text, 'concluido'::text, 'falhado'::text, 'estornado'::text])))
);

ALTER TABLE ONLY public.pagamentos FORCE ROW LEVEL SECURITY;


--
-- Name: mv_financeiro_escola_dia; Type: MATERIALIZED VIEW; Schema: public; Owner: -
--

CREATE MATERIALIZED VIEW public.mv_financeiro_escola_dia AS
 SELECT NULL::uuid AS escola_id,
    (created_at)::date AS dia,
    count(*) FILTER (WHERE (status = 'pago'::text)) AS qtd_pagos,
    count(*) AS qtd_total
   FROM public.pagamentos p
  GROUP BY ((created_at)::date)
  WITH NO DATA;


--
-- Name: mv_freq_por_turma_dia; Type: MATERIALIZED VIEW; Schema: public; Owner: -
--

CREATE MATERIALIZED VIEW public.mv_freq_por_turma_dia AS
 SELECT f.escola_id,
    m.turma_id,
    f.data AS dia,
    count(*) AS total,
    count(*) FILTER (WHERE (f.status = 'presente'::text)) AS presentes
   FROM (public.frequencias f
     JOIN public.matriculas m ON ((m.id = f.matricula_id)))
  GROUP BY f.escola_id, m.turma_id, f.data
  WITH NO DATA;


--
-- Name: mv_media_por_curso; Type: MATERIALIZED VIEW; Schema: public; Owner: -
--

CREATE MATERIALIZED VIEW public.mv_media_por_curso AS
 SELECT l.escola_id,
    a.curso_oferta_id,
    avg(l.valor) AS media
   FROM (public.lancamentos l
     JOIN public.avaliacoes_legacy a ON ((a.id = l.avaliacao_id)))
  GROUP BY l.escola_id, a.curso_oferta_id
  WITH NO DATA;


--
-- Name: notas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    escola_id uuid NOT NULL,
    avaliacao_id uuid NOT NULL,
    matricula_id uuid NOT NULL,
    valor numeric(6,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notas_avaliacoes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notas_avaliacoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    avaliacao_id uuid NOT NULL,
    matricula_id uuid NOT NULL,
    aluno_id uuid NOT NULL,
    valor numeric(6,2) NOT NULL,
    observado_em timestamp with time zone DEFAULT now() NOT NULL,
    observacao text
);


--
-- Name: notas_legacy; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notas_legacy (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    escola_id uuid NOT NULL,
    aluno_id uuid NOT NULL,
    turma_id uuid NOT NULL,
    disciplina text NOT NULL,
    periodo_id uuid NOT NULL,
    nota numeric(5,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    disciplina_id uuid,
    CONSTRAINT notas_nota_check CHECK (((nota >= (0)::numeric) AND (nota <= (20)::numeric)))
);

ALTER TABLE ONLY public.notas_legacy FORCE ROW LEVEL SECURITY;


--
-- Name: notices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    escola_id uuid NOT NULL,
    titulo text NOT NULL,
    conteudo text NOT NULL,
    publico_alvo text NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notices_publico_alvo_check CHECK ((publico_alvo = ANY (ARRAY['todos'::text, 'professores'::text, 'alunos'::text, 'responsaveis'::text])))
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    escola_id uuid NOT NULL,
    target_role public.user_role DEFAULT 'financeiro'::public.user_role NOT NULL,
    tipo text NOT NULL,
    titulo text NOT NULL,
    mensagem text,
    link_acao text,
    lida boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: onboarding_drafts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.onboarding_drafts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    escola_id uuid NOT NULL,
    user_id uuid NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    step smallint DEFAULT 1 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pagamentos_status; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.pagamentos_status WITH (security_invoker='true') AS
 SELECT NULL::uuid AS escola_id,
    COALESCE(status, 'desconhecido'::text) AS status,
    (count(*))::integer AS total
   FROM public.pagamentos p
  GROUP BY COALESCE(status, 'desconhecido'::text);


--
-- Name: semestres_legacy; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.semestres_legacy (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    nome text NOT NULL,
    data_inicio date NOT NULL,
    data_fim date NOT NULL,
    attendance_type text NOT NULL,
    permitir_submissao_final boolean DEFAULT false NOT NULL,
    escola_id uuid NOT NULL,
    CONSTRAINT semestres_attendance_type_check CHECK ((attendance_type = ANY (ARRAY['section'::text, 'course'::text])))
);

ALTER TABLE ONLY public.semestres_legacy FORCE ROW LEVEL SECURITY;


--
-- Name: periodos; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.periodos WITH (security_invoker='true') AS
 SELECT id,
    nome,
    data_inicio,
    data_fim,
    session_id
   FROM public.semestres_legacy;


--
-- Name: periodos_letivos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.periodos_letivos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    escola_id uuid NOT NULL,
    ano_letivo_id uuid NOT NULL,
    tipo public.periodo_tipo NOT NULL,
    numero smallint NOT NULL,
    data_inicio date NOT NULL,
    data_fim date NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_periodos_numero_por_tipo CHECK ((((tipo = 'TRIMESTRE'::public.periodo_tipo) AND ((numero >= 1) AND (numero <= 3))) OR ((tipo = 'SEMESTRE'::public.periodo_tipo) AND ((numero >= 1) AND (numero <= 2))) OR ((tipo = 'BIMESTRE'::public.periodo_tipo) AND ((numero >= 1) AND (numero <= 4))))),
    CONSTRAINT periodos_letivos_check CHECK ((data_fim > data_inicio)),
    CONSTRAINT periodos_letivos_numero_check CHECK (((numero >= 1) AND (numero <= 6)))
);


--
-- Name: periodos_letivos_legacy; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.periodos_letivos_legacy (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    escola_id uuid NOT NULL,
    nome text NOT NULL,
    ano integer NOT NULL,
    data_inicio date,
    data_fim date,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.periodos_letivos_legacy FORCE ROW LEVEL SECURITY;


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permissions (
    id integer NOT NULL,
    role_id integer NOT NULL,
    recurso text NOT NULL,
    acao text NOT NULL,
    CONSTRAINT permissions_acao_check CHECK ((acao = ANY (ARRAY['read'::text, 'create'::text, 'update'::text, 'delete'::text])))
);

ALTER TABLE ONLY public.permissions FORCE ROW LEVEL SECURITY;


--
-- Name: permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.permissions_id_seq OWNED BY public.permissions.id;


--
-- Name: presencas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.presencas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    escola_id uuid NOT NULL,
    aluno_id uuid NOT NULL,
    turma_id uuid NOT NULL,
    data date NOT NULL,
    status text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    disciplina_id uuid,
    CONSTRAINT presencas_status_check CHECK ((status = ANY (ARRAY['presente'::text, 'falta'::text, 'atraso'::text])))
);

ALTER TABLE ONLY public.presencas FORCE ROW LEVEL SECURITY;


--
-- Name: professores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.professores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    escola_id uuid NOT NULL,
    profile_id uuid NOT NULL,
    formacao text,
    created_at timestamp with time zone DEFAULT now(),
    apelido text
);

ALTER TABLE ONLY public.professores FORCE ROW LEVEL SECURITY;


--
-- Name: profiles_archive; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles_archive (
    user_id uuid NOT NULL,
    nome text,
    avatar_url text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    role public.user_role,
    email text,
    escola_id uuid,
    onboarding_finalizado boolean,
    telefone text,
    global_role text,
    current_escola_id uuid,
    numero_login text,
    deleted_at timestamp with time zone,
    archived_at timestamp with time zone DEFAULT now(),
    archived_by uuid
);


--
-- Name: regras_escala; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.regras_escala (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sistema_notas_id uuid NOT NULL,
    grade text NOT NULL,
    point numeric NOT NULL,
    start integer NOT NULL,
    "end" integer NOT NULL,
    escola_id uuid NOT NULL
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id integer NOT NULL,
    nome text NOT NULL
);

ALTER TABLE ONLY public.roles FORCE ROW LEVEL SECURITY;


--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- Name: rotinas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rotinas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    turma_id uuid NOT NULL,
    secao_id uuid,
    curso_oferta_id uuid NOT NULL,
    professor_user_id uuid NOT NULL,
    weekday integer NOT NULL,
    inicio time without time zone NOT NULL,
    fim time without time zone NOT NULL,
    sala text,
    escola_id uuid NOT NULL,
    CONSTRAINT rotinas_weekday_check CHECK (((weekday >= 1) AND (weekday <= 7)))
);


--
-- Name: school_sessions_legacy; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.school_sessions_legacy (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    escola_id uuid NOT NULL,
    nome text NOT NULL,
    data_inicio date NOT NULL,
    data_fim date NOT NULL,
    status text NOT NULL,
    CONSTRAINT school_sessions_status_check CHECK ((status = ANY (ARRAY['ativa'::text, 'arquivada'::text])))
);

ALTER TABLE ONLY public.school_sessions_legacy FORCE ROW LEVEL SECURITY;


--
-- Name: secoes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.secoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    turma_id uuid NOT NULL,
    nome text NOT NULL,
    sala text,
    escola_id uuid NOT NULL
);

ALTER TABLE ONLY public.secoes FORCE ROW LEVEL SECURITY;


--
-- Name: sistemas_notas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sistemas_notas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    turma_id uuid,
    semestre_id uuid,
    nome text NOT NULL,
    tipo text NOT NULL,
    escola_id uuid NOT NULL,
    CONSTRAINT sistemas_notas_tipo_check CHECK ((tipo = ANY (ARRAY['numerico'::text, 'percentual'::text, 'menção'::text])))
);


--
-- Name: staging_alunos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staging_alunos (
    id bigint NOT NULL,
    import_id uuid NOT NULL,
    escola_id uuid NOT NULL,
    profile_id uuid,
    nome text,
    data_nascimento date,
    telefone text,
    bi text,
    email text,
    raw_data jsonb,
    created_at timestamp with time zone DEFAULT now(),
    curso_codigo text,
    classe_numero integer,
    turno_codigo text,
    turma_letra text,
    ano_letivo integer,
    numero_matricula text,
    numero_processo text,
    bi_numero text,
    nif text,
    encarregado_telefone text,
    encarregado_email text,
    turma_codigo text,
    encarregado_nome text,
    sexo text,
    row_number integer
);


--
-- Name: staging_alunos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.staging_alunos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: staging_alunos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.staging_alunos_id_seq OWNED BY public.staging_alunos.id;


--
-- Name: syllabi; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.syllabi (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    curso_oferta_id uuid NOT NULL,
    nome text NOT NULL,
    arquivo_url text NOT NULL,
    criado_em date DEFAULT CURRENT_DATE NOT NULL,
    escola_id uuid NOT NULL
);


--
-- Name: tabelas_mensalidade; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tabelas_mensalidade (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    escola_id uuid NOT NULL,
    curso_id uuid,
    classe_id uuid,
    valor numeric(14,2) NOT NULL,
    dia_vencimento smallint,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tabelas_mensalidade_dia_vencimento_check CHECK (((dia_vencimento >= 1) AND (dia_vencimento <= 31)))
);


--
-- Name: turma_disciplinas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.turma_disciplinas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    escola_id uuid NOT NULL,
    turma_id uuid NOT NULL,
    curso_matriz_id uuid NOT NULL,
    professor_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: turma_disciplinas_legacy_patch_fix; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.turma_disciplinas_legacy_patch_fix (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    escola_id uuid NOT NULL,
    turma_id uuid NOT NULL,
    disciplina_id uuid NOT NULL,
    carga_horaria integer,
    ordem integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    professor_id uuid
);


--
-- Name: turma_disciplinas_professores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.turma_disciplinas_professores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    escola_id uuid NOT NULL,
    turma_id uuid NOT NULL,
    disciplina_id uuid NOT NULL,
    professor_id uuid NOT NULL,
    horarios jsonb,
    planejamento jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    syllabus_id uuid
);

ALTER TABLE ONLY public.turma_disciplinas_professores FORCE ROW LEVEL SECURITY;


--
-- Name: turmas_auditoria; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.turmas_auditoria (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    turma_id uuid NOT NULL,
    escola_id uuid NOT NULL,
    acao text NOT NULL,
    dados jsonb,
    criado_em timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.turmas_auditoria FORCE ROW LEVEL SECURITY;


--
-- Name: v_financeiro_escola_dia; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_financeiro_escola_dia WITH (security_invoker='true') AS
 SELECT escola_id,
    dia,
    qtd_pagos,
    qtd_total
   FROM public.mv_financeiro_escola_dia
  WHERE (escola_id = public.current_tenant_escola_id());


--
-- Name: v_freq_por_turma_dia; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_freq_por_turma_dia WITH (security_invoker='true') AS
 SELECT escola_id,
    turma_id,
    dia,
    total,
    presentes
   FROM public.mv_freq_por_turma_dia
  WHERE (escola_id = public.current_tenant_escola_id());


--
-- Name: v_media_por_curso; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_media_por_curso WITH (security_invoker='true') AS
 SELECT escola_id,
    curso_oferta_id,
    media
   FROM public.mv_media_por_curso
  WHERE (escola_id = public.current_tenant_escola_id());


--
-- Name: v_top_cursos_media; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_top_cursos_media WITH (security_invoker='true') AS
 SELECT l.escola_id,
    a.curso_oferta_id,
    c.nome AS curso_nome,
    (avg(l.valor))::numeric(10,2) AS media
   FROM (((public.lancamentos l
     JOIN public.avaliacoes_legacy a ON ((a.id = l.avaliacao_id)))
     JOIN public.cursos_oferta_legacy co ON ((co.id = a.curso_oferta_id)))
     JOIN public.cursos c ON ((c.id = co.curso_id)))
  WHERE (l.escola_id = public.current_tenant_escola_id())
  GROUP BY l.escola_id, a.curso_oferta_id, c.nome;


--
-- Name: v_top_turmas_hoje; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_top_turmas_hoje WITH (security_invoker='true') AS
 WITH agg AS (
         SELECT f.escola_id,
            m.turma_id,
            f.data AS dia,
            (count(*))::integer AS total,
            (count(*) FILTER (WHERE (f.status = 'presente'::text)))::integer AS presentes
           FROM (public.frequencias f
             JOIN public.matriculas m ON ((m.id = f.matricula_id)))
          WHERE (f.data = CURRENT_DATE)
          GROUP BY f.escola_id, m.turma_id, f.data
        )
 SELECT a.escola_id,
    a.turma_id,
    t.nome AS turma_nome,
    a.total,
    a.presentes,
        CASE
            WHEN (a.total > 0) THEN round((((a.presentes)::numeric / (a.total)::numeric) * 100.0), 1)
            ELSE NULL::numeric
        END AS percent
   FROM (agg a
     JOIN public.turmas t ON ((t.id = a.turma_id)))
  WHERE (a.escola_id = public.current_tenant_escola_id());


--
-- Name: v_total_em_aberto_por_mes; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_total_em_aberto_por_mes WITH (security_invoker='true') AS
 SELECT escola_id,
    ano_referencia AS ano,
    mes_referencia AS mes,
    (sum(GREATEST((0)::numeric, (COALESCE(valor_previsto, valor, (0)::numeric) - COALESCE(valor_pago_total, (0)::numeric)))))::numeric(14,2) AS total_aberto
   FROM public.mensalidades m
  WHERE ((escola_id = public.current_tenant_escola_id()) AND (status = ANY (ARRAY['pendente'::text, 'pago_parcial'::text])))
  GROUP BY escola_id, ano_referencia, mes_referencia
  ORDER BY ano_referencia, mes_referencia;


--
-- Name: vw_alunos_active; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_alunos_active WITH (security_invoker='true') AS
 SELECT id,
    created_at,
    nome,
    responsavel,
    telefone_responsavel,
    status,
    profile_id,
    deleted_at,
    deleted_by,
    deletion_reason,
    escola_id,
    updated_at,
    import_id,
    telefone,
    bi_numero,
    data_nascimento,
    email,
    sexo,
    responsavel_nome,
    responsavel_contato,
    tsv,
    naturalidade,
    numero_processo,
    nif,
    encarregado_nome,
    encarregado_telefone,
    encarregado_email,
    nome_completo,
    search_text
   FROM public.alunos
  WHERE ((deleted_at IS NULL) AND (status = 'ativo'::text));


--
-- Name: vw_cursos_reais; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_cursos_reais WITH (security_invoker='true') AS
 SELECT id,
    escola_id,
    codigo,
    nome,
    tipo,
    descricao,
    nivel,
    semestre_id
   FROM public.cursos
  WHERE (COALESCE(tipo, 'geral'::text) = ANY (ARRAY['tecnico'::text, 'puniv'::text]));


--
-- Name: vw_medias_por_disciplina; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_medias_por_disciplina WITH (security_invoker='true') AS
 SELECT m.escola_id,
    m.aluno_id,
    td.disciplina_id,
    a.bimestre,
    (sum((n.valor * a.peso)) / NULLIF(sum(a.peso), (0)::numeric)) AS media_ponderada
   FROM (((public.notas_avaliacoes n
     JOIN public.avaliacoes_legacy a ON ((a.id = n.avaliacao_id)))
     JOIN public.matriculas m ON ((m.id = n.matricula_id)))
     JOIN public.turma_disciplinas_legacy_patch_fix td ON ((td.id = a.turma_disciplina_id)))
  GROUP BY m.escola_id, m.aluno_id, td.disciplina_id, a.bimestre;


--
-- Name: vw_radar_inadimplencia; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_radar_inadimplencia WITH (security_invoker='true') AS
 SELECT m.id AS mensalidade_id,
    m.aluno_id,
    a.nome AS nome_aluno,
    a.responsavel,
    a.telefone_responsavel AS telefone,
    t.nome AS nome_turma,
    (COALESCE(m.valor_previsto, (0)::numeric))::numeric(10,2) AS valor_previsto,
    COALESCE(m.valor_pago_total, (0)::numeric) AS valor_pago_total,
    GREATEST((0)::numeric, (COALESCE(m.valor_previsto, (0)::numeric) - COALESCE(m.valor_pago_total, (0)::numeric))) AS valor_em_atraso,
    m.data_vencimento,
    GREATEST(0, (CURRENT_DATE - m.data_vencimento)) AS dias_em_atraso,
        CASE
            WHEN ((CURRENT_DATE - m.data_vencimento) >= 30) THEN 'critico'::text
            WHEN ((CURRENT_DATE - m.data_vencimento) >= 10) THEN 'atencao'::text
            ELSE 'recente'::text
        END AS status_risco,
    m.status AS status_mensalidade
   FROM (((public.mensalidades m
     JOIN public.alunos a ON ((a.id = m.aluno_id)))
     LEFT JOIN public.matriculas mat ON (((mat.aluno_id = m.aluno_id) AND ((mat.status = ANY (ARRAY['ativo'::text, 'ativa'::text])) OR (mat.ativo = true)))))
     LEFT JOIN public.turmas t ON ((t.id = mat.turma_id)))
  WHERE ((m.escola_id = public.current_tenant_escola_id()) AND (m.status = ANY (ARRAY['pendente'::text, 'pago_parcial'::text])) AND (m.data_vencimento < CURRENT_DATE));


--
-- Name: vw_turmas_para_matricula; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_turmas_para_matricula WITH (security_invoker='true') AS
 WITH base AS (
         SELECT t.id,
            t.escola_id,
            t.session_id,
            t.nome AS turma_nome,
            t.turno,
            t.capacidade_maxima,
            t.sala,
            t.classe_id,
            t.curso_id AS turma_curso_id,
            t.ano_letivo,
            t.status_validacao,
            COALESCE(co.curso_id, cl.curso_id, t.curso_id) AS curso_id_resolved,
            cl.nome AS classe_nome
           FROM ((public.turmas t
             LEFT JOIN public.classes cl ON ((t.classe_id = cl.id)))
             LEFT JOIN public.cursos_oferta_legacy co ON ((co.turma_id = t.id)))
        )
 SELECT b.id,
    b.escola_id,
    b.session_id,
    b.turma_nome,
    b.turno,
    b.capacidade_maxima,
    b.sala,
    COALESCE(b.classe_nome, 'Classe não definida'::text) AS classe_nome,
    COALESCE(c.nome, 'Ensino Geral'::text) AS curso_nome,
    COALESCE(c.tipo, 'geral'::text) AS curso_tipo,
    COALESCE(c.is_custom, false) AS curso_is_custom,
    cgc.hash AS curso_global_hash,
    b.classe_id,
    b.curso_id_resolved AS curso_id,
    b.ano_letivo,
    ( SELECT count(*) AS count
           FROM public.matriculas m
          WHERE ((m.turma_id = b.id) AND (m.status = ANY (ARRAY['ativa'::text, 'ativo'::text])))) AS ocupacao_atual,
    ( SELECT max(m.created_at) AS max
           FROM public.matriculas m
          WHERE (m.turma_id = b.id)) AS ultima_matricula,
    b.status_validacao
   FROM ((base b
     LEFT JOIN public.cursos c ON ((b.curso_id_resolved = c.id)))
     LEFT JOIN public.cursos_globais_cache cgc ON ((c.curso_global_id = cgc.hash)));


--
-- Name: frequencias_2025_09; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.frequencias ATTACH PARTITION public.frequencias_2025_09 FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');


--
-- Name: frequencias_2025_10; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.frequencias ATTACH PARTITION public.frequencias_2025_10 FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');


--
-- Name: frequencias_2025_11; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.frequencias ATTACH PARTITION public.frequencias_2025_11 FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');


--
-- Name: frequencias_2025_12; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.frequencias ATTACH PARTITION public.frequencias_2025_12 FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');


--
-- Name: frequencias_2026_01; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.frequencias ATTACH PARTITION public.frequencias_2026_01 FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');


--
-- Name: frequencias_default; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.frequencias ATTACH PARTITION public.frequencias_default DEFAULT;


--
-- Name: lancamentos_2025_09; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lancamentos ATTACH PARTITION public.lancamentos_2025_09 FOR VALUES FROM ('2025-09-01 00:00:00+00') TO ('2025-10-01 00:00:00+00');


--
-- Name: lancamentos_2025_10; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lancamentos ATTACH PARTITION public.lancamentos_2025_10 FOR VALUES FROM ('2025-10-01 00:00:00+00') TO ('2025-11-01 00:00:00+00');


--
-- Name: lancamentos_2025_11; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lancamentos ATTACH PARTITION public.lancamentos_2025_11 FOR VALUES FROM ('2025-11-01 00:00:00+00') TO ('2025-12-01 00:00:00+00');


--
-- Name: lancamentos_2025_12; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lancamentos ATTACH PARTITION public.lancamentos_2025_12 FOR VALUES FROM ('2025-12-01 00:00:00+00') TO ('2026-01-01 00:00:00+00');


--
-- Name: lancamentos_2026_01; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lancamentos ATTACH PARTITION public.lancamentos_2026_01 FOR VALUES FROM ('2026-01-01 00:00:00+00') TO ('2026-02-01 00:00:00+00');


--
-- Name: lancamentos_default; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lancamentos ATTACH PARTITION public.lancamentos_default DEFAULT;


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: import_errors id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_errors ALTER COLUMN id SET DEFAULT nextval('public.import_errors_id_seq'::regclass);


--
-- Name: permissions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions ALTER COLUMN id SET DEFAULT nextval('public.permissions_id_seq'::regclass);


--
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- Name: staging_alunos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staging_alunos ALTER COLUMN id SET DEFAULT nextval('public.staging_alunos_id_seq'::regclass);


--
-- Name: aluno_processo_counters aluno_processo_counters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aluno_processo_counters
    ADD CONSTRAINT aluno_processo_counters_pkey PRIMARY KEY (escola_id);


--
-- Name: alunos_excluidos alunos_excluidos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alunos_excluidos
    ADD CONSTRAINT alunos_excluidos_pkey PRIMARY KEY (id);


--
-- Name: alunos alunos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alunos
    ADD CONSTRAINT alunos_pkey PRIMARY KEY (id);


--
-- Name: alunos alunos_profile_escola_uniq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alunos
    ADD CONSTRAINT alunos_profile_escola_uniq UNIQUE (profile_id, escola_id);


--
-- Name: anos_letivos anos_letivos_escola_id_ano_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anos_letivos
    ADD CONSTRAINT anos_letivos_escola_id_ano_key UNIQUE (escola_id, ano);


--
-- Name: anos_letivos anos_letivos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anos_letivos
    ADD CONSTRAINT anos_letivos_pkey PRIMARY KEY (id);


--
-- Name: atribuicoes_prof atribuicoes_prof_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atribuicoes_prof
    ADD CONSTRAINT atribuicoes_prof_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: aulas aulas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aulas
    ADD CONSTRAINT aulas_pkey PRIMARY KEY (id);


--
-- Name: avaliacoes_legacy avaliacoes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.avaliacoes_legacy
    ADD CONSTRAINT avaliacoes_pkey PRIMARY KEY (id);


--
-- Name: avaliacoes avaliacoes_pkey1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.avaliacoes
    ADD CONSTRAINT avaliacoes_pkey1 PRIMARY KEY (id);


--
-- Name: classes classes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_pkey PRIMARY KEY (id);


--
-- Name: configuracoes_curriculo configuracoes_curriculo_escola_id_curso_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.configuracoes_curriculo
    ADD CONSTRAINT configuracoes_curriculo_escola_id_curso_id_key UNIQUE (escola_id, curso_id);


--
-- Name: configuracoes_curriculo configuracoes_curriculo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.configuracoes_curriculo
    ADD CONSTRAINT configuracoes_curriculo_pkey PRIMARY KEY (id);


--
-- Name: configuracoes_escola configuracoes_escola_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.configuracoes_escola
    ADD CONSTRAINT configuracoes_escola_pkey PRIMARY KEY (escola_id);


--
-- Name: curso_matriz curso_matriz_escola_id_curso_id_classe_id_disciplina_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.curso_matriz
    ADD CONSTRAINT curso_matriz_escola_id_curso_id_classe_id_disciplina_id_key UNIQUE (escola_id, curso_id, classe_id, disciplina_id);


--
-- Name: curso_matriz curso_matriz_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.curso_matriz
    ADD CONSTRAINT curso_matriz_pkey PRIMARY KEY (id);


--
-- Name: cursos_globais_cache cursos_globais_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cursos_globais_cache
    ADD CONSTRAINT cursos_globais_cache_pkey PRIMARY KEY (hash);


--
-- Name: cursos_oferta_legacy cursos_oferta_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cursos_oferta_legacy
    ADD CONSTRAINT cursos_oferta_pkey PRIMARY KEY (id);


--
-- Name: cursos cursos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cursos
    ADD CONSTRAINT cursos_pkey PRIMARY KEY (id);


--
-- Name: disciplinas_catalogo disciplinas_catalogo_escola_id_nome_norm_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.disciplinas_catalogo
    ADD CONSTRAINT disciplinas_catalogo_escola_id_nome_norm_key UNIQUE (escola_id, nome_norm);


--
-- Name: disciplinas_catalogo disciplinas_catalogo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.disciplinas_catalogo
    ADD CONSTRAINT disciplinas_catalogo_pkey PRIMARY KEY (id);


--
-- Name: disciplinas_legacy disciplinas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.disciplinas_legacy
    ADD CONSTRAINT disciplinas_pkey PRIMARY KEY (id);


--
-- Name: documentos_emitidos documentos_emitidos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_emitidos
    ADD CONSTRAINT documentos_emitidos_pkey PRIMARY KEY (id);


--
-- Name: documentos_emitidos documentos_emitidos_public_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_emitidos
    ADD CONSTRAINT documentos_emitidos_public_id_key UNIQUE (public_id);


--
-- Name: escola_administradores escola_administradores_escola_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escola_administradores
    ADD CONSTRAINT escola_administradores_escola_id_user_id_key UNIQUE (escola_id, user_id);


--
-- Name: escola_administradores escola_administradores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escola_administradores
    ADD CONSTRAINT escola_administradores_pkey PRIMARY KEY (id);


--
-- Name: escola_auditoria escola_auditoria_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escola_auditoria
    ADD CONSTRAINT escola_auditoria_pkey PRIMARY KEY (id);


--
-- Name: escola_configuracoes escola_configuracoes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escola_configuracoes
    ADD CONSTRAINT escola_configuracoes_pkey PRIMARY KEY (escola_id);


--
-- Name: escola_members escola_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escola_members
    ADD CONSTRAINT escola_members_pkey PRIMARY KEY (escola_id, user_id);


--
-- Name: escola_users escola_users_escola_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escola_users
    ADD CONSTRAINT escola_users_escola_id_user_id_key UNIQUE (escola_id, user_id);


--
-- Name: escola_users escola_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escola_users
    ADD CONSTRAINT escola_users_pkey PRIMARY KEY (id);


--
-- Name: escola_usuarios escola_usuarios_escola_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escola_usuarios
    ADD CONSTRAINT escola_usuarios_escola_id_user_id_key UNIQUE (escola_id, user_id);


--
-- Name: escola_usuarios escola_usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escola_usuarios
    ADD CONSTRAINT escola_usuarios_pkey PRIMARY KEY (id);


--
-- Name: escolas escolas_cnpj_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escolas
    ADD CONSTRAINT escolas_cnpj_key UNIQUE (nif);


--
-- Name: escolas escolas_nome_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escolas
    ADD CONSTRAINT escolas_nome_unique UNIQUE (nome);


--
-- Name: escolas escolas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escolas
    ADD CONSTRAINT escolas_pkey PRIMARY KEY (id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: financeiro_cobrancas financeiro_cobrancas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_cobrancas
    ADD CONSTRAINT financeiro_cobrancas_pkey PRIMARY KEY (id);


--
-- Name: financeiro_contratos financeiro_contratos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_contratos
    ADD CONSTRAINT financeiro_contratos_pkey PRIMARY KEY (id);


--
-- Name: financeiro_estornos financeiro_estornos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_estornos
    ADD CONSTRAINT financeiro_estornos_pkey PRIMARY KEY (id);


--
-- Name: financeiro_itens financeiro_itens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_itens
    ADD CONSTRAINT financeiro_itens_pkey PRIMARY KEY (id);


--
-- Name: financeiro_lancamentos financeiro_lancamentos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_lancamentos
    ADD CONSTRAINT financeiro_lancamentos_pkey PRIMARY KEY (id);


--
-- Name: financeiro_tabelas financeiro_tabelas_escola_id_ano_letivo_curso_id_classe_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_tabelas
    ADD CONSTRAINT financeiro_tabelas_escola_id_ano_letivo_curso_id_classe_id_key UNIQUE (escola_id, ano_letivo, curso_id, classe_id);


--
-- Name: financeiro_tabelas financeiro_tabelas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_tabelas
    ADD CONSTRAINT financeiro_tabelas_pkey PRIMARY KEY (id);


--
-- Name: financeiro_titulos financeiro_titulos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_titulos
    ADD CONSTRAINT financeiro_titulos_pkey PRIMARY KEY (id);


--
-- Name: frequencias_default frequencias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.frequencias_default
    ADD CONSTRAINT frequencias_pkey PRIMARY KEY (id);


--
-- Name: historico_anos historico_anos_escola_id_aluno_id_ano_letivo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historico_anos
    ADD CONSTRAINT historico_anos_escola_id_aluno_id_ano_letivo_key UNIQUE (escola_id, aluno_id, ano_letivo);


--
-- Name: historico_anos historico_anos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historico_anos
    ADD CONSTRAINT historico_anos_pkey PRIMARY KEY (id);


--
-- Name: historico_disciplinas historico_disciplinas_historico_ano_id_disciplina_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historico_disciplinas
    ADD CONSTRAINT historico_disciplinas_historico_ano_id_disciplina_id_key UNIQUE (historico_ano_id, disciplina_id);


--
-- Name: historico_disciplinas historico_disciplinas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historico_disciplinas
    ADD CONSTRAINT historico_disciplinas_pkey PRIMARY KEY (id);


--
-- Name: import_errors import_errors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_errors
    ADD CONSTRAINT import_errors_pkey PRIMARY KEY (id);


--
-- Name: import_migrations import_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_migrations
    ADD CONSTRAINT import_migrations_pkey PRIMARY KEY (id);


--
-- Name: lancamentos_default lancamentos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lancamentos_default
    ADD CONSTRAINT lancamentos_pkey PRIMARY KEY (id);


--
-- Name: matricula_counters matricula_counters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matricula_counters
    ADD CONSTRAINT matricula_counters_pkey PRIMARY KEY (escola_id);


--
-- Name: matriculas matricula_unica_ano; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matriculas
    ADD CONSTRAINT matricula_unica_ano UNIQUE (escola_id, aluno_id, ano_letivo);


--
-- Name: matriculas matriculas_aluno_id_turma_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matriculas
    ADD CONSTRAINT matriculas_aluno_id_turma_id_key UNIQUE (aluno_id, turma_id);


--
-- Name: matriculas_cursos matriculas_cursos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matriculas_cursos
    ADD CONSTRAINT matriculas_cursos_pkey PRIMARY KEY (id);


--
-- Name: matriculas matriculas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matriculas
    ADD CONSTRAINT matriculas_pkey PRIMARY KEY (id);


--
-- Name: mensalidades mensalidades_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensalidades
    ADD CONSTRAINT mensalidades_pkey PRIMARY KEY (id);


--
-- Name: notas_legacy notas_aluno_id_turma_id_disciplina_periodo_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notas_legacy
    ADD CONSTRAINT notas_aluno_id_turma_id_disciplina_periodo_id_key UNIQUE (aluno_id, turma_id, disciplina, periodo_id);


--
-- Name: notas notas_avaliacao_id_matricula_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notas
    ADD CONSTRAINT notas_avaliacao_id_matricula_id_key UNIQUE (avaliacao_id, matricula_id);


--
-- Name: notas_avaliacoes notas_avaliacoes_avaliacao_id_matricula_id_aluno_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notas_avaliacoes
    ADD CONSTRAINT notas_avaliacoes_avaliacao_id_matricula_id_aluno_id_key UNIQUE (avaliacao_id, matricula_id, aluno_id);


--
-- Name: notas_avaliacoes notas_avaliacoes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notas_avaliacoes
    ADD CONSTRAINT notas_avaliacoes_pkey PRIMARY KEY (id);


--
-- Name: notas_legacy notas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notas_legacy
    ADD CONSTRAINT notas_pkey PRIMARY KEY (id);


--
-- Name: notas notas_pkey1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notas
    ADD CONSTRAINT notas_pkey1 PRIMARY KEY (id);


--
-- Name: notices notices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notices
    ADD CONSTRAINT notices_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: onboarding_drafts onboarding_drafts_escola_user_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_drafts
    ADD CONSTRAINT onboarding_drafts_escola_user_unique UNIQUE (escola_id, user_id);


--
-- Name: onboarding_drafts onboarding_drafts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_drafts
    ADD CONSTRAINT onboarding_drafts_pkey PRIMARY KEY (id);


--
-- Name: pagamentos pagamentos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagamentos
    ADD CONSTRAINT pagamentos_pkey PRIMARY KEY (id);


--
-- Name: periodos_letivos periodos_letivos_ano_letivo_id_tipo_numero_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.periodos_letivos
    ADD CONSTRAINT periodos_letivos_ano_letivo_id_tipo_numero_key UNIQUE (ano_letivo_id, tipo, numero);


--
-- Name: periodos_letivos_legacy periodos_letivos_nome_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.periodos_letivos_legacy
    ADD CONSTRAINT periodos_letivos_nome_unique UNIQUE (nome);


--
-- Name: periodos_letivos_legacy periodos_letivos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.periodos_letivos_legacy
    ADD CONSTRAINT periodos_letivos_pkey PRIMARY KEY (id);


--
-- Name: periodos_letivos periodos_letivos_pkey1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.periodos_letivos
    ADD CONSTRAINT periodos_letivos_pkey1 PRIMARY KEY (id);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_role_id_recurso_acao_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_role_id_recurso_acao_key UNIQUE (role_id, recurso, acao);


--
-- Name: presencas presencas_aluno_id_turma_id_data_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presencas
    ADD CONSTRAINT presencas_aluno_id_turma_id_data_key UNIQUE (aluno_id, turma_id, data);


--
-- Name: presencas presencas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presencas
    ADD CONSTRAINT presencas_pkey PRIMARY KEY (id);


--
-- Name: professores professores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.professores
    ADD CONSTRAINT professores_pkey PRIMARY KEY (id);


--
-- Name: profiles_archive profiles_archive_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles_archive
    ADD CONSTRAINT profiles_archive_pkey PRIMARY KEY (user_id);


--
-- Name: profiles profiles_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_email_key UNIQUE (email);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (user_id);


--
-- Name: regras_escala regras_escala_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regras_escala
    ADD CONSTRAINT regras_escala_pkey PRIMARY KEY (id);


--
-- Name: roles roles_nome_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_nome_key UNIQUE (nome);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: rotinas rotinas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rotinas
    ADD CONSTRAINT rotinas_pkey PRIMARY KEY (id);


--
-- Name: school_sessions_legacy school_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.school_sessions_legacy
    ADD CONSTRAINT school_sessions_pkey PRIMARY KEY (id);


--
-- Name: secoes secoes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.secoes
    ADD CONSTRAINT secoes_pkey PRIMARY KEY (id);


--
-- Name: semestres_legacy semestres_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.semestres_legacy
    ADD CONSTRAINT semestres_pkey PRIMARY KEY (id);


--
-- Name: sistemas_notas sistemas_notas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sistemas_notas
    ADD CONSTRAINT sistemas_notas_pkey PRIMARY KEY (id);


--
-- Name: staging_alunos staging_alunos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staging_alunos
    ADD CONSTRAINT staging_alunos_pkey PRIMARY KEY (id);


--
-- Name: syllabi syllabi_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.syllabi
    ADD CONSTRAINT syllabi_pkey PRIMARY KEY (id);


--
-- Name: tabelas_mensalidade tabelas_mensalidade_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tabelas_mensalidade
    ADD CONSTRAINT tabelas_mensalidade_pkey PRIMARY KEY (id);


--
-- Name: turma_disciplinas_legacy_patch_fix turma_disciplinas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.turma_disciplinas_legacy_patch_fix
    ADD CONSTRAINT turma_disciplinas_pkey PRIMARY KEY (id);


--
-- Name: turma_disciplinas turma_disciplinas_pkey1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.turma_disciplinas
    ADD CONSTRAINT turma_disciplinas_pkey1 PRIMARY KEY (id);


--
-- Name: turma_disciplinas_professores turma_disciplinas_professores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.turma_disciplinas_professores
    ADD CONSTRAINT turma_disciplinas_professores_pkey PRIMARY KEY (id);


--
-- Name: turmas_auditoria turmas_auditoria_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.turmas_auditoria
    ADD CONSTRAINT turmas_auditoria_pkey PRIMARY KEY (id);


--
-- Name: turmas turmas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.turmas
    ADD CONSTRAINT turmas_pkey PRIMARY KEY (id);


--
-- Name: disciplinas_legacy unique_disciplina_por_classe; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.disciplinas_legacy
    ADD CONSTRAINT unique_disciplina_por_classe UNIQUE (curso_escola_id, classe_nome, nome);


--
-- Name: classes unique_estrutura_classe; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT unique_estrutura_classe UNIQUE (escola_id, curso_id, nome);


--
-- Name: cursos_globais_cache unique_nome_tipo; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cursos_globais_cache
    ADD CONSTRAINT unique_nome_tipo UNIQUE (nome, tipo);


--
-- Name: turmas unique_turma_angola; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.turmas
    ADD CONSTRAINT unique_turma_angola UNIQUE (escola_id, curso_id, classe_id, ano_letivo, nome, turno);


--
-- Name: turma_disciplinas_professores uq_tdp_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.turma_disciplinas_professores
    ADD CONSTRAINT uq_tdp_unique UNIQUE (turma_id, disciplina_id);


--
-- Name: turma_disciplinas uq_turma_disciplinas_escola; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.turma_disciplinas
    ADD CONSTRAINT uq_turma_disciplinas_escola UNIQUE (escola_id, turma_id, curso_matriz_id);


--
-- Name: alunos_bi_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX alunos_bi_key ON public.alunos USING btree (escola_id, bi_numero) WHERE (bi_numero IS NOT NULL);


--
-- Name: alunos_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX alunos_email_idx ON public.alunos USING btree (email);


--
-- Name: alunos_escola_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX alunos_escola_email_idx ON public.alunos USING btree (escola_id, email);


--
-- Name: alunos_escola_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX alunos_escola_id_idx ON public.alunos USING btree (escola_id);


--
-- Name: alunos_nome_data_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX alunos_nome_data_idx ON public.alunos USING btree (nome, data_nascimento);


--
-- Name: alunos_tel_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX alunos_tel_idx ON public.alunos USING btree (telefone);


--
-- Name: audit_logs_action_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_action_idx ON public.audit_logs USING btree (action);


--
-- Name: audit_logs_created_at_desc_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_created_at_desc_idx ON public.audit_logs USING btree (created_at DESC);


--
-- Name: audit_logs_details_gin_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_details_gin_idx ON public.audit_logs USING gin (details);


--
-- Name: audit_logs_escola_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_escola_id_idx ON public.audit_logs USING btree (escola_id);


--
-- Name: audit_logs_portal_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_portal_idx ON public.audit_logs USING btree (portal);


--
-- Name: brin_freq_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX brin_freq_data ON public.frequencias_default USING brin (data) WITH (pages_per_range='16');


--
-- Name: classes_escola_ordem_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX classes_escola_ordem_idx ON public.classes USING btree (escola_id, ordem);


--
-- Name: financeiro_itens_escola_nome_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX financeiro_itens_escola_nome_uniq ON public.financeiro_itens USING btree (escola_id, lower(nome));


--
-- Name: idx_alunos_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alunos_deleted_at ON public.alunos USING btree (deleted_at);


--
-- Name: idx_alunos_escola_processo; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_alunos_escola_processo ON public.alunos USING btree (escola_id, numero_processo);


--
-- Name: idx_alunos_escola_processo_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alunos_escola_processo_hash ON public.alunos USING btree (escola_id, numero_processo);


--
-- Name: idx_alunos_excluidos_aluno_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alunos_excluidos_aluno_deleted_at ON public.alunos_excluidos USING btree (aluno_deleted_at);


--
-- Name: idx_alunos_excluidos_escola; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alunos_excluidos_escola ON public.alunos_excluidos USING btree (escola_id);


--
-- Name: idx_alunos_profile_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alunos_profile_id ON public.alunos USING btree (profile_id);


--
-- Name: idx_alunos_search_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alunos_search_gin ON public.alunos USING gin (to_tsvector('simple'::regconfig, search_text));


--
-- Name: idx_anos_letivos_escola_ano; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_anos_letivos_escola_ano ON public.anos_letivos USING btree (escola_id, ano);


--
-- Name: idx_atribuicoes_prof_prof; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_atribuicoes_prof_prof ON public.atribuicoes_prof USING btree (professor_user_id);


--
-- Name: idx_avaliacoes_curso_oferta; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_avaliacoes_curso_oferta ON public.avaliacoes_legacy USING btree (curso_oferta_id);


--
-- Name: idx_avaliacoes_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_avaliacoes_lookup ON public.avaliacoes USING btree (escola_id, turma_disciplina_id, periodo_letivo_id);


--
-- Name: idx_classes_escola_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classes_escola_id ON public.classes USING btree (escola_id);


--
-- Name: idx_classes_numero; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classes_numero ON public.classes USING btree (numero);


--
-- Name: idx_cobrancas_aluno; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cobrancas_aluno ON public.financeiro_cobrancas USING btree (aluno_id, enviado_em DESC);


--
-- Name: idx_cobrancas_escola_enviado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cobrancas_escola_enviado ON public.financeiro_cobrancas USING btree (escola_id, enviado_em DESC);


--
-- Name: idx_cobrancas_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cobrancas_status ON public.financeiro_cobrancas USING btree (status);


--
-- Name: idx_configuracoes_escola_periodo_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_configuracoes_escola_periodo_tipo ON public.configuracoes_escola USING btree (periodo_tipo);


--
-- Name: idx_curso_matriz_disciplina; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_curso_matriz_disciplina ON public.curso_matriz USING btree (escola_id, disciplina_id);


--
-- Name: idx_curso_matriz_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_curso_matriz_lookup ON public.curso_matriz USING btree (escola_id, curso_id, classe_id);


--
-- Name: idx_cursos_escola; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cursos_escola ON public.cursos USING btree (escola_id);


--
-- Name: idx_cursos_escola_global; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cursos_escola_global ON public.cursos USING btree (escola_id, curso_global_id);


--
-- Name: idx_cursos_escola_nome; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_cursos_escola_nome ON public.cursos USING btree (escola_id, nome);


--
-- Name: idx_cursos_globais_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cursos_globais_hash ON public.cursos_globais_cache USING btree (hash);


--
-- Name: idx_cursos_import_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cursos_import_id ON public.cursos USING btree (import_id);


--
-- Name: idx_cursos_oferta_curso; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cursos_oferta_curso ON public.cursos_oferta_legacy USING btree (curso_id);


--
-- Name: idx_cursos_oferta_semestre; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cursos_oferta_semestre ON public.cursos_oferta_legacy USING btree (semestre_id);


--
-- Name: idx_cursos_oferta_turma; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cursos_oferta_turma ON public.cursos_oferta_legacy USING btree (turma_id);


--
-- Name: idx_disciplinas_catalogo_escola; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_disciplinas_catalogo_escola ON public.disciplinas_catalogo USING btree (escola_id);


--
-- Name: idx_disciplinas_curso; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_disciplinas_curso ON public.disciplinas_legacy USING btree (curso_escola_id);


--
-- Name: idx_disciplinas_escola; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_disciplinas_escola ON public.disciplinas_legacy USING btree (escola_id);


--
-- Name: idx_disciplinas_escola_classe_nome; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_disciplinas_escola_classe_nome ON public.disciplinas_legacy USING btree (escola_id, classe_id, nome);


--
-- Name: idx_disciplinas_sigla; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_disciplinas_sigla ON public.disciplinas_legacy USING btree (escola_id, sigla);


--
-- Name: idx_docs_aluno_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_docs_aluno_created ON public.documentos_emitidos USING btree (aluno_id, created_at DESC);


--
-- Name: idx_docs_escola_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_docs_escola_created ON public.documentos_emitidos USING btree (escola_id, created_at DESC);


--
-- Name: idx_docs_public_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_docs_public_id ON public.documentos_emitidos USING btree (public_id);


--
-- Name: idx_escola_administradores_escola_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_escola_administradores_escola_id ON public.escola_administradores USING btree (escola_id);


--
-- Name: idx_escola_administradores_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_escola_administradores_user_id ON public.escola_administradores USING btree (user_id);


--
-- Name: idx_escola_usuarios_escola_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_escola_usuarios_escola_id ON public.escola_usuarios USING btree (escola_id);


--
-- Name: idx_escola_usuarios_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_escola_usuarios_user_id ON public.escola_usuarios USING btree (user_id);


--
-- Name: idx_estornos_escola_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_estornos_escola_created ON public.financeiro_estornos USING btree (escola_id, created_at DESC);


--
-- Name: idx_estornos_mensalidade; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_estornos_mensalidade ON public.financeiro_estornos USING btree (mensalidade_id);


--
-- Name: idx_events_escola; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_escola ON public.events USING btree (escola_id);


--
-- Name: idx_fin_lancamentos_aluno; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fin_lancamentos_aluno ON public.financeiro_lancamentos USING btree (aluno_id);


--
-- Name: idx_fin_lancamentos_escola_ano_mes; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fin_lancamentos_escola_ano_mes ON public.financeiro_lancamentos USING btree (escola_id, ano_referencia, mes_referencia);


--
-- Name: idx_fin_lancamentos_escola_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fin_lancamentos_escola_status ON public.financeiro_lancamentos USING btree (escola_id, status);


--
-- Name: idx_fin_tabelas_escola_ano; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fin_tabelas_escola_ano ON public.financeiro_tabelas USING btree (escola_id, ano_letivo);


--
-- Name: idx_financeiro_lancamentos_escola_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_financeiro_lancamentos_escola_id ON public.financeiro_lancamentos USING btree (escola_id);


--
-- Name: idx_financeiro_tabelas_busca; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_financeiro_tabelas_busca ON public.financeiro_tabelas USING btree (escola_id, ano_letivo);


--
-- Name: idx_financeiro_titulos_escola_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_financeiro_titulos_escola_id ON public.financeiro_titulos USING btree (escola_id);


--
-- Name: idx_frequencias_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_frequencias_data ON public.frequencias_default USING btree (data);


--
-- Name: idx_frequencias_matricula; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_frequencias_matricula ON public.frequencias_default USING btree (matricula_id);


--
-- Name: idx_lancamentos_2025_09_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lancamentos_2025_09_tenant_id ON public.lancamentos_2025_09 USING btree (tenant_id);


--
-- Name: idx_lancamentos_avaliacao; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lancamentos_avaliacao ON public.lancamentos_default USING btree (avaliacao_id);


--
-- Name: idx_matriculas_aluno_ano_escola; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_matriculas_aluno_ano_escola ON public.matriculas USING btree (aluno_id, ano_letivo, escola_id);


--
-- Name: idx_matriculas_cursos_matricula; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_matriculas_cursos_matricula ON public.matriculas_cursos USING btree (matricula_id);


--
-- Name: idx_matriculas_escola_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_matriculas_escola_id ON public.matriculas USING btree (escola_id);


--
-- Name: idx_matriculas_escola_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_matriculas_escola_status ON public.matriculas USING btree (escola_id, status);


--
-- Name: idx_matriculas_secao; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_matriculas_secao ON public.matriculas USING btree (secao_id);


--
-- Name: idx_matriculas_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_matriculas_session ON public.matriculas USING btree (session_id);


--
-- Name: idx_mensalidades_aluno; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mensalidades_aluno ON public.mensalidades USING btree (aluno_id);


--
-- Name: idx_mensalidades_aluno_vencimento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mensalidades_aluno_vencimento ON public.mensalidades USING btree (aluno_id, data_vencimento);


--
-- Name: idx_mensalidades_escola; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mensalidades_escola ON public.mensalidades USING btree (escola_id);


--
-- Name: idx_mensalidades_escola_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mensalidades_escola_id ON public.mensalidades USING btree (escola_id);


--
-- Name: idx_mensalidades_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mensalidades_status ON public.mensalidades USING btree (status);


--
-- Name: idx_mensalidades_status_vencimento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mensalidades_status_vencimento ON public.mensalidades USING btree (status, data_vencimento);


--
-- Name: idx_notas_disciplina; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notas_disciplina ON public.notas_legacy USING btree (disciplina_id);


--
-- Name: idx_notas_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notas_lookup ON public.notas USING btree (escola_id, matricula_id);


--
-- Name: idx_notices_escola; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notices_escola ON public.notices USING btree (escola_id);


--
-- Name: idx_pagamentos_escola; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pagamentos_escola ON public.pagamentos USING btree (escola_id);


--
-- Name: idx_pagamentos_mensalidade; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pagamentos_mensalidade ON public.pagamentos USING btree (mensalidade_id);


--
-- Name: idx_pagamentos_mensalidade_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pagamentos_mensalidade_status ON public.pagamentos USING btree (mensalidade_id, status);


--
-- Name: idx_pagamentos_transacao_externa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pagamentos_transacao_externa ON public.pagamentos USING btree (transacao_id_externo);


--
-- Name: idx_periodos_letivos_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_periodos_letivos_lookup ON public.periodos_letivos USING btree (escola_id, ano_letivo_id, tipo, numero);


--
-- Name: idx_presencas_disciplina; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_presencas_disciplina ON public.presencas USING btree (disciplina_id);


--
-- Name: idx_profiles_current_escola; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_current_escola ON public.profiles USING btree (current_escola_id);


--
-- Name: idx_profiles_escola_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_escola_id ON public.profiles USING btree (escola_id);


--
-- Name: idx_profiles_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_user_id ON public.profiles USING btree (user_id);


--
-- Name: idx_regras_escala_sistema; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_regras_escala_sistema ON public.regras_escala USING btree (sistema_notas_id);


--
-- Name: idx_rotinas_curso_oferta; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rotinas_curso_oferta ON public.rotinas USING btree (curso_oferta_id);


--
-- Name: idx_rotinas_secao; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rotinas_secao ON public.rotinas USING btree (secao_id);


--
-- Name: idx_rotinas_turma; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rotinas_turma ON public.rotinas USING btree (turma_id);


--
-- Name: idx_secoes_turma; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_secoes_turma ON public.secoes USING btree (turma_id);


--
-- Name: idx_semestres_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_semestres_session ON public.semestres_legacy USING btree (session_id);


--
-- Name: idx_sistemas_notas_semestre; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sistemas_notas_semestre ON public.sistemas_notas USING btree (semestre_id);


--
-- Name: idx_sistemas_notas_turma; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sistemas_notas_turma ON public.sistemas_notas USING btree (turma_id);


--
-- Name: idx_staging_import_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staging_import_id ON public.staging_alunos USING btree (import_id);


--
-- Name: idx_syllabi_curso_oferta; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_syllabi_curso_oferta ON public.syllabi USING btree (curso_oferta_id);


--
-- Name: idx_tabmens_chave; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tabmens_chave ON public.tabelas_mensalidade USING btree (escola_id, curso_id, classe_id);


--
-- Name: idx_tabmens_escola; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tabmens_escola ON public.tabelas_mensalidade USING btree (escola_id);


--
-- Name: idx_tdp_disciplina; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tdp_disciplina ON public.turma_disciplinas_professores USING btree (disciplina_id);


--
-- Name: idx_tdp_escola; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tdp_escola ON public.turma_disciplinas_professores USING btree (escola_id);


--
-- Name: idx_tdp_professor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tdp_professor ON public.turma_disciplinas_professores USING btree (professor_id);


--
-- Name: idx_tdp_syllabus; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tdp_syllabus ON public.turma_disciplinas_professores USING btree (syllabus_id);


--
-- Name: idx_tdp_turma; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tdp_turma ON public.turma_disciplinas_professores USING btree (turma_id);


--
-- Name: idx_turma_disciplinas_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_turma_disciplinas_lookup ON public.turma_disciplinas_legacy_patch_fix USING btree (escola_id, turma_id);


--
-- Name: idx_turma_disciplinas_matriz; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_turma_disciplinas_matriz ON public.turma_disciplinas USING btree (curso_matriz_id);


--
-- Name: idx_turma_disciplinas_unica; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_turma_disciplinas_unica ON public.turma_disciplinas_legacy_patch_fix USING btree (turma_id, disciplina_id);


--
-- Name: idx_turmas_classe_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_turmas_classe_id ON public.turmas USING btree (classe_id);


--
-- Name: idx_turmas_coordenador_pedagogico_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_turmas_coordenador_pedagogico_id ON public.turmas USING btree (coordenador_pedagogico_id);


--
-- Name: idx_turmas_curso_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_turmas_curso_id ON public.turmas USING btree (curso_id);


--
-- Name: idx_turmas_diretor_turma_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_turmas_diretor_turma_id ON public.turmas USING btree (diretor_turma_id);


--
-- Name: idx_turmas_escola_ano; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_turmas_escola_ano ON public.turmas USING btree (escola_id, ano_letivo);


--
-- Name: idx_turmas_escola_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_turmas_escola_id ON public.turmas USING btree (escola_id);


--
-- Name: idx_turmas_import_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_turmas_import_id ON public.turmas USING btree (import_id);


--
-- Name: idx_turmas_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_turmas_session_id ON public.turmas USING btree (session_id);


--
-- Name: idx_turmas_smart_match; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_turmas_smart_match ON public.turmas USING btree (escola_id, ano_letivo, upper(regexp_replace(turma_codigo, '[^a-zA-Z0-9]'::text, ''::text, 'g'::text)));


--
-- Name: idx_turmas_unica; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_turmas_unica ON public.turmas USING btree (escola_id, ano_letivo, classe_id, turno, nome);


--
-- Name: import_errors_import_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX import_errors_import_id_idx ON public.import_errors USING btree (import_id);


--
-- Name: ix_alunos_tsv; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_alunos_tsv ON public.alunos USING gin (tsv);


--
-- Name: ix_attrprof_escola_prof_oferta; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_attrprof_escola_prof_oferta ON public.atribuicoes_prof USING btree (escola_id, professor_user_id, curso_oferta_id, secao_id);


--
-- Name: ix_cursos_nome_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_cursos_nome_trgm ON public.cursos USING gin (nome extensions.gin_trgm_ops);


--
-- Name: ix_events_escola_inicio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_events_escola_inicio ON public.events USING btree (escola_id, inicio_at DESC);


--
-- Name: ix_freq_escola_curso_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_freq_escola_curso_data ON public.frequencias_default USING btree (escola_id, curso_oferta_id, data);


--
-- Name: ix_freq_escola_routine_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_freq_escola_routine_data ON public.frequencias_default USING btree (escola_id, routine_id, data);


--
-- Name: ix_frequencias_2025_09_escola_curso_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_frequencias_2025_09_escola_curso_data ON public.frequencias_2025_09 USING btree (escola_id, curso_oferta_id, data);


--
-- Name: ix_frequencias_2025_09_escola_routine_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_frequencias_2025_09_escola_routine_data ON public.frequencias_2025_09 USING btree (escola_id, routine_id, data);


--
-- Name: ix_frequencias_2025_10_escola_curso_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_frequencias_2025_10_escola_curso_data ON public.frequencias_2025_10 USING btree (escola_id, curso_oferta_id, data);


--
-- Name: ix_frequencias_2025_10_escola_routine_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_frequencias_2025_10_escola_routine_data ON public.frequencias_2025_10 USING btree (escola_id, routine_id, data);


--
-- Name: ix_frequencias_2025_11_escola_curso_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_frequencias_2025_11_escola_curso_data ON public.frequencias_2025_11 USING btree (escola_id, curso_oferta_id, data);


--
-- Name: ix_frequencias_2025_11_escola_routine_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_frequencias_2025_11_escola_routine_data ON public.frequencias_2025_11 USING btree (escola_id, routine_id, data);


--
-- Name: ix_frequencias_2025_12_escola_curso_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_frequencias_2025_12_escola_curso_data ON public.frequencias_2025_12 USING btree (escola_id, curso_oferta_id, data);


--
-- Name: ix_frequencias_2025_12_escola_routine_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_frequencias_2025_12_escola_routine_data ON public.frequencias_2025_12 USING btree (escola_id, routine_id, data);


--
-- Name: ix_frequencias_2026_01_escola_curso_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_frequencias_2026_01_escola_curso_data ON public.frequencias_2026_01 USING btree (escola_id, curso_oferta_id, data);


--
-- Name: ix_frequencias_2026_01_escola_routine_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_frequencias_2026_01_escola_routine_data ON public.frequencias_2026_01 USING btree (escola_id, routine_id, data);


--
-- Name: ix_lanc_escola_avaliacao_matricula; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_lanc_escola_avaliacao_matricula ON public.lancamentos_default USING btree (escola_id, avaliacao_id, matricula_id);


--
-- Name: ix_lanc_escola_matricula; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_lanc_escola_matricula ON public.lancamentos_default USING btree (escola_id, matricula_id);


--
-- Name: ix_lancamentos_2025_09_escola_avaliacao_matricula; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_lancamentos_2025_09_escola_avaliacao_matricula ON public.lancamentos_2025_09 USING btree (escola_id, avaliacao_id, matricula_id);


--
-- Name: ix_lancamentos_2025_09_escola_matricula; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_lancamentos_2025_09_escola_matricula ON public.lancamentos_2025_09 USING btree (escola_id, matricula_id);


--
-- Name: ix_lancamentos_2025_10_escola_avaliacao_matricula; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_lancamentos_2025_10_escola_avaliacao_matricula ON public.lancamentos_2025_10 USING btree (escola_id, avaliacao_id, matricula_id);


--
-- Name: ix_lancamentos_2025_10_escola_matricula; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_lancamentos_2025_10_escola_matricula ON public.lancamentos_2025_10 USING btree (escola_id, matricula_id);


--
-- Name: ix_lancamentos_2025_11_escola_avaliacao_matricula; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_lancamentos_2025_11_escola_avaliacao_matricula ON public.lancamentos_2025_11 USING btree (escola_id, avaliacao_id, matricula_id);


--
-- Name: ix_lancamentos_2025_11_escola_matricula; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_lancamentos_2025_11_escola_matricula ON public.lancamentos_2025_11 USING btree (escola_id, matricula_id);


--
-- Name: ix_lancamentos_2025_12_escola_avaliacao_matricula; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_lancamentos_2025_12_escola_avaliacao_matricula ON public.lancamentos_2025_12 USING btree (escola_id, avaliacao_id, matricula_id);


--
-- Name: ix_lancamentos_2025_12_escola_matricula; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_lancamentos_2025_12_escola_matricula ON public.lancamentos_2025_12 USING btree (escola_id, matricula_id);


--
-- Name: ix_lancamentos_2026_01_escola_avaliacao_matricula; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_lancamentos_2026_01_escola_avaliacao_matricula ON public.lancamentos_2026_01 USING btree (escola_id, avaliacao_id, matricula_id);


--
-- Name: ix_lancamentos_2026_01_escola_matricula; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_lancamentos_2026_01_escola_matricula ON public.lancamentos_2026_01 USING btree (escola_id, matricula_id);


--
-- Name: ix_matriculas_escola_turma_secao; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_matriculas_escola_turma_secao ON public.matriculas USING btree (escola_id, turma_id, secao_id, status);


--
-- Name: ix_notices_escola_criado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_notices_escola_criado ON public.notices USING btree (escola_id, criado_em DESC);


--
-- Name: ix_oferta_escola_curso_turma_semestre; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_oferta_escola_curso_turma_semestre ON public.cursos_oferta_legacy USING btree (escola_id, curso_id, turma_id, semestre_id);


--
-- Name: ix_rotinas_escola_secao_weekday_inicio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_rotinas_escola_secao_weekday_inicio ON public.rotinas USING btree (escola_id, secao_id, weekday, inicio);


--
-- Name: notifications_escola_target_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_escola_target_idx ON public.notifications USING btree (escola_id, target_role, lida, created_at DESC);


--
-- Name: profiles_escola_numero_login_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX profiles_escola_numero_login_uidx ON public.profiles USING btree (escola_id, numero_login) WHERE (numero_login IS NOT NULL);


--
-- Name: staging_alunos_import_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX staging_alunos_import_id_idx ON public.staging_alunos USING btree (import_id);


--
-- Name: staging_alunos_import_matricula_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX staging_alunos_import_matricula_idx ON public.staging_alunos USING btree (import_id, escola_id, ano_letivo, curso_codigo, classe_numero, turno_codigo, turma_letra);


--
-- Name: turma_disciplinas_unica; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX turma_disciplinas_unica ON public.turma_disciplinas_legacy_patch_fix USING btree (escola_id, turma_id, disciplina_id);


--
-- Name: unique_matriculas_escola_aluno_turma_ano_status; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unique_matriculas_escola_aluno_turma_ano_status ON public.matriculas USING btree (escola_id, aluno_id, turma_id, ano_letivo) WHERE (status = ANY (ARRAY['ativo'::text, 'pendente'::text, 'concluido'::text]));


--
-- Name: unique_mensalidade_aluno; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unique_mensalidade_aluno ON public.financeiro_lancamentos USING btree (escola_id, aluno_id, ano_referencia, mes_referencia) WHERE ((origem = 'mensalidade'::public.financeiro_origem) AND (tipo = 'debito'::public.financeiro_tipo_transacao));


--
-- Name: uq_anos_letivos_ativo_por_escola; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_anos_letivos_ativo_por_escola ON public.anos_letivos USING btree (escola_id) WHERE (ativo = true);


--
-- Name: uq_atribuicoes_prof_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_atribuicoes_prof_unique ON public.atribuicoes_prof USING btree (professor_user_id, curso_oferta_id, secao_id);


--
-- Name: uq_avaliacoes_logica; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_avaliacoes_logica ON public.avaliacoes USING btree (turma_disciplina_id, periodo_letivo_id, nome);


--
-- Name: uq_cursos_escola_codigo; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_cursos_escola_codigo ON public.cursos USING btree (escola_id, codigo);


--
-- Name: uq_cursos_escola_course_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_cursos_escola_course_code ON public.cursos USING btree (escola_id, course_code) WHERE (course_code IS NOT NULL);


--
-- Name: uq_cursos_oferta_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_cursos_oferta_unique ON public.cursos_oferta_legacy USING btree (curso_id, turma_id, semestre_id);


--
-- Name: uq_documentos_recibo_por_mensalidade; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_documentos_recibo_por_mensalidade ON public.documentos_emitidos USING btree (mensalidade_id) WHERE ((tipo = 'recibo'::public.tipo_documento) AND (mensalidade_id IS NOT NULL));


--
-- Name: uq_lancamentos_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_lancamentos_unique ON public.lancamentos_default USING btree (matricula_id, avaliacao_id);


--
-- Name: uq_matriculas_aluno_session; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_matriculas_aluno_session ON public.matriculas USING btree (aluno_id, session_id) WHERE (session_id IS NOT NULL);


--
-- Name: uq_matriculas_cursos_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_matriculas_cursos_unique ON public.matriculas_cursos USING btree (matricula_id, curso_oferta_id);


--
-- Name: uq_matriculas_escola_numero; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_matriculas_escola_numero ON public.matriculas USING btree (escola_id, numero_matricula);


--
-- Name: uq_notas_aluno_turma_disciplinaid_periodo; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_notas_aluno_turma_disciplinaid_periodo ON public.notas_legacy USING btree (aluno_id, turma_id, disciplina_id, periodo_id) WHERE (disciplina_id IS NOT NULL);


--
-- Name: uq_profiles_numero_login_notnull; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_profiles_numero_login_notnull ON public.profiles USING btree (numero_login) WHERE (numero_login IS NOT NULL);


--
-- Name: uq_rotina_sala_tempo; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_rotina_sala_tempo ON public.rotinas USING btree (escola_id, sala, weekday, inicio, fim);


--
-- Name: uq_school_sessions_ativa_per_escola; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_school_sessions_ativa_per_escola ON public.school_sessions_legacy USING btree (escola_id) WHERE (status = 'ativa'::text);


--
-- Name: uq_turmas_escola_ano_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_turmas_escola_ano_code ON public.turmas USING btree (escola_id, ano_letivo, turma_code) WHERE ((turma_code IS NOT NULL) AND (ano_letivo IS NOT NULL));


--
-- Name: uq_turmas_escola_ano_codigo; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_turmas_escola_ano_codigo ON public.turmas USING btree (escola_id, ano_letivo, turma_codigo);


--
-- Name: ux_mensalidades_aluno_mes; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_mensalidades_aluno_mes ON public.mensalidades USING btree (escola_id, aluno_id, ano_referencia, mes_referencia);


--
-- Name: escolas escolas_audit_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER escolas_audit_delete AFTER DELETE ON public.escolas FOR EACH ROW EXECUTE FUNCTION public.log_escola_auditoria();


--
-- Name: escolas escolas_audit_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER escolas_audit_insert AFTER INSERT ON public.escolas FOR EACH ROW EXECUTE FUNCTION public.log_escola_auditoria();


--
-- Name: escolas escolas_audit_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER escolas_audit_update AFTER UPDATE ON public.escolas FOR EACH ROW EXECUTE FUNCTION public.log_escola_auditoria();


--
-- Name: turmas on_turmas_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_turmas_update BEFORE UPDATE ON public.turmas FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: financeiro_itens set_timestamp_financeiro_itens; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_timestamp_financeiro_itens BEFORE UPDATE ON public.financeiro_itens FOR EACH ROW EXECUTE FUNCTION public.set_timestamp();


--
-- Name: financeiro_tabelas set_timestamp_financeiro_tabelas; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_timestamp_financeiro_tabelas BEFORE UPDATE ON public.financeiro_tabelas FOR EACH ROW EXECUTE FUNCTION public.set_timestamp();


--
-- Name: matriculas trg_activate_aluno_after_matricula; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_activate_aluno_after_matricula AFTER INSERT OR UPDATE OF numero_matricula, status ON public.matriculas FOR EACH ROW EXECUTE FUNCTION public.activate_aluno_after_matricula();


--
-- Name: alunos trg_alunos_set_processo; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_alunos_set_processo BEFORE INSERT ON public.alunos FOR EACH ROW EXECUTE FUNCTION public.before_insert_alunos_set_processo();


--
-- Name: matriculas trg_audit_matriculas; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_matriculas AFTER INSERT OR DELETE OR UPDATE ON public.matriculas FOR EACH ROW EXECUTE FUNCTION public.audit_dml_trigger();


--
-- Name: pagamentos trg_audit_pagamentos; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_pagamentos AFTER INSERT OR DELETE OR UPDATE ON public.pagamentos FOR EACH ROW EXECUTE FUNCTION public.audit_dml_trigger();


--
-- Name: turmas trg_auto_disciplinas; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_auto_disciplinas AFTER INSERT ON public.turmas FOR EACH ROW EXECUTE FUNCTION public.sync_disciplinas_ao_criar_turma();


--
-- Name: avaliacoes trg_avaliacoes_consistency; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_avaliacoes_consistency BEFORE INSERT OR UPDATE ON public.avaliacoes FOR EACH ROW EXECUTE FUNCTION public.enforce_avaliacoes_consistency();


--
-- Name: atribuicoes_prof trg_bi_atribuicoes_prof_escola; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bi_atribuicoes_prof_escola BEFORE INSERT OR UPDATE OF curso_oferta_id ON public.atribuicoes_prof FOR EACH ROW EXECUTE FUNCTION public.trg_set_escola_atribuicoes_prof();


--
-- Name: avaliacoes_legacy trg_bi_avaliacoes_escola; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bi_avaliacoes_escola BEFORE INSERT OR UPDATE OF curso_oferta_id ON public.avaliacoes_legacy FOR EACH ROW EXECUTE FUNCTION public.trg_set_escola_avaliacoes();


--
-- Name: cursos_oferta_legacy trg_bi_cursos_oferta_escola; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bi_cursos_oferta_escola BEFORE INSERT OR UPDATE OF curso_id ON public.cursos_oferta_legacy FOR EACH ROW EXECUTE FUNCTION public.trg_set_escola_cursos_oferta();


--
-- Name: frequencias_default trg_bi_frequencias_escola; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bi_frequencias_escola BEFORE INSERT OR UPDATE OF matricula_id ON public.frequencias_default FOR EACH ROW EXECUTE FUNCTION public.trg_set_escola_frequencias();


--
-- Name: lancamentos_default trg_bi_lancamentos_escola; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bi_lancamentos_escola BEFORE INSERT OR UPDATE OF matricula_id ON public.lancamentos_default FOR EACH ROW EXECUTE FUNCTION public.trg_set_escola_lancamentos();


--
-- Name: matriculas_cursos trg_bi_matriculas_cursos_escola; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bi_matriculas_cursos_escola BEFORE INSERT OR UPDATE OF matricula_id ON public.matriculas_cursos FOR EACH ROW EXECUTE FUNCTION public.trg_set_escola_matriculas_cursos();


--
-- Name: regras_escala trg_bi_regras_escala_escola; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bi_regras_escala_escola BEFORE INSERT OR UPDATE OF sistema_notas_id ON public.regras_escala FOR EACH ROW EXECUTE FUNCTION public.trg_set_escola_regras_escala();


--
-- Name: rotinas trg_bi_rotinas_escola; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bi_rotinas_escola BEFORE INSERT OR UPDATE OF curso_oferta_id, turma_id ON public.rotinas FOR EACH ROW EXECUTE FUNCTION public.trg_set_escola_rotinas();


--
-- Name: sistemas_notas trg_bi_sistemas_notas_escola; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bi_sistemas_notas_escola BEFORE INSERT OR UPDATE OF turma_id, semestre_id ON public.sistemas_notas FOR EACH ROW EXECUTE FUNCTION public.trg_set_escola_sistemas_notas();


--
-- Name: syllabi trg_bi_syllabi_escola; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bi_syllabi_escola BEFORE INSERT OR UPDATE OF curso_oferta_id ON public.syllabi FOR EACH ROW EXECUTE FUNCTION public.trg_set_escola_syllabi();


--
-- Name: configuracoes_escola trg_bu_config_escola_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bu_config_escola_updated_at BEFORE UPDATE ON public.configuracoes_escola FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: escola_usuarios trg_ensure_aluno_from_escola_usuario; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ensure_aluno_from_escola_usuario AFTER INSERT ON public.escola_usuarios FOR EACH ROW WHEN ((new.papel = 'aluno'::text)) EXECUTE FUNCTION public.ensure_aluno_from_escola_usuario();


--
-- Name: escolas trg_escolas_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_escolas_updated BEFORE UPDATE ON public.escolas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: matriculas trg_matriculas_status_canonical; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_matriculas_status_canonical BEFORE INSERT OR UPDATE OF status ON public.matriculas FOR EACH ROW EXECUTE FUNCTION public.matriculas_status_before_ins_upd();


--
-- Name: cursos trg_normalize_course_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_normalize_course_code BEFORE INSERT OR UPDATE OF course_code ON public.cursos FOR EACH ROW EXECUTE FUNCTION public.normalize_course_code();


--
-- Name: turmas trg_normalize_turma_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_normalize_turma_code BEFORE INSERT OR UPDATE OF turma_code ON public.turmas FOR EACH ROW EXECUTE FUNCTION public.normalize_turma_code();


--
-- Name: notas trg_notas_consistency; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notas_consistency BEFORE INSERT OR UPDATE ON public.notas FOR EACH ROW EXECUTE FUNCTION public.enforce_notas_consistency();


--
-- Name: profiles trg_profiles_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: matriculas trg_set_matricula_number; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_matricula_number BEFORE INSERT ON public.matriculas FOR EACH ROW EXECUTE FUNCTION public.trg_set_matricula_number();


--
-- Name: alunos trg_sync_nome_completo; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_nome_completo BEFORE INSERT OR UPDATE ON public.alunos FOR EACH ROW EXECUTE FUNCTION public.sync_alunos_nome_completo();


--
-- Name: turma_disciplinas_professores trg_tdp_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tdp_touch BEFORE UPDATE ON public.turma_disciplinas_professores FOR EACH ROW EXECUTE FUNCTION public.trg_touch_updated_at();


--
-- Name: turma_disciplinas trg_turma_disciplinas_consistency; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_turma_disciplinas_consistency BEFORE INSERT OR UPDATE ON public.turma_disciplinas FOR EACH ROW EXECUTE FUNCTION public.enforce_turma_disciplina_consistency();


--
-- Name: turma_disciplinas_legacy_patch_fix trg_turma_disciplinas_consistency; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_turma_disciplinas_consistency BEFORE INSERT OR UPDATE ON public.turma_disciplinas_legacy_patch_fix FOR EACH ROW EXECUTE FUNCTION public.enforce_turma_disciplina_consistency();


--
-- Name: alunos trigger_alunos_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_alunos_updated_at BEFORE UPDATE ON public.alunos FOR EACH ROW EXECUTE FUNCTION public.atualiza_updated_at();


--
-- Name: mensalidades trigger_mensalidades_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_mensalidades_updated_at BEFORE UPDATE ON public.mensalidades FOR EACH ROW EXECUTE FUNCTION public.atualiza_updated_at();


--
-- Name: pagamentos trigger_pagamentos_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_pagamentos_updated_at BEFORE UPDATE ON public.pagamentos FOR EACH ROW EXECUTE FUNCTION public.atualiza_updated_at();


--
-- Name: turmas turmas_audit_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER turmas_audit_delete AFTER DELETE ON public.turmas FOR EACH ROW EXECUTE FUNCTION public.log_turma_auditoria();


--
-- Name: turmas turmas_audit_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER turmas_audit_insert AFTER INSERT ON public.turmas FOR EACH ROW EXECUTE FUNCTION public.log_turma_auditoria();


--
-- Name: turmas turmas_audit_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER turmas_audit_update AFTER UPDATE ON public.turmas FOR EACH ROW EXECUTE FUNCTION public.log_turma_auditoria();


--
-- Name: alunos alunos_deleted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alunos
    ADD CONSTRAINT alunos_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.profiles(user_id) ON DELETE SET NULL;


--
-- Name: alunos alunos_escola_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alunos
    ADD CONSTRAINT alunos_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;


--
-- Name: alunos_excluidos alunos_excluidos_escola_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alunos_excluidos
    ADD CONSTRAINT alunos_excluidos_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;


--
-- Name: alunos_excluidos alunos_excluidos_excluido_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alunos_excluidos
    ADD CONSTRAINT alunos_excluidos_excluido_por_fkey FOREIGN KEY (excluido_por) REFERENCES public.profiles(user_id) ON DELETE SET NULL;


--
-- Name: alunos alunos_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alunos
    ADD CONSTRAINT alunos_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(user_id) ON DELETE SET NULL;


--
-- Name: anos_letivos anos_letivos_escola_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anos_letivos
    ADD CONSTRAINT anos_letivos_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;


--
-- Name: atribuicoes_prof atribuicoes_prof_curso_oferta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atribuicoes_prof
    ADD CONSTRAINT atribuicoes_prof_curso_oferta_id_fkey FOREIGN KEY (curso_oferta_id) REFERENCES public.cursos_oferta_legacy(id) ON DELETE CASCADE;


--
-- Name: atribuicoes_prof atribuicoes_prof_escola_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atribuicoes_prof
    ADD CONSTRAINT atribuicoes_prof_escola_fk FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;


--
-- Name: atribuicoes_prof atribuicoes_prof_professor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atribuicoes_prof
    ADD CONSTRAINT atribuicoes_prof_professor_user_id_fkey FOREIGN KEY (professor_user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;


--
-- Name: atribuicoes_prof atribuicoes_prof_secao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atribuicoes_prof
    ADD CONSTRAINT atribuicoes_prof_secao_id_fkey FOREIGN KEY (secao_id) REFERENCES public.secoes(id) ON DELETE CASCADE;


--
-- Name: audit_logs audit_logs_escola_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE SET NULL;


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id);


--
-- Name: aulas aulas_escola_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aulas
    ADD CONSTRAINT aulas_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;


--
-- Name: aulas aulas_turma_disciplina_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aulas
    ADD CONSTRAINT aulas_turma_disciplina_id_fkey FOREIGN KEY (turma_disciplina_id) REFERENCES public.turma_disciplinas_legacy_patch_fix(id) ON DELETE CASCADE;


--
-- Name: avaliacoes_legacy avaliacoes_curso_oferta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.avaliacoes_legacy
    ADD CONSTRAINT avaliacoes_curso_oferta_id_fkey FOREIGN KEY (curso_oferta_id) REFERENCES public.cursos_oferta_legacy(id) ON DELETE CASCADE;


--
-- Name: avaliacoes_legacy avaliacoes_escola_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.avaliacoes_legacy
    ADD CONSTRAINT avaliacoes_escola_fk FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;


--
-- Name: avaliacoes avaliacoes_escola_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.avaliacoes
    ADD CONSTRAINT avaliacoes_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;


--
-- Name: avaliacoes avaliacoes_periodo_letivo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.avaliacoes
    ADD CONSTRAINT avaliacoes_periodo_letivo_id_fkey FOREIGN KEY (periodo_letivo_id) REFERENCES public.periodos_letivos(id) ON DELETE RESTRICT;


--
-- Name: avaliacoes_legacy avaliacoes_sistema_notas_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.avaliacoes_legacy
    ADD CONSTRAINT avaliacoes_sistema_notas_id_fkey FOREIGN KEY (sistema_notas_id) REFERENCES public.sistemas_notas(id) ON DELETE SET NULL;


--
-- Name: avaliacoes_legacy avaliacoes_turma_disciplina_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.avaliacoes_legacy
    ADD CONSTRAINT avaliacoes_turma_disciplina_id_fkey FOREIGN KEY (turma_disciplina_id) REFERENCES public.turma_disciplinas_legacy_patch_fix(id) ON DELETE CASCADE;


--
-- Name: avaliacoes avaliacoes_turma_disciplina_id_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.avaliacoes
    ADD CONSTRAINT avaliacoes_turma_disciplina_id_fkey1 FOREIGN KEY (turma_disciplina_id) REFERENCES public.turma_disciplinas_legacy_patch_fix(id) ON DELETE CASCADE;


--
-- Name: classes classes_curso_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_curso_id_fkey FOREIGN KEY (curso_id) REFERENCES public.cursos(id) ON DELETE SET NULL;


--
-- Name: classes classes_escola_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;


--
-- Name: configuracoes_curriculo configuracoes_curriculo_curso_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.configuracoes_curriculo
    ADD CONSTRAINT configuracoes_curriculo_curso_id_fkey FOREIGN KEY (curso_id) REFERENCES public.cursos(id) ON DELETE CASCADE;


--
-- Name: configuracoes_curriculo configuracoes_curriculo_escola_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.configuracoes_curriculo
    ADD CONSTRAINT configuracoes_curriculo_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;


--
-- Name: configuracoes_escola configuracoes_escola_escola_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.configuracoes_escola
    ADD CONSTRAINT configuracoes_escola_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;


--
-- Name: curso_matriz curso_matriz_classe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.curso_matriz
    ADD CONSTRAINT curso_matriz_classe_id_fkey FOREIGN KEY (classe_id) REFERENCES public.classes(id) ON DELETE RESTRICT;


--
-- Name: curso_matriz curso_matriz_curso_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.curso_matriz
    ADD CONSTRAINT curso_matriz_curso_id_fkey FOREIGN KEY (curso_id) REFERENCES public.cursos(id) ON DELETE RESTRICT;


--
-- Name: curso_matriz curso_matriz_disciplina_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.curso_matriz
    ADD CONSTRAINT curso_matriz_disciplina_id_fkey FOREIGN KEY (disciplina_id) REFERENCES public.disciplinas_catalogo(id) ON DELETE RESTRICT;


--
-- Name: curso_matriz curso_matriz_escola_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.curso_matriz
    ADD CONSTRAINT curso_matriz_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;


--
-- Name: cursos cursos_curso_global_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cursos
    ADD CONSTRAINT cursos_curso_global_id_fkey FOREIGN KEY (curso_global_id) REFERENCES public.cursos_globais_cache(hash);


--
-- Name: cursos cursos_escola_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cursos
    ADD CONSTRAINT cursos_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;


--
-- Name: cursos_globais_cache cursos_globais_cache_created_by_escola_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cursos_globais_cache
    ADD CONSTRAINT cursos_globais_cache_created_by_escola_fkey FOREIGN KEY (created_by_escola) REFERENCES public.escolas(id);


--
-- Name: cursos_oferta_legacy cursos_oferta_curso_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cursos_oferta_legacy
    ADD CONSTRAINT cursos_oferta_curso_id_fkey FOREIGN KEY (curso_id) REFERENCES public.cursos(id) ON DELETE CASCADE;


--
-- Name: cursos_oferta_legacy cursos_oferta_escola_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cursos_oferta_legacy
    ADD CONSTRAINT cursos_oferta_escola_fk FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;


--
-- Name: cursos_oferta_legacy cursos_oferta_semestre_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cursos_oferta_legacy
    ADD CONSTRAINT cursos_oferta_semestre_id_fkey FOREIGN KEY (semestre_id) REFERENCES public.semestres_legacy(id) ON DELETE CASCADE;


--
-- Name: cursos_oferta_legacy cursos_oferta_turma_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cursos_oferta_legacy
    ADD CONSTRAINT cursos_oferta_turma_id_fkey FOREIGN KEY (turma_id) REFERENCES public.turmas(id) ON DELETE CASCADE;


--
-- Name: cursos cursos_semestre_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cursos
    ADD CONSTRAINT cursos_semestre_id_fkey FOREIGN KEY (semestre_id) REFERENCES public.semestres_legacy(id);


--
-- Name: disciplinas_catalogo disciplinas_catalogo_escola_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.disciplinas_catalogo
    ADD CONSTRAINT disciplinas_catalogo_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;


--
-- Name: disciplinas_legacy disciplinas_classe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.disciplinas_legacy
    ADD CONSTRAINT disciplinas_classe_id_fkey FOREIGN KEY (classe_id) REFERENCES public.classes(id) ON DELETE CASCADE;


--
-- Name: disciplinas_legacy disciplinas_curso_escola_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.disciplinas_legacy
    ADD CONSTRAINT disciplinas_curso_escola_id_fkey FOREIGN KEY (curso_escola_id) REFERENCES public.cursos(id) ON DELETE CASCADE;


--
-- Name: disciplinas_legacy disciplinas_curso_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.disciplinas_legacy
    ADD CONSTRAINT disciplinas_curso_id_fkey FOREIGN KEY (curso_id) REFERENCES public.cursos(id) ON DELETE CASCADE;


--
-- Name: disciplinas_legacy disciplinas_escola_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.disciplinas_legacy
    ADD CONSTRAINT disciplinas_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;


--
-- Name: documentos_emitidos documentos_emitidos_aluno_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_emitidos
    ADD CONSTRAINT documentos_emitidos_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id) ON DELETE RESTRICT;


--
-- Name: documentos_emitidos documentos_emitidos_escola_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_emitidos
    ADD CONSTRAINT documentos_emitidos_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;


--
-- Name: documentos_emitidos documentos_emitidos_mensalidade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_emitidos
    ADD CONSTRAINT documentos_emitidos_mensalidade_id_fkey FOREIGN KEY (mensalidade_id) REFERENCES public.mensalidades(id) ON DELETE SET NULL;


--
-- Name: escola_administradores escola_administradores_escola_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escola_administradores
    ADD CONSTRAINT escola_administradores_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;


--
-- Name: escola_administradores escola_administradores_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escola_administradores
    ADD CONSTRAINT escola_administradores_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: escola_auditoria escola_auditoria_escola_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escola_auditoria
    ADD CONSTRAINT escola_auditoria_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;


--
-- Name: escola_configuracoes escola_configuracoes_escola_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escola_configuracoes
    ADD CONSTRAINT escola_configuracoes_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;


--
-- Name: escola_members escola_members_escola_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escola_members
    ADD CONSTRAINT escola_members_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;


--
-- Name: escola_members escola_members_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escola_members
    ADD CONSTRAINT escola_members_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- Name: escola_members escola_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escola_members
    ADD CONSTRAINT escola_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;


--
-- Name: escola_users escola_users_escola_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escola_users
    ADD CONSTRAINT escola_users_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;


--
-- Name: escola_users escola_users_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escola_users
    ADD CONSTRAINT escola_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: escola_usuarios escola_usuarios_escola_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escola_usuarios
    ADD CONSTRAINT escola_usuarios_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;


--
-- Name: escola_usuarios escola_usuarios_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escola_usuarios
    ADD CONSTRAINT escola_usuarios_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: events events_escola_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;


--
-- Name: financeiro_cobrancas financeiro_cobrancas_aluno_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_cobrancas
    ADD CONSTRAINT financeiro_cobrancas_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id) ON DELETE CASCADE;


--
-- Name: financeiro_cobrancas financeiro_cobrancas_escola_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_cobrancas
    ADD CONSTRAINT financeiro_cobrancas_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;


--
-- Name: financeiro_cobrancas financeiro_cobrancas_mensalidade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_cobrancas
    ADD CONSTRAINT financeiro_cobrancas_mensalidade_id_fkey FOREIGN KEY (mensalidade_id) REFERENCES public.mensalidades(id) ON DELETE SET NULL;


--
-- Name: financeiro_contratos financeiro_contratos_aluno_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_contratos
    ADD CONSTRAINT financeiro_contratos_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id);


--
-- Name: financeiro_contratos financeiro_contratos_escola_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_contratos
    ADD CONSTRAINT financeiro_contratos_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escolas(id);


--
-- Name: financeiro_contratos financeiro_contratos_matricula_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_contratos
    ADD CONSTRAINT financeiro_contratos_matricula_id_fkey FOREIGN KEY (matricula_id) REFERENCES public.matriculas(id);


--
-- Name: financeiro_estornos financeiro_estornos_escola_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_estornos
    ADD CONSTRAINT financeiro_estornos_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;


--
-- Name: financeiro_estornos financeiro_estornos_mensalidade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_estornos
    ADD CONSTRAINT financeiro_estornos_mensalidade_id_fkey FOREIGN KEY (mensalidade_id) REFERENCES public.mensalidades(id) ON DELETE CASCADE;


--
-- Name: financeiro_itens financeiro_itens_escola_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_itens
    ADD CONSTRAINT financeiro_itens_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;


--
-- Name: financeiro_lancamentos financeiro_lancamentos_aluno_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_lancamentos
    ADD CONSTRAINT financeiro_lancamentos_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id) ON DELETE CASCADE;


--
-- Name: financeiro_lancamentos financeiro_lancamentos_escola_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_lancamentos
    ADD CONSTRAINT financeiro_lancamentos_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;


--
-- Name: financeiro_lancamentos financeiro_lancamentos_matricula_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_lancamentos
    ADD CONSTRAINT financeiro_lancamentos_matricula_id_fkey FOREIGN KEY (matricula_id) REFERENCES public.matriculas(id) ON DELETE SET NULL;


--
-- Name: financeiro_tabelas financeiro_tabelas_classe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_tabelas
    ADD CONSTRAINT financeiro_tabelas_classe_id_fkey FOREIGN KEY (classe_id) REFERENCES public.classes(id) ON DELETE SET NULL;


--
-- Name: financeiro_tabelas financeiro_tabelas_curso_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_tabelas
    ADD CONSTRAINT financeiro_tabelas_curso_id_fkey FOREIGN KEY (curso_id) REFERENCES public.cursos(id) ON DELETE SET NULL;


--
-- Name: financeiro_tabelas financeiro_tabelas_escola_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_tabelas
    ADD CONSTRAINT financeiro_tabelas_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;


--
-- Name: financeiro_titulos financeiro_titulos_aluno_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_titulos
    ADD CONSTRAINT financeiro_titulos_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id);


--
-- Name: financeiro_titulos financeiro_titulos_contrato_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_titulos
    ADD CONSTRAINT financeiro_titulos_contrato_id_fkey FOREIGN KEY (contrato_id) REFERENCES public.financeiro_contratos(id) ON DELETE SET NULL;


--
-- Name: financeiro_titulos financeiro_titulos_escola_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_titulos
    ADD CONSTRAINT financeiro_titulos_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escolas(id);


--
-- Name: escola_administradores fk_escola_admin_escola; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escola_administradores
    ADD CONSTRAINT fk_escola_admin_escola FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;


--
-- Name: escola_administradores fk_escola_admin_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escola_administradores
    ADD CONSTRAINT fk_escola_admin_user FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;


--
-- Name: frequencias frequencias_aula_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.frequencias
    ADD CONSTRAINT frequencias_aula_id_fkey FOREIGN KEY (aula_id) REFERENCES public.aulas(id) ON DELETE CASCADE;


--
-- Name: frequencias_default frequencias_curso_oferta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.frequencias_default
    ADD CONSTRAINT frequencias_curso_oferta_id_fkey FOREIGN KEY (curso_oferta_id) REFERENCES public.cursos_oferta_legacy(id) ON DELETE SET NULL;


--
-- Name: frequencias frequencias_escola_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.frequencias
    ADD CONSTRAINT frequencias_escola_fk FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;


--
-- Name: frequencias_default frequencias_matricula_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.frequencias_default
    ADD CONSTRAINT frequencias_matricula_id_fkey FOREIGN KEY (matricula_id) REFERENCES public.matriculas(id) ON DELETE CASCADE;


--
-- Name: frequencias_default frequencias_routine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.frequencias_default
    ADD CONSTRAINT frequencias_routine_id_fkey FOREIGN KEY (routine_id) REFERENCES public.rotinas(id) ON DELETE SET NULL;


--
-- Name: historico_anos historico_anos_aluno_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historico_anos
    ADD CONSTRAINT historico_anos_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id);


--
-- Name: historico_anos historico_anos_escola_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historico_anos
    ADD CONSTRAINT historico_anos_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escolas(id);


--
-- Name: historico_anos historico_anos_turma_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historico_anos
    ADD CONSTRAINT historico_anos_turma_id_fkey FOREIGN KEY (turma_id) REFERENCES public.turmas(id);


--
-- Name: historico_disciplinas historico_disciplinas_disciplina_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historico_disciplinas
    ADD CONSTRAINT historico_disciplinas_disciplina_id_fkey FOREIGN KEY (disciplina_id) REFERENCES public.disciplinas_legacy(id);


--
-- Name: historico_disciplinas historico_disciplinas_historico_ano_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historico_disciplinas
    ADD CONSTRAINT historico_disciplinas_historico_ano_id_fkey FOREIGN KEY (historico_ano_id) REFERENCES public.historico_anos(id) ON DELETE CASCADE;


--
-- Name: import_errors import_errors_import_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_errors
    ADD CONSTRAINT import_errors_import_id_fkey FOREIGN KEY (import_id) REFERENCES public.import_migrations(id) ON DELETE CASCADE;


--
-- Name: import_migrations import_migrations_escola_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_migrations
    ADD CONSTRAINT import_migrations_escola_fk FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;


--
-- Name: lancamentos_default lancamentos_avaliacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lancamentos_default
    ADD CONSTRAINT lancamentos_avaliacao_id_fkey FOREIGN KEY (avaliacao_id) REFERENCES public.avaliacoes_legacy(id) ON DELETE CASCADE;


--
-- Name: lancamentos lancamentos_escola_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.lancamentos
    ADD CONSTRAINT lancamentos_escola_fk FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;


--
-- Name: lancamentos_default lancamentos_matricula_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lancamentos_default
    ADD CONSTRAINT lancamentos_matricula_id_fkey FOREIGN KEY (matricula_id) REFERENCES public.matriculas(id) ON DELETE CASCADE;


--
-- Name: matricula_counters matricula_counters_escola_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matricula_counters
    ADD CONSTRAINT matricula_counters_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;


--
-- Name: matriculas matriculas_aluno_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matriculas
    ADD CONSTRAINT matriculas_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id) ON DELETE CASCADE;


--
-- Name: matriculas_cursos matriculas_cursos_curso_oferta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matriculas_cursos
    ADD CONSTRAINT matriculas_cursos_curso_oferta_id_fkey FOREIGN KEY (curso_oferta_id) REFERENCES public.cursos_oferta_legacy(id) ON DELETE CASCADE;


--
-- Name: matriculas_cursos matriculas_cursos_escola_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matriculas_cursos
    ADD CONSTRAINT matriculas_cursos_escola_fk FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;


--
-- Name: matriculas_cursos matriculas_cursos_matricula_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matriculas_cursos
    ADD CONSTRAINT matriculas_cursos_matricula_id_fkey FOREIGN KEY (matricula_id) REFERENCES public.matriculas(id) ON DELETE CASCADE;


--
-- Name: matriculas matriculas_escola_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matriculas
    ADD CONSTRAINT matriculas_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;


--
-- Name: matriculas matriculas_secao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matriculas
    ADD CONSTRAINT matriculas_secao_id_fkey FOREIGN KEY (secao_id) REFERENCES public.secoes(id) ON DELETE SET NULL;


--
-- Name: matriculas matriculas_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matriculas
    ADD CONSTRAINT matriculas_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.school_sessions_legacy(id) ON DELETE SET NULL;


--
-- Name: matriculas matriculas_turma_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matriculas
    ADD CONSTRAINT matriculas_turma_id_fkey FOREIGN KEY (turma_id) REFERENCES public.turmas(id) ON DELETE CASCADE;


--
-- Name: mensalidades mensalidades_aluno_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensalidades
    ADD CONSTRAINT mensalidades_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id);


--
-- Name: mensalidades mensalidades_matricula_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensalidades
    ADD CONSTRAINT mensalidades_matricula_id_fkey FOREIGN KEY (matricula_id) REFERENCES public.matriculas(id) ON DELETE SET NULL;


--
-- Name: notas notas_avaliacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notas
    ADD CONSTRAINT notas_avaliacao_id_fkey FOREIGN KEY (avaliacao_id) REFERENCES public.avaliacoes(id) ON DELETE CASCADE;


--
-- Name: notas_avaliacoes notas_avaliacoes_aluno_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notas_avaliacoes
    ADD CONSTRAINT notas_avaliacoes_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id) ON DELETE RESTRICT;


--
-- Name: notas_avaliacoes notas_avaliacoes_avaliacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notas_avaliacoes
    ADD CONSTRAINT notas_avaliacoes_avaliacao_id_fkey FOREIGN KEY (avaliacao_id) REFERENCES public.avaliacoes_legacy(id) ON DELETE CASCADE;


--
-- Name: notas_avaliacoes notas_avaliacoes_matricula_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notas_avaliacoes
    ADD CONSTRAINT notas_avaliacoes_matricula_id_fkey FOREIGN KEY (matricula_id) REFERENCES public.matriculas(id) ON DELETE CASCADE;


--
-- Name: notas_legacy notas_escola_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notas_legacy
    ADD CONSTRAINT notas_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;


--
-- Name: notas notas_escola_id_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notas
    ADD CONSTRAINT notas_escola_id_fkey1 FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;


--
-- Name: notas notas_matricula_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notas
    ADD CONSTRAINT notas_matricula_id_fkey FOREIGN KEY (matricula_id) REFERENCES public.matriculas(id) ON DELETE CASCADE;


--
-- Name: notas_legacy notas_periodo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notas_legacy
    ADD CONSTRAINT notas_periodo_id_fkey FOREIGN KEY (periodo_id) REFERENCES public.periodos_letivos_legacy(id) ON DELETE CASCADE;


--
-- Name: notas_legacy notas_turma_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notas_legacy
    ADD CONSTRAINT notas_turma_id_fkey FOREIGN KEY (turma_id) REFERENCES public.turmas(id) ON DELETE CASCADE;


--
-- Name: notices notices_escola_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notices
    ADD CONSTRAINT notices_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_escola_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;


--
-- Name: onboarding_drafts onboarding_drafts_escola_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_drafts
    ADD CONSTRAINT onboarding_drafts_escola_fk FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;


--
-- Name: pagamentos pagamentos_mensalidade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagamentos
    ADD CONSTRAINT pagamentos_mensalidade_id_fkey FOREIGN KEY (mensalidade_id) REFERENCES public.mensalidades(id);


--
-- Name: periodos_letivos periodos_letivos_ano_letivo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.periodos_letivos
    ADD CONSTRAINT periodos_letivos_ano_letivo_id_fkey FOREIGN KEY (ano_letivo_id) REFERENCES public.anos_letivos(id) ON DELETE CASCADE;


--
-- Name: periodos_letivos_legacy periodos_letivos_escola_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.periodos_letivos_legacy
    ADD CONSTRAINT periodos_letivos_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;


--
-- Name: periodos_letivos periodos_letivos_escola_id_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.periodos_letivos
    ADD CONSTRAINT periodos_letivos_escola_id_fkey1 FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;


--
-- Name: permissions permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: presencas presencas_escola_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presencas
    ADD CONSTRAINT presencas_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;


--
-- Name: presencas presencas_turma_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presencas
    ADD CONSTRAINT presencas_turma_id_fkey FOREIGN KEY (turma_id) REFERENCES public.turmas(id) ON DELETE CASCADE;


--
-- Name: professores professores_escola_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.professores
    ADD CONSTRAINT professores_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;


--
-- Name: professores professores_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.professores
    ADD CONSTRAINT professores_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;


--
-- Name: profiles profiles_current_escola_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_current_escola_id_fkey FOREIGN KEY (current_escola_id) REFERENCES public.escolas(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_escola_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: regras_escala regras_escala_escola_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regras_escala
    ADD CONSTRAINT regras_escala_escola_fk FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;


--
-- Name: regras_escala regras_escala_sistema_notas_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regras_escala
    ADD CONSTRAINT regras_escala_sistema_notas_id_fkey FOREIGN KEY (sistema_notas_id) REFERENCES public.sistemas_notas(id) ON DELETE CASCADE;


--
-- Name: rotinas rotinas_curso_oferta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rotinas
    ADD CONSTRAINT rotinas_curso_oferta_id_fkey FOREIGN KEY (curso_oferta_id) REFERENCES public.cursos_oferta_legacy(id) ON DELETE CASCADE;


--
-- Name: rotinas rotinas_escola_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rotinas
    ADD CONSTRAINT rotinas_escola_fk FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;


--
-- Name: rotinas rotinas_professor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rotinas
    ADD CONSTRAINT rotinas_professor_user_id_fkey FOREIGN KEY (professor_user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;


--
-- Name: rotinas rotinas_secao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rotinas
    ADD CONSTRAINT rotinas_secao_id_fkey FOREIGN KEY (secao_id) REFERENCES public.secoes(id) ON DELETE SET NULL;


--
-- Name: rotinas rotinas_turma_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rotinas
    ADD CONSTRAINT rotinas_turma_id_fkey FOREIGN KEY (turma_id) REFERENCES public.turmas(id) ON DELETE CASCADE;


--
-- Name: school_sessions_legacy school_sessions_escola_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.school_sessions_legacy
    ADD CONSTRAINT school_sessions_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;


--
-- Name: secoes secoes_escola_fk_linter_fix; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.secoes
    ADD CONSTRAINT secoes_escola_fk_linter_fix FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;


--
-- Name: secoes secoes_turma_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.secoes
    ADD CONSTRAINT secoes_turma_id_fkey FOREIGN KEY (turma_id) REFERENCES public.turmas(id) ON DELETE CASCADE;


--
-- Name: semestres_legacy semestres_escola_fk_linter_fix; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.semestres_legacy
    ADD CONSTRAINT semestres_escola_fk_linter_fix FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;


--
-- Name: semestres_legacy semestres_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.semestres_legacy
    ADD CONSTRAINT semestres_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.school_sessions_legacy(id) ON DELETE CASCADE;


--
-- Name: sistemas_notas sistemas_notas_escola_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sistemas_notas
    ADD CONSTRAINT sistemas_notas_escola_fk FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;


--
-- Name: sistemas_notas sistemas_notas_semestre_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sistemas_notas
    ADD CONSTRAINT sistemas_notas_semestre_id_fkey FOREIGN KEY (semestre_id) REFERENCES public.semestres_legacy(id) ON DELETE CASCADE;


--
-- Name: sistemas_notas sistemas_notas_turma_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sistemas_notas
    ADD CONSTRAINT sistemas_notas_turma_id_fkey FOREIGN KEY (turma_id) REFERENCES public.turmas(id) ON DELETE CASCADE;


--
-- Name: staging_alunos staging_alunos_import_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staging_alunos
    ADD CONSTRAINT staging_alunos_import_id_fkey FOREIGN KEY (import_id) REFERENCES public.import_migrations(id) ON DELETE CASCADE;


--
-- Name: syllabi syllabi_curso_oferta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.syllabi
    ADD CONSTRAINT syllabi_curso_oferta_id_fkey FOREIGN KEY (curso_oferta_id) REFERENCES public.cursos_oferta_legacy(id) ON DELETE CASCADE;


--
-- Name: syllabi syllabi_escola_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.syllabi
    ADD CONSTRAINT syllabi_escola_fk FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;


--
-- Name: tabelas_mensalidade tabelas_mensalidade_classe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tabelas_mensalidade
    ADD CONSTRAINT tabelas_mensalidade_classe_id_fkey FOREIGN KEY (classe_id) REFERENCES public.classes(id) ON DELETE SET NULL;


--
-- Name: tabelas_mensalidade tabelas_mensalidade_curso_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tabelas_mensalidade
    ADD CONSTRAINT tabelas_mensalidade_curso_id_fkey FOREIGN KEY (curso_id) REFERENCES public.cursos(id) ON DELETE SET NULL;


--
-- Name: tabelas_mensalidade tabelas_mensalidade_escola_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tabelas_mensalidade
    ADD CONSTRAINT tabelas_mensalidade_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;


--
-- Name: turma_disciplinas turma_disciplinas_curso_matriz_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.turma_disciplinas
    ADD CONSTRAINT turma_disciplinas_curso_matriz_id_fkey FOREIGN KEY (curso_matriz_id) REFERENCES public.curso_matriz(id) ON DELETE RESTRICT;


--
-- Name: turma_disciplinas_legacy_patch_fix turma_disciplinas_disciplina_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.turma_disciplinas_legacy_patch_fix
    ADD CONSTRAINT turma_disciplinas_disciplina_id_fkey FOREIGN KEY (disciplina_id) REFERENCES public.disciplinas_legacy(id) ON DELETE RESTRICT;


--
-- Name: turma_disciplinas_legacy_patch_fix turma_disciplinas_escola_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.turma_disciplinas_legacy_patch_fix
    ADD CONSTRAINT turma_disciplinas_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;


--
-- Name: turma_disciplinas turma_disciplinas_escola_id_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.turma_disciplinas
    ADD CONSTRAINT turma_disciplinas_escola_id_fkey1 FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;


--
-- Name: turma_disciplinas_professores turma_disciplinas_professores_escola_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.turma_disciplinas_professores
    ADD CONSTRAINT turma_disciplinas_professores_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;


--
-- Name: turma_disciplinas_professores turma_disciplinas_professores_professor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.turma_disciplinas_professores
    ADD CONSTRAINT turma_disciplinas_professores_professor_id_fkey FOREIGN KEY (professor_id) REFERENCES public.professores(id) ON DELETE CASCADE;


--
-- Name: turma_disciplinas_professores turma_disciplinas_professores_syllabus_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.turma_disciplinas_professores
    ADD CONSTRAINT turma_disciplinas_professores_syllabus_id_fkey FOREIGN KEY (syllabus_id) REFERENCES public.syllabi(id) ON DELETE SET NULL;


--
-- Name: turma_disciplinas_professores turma_disciplinas_professores_turma_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.turma_disciplinas_professores
    ADD CONSTRAINT turma_disciplinas_professores_turma_id_fkey FOREIGN KEY (turma_id) REFERENCES public.turmas(id) ON DELETE CASCADE;


--
-- Name: turma_disciplinas_legacy_patch_fix turma_disciplinas_turma_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.turma_disciplinas_legacy_patch_fix
    ADD CONSTRAINT turma_disciplinas_turma_id_fkey FOREIGN KEY (turma_id) REFERENCES public.turmas(id) ON DELETE CASCADE;


--
-- Name: turma_disciplinas turma_disciplinas_turma_id_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.turma_disciplinas
    ADD CONSTRAINT turma_disciplinas_turma_id_fkey1 FOREIGN KEY (turma_id) REFERENCES public.turmas(id) ON DELETE CASCADE;


--
-- Name: turmas_auditoria turmas_auditoria_escola_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.turmas_auditoria
    ADD CONSTRAINT turmas_auditoria_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;


--
-- Name: turmas turmas_classe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.turmas
    ADD CONSTRAINT turmas_classe_id_fkey FOREIGN KEY (classe_id) REFERENCES public.classes(id) ON DELETE SET NULL;


--
-- Name: turmas turmas_coordenador_pedagogico_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.turmas
    ADD CONSTRAINT turmas_coordenador_pedagogico_id_fkey FOREIGN KEY (coordenador_pedagogico_id) REFERENCES public.escola_usuarios(id) ON DELETE SET NULL;


--
-- Name: turmas turmas_curso_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.turmas
    ADD CONSTRAINT turmas_curso_id_fkey FOREIGN KEY (curso_id) REFERENCES public.cursos(id);


--
-- Name: turmas turmas_diretor_turma_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.turmas
    ADD CONSTRAINT turmas_diretor_turma_id_fkey FOREIGN KEY (diretor_turma_id) REFERENCES public.escola_usuarios(id) ON DELETE SET NULL;


--
-- Name: turmas turmas_escola_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.turmas
    ADD CONSTRAINT turmas_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;


--
-- Name: turmas turmas_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.turmas
    ADD CONSTRAINT turmas_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.school_sessions_legacy(id) ON DELETE SET NULL;


--
-- Name: permissions Allow read access to authenticated users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow read access to authenticated users" ON public.permissions FOR SELECT TO authenticated USING (true);


--
-- Name: roles Allow read access to authenticated users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow read access to authenticated users" ON public.roles FOR SELECT TO authenticated USING (true);


--
-- Name: configuracoes_curriculo Escola gerencia config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Escola gerencia config" ON public.configuracoes_curriculo TO authenticated USING ((escola_id IN ( SELECT p.escola_id
   FROM public.profiles p
  WHERE (p.user_id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((escola_id IN ( SELECT p.escola_id
   FROM public.profiles p
  WHERE (p.user_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: escola_auditoria Tenant Isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant Isolation" ON public.escola_auditoria USING ((escola_id = public.current_tenant_escola_id())) WITH CHECK ((escola_id = public.current_tenant_escola_id()));


--
-- Name: escola_members Tenant Isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant Isolation" ON public.escola_members USING ((escola_id = public.current_tenant_escola_id())) WITH CHECK ((escola_id = public.current_tenant_escola_id()));


--
-- Name: frequencias Tenant Isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant Isolation" ON public.frequencias USING ((escola_id = public.current_tenant_escola_id())) WITH CHECK ((escola_id = public.current_tenant_escola_id()));


--
-- Name: lancamentos Tenant Isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant Isolation" ON public.lancamentos USING ((escola_id = public.current_tenant_escola_id())) WITH CHECK ((escola_id = public.current_tenant_escola_id()));


--
-- Name: pagamentos Tenant Isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant Isolation" ON public.pagamentos USING ((escola_id = public.current_tenant_escola_id())) WITH CHECK ((escola_id = public.current_tenant_escola_id()));


--
-- Name: periodos_letivos_legacy Tenant Isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant Isolation" ON public.periodos_letivos_legacy USING ((escola_id = public.current_tenant_escola_id())) WITH CHECK ((escola_id = public.current_tenant_escola_id()));


--
-- Name: presencas Tenant Isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant Isolation" ON public.presencas USING ((escola_id = public.current_tenant_escola_id())) WITH CHECK ((escola_id = public.current_tenant_escola_id()));


--
-- Name: professores Tenant Isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant Isolation" ON public.professores USING ((escola_id = public.current_tenant_escola_id())) WITH CHECK ((escola_id = public.current_tenant_escola_id()));


--
-- Name: school_sessions_legacy Tenant Isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant Isolation" ON public.school_sessions_legacy USING ((escola_id = public.current_tenant_escola_id())) WITH CHECK ((escola_id = public.current_tenant_escola_id()));


--
-- Name: secoes Tenant Isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant Isolation" ON public.secoes USING ((escola_id = public.current_tenant_escola_id())) WITH CHECK ((escola_id = public.current_tenant_escola_id()));


--
-- Name: semestres_legacy Tenant Isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant Isolation" ON public.semestres_legacy USING ((escola_id = public.current_tenant_escola_id())) WITH CHECK ((escola_id = public.current_tenant_escola_id()));


--
-- Name: turmas_auditoria Tenant Isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant Isolation" ON public.turmas_auditoria USING ((escola_id = public.current_tenant_escola_id())) WITH CHECK ((escola_id = public.current_tenant_escola_id()));


--
-- Name: aluno_processo_counters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.aluno_processo_counters ENABLE ROW LEVEL SECURITY;

--
-- Name: alunos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.alunos ENABLE ROW LEVEL SECURITY;

--
-- Name: alunos alunos_delete_staff_v3; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY alunos_delete_staff_v3 ON public.alunos FOR DELETE TO authenticated USING (public.is_staff_escola(escola_id));


--
-- Name: alunos_excluidos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.alunos_excluidos ENABLE ROW LEVEL SECURITY;

--
-- Name: alunos_excluidos alunos_excluidos_select_opt; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY alunos_excluidos_select_opt ON public.alunos_excluidos FOR SELECT TO authenticated USING ((escola_id IN ( SELECT p.escola_id
   FROM public.profiles p
  WHERE (p.user_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: alunos alunos_insert_staff_v3; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY alunos_insert_staff_v3 ON public.alunos FOR INSERT TO authenticated WITH CHECK (public.is_staff_escola(escola_id));


--
-- Name: alunos alunos_select_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY alunos_select_tenant ON public.alunos FOR SELECT TO authenticated USING (public.has_access_to_escola(escola_id));


--
-- Name: alunos alunos_select_unificado_v3; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY alunos_select_unificado_v3 ON public.alunos FOR SELECT TO authenticated USING ((public.is_staff_escola(escola_id) OR (( SELECT count(*) AS count
   FROM public.profiles p
  WHERE ((p.user_id = ( SELECT auth.uid() AS uid)) AND ((p.user_id = alunos.profile_id) OR ((p.role = 'encarregado'::public.user_role) AND (p.telefone = alunos.encarregado_telefone))))) > 0)));


--
-- Name: alunos alunos_service_import; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY alunos_service_import ON public.alunos TO service_role USING (true) WITH CHECK (true);


--
-- Name: alunos alunos_update_staff_v3; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY alunos_update_staff_v3 ON public.alunos FOR UPDATE TO authenticated USING (public.is_staff_escola(escola_id)) WITH CHECK (public.is_staff_escola(escola_id));


--
-- Name: anos_letivos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.anos_letivos ENABLE ROW LEVEL SECURITY;

--
-- Name: atribuicoes_prof; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.atribuicoes_prof ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs audit_logs_insert_v3; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_logs_insert_v3 ON public.audit_logs FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: audit_logs audit_logs_select_v3; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_logs_select_v3 ON public.audit_logs FOR SELECT TO authenticated USING (((( SELECT auth.role() AS role) = 'service_role'::text) OR (escola_id IN ( SELECT p.escola_id
   FROM public.profiles p
  WHERE (p.user_id = ( SELECT auth.uid() AS uid)))) OR ((escola_id IS NULL) AND (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.user_id = ( SELECT auth.uid() AS uid)) AND (p.role = 'super_admin'::public.user_role)))))));


--
-- Name: aulas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.aulas ENABLE ROW LEVEL SECURITY;

--
-- Name: avaliacoes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.avaliacoes ENABLE ROW LEVEL SECURITY;

--
-- Name: avaliacoes_legacy; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.avaliacoes_legacy ENABLE ROW LEVEL SECURITY;

--
-- Name: classes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

--
-- Name: classes classes_unificado_v3; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY classes_unificado_v3 ON public.classes TO authenticated USING ((escola_id IN ( SELECT p.escola_id
   FROM public.profiles p
  WHERE (p.user_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: financeiro_cobrancas cobrancas_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cobrancas_tenant_isolation ON public.financeiro_cobrancas USING ((escola_id = public.current_tenant_escola_id())) WITH CHECK ((escola_id = public.current_tenant_escola_id()));


--
-- Name: configuracoes_escola config_escola_unificado_v3; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY config_escola_unificado_v3 ON public.configuracoes_escola TO authenticated USING ((escola_id IN ( SELECT p.escola_id
   FROM public.profiles p
  WHERE (p.user_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: configuracoes_curriculo; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.configuracoes_curriculo ENABLE ROW LEVEL SECURITY;

--
-- Name: configuracoes_escola; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.configuracoes_escola ENABLE ROW LEVEL SECURITY;

--
-- Name: curso_matriz; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.curso_matriz ENABLE ROW LEVEL SECURITY;

--
-- Name: cursos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cursos ENABLE ROW LEVEL SECURITY;

--
-- Name: cursos_globais_cache; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cursos_globais_cache ENABLE ROW LEVEL SECURITY;

--
-- Name: cursos_globais_cache cursos_globais_insert_v3; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cursos_globais_insert_v3 ON public.cursos_globais_cache FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.role() AS role) = ANY (ARRAY['authenticated'::text, 'service_role'::text])));


--
-- Name: cursos_globais_cache cursos_globais_read_v2; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cursos_globais_read_v2 ON public.cursos_globais_cache FOR SELECT TO authenticated, anon USING (true);


--
-- Name: cursos cursos_isolation_unificado; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cursos_isolation_unificado ON public.cursos TO authenticated USING ((escola_id IN ( SELECT p.escola_id
   FROM public.profiles p
  WHERE (p.user_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: cursos_oferta_legacy; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cursos_oferta_legacy ENABLE ROW LEVEL SECURITY;

--
-- Name: cursos cursos_select_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cursos_select_tenant ON public.cursos FOR SELECT TO authenticated USING (public.has_access_to_escola(escola_id));


--
-- Name: disciplinas_catalogo; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.disciplinas_catalogo ENABLE ROW LEVEL SECURITY;

--
-- Name: disciplinas_catalogo disciplinas_delete_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY disciplinas_delete_policy ON public.disciplinas_catalogo FOR DELETE USING ((escola_id = public.current_tenant_escola_id()));


--
-- Name: disciplinas_catalogo disciplinas_insert_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY disciplinas_insert_policy ON public.disciplinas_catalogo FOR INSERT WITH CHECK ((escola_id = public.current_tenant_escola_id()));


--
-- Name: disciplinas_legacy; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.disciplinas_legacy ENABLE ROW LEVEL SECURITY;

--
-- Name: disciplinas_catalogo disciplinas_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY disciplinas_select_policy ON public.disciplinas_catalogo FOR SELECT USING ((escola_id = public.current_tenant_escola_id()));


--
-- Name: disciplinas_legacy disciplinas_unificado_v3; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY disciplinas_unificado_v3 ON public.disciplinas_legacy TO authenticated USING ((escola_id IN ( SELECT p.escola_id
   FROM public.profiles p
  WHERE (p.user_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: disciplinas_catalogo disciplinas_update_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY disciplinas_update_policy ON public.disciplinas_catalogo FOR UPDATE USING ((escola_id = public.current_tenant_escola_id())) WITH CHECK ((escola_id = public.current_tenant_escola_id()));


--
-- Name: documentos_emitidos docs_insert_school; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY docs_insert_school ON public.documentos_emitidos FOR INSERT TO authenticated WITH CHECK ((public.is_super_admin() OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.user_id = auth.uid()) AND ((p.escola_id = documentos_emitidos.escola_id) OR (p.current_escola_id = documentos_emitidos.escola_id)))))));


--
-- Name: documentos_emitidos docs_select_school; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY docs_select_school ON public.documentos_emitidos FOR SELECT TO authenticated USING ((public.is_super_admin() OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.user_id = auth.uid()) AND ((p.escola_id = documentos_emitidos.escola_id) OR (p.current_escola_id = documentos_emitidos.escola_id)))))));


--
-- Name: documentos_emitidos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.documentos_emitidos ENABLE ROW LEVEL SECURITY;

--
-- Name: escola_administradores; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.escola_administradores ENABLE ROW LEVEL SECURITY;

--
-- Name: escola_administradores escola_admins_unificado_v3; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY escola_admins_unificado_v3 ON public.escola_administradores TO authenticated USING (((( SELECT auth.role() AS role) = 'service_role'::text) OR (escola_id IN ( SELECT p.escola_id
   FROM public.profiles p
  WHERE (p.user_id = ( SELECT auth.uid() AS uid))))));


--
-- Name: escola_auditoria; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.escola_auditoria ENABLE ROW LEVEL SECURITY;

--
-- Name: escola_configuracoes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.escola_configuracoes ENABLE ROW LEVEL SECURITY;

--
-- Name: escola_configuracoes escola_configuracoes_unificado_v3; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY escola_configuracoes_unificado_v3 ON public.escola_configuracoes TO authenticated USING ((escola_id IN ( SELECT p.escola_id
   FROM public.profiles p
  WHERE (p.user_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: escola_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.escola_members ENABLE ROW LEVEL SECURITY;

--
-- Name: escola_users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.escola_users ENABLE ROW LEVEL SECURITY;

--
-- Name: escola_users escola_users_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY escola_users_delete ON public.escola_users FOR DELETE TO authenticated USING ((escola_id = public.current_escola_id()));


--
-- Name: escola_users escola_users_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY escola_users_insert ON public.escola_users FOR INSERT TO authenticated WITH CHECK ((escola_id = public.current_escola_id()));


--
-- Name: escola_users escola_users_select_v3; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY escola_users_select_v3 ON public.escola_users FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: escola_users escola_users_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY escola_users_update ON public.escola_users FOR UPDATE TO authenticated USING ((escola_id = public.current_escola_id())) WITH CHECK ((escola_id = public.current_escola_id()));


--
-- Name: escola_usuarios; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.escola_usuarios ENABLE ROW LEVEL SECURITY;

--
-- Name: escolas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.escolas ENABLE ROW LEVEL SECURITY;

--
-- Name: escolas escolas_select_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY escolas_select_tenant ON public.escolas FOR SELECT TO authenticated USING (public.has_access_to_escola(id));


--
-- Name: financeiro_estornos estornos_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY estornos_tenant_isolation ON public.financeiro_estornos USING ((escola_id = public.current_tenant_escola_id())) WITH CHECK ((escola_id = public.current_tenant_escola_id()));


--
-- Name: events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

--
-- Name: financeiro_cobrancas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.financeiro_cobrancas ENABLE ROW LEVEL SECURITY;

--
-- Name: financeiro_contratos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.financeiro_contratos ENABLE ROW LEVEL SECURITY;

--
-- Name: financeiro_estornos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.financeiro_estornos ENABLE ROW LEVEL SECURITY;

--
-- Name: financeiro_itens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.financeiro_itens ENABLE ROW LEVEL SECURITY;

--
-- Name: financeiro_itens financeiro_itens_unificado_v3; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY financeiro_itens_unificado_v3 ON public.financeiro_itens TO authenticated USING ((escola_id IN ( SELECT p.escola_id
   FROM public.profiles p
  WHERE (p.user_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: financeiro_lancamentos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.financeiro_lancamentos ENABLE ROW LEVEL SECURITY;

--
-- Name: financeiro_lancamentos financeiro_lancamentos_unificado_v3; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY financeiro_lancamentos_unificado_v3 ON public.financeiro_lancamentos TO authenticated USING ((escola_id IN ( SELECT p.escola_id
   FROM public.profiles p
  WHERE (p.user_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: financeiro_tabelas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.financeiro_tabelas ENABLE ROW LEVEL SECURITY;

--
-- Name: financeiro_tabelas financeiro_tabelas_mutation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY financeiro_tabelas_mutation ON public.financeiro_tabelas USING ((escola_id = public.current_tenant_escola_id())) WITH CHECK ((escola_id = public.current_tenant_escola_id()));


--
-- Name: financeiro_titulos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.financeiro_titulos ENABLE ROW LEVEL SECURITY;

--
-- Name: financeiro_titulos financeiro_titulos_unificado_v3; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY financeiro_titulos_unificado_v3 ON public.financeiro_titulos TO authenticated USING ((escola_id IN ( SELECT p.escola_id
   FROM public.profiles p
  WHERE (p.user_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: frequencias; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.frequencias ENABLE ROW LEVEL SECURITY;

--
-- Name: frequencias_2025_09; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.frequencias_2025_09 ENABLE ROW LEVEL SECURITY;

--
-- Name: frequencias_2025_10; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.frequencias_2025_10 ENABLE ROW LEVEL SECURITY;

--
-- Name: frequencias_2025_11; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.frequencias_2025_11 ENABLE ROW LEVEL SECURITY;

--
-- Name: frequencias_2025_12; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.frequencias_2025_12 ENABLE ROW LEVEL SECURITY;

--
-- Name: frequencias_2026_01; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.frequencias_2026_01 ENABLE ROW LEVEL SECURITY;

--
-- Name: frequencias_default; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.frequencias_default ENABLE ROW LEVEL SECURITY;

--
-- Name: historico_anos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.historico_anos ENABLE ROW LEVEL SECURITY;

--
-- Name: historico_disciplinas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.historico_disciplinas ENABLE ROW LEVEL SECURITY;

--
-- Name: import_errors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.import_errors ENABLE ROW LEVEL SECURITY;

--
-- Name: import_errors import_errors_service_full; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY import_errors_service_full ON public.import_errors TO service_role USING (true) WITH CHECK (true);


--
-- Name: import_errors import_errors_staff_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY import_errors_staff_read ON public.import_errors FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.import_migrations m
  WHERE ((m.id = import_errors.import_id) AND public.is_staff_escola(m.escola_id)))));


--
-- Name: import_errors import_errors_staff_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY import_errors_staff_write ON public.import_errors FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.import_migrations m
  WHERE ((m.id = import_errors.import_id) AND public.is_staff_escola(m.escola_id)))));


--
-- Name: import_migrations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.import_migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: import_migrations import_migrations_service_full; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY import_migrations_service_full ON public.import_migrations TO service_role USING (true) WITH CHECK (true);


--
-- Name: import_migrations import_migrations_staff_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY import_migrations_staff_read ON public.import_migrations FOR SELECT TO authenticated USING (public.is_staff_escola(escola_id));


--
-- Name: import_migrations import_migrations_staff_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY import_migrations_staff_update ON public.import_migrations FOR UPDATE TO authenticated USING (public.is_staff_escola(escola_id)) WITH CHECK (public.is_staff_escola(escola_id));


--
-- Name: import_migrations import_migrations_staff_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY import_migrations_staff_write ON public.import_migrations FOR INSERT TO authenticated WITH CHECK (public.is_staff_escola(escola_id));


--
-- Name: lancamentos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lancamentos ENABLE ROW LEVEL SECURITY;

--
-- Name: lancamentos_2025_09; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lancamentos_2025_09 ENABLE ROW LEVEL SECURITY;

--
-- Name: lancamentos_2025_10; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lancamentos_2025_10 ENABLE ROW LEVEL SECURITY;

--
-- Name: lancamentos_2025_11; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lancamentos_2025_11 ENABLE ROW LEVEL SECURITY;

--
-- Name: lancamentos_2025_12; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lancamentos_2025_12 ENABLE ROW LEVEL SECURITY;

--
-- Name: lancamentos_2026_01; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lancamentos_2026_01 ENABLE ROW LEVEL SECURITY;

--
-- Name: lancamentos_default; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lancamentos_default ENABLE ROW LEVEL SECURITY;

--
-- Name: matricula_counters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.matricula_counters ENABLE ROW LEVEL SECURITY;

--
-- Name: matriculas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.matriculas ENABLE ROW LEVEL SECURITY;

--
-- Name: matriculas_cursos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.matriculas_cursos ENABLE ROW LEVEL SECURITY;

--
-- Name: matriculas matriculas_delete_staff_v3; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY matriculas_delete_staff_v3 ON public.matriculas FOR DELETE TO authenticated USING (public.is_staff_escola(escola_id));


--
-- Name: matriculas matriculas_insert_staff_v3; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY matriculas_insert_staff_v3 ON public.matriculas FOR INSERT TO authenticated WITH CHECK (public.is_staff_escola(escola_id));


--
-- Name: matriculas matriculas_select_v3; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY matriculas_select_v3 ON public.matriculas FOR SELECT TO authenticated USING ((escola_id IN ( SELECT p.escola_id
   FROM public.profiles p
  WHERE (p.user_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: matriculas matriculas_update_staff_v3; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY matriculas_update_staff_v3 ON public.matriculas FOR UPDATE TO authenticated USING (public.is_staff_escola(escola_id)) WITH CHECK (public.is_staff_escola(escola_id));


--
-- Name: mensalidades; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mensalidades ENABLE ROW LEVEL SECURITY;

--
-- Name: mensalidades mensalidades_unificado_v3; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mensalidades_unificado_v3 ON public.mensalidades TO authenticated USING ((escola_id IN ( SELECT p.escola_id
   FROM public.profiles p
  WHERE (p.user_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: notas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notas ENABLE ROW LEVEL SECURITY;

--
-- Name: notas_avaliacoes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notas_avaliacoes ENABLE ROW LEVEL SECURITY;

--
-- Name: notas_legacy notas_delete_staff_v3; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notas_delete_staff_v3 ON public.notas_legacy FOR DELETE TO authenticated USING (public.is_staff_escola(escola_id));


--
-- Name: notas_legacy notas_insert_staff_v3; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notas_insert_staff_v3 ON public.notas_legacy FOR INSERT TO authenticated WITH CHECK (public.is_staff_escola(escola_id));


--
-- Name: notas_legacy; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notas_legacy ENABLE ROW LEVEL SECURITY;

--
-- Name: notas_legacy notas_select_v3; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notas_select_v3 ON public.notas_legacy FOR SELECT TO authenticated USING ((escola_id IN ( SELECT p.escola_id
   FROM public.profiles p
  WHERE (p.user_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: notas_legacy notas_update_staff_v3; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notas_update_staff_v3 ON public.notas_legacy FOR UPDATE TO authenticated USING (public.is_staff_escola(escola_id)) WITH CHECK (public.is_staff_escola(escola_id));


--
-- Name: notices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications notifications_delete_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_delete_staff ON public.notifications FOR DELETE TO authenticated USING (public.is_staff_escola(escola_id));


--
-- Name: notifications notifications_insert_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_insert_staff ON public.notifications FOR INSERT TO authenticated WITH CHECK (public.is_staff_escola(escola_id));


--
-- Name: notifications notifications_select_membro; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_select_membro ON public.notifications FOR SELECT TO authenticated USING (public.is_membro_escola(escola_id));


--
-- Name: notifications notifications_update_membro; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_update_membro ON public.notifications FOR UPDATE TO authenticated USING (public.is_membro_escola(escola_id)) WITH CHECK (public.is_membro_escola(escola_id));


--
-- Name: onboarding_drafts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.onboarding_drafts ENABLE ROW LEVEL SECURITY;

--
-- Name: onboarding_drafts onboarding_drafts_select_opt; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY onboarding_drafts_select_opt ON public.onboarding_drafts FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: pagamentos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;

--
-- Name: periodos_letivos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.periodos_letivos ENABLE ROW LEVEL SECURITY;

--
-- Name: periodos_letivos_legacy; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.periodos_letivos_legacy ENABLE ROW LEVEL SECURITY;

--
-- Name: permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: presencas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.presencas ENABLE ROW LEVEL SECURITY;

--
-- Name: professores; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.professores ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles_archive; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles_archive ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_select_unificado_final; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_select_unificado_final ON public.profiles FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR ((escola_id IS NOT NULL) AND (escola_id = public.get_my_escola_id())) OR public.is_super_admin()));


--
-- Name: profiles profiles_update_opt; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_update_opt ON public.profiles FOR UPDATE USING (((user_id = ( SELECT auth.uid() AS uid)) OR public.check_super_admin_role()));


--
-- Name: regras_escala; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.regras_escala ENABLE ROW LEVEL SECURITY;

--
-- Name: roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

--
-- Name: rotinas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rotinas ENABLE ROW LEVEL SECURITY;

--
-- Name: school_sessions_legacy; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.school_sessions_legacy ENABLE ROW LEVEL SECURITY;

--
-- Name: secoes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.secoes ENABLE ROW LEVEL SECURITY;

--
-- Name: semestres_legacy; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.semestres_legacy ENABLE ROW LEVEL SECURITY;

--
-- Name: sistemas_notas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sistemas_notas ENABLE ROW LEVEL SECURITY;

--
-- Name: staging_alunos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.staging_alunos ENABLE ROW LEVEL SECURITY;

--
-- Name: staging_alunos staging_alunos_service_full; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staging_alunos_service_full ON public.staging_alunos TO service_role USING (true) WITH CHECK (true);


--
-- Name: staging_alunos staging_alunos_staff_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staging_alunos_staff_read ON public.staging_alunos FOR SELECT TO authenticated USING (public.is_staff_escola(escola_id));


--
-- Name: staging_alunos staging_alunos_staff_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staging_alunos_staff_write ON public.staging_alunos FOR INSERT TO authenticated WITH CHECK (public.is_staff_escola(escola_id));


--
-- Name: syllabi; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.syllabi ENABLE ROW LEVEL SECURITY;

--
-- Name: tabelas_mensalidade tabelas_mens_unificado; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tabelas_mens_unificado ON public.tabelas_mensalidade TO authenticated USING ((escola_id IN ( SELECT p.escola_id
   FROM public.profiles p
  WHERE (p.user_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: tabelas_mensalidade; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tabelas_mensalidade ENABLE ROW LEVEL SECURITY;

--
-- Name: turma_disciplinas_professores tdp_delete_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tdp_delete_staff ON public.turma_disciplinas_professores FOR DELETE TO authenticated USING (public.is_staff_escola(escola_id));


--
-- Name: turma_disciplinas_professores tdp_insert_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tdp_insert_staff ON public.turma_disciplinas_professores FOR INSERT TO authenticated WITH CHECK (public.is_staff_escola(escola_id));


--
-- Name: turma_disciplinas_professores tdp_select_membro; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tdp_select_membro ON public.turma_disciplinas_professores FOR SELECT TO authenticated USING (public.is_membro_escola(escola_id));


--
-- Name: turma_disciplinas_professores tdp_update_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tdp_update_staff ON public.turma_disciplinas_professores FOR UPDATE TO authenticated USING (public.is_staff_escola(escola_id)) WITH CHECK (public.is_staff_escola(escola_id));


--
-- Name: atribuicoes_prof tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.atribuicoes_prof USING ((escola_id = public.current_tenant_escola_id())) WITH CHECK ((escola_id = public.current_tenant_escola_id()));


--
-- Name: avaliacoes_legacy tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.avaliacoes_legacy USING ((escola_id = public.current_tenant_escola_id())) WITH CHECK ((escola_id = public.current_tenant_escola_id()));


--
-- Name: cursos_oferta_legacy tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.cursos_oferta_legacy USING ((escola_id = public.current_tenant_escola_id())) WITH CHECK ((escola_id = public.current_tenant_escola_id()));


--
-- Name: events tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.events USING ((escola_id = public.current_tenant_escola_id())) WITH CHECK ((escola_id = public.current_tenant_escola_id()));


--
-- Name: frequencias tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.frequencias USING ((escola_id = public.current_tenant_escola_id())) WITH CHECK ((escola_id = public.current_tenant_escola_id()));


--
-- Name: lancamentos tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.lancamentos USING ((escola_id = public.current_tenant_escola_id())) WITH CHECK ((escola_id = public.current_tenant_escola_id()));


--
-- Name: matriculas_cursos tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.matriculas_cursos USING ((escola_id = public.current_tenant_escola_id())) WITH CHECK ((escola_id = public.current_tenant_escola_id()));


--
-- Name: notices tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.notices USING ((escola_id = public.current_tenant_escola_id())) WITH CHECK ((escola_id = public.current_tenant_escola_id()));


--
-- Name: regras_escala tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.regras_escala USING ((escola_id = public.current_tenant_escola_id())) WITH CHECK ((escola_id = public.current_tenant_escola_id()));


--
-- Name: rotinas tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.rotinas USING ((escola_id = public.current_tenant_escola_id())) WITH CHECK ((escola_id = public.current_tenant_escola_id()));


--
-- Name: sistemas_notas tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.sistemas_notas USING ((escola_id = public.current_tenant_escola_id())) WITH CHECK ((escola_id = public.current_tenant_escola_id()));


--
-- Name: syllabi tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.syllabi USING ((escola_id = public.current_tenant_escola_id())) WITH CHECK ((escola_id = public.current_tenant_escola_id()));


--
-- Name: matriculas tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.matriculas FOR SELECT TO authenticated USING (public.has_access_to_escola(escola_id));


--
-- Name: turmas tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.turmas FOR SELECT TO authenticated USING (public.has_access_to_escola(escola_id));


--
-- Name: turma_disciplinas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.turma_disciplinas ENABLE ROW LEVEL SECURITY;

--
-- Name: turma_disciplinas_legacy_patch_fix; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.turma_disciplinas_legacy_patch_fix ENABLE ROW LEVEL SECURITY;

--
-- Name: turma_disciplinas_professores; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.turma_disciplinas_professores ENABLE ROW LEVEL SECURITY;

--
-- Name: turmas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.turmas ENABLE ROW LEVEL SECURITY;

--
-- Name: turmas_auditoria; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.turmas_auditoria ENABLE ROW LEVEL SECURITY;

--
-- Name: turmas turmas_unificado_v2; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY turmas_unificado_v2 ON public.turmas TO authenticated USING ((escola_id IN ( SELECT p.escola_id
   FROM public.profiles p
  WHERE (p.user_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: escola_usuarios unified_delete_escola_usuarios; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unified_delete_escola_usuarios ON public.escola_usuarios FOR DELETE USING ((public.check_super_admin_role() OR public.is_escola_admin(escola_id)));


--
-- Name: escolas unified_delete_escolas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unified_delete_escolas ON public.escolas FOR DELETE USING (public.check_super_admin_role());


--
-- Name: frequencias_2025_09 unified_delete_frequencias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unified_delete_frequencias ON public.frequencias_2025_09 FOR DELETE USING ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id)));


--
-- Name: frequencias_2025_10 unified_delete_frequencias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unified_delete_frequencias ON public.frequencias_2025_10 FOR DELETE USING ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id)));


--
-- Name: frequencias_2025_11 unified_delete_frequencias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unified_delete_frequencias ON public.frequencias_2025_11 FOR DELETE USING ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id)));


--
-- Name: frequencias_2025_12 unified_delete_frequencias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unified_delete_frequencias ON public.frequencias_2025_12 FOR DELETE USING ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id)));


--
-- Name: frequencias_2026_01 unified_delete_frequencias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unified_delete_frequencias ON public.frequencias_2026_01 FOR DELETE USING ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id)));


--
-- Name: frequencias_default unified_delete_frequencias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unified_delete_frequencias ON public.frequencias_default FOR DELETE USING ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id)));


--
-- Name: lancamentos_2025_09 unified_delete_lancamentos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unified_delete_lancamentos ON public.lancamentos_2025_09 FOR DELETE USING ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id)));


--
-- Name: lancamentos_2025_10 unified_delete_lancamentos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unified_delete_lancamentos ON public.lancamentos_2025_10 FOR DELETE USING ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id)));


--
-- Name: lancamentos_2025_11 unified_delete_lancamentos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unified_delete_lancamentos ON public.lancamentos_2025_11 FOR DELETE USING ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id)));


--
-- Name: lancamentos_2025_12 unified_delete_lancamentos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unified_delete_lancamentos ON public.lancamentos_2025_12 FOR DELETE USING ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id)));


--
-- Name: lancamentos_2026_01 unified_delete_lancamentos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unified_delete_lancamentos ON public.lancamentos_2026_01 FOR DELETE USING ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id)));


--
-- Name: lancamentos_default unified_delete_lancamentos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unified_delete_lancamentos ON public.lancamentos_default FOR DELETE USING ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id)));


--
-- Name: escola_usuarios unified_insert_escola_usuarios; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unified_insert_escola_usuarios ON public.escola_usuarios FOR INSERT WITH CHECK ((public.check_super_admin_role() OR public.is_escola_admin(escola_id)));


--
-- Name: escolas unified_insert_escolas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unified_insert_escolas ON public.escolas FOR INSERT WITH CHECK (public.check_super_admin_role());


--
-- Name: frequencias_2025_09 unified_insert_frequencias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unified_insert_frequencias ON public.frequencias_2025_09 FOR INSERT WITH CHECK ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id)));


--
-- Name: frequencias_2025_10 unified_insert_frequencias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unified_insert_frequencias ON public.frequencias_2025_10 FOR INSERT WITH CHECK ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id)));


--
-- Name: frequencias_2025_11 unified_insert_frequencias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unified_insert_frequencias ON public.frequencias_2025_11 FOR INSERT WITH CHECK ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id)));


--
-- Name: frequencias_2025_12 unified_insert_frequencias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unified_insert_frequencias ON public.frequencias_2025_12 FOR INSERT WITH CHECK ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id)));


--
-- Name: frequencias_2026_01 unified_insert_frequencias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unified_insert_frequencias ON public.frequencias_2026_01 FOR INSERT WITH CHECK ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id)));


--
-- Name: frequencias_default unified_insert_frequencias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unified_insert_frequencias ON public.frequencias_default FOR INSERT WITH CHECK ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id)));


--
-- Name: lancamentos_2025_09 unified_insert_lancamentos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unified_insert_lancamentos ON public.lancamentos_2025_09 FOR INSERT WITH CHECK ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id)));


--
-- Name: lancamentos_2025_10 unified_insert_lancamentos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unified_insert_lancamentos ON public.lancamentos_2025_10 FOR INSERT WITH CHECK ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id)));


--
-- Name: lancamentos_2025_11 unified_insert_lancamentos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unified_insert_lancamentos ON public.lancamentos_2025_11 FOR INSERT WITH CHECK ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id)));


--
-- Name: lancamentos_2025_12 unified_insert_lancamentos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unified_insert_lancamentos ON public.lancamentos_2025_12 FOR INSERT WITH CHECK ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id)));


--
-- Name: lancamentos_2026_01 unified_insert_lancamentos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unified_insert_lancamentos ON public.lancamentos_2026_01 FOR INSERT WITH CHECK ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id)));


--
-- Name: lancamentos_default unified_insert_lancamentos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unified_insert_lancamentos ON public.lancamentos_default FOR INSERT WITH CHECK ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id)));


--
-- Name: escola_usuarios unified_select_escola_usuarios; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unified_select_escola_usuarios ON public.escola_usuarios FOR SELECT USING ((public.check_super_admin_role() OR public.is_escola_admin(escola_id) OR public.is_escola_diretor(escola_id) OR (( SELECT auth.uid() AS uid) = user_id)));


--
-- Name: escolas unified_select_escolas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unified_select_escolas ON public.escolas FOR SELECT USING (public.check_super_admin_role());


--
-- Name: frequencias_2025_09 unified_select_frequencias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unified_select_frequencias ON public.frequencias_2025_09 FOR SELECT USING ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id)));


--
-- Name: frequencias_2025_10 unified_select_frequencias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unified_select_frequencias ON public.frequencias_2025_10 FOR SELECT USING ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id)));


--
-- Name: frequencias_2025_11 unified_select_frequencias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unified_select_frequencias ON public.frequencias_2025_11 FOR SELECT USING ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id)));


--
-- Name: frequencias_2025_12 unified_select_frequencias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unified_select_frequencias ON public.frequencias_2025_12 FOR SELECT USING ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id)));


--
-- Name: frequencias_2026_01 unified_select_frequencias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unified_select_frequencias ON public.frequencias_2026_01 FOR SELECT USING ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id)));


--
-- Name: frequencias_default unified_select_frequencias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unified_select_frequencias ON public.frequencias_default FOR SELECT USING ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id)));


--
-- Name: lancamentos_2025_09 unified_select_lancamentos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unified_select_lancamentos ON public.lancamentos_2025_09 FOR SELECT USING ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id)));


--
-- Name: lancamentos_2025_10 unified_select_lancamentos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unified_select_lancamentos ON public.lancamentos_2025_10 FOR SELECT USING ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id)));


--
-- Name: lancamentos_2025_11 unified_select_lancamentos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unified_select_lancamentos ON public.lancamentos_2025_11 FOR SELECT USING ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id)));


--
-- Name: lancamentos_2025_12 unified_select_lancamentos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unified_select_lancamentos ON public.lancamentos_2025_12 FOR SELECT USING ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id)));


--
-- Name: lancamentos_2026_01 unified_select_lancamentos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unified_select_lancamentos ON public.lancamentos_2026_01 FOR SELECT USING ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id)));


--
-- Name: lancamentos_default unified_select_lancamentos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unified_select_lancamentos ON public.lancamentos_default FOR SELECT USING ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id)));


--
-- Name: escola_usuarios unified_update_escola_usuarios; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unified_update_escola_usuarios ON public.escola_usuarios FOR UPDATE USING ((public.check_super_admin_role() OR public.is_escola_admin(escola_id))) WITH CHECK ((public.check_super_admin_role() OR public.is_escola_admin(escola_id)));


--
-- Name: escolas unified_update_escolas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unified_update_escolas ON public.escolas FOR UPDATE USING (public.check_super_admin_role()) WITH CHECK (public.check_super_admin_role());


--
-- Name: frequencias_2025_09 unified_update_frequencias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unified_update_frequencias ON public.frequencias_2025_09 FOR UPDATE USING ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id))) WITH CHECK ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id)));


--
-- Name: frequencias_2025_10 unified_update_frequencias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unified_update_frequencias ON public.frequencias_2025_10 FOR UPDATE USING ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id))) WITH CHECK ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id)));


--
-- Name: frequencias_2025_11 unified_update_frequencias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unified_update_frequencias ON public.frequencias_2025_11 FOR UPDATE USING ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id))) WITH CHECK ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id)));


--
-- Name: frequencias_2025_12 unified_update_frequencias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unified_update_frequencias ON public.frequencias_2025_12 FOR UPDATE USING ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id))) WITH CHECK ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id)));


--
-- Name: frequencias_2026_01 unified_update_frequencias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unified_update_frequencias ON public.frequencias_2026_01 FOR UPDATE USING ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id))) WITH CHECK ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id)));


--
-- Name: frequencias_default unified_update_frequencias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unified_update_frequencias ON public.frequencias_default FOR UPDATE USING ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id))) WITH CHECK ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id)));


--
-- Name: lancamentos_2025_09 unified_update_lancamentos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unified_update_lancamentos ON public.lancamentos_2025_09 FOR UPDATE USING ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id))) WITH CHECK ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id)));


--
-- Name: lancamentos_2025_10 unified_update_lancamentos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unified_update_lancamentos ON public.lancamentos_2025_10 FOR UPDATE USING ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id))) WITH CHECK ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id)));


--
-- Name: lancamentos_2025_11 unified_update_lancamentos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unified_update_lancamentos ON public.lancamentos_2025_11 FOR UPDATE USING ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id))) WITH CHECK ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id)));


--
-- Name: lancamentos_2025_12 unified_update_lancamentos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unified_update_lancamentos ON public.lancamentos_2025_12 FOR UPDATE USING ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id))) WITH CHECK ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id)));


--
-- Name: lancamentos_2026_01 unified_update_lancamentos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unified_update_lancamentos ON public.lancamentos_2026_01 FOR UPDATE USING ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id))) WITH CHECK ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id)));


--
-- Name: lancamentos_default unified_update_lancamentos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unified_update_lancamentos ON public.lancamentos_default FOR UPDATE USING ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id))) WITH CHECK ((public.is_escola_admin(escola_id) OR public.is_escola_member(escola_id)));


--
-- PostgreSQL database dump complete
--
