


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "btree_gin" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "btree_gist" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."user_role" AS ENUM (
    'super_admin',
    'global_admin',
    'admin',
    'professor',
    'aluno',
    'secretaria',
    'financeiro'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_each_month"("start_date" "date", "end_date" "date") RETURNS TABLE("month_start" "date", "month_end" "date")
    LANGUAGE "plpgsql"
    AS $$
begin
  month_start := date_trunc('month', start_date)::date;
  while month_start < end_date loop
    month_end := (month_start + interval '1 month')::date;
    return next;
    month_start := month_end;
  end loop;
end$$;


ALTER FUNCTION "public"."_each_month"("start_date" "date", "end_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."audit_dml_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."audit_dml_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_access"("eid" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'pg_temp'
    AS $$
  select exists (
    select 1 from public.escola_members em
    where em.escola_id = eid and em.user_id = auth.uid()
  ) or public.is_super_admin();
$$;


ALTER FUNCTION "public"."can_access"("eid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_super_admin_role"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_temp'
    AS $$
BEGIN
  RETURN (SELECT public.current_user_role() = 'super_admin');
END;
$$;


ALTER FUNCTION "public"."check_super_admin_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_escola_with_admin"("p_nome" "text", "p_nif" "text" DEFAULT NULL::"text", "p_endereco" "text" DEFAULT NULL::"text", "p_admin_email" "text" DEFAULT NULL::"text", "p_admin_telefone" "text" DEFAULT NULL::"text", "p_admin_nome" "text" DEFAULT NULL::"text") RETURNS json
    LANGUAGE "plpgsql"
    AS $$
declare
  v_escola_id uuid;
  v_escola_nome text;
  v_msg text := '';
  v_user_id uuid;
  v_user_escola_id uuid;
  v_exists int;
begin
  -- Basic validations
  if p_nome is null or trim(p_nome) = '' then
    raise exception 'nome obrigatório' using errcode = 'P0001';
  end if;

  if p_nif is not null then
    p_nif := regexp_replace(p_nif, '\\D', '', 'g');
    if length(p_nif) <> 9 then
      raise exception 'NIF inválido (9 dígitos)' using errcode = 'P0001';
    end if;
  end if;

  -- Insert escola
  insert into public.escolas (nome, nif, endereco, status, onboarding_finalizado)
  values (
    trim(p_nome),
    nullif(p_nif, ''),
    nullif(trim(coalesce(p_endereco, '')), ''),
    'ativa',
    false
  )
  returning id, nome into v_escola_id, v_escola_nome;

  -- Optional admin link
  if coalesce(trim(p_admin_email), '') <> '' then
    begin
      select user_id, escola_id
        into v_user_id, v_user_escola_id
      from public.profiles
      where email = lower(trim(p_admin_email))
      limit 1;

      if v_user_id is not null then
        update public.profiles
           set telefone = coalesce(regexp_replace(coalesce(p_admin_telefone, ''), '\\D', '', 'g'), telefone),
               nome = coalesce(nullif(trim(coalesce(p_admin_nome, '')), ''), nome),
               role = 'admin'::public.user_role,
               escola_id = coalesce(escola_id, v_escola_id)
         where user_id = v_user_id;

        -- Idempotent link (no unique constraint required)
        select 1 into v_exists from public.escola_administradores
         where escola_id = v_escola_id and user_id = v_user_id
         limit 1;
        if not found then
          insert into public.escola_administradores (escola_id, user_id, cargo)
          values (v_escola_id, v_user_id, 'administrador_principal');
        end if;

        v_msg := ' ✅ Administrador vinculado: ' || lower(trim(p_admin_email));
      else
        v_msg := ' ⚠️ Usuário não encontrado. Vincule manualmente depois.';
      end if;
    exception when others then
      -- Do not fail the whole creation because of an optional admin link
      v_msg := ' ⚠️ Erro ao vincular administrador.';
    end;
  end if;

  return json_build_object(
    'ok', true,
    'escolaId', v_escola_id,
    'escolaNome', v_escola_nome,
    'mensagemAdmin', coalesce(v_msg, '')
  );
end;
$$;


ALTER FUNCTION "public"."create_escola_with_admin"("p_nome" "text", "p_nif" "text", "p_endereco" "text", "p_admin_email" "text", "p_admin_telefone" "text", "p_admin_nome" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_month_partition"("tbl" "text", "month_start" "date") RETURNS "void"
    LANGUAGE "plpgsql"
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
  end if;
end$$;


ALTER FUNCTION "public"."create_month_partition"("tbl" "text", "month_start" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_month_partition_ts"("tbl" "text", "month_start" "date") RETURNS "void"
    LANGUAGE "plpgsql"
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
  end if;
end$$;


ALTER FUNCTION "public"."create_month_partition_ts"("tbl" "text", "month_start" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_tenant_escola_id"() RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_claims jsonb := '{}'::jsonb;
  v_escola uuid := null;
  v_profile_escola uuid := null;
begin
  -- Try to read claims from request context (Supabase injects this)
  begin
    v_claims := current_setting('request.jwt.claims', true)::jsonb;
  exception when others then
    v_claims := '{}'::jsonb;
  end;

  -- 1) Direct top-level claim: escola_id
  if (v_claims ? 'escola_id') then
    v_escola := nullif(v_claims->>'escola_id', '')::uuid;
    if v_escola is not null then
      return v_escola;
    end if;
  end if;

  -- 2) app_metadata.escola_id (common pattern for custom claims)
  if (v_claims ? 'app_metadata') and ((v_claims->'app_metadata') ? 'escola_id') then
    v_escola := nullif((v_claims->'app_metadata')->>'escola_id', '')::uuid;
    if v_escola is not null then
      return v_escola;
    end if;
  end if;

  -- 3) Tentar obter escola "preferida" via profile (mas ainda não confiar cegamente)
  begin
    select coalesce(p.current_escola_id, p.escola_id)::uuid
      into v_profile_escola
    from public.profiles p
    where p.user_id = auth.uid()
    limit 1;
  exception when others then
    v_profile_escola := null;
  end;

  -- 4) Ground truth: escola_usuarios
  -- 4a) Se o profile aponta para alguma escola, tentar validar contra escola_usuarios
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

  -- 4b) Se não bateu com o profile, pegar o primeiro vínculo em escola_usuarios
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

  -- 5) Último fallback: usar apenas o profile (em cenários legados/transitórios)
  if v_profile_escola is not null then
    return v_profile_escola;
  end if;

  -- Sem escola resolvida → RLS deve negar
  return null;
end;
$$;


ALTER FUNCTION "public"."current_tenant_escola_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_user_role"() RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  select coalesce(
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role'),
    ''
  );
$$;


ALTER FUNCTION "public"."current_user_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dashboard"() RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_temp'
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


ALTER FUNCTION "public"."dashboard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_matricula_number"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    next_seq_val BIGINT;
    escola_prefix TEXT;
BEGIN
    IF NEW.numero_matricula IS NULL THEN
        -- derive a deterministic 3-char prefix from escola_id
        SELECT SUBSTRING(MD5(NEW.escola_id::text) FOR 3) INTO escola_prefix;

        -- nextval is schema-qualified already
        SELECT nextval('public.matricula_seq') INTO next_seq_val;

        NEW.numero_matricula := CONCAT(escola_prefix, '-', LPAD(next_seq_val::text, 6, '0'));
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generate_matricula_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_unique_numero_login"("p_escola_id" "uuid", "p_role" "public"."user_role", "p_prefix" "text", "p_start" integer) RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
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


ALTER FUNCTION "public"."generate_unique_numero_login"("p_escola_id" "uuid", "p_role" "public"."user_role", "p_prefix" "text", "p_start" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_profile_dependencies"("p_user_id" "uuid") RETURNS TABLE("table_name" "text", "cnt" bigint)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
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


ALTER FUNCTION "public"."get_profile_dependencies"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_escola_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT escola_id
  FROM public.profiles
  WHERE user_id = (SELECT auth.uid());
$$;


ALTER FUNCTION "public"."get_user_escola_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_escola_id"("p_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
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


ALTER FUNCTION "public"."get_user_escola_id"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_export_json"("p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE
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


ALTER FUNCTION "public"."get_user_export_json"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_tenant"() RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_temp'
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


ALTER FUNCTION "public"."get_user_tenant"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_escola_admin"("p_escola_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_temp'
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


ALTER FUNCTION "public"."is_escola_admin"("p_escola_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_escola_diretor"("p_escola_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_temp'
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


ALTER FUNCTION "public"."is_escola_diretor"("p_escola_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_escola_member"("p_escola_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_temp'
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


ALTER FUNCTION "public"."is_escola_member"("p_escola_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_membro_escola"("escola_uuid" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.escola_usuarios eu
    where eu.user_id = (select auth.uid())
      and eu.escola_id = escola_uuid
  );
$$;


ALTER FUNCTION "public"."is_membro_escola"("escola_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_staff_escola"("escola_uuid" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.escola_usuarios eu
    where eu.user_id = (select auth.uid())
      and eu.escola_id = escola_uuid
      and eu.papel in ('admin_escola', 'secretaria', 'staff_admin')
  );
$$;


ALTER FUNCTION "public"."is_staff_escola"("escola_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_super_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'super_admin'
  );
$$;


ALTER FUNCTION "public"."is_super_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_audit_event"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_temp'
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


ALTER FUNCTION "public"."log_audit_event"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_disciplina_auditoria"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_temp'
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


ALTER FUNCTION "public"."log_disciplina_auditoria"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_escola_auditoria"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_temp'
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


ALTER FUNCTION "public"."log_escola_auditoria"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_turma_auditoria"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_temp'
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


ALTER FUNCTION "public"."log_turma_auditoria"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."move_profile_to_archive"("p_user_id" "uuid", "p_performed_by" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."move_profile_to_archive"("p_user_id" "uuid", "p_performed_by" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."partitions_info"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."partitions_info"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_all_materialized_views"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
begin
  begin execute 'refresh materialized view public.mv_financeiro_escola_dia'; exception when undefined_table then null; end;
  begin execute 'refresh materialized view public.mv_freq_por_turma_dia'; exception when undefined_table then null; end;
  begin execute 'refresh materialized view public.mv_media_por_curso'; exception when undefined_table then null; end;
end$$;


ALTER FUNCTION "public"."refresh_all_materialized_views"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."secretaria_audit_by_aluno_matricula"("p_aluno_id" "uuid" DEFAULT NULL::"uuid", "p_matricula_id" "uuid" DEFAULT NULL::"uuid", "p_limit" integer DEFAULT 100, "p_offset" integer DEFAULT 0) RETURNS TABLE("created_at" timestamp with time zone, "portal" "text", "acao" "text", "tabela" "text", "entity_id" "text", "matricula_id" "uuid", "aluno_id" "uuid", "aluno_nome" "text", "user_id" "uuid", "user_email" "text", "details" "jsonb")
    LANGUAGE "sql" STABLE
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


ALTER FUNCTION "public"."secretaria_audit_by_aluno_matricula"("p_aluno_id" "uuid", "p_matricula_id" "uuid", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end; $$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_set_escola_atribuicoes_prof"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_temp'
    AS $$
begin
  select co.escola_id into new.escola_id from public.cursos_oferta co where co.id = new.curso_oferta_id;
  return new;
end; $$;


ALTER FUNCTION "public"."trg_set_escola_atribuicoes_prof"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_set_escola_avaliacoes"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_temp'
    AS $$
begin
  select co.escola_id into new.escola_id from public.cursos_oferta co where co.id = new.curso_oferta_id;
  return new;
end; $$;


ALTER FUNCTION "public"."trg_set_escola_avaliacoes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_set_escola_cursos_oferta"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_temp'
    AS $$
begin
  select c.escola_id into new.escola_id from public.cursos c where c.id = new.curso_id;
  return new;
end; $$;


ALTER FUNCTION "public"."trg_set_escola_cursos_oferta"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_set_escola_frequencias"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_temp'
    AS $$
begin
  select m.escola_id into new.escola_id from public.matriculas m where m.id = new.matricula_id;
  return new;
end; $$;


ALTER FUNCTION "public"."trg_set_escola_frequencias"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_set_escola_lancamentos"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_temp'
    AS $$
begin
  select m.escola_id into new.escola_id from public.matriculas m where m.id = new.matricula_id;
  return new;
end; $$;


ALTER FUNCTION "public"."trg_set_escola_lancamentos"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_set_escola_matriculas_cursos"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_temp'
    AS $$
begin
  select m.escola_id into new.escola_id from public.matriculas m where m.id = new.matricula_id;
  return new;
end; $$;


ALTER FUNCTION "public"."trg_set_escola_matriculas_cursos"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_set_escola_regras_escala"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_temp'
    AS $$
begin
  select s.escola_id into new.escola_id from public.sistemas_notas s where s.id = new.sistema_notas_id;
  return new;
end; $$;


ALTER FUNCTION "public"."trg_set_escola_regras_escala"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_set_escola_rotinas"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_temp'
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


ALTER FUNCTION "public"."trg_set_escola_rotinas"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_set_escola_sistemas_notas"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_temp'
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


ALTER FUNCTION "public"."trg_set_escola_sistemas_notas"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_set_escola_syllabi"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_temp'
    AS $$
begin
  select co.escola_id into new.escola_id from public.cursos_oferta co where co.id = new.curso_oferta_id;
  return new;
end; $$;


ALTER FUNCTION "public"."trg_set_escola_syllabi"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."alunos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "data_nascimento" "date",
    "nome_responsavel" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "sexo" "text",
    "bi_numero" "text",
    "responsavel_nome" "text",
    "responsavel_contato" "text",
    "email" "text",
    "nome" "text",
    "naturalidade" "text",
    "provincia" "text",
    "encarregado_relacao" "text",
    "tsv" "tsvector" GENERATED ALWAYS AS ("to_tsvector"('"simple"'::"regconfig", ((((COALESCE("nome", ''::"text") || ' '::"text") || COALESCE("responsavel_nome", ''::"text")) || ' '::"text") || COALESCE("nome_responsavel", ''::"text")))) STORED
);

ALTER TABLE ONLY "public"."alunos" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."alunos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."atribuicoes_prof" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "professor_user_id" "uuid" NOT NULL,
    "curso_oferta_id" "uuid" NOT NULL,
    "secao_id" "uuid" NOT NULL,
    "escola_id" "uuid" NOT NULL
);


ALTER TABLE "public"."atribuicoes_prof" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" bigint NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"(),
    "acao" "text" NOT NULL,
    "tabela" "text" NOT NULL,
    "registro_id" "text",
    "meta" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "escola_id" "uuid",
    "portal" "text",
    "action" "text",
    "entity" "text",
    "entity_id" "text",
    "details" "jsonb"
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."audit_logs" IS 'Eventos de auditoria por escola/portal/usuário';



CREATE SEQUENCE IF NOT EXISTS "public"."audit_logs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."audit_logs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."audit_logs_id_seq" OWNED BY "public"."audit_logs"."id";



CREATE TABLE IF NOT EXISTS "public"."avaliacoes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "curso_oferta_id" "uuid" NOT NULL,
    "sistema_notas_id" "uuid",
    "nome" "text" NOT NULL,
    "peso" numeric NOT NULL,
    "data_prevista" "date",
    "escola_id" "uuid" NOT NULL
);


ALTER TABLE "public"."avaliacoes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."classes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "descricao" "text",
    "ordem" integer,
    "nivel" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."classes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."configuracoes_escola" (
    "escola_id" "uuid" NOT NULL,
    "estrutura" "text" NOT NULL,
    "tipo_presenca" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "periodo_tipo" "text",
    "autogerar_periodos" boolean DEFAULT false,
    CONSTRAINT "configuracoes_escola_estrutura_check" CHECK (("estrutura" = ANY (ARRAY['classes'::"text", 'secoes'::"text", 'cursos'::"text"]))),
    CONSTRAINT "configuracoes_escola_periodo_tipo_check" CHECK (("periodo_tipo" = ANY (ARRAY['semestre'::"text", 'trimestre'::"text"]))),
    CONSTRAINT "configuracoes_escola_tipo_presenca_check" CHECK (("tipo_presenca" = ANY (ARRAY['secao'::"text", 'curso'::"text"])))
);


ALTER TABLE "public"."configuracoes_escola" OWNER TO "postgres";


COMMENT ON TABLE "public"."configuracoes_escola" IS 'Preferências acadêmicas por escola (onboarding etapa 2)';



COMMENT ON COLUMN "public"."configuracoes_escola"."estrutura" IS 'Estrutura acadêmica principal: classes | secoes | cursos';



COMMENT ON COLUMN "public"."configuracoes_escola"."tipo_presenca" IS 'Registro de presença por secao ou por curso';



CREATE TABLE IF NOT EXISTS "public"."cursos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "codigo" "text" NOT NULL,
    "nome" "text" NOT NULL,
    "tipo" "text",
    "descricao" "text",
    "nivel" "text",
    "semestre_id" "uuid"
);


ALTER TABLE "public"."cursos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cursos_oferta" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "curso_id" "uuid" NOT NULL,
    "turma_id" "uuid" NOT NULL,
    "semestre_id" "uuid" NOT NULL,
    "escola_id" "uuid" NOT NULL
);


ALTER TABLE "public"."cursos_oferta" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."escola_administradores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escola_id" "uuid",
    "user_id" "uuid",
    "cargo" "text" DEFAULT 'administrador_escolar'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."escola_administradores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."escola_auditoria" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "acao" "text" NOT NULL,
    "mensagem" "text",
    "criado_em" timestamp with time zone DEFAULT "now"(),
    "dados" "jsonb"
);

ALTER TABLE ONLY "public"."escola_auditoria" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."escola_auditoria" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."escola_configuracoes" (
    "escola_id" "uuid" NOT NULL,
    "tema_interface" "jsonb" DEFAULT '{"primaryColor": "#3b82f6"}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."escola_configuracoes" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."escola_configuracoes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."escola_members" (
    "escola_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role_id" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."escola_members" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."escola_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."escola_usuarios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "papel" "text" DEFAULT 'aluno'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "escola_usuarios_papel_check" CHECK (("papel" = ANY (ARRAY['admin'::"text", 'staff_admin'::"text", 'financeiro'::"text", 'secretaria'::"text", 'aluno'::"text", 'professor'::"text", 'admin_escola'::"text"])))
);


ALTER TABLE "public"."escola_usuarios" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."escolas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" "text" NOT NULL,
    "nif" "text",
    "endereco" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'ativa'::"text",
    "cor_primaria" "text",
    "onboarding_finalizado" boolean DEFAULT false NOT NULL,
    "plano" "text" DEFAULT 'basico'::"text" NOT NULL,
    "aluno_portal_enabled" boolean DEFAULT false NOT NULL,
    "logo_url" "text",
    "use_mv_dashboards" boolean DEFAULT true NOT NULL,
    CONSTRAINT "escolas_plano_check" CHECK (("plano" = ANY (ARRAY['basico'::"text", 'standard'::"text", 'premium'::"text"])))
);


ALTER TABLE "public"."escolas" OWNER TO "postgres";


COMMENT ON COLUMN "public"."escolas"."plano" IS 'Plano da escola: basico | standard | premium';



COMMENT ON COLUMN "public"."escolas"."aluno_portal_enabled" IS 'Libera o acesso ao Portal do Aluno para esta escola';



COMMENT ON COLUMN "public"."escolas"."use_mv_dashboards" IS 'Quando true, páginas preferem ler views MV (v_*) para baixa latência.';



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "user_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "role" "public"."user_role" DEFAULT 'aluno'::"public"."user_role" NOT NULL,
    "email" "text",
    "escola_id" "uuid",
    "onboarding_finalizado" boolean DEFAULT false,
    "telefone" "text",
    "global_role" "text",
    "current_escola_id" "uuid",
    "numero_login" "text",
    "deleted_at" timestamp with time zone
);

ALTER TABLE ONLY "public"."profiles" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."escolas_view" WITH ("security_invoker"='true') AS
 SELECT "e"."id",
    "e"."nome",
    "e"."status",
    'Básico'::"text" AS "plano",
    NULL::timestamp without time zone AS "last_access",
    COALESCE("a"."total_alunos", 0) AS "total_alunos",
    COALESCE("pf"."total_professores", 0) AS "total_professores",
    "e"."endereco" AS "cidade",
    NULL::"text" AS "estado"
   FROM (("public"."escolas" "e"
     LEFT JOIN ( SELECT "alunos"."escola_id",
            ("count"(*))::integer AS "total_alunos"
           FROM "public"."alunos"
          GROUP BY "alunos"."escola_id") "a" ON (("a"."escola_id" = "e"."id")))
     LEFT JOIN ( SELECT "p"."escola_id",
            ("count"(*))::integer AS "total_professores"
           FROM "public"."profiles" "p"
          WHERE ("p"."role" = 'professor'::"public"."user_role")
          GROUP BY "p"."escola_id") "pf" ON (("pf"."escola_id" = "e"."id")));


ALTER VIEW "public"."escolas_view" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "titulo" "text" NOT NULL,
    "descricao" "text",
    "inicio_at" timestamp with time zone NOT NULL,
    "fim_at" timestamp with time zone,
    "publico_alvo" "text" NOT NULL
);


ALTER TABLE "public"."events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."frequencias" (
    "id" "uuid" NOT NULL,
    "matricula_id" "uuid" NOT NULL,
    "routine_id" "uuid",
    "curso_oferta_id" "uuid",
    "data" "date" NOT NULL,
    "status" "text" NOT NULL,
    "escola_id" "uuid" NOT NULL
)
PARTITION BY RANGE ("data");

ALTER TABLE ONLY "public"."frequencias" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."frequencias" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."frequencias_2025_09" (
    "id" "uuid" NOT NULL,
    "matricula_id" "uuid" NOT NULL,
    "routine_id" "uuid",
    "curso_oferta_id" "uuid",
    "data" "date" NOT NULL,
    "status" "text" NOT NULL,
    "escola_id" "uuid" NOT NULL
);

ALTER TABLE ONLY "public"."frequencias_2025_09" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."frequencias_2025_09" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."frequencias_2025_10" (
    "id" "uuid" NOT NULL,
    "matricula_id" "uuid" NOT NULL,
    "routine_id" "uuid",
    "curso_oferta_id" "uuid",
    "data" "date" NOT NULL,
    "status" "text" NOT NULL,
    "escola_id" "uuid" NOT NULL
);

ALTER TABLE ONLY "public"."frequencias_2025_10" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."frequencias_2025_10" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."frequencias_2025_11" (
    "id" "uuid" NOT NULL,
    "matricula_id" "uuid" NOT NULL,
    "routine_id" "uuid",
    "curso_oferta_id" "uuid",
    "data" "date" NOT NULL,
    "status" "text" NOT NULL,
    "escola_id" "uuid" NOT NULL
);

ALTER TABLE ONLY "public"."frequencias_2025_11" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."frequencias_2025_11" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."frequencias_2025_12" (
    "id" "uuid" NOT NULL,
    "matricula_id" "uuid" NOT NULL,
    "routine_id" "uuid",
    "curso_oferta_id" "uuid",
    "data" "date" NOT NULL,
    "status" "text" NOT NULL,
    "escola_id" "uuid" NOT NULL
);

ALTER TABLE ONLY "public"."frequencias_2025_12" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."frequencias_2025_12" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."frequencias_default" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "matricula_id" "uuid" NOT NULL,
    "routine_id" "uuid",
    "curso_oferta_id" "uuid",
    "data" "date" NOT NULL,
    "status" "text" NOT NULL,
    "escola_id" "uuid" NOT NULL,
    CONSTRAINT "frequencias_ck_routine_or_curso" CHECK ((("routine_id" IS NOT NULL) OR ("curso_oferta_id" IS NOT NULL))),
    CONSTRAINT "frequencias_status_check" CHECK (("status" = ANY (ARRAY['presente'::"text", 'ausente'::"text", 'atraso'::"text", 'justificado'::"text"])))
);

ALTER TABLE ONLY "public"."frequencias_default" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."frequencias_default" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lancamentos" (
    "id" "uuid" NOT NULL,
    "avaliacao_id" "uuid" NOT NULL,
    "matricula_id" "uuid" NOT NULL,
    "valor" numeric NOT NULL,
    "final" boolean NOT NULL,
    "criado_em" timestamp with time zone NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "tenant_id" "uuid"
)
PARTITION BY RANGE ("criado_em");

ALTER TABLE ONLY "public"."lancamentos" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."lancamentos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lancamentos_2025_09" (
    "id" "uuid" NOT NULL,
    "avaliacao_id" "uuid" NOT NULL,
    "matricula_id" "uuid" NOT NULL,
    "valor" numeric NOT NULL,
    "final" boolean NOT NULL,
    "criado_em" timestamp with time zone NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "tenant_id" "uuid"
);

ALTER TABLE ONLY "public"."lancamentos_2025_09" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."lancamentos_2025_09" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lancamentos_2025_10" (
    "id" "uuid" NOT NULL,
    "avaliacao_id" "uuid" NOT NULL,
    "matricula_id" "uuid" NOT NULL,
    "valor" numeric NOT NULL,
    "final" boolean NOT NULL,
    "criado_em" timestamp with time zone NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "tenant_id" "uuid"
);

ALTER TABLE ONLY "public"."lancamentos_2025_10" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."lancamentos_2025_10" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lancamentos_2025_11" (
    "id" "uuid" NOT NULL,
    "avaliacao_id" "uuid" NOT NULL,
    "matricula_id" "uuid" NOT NULL,
    "valor" numeric NOT NULL,
    "final" boolean NOT NULL,
    "criado_em" timestamp with time zone NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "tenant_id" "uuid"
);

ALTER TABLE ONLY "public"."lancamentos_2025_11" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."lancamentos_2025_11" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lancamentos_2025_12" (
    "id" "uuid" NOT NULL,
    "avaliacao_id" "uuid" NOT NULL,
    "matricula_id" "uuid" NOT NULL,
    "valor" numeric NOT NULL,
    "final" boolean NOT NULL,
    "criado_em" timestamp with time zone NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "tenant_id" "uuid"
);

ALTER TABLE ONLY "public"."lancamentos_2025_12" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."lancamentos_2025_12" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lancamentos_default" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "avaliacao_id" "uuid" NOT NULL,
    "matricula_id" "uuid" NOT NULL,
    "valor" numeric NOT NULL,
    "final" boolean DEFAULT false NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "tenant_id" "uuid"
);

ALTER TABLE ONLY "public"."lancamentos_default" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."lancamentos_default" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."matricula_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."matricula_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."matriculas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "aluno_id" "uuid" NOT NULL,
    "turma_id" "uuid" NOT NULL,
    "ativo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "secao_id" "uuid",
    "session_id" "uuid",
    "status" "text" DEFAULT 'ativo'::"text" NOT NULL,
    "numero_matricula" "text",
    "data_matricula" "date",
    CONSTRAINT "matriculas_status_check" CHECK (("status" = ANY (ARRAY['ativo'::"text", 'trancado'::"text", 'concluido'::"text", 'transferido'::"text", 'desistente'::"text"])))
);

ALTER TABLE ONLY "public"."matriculas" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."matriculas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."matriculas_cursos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "matricula_id" "uuid" NOT NULL,
    "curso_oferta_id" "uuid" NOT NULL,
    "escola_id" "uuid" NOT NULL
);


ALTER TABLE "public"."matriculas_cursos" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."matriculas_por_ano" WITH ("security_invoker"='true') AS
 SELECT "escola_id",
    "to_char"("to_timestamp"((EXTRACT(epoch FROM COALESCE("created_at", "now"())))::double precision), 'YYYY'::"text") AS "ano",
    ("count"(*))::integer AS "total"
   FROM "public"."matriculas" "m"
  GROUP BY "escola_id", ("to_char"("to_timestamp"((EXTRACT(epoch FROM COALESCE("created_at", "now"())))::double precision), 'YYYY'::"text"));


ALTER VIEW "public"."matriculas_por_ano" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pagamentos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "aluno_id" "uuid" NOT NULL,
    "valor" numeric(14,2) NOT NULL,
    "status" "text" DEFAULT 'pendente'::"text" NOT NULL,
    "vencimento" "date",
    "forma_pagamento" "text",
    "referencia_transacao" "text",
    "comprovante_url" "text",
    "descricao" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "metodo" "text",
    "referencia" "text",
    CONSTRAINT "pagamentos_status_check" CHECK (("status" = ANY (ARRAY['pendente'::"text", 'pago'::"text", 'atrasado'::"text", 'cancelado'::"text"])))
);

ALTER TABLE ONLY "public"."pagamentos" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."pagamentos" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "public"."mv_financeiro_escola_dia" AS
 SELECT "escola_id",
    ("created_at")::"date" AS "dia",
    "count"(*) FILTER (WHERE ("status" = 'pago'::"text")) AS "qtd_pagos",
    "count"(*) AS "qtd_total"
   FROM "public"."pagamentos" "p"
  GROUP BY "escola_id", (("created_at")::"date")
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."mv_financeiro_escola_dia" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "public"."mv_freq_por_turma_dia" AS
 SELECT "f"."escola_id",
    "m"."turma_id",
    "f"."data" AS "dia",
    "count"(*) AS "total",
    "count"(*) FILTER (WHERE ("f"."status" = 'presente'::"text")) AS "presentes"
   FROM ("public"."frequencias" "f"
     JOIN "public"."matriculas" "m" ON (("m"."id" = "f"."matricula_id")))
  GROUP BY "f"."escola_id", "m"."turma_id", "f"."data"
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."mv_freq_por_turma_dia" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "public"."mv_media_por_curso" AS
 SELECT "l"."escola_id",
    "a"."curso_oferta_id",
    "avg"("l"."valor") AS "media"
   FROM ("public"."lancamentos" "l"
     JOIN "public"."avaliacoes" "a" ON (("a"."id" = "l"."avaliacao_id")))
  GROUP BY "l"."escola_id", "a"."curso_oferta_id"
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."mv_media_por_curso" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "aluno_id" "uuid" NOT NULL,
    "turma_id" "uuid" NOT NULL,
    "disciplina" "text" NOT NULL,
    "periodo_id" "uuid" NOT NULL,
    "nota" numeric(5,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "notas_nota_check" CHECK ((("nota" >= (0)::numeric) AND ("nota" <= (20)::numeric)))
);

ALTER TABLE ONLY "public"."notas" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."notas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "titulo" "text" NOT NULL,
    "conteudo" "text" NOT NULL,
    "publico_alvo" "text" NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "notices_publico_alvo_check" CHECK (("publico_alvo" = ANY (ARRAY['todos'::"text", 'professores'::"text", 'alunos'::"text", 'responsaveis'::"text"])))
);


ALTER TABLE "public"."notices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."onboarding_drafts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "step" smallint DEFAULT 1 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."onboarding_drafts" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."pagamentos_status" WITH ("security_invoker"='true') AS
 SELECT "escola_id",
    COALESCE("status", 'desconhecido'::"text") AS "status",
    ("count"(*))::integer AS "total"
   FROM "public"."pagamentos" "p"
  GROUP BY "escola_id", COALESCE("status", 'desconhecido'::"text");


ALTER VIEW "public"."pagamentos_status" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."semestres" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "data_inicio" "date" NOT NULL,
    "data_fim" "date" NOT NULL,
    "attendance_type" "text" NOT NULL,
    "permitir_submissao_final" boolean DEFAULT false NOT NULL,
    "escola_id" "uuid" NOT NULL,
    CONSTRAINT "semestres_attendance_type_check" CHECK (("attendance_type" = ANY (ARRAY['section'::"text", 'course'::"text"])))
);

ALTER TABLE ONLY "public"."semestres" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."semestres" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."periodos" WITH ("security_invoker"='true') AS
 SELECT "id",
    "nome",
    "data_inicio",
    "data_fim",
    "session_id"
   FROM "public"."semestres";


ALTER VIEW "public"."periodos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."periodos_letivos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "ano" integer NOT NULL,
    "data_inicio" "date",
    "data_fim" "date",
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."periodos_letivos" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."periodos_letivos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."permissions" (
    "id" integer NOT NULL,
    "role_id" integer NOT NULL,
    "recurso" "text" NOT NULL,
    "acao" "text" NOT NULL,
    CONSTRAINT "permissions_acao_check" CHECK (("acao" = ANY (ARRAY['read'::"text", 'create'::"text", 'update'::"text", 'delete'::"text"])))
);

ALTER TABLE ONLY "public"."permissions" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."permissions" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."permissions_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."permissions_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."permissions_id_seq" OWNED BY "public"."permissions"."id";



CREATE TABLE IF NOT EXISTS "public"."presencas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "aluno_id" "uuid" NOT NULL,
    "turma_id" "uuid" NOT NULL,
    "data" "date" NOT NULL,
    "status" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "presencas_status_check" CHECK (("status" = ANY (ARRAY['presente'::"text", 'falta'::"text", 'atraso'::"text"])))
);

ALTER TABLE ONLY "public"."presencas" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."presencas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."professores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "formacao" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "apelido" "text"
);

ALTER TABLE ONLY "public"."professores" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."professores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles_archive" (
    "user_id" "uuid" NOT NULL,
    "nome" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "role" "public"."user_role",
    "email" "text",
    "escola_id" "uuid",
    "onboarding_finalizado" boolean,
    "telefone" "text",
    "global_role" "text",
    "current_escola_id" "uuid",
    "numero_login" "text",
    "deleted_at" timestamp with time zone,
    "archived_at" timestamp with time zone DEFAULT "now"(),
    "archived_by" "uuid"
);


ALTER TABLE "public"."profiles_archive" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."regras_escala" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sistema_notas_id" "uuid" NOT NULL,
    "grade" "text" NOT NULL,
    "point" numeric NOT NULL,
    "start" integer NOT NULL,
    "end" integer NOT NULL,
    "escola_id" "uuid" NOT NULL
);


ALTER TABLE "public"."regras_escala" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" integer NOT NULL,
    "nome" "text" NOT NULL
);

ALTER TABLE ONLY "public"."roles" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."roles" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."roles_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."roles_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."roles_id_seq" OWNED BY "public"."roles"."id";



CREATE TABLE IF NOT EXISTS "public"."rotinas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "turma_id" "uuid" NOT NULL,
    "secao_id" "uuid",
    "curso_oferta_id" "uuid" NOT NULL,
    "professor_user_id" "uuid" NOT NULL,
    "weekday" integer NOT NULL,
    "inicio" time without time zone NOT NULL,
    "fim" time without time zone NOT NULL,
    "sala" "text",
    "escola_id" "uuid" NOT NULL,
    CONSTRAINT "rotinas_weekday_check" CHECK ((("weekday" >= 1) AND ("weekday" <= 7)))
);


ALTER TABLE "public"."rotinas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."school_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "data_inicio" "date" NOT NULL,
    "data_fim" "date" NOT NULL,
    "status" "text" NOT NULL,
    CONSTRAINT "school_sessions_status_check" CHECK (("status" = ANY (ARRAY['ativa'::"text", 'arquivada'::"text"])))
);

ALTER TABLE ONLY "public"."school_sessions" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."school_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."secoes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "turma_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "sala" "text",
    "escola_id" "uuid" NOT NULL
);

ALTER TABLE ONLY "public"."secoes" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."secoes" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."secretaria_audit_feed" AS
 SELECT "l"."created_at",
    "l"."portal",
    "l"."acao",
    "l"."tabela",
    "l"."entity_id",
    "l"."escola_id",
    "l"."user_id",
    "pr"."email" AS "user_email",
        CASE
            WHEN (("l"."tabela" = 'matriculas'::"text") AND ("l"."entity_id" ~ '^[0-9a-fA-F-]{36}$'::"text")) THEN ("l"."entity_id")::"uuid"
            WHEN (("l"."tabela" = ANY (ARRAY['pagamentos'::"text", 'frequencias'::"text"])) AND (COALESCE((("l"."details" -> 'new'::"text") ->> 'matricula_id'::"text"), (("l"."details" -> 'old'::"text") ->> 'matricula_id'::"text")) ~ '^[0-9a-fA-F-]{36}$'::"text")) THEN (COALESCE((("l"."details" -> 'new'::"text") ->> 'matricula_id'::"text"), (("l"."details" -> 'old'::"text") ->> 'matricula_id'::"text")))::"uuid"
            ELSE NULL::"uuid"
        END AS "matricula_id",
    "m"."aluno_id",
    "a"."nome" AS "aluno_nome",
    "l"."details"
   FROM ((("public"."audit_logs" "l"
     LEFT JOIN "public"."profiles" "pr" ON (("pr"."user_id" = "l"."user_id")))
     LEFT JOIN "public"."matriculas" "m" ON (("m"."id" =
        CASE
            WHEN (("l"."tabela" = 'matriculas'::"text") AND ("l"."entity_id" ~ '^[0-9a-fA-F-]{36}$'::"text")) THEN ("l"."entity_id")::"uuid"
            WHEN (("l"."tabela" = ANY (ARRAY['pagamentos'::"text", 'frequencias'::"text"])) AND (COALESCE((("l"."details" -> 'new'::"text") ->> 'matricula_id'::"text"), (("l"."details" -> 'old'::"text") ->> 'matricula_id'::"text")) ~ '^[0-9a-fA-F-]{36}$'::"text")) THEN (COALESCE((("l"."details" -> 'new'::"text") ->> 'matricula_id'::"text"), (("l"."details" -> 'old'::"text") ->> 'matricula_id'::"text")))::"uuid"
            ELSE NULL::"uuid"
        END)))
     LEFT JOIN "public"."alunos" "a" ON (("a"."id" = "m"."aluno_id")))
  WHERE (("l"."escola_id" = "public"."current_tenant_escola_id"()) OR ("m"."escola_id" = "public"."current_tenant_escola_id"()));


ALTER VIEW "public"."secretaria_audit_feed" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sistemas_notas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "turma_id" "uuid",
    "semestre_id" "uuid",
    "nome" "text" NOT NULL,
    "tipo" "text" NOT NULL,
    "escola_id" "uuid" NOT NULL,
    CONSTRAINT "sistemas_notas_tipo_check" CHECK (("tipo" = ANY (ARRAY['numerico'::"text", 'percentual'::"text", 'menção'::"text"])))
);


ALTER TABLE "public"."sistemas_notas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."syllabi" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "curso_oferta_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "arquivo_url" "text" NOT NULL,
    "criado_em" "date" DEFAULT CURRENT_DATE NOT NULL,
    "escola_id" "uuid" NOT NULL
);


ALTER TABLE "public"."syllabi" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."turmas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "ano_letivo" "text",
    "turno" "text",
    "sala" "text",
    "session_id" "uuid"
);

ALTER TABLE ONLY "public"."turmas" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."turmas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."turmas_auditoria" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "turma_id" "uuid" NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "acao" "text" NOT NULL,
    "dados" "jsonb",
    "criado_em" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."turmas_auditoria" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."turmas_auditoria" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_financeiro_escola_dia" WITH ("security_invoker"='true') AS
 SELECT "escola_id",
    "dia",
    "qtd_pagos",
    "qtd_total"
   FROM "public"."mv_financeiro_escola_dia"
  WHERE ("escola_id" = "public"."current_tenant_escola_id"());


ALTER VIEW "public"."v_financeiro_escola_dia" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_freq_por_turma_dia" WITH ("security_invoker"='true') AS
 SELECT "escola_id",
    "turma_id",
    "dia",
    "total",
    "presentes"
   FROM "public"."mv_freq_por_turma_dia"
  WHERE ("escola_id" = "public"."current_tenant_escola_id"());


ALTER VIEW "public"."v_freq_por_turma_dia" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_media_por_curso" WITH ("security_invoker"='true') AS
 SELECT "escola_id",
    "curso_oferta_id",
    "media"
   FROM "public"."mv_media_por_curso"
  WHERE ("escola_id" = "public"."current_tenant_escola_id"());


ALTER VIEW "public"."v_media_por_curso" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_top_cursos_media" WITH ("security_invoker"='true') AS
 SELECT "l"."escola_id",
    "a"."curso_oferta_id",
    "c"."nome" AS "curso_nome",
    ("avg"("l"."valor"))::numeric(10,2) AS "media"
   FROM ((("public"."lancamentos" "l"
     JOIN "public"."avaliacoes" "a" ON (("a"."id" = "l"."avaliacao_id")))
     JOIN "public"."cursos_oferta" "co" ON (("co"."id" = "a"."curso_oferta_id")))
     JOIN "public"."cursos" "c" ON (("c"."id" = "co"."curso_id")))
  WHERE ("l"."escola_id" = "public"."current_tenant_escola_id"())
  GROUP BY "l"."escola_id", "a"."curso_oferta_id", "c"."nome";


ALTER VIEW "public"."v_top_cursos_media" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_top_turmas_hoje" WITH ("security_invoker"='true') AS
 WITH "agg" AS (
         SELECT "f"."escola_id",
            "m"."turma_id",
            "f"."data" AS "dia",
            ("count"(*))::integer AS "total",
            ("count"(*) FILTER (WHERE ("f"."status" = 'presente'::"text")))::integer AS "presentes"
           FROM ("public"."frequencias" "f"
             JOIN "public"."matriculas" "m" ON (("m"."id" = "f"."matricula_id")))
          WHERE ("f"."data" = CURRENT_DATE)
          GROUP BY "f"."escola_id", "m"."turma_id", "f"."data"
        )
 SELECT "a"."escola_id",
    "a"."turma_id",
    "t"."nome" AS "turma_nome",
    "a"."total",
    "a"."presentes",
        CASE
            WHEN ("a"."total" > 0) THEN "round"(((("a"."presentes")::numeric / ("a"."total")::numeric) * 100.0), 1)
            ELSE NULL::numeric
        END AS "percent"
   FROM ("agg" "a"
     JOIN "public"."turmas" "t" ON (("t"."id" = "a"."turma_id")))
  WHERE ("a"."escola_id" = "public"."current_tenant_escola_id"());


ALTER VIEW "public"."v_top_turmas_hoje" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_radar_inadimplencia" AS
 SELECT 1 AS "aluno_id",
    150.50 AS "valor_em_atraso"
UNION ALL
 SELECT 2 AS "aluno_id",
    200.75 AS "valor_em_atraso"
UNION ALL
 SELECT 3 AS "aluno_id",
    75.25 AS "valor_em_atraso";


ALTER VIEW "public"."vw_radar_inadimplencia" OWNER TO "postgres";


ALTER TABLE ONLY "public"."frequencias" ATTACH PARTITION "public"."frequencias_2025_09" FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');



ALTER TABLE ONLY "public"."frequencias" ATTACH PARTITION "public"."frequencias_2025_10" FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');



ALTER TABLE ONLY "public"."frequencias" ATTACH PARTITION "public"."frequencias_2025_11" FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');



ALTER TABLE ONLY "public"."frequencias" ATTACH PARTITION "public"."frequencias_2025_12" FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');



ALTER TABLE ONLY "public"."frequencias" ATTACH PARTITION "public"."frequencias_default" DEFAULT;



ALTER TABLE ONLY "public"."lancamentos" ATTACH PARTITION "public"."lancamentos_2025_09" FOR VALUES FROM ('2025-09-01 00:00:00+00') TO ('2025-10-01 00:00:00+00');



ALTER TABLE ONLY "public"."lancamentos" ATTACH PARTITION "public"."lancamentos_2025_10" FOR VALUES FROM ('2025-10-01 00:00:00+00') TO ('2025-11-01 00:00:00+00');



ALTER TABLE ONLY "public"."lancamentos" ATTACH PARTITION "public"."lancamentos_2025_11" FOR VALUES FROM ('2025-11-01 00:00:00+00') TO ('2025-12-01 00:00:00+00');



ALTER TABLE ONLY "public"."lancamentos" ATTACH PARTITION "public"."lancamentos_2025_12" FOR VALUES FROM ('2025-12-01 00:00:00+00') TO ('2026-01-01 00:00:00+00');



ALTER TABLE ONLY "public"."lancamentos" ATTACH PARTITION "public"."lancamentos_default" DEFAULT;



ALTER TABLE ONLY "public"."audit_logs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."audit_logs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."permissions" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."permissions_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."roles" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."roles_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."alunos"
    ADD CONSTRAINT "alunos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."atribuicoes_prof"
    ADD CONSTRAINT "atribuicoes_prof_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."avaliacoes"
    ADD CONSTRAINT "avaliacoes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."classes"
    ADD CONSTRAINT "classes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."configuracoes_escola"
    ADD CONSTRAINT "configuracoes_escola_pkey" PRIMARY KEY ("escola_id");



ALTER TABLE ONLY "public"."cursos_oferta"
    ADD CONSTRAINT "cursos_oferta_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cursos"
    ADD CONSTRAINT "cursos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."escola_administradores"
    ADD CONSTRAINT "escola_administradores_escola_id_user_id_key" UNIQUE ("escola_id", "user_id");



ALTER TABLE ONLY "public"."escola_administradores"
    ADD CONSTRAINT "escola_administradores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."escola_auditoria"
    ADD CONSTRAINT "escola_auditoria_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."escola_configuracoes"
    ADD CONSTRAINT "escola_configuracoes_pkey" PRIMARY KEY ("escola_id");



ALTER TABLE ONLY "public"."escola_members"
    ADD CONSTRAINT "escola_members_pkey" PRIMARY KEY ("escola_id", "user_id");



ALTER TABLE ONLY "public"."escola_usuarios"
    ADD CONSTRAINT "escola_usuarios_escola_id_user_id_key" UNIQUE ("escola_id", "user_id");



ALTER TABLE ONLY "public"."escola_usuarios"
    ADD CONSTRAINT "escola_usuarios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."escolas"
    ADD CONSTRAINT "escolas_cnpj_key" UNIQUE ("nif");



ALTER TABLE ONLY "public"."escolas"
    ADD CONSTRAINT "escolas_nome_unique" UNIQUE ("nome");



ALTER TABLE ONLY "public"."escolas"
    ADD CONSTRAINT "escolas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."frequencias_default"
    ADD CONSTRAINT "frequencias_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lancamentos_default"
    ADD CONSTRAINT "lancamentos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."matriculas"
    ADD CONSTRAINT "matriculas_aluno_id_turma_id_key" UNIQUE ("aluno_id", "turma_id");



ALTER TABLE ONLY "public"."matriculas_cursos"
    ADD CONSTRAINT "matriculas_cursos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."matriculas"
    ADD CONSTRAINT "matriculas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notas"
    ADD CONSTRAINT "notas_aluno_id_turma_id_disciplina_periodo_id_key" UNIQUE ("aluno_id", "turma_id", "disciplina", "periodo_id");



ALTER TABLE ONLY "public"."notas"
    ADD CONSTRAINT "notas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notices"
    ADD CONSTRAINT "notices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."onboarding_drafts"
    ADD CONSTRAINT "onboarding_drafts_escola_user_unique" UNIQUE ("escola_id", "user_id");



ALTER TABLE ONLY "public"."onboarding_drafts"
    ADD CONSTRAINT "onboarding_drafts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pagamentos"
    ADD CONSTRAINT "pagamentos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."periodos_letivos"
    ADD CONSTRAINT "periodos_letivos_nome_unique" UNIQUE ("nome");



ALTER TABLE ONLY "public"."periodos_letivos"
    ADD CONSTRAINT "periodos_letivos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."permissions"
    ADD CONSTRAINT "permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."permissions"
    ADD CONSTRAINT "permissions_role_id_recurso_acao_key" UNIQUE ("role_id", "recurso", "acao");



ALTER TABLE ONLY "public"."presencas"
    ADD CONSTRAINT "presencas_aluno_id_turma_id_data_key" UNIQUE ("aluno_id", "turma_id", "data");



ALTER TABLE ONLY "public"."presencas"
    ADD CONSTRAINT "presencas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."professores"
    ADD CONSTRAINT "professores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles_archive"
    ADD CONSTRAINT "profiles_archive_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."regras_escala"
    ADD CONSTRAINT "regras_escala_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_nome_key" UNIQUE ("nome");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rotinas"
    ADD CONSTRAINT "rotinas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."school_sessions"
    ADD CONSTRAINT "school_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."secoes"
    ADD CONSTRAINT "secoes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."semestres"
    ADD CONSTRAINT "semestres_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sistemas_notas"
    ADD CONSTRAINT "sistemas_notas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."syllabi"
    ADD CONSTRAINT "syllabi_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."turmas_auditoria"
    ADD CONSTRAINT "turmas_auditoria_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."turmas"
    ADD CONSTRAINT "turmas_pkey" PRIMARY KEY ("id");



CREATE INDEX "audit_logs_action_idx" ON "public"."audit_logs" USING "btree" ("action");



CREATE INDEX "audit_logs_created_at_desc_idx" ON "public"."audit_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "audit_logs_details_gin_idx" ON "public"."audit_logs" USING "gin" ("details");



CREATE INDEX "audit_logs_escola_id_idx" ON "public"."audit_logs" USING "btree" ("escola_id");



CREATE INDEX "audit_logs_portal_idx" ON "public"."audit_logs" USING "btree" ("portal");



CREATE INDEX "brin_freq_data" ON "public"."frequencias_default" USING "brin" ("data") WITH ("pages_per_range"='16');



CREATE INDEX "classes_escola_ordem_idx" ON "public"."classes" USING "btree" ("escola_id", "ordem");



CREATE INDEX "idx_atribuicoes_prof_prof" ON "public"."atribuicoes_prof" USING "btree" ("professor_user_id");



CREATE INDEX "idx_avaliacoes_curso_oferta" ON "public"."avaliacoes" USING "btree" ("curso_oferta_id");



CREATE INDEX "idx_classes_escola_id" ON "public"."classes" USING "btree" ("escola_id");



CREATE INDEX "idx_configuracoes_escola_periodo_tipo" ON "public"."configuracoes_escola" USING "btree" ("periodo_tipo");



CREATE INDEX "idx_cursos_escola" ON "public"."cursos" USING "btree" ("escola_id");



CREATE INDEX "idx_cursos_oferta_curso" ON "public"."cursos_oferta" USING "btree" ("curso_id");



CREATE INDEX "idx_cursos_oferta_semestre" ON "public"."cursos_oferta" USING "btree" ("semestre_id");



CREATE INDEX "idx_cursos_oferta_turma" ON "public"."cursos_oferta" USING "btree" ("turma_id");



CREATE INDEX "idx_escola_administradores_escola_id" ON "public"."escola_administradores" USING "btree" ("escola_id");



CREATE INDEX "idx_escola_administradores_user_id" ON "public"."escola_administradores" USING "btree" ("user_id");



CREATE INDEX "idx_escola_usuarios_escola_id" ON "public"."escola_usuarios" USING "btree" ("escola_id");



CREATE INDEX "idx_escola_usuarios_user_id" ON "public"."escola_usuarios" USING "btree" ("user_id");



CREATE INDEX "idx_events_escola" ON "public"."events" USING "btree" ("escola_id");



CREATE INDEX "idx_frequencias_data" ON "public"."frequencias_default" USING "btree" ("data");



CREATE INDEX "idx_frequencias_matricula" ON "public"."frequencias_default" USING "btree" ("matricula_id");



CREATE INDEX "idx_lancamentos_2025_09_tenant_id" ON "public"."lancamentos_2025_09" USING "btree" ("tenant_id");



CREATE INDEX "idx_lancamentos_avaliacao" ON "public"."lancamentos_default" USING "btree" ("avaliacao_id");



CREATE INDEX "idx_matriculas_cursos_matricula" ON "public"."matriculas_cursos" USING "btree" ("matricula_id");



CREATE INDEX "idx_matriculas_secao" ON "public"."matriculas" USING "btree" ("secao_id");



CREATE INDEX "idx_matriculas_session" ON "public"."matriculas" USING "btree" ("session_id");



CREATE INDEX "idx_notices_escola" ON "public"."notices" USING "btree" ("escola_id");



CREATE INDEX "idx_profiles_current_escola" ON "public"."profiles" USING "btree" ("current_escola_id");



CREATE INDEX "idx_profiles_user_id" ON "public"."profiles" USING "btree" ("user_id");



CREATE INDEX "idx_regras_escala_sistema" ON "public"."regras_escala" USING "btree" ("sistema_notas_id");



CREATE INDEX "idx_rotinas_curso_oferta" ON "public"."rotinas" USING "btree" ("curso_oferta_id");



CREATE INDEX "idx_rotinas_secao" ON "public"."rotinas" USING "btree" ("secao_id");



CREATE INDEX "idx_rotinas_turma" ON "public"."rotinas" USING "btree" ("turma_id");



CREATE INDEX "idx_secoes_turma" ON "public"."secoes" USING "btree" ("turma_id");



CREATE INDEX "idx_semestres_session" ON "public"."semestres" USING "btree" ("session_id");



CREATE INDEX "idx_sistemas_notas_semestre" ON "public"."sistemas_notas" USING "btree" ("semestre_id");



CREATE INDEX "idx_sistemas_notas_turma" ON "public"."sistemas_notas" USING "btree" ("turma_id");



CREATE INDEX "idx_syllabi_curso_oferta" ON "public"."syllabi" USING "btree" ("curso_oferta_id");



CREATE INDEX "idx_turmas_session" ON "public"."turmas" USING "btree" ("session_id");



CREATE INDEX "ix_alunos_profile" ON "public"."alunos" USING "btree" ("profile_id");



CREATE INDEX "ix_alunos_tsv" ON "public"."alunos" USING "gin" ("tsv");



CREATE INDEX "ix_attrprof_escola_prof_oferta" ON "public"."atribuicoes_prof" USING "btree" ("escola_id", "professor_user_id", "curso_oferta_id", "secao_id");



CREATE INDEX "ix_cursos_nome_trgm" ON "public"."cursos" USING "gin" ("nome" "extensions"."gin_trgm_ops");



CREATE INDEX "ix_events_escola_inicio" ON "public"."events" USING "btree" ("escola_id", "inicio_at" DESC);



CREATE INDEX "ix_freq_escola_curso_data" ON "public"."frequencias_default" USING "btree" ("escola_id", "curso_oferta_id", "data");



CREATE INDEX "ix_freq_escola_routine_data" ON "public"."frequencias_default" USING "btree" ("escola_id", "routine_id", "data");



CREATE INDEX "ix_frequencias_2025_09_escola_curso_data" ON "public"."frequencias_2025_09" USING "btree" ("escola_id", "curso_oferta_id", "data");



CREATE INDEX "ix_frequencias_2025_09_escola_routine_data" ON "public"."frequencias_2025_09" USING "btree" ("escola_id", "routine_id", "data");



CREATE INDEX "ix_frequencias_2025_10_escola_curso_data" ON "public"."frequencias_2025_10" USING "btree" ("escola_id", "curso_oferta_id", "data");



CREATE INDEX "ix_frequencias_2025_10_escola_routine_data" ON "public"."frequencias_2025_10" USING "btree" ("escola_id", "routine_id", "data");



CREATE INDEX "ix_frequencias_2025_11_escola_curso_data" ON "public"."frequencias_2025_11" USING "btree" ("escola_id", "curso_oferta_id", "data");



CREATE INDEX "ix_frequencias_2025_11_escola_routine_data" ON "public"."frequencias_2025_11" USING "btree" ("escola_id", "routine_id", "data");



CREATE INDEX "ix_frequencias_2025_12_escola_curso_data" ON "public"."frequencias_2025_12" USING "btree" ("escola_id", "curso_oferta_id", "data");



CREATE INDEX "ix_frequencias_2025_12_escola_routine_data" ON "public"."frequencias_2025_12" USING "btree" ("escola_id", "routine_id", "data");



CREATE INDEX "ix_lanc_escola_avaliacao_matricula" ON "public"."lancamentos_default" USING "btree" ("escola_id", "avaliacao_id", "matricula_id");



CREATE INDEX "ix_lanc_escola_matricula" ON "public"."lancamentos_default" USING "btree" ("escola_id", "matricula_id");



CREATE INDEX "ix_lancamentos_2025_09_escola_avaliacao_matricula" ON "public"."lancamentos_2025_09" USING "btree" ("escola_id", "avaliacao_id", "matricula_id");



CREATE INDEX "ix_lancamentos_2025_09_escola_matricula" ON "public"."lancamentos_2025_09" USING "btree" ("escola_id", "matricula_id");



CREATE INDEX "ix_lancamentos_2025_10_escola_avaliacao_matricula" ON "public"."lancamentos_2025_10" USING "btree" ("escola_id", "avaliacao_id", "matricula_id");



CREATE INDEX "ix_lancamentos_2025_10_escola_matricula" ON "public"."lancamentos_2025_10" USING "btree" ("escola_id", "matricula_id");



CREATE INDEX "ix_lancamentos_2025_11_escola_avaliacao_matricula" ON "public"."lancamentos_2025_11" USING "btree" ("escola_id", "avaliacao_id", "matricula_id");



CREATE INDEX "ix_lancamentos_2025_11_escola_matricula" ON "public"."lancamentos_2025_11" USING "btree" ("escola_id", "matricula_id");



CREATE INDEX "ix_lancamentos_2025_12_escola_avaliacao_matricula" ON "public"."lancamentos_2025_12" USING "btree" ("escola_id", "avaliacao_id", "matricula_id");



CREATE INDEX "ix_lancamentos_2025_12_escola_matricula" ON "public"."lancamentos_2025_12" USING "btree" ("escola_id", "matricula_id");



CREATE INDEX "ix_matriculas_escola_turma_secao" ON "public"."matriculas" USING "btree" ("escola_id", "turma_id", "secao_id", "status");



CREATE INDEX "ix_notices_escola_criado" ON "public"."notices" USING "btree" ("escola_id", "criado_em" DESC);



CREATE INDEX "ix_oferta_escola_curso_turma_semestre" ON "public"."cursos_oferta" USING "btree" ("escola_id", "curso_id", "turma_id", "semestre_id");



CREATE INDEX "ix_rotinas_escola_secao_weekday_inicio" ON "public"."rotinas" USING "btree" ("escola_id", "secao_id", "weekday", "inicio");



CREATE UNIQUE INDEX "profiles_escola_numero_login_uidx" ON "public"."profiles" USING "btree" ("escola_id", "numero_login") WHERE ("numero_login" IS NOT NULL);



CREATE UNIQUE INDEX "uq_atribuicoes_prof_unique" ON "public"."atribuicoes_prof" USING "btree" ("professor_user_id", "curso_oferta_id", "secao_id");



CREATE UNIQUE INDEX "uq_cursos_escola_codigo" ON "public"."cursos" USING "btree" ("escola_id", "codigo");



CREATE UNIQUE INDEX "uq_cursos_oferta_unique" ON "public"."cursos_oferta" USING "btree" ("curso_id", "turma_id", "semestre_id");



CREATE UNIQUE INDEX "uq_escola_usuarios_unique" ON "public"."escola_usuarios" USING "btree" ("escola_id", "user_id");



CREATE UNIQUE INDEX "uq_lancamentos_unique" ON "public"."lancamentos_default" USING "btree" ("matricula_id", "avaliacao_id");



CREATE UNIQUE INDEX "uq_matriculas_aluno_session" ON "public"."matriculas" USING "btree" ("aluno_id", "session_id") WHERE ("session_id" IS NOT NULL);



CREATE UNIQUE INDEX "uq_matriculas_cursos_unique" ON "public"."matriculas_cursos" USING "btree" ("matricula_id", "curso_oferta_id");



CREATE UNIQUE INDEX "uq_rotina_sala_tempo" ON "public"."rotinas" USING "btree" ("escola_id", "sala", "weekday", "inicio", "fim");



CREATE UNIQUE INDEX "uq_school_sessions_ativa_per_escola" ON "public"."school_sessions" USING "btree" ("escola_id") WHERE ("status" = 'ativa'::"text");



CREATE OR REPLACE TRIGGER "escolas_audit_delete" AFTER DELETE ON "public"."escolas" FOR EACH ROW EXECUTE FUNCTION "public"."log_escola_auditoria"();



CREATE OR REPLACE TRIGGER "escolas_audit_insert" AFTER INSERT ON "public"."escolas" FOR EACH ROW EXECUTE FUNCTION "public"."log_escola_auditoria"();



CREATE OR REPLACE TRIGGER "escolas_audit_update" AFTER UPDATE ON "public"."escolas" FOR EACH ROW EXECUTE FUNCTION "public"."log_escola_auditoria"();



CREATE OR REPLACE TRIGGER "trg_audit_alunos" AFTER INSERT OR DELETE OR UPDATE ON "public"."alunos" FOR EACH ROW EXECUTE FUNCTION "public"."log_audit_event"();



CREATE OR REPLACE TRIGGER "trg_audit_matriculas" AFTER INSERT OR DELETE OR UPDATE ON "public"."matriculas" FOR EACH ROW EXECUTE FUNCTION "public"."audit_dml_trigger"();



CREATE OR REPLACE TRIGGER "trg_audit_pagamentos" AFTER INSERT OR DELETE OR UPDATE ON "public"."pagamentos" FOR EACH ROW EXECUTE FUNCTION "public"."log_audit_event"();



CREATE OR REPLACE TRIGGER "trg_bi_atribuicoes_prof_escola" BEFORE INSERT OR UPDATE OF "curso_oferta_id" ON "public"."atribuicoes_prof" FOR EACH ROW EXECUTE FUNCTION "public"."trg_set_escola_atribuicoes_prof"();



CREATE OR REPLACE TRIGGER "trg_bi_avaliacoes_escola" BEFORE INSERT OR UPDATE OF "curso_oferta_id" ON "public"."avaliacoes" FOR EACH ROW EXECUTE FUNCTION "public"."trg_set_escola_avaliacoes"();



CREATE OR REPLACE TRIGGER "trg_bi_cursos_oferta_escola" BEFORE INSERT OR UPDATE OF "curso_id" ON "public"."cursos_oferta" FOR EACH ROW EXECUTE FUNCTION "public"."trg_set_escola_cursos_oferta"();



CREATE OR REPLACE TRIGGER "trg_bi_frequencias_escola" BEFORE INSERT OR UPDATE OF "matricula_id" ON "public"."frequencias_default" FOR EACH ROW EXECUTE FUNCTION "public"."trg_set_escola_frequencias"();



CREATE OR REPLACE TRIGGER "trg_bi_lancamentos_escola" BEFORE INSERT OR UPDATE OF "matricula_id" ON "public"."lancamentos_default" FOR EACH ROW EXECUTE FUNCTION "public"."trg_set_escola_lancamentos"();



CREATE OR REPLACE TRIGGER "trg_bi_matriculas_cursos_escola" BEFORE INSERT OR UPDATE OF "matricula_id" ON "public"."matriculas_cursos" FOR EACH ROW EXECUTE FUNCTION "public"."trg_set_escola_matriculas_cursos"();



CREATE OR REPLACE TRIGGER "trg_bi_regras_escala_escola" BEFORE INSERT OR UPDATE OF "sistema_notas_id" ON "public"."regras_escala" FOR EACH ROW EXECUTE FUNCTION "public"."trg_set_escola_regras_escala"();



CREATE OR REPLACE TRIGGER "trg_bi_rotinas_escola" BEFORE INSERT OR UPDATE OF "curso_oferta_id", "turma_id" ON "public"."rotinas" FOR EACH ROW EXECUTE FUNCTION "public"."trg_set_escola_rotinas"();



CREATE OR REPLACE TRIGGER "trg_bi_sistemas_notas_escola" BEFORE INSERT OR UPDATE OF "turma_id", "semestre_id" ON "public"."sistemas_notas" FOR EACH ROW EXECUTE FUNCTION "public"."trg_set_escola_sistemas_notas"();



CREATE OR REPLACE TRIGGER "trg_bi_syllabi_escola" BEFORE INSERT OR UPDATE OF "curso_oferta_id" ON "public"."syllabi" FOR EACH ROW EXECUTE FUNCTION "public"."trg_set_escola_syllabi"();



CREATE OR REPLACE TRIGGER "trg_bu_config_escola_updated_at" BEFORE UPDATE ON "public"."configuracoes_escola" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_escolas_updated" BEFORE UPDATE ON "public"."escolas" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_generate_matricula_number" BEFORE INSERT ON "public"."matriculas" FOR EACH ROW EXECUTE FUNCTION "public"."generate_matricula_number"();



CREATE OR REPLACE TRIGGER "trg_profiles_updated" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "turmas_audit_delete" AFTER DELETE ON "public"."turmas" FOR EACH ROW EXECUTE FUNCTION "public"."log_turma_auditoria"();



CREATE OR REPLACE TRIGGER "turmas_audit_insert" AFTER INSERT ON "public"."turmas" FOR EACH ROW EXECUTE FUNCTION "public"."log_turma_auditoria"();



CREATE OR REPLACE TRIGGER "turmas_audit_update" AFTER UPDATE ON "public"."turmas" FOR EACH ROW EXECUTE FUNCTION "public"."log_turma_auditoria"();



ALTER TABLE ONLY "public"."alunos"
    ADD CONSTRAINT "alunos_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."alunos"
    ADD CONSTRAINT "alunos_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."atribuicoes_prof"
    ADD CONSTRAINT "atribuicoes_prof_curso_oferta_id_fkey" FOREIGN KEY ("curso_oferta_id") REFERENCES "public"."cursos_oferta"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."atribuicoes_prof"
    ADD CONSTRAINT "atribuicoes_prof_escola_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."atribuicoes_prof"
    ADD CONSTRAINT "atribuicoes_prof_professor_user_id_fkey" FOREIGN KEY ("professor_user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."atribuicoes_prof"
    ADD CONSTRAINT "atribuicoes_prof_secao_id_fkey" FOREIGN KEY ("secao_id") REFERENCES "public"."secoes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id");



ALTER TABLE ONLY "public"."avaliacoes"
    ADD CONSTRAINT "avaliacoes_curso_oferta_id_fkey" FOREIGN KEY ("curso_oferta_id") REFERENCES "public"."cursos_oferta"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."avaliacoes"
    ADD CONSTRAINT "avaliacoes_escola_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."avaliacoes"
    ADD CONSTRAINT "avaliacoes_sistema_notas_id_fkey" FOREIGN KEY ("sistema_notas_id") REFERENCES "public"."sistemas_notas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."classes"
    ADD CONSTRAINT "classes_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."configuracoes_escola"
    ADD CONSTRAINT "configuracoes_escola_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cursos"
    ADD CONSTRAINT "cursos_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cursos_oferta"
    ADD CONSTRAINT "cursos_oferta_curso_id_fkey" FOREIGN KEY ("curso_id") REFERENCES "public"."cursos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cursos_oferta"
    ADD CONSTRAINT "cursos_oferta_escola_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cursos_oferta"
    ADD CONSTRAINT "cursos_oferta_semestre_id_fkey" FOREIGN KEY ("semestre_id") REFERENCES "public"."semestres"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cursos_oferta"
    ADD CONSTRAINT "cursos_oferta_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "public"."turmas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cursos"
    ADD CONSTRAINT "cursos_semestre_id_fkey" FOREIGN KEY ("semestre_id") REFERENCES "public"."semestres"("id");



ALTER TABLE ONLY "public"."escola_administradores"
    ADD CONSTRAINT "escola_administradores_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."escola_administradores"
    ADD CONSTRAINT "escola_administradores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."escola_auditoria"
    ADD CONSTRAINT "escola_auditoria_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."escola_configuracoes"
    ADD CONSTRAINT "escola_configuracoes_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."escola_members"
    ADD CONSTRAINT "escola_members_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."escola_members"
    ADD CONSTRAINT "escola_members_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id");



ALTER TABLE ONLY "public"."escola_members"
    ADD CONSTRAINT "escola_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."escola_usuarios"
    ADD CONSTRAINT "escola_usuarios_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."escola_usuarios"
    ADD CONSTRAINT "escola_usuarios_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."escola_administradores"
    ADD CONSTRAINT "fk_escola_admin_escola" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."escola_administradores"
    ADD CONSTRAINT "fk_escola_admin_user" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."frequencias_default"
    ADD CONSTRAINT "frequencias_curso_oferta_id_fkey" FOREIGN KEY ("curso_oferta_id") REFERENCES "public"."cursos_oferta"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."frequencias_default"
    ADD CONSTRAINT "frequencias_escola_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."frequencias_default"
    ADD CONSTRAINT "frequencias_matricula_id_fkey" FOREIGN KEY ("matricula_id") REFERENCES "public"."matriculas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."frequencias_default"
    ADD CONSTRAINT "frequencias_routine_id_fkey" FOREIGN KEY ("routine_id") REFERENCES "public"."rotinas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."lancamentos_default"
    ADD CONSTRAINT "lancamentos_avaliacao_id_fkey" FOREIGN KEY ("avaliacao_id") REFERENCES "public"."avaliacoes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lancamentos_default"
    ADD CONSTRAINT "lancamentos_escola_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lancamentos_default"
    ADD CONSTRAINT "lancamentos_matricula_id_fkey" FOREIGN KEY ("matricula_id") REFERENCES "public"."matriculas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matriculas"
    ADD CONSTRAINT "matriculas_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "public"."alunos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matriculas_cursos"
    ADD CONSTRAINT "matriculas_cursos_curso_oferta_id_fkey" FOREIGN KEY ("curso_oferta_id") REFERENCES "public"."cursos_oferta"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matriculas_cursos"
    ADD CONSTRAINT "matriculas_cursos_escola_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matriculas_cursos"
    ADD CONSTRAINT "matriculas_cursos_matricula_id_fkey" FOREIGN KEY ("matricula_id") REFERENCES "public"."matriculas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matriculas"
    ADD CONSTRAINT "matriculas_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matriculas"
    ADD CONSTRAINT "matriculas_secao_id_fkey" FOREIGN KEY ("secao_id") REFERENCES "public"."secoes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."matriculas"
    ADD CONSTRAINT "matriculas_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."school_sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."matriculas"
    ADD CONSTRAINT "matriculas_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "public"."turmas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notas"
    ADD CONSTRAINT "notas_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "public"."alunos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notas"
    ADD CONSTRAINT "notas_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notas"
    ADD CONSTRAINT "notas_periodo_id_fkey" FOREIGN KEY ("periodo_id") REFERENCES "public"."periodos_letivos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notas"
    ADD CONSTRAINT "notas_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "public"."turmas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notices"
    ADD CONSTRAINT "notices_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."onboarding_drafts"
    ADD CONSTRAINT "onboarding_drafts_escola_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pagamentos"
    ADD CONSTRAINT "pagamentos_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "public"."alunos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pagamentos"
    ADD CONSTRAINT "pagamentos_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."periodos_letivos"
    ADD CONSTRAINT "periodos_letivos_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."permissions"
    ADD CONSTRAINT "permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."presencas"
    ADD CONSTRAINT "presencas_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "public"."alunos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."presencas"
    ADD CONSTRAINT "presencas_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."presencas"
    ADD CONSTRAINT "presencas_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "public"."turmas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."professores"
    ADD CONSTRAINT "professores_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."professores"
    ADD CONSTRAINT "professores_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_current_escola_id_fkey" FOREIGN KEY ("current_escola_id") REFERENCES "public"."escolas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."regras_escala"
    ADD CONSTRAINT "regras_escala_escola_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."regras_escala"
    ADD CONSTRAINT "regras_escala_sistema_notas_id_fkey" FOREIGN KEY ("sistema_notas_id") REFERENCES "public"."sistemas_notas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rotinas"
    ADD CONSTRAINT "rotinas_curso_oferta_id_fkey" FOREIGN KEY ("curso_oferta_id") REFERENCES "public"."cursos_oferta"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rotinas"
    ADD CONSTRAINT "rotinas_escola_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rotinas"
    ADD CONSTRAINT "rotinas_professor_user_id_fkey" FOREIGN KEY ("professor_user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rotinas"
    ADD CONSTRAINT "rotinas_secao_id_fkey" FOREIGN KEY ("secao_id") REFERENCES "public"."secoes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."rotinas"
    ADD CONSTRAINT "rotinas_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "public"."turmas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."school_sessions"
    ADD CONSTRAINT "school_sessions_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."secoes"
    ADD CONSTRAINT "secoes_escola_fk_linter_fix" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."secoes"
    ADD CONSTRAINT "secoes_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "public"."turmas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."semestres"
    ADD CONSTRAINT "semestres_escola_fk_linter_fix" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."semestres"
    ADD CONSTRAINT "semestres_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."school_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sistemas_notas"
    ADD CONSTRAINT "sistemas_notas_escola_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sistemas_notas"
    ADD CONSTRAINT "sistemas_notas_semestre_id_fkey" FOREIGN KEY ("semestre_id") REFERENCES "public"."semestres"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sistemas_notas"
    ADD CONSTRAINT "sistemas_notas_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "public"."turmas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."syllabi"
    ADD CONSTRAINT "syllabi_curso_oferta_id_fkey" FOREIGN KEY ("curso_oferta_id") REFERENCES "public"."cursos_oferta"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."syllabi"
    ADD CONSTRAINT "syllabi_escola_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."turmas_auditoria"
    ADD CONSTRAINT "turmas_auditoria_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."turmas_auditoria"
    ADD CONSTRAINT "turmas_auditoria_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "public"."turmas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."turmas"
    ADD CONSTRAINT "turmas_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."turmas"
    ADD CONSTRAINT "turmas_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."school_sessions"("id") ON DELETE SET NULL;



CREATE POLICY "Allow read access to authenticated users" ON "public"."permissions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow read access to authenticated users" ON "public"."roles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Tenant Isolation" ON "public"."escola_auditoria" USING (("escola_id" = "public"."current_tenant_escola_id"())) WITH CHECK (("escola_id" = "public"."current_tenant_escola_id"()));



CREATE POLICY "Tenant Isolation" ON "public"."escola_configuracoes" USING (("escola_id" = "public"."current_tenant_escola_id"())) WITH CHECK (("escola_id" = "public"."current_tenant_escola_id"()));



CREATE POLICY "Tenant Isolation" ON "public"."escola_members" USING (("escola_id" = "public"."current_tenant_escola_id"())) WITH CHECK (("escola_id" = "public"."current_tenant_escola_id"()));



CREATE POLICY "Tenant Isolation" ON "public"."frequencias" USING (("escola_id" = "public"."current_tenant_escola_id"())) WITH CHECK (("escola_id" = "public"."current_tenant_escola_id"()));



CREATE POLICY "Tenant Isolation" ON "public"."lancamentos" USING (("escola_id" = "public"."current_tenant_escola_id"())) WITH CHECK (("escola_id" = "public"."current_tenant_escola_id"()));



CREATE POLICY "Tenant Isolation" ON "public"."matriculas" USING (("escola_id" = "public"."current_tenant_escola_id"())) WITH CHECK (("escola_id" = "public"."current_tenant_escola_id"()));



CREATE POLICY "Tenant Isolation" ON "public"."notas" USING (("escola_id" = "public"."current_tenant_escola_id"())) WITH CHECK (("escola_id" = "public"."current_tenant_escola_id"()));



CREATE POLICY "Tenant Isolation" ON "public"."pagamentos" USING (("escola_id" = "public"."current_tenant_escola_id"())) WITH CHECK (("escola_id" = "public"."current_tenant_escola_id"()));



CREATE POLICY "Tenant Isolation" ON "public"."periodos_letivos" USING (("escola_id" = "public"."current_tenant_escola_id"())) WITH CHECK (("escola_id" = "public"."current_tenant_escola_id"()));



CREATE POLICY "Tenant Isolation" ON "public"."presencas" USING (("escola_id" = "public"."current_tenant_escola_id"())) WITH CHECK (("escola_id" = "public"."current_tenant_escola_id"()));



CREATE POLICY "Tenant Isolation" ON "public"."professores" USING (("escola_id" = "public"."current_tenant_escola_id"())) WITH CHECK (("escola_id" = "public"."current_tenant_escola_id"()));



CREATE POLICY "Tenant Isolation" ON "public"."school_sessions" USING (("escola_id" = "public"."current_tenant_escola_id"())) WITH CHECK (("escola_id" = "public"."current_tenant_escola_id"()));



CREATE POLICY "Tenant Isolation" ON "public"."secoes" USING (("escola_id" = "public"."current_tenant_escola_id"())) WITH CHECK (("escola_id" = "public"."current_tenant_escola_id"()));



CREATE POLICY "Tenant Isolation" ON "public"."semestres" USING (("escola_id" = "public"."current_tenant_escola_id"())) WITH CHECK (("escola_id" = "public"."current_tenant_escola_id"()));



CREATE POLICY "Tenant Isolation" ON "public"."turmas_auditoria" USING (("escola_id" = "public"."current_tenant_escola_id"())) WITH CHECK (("escola_id" = "public"."current_tenant_escola_id"()));



ALTER TABLE "public"."alunos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "alunos_delete_staff" ON "public"."alunos" FOR DELETE TO "authenticated" USING ("public"."is_staff_escola"("escola_id"));



CREATE POLICY "alunos_insert_staff" ON "public"."alunos" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_staff_escola"("escola_id"));



CREATE POLICY "alunos_select_por_escola_ou_proprio" ON "public"."alunos" FOR SELECT TO "authenticated" USING (("public"."is_staff_escola"("escola_id") OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user_id" = "alunos"."profile_id") AND ("p"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "alunos_update_staff" ON "public"."alunos" FOR UPDATE TO "authenticated" USING ("public"."is_staff_escola"("escola_id")) WITH CHECK ("public"."is_staff_escola"("escola_id"));



ALTER TABLE "public"."atribuicoes_prof" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_logs_insert_authenticated" ON "public"."audit_logs" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL));



CREATE POLICY "audit_logs_select_by_scope" ON "public"."audit_logs" FOR SELECT TO "authenticated" USING ((("public"."current_user_role"() = 'super_admin'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."escola_usuarios" "eu"
  WHERE (("eu"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("eu"."escola_id" = "audit_logs"."escola_id") OR ("audit_logs"."escola_id" IS NULL)))))));



ALTER TABLE "public"."avaliacoes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."classes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "classes_delete_staff" ON "public"."classes" FOR DELETE TO "authenticated" USING ("public"."is_staff_escola"("escola_id"));



CREATE POLICY "classes_insert_staff" ON "public"."classes" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_staff_escola"("escola_id"));



CREATE POLICY "classes_select_membro" ON "public"."classes" FOR SELECT TO "authenticated" USING ("public"."is_membro_escola"("escola_id"));



CREATE POLICY "classes_update_staff" ON "public"."classes" FOR UPDATE TO "authenticated" USING ("public"."is_staff_escola"("escola_id")) WITH CHECK ("public"."is_staff_escola"("escola_id"));



ALTER TABLE "public"."configuracoes_escola" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cursos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cursos_oferta" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."escola_administradores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."escola_auditoria" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."escola_configuracoes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."escola_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."escola_usuarios" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."escolas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."frequencias" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."frequencias_2025_09" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."frequencias_2025_10" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."frequencias_2025_11" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."frequencias_2025_12" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."frequencias_default" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inserir alunos por membro da escola" ON "public"."alunos" FOR INSERT TO "authenticated" WITH CHECK ("public"."can_access"("escola_id"));



ALTER TABLE "public"."lancamentos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lancamentos_2025_09" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lancamentos_2025_10" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lancamentos_2025_11" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lancamentos_2025_12" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lancamentos_default" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."matriculas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."matriculas_cursos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "matriculas_delete_staff" ON "public"."matriculas" FOR DELETE TO "authenticated" USING (("public"."is_staff_escola"("escola_id") AND ("escola_id" = "public"."current_tenant_escola_id"())));



CREATE POLICY "matriculas_insert_staff" ON "public"."matriculas" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_staff_escola"("escola_id") AND ("escola_id" = "public"."current_tenant_escola_id"())));



CREATE POLICY "matriculas_select_membro" ON "public"."matriculas" FOR SELECT TO "authenticated" USING (("public"."is_membro_escola"("escola_id") AND ("escola_id" = "public"."current_tenant_escola_id"())));



CREATE POLICY "matriculas_update_staff" ON "public"."matriculas" FOR UPDATE TO "authenticated" USING (("public"."is_staff_escola"("escola_id") AND ("escola_id" = "public"."current_tenant_escola_id"()))) WITH CHECK (("public"."is_staff_escola"("escola_id") AND ("escola_id" = "public"."current_tenant_escola_id"())));



ALTER TABLE "public"."notas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."onboarding_drafts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "onboarding_drafts_select_own" ON "public"."onboarding_drafts" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "onboarding_drafts_upsert_own" ON "public"."onboarding_drafts" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."pagamentos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."periodos_letivos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."presencas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."professores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."regras_escala" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rotinas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."school_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."secoes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."semestres" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sistemas_notas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."syllabi" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenant_isolation" ON "public"."atribuicoes_prof" USING (("escola_id" = "public"."current_tenant_escola_id"())) WITH CHECK (("escola_id" = "public"."current_tenant_escola_id"()));



CREATE POLICY "tenant_isolation" ON "public"."avaliacoes" USING (("escola_id" = "public"."current_tenant_escola_id"())) WITH CHECK (("escola_id" = "public"."current_tenant_escola_id"()));



CREATE POLICY "tenant_isolation" ON "public"."configuracoes_escola" USING (("escola_id" = "public"."current_tenant_escola_id"())) WITH CHECK (("escola_id" = "public"."current_tenant_escola_id"()));



CREATE POLICY "tenant_isolation" ON "public"."cursos" USING (("escola_id" = "public"."current_tenant_escola_id"())) WITH CHECK (("escola_id" = "public"."current_tenant_escola_id"()));



CREATE POLICY "tenant_isolation" ON "public"."cursos_oferta" USING (("escola_id" = "public"."current_tenant_escola_id"())) WITH CHECK (("escola_id" = "public"."current_tenant_escola_id"()));



CREATE POLICY "tenant_isolation" ON "public"."events" USING (("escola_id" = "public"."current_tenant_escola_id"())) WITH CHECK (("escola_id" = "public"."current_tenant_escola_id"()));



CREATE POLICY "tenant_isolation" ON "public"."frequencias" USING (("escola_id" = "public"."current_tenant_escola_id"())) WITH CHECK (("escola_id" = "public"."current_tenant_escola_id"()));



CREATE POLICY "tenant_isolation" ON "public"."lancamentos" USING (("escola_id" = "public"."current_tenant_escola_id"())) WITH CHECK (("escola_id" = "public"."current_tenant_escola_id"()));



CREATE POLICY "tenant_isolation" ON "public"."matriculas_cursos" USING (("escola_id" = "public"."current_tenant_escola_id"())) WITH CHECK (("escola_id" = "public"."current_tenant_escola_id"()));



CREATE POLICY "tenant_isolation" ON "public"."notices" USING (("escola_id" = "public"."current_tenant_escola_id"())) WITH CHECK (("escola_id" = "public"."current_tenant_escola_id"()));



CREATE POLICY "tenant_isolation" ON "public"."regras_escala" USING (("escola_id" = "public"."current_tenant_escola_id"())) WITH CHECK (("escola_id" = "public"."current_tenant_escola_id"()));



CREATE POLICY "tenant_isolation" ON "public"."rotinas" USING (("escola_id" = "public"."current_tenant_escola_id"())) WITH CHECK (("escola_id" = "public"."current_tenant_escola_id"()));



CREATE POLICY "tenant_isolation" ON "public"."sistemas_notas" USING (("escola_id" = "public"."current_tenant_escola_id"())) WITH CHECK (("escola_id" = "public"."current_tenant_escola_id"()));



CREATE POLICY "tenant_isolation" ON "public"."syllabi" USING (("escola_id" = "public"."current_tenant_escola_id"())) WITH CHECK (("escola_id" = "public"."current_tenant_escola_id"()));



ALTER TABLE "public"."turmas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."turmas_auditoria" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "turmas_delete_staff" ON "public"."turmas" FOR DELETE TO "authenticated" USING ("public"."is_staff_escola"("escola_id"));



CREATE POLICY "turmas_insert_staff" ON "public"."turmas" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_staff_escola"("escola_id"));



CREATE POLICY "turmas_select_membro" ON "public"."turmas" FOR SELECT TO "authenticated" USING ("public"."is_membro_escola"("escola_id"));



CREATE POLICY "turmas_update_staff" ON "public"."turmas" FOR UPDATE TO "authenticated" USING ("public"."is_staff_escola"("escola_id")) WITH CHECK ("public"."is_staff_escola"("escola_id"));



CREATE POLICY "unified_delete_escola_administradores" ON "public"."escola_administradores" FOR DELETE USING ("public"."check_super_admin_role"());



CREATE POLICY "unified_delete_escola_usuarios" ON "public"."escola_usuarios" FOR DELETE USING (("public"."check_super_admin_role"() OR "public"."is_escola_admin"("escola_id")));



CREATE POLICY "unified_delete_escolas" ON "public"."escolas" FOR DELETE USING ("public"."check_super_admin_role"());



CREATE POLICY "unified_delete_frequencias" ON "public"."frequencias_2025_09" FOR DELETE USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_delete_frequencias" ON "public"."frequencias_2025_10" FOR DELETE USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_delete_frequencias" ON "public"."frequencias_2025_11" FOR DELETE USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_delete_frequencias" ON "public"."frequencias_2025_12" FOR DELETE USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_delete_frequencias" ON "public"."frequencias_default" FOR DELETE USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_delete_lancamentos" ON "public"."lancamentos_2025_09" FOR DELETE USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_delete_lancamentos" ON "public"."lancamentos_2025_10" FOR DELETE USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_delete_lancamentos" ON "public"."lancamentos_2025_11" FOR DELETE USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_delete_lancamentos" ON "public"."lancamentos_2025_12" FOR DELETE USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_delete_lancamentos" ON "public"."lancamentos_default" FOR DELETE USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_insert_escola_administradores" ON "public"."escola_administradores" FOR INSERT WITH CHECK ("public"."check_super_admin_role"());



CREATE POLICY "unified_insert_escola_usuarios" ON "public"."escola_usuarios" FOR INSERT WITH CHECK (("public"."check_super_admin_role"() OR "public"."is_escola_admin"("escola_id")));



CREATE POLICY "unified_insert_escolas" ON "public"."escolas" FOR INSERT WITH CHECK ("public"."check_super_admin_role"());



CREATE POLICY "unified_insert_frequencias" ON "public"."frequencias_2025_09" FOR INSERT WITH CHECK (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_insert_frequencias" ON "public"."frequencias_2025_10" FOR INSERT WITH CHECK (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_insert_frequencias" ON "public"."frequencias_2025_11" FOR INSERT WITH CHECK (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_insert_frequencias" ON "public"."frequencias_2025_12" FOR INSERT WITH CHECK (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_insert_frequencias" ON "public"."frequencias_default" FOR INSERT WITH CHECK (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_insert_lancamentos" ON "public"."lancamentos_2025_09" FOR INSERT WITH CHECK (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_insert_lancamentos" ON "public"."lancamentos_2025_10" FOR INSERT WITH CHECK (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_insert_lancamentos" ON "public"."lancamentos_2025_11" FOR INSERT WITH CHECK (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_insert_lancamentos" ON "public"."lancamentos_2025_12" FOR INSERT WITH CHECK (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_insert_lancamentos" ON "public"."lancamentos_default" FOR INSERT WITH CHECK (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_select_escola_administradores" ON "public"."escola_administradores" FOR SELECT USING ("public"."check_super_admin_role"());



CREATE POLICY "unified_select_escola_usuarios" ON "public"."escola_usuarios" FOR SELECT USING (("public"."check_super_admin_role"() OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_select_escolas" ON "public"."escolas" FOR SELECT USING ("public"."check_super_admin_role"());



CREATE POLICY "unified_select_frequencias" ON "public"."frequencias_2025_09" FOR SELECT USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_select_frequencias" ON "public"."frequencias_2025_10" FOR SELECT USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_select_frequencias" ON "public"."frequencias_2025_11" FOR SELECT USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_select_frequencias" ON "public"."frequencias_2025_12" FOR SELECT USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_select_frequencias" ON "public"."frequencias_default" FOR SELECT USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_select_lancamentos" ON "public"."lancamentos_2025_09" FOR SELECT USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_select_lancamentos" ON "public"."lancamentos_2025_10" FOR SELECT USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_select_lancamentos" ON "public"."lancamentos_2025_11" FOR SELECT USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_select_lancamentos" ON "public"."lancamentos_2025_12" FOR SELECT USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_select_lancamentos" ON "public"."lancamentos_default" FOR SELECT USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_select_onboarding_drafts" ON "public"."onboarding_drafts" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "unified_select_profiles" ON "public"."profiles" FOR SELECT USING (("public"."check_super_admin_role"() OR (( SELECT "auth"."uid"() AS "uid") = "user_id")));



CREATE POLICY "unified_update_escola_administradores" ON "public"."escola_administradores" FOR UPDATE USING ("public"."check_super_admin_role"()) WITH CHECK ("public"."check_super_admin_role"());



CREATE POLICY "unified_update_escola_usuarios" ON "public"."escola_usuarios" FOR UPDATE USING (("public"."check_super_admin_role"() OR "public"."is_escola_admin"("escola_id"))) WITH CHECK (("public"."check_super_admin_role"() OR "public"."is_escola_admin"("escola_id")));



CREATE POLICY "unified_update_escolas" ON "public"."escolas" FOR UPDATE USING ("public"."check_super_admin_role"()) WITH CHECK ("public"."check_super_admin_role"());



CREATE POLICY "unified_update_frequencias" ON "public"."frequencias_2025_09" FOR UPDATE USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id"))) WITH CHECK (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_update_frequencias" ON "public"."frequencias_2025_10" FOR UPDATE USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id"))) WITH CHECK (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_update_frequencias" ON "public"."frequencias_2025_11" FOR UPDATE USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id"))) WITH CHECK (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_update_frequencias" ON "public"."frequencias_2025_12" FOR UPDATE USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id"))) WITH CHECK (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_update_frequencias" ON "public"."frequencias_default" FOR UPDATE USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id"))) WITH CHECK (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_update_lancamentos" ON "public"."lancamentos_2025_09" FOR UPDATE USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id"))) WITH CHECK (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_update_lancamentos" ON "public"."lancamentos_2025_10" FOR UPDATE USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id"))) WITH CHECK (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_update_lancamentos" ON "public"."lancamentos_2025_11" FOR UPDATE USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id"))) WITH CHECK (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_update_lancamentos" ON "public"."lancamentos_2025_12" FOR UPDATE USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id"))) WITH CHECK (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_update_lancamentos" ON "public"."lancamentos_default" FOR UPDATE USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id"))) WITH CHECK (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_update_profiles" ON "public"."profiles" FOR UPDATE USING (("public"."check_super_admin_role"() OR (( SELECT "auth"."uid"() AS "uid") = "user_id"))) WITH CHECK (("public"."check_super_admin_role"() OR (( SELECT "auth"."uid"() AS "uid") = "user_id")));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";









GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";




































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































GRANT ALL ON FUNCTION "public"."_each_month"("start_date" "date", "end_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."_each_month"("start_date" "date", "end_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_each_month"("start_date" "date", "end_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."audit_dml_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."audit_dml_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."audit_dml_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."can_access"("eid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_access"("eid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_access"("eid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_super_admin_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_super_admin_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_super_admin_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_escola_with_admin"("p_nome" "text", "p_nif" "text", "p_endereco" "text", "p_admin_email" "text", "p_admin_telefone" "text", "p_admin_nome" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_escola_with_admin"("p_nome" "text", "p_nif" "text", "p_endereco" "text", "p_admin_email" "text", "p_admin_telefone" "text", "p_admin_nome" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_escola_with_admin"("p_nome" "text", "p_nif" "text", "p_endereco" "text", "p_admin_email" "text", "p_admin_telefone" "text", "p_admin_nome" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_month_partition"("tbl" "text", "month_start" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."create_month_partition"("tbl" "text", "month_start" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_month_partition"("tbl" "text", "month_start" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_month_partition_ts"("tbl" "text", "month_start" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."create_month_partition_ts"("tbl" "text", "month_start" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_month_partition_ts"("tbl" "text", "month_start" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."current_tenant_escola_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_tenant_escola_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_tenant_escola_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."current_user_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_user_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_user_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."dashboard"() TO "anon";
GRANT ALL ON FUNCTION "public"."dashboard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."dashboard"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_matricula_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_matricula_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_matricula_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_unique_numero_login"("p_escola_id" "uuid", "p_role" "public"."user_role", "p_prefix" "text", "p_start" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."generate_unique_numero_login"("p_escola_id" "uuid", "p_role" "public"."user_role", "p_prefix" "text", "p_start" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_unique_numero_login"("p_escola_id" "uuid", "p_role" "public"."user_role", "p_prefix" "text", "p_start" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_profile_dependencies"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_profile_dependencies"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_profile_dependencies"("p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_user_escola_id"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_user_escola_id"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_user_escola_id"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_user_escola_id"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_escola_id"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_escola_id"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_export_json"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_export_json"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_export_json"("p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_user_tenant"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_user_tenant"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_escola_admin"("p_escola_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_escola_admin"("p_escola_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_escola_admin"("p_escola_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_escola_diretor"("p_escola_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_escola_diretor"("p_escola_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_escola_diretor"("p_escola_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_escola_member"("p_escola_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_escola_member"("p_escola_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_escola_member"("p_escola_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_membro_escola"("escola_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_membro_escola"("escola_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_membro_escola"("escola_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_staff_escola"("escola_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_staff_escola"("escola_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_staff_escola"("escola_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_super_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_super_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_super_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_audit_event"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_audit_event"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_audit_event"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_disciplina_auditoria"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_disciplina_auditoria"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_disciplina_auditoria"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_escola_auditoria"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_escola_auditoria"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_escola_auditoria"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_turma_auditoria"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_turma_auditoria"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_turma_auditoria"() TO "service_role";



GRANT ALL ON FUNCTION "public"."move_profile_to_archive"("p_user_id" "uuid", "p_performed_by" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."move_profile_to_archive"("p_user_id" "uuid", "p_performed_by" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."move_profile_to_archive"("p_user_id" "uuid", "p_performed_by" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."partitions_info"() TO "anon";
GRANT ALL ON FUNCTION "public"."partitions_info"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."partitions_info"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_all_materialized_views"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_all_materialized_views"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_all_materialized_views"() TO "service_role";



GRANT ALL ON FUNCTION "public"."secretaria_audit_by_aluno_matricula"("p_aluno_id" "uuid", "p_matricula_id" "uuid", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."secretaria_audit_by_aluno_matricula"("p_aluno_id" "uuid", "p_matricula_id" "uuid", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."secretaria_audit_by_aluno_matricula"("p_aluno_id" "uuid", "p_matricula_id" "uuid", "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_set_escola_atribuicoes_prof"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_set_escola_atribuicoes_prof"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_set_escola_atribuicoes_prof"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_set_escola_avaliacoes"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_set_escola_avaliacoes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_set_escola_avaliacoes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_set_escola_cursos_oferta"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_set_escola_cursos_oferta"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_set_escola_cursos_oferta"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_set_escola_frequencias"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_set_escola_frequencias"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_set_escola_frequencias"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_set_escola_lancamentos"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_set_escola_lancamentos"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_set_escola_lancamentos"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_set_escola_matriculas_cursos"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_set_escola_matriculas_cursos"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_set_escola_matriculas_cursos"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_set_escola_regras_escala"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_set_escola_regras_escala"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_set_escola_regras_escala"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_set_escola_rotinas"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_set_escola_rotinas"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_set_escola_rotinas"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_set_escola_sistemas_notas"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_set_escola_sistemas_notas"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_set_escola_sistemas_notas"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_set_escola_syllabi"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_set_escola_syllabi"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_set_escola_syllabi"() TO "service_role";
























GRANT ALL ON TABLE "public"."alunos" TO "anon";
GRANT ALL ON TABLE "public"."alunos" TO "authenticated";
GRANT ALL ON TABLE "public"."alunos" TO "service_role";



GRANT ALL ON TABLE "public"."atribuicoes_prof" TO "anon";
GRANT ALL ON TABLE "public"."atribuicoes_prof" TO "authenticated";
GRANT ALL ON TABLE "public"."atribuicoes_prof" TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";
GRANT SELECT,INSERT ON TABLE "public"."audit_logs" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."audit_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."audit_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."audit_logs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."avaliacoes" TO "anon";
GRANT ALL ON TABLE "public"."avaliacoes" TO "authenticated";
GRANT ALL ON TABLE "public"."avaliacoes" TO "service_role";



GRANT ALL ON TABLE "public"."classes" TO "anon";
GRANT ALL ON TABLE "public"."classes" TO "authenticated";
GRANT ALL ON TABLE "public"."classes" TO "service_role";



GRANT ALL ON TABLE "public"."configuracoes_escola" TO "anon";
GRANT ALL ON TABLE "public"."configuracoes_escola" TO "authenticated";
GRANT ALL ON TABLE "public"."configuracoes_escola" TO "service_role";



GRANT ALL ON TABLE "public"."cursos" TO "anon";
GRANT ALL ON TABLE "public"."cursos" TO "authenticated";
GRANT ALL ON TABLE "public"."cursos" TO "service_role";



GRANT ALL ON TABLE "public"."cursos_oferta" TO "anon";
GRANT ALL ON TABLE "public"."cursos_oferta" TO "authenticated";
GRANT ALL ON TABLE "public"."cursos_oferta" TO "service_role";



GRANT ALL ON TABLE "public"."escola_administradores" TO "anon";
GRANT ALL ON TABLE "public"."escola_administradores" TO "authenticated";
GRANT ALL ON TABLE "public"."escola_administradores" TO "service_role";



GRANT ALL ON TABLE "public"."escola_auditoria" TO "anon";
GRANT ALL ON TABLE "public"."escola_auditoria" TO "authenticated";
GRANT ALL ON TABLE "public"."escola_auditoria" TO "service_role";



GRANT ALL ON TABLE "public"."escola_configuracoes" TO "anon";
GRANT ALL ON TABLE "public"."escola_configuracoes" TO "authenticated";
GRANT ALL ON TABLE "public"."escola_configuracoes" TO "service_role";



GRANT ALL ON TABLE "public"."escola_members" TO "anon";
GRANT ALL ON TABLE "public"."escola_members" TO "authenticated";
GRANT ALL ON TABLE "public"."escola_members" TO "service_role";



GRANT ALL ON TABLE "public"."escola_usuarios" TO "anon";
GRANT ALL ON TABLE "public"."escola_usuarios" TO "authenticated";
GRANT ALL ON TABLE "public"."escola_usuarios" TO "service_role";



GRANT ALL ON TABLE "public"."escolas" TO "anon";
GRANT ALL ON TABLE "public"."escolas" TO "authenticated";
GRANT ALL ON TABLE "public"."escolas" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."escolas_view" TO "anon";
GRANT ALL ON TABLE "public"."escolas_view" TO "authenticated";
GRANT ALL ON TABLE "public"."escolas_view" TO "service_role";



GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON TABLE "public"."frequencias" TO "anon";
GRANT ALL ON TABLE "public"."frequencias" TO "authenticated";
GRANT ALL ON TABLE "public"."frequencias" TO "service_role";



GRANT ALL ON TABLE "public"."frequencias_2025_09" TO "anon";
GRANT ALL ON TABLE "public"."frequencias_2025_09" TO "authenticated";
GRANT ALL ON TABLE "public"."frequencias_2025_09" TO "service_role";



GRANT ALL ON TABLE "public"."frequencias_2025_10" TO "anon";
GRANT ALL ON TABLE "public"."frequencias_2025_10" TO "authenticated";
GRANT ALL ON TABLE "public"."frequencias_2025_10" TO "service_role";



GRANT ALL ON TABLE "public"."frequencias_2025_11" TO "anon";
GRANT ALL ON TABLE "public"."frequencias_2025_11" TO "authenticated";
GRANT ALL ON TABLE "public"."frequencias_2025_11" TO "service_role";



GRANT ALL ON TABLE "public"."frequencias_2025_12" TO "anon";
GRANT ALL ON TABLE "public"."frequencias_2025_12" TO "authenticated";
GRANT ALL ON TABLE "public"."frequencias_2025_12" TO "service_role";



GRANT ALL ON TABLE "public"."frequencias_default" TO "anon";
GRANT ALL ON TABLE "public"."frequencias_default" TO "authenticated";
GRANT ALL ON TABLE "public"."frequencias_default" TO "service_role";



GRANT ALL ON TABLE "public"."lancamentos" TO "anon";
GRANT ALL ON TABLE "public"."lancamentos" TO "authenticated";
GRANT ALL ON TABLE "public"."lancamentos" TO "service_role";



GRANT ALL ON TABLE "public"."lancamentos_2025_09" TO "anon";
GRANT ALL ON TABLE "public"."lancamentos_2025_09" TO "authenticated";
GRANT ALL ON TABLE "public"."lancamentos_2025_09" TO "service_role";



GRANT ALL ON TABLE "public"."lancamentos_2025_10" TO "anon";
GRANT ALL ON TABLE "public"."lancamentos_2025_10" TO "authenticated";
GRANT ALL ON TABLE "public"."lancamentos_2025_10" TO "service_role";



GRANT ALL ON TABLE "public"."lancamentos_2025_11" TO "anon";
GRANT ALL ON TABLE "public"."lancamentos_2025_11" TO "authenticated";
GRANT ALL ON TABLE "public"."lancamentos_2025_11" TO "service_role";



GRANT ALL ON TABLE "public"."lancamentos_2025_12" TO "anon";
GRANT ALL ON TABLE "public"."lancamentos_2025_12" TO "authenticated";
GRANT ALL ON TABLE "public"."lancamentos_2025_12" TO "service_role";



GRANT ALL ON TABLE "public"."lancamentos_default" TO "anon";
GRANT ALL ON TABLE "public"."lancamentos_default" TO "authenticated";
GRANT ALL ON TABLE "public"."lancamentos_default" TO "service_role";



GRANT ALL ON SEQUENCE "public"."matricula_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."matricula_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."matricula_seq" TO "service_role";



GRANT ALL ON TABLE "public"."matriculas" TO "anon";
GRANT ALL ON TABLE "public"."matriculas" TO "authenticated";
GRANT ALL ON TABLE "public"."matriculas" TO "service_role";



GRANT ALL ON TABLE "public"."matriculas_cursos" TO "anon";
GRANT ALL ON TABLE "public"."matriculas_cursos" TO "authenticated";
GRANT ALL ON TABLE "public"."matriculas_cursos" TO "service_role";



GRANT ALL ON TABLE "public"."matriculas_por_ano" TO "anon";
GRANT ALL ON TABLE "public"."matriculas_por_ano" TO "authenticated";
GRANT ALL ON TABLE "public"."matriculas_por_ano" TO "service_role";



GRANT ALL ON TABLE "public"."pagamentos" TO "anon";
GRANT ALL ON TABLE "public"."pagamentos" TO "authenticated";
GRANT ALL ON TABLE "public"."pagamentos" TO "service_role";



GRANT ALL ON TABLE "public"."mv_financeiro_escola_dia" TO "service_role";



GRANT ALL ON TABLE "public"."mv_freq_por_turma_dia" TO "service_role";



GRANT ALL ON TABLE "public"."mv_media_por_curso" TO "service_role";



GRANT ALL ON TABLE "public"."notas" TO "anon";
GRANT ALL ON TABLE "public"."notas" TO "authenticated";
GRANT ALL ON TABLE "public"."notas" TO "service_role";



GRANT ALL ON TABLE "public"."notices" TO "anon";
GRANT ALL ON TABLE "public"."notices" TO "authenticated";
GRANT ALL ON TABLE "public"."notices" TO "service_role";



GRANT ALL ON TABLE "public"."onboarding_drafts" TO "anon";
GRANT ALL ON TABLE "public"."onboarding_drafts" TO "authenticated";
GRANT ALL ON TABLE "public"."onboarding_drafts" TO "service_role";



GRANT ALL ON TABLE "public"."pagamentos_status" TO "anon";
GRANT ALL ON TABLE "public"."pagamentos_status" TO "authenticated";
GRANT ALL ON TABLE "public"."pagamentos_status" TO "service_role";



GRANT ALL ON TABLE "public"."semestres" TO "anon";
GRANT ALL ON TABLE "public"."semestres" TO "authenticated";
GRANT ALL ON TABLE "public"."semestres" TO "service_role";



GRANT ALL ON TABLE "public"."periodos" TO "anon";
GRANT ALL ON TABLE "public"."periodos" TO "authenticated";
GRANT ALL ON TABLE "public"."periodos" TO "service_role";



GRANT ALL ON TABLE "public"."periodos_letivos" TO "anon";
GRANT ALL ON TABLE "public"."periodos_letivos" TO "authenticated";
GRANT ALL ON TABLE "public"."periodos_letivos" TO "service_role";



GRANT ALL ON TABLE "public"."permissions" TO "anon";
GRANT ALL ON TABLE "public"."permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."permissions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."permissions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."permissions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."permissions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."presencas" TO "anon";
GRANT ALL ON TABLE "public"."presencas" TO "authenticated";
GRANT ALL ON TABLE "public"."presencas" TO "service_role";



GRANT ALL ON TABLE "public"."professores" TO "anon";
GRANT ALL ON TABLE "public"."professores" TO "authenticated";
GRANT ALL ON TABLE "public"."professores" TO "service_role";



GRANT ALL ON TABLE "public"."profiles_archive" TO "anon";
GRANT ALL ON TABLE "public"."profiles_archive" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles_archive" TO "service_role";



GRANT ALL ON TABLE "public"."regras_escala" TO "anon";
GRANT ALL ON TABLE "public"."regras_escala" TO "authenticated";
GRANT ALL ON TABLE "public"."regras_escala" TO "service_role";



GRANT ALL ON TABLE "public"."roles" TO "anon";
GRANT ALL ON TABLE "public"."roles" TO "authenticated";
GRANT ALL ON TABLE "public"."roles" TO "service_role";



GRANT ALL ON SEQUENCE "public"."roles_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."roles_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."roles_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."rotinas" TO "anon";
GRANT ALL ON TABLE "public"."rotinas" TO "authenticated";
GRANT ALL ON TABLE "public"."rotinas" TO "service_role";



GRANT ALL ON TABLE "public"."school_sessions" TO "anon";
GRANT ALL ON TABLE "public"."school_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."school_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."secoes" TO "anon";
GRANT ALL ON TABLE "public"."secoes" TO "authenticated";
GRANT ALL ON TABLE "public"."secoes" TO "service_role";



GRANT ALL ON TABLE "public"."secretaria_audit_feed" TO "anon";
GRANT ALL ON TABLE "public"."secretaria_audit_feed" TO "authenticated";
GRANT ALL ON TABLE "public"."secretaria_audit_feed" TO "service_role";



GRANT ALL ON TABLE "public"."sistemas_notas" TO "anon";
GRANT ALL ON TABLE "public"."sistemas_notas" TO "authenticated";
GRANT ALL ON TABLE "public"."sistemas_notas" TO "service_role";



GRANT ALL ON TABLE "public"."syllabi" TO "anon";
GRANT ALL ON TABLE "public"."syllabi" TO "authenticated";
GRANT ALL ON TABLE "public"."syllabi" TO "service_role";



GRANT ALL ON TABLE "public"."turmas" TO "anon";
GRANT ALL ON TABLE "public"."turmas" TO "authenticated";
GRANT ALL ON TABLE "public"."turmas" TO "service_role";



GRANT ALL ON TABLE "public"."turmas_auditoria" TO "anon";
GRANT ALL ON TABLE "public"."turmas_auditoria" TO "authenticated";
GRANT ALL ON TABLE "public"."turmas_auditoria" TO "service_role";



GRANT ALL ON TABLE "public"."v_financeiro_escola_dia" TO "anon";
GRANT ALL ON TABLE "public"."v_financeiro_escola_dia" TO "authenticated";
GRANT ALL ON TABLE "public"."v_financeiro_escola_dia" TO "service_role";



GRANT ALL ON TABLE "public"."v_freq_por_turma_dia" TO "anon";
GRANT ALL ON TABLE "public"."v_freq_por_turma_dia" TO "authenticated";
GRANT ALL ON TABLE "public"."v_freq_por_turma_dia" TO "service_role";



GRANT ALL ON TABLE "public"."v_media_por_curso" TO "anon";
GRANT ALL ON TABLE "public"."v_media_por_curso" TO "authenticated";
GRANT ALL ON TABLE "public"."v_media_por_curso" TO "service_role";



GRANT ALL ON TABLE "public"."v_top_cursos_media" TO "anon";
GRANT ALL ON TABLE "public"."v_top_cursos_media" TO "authenticated";
GRANT ALL ON TABLE "public"."v_top_cursos_media" TO "service_role";



GRANT ALL ON TABLE "public"."v_top_turmas_hoje" TO "anon";
GRANT ALL ON TABLE "public"."v_top_turmas_hoje" TO "authenticated";
GRANT ALL ON TABLE "public"."v_top_turmas_hoje" TO "service_role";



GRANT ALL ON TABLE "public"."vw_radar_inadimplencia" TO "anon";
GRANT ALL ON TABLE "public"."vw_radar_inadimplencia" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_radar_inadimplencia" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































