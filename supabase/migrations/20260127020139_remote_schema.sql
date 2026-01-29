


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






CREATE SCHEMA IF NOT EXISTS "financeiro";


ALTER SCHEMA "financeiro" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "internal";


ALTER SCHEMA "internal" OWNER TO "postgres";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "btree_gin" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "btree_gist" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."app_plan_tier" AS ENUM (
    'essencial',
    'profissional',
    'premium'
);


ALTER TYPE "public"."app_plan_tier" OWNER TO "postgres";


CREATE TYPE "public"."cobranca_status" AS ENUM (
    'enviada',
    'entregue',
    'respondida',
    'paga',
    'falha'
);


ALTER TYPE "public"."cobranca_status" OWNER TO "postgres";


CREATE TYPE "public"."curriculo_status" AS ENUM (
    'draft',
    'published',
    'archived'
);


ALTER TYPE "public"."curriculo_status" OWNER TO "postgres";


CREATE TYPE "public"."curso_update" AS (
	"id" "uuid",
	"nome" "text",
	"status_aprovacao" "text"
);


ALTER TYPE "public"."curso_update" OWNER TO "postgres";


CREATE TYPE "public"."financeiro_categoria_item" AS ENUM (
    'uniforme',
    'documento',
    'material',
    'transporte',
    'outros',
    'servico'
);


ALTER TYPE "public"."financeiro_categoria_item" OWNER TO "postgres";


CREATE TYPE "public"."financeiro_origem" AS ENUM (
    'mensalidade',
    'matricula',
    'venda_avulsa',
    'multa',
    'taxa_extra'
);


ALTER TYPE "public"."financeiro_origem" OWNER TO "postgres";


CREATE TYPE "public"."financeiro_status" AS ENUM (
    'pendente',
    'pago',
    'parcial',
    'vencido',
    'cancelado'
);


ALTER TYPE "public"."financeiro_status" OWNER TO "postgres";


CREATE TYPE "public"."financeiro_tipo_transacao" AS ENUM (
    'debito',
    'credito'
);


ALTER TYPE "public"."financeiro_tipo_transacao" OWNER TO "postgres";


CREATE TYPE "public"."mensalidade_status" AS ENUM (
    'pendente',
    'pago_parcial',
    'pago',
    'isento',
    'cancelado'
);


ALTER TYPE "public"."mensalidade_status" OWNER TO "postgres";


CREATE TYPE "public"."metodo_pagamento_enum" AS ENUM (
    'numerario',
    'multicaixa',
    'transferencia',
    'deposito'
);


ALTER TYPE "public"."metodo_pagamento_enum" OWNER TO "postgres";


CREATE TYPE "public"."outbox_status" AS ENUM (
    'pending',
    'processing',
    'sent',
    'failed',
    'dead'
);


ALTER TYPE "public"."outbox_status" OWNER TO "postgres";


CREATE TYPE "public"."periodo_tipo" AS ENUM (
    'SEMESTRE',
    'TRIMESTRE',
    'BIMESTRE'
);


ALTER TYPE "public"."periodo_tipo" OWNER TO "postgres";


CREATE TYPE "public"."tipo_documento" AS ENUM (
    'recibo',
    'declaracao',
    'certificado',
    'historico',
    'declaracao_frequencia',
    'declaracao_notas'
);


ALTER TYPE "public"."tipo_documento" OWNER TO "postgres";


CREATE TYPE "public"."turma_update" AS (
	"id" "uuid",
	"nome" "text",
	"curso_id" "uuid",
	"classe_id" "uuid",
	"turno" "text",
	"status_validacao" "text"
);


ALTER TYPE "public"."turma_update" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'super_admin',
    'global_admin',
    'admin',
    'professor',
    'aluno',
    'secretaria',
    'financeiro',
    'encarregado'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "financeiro"."gerar_carnet_anual"("p_matricula_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_matricula record;
  v_turma record;
  v_data_inicio date;
  v_data_fim date;
  v_valor numeric;
  v_dia_vencimento integer;
  v_total integer := 0;
begin
  select m.id, m.escola_id, m.aluno_id, m.turma_id, m.ano_letivo, m.status
    into v_matricula
  from public.matriculas m
  where m.id = p_matricula_id;

  if v_matricula.id is null then
    raise exception 'Matrícula não encontrada.';
  end if;

  select t.curso_id, t.classe_id
    into v_turma
  from public.turmas t
  where t.id = v_matricula.turma_id;

  if v_turma.curso_id is null and v_turma.classe_id is null then
    raise exception 'Turma não encontrada para matrícula.';
  end if;

  select al.data_inicio, al.data_fim
    into v_data_inicio, v_data_fim
  from public.anos_letivos al
  where al.escola_id = v_matricula.escola_id
    and al.ano = v_matricula.ano_letivo
  limit 1;

  if v_data_inicio is null or v_data_fim is null then
    v_data_inicio := make_date(v_matricula.ano_letivo, 1, 1);
    v_data_fim := make_date(v_matricula.ano_letivo, 12, 31);
  end if;

  with regras as (
    select
      ft.escola_id,
      ft.ano_letivo,
      ft.curso_id,
      ft.classe_id,
      ft.valor_mensalidade,
      ft.dia_vencimento,
      1 as prioridade
    from public.financeiro_tabelas ft
    union all
    select escola_id, ano_letivo, curso_id, null, valor_mensalidade, dia_vencimento, 2
    from public.financeiro_tabelas
    where classe_id is null
    union all
    select escola_id, ano_letivo, null, classe_id, valor_mensalidade, dia_vencimento, 3
    from public.financeiro_tabelas
    where curso_id is null
    union all
    select escola_id, ano_letivo, null, null, valor_mensalidade, dia_vencimento, 4
    from public.financeiro_tabelas
  )
  select
    coalesce(
      (select valor_mensalidade from regras r
       where r.escola_id = v_matricula.escola_id
         and r.ano_letivo = v_matricula.ano_letivo
         and r.curso_id = v_turma.curso_id
         and r.classe_id = v_turma.classe_id
       order by prioridade limit 1),
      (select valor_mensalidade from regras r
       where r.escola_id = v_matricula.escola_id
         and r.ano_letivo = v_matricula.ano_letivo
         and r.curso_id = v_turma.curso_id
         and r.classe_id is null
       order by prioridade limit 1),
      (select valor_mensalidade from regras r
       where r.escola_id = v_matricula.escola_id
         and r.ano_letivo = v_matricula.ano_letivo
         and r.curso_id is null
         and r.classe_id = v_turma.classe_id
       order by prioridade limit 1),
      (select valor_mensalidade from regras r
       where r.escola_id = v_matricula.escola_id
         and r.ano_letivo = v_matricula.ano_letivo
         and r.curso_id is null
         and r.classe_id is null
       order by prioridade limit 1),
      0
    ),
    coalesce(
      (select dia_vencimento from regras r
       where r.escola_id = v_matricula.escola_id
         and r.ano_letivo = v_matricula.ano_letivo
         and r.curso_id = v_turma.curso_id
         and r.classe_id = v_turma.classe_id
       order by prioridade limit 1),
      (select dia_vencimento from regras r
       where r.escola_id = v_matricula.escola_id
         and r.ano_letivo = v_matricula.ano_letivo
         and r.curso_id = v_turma.curso_id
         and r.classe_id is null
       order by prioridade limit 1),
      (select dia_vencimento from regras r
       where r.escola_id = v_matricula.escola_id
         and r.ano_letivo = v_matricula.ano_letivo
         and r.curso_id is null
         and r.classe_id = v_turma.classe_id
       order by prioridade limit 1),
      (select dia_vencimento from regras r
       where r.escola_id = v_matricula.escola_id
         and r.ano_letivo = v_matricula.ano_letivo
         and r.curso_id is null
         and r.classe_id is null
       order by prioridade limit 1),
      10
    )
    into v_valor, v_dia_vencimento;

  with meses as (
    select
      extract(month from gs)::int as mes_referencia,
      extract(year from gs)::int as ano_referencia
    from generate_series(
      date_trunc('month', v_data_inicio)::date,
      date_trunc('month', v_data_fim)::date,
      interval '1 month'
    ) gs
  ),
  inseridos as (
    insert into public.mensalidades (
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
      data_vencimento,
      matricula_id
    )
    select
      v_matricula.escola_id,
      v_matricula.aluno_id,
      v_matricula.turma_id,
      v_matricula.ano_letivo::text,
      m.mes_referencia,
      m.ano_referencia,
      v_valor,
      v_valor,
      0,
      'pendente',
      make_date(
        m.ano_referencia,
        m.mes_referencia,
        least(greatest(coalesce(v_dia_vencimento, 10), 1), 28)
      ),
      v_matricula.id
    from meses m
    on conflict (escola_id, aluno_id, ano_referencia, mes_referencia) do nothing
    returning id
  )
  select count(*) into v_total from inseridos;

  return jsonb_build_object('ok', true, 'mensalidades', v_total);
end;
$$;


ALTER FUNCTION "financeiro"."gerar_carnet_anual"("p_matricula_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_each_month"("start_date" "date", "end_date" "date") RETURNS TABLE("month_start" "date", "month_end" "date")
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_temp'
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


CREATE OR REPLACE FUNCTION "public"."_guard_candidaturas_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if (new.status is distinct from old.status) then
    if (current_setting('app.rpc_internal', true) <> 'on') and (not public.check_super_admin_role()) then
      raise exception 'Mudança de status da candidatura permitida apenas via RPCs oficiais.';
    end if;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."_guard_candidaturas_status_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."activate_aluno_after_matricula"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public', 'extensions'
    AS $$
BEGIN
  IF NEW.status = 'ativa'
     AND NEW.numero_matricula IS NOT NULL
     AND btrim(NEW.numero_matricula) <> '' THEN
    UPDATE public.alunos
       SET status = 'ativo'
     WHERE id = NEW.aluno_id
       AND status IS DISTINCT FROM 'ativo';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."activate_aluno_after_matricula"() OWNER TO "postgres";


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


ALTER FUNCTION "public"."admissao_approve"("p_escola_id" "uuid", "p_candidatura_id" "uuid", "p_observacao" "text") OWNER TO "postgres";


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
    raise exception 'Acesso negado: escola inválida.';
  end if;

  if not public.user_has_role_in_school(p_escola_id, array['secretaria','admin','admin_escola','staff_admin']) then
    raise exception 'Acesso negado: permissões insuficientes.';
  end if;

  select status, escola_id into v_cand
  from public.candidaturas
  where id = p_candidatura_id and escola_id = v_tenant
  for update;

  if v_cand.status is null then
    raise exception 'Candidatura não encontrada.';
  end if;

  v_from := v_cand.status;

  if v_from = v_to then
    return p_candidatura_id;
  end if;

  if v_from not in ('submetida','em_analise','aprovada','aguardando_pagamento','aguardando_compensacao') then
    raise exception 'Transição inválida: % -> %', v_from, v_to;
  end if;

  perform set_config('app.rpc_internal', 'on', true);

  update public.candidaturas
  set status = v_to, updated_at = now()
  where id = p_candidatura_id;

  insert into public.candidaturas_status_log (
    escola_id, candidatura_id, from_status, to_status, motivo
  ) values (
    p_escola_id, p_candidatura_id, v_from, v_to, nullif(trim(p_motivo), '')
  );

  return p_candidatura_id;
end;
$$;


ALTER FUNCTION "public"."admissao_archive"("p_escola_id" "uuid", "p_candidatura_id" "uuid", "p_motivo" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admissao_convert"("p_candidatura_id" "uuid", "p_turma_id" "uuid", "p_metodo_pagamento" "text", "p_comprovativo_url" "text" DEFAULT NULL::"text", "p_amount" numeric DEFAULT NULL::numeric, "p_idempotency_key" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_cand public.candidaturas%ROWTYPE;
  v_aluno_id uuid;
  v_matricula_numero bigint;
  v_mensalidade_id uuid;
  v_intent_id uuid;
BEGIN
  -- 1. Lock candidature
  SELECT * INTO v_cand
  FROM public.candidaturas
  WHERE id = p_candidatura_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Candidatura not found';
  END IF;

  IF v_cand.status = 'CONVERTIDA' THEN
    RETURN jsonb_build_object('ok', true, 'message', 'Already converted');
  END IF;

  -- 2. Ensure Aluno Exists
  IF v_cand.aluno_id IS NOT NULL THEN
    v_aluno_id := v_cand.aluno_id;
  ELSE
    -- Create Aluno from dados_candidato
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

    -- Link back to candidatura
    UPDATE public.candidaturas
    SET aluno_id = v_aluno_id
    WHERE id = p_candidatura_id;
  END IF;

  -- 3. Confirm Matricula (Core)
  -- Uses the SSOT function
  v_matricula_numero := public.confirmar_matricula_core(
    v_aluno_id,
    v_cand.ano_letivo,
    p_turma_id, -- Turma selected in wizard
    NULL -- New matricula
  );

  -- 4. Create Payment Intent / Mensalidade (Simplified for P0)
  -- Logic: If amount > 0, we assume it's the "Matrícula" fee or first month.
  -- For now, we just record the intent if payment details are provided.
  -- Real implementation would generate the 'mensalidade' record for enrollment fee.
  
  -- (Optional: Call gerar_mensalidades logic or insert payment manually)
  
  -- 5. Update Status
  UPDATE public.candidaturas
  SET 
    status = 'CONVERTIDA',
    updated_at = now()
  WHERE id = p_candidatura_id;

  -- 6. Audit
  PERFORM public.create_audit_event(
    v_cand.escola_id,
    'ADMISSION_CONVERTED',
    'candidaturas',
    p_candidatura_id::text,
    jsonb_build_object('status', 'pendente'),
    jsonb_build_object('status', 'CONVERTIDA', 'matricula', v_matricula_numero),
    'secretaria',
    jsonb_build_object('aluno_id', v_aluno_id, 'turma_id', p_turma_id)
  );

  RETURN jsonb_build_object(
    'ok', true, 
    'matricula', v_matricula_numero, 
    'aluno_id', v_aluno_id
  );
END;
$$;


ALTER FUNCTION "public"."admissao_convert"("p_candidatura_id" "uuid", "p_turma_id" "uuid", "p_metodo_pagamento" "text", "p_comprovativo_url" "text", "p_amount" numeric, "p_idempotency_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admissao_convert_to_matricula"("p_escola_id" "uuid", "p_candidatura_id" "uuid", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_tenant uuid := public.current_tenant_escola_id();
  v_cand record;
  v_from text;
  v_to text := 'matriculado';
  v_matricula_id uuid;
begin
  if p_escola_id is null or p_escola_id <> v_tenant then
    raise exception 'Acesso negado: escola inválida.';
  end if;

  if not public.user_has_role_in_school(p_escola_id, array['secretaria','admin','admin_escola','staff_admin','financeiro']) then
    raise exception 'Acesso negado: permissões insuficientes.';
  end if;

  select status, matricula_id, escola_id into v_cand
  from public.candidaturas
  where id = p_candidatura_id and escola_id = v_tenant
  for update;

  if v_cand.status is null then
    raise exception 'Candidatura não encontrada.';
  end if;

  v_from := v_cand.status;

  if v_from = 'matriculado' then
    return v_cand.matricula_id;
  end if;

  if v_from not in ('aprovada', 'aguardando_pagamento') then
    raise exception 'Transição inválida: % -> matriculado (requer aprovada)', v_from;
  end if;

  if v_from = 'aguardando_pagamento'
    and not public.user_has_role_in_school(
      p_escola_id,
      array['financeiro','admin','admin_escola','staff_admin']
    ) then
    raise exception 'Aguardando validação financeira.';
  end if;

  v_matricula_id := public.confirmar_matricula_core(p_candidatura_id);

  if v_matricula_id is null then
    raise exception 'Falha ao gerar matrícula.';
  end if;

  perform set_config('app.rpc_internal', 'on', true);

  update public.candidaturas
  set
    status = v_to,
    matricula_id = v_matricula_id,
    matriculado_em = now(),
    updated_at = now()
  where id = p_candidatura_id;

  insert into public.candidaturas_status_log (
    escola_id, candidatura_id, from_status, to_status, metadata
  ) values (
    p_escola_id, p_candidatura_id, v_from, v_to,
    jsonb_build_object('matricula_id', v_matricula_id) || coalesce(p_metadata, '{}'::jsonb)
  );

  perform financeiro.gerar_carnet_anual(v_matricula_id);

  return v_matricula_id;
end;
$$;


ALTER FUNCTION "public"."admissao_convert_to_matricula"("p_escola_id" "uuid", "p_candidatura_id" "uuid", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admissao_reject"("p_escola_id" "uuid", "p_candidatura_id" "uuid", "p_motivo" "text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_tenant uuid := public.current_tenant_escola_id();
  v_cand record;
  v_from text;
  v_to text := 'rejeitada';
begin
  if p_motivo is null or length(trim(p_motivo)) < 3 then
    raise exception 'Motivo de rejeição é obrigatório.';
  end if;

  -- Security Check
  if p_escola_id is null or p_escola_id <> v_tenant then
    raise exception 'Acesso negado: escola inválida.';
  end if;

  if not public.user_has_role_in_school(p_escola_id, array['secretaria','admin','admin_escola','staff_admin']) then
    raise exception 'Acesso negado: permissões insuficientes.';
  end if;

  -- Lock
  select status, escola_id into v_cand
  from public.candidaturas
  where id = p_candidatura_id and escola_id = v_tenant
  for update;

  if v_cand.status is null then
    raise exception 'Candidatura não encontrada.';
  end if;

  v_from := v_cand.status;

  if v_from = 'rejeitada' then
    return p_candidatura_id;
  end if;

  if v_from not in ('submetida','em_analise','aprovada') then
    raise exception 'Transição inválida: % -> rejeitada', v_from;
  end if;

  -- RPC internal bypass for status change guard
  perform set_config('app.rpc_internal', 'on', true);

  update public.candidaturas
  set status = v_to, updated_at = now()
  where id = p_candidatura_id;

  insert into public.candidaturas_status_log (
    escola_id, candidatura_id, from_status, to_status, motivo, metadata
  ) values (
    p_escola_id, p_candidatura_id, v_from, v_to, trim(p_motivo), p_metadata
  );

  return p_candidatura_id;
end;
$$;


ALTER FUNCTION "public"."admissao_reject"("p_escola_id" "uuid", "p_candidatura_id" "uuid", "p_motivo" "text", "p_metadata" "jsonb") OWNER TO "postgres";


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


ALTER FUNCTION "public"."admissao_submit"("p_escola_id" "uuid", "p_candidatura_id" "uuid", "p_source" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admissao_unsubmit"("p_escola_id" "uuid", "p_candidatura_id" "uuid", "p_motivo" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_tenant uuid := public.current_tenant_escola_id();
  v_cand record;
begin
  -- Security check: Tenant isolation
  if p_escola_id is null or p_escola_id <> v_tenant then
    raise exception 'Acesso negado: escola inválida';
  end if;

  -- Security check: Permission (AuthZ)
  if not public.user_has_role_in_school(p_escola_id, array['secretaria','admin','admin_escola','staff_admin']) then
    raise exception 'Acesso negado: permissões insuficientes';
  end if;

  -- Lock & Load
  select status, escola_id
  into v_cand
  from public.candidaturas
  where id = p_candidatura_id
    and escola_id = v_tenant
  for update;

  if v_cand.status is null then
    raise exception 'Candidatura não encontrada ou acesso negado';
  end if;

  -- Idempotency
  if v_cand.status = 'rascunho' then
    return p_candidatura_id;
  end if;

  -- Validation: Só permite unsubmit se estiver submetida ou em_analise
  if v_cand.status not in ('submetida', 'em_analise') then
    raise exception 'Transição inválida: status atual = %', v_cand.status;
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


ALTER FUNCTION "public"."admissao_unsubmit"("p_escola_id" "uuid", "p_candidatura_id" "uuid", "p_motivo" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admissao_upsert_draft"("p_escola_id" "uuid", "p_candidatura_id" "uuid" DEFAULT NULL::"uuid", "p_source" "text" DEFAULT 'walkin'::"text", "p_dados_candidato" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
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
    'turno', v_turno
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


ALTER FUNCTION "public"."admissao_upsert_draft"("p_escola_id" "uuid", "p_candidatura_id" "uuid", "p_source" "text", "p_dados_candidato" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."aprovar_turmas"("p_turma_ids" "uuid"[], "p_escola_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."aprovar_turmas"("p_turma_ids" "uuid"[], "p_escola_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."aprovar_turmas"("p_escola_id" "uuid", "p_turma_ids" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  is_admin bool;
  r record;

  v_turma_codigo text;
  v_curso_codigo text;
  v_curso_id uuid;
begin
  -- Segurança
  select public.is_escola_admin(p_escola_id, auth.uid()) into is_admin;
  if not is_admin then
    raise exception 'Apenas administradores podem aprovar turmas.';
  end if;

  -- Loop determinístico pelas turmas aprovadas
  for r in
    select
      t.id,
      t.escola_id,
      coalesce(t.turma_code, t.turma_codigo) as turma_codigo
    from public.turmas t
    where t.escola_id = p_escola_id
      and t.id = any(p_turma_ids)
    for update
  loop
    v_turma_codigo := r.turma_codigo;

    if v_turma_codigo is null or btrim(v_turma_codigo) = '' then
      raise exception 'Turma % sem codigo/turma_codigo. Não é possível inferir curso.', r.id;
    end if;

    -- Inferir curso_codigo do TURMA_CODIGO: CURSO-CLASSE-TURNO-LETRA
    v_curso_codigo := split_part(v_turma_codigo, '-', 1);

    if v_curso_codigo is null or btrim(v_curso_codigo) = '' then
      raise exception 'Turma % com código inválido (%).', r.id, v_turma_codigo;
    end if;

    -- 1) Upsert do curso (cria se não existe, senão aprova)
    insert into public.cursos (escola_id, course_code, nome, status_aprovacao, created_at, updated_at)
    values (p_escola_id, v_curso_codigo, 'Curso ' || v_curso_codigo, 'aprovado', now(), now())
    on conflict (escola_id, course_code)
    do update set
      status_aprovacao = 'aprovado',
      updated_at = now()
    returning id into v_curso_id;

    -- 2) Garantir que a turma aponta para o curso inferido
    update public.turmas
    set
      curso_id = v_curso_id,
      status_validacao = 'aprovado',
      updated_at = now()
    where id = r.id
      and escola_id = p_escola_id;

    -- 3) Ativar matrículas pendentes dessa turma
    update public.matriculas m
    set
      status = 'ativa',
      ativo = true,
      updated_at = now()
    where m.escola_id = p_escola_id
      and m.turma_id = r.id
      and m.status is distinct from 'ativa';
  end loop;
end;
$$;


ALTER FUNCTION "public"."aprovar_turmas"("p_escola_id" "uuid", "p_turma_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assert_course_class_range"("p_curriculum_key" "text", "p_class_num" integer) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."assert_course_class_range"("p_curriculum_key" "text", "p_class_num" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."atualiza_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public', 'extensions'
    AS $$
    begin
      new.updated_at = timezone('utc'::text, now());
      return new;
    end;
    $$;


ALTER FUNCTION "public"."atualiza_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."audit_dml_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_temp'
    AS $$
DECLARE
  v_escola_id uuid;
  v_entity_id text;
  v_portal text;
  v_action text;
  v_entity text := tg_table_name;
  v_before jsonb;
  v_after jsonb;
  ctx jsonb;
BEGIN
  v_action := case tg_op when 'INSERT' then 'CREATE' when 'UPDATE' then 'UPDATE' when 'DELETE' then 'DELETE' end;
  v_portal := case tg_table_name when 'pagamentos' then 'financeiro' when 'matriculas' then 'secretaria' else 'outro' end;

  if tg_op = 'INSERT' then
    begin v_escola_id := (new).escola_id; exception when others then v_escola_id := null; end;
    begin v_entity_id := (new).id::text; exception when others then v_entity_id := null; end;
    v_before := NULL;
    v_after := public.audit_redact_jsonb(v_entity, to_jsonb(new));
  elsif tg_op = 'UPDATE' then
    begin v_escola_id := (new).escola_id; exception when others then v_escola_id := null; end;
    begin v_entity_id := (new).id::text; exception when others then v_entity_id := null; end;
    v_before := public.audit_redact_jsonb(v_entity, to_jsonb(old));
    v_after := public.audit_redact_jsonb(v_entity, to_jsonb(new));
  else
    begin v_escola_id := (old).escola_id; exception when others then v_escola_id := null; end;
    begin v_entity_id := (old).id::text; exception when others then v_entity_id := null; end;
    v_before := public.audit_redact_jsonb(v_entity, to_jsonb(old));
    v_after := NULL;
  end if;

  ctx := public.audit_request_context();

  INSERT INTO public.audit_logs (
    escola_id,
    actor_id,
    actor_role,
    user_id,
    portal,
    action,
    entity,
    entity_id,
    details,
    before,
    after,
    ip,
    user_agent
  ) VALUES (
    v_escola_id,
    auth.uid(),
    ctx->>'actor_role',
    auth.uid(),
    v_portal,
    v_action,
    v_entity,
    v_entity_id,
    jsonb_build_object('op', tg_op),
    v_before,
    v_after,
    ctx->>'ip',
    ctx->>'user_agent'
  );

  if tg_op = 'DELETE' then
    return old;
  else
    return new;
  end if;
END;
$$;


ALTER FUNCTION "public"."audit_dml_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."audit_redact_jsonb"("p_entity" "text", "p_payload" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'pg_catalog', 'public', 'extensions'
    AS $$
DECLARE
  redacted jsonb := p_payload;
BEGIN
  IF redacted IS NULL THEN
    RETURN NULL;
  END IF;

  redacted := redacted
    - 'bi_numero'
    - 'nif'
    - 'email'
    - 'telefone'
    - 'telefone_responsavel'
    - 'encarregado_telefone'
    - 'responsavel_contato'
    - 'encarregado_email'
    - 'numero_processo'
    - 'numero_processo_legado'
    - 'codigo_ativacao'
    - 'usuario_auth_id'
    - 'dados_candidato';

  RETURN redacted;
END;
$$;


ALTER FUNCTION "public"."audit_redact_jsonb"("p_entity" "text", "p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."audit_request_context"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  headers jsonb;
  claims jsonb;
  ip text;
  ua text;
  role text;
BEGIN
  headers := NULL;
  BEGIN
    headers := current_setting('request.headers', true)::jsonb;
  EXCEPTION WHEN others THEN
    headers := NULL;
  END;

  claims := NULL;
  BEGIN
    claims := current_setting('request.jwt.claims', true)::jsonb;
  EXCEPTION WHEN others THEN
    claims := NULL;
  END;

  ip := COALESCE(headers->>'x-forwarded-for', headers->>'x-real-ip');
  ua := headers->>'user-agent';
  role := COALESCE(claims->>'user_role', claims->>'role');

  RETURN jsonb_build_object('ip', ip, 'user_agent', ua, 'actor_role', role);
END;
$$;


ALTER FUNCTION "public"."audit_request_context"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."before_insert_alunos_set_processo"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.numero_processo IS NULL OR btrim(NEW.numero_processo) = '' THEN
    NEW.numero_processo := public.next_numero_processo(NEW.escola_id, EXTRACT(YEAR FROM now())::int);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."before_insert_alunos_set_processo"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."block_frequencias_after_close"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_turma_id uuid;
  v_periodo_id uuid;
begin
  select turma_id
    into v_turma_id
  from public.matriculas
  where id = new.matricula_id
    and escola_id = new.escola_id;

  if v_turma_id is null then
    return new;
  end if;

  if new.periodo_letivo_id is not null then
    v_periodo_id := new.periodo_letivo_id;
  else
    select pl.id
      into v_periodo_id
    from public.periodos_letivos pl
    join public.anos_letivos al
      on al.id = pl.ano_letivo_id
     and al.escola_id = pl.escola_id
    join public.matriculas m
      on m.id = new.matricula_id
     and m.escola_id = new.escola_id
    where pl.escola_id = new.escola_id
      and al.ano = m.ano_letivo
      and pl.tipo = 'TRIMESTRE'
      and new.data between pl.data_inicio and pl.data_fim
    limit 1;

    if v_periodo_id is null then
      raise exception 'Período letivo não resolvido para a data informada.';
    end if;

    new.periodo_letivo_id := v_periodo_id;
  end if;

  if exists (
    select 1
    from public.frequencia_status_periodo fsp
    where fsp.escola_id = new.escola_id
      and fsp.turma_id = v_turma_id
      and fsp.periodo_letivo_id = v_periodo_id
  ) then
    raise exception 'Período fechado para frequência.';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."block_frequencias_after_close"() OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."can_manage_school"("p_escola_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND (p.escola_id = p_escola_id OR p.current_escola_id = p_escola_id)
        AND p.role IN ('admin','secretaria','financeiro')
        AND p.deleted_at IS NULL
    );
$$;


ALTER FUNCTION "public"."can_manage_school"("p_escola_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_professor_school"("p_escola_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select public.user_has_role_in_school(p_escola_id, array['professor']);
$$;


ALTER FUNCTION "public"."can_professor_school"("p_escola_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."canonicalize_matricula_status_text"("input" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE PARALLEL SAFE
    SET "search_path" TO 'public'
    AS $$
DECLARE v text := lower(trim(coalesce(input, '')));
BEGIN
  IF v = '' THEN RETURN 'indefinido'; END IF;

  -- ✅ PADRÃO: "ativa"
  IF v IN ('ativa','ativo','active') THEN RETURN 'ativa'; END IF;

  IF v IN ('concluida','concluido','graduado') THEN RETURN 'concluido'; END IF;
  IF v IN ('transferido','transferida') THEN RETURN 'transferido'; END IF;
  IF v IN ('pendente','aguardando') THEN RETURN 'pendente'; END IF;
  IF v IN ('trancado','suspenso','desistente','inativo') THEN RETURN 'inativo'; END IF;
  RETURN 'indefinido';
END
$$;


ALTER FUNCTION "public"."canonicalize_matricula_status_text"("input" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_super_admin_role"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_temp'
    AS $$
BEGIN
  RETURN (SELECT public.current_user_role() = 'super_admin');
END;
$$;


ALTER FUNCTION "public"."check_super_admin_role"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."outbox_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "dedupe_key" "text" NOT NULL,
    "idempotency_key" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "max_attempts" integer DEFAULT 5 NOT NULL,
    "next_attempt_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "locked_at" timestamp with time zone,
    "locked_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processed_at" timestamp with time zone,
    "last_error" "text",
    "tenant_scope" "text",
    "status" "public"."outbox_status" DEFAULT 'pending'::"public"."outbox_status" NOT NULL
);


ALTER TABLE "public"."outbox_events" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_outbox_events"("p_topic" "text" DEFAULT NULL::"text", "p_limit" integer DEFAULT 20) RETURNS SETOF "public"."outbox_events"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  WITH candidate AS (
    SELECT id
    FROM public.outbox_events
    WHERE status IN ('pending', 'failed')
      AND next_run_at <= now()
      AND attempts < max_attempts
      AND (p_topic IS NULL OR topic = p_topic)
    ORDER BY created_at
    LIMIT GREATEST(1, LEAST(p_limit, 50))
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.outbox_events o
     SET status = 'processing',
         attempts = o.attempts + 1,
         locked_at = now(),
         locked_by = 'outbox_worker'
    WHERE o.id IN (SELECT id FROM candidate)
  RETURNING o.*;
END;
$$;


ALTER FUNCTION "public"."claim_outbox_events"("p_topic" "text", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."confirmar_matricula"("p_matricula_id" "uuid") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_numero bigint;
  v_escola_id uuid;
BEGIN
  SELECT
    NULLIF(btrim(numero_matricula), '')::bigint,
    escola_id
  INTO v_numero, v_escola_id
  FROM public.matriculas
  WHERE id = p_matricula_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Matrícula não encontrada';
  END IF;

  IF v_numero IS NULL THEN
    v_numero := public.next_matricula_number(v_escola_id);
  END IF;

  UPDATE public.matriculas
  SET
    numero_matricula = v_numero::text,
    status = 'ativa',         -- ✅ CASA com o constraint
    ativo = true,
    updated_at = now()
  WHERE id = p_matricula_id;

  RETURN v_numero;
END;
$$;


ALTER FUNCTION "public"."confirmar_matricula"("p_matricula_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."confirmar_matricula_core"("p_candidatura_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_cand record;
  v_aluno_id uuid;
  v_matricula_id uuid;
  v_matricula_numero bigint;
begin
  select * into v_cand
  from public.candidaturas
  where id = p_candidatura_id
  for update;

  if v_cand.id is null then
    raise exception 'Candidatura não encontrada';
  end if;

  if v_cand.aluno_id is not null then
    v_aluno_id := v_cand.aluno_id;
  else
    insert into public.alunos (
      escola_id,
      nome,
      bi_numero,
      telefone_responsavel,
      email,
      status,
      created_at
    ) values (
      v_cand.escola_id,
      coalesce(v_cand.nome_candidato, v_cand.dados_candidato->>'nome_candidato'),
      v_cand.dados_candidato->>'bi_numero',
      v_cand.dados_candidato->>'telefone',
      v_cand.dados_candidato->>'email',
      'ativo',
      now()
    )
    returning id into v_aluno_id;

    update public.candidaturas
    set aluno_id = v_aluno_id
    where id = p_candidatura_id;
  end if;

  v_matricula_numero := public.confirmar_matricula_core(
    v_aluno_id,
    v_cand.ano_letivo,
    v_cand.turma_preferencial_id,
    v_cand.matricula_id
  );

  select m.id into v_matricula_id
  from public.matriculas m
  where m.aluno_id = v_aluno_id
    and m.ano_letivo = v_cand.ano_letivo
    and m.escola_id = v_cand.escola_id
    and m.numero_matricula = v_matricula_numero::text;

  return v_matricula_id;
end;
$$;


ALTER FUNCTION "public"."confirmar_matricula_core"("p_candidatura_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."confirmar_matricula_core"("p_aluno_id" "uuid", "p_ano_letivo" integer, "p_turma_id" "uuid" DEFAULT NULL::"uuid", "p_matricula_id" "uuid" DEFAULT NULL::"uuid") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_escola_id uuid;
  v_matricula_id uuid;
  v_numero_matricula bigint;
BEGIN
  select a.escola_id into v_escola_id
  from public.alunos a
  where a.id = p_aluno_id;

  if not found then
    raise exception 'Aluno não encontrado';
  end if;

  if p_turma_id is not null then
    perform 1
    from public.turmas t
    where t.id = p_turma_id
      and t.escola_id = v_escola_id;

    if not found then
      raise exception 'Turma não pertence à escola do aluno';
    end if;
  end if;

  if p_matricula_id is not null then
    select m.id, m.numero_matricula
      into v_matricula_id, v_numero_matricula
    from public.matriculas m
    where m.id = p_matricula_id
      and m.escola_id = v_escola_id
    for update;
  else
    select m.id, m.numero_matricula
      into v_matricula_id, v_numero_matricula
    from public.matriculas m
    where m.aluno_id = p_aluno_id
      and m.ano_letivo = p_ano_letivo
      and m.escola_id = v_escola_id
    order by
      (m.status in ('ativo','pendente')) desc,
      m.created_at desc nulls last
    limit 1
    for update;
  end if;

  if v_matricula_id is null then
    v_numero_matricula := public.next_matricula_number(v_escola_id);

    insert into public.matriculas (
      id, escola_id, aluno_id, turma_id, ano_letivo,
      status, numero_matricula, data_matricula, created_at
    ) values (
      gen_random_uuid(), v_escola_id, p_aluno_id, p_turma_id, p_ano_letivo,
      'ativo', v_numero_matricula, current_date, now()
    )
    returning id into v_matricula_id;
  else
    if v_numero_matricula is null then
      v_numero_matricula := public.next_matricula_number(v_escola_id);
    end if;

    update public.matriculas
    set
      numero_matricula = v_numero_matricula,
      status = 'ativo',
      turma_id = coalesce(p_turma_id, turma_id),
      updated_at = now()
    where id = v_matricula_id;
  end if;

  update public.profiles p
  set numero_login = v_numero_matricula::text
  from public.alunos a
  where a.id = p_aluno_id
    and p.user_id = a.profile_id
    and p.role = 'aluno'
    and (p.numero_login is distinct from v_numero_matricula::text);

  return v_numero_matricula;
END;
$$;


ALTER FUNCTION "public"."confirmar_matricula_core"("p_aluno_id" "uuid", "p_ano_letivo" integer, "p_turma_id" "uuid", "p_matricula_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_audit_event"("p_escola_id" "uuid", "p_action" "text", "p_entity" "text", "p_entity_id" "text", "p_before" "jsonb" DEFAULT NULL::"jsonb", "p_after" "jsonb" DEFAULT NULL::"jsonb", "p_portal" "text" DEFAULT NULL::"text", "p_details" "jsonb" DEFAULT NULL::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  ctx jsonb;
BEGIN
  ctx := public.audit_request_context();

  INSERT INTO public.audit_logs (
    escola_id,
    actor_id,
    actor_role,
    user_id,
    portal,
    action,
    entity,
    entity_id,
    details,
    before,
    after,
    ip,
    user_agent
  ) VALUES (
    p_escola_id,
    auth.uid(),
    ctx->>'actor_role',
    auth.uid(),
    p_portal,
    p_action,
    p_entity,
    p_entity_id,
    p_details,
    public.audit_redact_jsonb(p_entity, p_before),
    public.audit_redact_jsonb(p_entity, p_after),
    ctx->>'ip',
    ctx->>'user_agent'
  );
END;
$$;


ALTER FUNCTION "public"."create_audit_event"("p_escola_id" "uuid", "p_action" "text", "p_entity" "text", "p_entity_id" "text", "p_before" "jsonb", "p_after" "jsonb", "p_portal" "text", "p_details" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_escola_with_admin"("p_nome" "text", "p_nif" "text" DEFAULT NULL::"text", "p_endereco" "text" DEFAULT NULL::"text", "p_admin_email" "text" DEFAULT NULL::"text", "p_admin_telefone" "text" DEFAULT NULL::"text", "p_admin_nome" "text" DEFAULT NULL::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_temp'
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


ALTER FUNCTION "public"."create_escola_with_admin"("p_nome" "text", "p_nif" "text", "p_endereco" "text", "p_admin_email" "text", "p_admin_telefone" "text", "p_admin_nome" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_month_partition"("tbl" "text", "month_start" "date") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_temp'
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


ALTER FUNCTION "public"."create_month_partition"("tbl" "text", "month_start" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_month_partition_ts"("tbl" "text", "month_start" "date") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_temp'
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


ALTER FUNCTION "public"."create_month_partition_ts"("tbl" "text", "month_start" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_or_confirm_matricula"("p_aluno_id" "uuid", "p_turma_id" "uuid", "p_ano_letivo" integer, "p_matricula_id" "uuid" DEFAULT NULL::"uuid") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."create_or_confirm_matricula"("p_aluno_id" "uuid", "p_turma_id" "uuid", "p_ano_letivo" integer, "p_matricula_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."turmas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "ano_letivo" integer,
    "turno" "text",
    "sala" "text",
    "session_id" "uuid",
    "classe_id" "uuid",
    "capacidade_maxima" integer,
    "curso_id" "uuid",
    "coordenador_pedagogico_id" "uuid",
    "diretor_turma_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "turma_codigo" "text",
    "status_validacao" "text" DEFAULT 'ativo'::"text",
    "turma_code" "text",
    "classe_num" integer,
    "letra" "text",
    "import_id" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "turmas_turno_check" CHECK (("turno" = ANY (ARRAY['M'::"text", 'T'::"text", 'N'::"text"])))
);

ALTER TABLE ONLY "public"."turmas" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."turmas" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_or_get_turma_by_code"("p_escola_id" "uuid", "p_ano_letivo" integer, "p_turma_code" "text") RETURNS "public"."turmas"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."create_or_get_turma_by_code"("p_escola_id" "uuid", "p_ano_letivo" integer, "p_turma_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_escola_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT (auth.jwt() -> 'raw_app_meta_data' ->> 'escola_id')::uuid;
$$;


ALTER FUNCTION "public"."current_escola_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_tenant_escola_id"() RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."current_tenant_escola_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_user_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT
    NULLIF(
      current_setting('request.jwt.claims', true)::jsonb->>'sub',
      ''
    )::uuid;
$$;


ALTER FUNCTION "public"."current_user_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_user_role"() RETURNS "text"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'pg_temp'
    AS $$
  SELECT COALESCE(
    (CURRENT_SETTING('request.jwt.claims', TRUE)::JSONB -> 'app_metadata' ->> 'role'),
    ''
  );
$$;


ALTER FUNCTION "public"."current_user_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."curriculo_publish"("p_escola_id" "uuid", "p_curso_id" "uuid", "p_ano_letivo_id" "uuid", "p_version" integer, "p_rebuild_turmas" boolean DEFAULT true) RETURNS TABLE("ok" boolean, "message" "text", "published_curriculo_id" "uuid", "previous_published_curriculo_id" "uuid")
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public', 'extensions'
    AS $$
declare
  v_escola_id uuid := public.current_tenant_escola_id();
  v_target_id uuid;
  v_prev_id uuid;
begin
  -- 0) Tenant hardening: ignora p_escola_id externo
  if p_escola_id is distinct from v_escola_id then
    -- não falha, só ignora (anti-spoof). Se quiser, pode raise exception.
    null;
  end if;

  -- 1) AuthZ: só admin_escola pode publicar
  if not public.user_has_role_in_school(v_escola_id, array['admin_escola']) then
    raise exception 'permission denied: admin_escola required';
  end if;

  -- 2) Valida inputs
  if p_version is null or p_version < 1 then
    raise exception 'invalid version';
  end if;

  -- 3) Lock lógico por grupo (evita corrida de publish concorrente)
  --    hashtextextended é bom p/ advisory lock
  perform pg_advisory_xact_lock(
    hashtextextended(
      v_escola_id::text || ':' || p_curso_id::text || ':' || p_ano_letivo_id::text,
      0
    )
  );

  -- 4) Carregar alvo
  select cc.id into v_target_id
  from public.curso_curriculos cc
  where cc.escola_id = v_escola_id
    and cc.curso_id = p_curso_id
    and cc.ano_letivo_id = p_ano_letivo_id
    and cc.version = p_version
  limit 1;

  if v_target_id is null then
    return query
    select false, 'target curriculum version not found', null::uuid, null::uuid;
    return;
  end if;

  -- 5) Se já está published -> idempotente
  if exists (
    select 1 from public.curso_curriculos
    where id = v_target_id
      and status = 'published'
  ) then
    return query
    select true, 'already published (idempotent)', v_target_id, null::uuid;
    return;
  end if;

  -- 6) Descobrir anterior published (se houver)
  select cc.id into v_prev_id
  from public.curso_curriculos cc
  where cc.escola_id = v_escola_id
    and cc.curso_id = p_curso_id
    and cc.ano_letivo_id = p_ano_letivo_id
    and cc.status = 'published'
  order by cc.version desc
  limit 1;

  -- 7) Publicar atomicamente:
  --    - despublica anterior (vira archived ou draft? vou usar archived)
  --    - publica alvo
  if v_prev_id is not null then
    update public.curso_curriculos
      set status = 'archived'
    where id = v_prev_id;
  end if;

  update public.curso_curriculos
    set status = 'published'
  where id = v_target_id;

  -- 8) Rebuild turma_disciplinas (opcional, mas recomendado no piloto)
  if p_rebuild_turmas then
    perform public.curriculo_rebuild_turma_disciplinas(v_escola_id, p_curso_id, p_ano_letivo_id);
  end if;

  return query
  select true,
         'published successfully',
         v_target_id,
         v_prev_id;

exception
  when unique_violation then
    -- se bater no unique partial index de published, resolver de forma idempotente
    -- (alguém publicou ao mesmo tempo)
    select cc.id into v_prev_id
    from public.curso_curriculos cc
    where cc.escola_id = v_escola_id
      and cc.curso_id = p_curso_id
      and cc.ano_letivo_id = p_ano_letivo_id
      and cc.status = 'published'
    order by cc.version desc
    limit 1;

    if v_prev_id = v_target_id then
      return query select true, 'published concurrently (idempotent)', v_target_id, null::uuid;
    end if;

    return query select false, 'conflict: another version is published', v_prev_id, null::uuid;
end;
$$;


ALTER FUNCTION "public"."curriculo_publish"("p_escola_id" "uuid", "p_curso_id" "uuid", "p_ano_letivo_id" "uuid", "p_version" integer, "p_rebuild_turmas" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."curriculo_rebuild_turma_disciplinas"("p_escola_id" "uuid", "p_curso_id" "uuid", "p_ano_letivo_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public', 'extensions'
    AS $$
begin
  /*
    Suposições (ajuste se seus nomes divergem):
    - turmas: (id, escola_id, curso_id, ano_letivo_id, classe_id, ...)
    - turma_disciplinas: (id, escola_id, turma_id, disciplina_id, curso_matriz_id?, professor_id?, ...)
    - curso_matriz: (id, escola_id, curso_id, classe_id, disciplina_id, curso_curriculo_id, ativo, ...)
    Estratégia:
      - Remove turma_disciplinas do conjunto alvo (apenas turmas do curso+ano)
      - Reinsere a partir do currículo published atual (curso_curriculos + curso_matriz)
      - Mantém professor_id NULL (atribuição é outra feature)
  */

  -- 1) Descobrir currículo publicado atual
  --    (garante determinismo)
  with curr as (
    select cc.id
    from public.curso_curriculos cc
    where cc.escola_id = p_escola_id
      and cc.curso_id = p_curso_id
      and cc.ano_letivo_id = p_ano_letivo_id
      and cc.status = 'published'
    order by cc.version desc
    limit 1
  )
  -- 2) Limpar turma_disciplinas das turmas alvo
  delete from public.turma_disciplinas td
  using public.turmas t
  where td.escola_id = p_escola_id
    and t.id = td.turma_id
    and t.escola_id = p_escola_id
    and t.curso_id = p_curso_id
    and t.ano_letivo_id = p_ano_letivo_id;

  -- 3) Recriar turma_disciplinas a partir do currículo published
  insert into public.turma_disciplinas (
    id,
    escola_id,
    turma_id,
    disciplina_id,
    curso_matriz_id,
    created_at
    -- professor_id fica null
  )
  select
    gen_random_uuid(),
    p_escola_id,
    t.id as turma_id,
    cm.disciplina_id,
    cm.id as curso_matriz_id,
    now()
  from public.turmas t
  join curr on true
  join public.curso_matriz cm
    on cm.escola_id = p_escola_id
   and cm.curso_id = p_curso_id
   and cm.curso_curriculo_id = curr.id
   and cm.classe_id = t.classe_id
   and cm.ativo = true
  where t.escola_id = p_escola_id
    and t.curso_id = p_curso_id
    and t.ano_letivo_id = p_ano_letivo_id
  on conflict do nothing;

end;
$$;


ALTER FUNCTION "public"."curriculo_rebuild_turma_disciplinas"("p_escola_id" "uuid", "p_curso_id" "uuid", "p_ano_letivo_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."curso_curriculos_force_fields"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public', 'extensions'
    AS $$
begin
  -- tenant hardening
  new.escola_id := public.current_tenant_escola_id();

  -- se vier null, setar actor
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;

  -- versão mínima (se o caller não passar)
  if new.version is null or new.version < 1 then
    new.version := 1;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."curso_curriculos_force_fields"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."curso_matriz_assert_same_escola"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public', 'extensions'
    AS $$
declare
  v_escola uuid;
begin
  if new.curso_curriculo_id is null then
    return new;
  end if;

  select escola_id into v_escola
  from public.curso_curriculos
  where id = new.curso_curriculo_id;

  if v_escola is null or v_escola <> new.escola_id then
    raise exception 'cross-tenant violation: curso_matriz.escola_id != curso_curriculos.escola_id';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."curso_matriz_assert_same_escola"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."curso_matriz_fill_curriculo_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public', 'extensions'
    AS $$
declare
  v_ano uuid;
  v_cc uuid;
begin
  if new.curso_curriculo_id is not null then
    return new;
  end if;

  -- determina ano letivo preferido da escola
  select ano_letivo_id into v_ano
  from public.vw_escola_ano_letivo_preferido
  where escola_id = new.escola_id;

  if v_ano is null then
    -- Sem ano letivo: não inventar. Mantém null e deixa o app tratar como FAIL de setup.
    return new;
  end if;

  -- pega published atual; se não existir, cria v1 draft? NÃO. Só draft.
  select id into v_cc
  from public.curso_curriculos
  where escola_id = new.escola_id
    and curso_id = new.curso_id
    and ano_letivo_id = v_ano
    and status = 'published'
  order by version desc
  limit 1;

  if v_cc is null then
    -- fallback compat: criar draft v1 (não published), para não quebrar inserts.
    insert into public.curso_curriculos (escola_id, curso_id, ano_letivo_id, version, status, created_by)
    values (new.escola_id, new.curso_id, v_ano, 1, 'draft', auth.uid())
    on conflict on constraint curso_curriculos_escola_curso_ano_version_uk
    do update set status = excluded.status
    returning id into v_cc;
  end if;

  new.curso_curriculo_id := v_cc;
  return new;
end;
$$;


ALTER FUNCTION "public"."curso_matriz_fill_curriculo_id"() OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."emitir_recibo"("p_mensalidade_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."emitir_recibo"("p_mensalidade_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_avaliacoes_consistency"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."enforce_avaliacoes_consistency"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_matriculas_tenant_consistency"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_aluno_escola uuid;
  v_turma_escola uuid;
  v_secao_escola uuid;
begin
  select escola_id into v_aluno_escola from public.alunos where id = new.aluno_id;
  if v_aluno_escola is not null and v_aluno_escola <> new.escola_id then
    raise exception 'aluno pertence a outra escola';
  end if;

  if new.turma_id is not null then
    select escola_id into v_turma_escola from public.turmas where id = new.turma_id;
    if v_turma_escola is not null and v_turma_escola <> new.escola_id then
      raise exception 'turma pertence a outra escola';
    end if;
  end if;

  if new.secao_id is not null then
    select escola_id into v_secao_escola from public.secoes where id = new.secao_id;
    if v_secao_escola is not null and v_secao_escola <> new.escola_id then
      raise exception 'secao pertence a outra escola';
    end if;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_matriculas_tenant_consistency"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_notas_consistency"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."enforce_notas_consistency"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_pagamentos_tenant_consistency"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_mensalidade_escola uuid;
begin
  if new.mensalidade_id is not null then
    select escola_id into v_mensalidade_escola from public.mensalidades where id = new.mensalidade_id;
    if v_mensalidade_escola is not null and v_mensalidade_escola <> new.escola_id then
      raise exception 'mensalidade pertence a outra escola';
    end if;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_pagamentos_tenant_consistency"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_turma_disciplina_consistency"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."enforce_turma_disciplina_consistency"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enqueue_outbox_event"("p_escola_id" "uuid", "p_topic" "text", "p_payload" "jsonb", "p_request_id" "uuid" DEFAULT "gen_random_uuid"(), "p_idempotency_key" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_id uuid;
  v_dedupe text;
  v_idempotency text;
begin
  if not public.can_manage_school(p_escola_id) then
    raise exception 'sem permissão para escola %', p_escola_id;
  end if;

  v_dedupe := coalesce(p_idempotency_key, p_request_id::text);
  v_idempotency := coalesce(p_idempotency_key, p_topic || ':' || p_request_id::text);

  insert into public.outbox_events (escola_id, event_type, dedupe_key, idempotency_key, payload)
  values (
    p_escola_id,
    p_topic,
    v_dedupe,
    v_idempotency,
    p_payload
  )
  on conflict do nothing
  returning id into v_id;

  if v_id is null then
    select id
      into v_id
      from public.outbox_events
     where escola_id = p_escola_id
       and event_type = p_topic
       and dedupe_key = v_dedupe
     limit 1;
  end if;

  return v_id;
end;
$$;


ALTER FUNCTION "public"."enqueue_outbox_event"("p_escola_id" "uuid", "p_topic" "text", "p_payload" "jsonb", "p_request_id" "uuid", "p_idempotency_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enqueue_outbox_event_professor"("p_escola_id" "uuid", "p_event_type" "text", "p_payload" "jsonb", "p_idempotency_key" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_id uuid;
begin
  if not public.user_has_role_in_school(
    p_escola_id,
    array['admin_escola','secretaria','admin','financeiro','professor','staff_admin']
  ) then
    raise exception 'sem permissão para escola %', p_escola_id;
  end if;

  insert into public.outbox_events (escola_id, event_type, dedupe_key, idempotency_key, payload)
  values (p_escola_id, p_event_type, p_idempotency_key, p_idempotency_key, p_payload)
  on conflict do nothing
  returning id into v_id;

  if v_id is null then
    select id
      into v_id
      from public.outbox_events
     where escola_id = p_escola_id
       and event_type = p_event_type
       and dedupe_key = p_idempotency_key
     limit 1;
  end if;

  return v_id;
end;
$$;


ALTER FUNCTION "public"."enqueue_outbox_event_professor"("p_escola_id" "uuid", "p_event_type" "text", "p_payload" "jsonb", "p_idempotency_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_aluno_from_escola_usuario"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."ensure_aluno_from_escola_usuario"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."escola_has_feature"("p_escola_id" "uuid", "p_feature" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."escola_has_feature"("p_escola_id" "uuid", "p_feature" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."estornar_mensalidade"("p_mensalidade_id" "uuid", "p_motivo" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."estornar_mensalidade"("p_mensalidade_id" "uuid", "p_motivo" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fill_frequencias_periodo_letivo"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  update public.frequencias f
  set periodo_letivo_id = sub.periodo_letivo_id
  from (
    select
      f2.id as frequencia_id,
      pl.id as periodo_letivo_id,
      count(pl.id) over (partition by f2.id) as match_count
    from public.frequencias f2
    join public.matriculas m
      on m.id = f2.matricula_id
     and m.escola_id = f2.escola_id
    join public.anos_letivos al
      on al.escola_id = m.escola_id
     and al.ano = m.ano_letivo
    join public.periodos_letivos pl
      on pl.escola_id = f2.escola_id
     and pl.ano_letivo_id = al.id
     and f2.data between pl.data_inicio and pl.data_fim
    where f2.periodo_letivo_id is null
  ) sub
  where f.id = sub.frequencia_id
    and sub.match_count = 1;

  if exists (
    select 1
    from (
      select f2.id, count(pl.id) as match_count
      from public.frequencias f2
      join public.matriculas m
        on m.id = f2.matricula_id
       and m.escola_id = f2.escola_id
      join public.anos_letivos al
        on al.escola_id = m.escola_id
       and al.ano = m.ano_letivo
      join public.periodos_letivos pl
        on pl.escola_id = f2.escola_id
       and pl.ano_letivo_id = al.id
       and f2.data between pl.data_inicio and pl.data_fim
      where f2.periodo_letivo_id is null
      group by f2.id
      having count(pl.id) > 1
    ) matches
  ) then
    raise exception 'frequencias: múltiplos períodos encontrados no backfill';
  end if;
end;
$$;


ALTER FUNCTION "public"."fill_frequencias_periodo_letivo"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."finance_payment_intents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "aluno_id" "uuid",
    "mensalidade_id" "uuid",
    "amount" numeric(14,2) NOT NULL,
    "currency" "text" DEFAULT 'AOA'::"text" NOT NULL,
    "method" "text" NOT NULL,
    "external_ref" "text",
    "proof_url" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "confirmed_at" timestamp with time zone,
    "confirmed_by" "uuid",
    "dedupe_key" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "finance_payment_intents_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text", 'rejected'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."finance_payment_intents" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."finance_confirm_payment"("p_intent_id" "uuid", "p_dedupe_key_override" "text" DEFAULT NULL::"text") RETURNS "public"."finance_payment_intents"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_intent public.finance_payment_intents;
  v_existing public.finance_payment_intents;
  v_dedupe text;
  v_before jsonb;
  v_after jsonb;
  v_mensalidade public.mensalidades%rowtype;
  v_total numeric(14,2);
  v_expected numeric(14,2);
  v_status text;
  v_payment_id uuid;
  v_metodo_pagamento text;
  v_data_pagamento date;
begin
  select *
    into v_intent
    from public.finance_payment_intents
   where id = p_intent_id
   for update;

  if not found then
    raise exception 'payment intent não encontrado';
  end if;

  if auth.role() <> 'service_role' and not public.can_manage_school(v_intent.escola_id) then
    raise exception 'sem permissão para escola %', v_intent.escola_id;
  end if;

  v_dedupe := coalesce(p_dedupe_key_override, v_intent.dedupe_key);

  select *
    into v_existing
    from public.finance_payment_intents
   where escola_id = v_intent.escola_id
     and dedupe_key = v_dedupe
     and id <> v_intent.id
     and status = 'confirmed'
   limit 1;

  if found then
    return v_existing;
  end if;

  if v_intent.status = 'confirmed' then
    return v_intent;
  end if;

  if v_intent.status <> 'pending' then
    raise exception 'intent status % não pode ser confirmado', v_intent.status;
  end if;

  if p_dedupe_key_override is not null and v_intent.dedupe_key <> p_dedupe_key_override then
    update public.finance_payment_intents
       set dedupe_key = p_dedupe_key_override
     where id = v_intent.id;
  end if;

  v_before := jsonb_build_object(
    'status', v_intent.status,
    'confirmed_at', v_intent.confirmed_at,
    'confirmed_by', v_intent.confirmed_by
  );

  update public.finance_payment_intents
     set status = 'confirmed',
         confirmed_at = now(),
         confirmed_by = auth.uid()
   where id = v_intent.id
   returning * into v_intent;

  v_after := jsonb_build_object(
    'status', v_intent.status,
    'confirmed_at', v_intent.confirmed_at,
    'confirmed_by', v_intent.confirmed_by
  );

  if v_intent.mensalidade_id is not null then
    select *
      into v_mensalidade
      from public.mensalidades
     where id = v_intent.mensalidade_id
     for update;

    if found then
      v_metodo_pagamento := case
        when v_intent.method in ('dinheiro', 'numerario', 'cash') then 'dinheiro'
        when v_intent.method in ('tpa', 'tpa_fisico', 'tp') then 'tpa_fisico'
        when v_intent.method in ('transferencia', 'transferencia_bancaria') then 'transferencia'
        when v_intent.method in ('referencia') then 'referencia'
        else null
      end;

      update public.pagamentos
         set status = 'concluido',
             conciliado = true,
             data_pagamento = current_date,
             metodo_pagamento = v_metodo_pagamento,
             metodo = v_intent.method,
             referencia = v_intent.external_ref,
             escola_id = coalesce(escola_id, v_intent.escola_id)
       where transacao_id_externo is not null
         and transacao_id_externo = v_intent.external_ref
         and mensalidade_id = v_intent.mensalidade_id
       returning id into v_payment_id;

      if v_payment_id is null then
        insert into public.pagamentos (
          mensalidade_id,
          valor_pago,
          data_pagamento,
          conciliado,
          transacao_id_externo,
          metodo_pagamento,
          metodo,
          referencia,
          status,
          escola_id
        ) values (
          v_intent.mensalidade_id,
          v_intent.amount,
          current_date,
          true,
          v_intent.external_ref,
          v_metodo_pagamento,
          v_intent.method,
          v_intent.external_ref,
          'concluido',
          v_intent.escola_id
        )
        returning id into v_payment_id;
      end if;

      select coalesce(sum(valor_pago), 0)
        into v_total
        from public.pagamentos
       where mensalidade_id = v_intent.mensalidade_id
         and conciliado = true
         and status = 'concluido';

      v_expected := coalesce(v_mensalidade.valor_previsto, v_mensalidade.valor, 0);
      v_status := v_mensalidade.status;
      if v_expected > 0 and v_total >= v_expected then
        v_status := 'pago';
      elsif v_total > 0 then
        v_status := 'pago_parcial';
      end if;

      v_data_pagamento := case when v_status = 'pago' then current_date else v_mensalidade.data_pagamento_efetiva end;

      update public.mensalidades
         set valor_pago_total = v_total,
             status = v_status,
             data_pagamento_efetiva = v_data_pagamento,
             metodo_pagamento = v_intent.method
       where id = v_intent.mensalidade_id;

      perform public.create_audit_event(
        v_intent.escola_id,
        'FINANCE_PAYMENT_CONFIRMED',
        'mensalidades',
        v_intent.mensalidade_id::text,
        jsonb_build_object(
          'status', v_mensalidade.status,
          'valor_pago_total', v_mensalidade.valor_pago_total,
          'data_pagamento_efetiva', v_mensalidade.data_pagamento_efetiva
        ),
        jsonb_build_object(
          'status', v_status,
          'valor_pago_total', v_total,
          'data_pagamento_efetiva', v_data_pagamento
        ),
        'financeiro',
        jsonb_build_object(
          'intent_id', v_intent.id,
          'payment_id', v_payment_id
        )
      );
    end if;
  end if;

  perform public.create_audit_event(
    v_intent.escola_id,
    'FINANCE_PAYMENT_CONFIRMED',
    'finance_payment_intents',
    v_intent.id::text,
    v_before,
    v_after,
    'financeiro',
    jsonb_build_object(
      'mensalidade_id', v_intent.mensalidade_id
    )
  );

  insert into public.outbox_events (
    escola_id,
    event_type,
    dedupe_key,
    idempotency_key,
    payload
  ) values (
    v_intent.escola_id,
    'FINANCE_PAYMENT_CONFIRMED',
    v_intent.id,
    'finance_payment_confirmed:' || v_intent.id::text,
    jsonb_build_object(
      'intent_id', v_intent.id,
      'escola_id', v_intent.escola_id,
      'mensalidade_id', v_intent.mensalidade_id,
      'amount', v_intent.amount,
      'currency', v_intent.currency,
      'method', v_intent.method
    )
  )
  on conflict do nothing;

  return v_intent;
end;
$$;


ALTER FUNCTION "public"."finance_confirm_payment"("p_intent_id" "uuid", "p_dedupe_key_override" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."frequencia_resumo_periodo"("p_turma_id" "uuid", "p_periodo_letivo_id" "uuid") RETURNS TABLE("escola_id" "uuid", "turma_id" "uuid", "periodo_letivo_id" "uuid", "aluno_id" "uuid", "matricula_id" "uuid", "aulas_previstas" integer, "presencas" integer, "faltas" integer, "atrasos" integer, "percentual_presenca" numeric, "frequencia_min_percent" integer, "abaixo_minimo" boolean)
    LANGUAGE "sql"
    SET "search_path" TO 'public'
    AS $$
  with periodo as (
    select id, escola_id, data_inicio, data_fim
    from public.periodos_letivos
    where id = p_periodo_letivo_id
  ),
  config as (
    select escola_id, frequencia_min_percent
    from public.configuracoes_escola
  ),
  matriculas_base as (
    select id, aluno_id, turma_id, escola_id
    from public.matriculas
    where turma_id = p_turma_id
      and status in ('ativo','ativa','active')
  ),
  freq as (
    select f.escola_id, f.matricula_id, f.data, f.status
    from public.frequencias f
    join periodo p on p.escola_id = f.escola_id
    where f.data between p.data_inicio and p.data_fim
  )
  select
    m.escola_id,
    m.turma_id,
    p.id as periodo_letivo_id,
    m.aluno_id,
    m.id as matricula_id,
    count(f.data) as aulas_previstas,
    count(*) filter (where f.status = 'presente') as presencas,
    count(*) filter (where f.status = 'falta') as faltas,
    count(*) filter (where f.status = 'atraso') as atrasos,
    case
      when count(f.data) = 0 then 0
      else round((count(*) filter (where f.status = 'presente')::numeric / count(f.data)::numeric) * 100, 2)
    end as percentual_presenca,
    coalesce(cfg.frequencia_min_percent, 75) as frequencia_min_percent,
    case
      when count(f.data) = 0 then false
      else round((count(*) filter (where f.status = 'presente')::numeric / count(f.data)::numeric) * 100, 2)
        < coalesce(cfg.frequencia_min_percent, 75)
    end as abaixo_minimo
  from matriculas_base m
  join periodo p on p.escola_id = m.escola_id
  left join freq f on f.matricula_id = m.id and f.escola_id = m.escola_id
  left join config cfg on cfg.escola_id = m.escola_id
  group by m.escola_id, m.turma_id, p.id, m.aluno_id, m.id, cfg.frequencia_min_percent;
$$;


ALTER FUNCTION "public"."frequencia_resumo_periodo"("p_turma_id" "uuid", "p_periodo_letivo_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_activation_code"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- sem O/I/0/1
  result text := '';
  i int;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN 'KLASSE-' || result;
END;
$$;


ALTER FUNCTION "public"."generate_activation_code"() OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."gerar_mensalidades_lote"("p_escola_id" "uuid", "p_ano_letivo" integer, "p_mes_referencia" integer, "p_dia_vencimento_default" integer DEFAULT 10) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."gerar_mensalidades_lote"("p_escola_id" "uuid", "p_ano_letivo" integer, "p_mes_referencia" integer, "p_dia_vencimento_default" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."gerar_mensalidades_lote"("p_escola_id" "uuid", "p_ano_letivo" integer, "p_mes_referencia" integer, "p_dia_vencimento_default" integer DEFAULT 10, "p_turma_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."gerar_mensalidades_lote"("p_escola_id" "uuid", "p_ano_letivo" integer, "p_mes_referencia" integer, "p_dia_vencimento_default" integer, "p_turma_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_aluno_dossier"("p_escola_id" "uuid", "p_aluno_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."get_aluno_dossier"("p_escola_id" "uuid", "p_aluno_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_classes_sem_preco"("p_escola_id" "uuid", "p_ano_letivo" integer) RETURNS TABLE("curso_nome" "text", "classe_nome" "text", "missing_type" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    cur.nome::text AS curso_nome,
    cls.nome::text AS classe_nome,
    CASE
      WHEN ft.id IS NULL THEN 'sem_configuracao'
      WHEN ft.valor_matricula <= 0 AND ft.valor_mensalidade <= 0 THEN 'valores_zerados'
      WHEN ft.valor_mensalidade <= 0 THEN 'mensalidade_zero'
      ELSE 'matricula_zero'
    END AS missing_type
  FROM public.classes cls
  JOIN public.cursos cur ON cls.curso_id = cur.id
  LEFT JOIN public.financeiro_tabelas ft ON (
    ft.escola_id = p_escola_id
    AND ft.ano_letivo = p_ano_letivo
    AND ft.curso_id = cur.id
    AND ft.classe_id = cls.id
  )
  WHERE
    cur.escola_id = p_escola_id
    AND cur.ativo = true
    AND (
      ft.id IS NULL
      OR ft.valor_matricula <= 0
      OR ft.valor_mensalidade <= 0
    )
  ORDER BY cur.nome, cls.ordem;
END;
$$;


ALTER FUNCTION "public"."get_classes_sem_preco"("p_escola_id" "uuid", "p_ano_letivo" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_import_summary"("p_import_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."get_import_summary"("p_import_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_metricas_acesso_alunos"("p_escola_id" "uuid") RETURNS TABLE("total_alunos" integer, "acesso_liberado" integer, "sem_acesso" integer, "enviados_whatsapp" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    COUNT(*)::int AS total_alunos,
    COUNT(*) FILTER (WHERE COALESCE(acesso_liberado,false) = true)::int AS acesso_liberado,
    COUNT(*) FILTER (WHERE COALESCE(acesso_liberado,false) = false)::int AS sem_acesso,
    (
      SELECT COUNT(*)::int FROM public.outbox_notificacoes o
      WHERE o.escola_id = p_escola_id AND o.canal = 'whatsapp'
    ) AS enviados_whatsapp
  FROM public.alunos a
  WHERE a.escola_id = p_escola_id
    AND a.deleted_at IS NULL;
$$;


ALTER FUNCTION "public"."get_metricas_acesso_alunos"("p_escola_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_escola_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT escola_id FROM public.profiles WHERE user_id = auth.uid();
$$;


ALTER FUNCTION "public"."get_my_escola_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_escola_ids"() RETURNS "uuid"[]
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select array_agg(distinct coalesce(p.current_escola_id, p.escola_id))
  from public.profiles p
  where p.user_id = (select auth.uid());
$$;


ALTER FUNCTION "public"."get_my_escola_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_outbox_status_summary"() RETURNS TABLE("status" "text", "total" bigint, "oldest" timestamp with time zone, "newest" timestamp with time zone)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select status::text,
         count(*) as total,
         min(created_at) as oldest,
         max(created_at) as newest
    from public.outbox_events
   group by status
   order by total desc;
$$;


ALTER FUNCTION "public"."get_outbox_status_summary"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_pending_turmas_count"("p_escola_id" "uuid") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."get_pending_turmas_count"("p_escola_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_profile_dependencies"("p_user_id" "uuid") RETURNS TABLE("table_name" "text", "cnt" bigint)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
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


CREATE OR REPLACE FUNCTION "public"."get_propinas_por_turma"("p_ano_letivo" integer) RETURNS TABLE("escola_id" "uuid", "ano_letivo" integer, "turma_id" "uuid", "turma_nome" "text", "classe_label" "text", "turno" "text", "qtd_mensalidades" bigint, "qtd_em_atraso" bigint, "total_previsto" numeric, "total_pago" numeric, "total_em_atraso" numeric, "inadimplencia_pct" numeric)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."get_propinas_por_turma"("p_ano_letivo" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_recent_cron_runs"("p_limit" integer DEFAULT 30) RETURNS TABLE("jobid" bigint, "status" "text", "start_time" timestamp with time zone, "end_time" timestamp with time zone, "return_message" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select jobid, status, start_time, end_time, return_message
  from cron.job_run_details
  order by start_time desc
  limit greatest(1, least(p_limit, 100));
$$;


ALTER FUNCTION "public"."get_recent_cron_runs"("p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_staging_alunos_summary"("p_import_id" "uuid", "p_escola_id" "uuid") RETURNS TABLE("turma_codigo" "text", "ano_letivo" integer, "total_alunos" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."get_staging_alunos_summary"("p_import_id" "uuid", "p_escola_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_escola_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
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
    SET "search_path" TO 'public'
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


CREATE OR REPLACE FUNCTION "public"."guard_matricula_status_numero"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public', 'extensions'
    AS $$
begin
  -- normaliza status antes (se teu canonicalize roda em trigger separado, ok)
  if new.status in ('ativo','ativa') then
    if new.numero_matricula is null or btrim(new.numero_matricula::text) = '' then
      raise exception 'Matrícula não pode ficar ativa sem numero_matricula. Use confirmar_matricula().';
    end if;
  end if;

  -- se for pendente, força numero_matricula NULL (evita "pendente com número")
  if new.status in ('pendente','rascunho','indefinido') then
    new.numero_matricula := null;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."guard_matricula_status_numero"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hard_delete_aluno"("p_aluno_id" "uuid", "p_reason" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_escola_id uuid;
  v_role text;
BEGIN
  SELECT escola_id INTO v_escola_id
  FROM public.alunos
  WHERE id = p_aluno_id;

  IF v_escola_id IS NULL THEN
    RAISE EXCEPTION 'Aluno não encontrado';
  END IF;

  SELECT role INTO v_role
  FROM public.profiles
  WHERE user_id = auth.uid()
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT public.is_super_admin()
     AND COALESCE(v_role, '') NOT IN ('admin', 'admin_escola', 'global_admin', 'staff_admin') THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  IF NOT public.is_super_admin()
     AND NOT EXISTS (
       SELECT 1
       FROM public.profiles p
       WHERE p.user_id = auth.uid()
         AND (p.current_escola_id = v_escola_id OR p.escola_id = v_escola_id)
     ) THEN
    RAISE EXCEPTION 'Aluno não pertence à escola ativa';
  END IF;

  PERFORM public.create_audit_event(
    v_escola_id,
    'hard_delete',
    'aluno',
    p_aluno_id::text,
    NULL,
    NULL,
    'secretaria',
    jsonb_build_object('reason', p_reason)
  );

  DELETE FROM public.alunos
  WHERE id = p_aluno_id
    AND escola_id = v_escola_id;
END;
$$;


ALTER FUNCTION "public"."hard_delete_aluno"("p_aluno_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hard_delete_curso"("p_curso_id" "uuid", "p_escola_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public', 'extensions'
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.matriculas m
    JOIN public.turmas t ON t.id = m.turma_id
    WHERE t.curso_id = p_curso_id
      AND t.escola_id = p_escola_id
  ) THEN
    RAISE EXCEPTION 'Curso possui matrículas e não pode ser removido';
  END IF;

  DELETE FROM public.turmas t
  WHERE t.curso_id = p_curso_id
    AND t.escola_id = p_escola_id;

  DELETE FROM public.classes c
  WHERE c.curso_id = p_curso_id AND c.escola_id = p_escola_id;

  DELETE FROM public.disciplinas_legacy d
  WHERE d.curso_escola_id = p_curso_id AND d.escola_id = p_escola_id;

  DELETE FROM public.configuracoes_curriculo cc
  WHERE cc.curso_id = p_curso_id AND cc.escola_id = p_escola_id;

  PERFORM public.create_audit_event(
    p_escola_id,
    'hard_delete',
    'curso',
    p_curso_id::text,
    NULL,
    NULL,
    'secretaria',
    jsonb_build_object('deleted_at', now(), 'source', 'api_request', 'triggered_by_rpc', 'hard_delete_curso')
  );

  DELETE FROM public.cursos c
  WHERE c.id = p_curso_id AND c.escola_id = p_escola_id;
END;
$$;


ALTER FUNCTION "public"."hard_delete_curso"("p_curso_id" "uuid", "p_escola_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_access_to_escola"("_escola_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select _escola_id = any(public.get_my_escola_ids());
$$;


ALTER FUNCTION "public"."has_access_to_escola"("_escola_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_access_to_escola_fast"("p_escola_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.escola_users eu
    where eu.escola_id = p_escola_id
      and eu.user_id = auth.uid()
    limit 1
  )
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and (p.current_escola_id = p_escola_id or p.escola_id = p_escola_id)
    limit 1
  );
$$;


ALTER FUNCTION "public"."has_access_to_escola_fast"("p_escola_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."immutable_unaccent"("text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE PARALLEL SAFE
    SET "search_path" TO 'public'
    AS $_$
  select extensions.unaccent($1);
$_$;


ALTER FUNCTION "public"."immutable_unaccent"("text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."importar_alunos"("p_import_id" "uuid", "p_escola_id" "uuid", "p_ano_letivo" integer) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."importar_alunos"("p_import_id" "uuid", "p_escola_id" "uuid", "p_ano_letivo" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."importar_alunos_v2"("p_escola_id" "uuid", "p_ano_letivo" integer, "p_import_id" "uuid" DEFAULT NULL::"uuid", "p_alunos" "jsonb" DEFAULT '[]'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."importar_alunos_v2"("p_escola_id" "uuid", "p_ano_letivo" integer, "p_import_id" "uuid", "p_alunos" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."importar_alunos_v2"("p_escola_id" "uuid", "p_ano_letivo" integer, "p_import_id" "uuid", "p_alunos" "jsonb") IS 'Importa alunos alinhando com anos_letivos, turmas e matriculas (modelo novo)';



CREATE OR REPLACE FUNCTION "public"."importar_alunos_v4"("p_import_id" "uuid", "p_escola_id" "uuid", "p_modo" "text" DEFAULT 'migracao'::"text", "p_data_inicio_financeiro" "date" DEFAULT NULL::"date") RETURNS TABLE("ok" boolean, "imported" integer, "turmas_created" integer, "matriculas_pendentes" integer, "errors" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  r record;
  v_aluno_id uuid;
  v_turma_id uuid;
  v_curso_id uuid;
  v_imported int := 0;
  v_matriculas_pendentes int := 0;
  v_erros int := 0;
  v_turmas_created int := 0;
  v_code text;
  v_course_code text;
  v_class_num int;
  v_shift text;
  v_section text;
  v_ano_letivo int;
  v_rowcount int;
begin
  for r in
    select
      sa.*,
      sa.encarregado_nome as nome_encarregado,
      sa.encarregado_telefone as telefone_encarregado,
      sa.encarregado_email as email_encarregado
    from public.staging_alunos sa
    where sa.import_id = p_import_id
  loop
    begin
      v_aluno_id := null;

      -- A) DEDUP (BI > Nome+Data)
      if nullif(btrim(r.bi_numero), '') is not null then
        select a.id into v_aluno_id
        from public.alunos a
        where a.escola_id = p_escola_id
          and a.bi_numero = btrim(r.bi_numero)
        limit 1;
      end if;

      if v_aluno_id is null
         and nullif(btrim(r.nome), '') is not null
         and r.data_nascimento is not null
      then
        select a.id into v_aluno_id
        from public.alunos a
        where a.escola_id = p_escola_id
          and lower(a.nome_completo) = lower(btrim(r.nome))
          and a.data_nascimento = r.data_nascimento::date
        limit 1;
      end if;

      -- B) UPSERT ALUNO
      if v_aluno_id is null then
        insert into public.alunos (
          escola_id, nome, nome_completo, data_nascimento,
          bi_numero, nif, sexo, telefone,
          encarregado_nome, encarregado_telefone, encarregado_email,
          numero_processo_legado,
          status, import_id
        ) values (
          p_escola_id,
          coalesce(nullif(btrim(r.nome), ''), nullif(btrim(r.raw_data->>'NOME_COMPLETO'), '')),
          coalesce(nullif(btrim(r.nome), ''), nullif(btrim(r.raw_data->>'NOME_COMPLETO'), '')),
          coalesce(r.data_nascimento::date, (r.raw_data->>'DATA_NASCIMENTO')::date),
          coalesce(nullif(btrim(r.bi_numero), ''), nullif(btrim(r.raw_data->>'BI_NUMERO'), '')),
          coalesce(nullif(btrim(r.nif), ''), nullif(btrim(r.raw_data->>'NIF'), '')),
          coalesce(nullif(upper(btrim(r.sexo)), ''), nullif(upper(btrim(r.raw_data->>'GENERO')), '')),
          coalesce(nullif(btrim(r.telefone), ''), nullif(btrim(r.raw_data->>'TELEFONE'), '')),
          coalesce(nullif(btrim(r.nome_encarregado), ''), nullif(btrim(r.raw_data->>'NOME_ENCARREGADO'), '')),
          coalesce(nullif(btrim(r.telefone_encarregado), ''), nullif(btrim(r.raw_data->>'TELEFONE_ENCARREGADO'), '')),
          lower(coalesce(nullif(btrim(r.email_encarregado), ''), nullif(btrim(r.raw_data->>'EMAIL_ENCARREGADO'), ''))),
          coalesce(nullif(btrim(r.numero_processo), ''), nullif(btrim(r.raw_data->>'NUMERO_PROCESSO'), '')),
          'ativo',
          p_import_id
        )
        returning id into v_aluno_id;
      else
        update public.alunos a
        set
          nome = coalesce(nullif(btrim(r.nome), ''), nullif(btrim(r.raw_data->>'NOME_COMPLETO'), ''), a.nome),
          nome_completo = coalesce(nullif(btrim(r.nome), ''), nullif(btrim(r.raw_data->>'NOME_COMPLETO'), ''), a.nome_completo),
          data_nascimento = coalesce(r.data_nascimento::date, (r.raw_data->>'DATA_NASCIMENTO')::date, a.data_nascimento),
          bi_numero = coalesce(nullif(btrim(r.bi_numero), ''), nullif(btrim(r.raw_data->>'BI_NUMERO'), ''), a.bi_numero),
          nif = coalesce(nullif(btrim(r.nif), ''), nullif(btrim(r.raw_data->>'NIF'), ''), a.nif),
          sexo = coalesce(nullif(upper(btrim(r.sexo)), ''), nullif(upper(btrim(r.raw_data->>'GENERO')), ''), a.sexo),
          telefone = coalesce(nullif(btrim(r.telefone), ''), nullif(btrim(r.raw_data->>'TELEFONE'), ''), a.telefone),
          encarregado_nome = coalesce(nullif(btrim(r.nome_encarregado), ''), nullif(btrim(r.raw_data->>'NOME_ENCARREGADO'), ''), a.encarregado_nome),
          encarregado_telefone = coalesce(nullif(btrim(r.telefone_encarregado), ''), nullif(btrim(r.raw_data->>'TELEFONE_ENCARREGADO'), ''), a.encarregado_telefone),
          encarregado_email = coalesce(lower(nullif(btrim(r.email_encarregado), '')), lower(nullif(btrim(r.raw_data->>'EMAIL_ENCARREGADO'), '')), a.encarregado_email),
          numero_processo_legado = coalesce(a.numero_processo_legado, nullif(btrim(r.numero_processo), ''), nullif(btrim(r.raw_data->>'NUMERO_PROCESSO'), '')),
          updated_at = now(),
          import_id = p_import_id
        where a.id = v_aluno_id;
      end if;

      v_imported := v_imported + 1;

      -- C) MATRÍCULA (apenas no modo migração)
      if p_modo = 'migracao' and nullif(btrim(r.turma_codigo), '') is not null then
        v_turma_id := null;
        v_curso_id := null;
        v_ano_letivo := coalesce(r.ano_letivo, extract(year from now())::int);

        v_code := upper(regexp_replace(trim(r.turma_codigo), '\s+', '', 'g'));
        if v_code ~ '^[A-Z0-9]{2,8}-\d{1,2}-(M|T|N)-[A-Z]{1,2}$' then
          v_course_code := split_part(v_code, '-', 1);
          v_class_num   := split_part(v_code, '-', 2)::int;
          v_shift       := split_part(v_code, '-', 3);
          v_section     := split_part(v_code, '-', 4);

          -- Find curso ID if it exists, but don't create it
          select c.id into v_curso_id
          from public.cursos c
          where c.escola_id = p_escola_id
            and c.course_code = v_course_code
          limit 1;

          -- ✅ SSOT: procurar por turma_codigo (não turma_code)
          select t.id into v_turma_id
          from public.turmas t
          where t.escola_id = p_escola_id
            and t.ano_letivo = v_ano_letivo
            and t.turma_codigo = v_code
          limit 1;

          if v_turma_id is null then
            insert into public.turmas (
              escola_id, ano_letivo, turma_code, curso_id, classe_num, turno, letra,
              turma_codigo, nome, status_validacao, import_id
            )
            values (
              p_escola_id, v_ano_letivo, v_code, v_curso_id, v_class_num, v_shift, v_section,
              v_code, v_code || ' (Auto)', 'rascunho', p_import_id
            )
            -- ✅ SSOT: conflitar por turma_codigo (full unique)
            on conflict (escola_id, ano_letivo, turma_codigo)
            do update set curso_id = excluded.curso_id
            returning id into v_turma_id;

            v_turmas_created := v_turmas_created + 1;
          end if;

          -- INSERT MATRICULA PENDENTE
          if v_turma_id is not null then
            insert into public.matriculas (
              escola_id, aluno_id, turma_id, ano_letivo,
              status, ativo, data_matricula,
              numero_matricula,
              data_inicio_financeiro,
              import_id
            ) values (
              p_escola_id, v_aluno_id, v_turma_id, v_ano_letivo,
              'pendente', false, current_date,
              null,
              p_data_inicio_financeiro,
              p_import_id
            )
            on conflict (escola_id, aluno_id, ano_letivo) do nothing;

            get diagnostics v_rowcount = row_count;
            if v_rowcount > 0 then
              v_matriculas_pendentes := v_matriculas_pendentes + 1;
            end if;
          end if;
        end if;
      end if;

    exception when others then
      v_erros := v_erros + 1;
      insert into public.import_errors(import_id, message, raw_value)
      values (p_import_id, sqlerrm, coalesce(r.nome, ''));
    end;
  end loop;

  return query select true, v_imported, v_turmas_created, v_matriculas_pendentes, v_erros;
end;
$_$;


ALTER FUNCTION "public"."importar_alunos_v4"("p_import_id" "uuid", "p_escola_id" "uuid", "p_modo" "text", "p_data_inicio_financeiro" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."initcap_angola"("text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $_$
BEGIN
  -- Converte "JOÃO DA SILVA" para "João da Silva"
  RETURN initcap(lower(trim($1)));
END;
$_$;


ALTER FUNCTION "public"."initcap_angola"("text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin_escola"() RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select public.is_escola_admin(public.current_tenant_escola_id());
$$;


ALTER FUNCTION "public"."is_admin_escola"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_escola_admin"("p_escola_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.escola_users
    WHERE escola_id = p_escola_id
      AND user_id = auth.uid()
      AND papel IN ('admin', 'admin_escola')
  );
END;
$$;


ALTER FUNCTION "public"."is_escola_admin"("p_escola_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_escola_diretor"("p_escola_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.escola_users
    WHERE escola_id = p_escola_id
      AND user_id = auth.uid()
      AND papel = 'diretor'
  );
END;
$$;


ALTER FUNCTION "public"."is_escola_diretor"("p_escola_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_escola_member"("p_escola_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.escola_users
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


CREATE OR REPLACE FUNCTION "public"."liberar_acesso_alunos_v2"("p_escola_id" "uuid", "p_aluno_ids" "uuid"[], "p_canal" "text" DEFAULT 'whatsapp'::"text") RETURNS TABLE("aluno_id" "uuid", "codigo_ativacao" "text", "request_id" "uuid", "enfileirado" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_aluno_id uuid;
  v_code text;
  v_request_id uuid := gen_random_uuid();
  v_attempts int;
BEGIN
  IF p_canal NOT IN ('whatsapp','email') THEN
    RAISE EXCEPTION 'canal inválido: %', p_canal;
  END IF;

  IF NOT public.can_manage_school(p_escola_id) THEN
    RAISE EXCEPTION 'sem permissão para escola %', p_escola_id;
  END IF;

  FOREACH v_aluno_id IN ARRAY p_aluno_ids LOOP
    -- Confirma elegibilidade
    IF NOT EXISTS (
      SELECT 1 FROM public.alunos a
      WHERE a.id = v_aluno_id
        AND a.escola_id = p_escola_id
        AND a.deleted_at IS NULL
        AND COALESCE(a.status,'') <> 'inativo'
        AND COALESCE(a.acesso_liberado, false) = false
    ) THEN
      CONTINUE;
    END IF;

    -- Se já existir usuário vinculado, apenas reenfileira notificação (idempotência)
    PERFORM 1 FROM public.alunos a
     WHERE a.id = v_aluno_id
       AND a.escola_id = p_escola_id
       AND a.usuario_auth_id IS NOT NULL;
    IF FOUND THEN
      INSERT INTO public.outbox_notificacoes (escola_id, aluno_id, canal, status, request_id)
      VALUES (p_escola_id, v_aluno_id, p_canal, 'pending', v_request_id)
      ON CONFLICT DO NOTHING;

      aluno_id := v_aluno_id;
      codigo_ativacao := NULL;
      request_id := v_request_id;
      enfileirado := true;
      RETURN NEXT;
      CONTINUE;
    END IF;

    v_attempts := 0;
    LOOP
      v_attempts := v_attempts + 1;
      v_code := public.generate_activation_code();
      BEGIN
        UPDATE public.alunos
           SET codigo_ativacao = v_code,
               acesso_liberado = true,
               data_ativacao = now()
         WHERE id = v_aluno_id
           AND escola_id = p_escola_id
           AND COALESCE(acesso_liberado, false) = false;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        IF v_attempts >= 6 THEN
          RAISE EXCEPTION 'falha ao gerar código único para aluno %', v_aluno_id;
        END IF;
        -- tenta novamente
      END;
    END LOOP;

    INSERT INTO public.outbox_notificacoes (escola_id, aluno_id, canal, status, request_id)
    VALUES (p_escola_id, v_aluno_id, p_canal, 'pending', v_request_id);

    aluno_id := v_aluno_id;
    codigo_ativacao := v_code;
    request_id := v_request_id;
    enfileirado := true;
    RETURN NEXT;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."liberar_acesso_alunos_v2"("p_escola_id" "uuid", "p_aluno_ids" "uuid"[], "p_canal" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lock_curriculo_install"("p_escola_id" "uuid", "p_preset_key" "text", "p_ano_letivo_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_escola_id uuid := public.current_tenant_escola_id();
begin
  if v_escola_id is null then
    raise exception 'tenant not resolved';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      v_escola_id::text || ':' || coalesce(p_preset_key, '') || ':' || coalesce(p_ano_letivo_id::text, ''),
      0
    )
  );
end;
$$;


ALTER FUNCTION "public"."lock_curriculo_install"("p_escola_id" "uuid", "p_preset_key" "text", "p_ano_letivo_id" "uuid") OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."mark_outbox_event_failed"("p_event_id" "uuid", "p_error" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_escola_id uuid;
begin
  select escola_id into v_escola_id
  from public.outbox_events
  where id = p_event_id;

  if v_escola_id is null then
    return;
  end if;

  if not public.user_has_role_in_school(
    v_escola_id,
    array['admin_escola','secretaria','admin','financeiro','professor','staff_admin']
  ) then
    raise exception 'sem permissão para escola %', v_escola_id;
  end if;

  update public.outbox_events
     set status = 'failed',
         last_error = p_error,
         next_attempt_at = now(),
         locked_at = null,
         locked_by = null
   where id = p_event_id;
end;
$$;


ALTER FUNCTION "public"."mark_outbox_event_failed"("p_event_id" "uuid", "p_error" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_outbox_event_processed"("p_event_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_escola_id uuid;
begin
  select escola_id into v_escola_id
  from public.outbox_events
  where id = p_event_id;

  if v_escola_id is null then
    return;
  end if;

  if not public.user_has_role_in_school(
    v_escola_id,
    array['admin_escola','secretaria','admin','financeiro','professor','staff_admin']
  ) then
    raise exception 'sem permissão para escola %', v_escola_id;
  end if;

  update public.outbox_events
     set status = 'sent',
         processed_at = now(),
         last_error = null
   where id = p_event_id;
end;
$$;


ALTER FUNCTION "public"."mark_outbox_event_processed"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."matricula_counter_floor"("p_escola_id" "uuid") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."matricula_counter_floor"("p_escola_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."matricular_em_massa"("p_import_id" "uuid", "p_escola_id" "uuid", "p_curso_codigo" "text", "p_classe_numero" integer, "p_turno_codigo" "text", "p_turma_letra" "text", "p_ano_letivo" integer, "p_turma_id" "uuid") RETURNS TABLE("success_count" integer, "error_count" integer, "errors" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."matricular_em_massa"("p_import_id" "uuid", "p_escola_id" "uuid", "p_curso_codigo" "text", "p_classe_numero" integer, "p_turno_codigo" "text", "p_turma_letra" "text", "p_ano_letivo" integer, "p_turma_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."matricular_em_massa_por_turma"("p_import_id" "uuid", "p_escola_id" "uuid", "p_turma_id" "uuid") RETURNS TABLE("success_count" integer, "error_count" integer, "errors" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."matricular_em_massa_por_turma"("p_import_id" "uuid", "p_escola_id" "uuid", "p_turma_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."matricular_lista_alunos"("p_escola_id" "uuid", "p_turma_id" "uuid", "p_ano_letivo" integer, "p_aluno_ids" "uuid"[]) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."matricular_lista_alunos"("p_escola_id" "uuid", "p_turma_id" "uuid", "p_ano_letivo" integer, "p_aluno_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."matriculas_status_before_ins_upd"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.status := public.canonicalize_matricula_status_text(NEW.status);
  IF NEW.status IS NULL OR btrim(NEW.status) = '' THEN
    NEW.status := 'indefinido';
  END IF;
  RETURN NEW;
END
$$;


ALTER FUNCTION "public"."matriculas_status_before_ins_upd"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."move_profile_to_archive"("p_user_id" "uuid", "p_performed_by" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


CREATE OR REPLACE FUNCTION "public"."next_matricula_number"("p_escola_id" "uuid") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."next_matricula_number"("p_escola_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."next_numero_processo"("p_escola_id" "uuid", "p_year" integer) RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_next bigint;
BEGIN
  INSERT INTO public.aluno_processo_counters (escola_id, last_value) VALUES (p_escola_id, 0) ON CONFLICT (escola_id) DO NOTHING;
  UPDATE public.aluno_processo_counters SET last_value = last_value + 1 WHERE escola_id = p_escola_id RETURNING last_value INTO v_next;
  RETURN p_year::text || '-' || lpad(v_next::text, 6, '0');
END;
$$;


ALTER FUNCTION "public"."next_numero_processo"("p_escola_id" "uuid", "p_year" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_course_code"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.course_code IS NOT NULL THEN
    NEW.course_code := upper(regexp_replace(trim(NEW.course_code), '\\s+', '', 'g'));
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."normalize_course_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_date"("input_text" "text") RETURNS "date"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."normalize_date"("input_text" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_text"("input_text" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."normalize_text"("input_text" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_turma_code"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.turma_code IS NOT NULL THEN
    NEW.turma_code := upper(regexp_replace(trim(NEW.turma_code), '\\s+', '', 'g'));
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."normalize_turma_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_turma_code"("p_code" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."normalize_turma_code"("p_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."outbox_claim"("batch_size" integer DEFAULT 25, "worker_id" "text" DEFAULT NULL::"text") RETURNS SETOF "public"."outbox_events"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_worker text := coalesce(worker_id, 'worker');
begin
  return query
  with cte as (
    select id
    from public.outbox_events
    where status in ('pending','failed')
      and next_attempt_at <= now()
      and attempt_count < max_attempts
    order by next_attempt_at asc, created_at asc
    for update skip locked
    limit greatest(1, least(batch_size, 50))
  )
  update public.outbox_events e
    set status = 'processing',
        locked_at = now(),
        locked_by = v_worker
  from cte
  where e.id = cte.id
  returning e.*;
end;
$$;


ALTER FUNCTION "public"."outbox_claim"("batch_size" integer, "worker_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."outbox_report_result"("p_id" "uuid", "p_ok" boolean, "p_error" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_attempt int;
  v_max int;
  v_backoff interval;
begin
  select attempt_count, max_attempts into v_attempt, v_max
  from public.outbox_events
  where id = p_id
  for update;

  if not found then
    return;
  end if;

  if p_ok then
    update public.outbox_events
      set status = 'sent',
          last_error = null,
          locked_at = null,
          locked_by = null
    where id = p_id;
    return;
  end if;

  -- falhou
  v_attempt := v_attempt + 1;

  -- backoff exponencial com teto (ex: 5m, 15m, 1h, 6h...)
  v_backoff :=
    case
      when v_attempt <= 1 then interval '2 minutes'
      when v_attempt = 2 then interval '5 minutes'
      when v_attempt = 3 then interval '15 minutes'
      when v_attempt = 4 then interval '1 hour'
      when v_attempt = 5 then interval '3 hours'
      else interval '6 hours'
    end;

  if v_attempt >= v_max then
    update public.outbox_events
      set status = 'dead',
          attempt_count = v_attempt,
          last_error = left(coalesce(p_error,'unknown error'), 2000),
          locked_at = null,
          locked_by = null
    where id = p_id;
  else
    update public.outbox_events
      set status = 'failed',
          attempt_count = v_attempt,
          next_attempt_at = now() + v_backoff,
          last_error = left(coalesce(p_error,'unknown error'), 2000),
          locked_at = null,
          locked_by = null
    where id = p_id;
  end if;
end;
$$;


ALTER FUNCTION "public"."outbox_report_result"("p_id" "uuid", "p_ok" boolean, "p_error" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."outbox_requeue_stuck"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  update public.outbox_events
     set status = 'failed',
         next_attempt_at = now(),
         locked_at = null,
         locked_by = null,
         last_error = coalesce(last_error, '') || ' | requeued_stuck'
   where status = 'processing'
     and locked_at < now() - interval '15 minutes';
end;
$$;


ALTER FUNCTION "public"."outbox_requeue_stuck"() OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."preview_matricula_number"("p_escola_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."preview_matricula_number"("p_escola_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_outbox_batch"("p_limit" integer DEFAULT 50) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_event public.outbox_events%rowtype;
  v_processed int := 0;
  v_backoff interval;
  v_lock boolean;
begin
  v_lock := pg_try_advisory_lock(hashtext('outbox_finance_worker'));
  if not v_lock then
    return 0;
  end if;

  for v_event in
    with candidate as (
      select id
        from public.outbox_events
       where status in ('pending', 'failed')
         and next_attempt_at <= now()
         and attempts < max_attempts
         and event_type = 'FINANCE_PAYMENT_CONFIRMED'
       order by next_attempt_at asc, created_at asc
       limit greatest(1, least(p_limit, 50))
       for update skip locked
    )
    update public.outbox_events o
       set status = 'processing',
           locked_at = now(),
           locked_by = 'cron',
           attempts = o.attempts + 1
     where o.id in (select id from candidate)
    returning o.*
  loop
    begin
      perform public.refresh_mv_pagamentos_status();
      perform public.refresh_mv_radar_inadimplencia();

      update public.outbox_events
         set status = 'sent',
             processed_at = now(),
             last_error = null,
             locked_at = null,
             locked_by = null
       where id = v_event.id;

      v_processed := v_processed + 1;
    exception when others then
      v_backoff :=
        case
          when v_event.attempts <= 1 then interval '2 minutes'
          when v_event.attempts = 2 then interval '5 minutes'
          when v_event.attempts = 3 then interval '15 minutes'
          when v_event.attempts = 4 then interval '1 hour'
          when v_event.attempts = 5 then interval '3 hours'
          else interval '6 hours'
        end;

      if v_event.attempts >= v_event.max_attempts then
        update public.outbox_events
           set status = 'dead',
               last_error = left(sqlerrm, 2000),
               locked_at = null,
               locked_by = null
         where id = v_event.id;
      else
        update public.outbox_events
           set status = 'failed',
               next_attempt_at = now() + v_backoff,
               last_error = left(sqlerrm, 2000),
               locked_at = null,
               locked_by = null
         where id = v_event.id;
      end if;
    end;
  end loop;

  perform pg_advisory_unlock(hashtext('outbox_finance_worker'));
  return v_processed;
end;
$$;


ALTER FUNCTION "public"."process_outbox_batch"("p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."professor_list_presencas_turma"("p_turma_id" "uuid", "p_data_inicio" "date", "p_data_fim" "date") RETURNS TABLE("escola_id" "uuid", "turma_id" "uuid", "matricula_id" "uuid", "aluno_id" "uuid", "aluno_nome" "text", "data" "date", "status" "text", "disciplina_id" "uuid")
    LANGUAGE "sql"
    SET "search_path" TO 'public'
    AS $$
  select
    v.escola_id,
    v.turma_id,
    v.matricula_id,
    v.aluno_id,
    v.aluno_nome,
    v.data,
    v.status,
    v.disciplina_id
  from public.vw_presencas_por_turma v
  where v.turma_id = p_turma_id
    and v.data between p_data_inicio and p_data_fim
    and v.escola_id = public.current_tenant_escola_id()
    and exists (
      select 1
      from public.professores pr
      where pr.profile_id = auth.uid()
        and pr.escola_id = v.escola_id
        and (
          exists (
            select 1
            from public.turma_disciplinas td
            where td.turma_id = v.turma_id
              and td.escola_id = v.escola_id
              and td.professor_id = pr.id
          )
          or exists (
            select 1
            from public.turma_disciplinas_professores tdp
            where tdp.turma_id = v.turma_id
              and tdp.escola_id = v.escola_id
              and tdp.professor_id = pr.id
          )
        )
    );
$$;


ALTER FUNCTION "public"."professor_list_presencas_turma"("p_turma_id" "uuid", "p_data_inicio" "date", "p_data_fim" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."public_get_documento_by_token"("p_public_id" "uuid", "p_hash" "text") RETURNS TABLE("id" "uuid", "escola_id" "uuid", "tipo" "text", "emitted_at" timestamp with time zone, "payload" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  -- validação básica anti-lixo
  if p_public_id is null then
    raise exception 'invalid token';
  end if;
  if p_hash is null or length(p_hash) < 16 then
    raise exception 'invalid token';
  end if;

  return query
  select
    de.id,
    de.escola_id,
    de.tipo,
    de.created_at as emitted_at,
    de.dados_snapshot as payload
  from public.documentos_emitidos de
  where de.public_id = p_public_id
    and de.hash_validacao = p_hash
  limit 1;
end;
$$;


ALTER FUNCTION "public"."public_get_documento_by_token"("p_public_id" "uuid", "p_hash" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_all_materialized_views"() RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_temp'
    AS $$
begin
  begin execute 'refresh materialized view public.mv_financeiro_escola_dia'; exception when undefined_table then null; end;
  begin execute 'refresh materialized view public.mv_freq_por_turma_dia'; exception when undefined_table then null; end;
  begin execute 'refresh materialized view public.mv_media_por_curso'; exception when undefined_table then null; end;
end$$;


ALTER FUNCTION "public"."refresh_all_materialized_views"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_frequencia_status_periodo"("p_turma_id" "uuid", "p_periodo_letivo_id" "uuid") RETURNS "void"
    LANGUAGE "sql"
    SET "search_path" TO 'public'
    AS $$
  insert into public.frequencia_status_periodo (
    escola_id,
    turma_id,
    periodo_letivo_id,
    aluno_id,
    matricula_id,
    aulas_previstas,
    presencas,
    faltas,
    atrasos,
    percentual_presenca,
    frequencia_min_percent,
    abaixo_minimo,
    updated_at
  )
  select
    escola_id,
    turma_id,
    periodo_letivo_id,
    aluno_id,
    matricula_id,
    aulas_previstas,
    presencas,
    faltas,
    atrasos,
    percentual_presenca,
    frequencia_min_percent,
    abaixo_minimo,
    now()
  from public.frequencia_resumo_periodo(p_turma_id, p_periodo_letivo_id)
  on conflict (escola_id, turma_id, periodo_letivo_id, aluno_id)
  do update set
    aulas_previstas = excluded.aulas_previstas,
    presencas = excluded.presencas,
    faltas = excluded.faltas,
    atrasos = excluded.atrasos,
    percentual_presenca = excluded.percentual_presenca,
    frequencia_min_percent = excluded.frequencia_min_percent,
    abaixo_minimo = excluded.abaixo_minimo,
    updated_at = now();
$$;


ALTER FUNCTION "public"."refresh_frequencia_status_periodo"("p_turma_id" "uuid", "p_periodo_letivo_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_mv_admin_dashboard_counts"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_admin_dashboard_counts;
END;
$$;


ALTER FUNCTION "public"."refresh_mv_admin_dashboard_counts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_mv_admin_matriculas_por_mes"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_admin_matriculas_por_mes;
END;
$$;


ALTER FUNCTION "public"."refresh_mv_admin_matriculas_por_mes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_mv_admin_pending_turmas_count"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  refresh materialized view concurrently public.mv_admin_pending_turmas_count;
end;
$$;


ALTER FUNCTION "public"."refresh_mv_admin_pending_turmas_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_mv_admissoes_counts_por_status"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  refresh materialized view concurrently public.mv_admissoes_counts_por_status;
end;
$$;


ALTER FUNCTION "public"."refresh_mv_admissoes_counts_por_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_mv_cursos_reais"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_cursos_reais;
END;
$$;


ALTER FUNCTION "public"."refresh_mv_cursos_reais"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_mv_escola_estrutura_counts"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  refresh materialized view concurrently public.mv_escola_estrutura_counts;
end;
$$;


ALTER FUNCTION "public"."refresh_mv_escola_estrutura_counts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_mv_escola_setup_status"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  refresh materialized view concurrently public.mv_escola_setup_status;
end;
$$;


ALTER FUNCTION "public"."refresh_mv_escola_setup_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_mv_financeiro_cobrancas_diario"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  refresh materialized view concurrently public.mv_financeiro_cobrancas_diario;
end;
$$;


ALTER FUNCTION "public"."refresh_mv_financeiro_cobrancas_diario"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_mv_financeiro_kpis_geral"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  refresh materialized view concurrently public.mv_financeiro_kpis_geral;
end;
$$;


ALTER FUNCTION "public"."refresh_mv_financeiro_kpis_geral"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_mv_financeiro_kpis_mes"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  refresh materialized view concurrently public.mv_financeiro_kpis_mes;
end;
$$;


ALTER FUNCTION "public"."refresh_mv_financeiro_kpis_mes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_mv_financeiro_radar_resumo"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  refresh materialized view concurrently public.mv_financeiro_radar_resumo;
end;
$$;


ALTER FUNCTION "public"."refresh_mv_financeiro_radar_resumo"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_mv_financeiro_sidebar_badges"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  refresh materialized view concurrently public.mv_financeiro_sidebar_badges;
end;
$$;


ALTER FUNCTION "public"."refresh_mv_financeiro_sidebar_badges"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_mv_migracao_cursos_lookup"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_migracao_cursos_lookup;
END;
$$;


ALTER FUNCTION "public"."refresh_mv_migracao_cursos_lookup"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_mv_migracao_turmas_lookup"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_migracao_turmas_lookup;
END;
$$;


ALTER FUNCTION "public"."refresh_mv_migracao_turmas_lookup"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_mv_ocupacao_turmas"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  refresh materialized view concurrently public.mv_ocupacao_turmas;
end;
$$;


ALTER FUNCTION "public"."refresh_mv_ocupacao_turmas"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_mv_pagamentos_status"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  refresh materialized view concurrently public.mv_pagamentos_status;
end;
$$;


ALTER FUNCTION "public"."refresh_mv_pagamentos_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_mv_radar_inadimplencia"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  refresh materialized view concurrently public.mv_radar_inadimplencia;
end;
$$;


ALTER FUNCTION "public"."refresh_mv_radar_inadimplencia"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_mv_secretaria_dashboard_counts"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_secretaria_dashboard_counts;
END;
$$;


ALTER FUNCTION "public"."refresh_mv_secretaria_dashboard_counts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_mv_secretaria_dashboard_kpis"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  refresh materialized view concurrently public.mv_secretaria_dashboard_kpis;
end;
$$;


ALTER FUNCTION "public"."refresh_mv_secretaria_dashboard_kpis"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_mv_secretaria_matriculas_status"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_secretaria_matriculas_status;
END;
$$;


ALTER FUNCTION "public"."refresh_mv_secretaria_matriculas_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_mv_secretaria_matriculas_turma_status"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_secretaria_matriculas_turma_status;
END;
$$;


ALTER FUNCTION "public"."refresh_mv_secretaria_matriculas_turma_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_mv_staging_alunos_summary"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_staging_alunos_summary;
END;
$$;


ALTER FUNCTION "public"."refresh_mv_staging_alunos_summary"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_mv_total_em_aberto_por_mes"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  refresh materialized view concurrently public.mv_total_em_aberto_por_mes;
end;
$$;


ALTER FUNCTION "public"."refresh_mv_total_em_aberto_por_mes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_mv_turmas_para_matricula"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  refresh materialized view concurrently public.mv_turmas_para_matricula;
end;
$$;


ALTER FUNCTION "public"."refresh_mv_turmas_para_matricula"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."registrar_pagamento"("p_mensalidade_id" "uuid", "p_metodo_pagamento" "text", "p_observacao" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."registrar_pagamento"("p_mensalidade_id" "uuid", "p_metodo_pagamento" "text", "p_observacao" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."registrar_venda_avulsa"("p_escola_id" "uuid", "p_aluno_id" "uuid", "p_item_id" "uuid", "p_quantidade" integer, "p_valor_unit" numeric, "p_desconto" numeric DEFAULT 0, "p_metodo_pagamento" "public"."metodo_pagamento_enum" DEFAULT 'numerario'::"public"."metodo_pagamento_enum", "p_status" "public"."financeiro_status" DEFAULT 'pago'::"public"."financeiro_status", "p_descricao" "text" DEFAULT NULL::"text", "p_created_by" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("lancamento_id" "uuid", "estoque_atual" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."registrar_venda_avulsa"("p_escola_id" "uuid", "p_aluno_id" "uuid", "p_item_id" "uuid", "p_quantidade" integer, "p_valor_unit" numeric, "p_desconto" numeric, "p_metodo_pagamento" "public"."metodo_pagamento_enum", "p_status" "public"."financeiro_status", "p_descricao" "text", "p_created_by" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rematricula_em_massa"("p_escola_id" "uuid", "p_origem_turma_id" "uuid", "p_destino_turma_id" "uuid") RETURNS TABLE("inserted" integer, "skipped" integer, "errors" "jsonb")
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."rematricula_em_massa"("p_escola_id" "uuid", "p_origem_turma_id" "uuid", "p_destino_turma_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."request_liberar_acesso"("p_escola_id" "uuid", "p_aluno_ids" "uuid"[], "p_canal" "text" DEFAULT 'whatsapp'::"text") RETURNS TABLE("aluno_id" "uuid", "codigo_ativacao" "text", "request_id" "uuid", "enfileirado" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  row record;
BEGIN
  IF NOT public.can_manage_school(p_escola_id) THEN
    RAISE EXCEPTION 'sem permissão para escola %', p_escola_id;
  END IF;

  FOR row IN
    SELECT * FROM public.liberar_acesso_alunos_v2(p_escola_id, p_aluno_ids, p_canal)
  LOOP
    PERFORM public.enqueue_outbox_event(
      p_escola_id,
      'auth_provision_student',
      jsonb_build_object(
        'aluno_id', row.aluno_id,
        'canal', p_canal,
        'actor_user_id', auth.uid()
      ),
      row.request_id,
      'AUTH_PROVISION_USER:' || p_escola_id::text || ':' || row.aluno_id::text
    );

    aluno_id := row.aluno_id;
    codigo_ativacao := row.codigo_ativacao;
    request_id := row.request_id;
    enfileirado := row.enfileirado;
    RETURN NEXT;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."request_liberar_acesso"("p_escola_id" "uuid", "p_aluno_ids" "uuid"[], "p_canal" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resync_matricula_counter"("p_escola_id" "uuid") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."resync_matricula_counter"("p_escola_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."retry_outbox_event"("p_event_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_escola_id uuid;
BEGIN
  SELECT escola_id INTO v_escola_id
  FROM public.outbox_events
  WHERE id = p_event_id;

  IF v_escola_id IS NULL THEN
    RAISE EXCEPTION 'Outbox event não encontrado';
  END IF;

  IF NOT public.can_manage_school(v_escola_id) THEN
    RAISE EXCEPTION 'sem permissão para escola %', v_escola_id;
  END IF;

  UPDATE public.outbox_events
     SET status = 'pending',
         next_run_at = now(),
         last_error = NULL
   WHERE id = p_event_id;
END;
$$;


ALTER FUNCTION "public"."retry_outbox_event"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_alunos_global"("p_escola_id" "uuid", "p_query" "text", "p_limit" integer DEFAULT 10) RETURNS TABLE("id" "uuid", "nome" "text", "processo" "text", "turma" "text", "status" "text", "aluno_status" "text", "turma_id" "uuid", "aluno_bi" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_query text := coalesce(trim(p_query), '');
  v_limit int := LEAST(GREATEST(coalesce(p_limit, 10), 1), 50);
  v_tsquery tsquery := NULL;
  v_tokens text[];
  v_tsquery_text text;
BEGIN
  IF p_escola_id IS DISTINCT FROM public.current_tenant_escola_id() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF v_query = '' OR length(v_query) < 2 THEN
    RETURN;
  END IF;

  v_query := replace(v_query, '''', ' ');

  v_tokens := regexp_split_to_array(regexp_replace(v_query, '\\s+', ' ', 'g'), ' ');
  v_tsquery_text := array_to_string(
    ARRAY(
      SELECT regexp_replace(t, '[^[:alnum:]_]+', '', 'g') || ':*'
      FROM unnest(v_tokens) t
      WHERE length(t) > 0
    ),
    ' & '
  );

  IF v_tsquery_text <> '' THEN
    v_tsquery := to_tsquery('simple', v_tsquery_text);
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT
      a.id,
      coalesce(a.nome_completo, a.nome) AS nome,
      a.numero_processo AS processo,
      a.status AS aluno_status,
      a.bi_numero AS aluno_bi,
      a.updated_at,
      a.created_at,
      GREATEST(
        CASE
          WHEN v_tsquery IS NULL THEN 0
          ELSE ts_rank(to_tsvector('simple', a.search_text), v_tsquery)
        END,
        similarity(coalesce(a.nome_completo, a.nome), v_query),
        similarity(coalesce(a.numero_processo, ''), v_query),
        similarity(coalesce(a.bi_numero, ''), v_query)
      ) AS score
    FROM public.alunos a
    WHERE a.escola_id = p_escola_id
      AND a.deleted_at IS NULL
      AND (
        (v_tsquery IS NOT NULL AND to_tsvector('simple', a.search_text) @@ v_tsquery)
        OR similarity(coalesce(a.nome_completo, a.nome), v_query) > 0.2
        OR similarity(coalesce(a.numero_processo, ''), v_query) > 0.25
        OR similarity(coalesce(a.bi_numero, ''), v_query) > 0.25
      )
    ORDER BY score DESC, a.updated_at DESC NULLS LAST, a.created_at DESC, a.id DESC
    LIMIT v_limit
  )
  SELECT
    c.id,
    c.nome,
    c.processo,
    coalesce(t.nome, 'Sem turma') AS turma,
    coalesce(m.status, 'sem_matricula') AS status,
    c.aluno_status,
    t.id AS turma_id,
    c.aluno_bi
  FROM candidates c
  LEFT JOIN LATERAL (
    SELECT m.turma_id, m.status, m.data_matricula, m.created_at
    FROM public.matriculas m
    WHERE m.aluno_id = c.id
      AND m.escola_id = p_escola_id
    ORDER BY m.data_matricula DESC NULLS LAST, m.created_at DESC
    LIMIT 1
  ) m ON TRUE
  LEFT JOIN public.turmas t ON t.id = m.turma_id
  ORDER BY c.score DESC, c.updated_at DESC NULLS LAST, c.created_at DESC, c.id DESC;
END;
$$;


ALTER FUNCTION "public"."search_alunos_global"("p_escola_id" "uuid", "p_query" "text", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_alunos_global_min"("p_escola_id" "uuid", "p_query" "text", "p_limit" integer DEFAULT 10) RETURNS TABLE("id" "uuid", "label" "text", "type" "text", "highlight" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_query text := coalesce(trim(p_query), '');
  v_limit int := LEAST(GREATEST(coalesce(p_limit, 10), 1), 50);
  v_tsquery tsquery := NULL;
  v_tokens text[];
  v_tsquery_text text;
BEGIN
  IF p_escola_id IS DISTINCT FROM public.current_tenant_escola_id() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF v_query = '' OR length(v_query) < 2 THEN
    RETURN;
  END IF;

  v_query := replace(v_query, '''', ' ');

  v_tokens := regexp_split_to_array(regexp_replace(v_query, '\\s+', ' ', 'g'), ' ');
  v_tsquery_text := array_to_string(
    ARRAY(
      SELECT regexp_replace(t, '[^[:alnum:]_]+', '', 'g') || ':*'
      FROM unnest(v_tokens) t
      WHERE length(t) > 0
    ),
    ' & '
  );

  IF v_tsquery_text <> '' THEN
    v_tsquery := to_tsquery('simple', v_tsquery_text);
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT
      a.id,
      coalesce(a.nome_completo, a.nome) AS nome,
      a.updated_at,
      a.created_at,
      GREATEST(
        CASE
          WHEN v_tsquery IS NULL THEN 0
          ELSE ts_rank(to_tsvector('simple', a.search_text), v_tsquery)
        END,
        similarity(coalesce(a.nome_completo, a.nome), v_query),
        similarity(coalesce(a.numero_processo, ''), v_query)
      ) AS score
    FROM public.alunos a
    WHERE a.escola_id = p_escola_id
      AND a.deleted_at IS NULL
      AND (
        (v_tsquery IS NOT NULL AND to_tsvector('simple', a.search_text) @@ v_tsquery)
        OR similarity(coalesce(a.nome_completo, a.nome), v_query) > 0.2
        OR similarity(coalesce(a.numero_processo, ''), v_query) > 0.25
      )
    ORDER BY score DESC, a.updated_at DESC NULLS LAST, a.created_at DESC, a.id DESC
    LIMIT v_limit
  )
  SELECT
    c.id,
    c.nome AS label,
    'aluno'::text AS type,
    c.nome AS highlight
  FROM candidates c
  ORDER BY c.score DESC, c.updated_at DESC NULLS LAST, c.created_at DESC, c.id DESC;
END;
$$;


ALTER FUNCTION "public"."search_alunos_global_min"("p_escola_id" "uuid", "p_query" "text", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_alunos_global_min"("p_escola_id" "uuid", "p_query" "text", "p_limit" integer DEFAULT 10, "p_cursor_score" double precision DEFAULT NULL::double precision, "p_cursor_updated_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_cursor_created_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_cursor_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("id" "uuid", "label" "text", "type" "text", "highlight" "text", "score" double precision, "updated_at" timestamp with time zone, "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_query text := coalesce(trim(p_query), '');
  v_limit int := LEAST(GREATEST(coalesce(p_limit, 10), 1), 50);
  v_tsquery tsquery := NULL;
  v_tokens text[];
  v_tsquery_text text;
  v_has_cursor boolean :=
    p_cursor_score IS NOT NULL
    AND p_cursor_updated_at IS NOT NULL
    AND p_cursor_created_at IS NOT NULL
    AND p_cursor_id IS NOT NULL;
BEGIN
  IF p_escola_id IS DISTINCT FROM public.current_tenant_escola_id() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF v_query = '' OR length(v_query) < 2 THEN
    RETURN;
  END IF;

  v_query := replace(v_query, '''', ' ');

  v_tokens := regexp_split_to_array(regexp_replace(v_query, '\\s+', ' ', 'g'), ' ');
  v_tsquery_text := array_to_string(
    ARRAY(
      SELECT regexp_replace(t, '[^[:alnum:]_]+', '', 'g') || ':*'
      FROM unnest(v_tokens) t
      WHERE length(t) > 0
    ),
    ' & '
  );

  IF v_tsquery_text <> '' THEN
    v_tsquery := to_tsquery('simple', v_tsquery_text);
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      a.id,
      coalesce(a.nome_completo, a.nome) AS nome,
      coalesce(a.updated_at, a.created_at) AS updated_at_sort,
      a.created_at,
      GREATEST(
        CASE
          WHEN v_tsquery IS NULL THEN 0
          ELSE ts_rank(to_tsvector('simple', a.search_text), v_tsquery)
        END,
        similarity(coalesce(a.nome_completo, a.nome), v_query),
        similarity(coalesce(a.numero_processo, ''), v_query)
      ) AS score
    FROM public.alunos a
    WHERE a.escola_id = p_escola_id
      AND a.deleted_at IS NULL
      AND (
        (v_tsquery IS NOT NULL AND to_tsvector('simple', a.search_text) @@ v_tsquery)
        OR similarity(coalesce(a.nome_completo, a.nome), v_query) > 0.2
        OR similarity(coalesce(a.numero_processo, ''), v_query) > 0.25
      )
  ),
  filtered AS (
    SELECT *
    FROM base
    WHERE NOT v_has_cursor
       OR (score, updated_at_sort, created_at, id)
          < (p_cursor_score, p_cursor_updated_at, p_cursor_created_at, p_cursor_id)
  ),
  candidates AS (
    SELECT *
    FROM filtered
    ORDER BY score DESC, updated_at_sort DESC, created_at DESC, id DESC
    LIMIT v_limit
  )
  SELECT
    c.id,
    c.nome AS label,
    'aluno'::text AS type,
    c.nome AS highlight,
    c.score,
    c.updated_at_sort AS updated_at,
    c.created_at
  FROM candidates c
  ORDER BY c.score DESC, c.updated_at_sort DESC, c.created_at DESC, c.id DESC;
END;
$$;


ALTER FUNCTION "public"."search_alunos_global_min"("p_escola_id" "uuid", "p_query" "text", "p_limit" integer, "p_cursor_score" double precision, "p_cursor_updated_at" timestamp with time zone, "p_cursor_created_at" timestamp with time zone, "p_cursor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_global_entities"("p_escola_id" "uuid", "p_query" "text", "p_types" "text"[] DEFAULT NULL::"text"[], "p_limit" integer DEFAULT 10, "p_cursor_score" double precision DEFAULT NULL::double precision, "p_cursor_updated_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_cursor_created_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_cursor_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("id" "uuid", "type" "text", "label" "text", "highlight" "text", "score" double precision, "updated_at" timestamp with time zone, "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_query text := coalesce(trim(p_query), '');
  v_limit int := least(greatest(coalesce(p_limit, 10), 1), 50);
  v_tsquery tsquery := null;
  v_tokens text[];
  v_tsquery_text text;
  v_has_cursor boolean :=
    p_cursor_score is not null
    and p_cursor_updated_at is not null
    and p_cursor_created_at is not null
    and p_cursor_id is not null;
  v_types text[] := null;
begin
  if p_escola_id is distinct from public.current_tenant_escola_id() then
    raise exception 'forbidden';
  end if;

  if v_query = '' or length(v_query) < 2 then
    return;
  end if;

  v_query := replace(v_query, '''', ' ');

  if p_types is not null then
    select array_agg(distinct lower(trim(t)))
      into v_types
      from unnest(p_types) t
     where length(trim(t)) > 0;
  end if;

  v_tokens := regexp_split_to_array(regexp_replace(v_query, '\\s+', ' ', 'g'), ' ');
  v_tsquery_text := array_to_string(
    array(
      select regexp_replace(t, '[^[:alnum:]_]+', '', 'g') || ':*'
      from unnest(v_tokens) t
      where length(t) > 0
    ),
    ' & '
  );

  if v_tsquery_text <> '' then
    v_tsquery := to_tsquery('simple', v_tsquery_text);
  end if;

  return query
  with base as (
    select * from public.vw_search_alunos
    union all
    select * from public.vw_search_turmas
    union all
    select * from public.vw_search_matriculas
    union all
    select * from public.vw_search_documentos
    union all
    select * from public.vw_search_mensalidades
    union all
    select * from public.vw_search_pagamentos
    union all
    select * from public.vw_search_recibos
    union all
    select * from public.vw_search_professores
    union all
    select * from public.vw_search_cursos
    union all
    select * from public.vw_search_classes
    union all
    select * from public.vw_search_usuarios
  ),
  ranked as (
    select
      b.id,
      b.type,
      b.label,
      b.highlight,
      b.search_text,
      b.updated_at,
      b.created_at,
      greatest(
        case
          when v_tsquery is null then 0
          else ts_rank(to_tsvector('simple', coalesce(b.search_text, '')), v_tsquery)
        end,
        similarity(coalesce(b.label, ''), v_query),
        similarity(coalesce(b.highlight, ''), v_query)
      ) as score
    from base b
    where b.escola_id = p_escola_id
      and (v_types is null or b.type = any(v_types))
      and (
        (v_tsquery is not null and to_tsvector('simple', coalesce(b.search_text, '')) @@ v_tsquery)
        or similarity(coalesce(b.label, ''), v_query) > 0.2
        or similarity(coalesce(b.highlight, ''), v_query) > 0.25
      )
  ),
  filtered as (
    select *
    from ranked
    where not v_has_cursor
       or (score, updated_at, created_at, id)
          < (p_cursor_score, p_cursor_updated_at, p_cursor_created_at, p_cursor_id)
  ),
  candidates as (
    select *
    from filtered
    order by score desc, updated_at desc, created_at desc, id desc
    limit v_limit
  )
  select
    c.id,
    c.type,
    c.label,
    c.highlight,
    c.score,
    c.updated_at,
    c.created_at
  from candidates c
  order by c.score desc, c.updated_at desc, c.created_at desc, c.id desc;
end;
$$;


ALTER FUNCTION "public"."search_global_entities"("p_escola_id" "uuid", "p_query" "text", "p_types" "text"[], "p_limit" integer, "p_cursor_score" double precision, "p_cursor_updated_at" timestamp with time zone, "p_cursor_created_at" timestamp with time zone, "p_cursor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."secretaria_audit_by_aluno_matricula"("p_aluno_id" "uuid" DEFAULT NULL::"uuid", "p_matricula_id" "uuid" DEFAULT NULL::"uuid", "p_limit" integer DEFAULT 100, "p_offset" integer DEFAULT 0) RETURNS TABLE("created_at" timestamp with time zone, "portal" "text", "acao" "text", "tabela" "text", "entity_id" "text", "matricula_id" "uuid", "aluno_id" "uuid", "aluno_nome" "text", "user_id" "uuid", "user_email" "text", "details" "jsonb")
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
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


CREATE OR REPLACE FUNCTION "public"."secretaria_list_alunos_kf2"("p_escola_id" "uuid", "p_status" "text" DEFAULT 'ativo'::"text", "p_q" "text" DEFAULT NULL::"text", "p_ano_letivo" integer DEFAULT NULL::integer, "p_limit" integer DEFAULT 50, "p_offset" integer DEFAULT 0, "p_cursor_created_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_cursor_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("origem" "text", "id" "uuid", "aluno_id" "uuid", "nome" "text", "email" "text", "responsavel" "text", "telefone_responsavel" "text", "status" "text", "created_at" timestamp with time zone, "numero_login" "text", "numero_processo" "text", "bi_numero" "text")
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'pg_catalog', 'public', 'extensions'
    AS $$
with params as (
  select
    p_escola_id as escola_id,
    lower(coalesce(p_status, 'ativo')) as status,
    nullif(trim(coalesce(p_q, '')), '') as q,
    coalesce(p_ano_letivo, extract(year from now())::int) as ano_letivo,
    greatest(1, least(coalesce(p_limit, 50), 50)) as lim,
    greatest(coalesce(p_offset, 0), 0) as off,
    p_cursor_created_at as cursor_created_at,
    p_cursor_id as cursor_id
),
base_alunos as (
  select
    'aluno'::text as origem,
    a.id as id,
    a.id as aluno_id,
    a.nome as nome,
    coalesce(p.email, a.email) as email,
    coalesce(a.responsavel, a.responsavel_nome, a.encarregado_nome) as responsavel,
    coalesce(a.telefone_responsavel, a.responsavel_contato, a.encarregado_telefone) as telefone_responsavel,
    a.status as status,
    a.created_at as created_at,
    p.numero_login as numero_login,
    a.numero_processo as numero_processo,
    coalesce(a.bi_numero, p.bi_numero) as bi_numero,
    a.deleted_at as deleted_at
  from public.alunos a
  left join public.profiles p on p.user_id = a.profile_id
  join params pr on pr.escola_id = a.escola_id
),
filtered_alunos as (
  select ba.*
  from base_alunos ba
  join params pr on true
  where
    (
      pr.status = 'arquivado' and ba.deleted_at is not null
    )
    or
    (
      pr.status <> 'arquivado' and ba.deleted_at is null
    )
),
alunos_status as (
  select fa.*
  from filtered_alunos fa
  join params pr on true
  where
    case pr.status
      when 'ativo' then exists (
        select 1
        from public.matriculas m
        where m.escola_id = pr.escola_id
          and m.aluno_id = fa.aluno_id
          and m.ano_letivo = pr.ano_letivo
          and m.status in ('ativa', 'ativo', 'active')
      )
      when 'inativo' then (fa.status = 'inativo')
      when 'pendente' then (fa.status = 'pendente')
      when 'arquivado' then true
      else true
    end
),
alunos_search as (
  select s.*
  from alunos_status s
  join params pr on true
  where pr.q is null
     or (
       s.nome ilike ('%' || pr.q || '%')
       or coalesce(s.responsavel, '') ilike ('%' || pr.q || '%')
       or coalesce(s.numero_login, '') ilike ('%' || pr.q || '%')
       or coalesce(s.email, '') ilike ('%' || pr.q || '%')
       or coalesce(s.numero_processo, '') ilike ('%' || pr.q || '%')
       or coalesce(s.bi_numero, '') ilike ('%' || pr.q || '%')
     )
),
candidaturas_pendentes as (
  select
    'candidatura'::text as origem,
    c.id as id,
    c.aluno_id as aluno_id,
    coalesce(c.nome_candidato, (c.dados_candidato->>'nome_completo'), (c.dados_candidato->>'nome')) as nome,
    (c.dados_candidato->>'email') as email,
    coalesce((c.dados_candidato->>'responsavel_nome'), (c.dados_candidato->>'encarregado_nome')) as responsavel,
    coalesce((c.dados_candidato->>'responsavel_contato'), (c.dados_candidato->>'encarregado_telefone')) as telefone_responsavel,
    c.status as status,
    c.created_at as created_at,
    null::text as numero_login,
    (c.dados_candidato->>'numero_processo') as numero_processo,
    (c.dados_candidato->>'bi_numero') as bi_numero
  from public.candidaturas c
  join params pr on pr.escola_id = c.escola_id
  where
    pr.status = 'pendente'
    and c.status in ('pendente', 'aguardando_pagamento')
    and c.ano_letivo = pr.ano_letivo
    and not exists (
      select 1
      from public.matriculas m
      where m.escola_id = pr.escola_id
        and m.aluno_id = c.aluno_id
        and m.ano_letivo = pr.ano_letivo
        and m.status in ('ativa', 'ativo', 'active')
    )
),
candidaturas_search as (
  select cp.*
  from candidaturas_pendentes cp
  join params pr on true
  where pr.q is null
     or (
       cp.nome ilike ('%' || pr.q || '%')
       or coalesce(cp.email, '') ilike ('%' || pr.q || '%')
       or coalesce(cp.responsavel, '') ilike ('%' || pr.q || '%')
       or coalesce(cp.numero_processo, '') ilike ('%' || pr.q || '%')
       or coalesce(cp.bi_numero, '') ilike ('%' || pr.q || '%')
     )
),
unioned as (
  select origem, id, aluno_id, nome, email, responsavel, telefone_responsavel, status, created_at, numero_login, numero_processo, bi_numero
  from alunos_search
  union all
  select origem, id, aluno_id, nome, email, responsavel, telefone_responsavel, status, created_at, numero_login, numero_processo, bi_numero
  from candidaturas_search
)
select u.*
from unioned u
join params pr on true
where pr.cursor_created_at is null
   or (u.created_at, u.id) < (pr.cursor_created_at, pr.cursor_id)
order by u.created_at desc, u.id desc
limit (select lim from params)
offset (select off from params);
$$;


ALTER FUNCTION "public"."secretaria_list_alunos_kf2"("p_escola_id" "uuid", "p_status" "text", "p_q" "text", "p_ano_letivo" integer, "p_limit" integer, "p_offset" integer, "p_cursor_created_at" timestamp with time zone, "p_cursor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public', 'extensions'
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."soft_delete_aluno"("p_id" "uuid", "p_deleted_by" "uuid", "p_reason" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."soft_delete_aluno"("p_id" "uuid", "p_deleted_by" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_alunos_nome_busca"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  new.nome_busca := lower(unaccent(coalesce(new.nome_completo, new.nome, '')));
  return new;
end;
$$;


ALTER FUNCTION "public"."sync_alunos_nome_busca"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_alunos_nome_completo"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."sync_alunos_nome_completo"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_disciplinas_ao_criar_turma"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
    if NEW.classe_id is null then
        return NEW;
    end if;

    insert into public.turma_disciplinas (escola_id, turma_id, curso_matriz_id, professor_id)
    select NEW.escola_id, NEW.id, cm.id, null
    from public.curso_matriz cm
    where cm.classe_id = NEW.classe_id
      and cm.escola_id = NEW.escola_id
      and (NEW.curso_id is null or cm.curso_id = NEW.curso_id)
    on conflict do nothing;

    return NEW;
end;
$$;


ALTER FUNCTION "public"."sync_disciplinas_ao_criar_turma"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tg_fill_turma_disciplinas"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public', 'extensions'
    AS $$
begin
  -- Só preenche se tiver as chaves necessárias (turma criada “hidratada”)
  if new.curso_id is null or new.classe_id is null then
    return new;
  end if;

  insert into public.turma_disciplinas (
    escola_id,
    turma_id,
    curso_matriz_id,
    professor_id,
    created_at
  )
  select
    new.escola_id,
    new.id,
    cm.id,
    null,
    now()
  from public.curso_matriz cm
  where cm.escola_id = new.escola_id
    and cm.curso_id  = new.curso_id
    and cm.classe_id = new.classe_id
    and cm.ativo = true
  on conflict (escola_id, turma_id, curso_matriz_id) do nothing;

  return new;
end;
$$;


ALTER FUNCTION "public"."tg_fill_turma_disciplinas"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tg_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public', 'extensions'
    AS $$
begin
  new.updated_at := now();
  return new;
end $$;


ALTER FUNCTION "public"."tg_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_auto_numero_processo"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_next bigint;
BEGIN
  -- Evita colisão concorrente por escola
  PERFORM pg_advisory_xact_lock(hashtext(coalesce(NEW.escola_id::text, '')));

  IF NEW.numero_processo IS NULL OR btrim(NEW.numero_processo) = '' THEN
    SELECT COALESCE(
      MAX(NULLIF(regexp_replace(numero_processo, '[^0-9]', '', 'g'), '')::bigint),
      0
    ) + 1
    INTO v_next
    FROM public.alunos
    WHERE escola_id = NEW.escola_id;

    NEW.numero_processo := lpad(v_next::text, 6, '0');
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_auto_numero_processo"() OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."trg_set_matricula_number"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public', 'extensions'
    AS $$
DECLARE
  v_num bigint;
BEGIN
  IF NEW.status = 'ativa' AND (NEW.numero_matricula IS NULL OR btrim(NEW.numero_matricula) = '') THEN
    v_num := public.next_matricula_number(NEW.escola_id);
    NEW.numero_matricula := v_num::text; -- coluna é text
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_set_matricula_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at := now();
  return new;
end$$;


ALTER FUNCTION "public"."trg_touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."unaccent"("text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'pg_catalog', 'public', 'extensions'
    AS $_$
  select extensions.unaccent($1);
$_$;


ALTER FUNCTION "public"."unaccent"("text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_import_configuration"("p_import_id" "uuid", "p_cursos_data" "jsonb", "p_turmas_data" "jsonb") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."update_import_configuration"("p_import_id" "uuid", "p_cursos_data" "jsonb", "p_turmas_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_has_role_in_school"("p_escola_id" "uuid", "p_roles" "text"[]) RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  -- Super Admin bypass
  if public.check_super_admin_role() then
    return true;
  end if;

  return exists (
    select 1
    from public.escola_users
    where escola_id = p_escola_id
      and user_id = auth.uid()
      and papel = any(p_roles)
  );
end;
$$;


ALTER FUNCTION "public"."user_has_role_in_school"("p_escola_id" "uuid", "p_roles" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verificar_documento_publico"("p_public_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."verificar_documento_publico"("p_public_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."escola_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'staff'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "papel" "text" DEFAULT 'secretaria'::"text" NOT NULL,
    CONSTRAINT "escola_users_papel_check" CHECK (("papel" = ANY (ARRAY['admin'::"text", 'staff_admin'::"text", 'financeiro'::"text", 'secretaria'::"text", 'aluno'::"text", 'professor'::"text", 'admin_escola'::"text"])))
);


ALTER TABLE "public"."escola_users" OWNER TO "postgres";


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
    "plano_atual" "public"."app_plan_tier" DEFAULT 'essencial'::"public"."app_plan_tier" NOT NULL,
    "aluno_portal_enabled" boolean DEFAULT false NOT NULL,
    "logo_url" "text",
    "use_mv_dashboards" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."escolas" OWNER TO "postgres";


COMMENT ON COLUMN "public"."escolas"."plano_atual" IS 'Plano da escola: basico | standard | premium';



COMMENT ON COLUMN "public"."escolas"."aluno_portal_enabled" IS 'Libera o acesso ao Portal do Aluno para esta escola';



COMMENT ON COLUMN "public"."escolas"."use_mv_dashboards" IS 'Quando true, páginas preferem ler views MV (v_*) para baixa latência.';



CREATE TABLE IF NOT EXISTS "public"."matriculas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "aluno_id" "uuid" NOT NULL,
    "turma_id" "uuid",
    "ativo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "secao_id" "uuid",
    "session_id" "uuid",
    "status" "text" DEFAULT 'pendente'::"text" NOT NULL,
    "numero_matricula" "text",
    "data_matricula" "date",
    "ano_letivo" integer,
    "numero_chamada" integer,
    "updated_at" timestamp with time zone,
    "data_inicio_financeiro" "date",
    "import_id" "uuid",
    CONSTRAINT "matriculas_numero_only_when_ativa" CHECK (((("status" = 'ativa'::"text") AND ("numero_matricula" IS NOT NULL) AND ("btrim"("numero_matricula") <> ''::"text")) OR (("status" <> 'ativa'::"text") AND (("numero_matricula" IS NULL) OR ("btrim"("numero_matricula") = ''::"text"))))),
    CONSTRAINT "matriculas_status_check" CHECK (("status" = ANY (ARRAY['pendente'::"text", 'ativa'::"text", 'ativo'::"text", 'inativo'::"text", 'concluido'::"text", 'transferido'::"text", 'trancado'::"text", 'desistente'::"text", 'indefinido'::"text", 'rascunho'::"text"])))
);

ALTER TABLE ONLY "public"."matriculas" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."matriculas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "avaliacao_id" "uuid" NOT NULL,
    "matricula_id" "uuid" NOT NULL,
    "valor" numeric(6,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notas" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "internal"."mv_admin_dashboard_counts" AS
 SELECT "e"."id" AS "escola_id",
    (COALESCE("alunos_ativos"."alunos_ativos", (0)::bigint))::integer AS "alunos_ativos",
    (COALESCE("turmas_total"."turmas_total", (0)::bigint))::integer AS "turmas_total",
    (COALESCE("professores_total"."professores_total", (0)::bigint))::integer AS "professores_total",
    (COALESCE("avaliacoes_total"."avaliacoes_total", (0)::bigint))::integer AS "avaliacoes_total"
   FROM (((("public"."escolas" "e"
     LEFT JOIN ( SELECT "matriculas"."escola_id",
            "count"(DISTINCT "matriculas"."aluno_id") AS "alunos_ativos"
           FROM "public"."matriculas"
          WHERE ("matriculas"."status" = ANY (ARRAY['ativa'::"text", 'ativo'::"text", 'active'::"text"]))
          GROUP BY "matriculas"."escola_id") "alunos_ativos" ON (("alunos_ativos"."escola_id" = "e"."id")))
     LEFT JOIN ( SELECT "turmas"."escola_id",
            "count"(*) AS "turmas_total"
           FROM "public"."turmas"
          GROUP BY "turmas"."escola_id") "turmas_total" ON (("turmas_total"."escola_id" = "e"."id")))
     LEFT JOIN ( SELECT "escola_users"."escola_id",
            "count"(*) AS "professores_total"
           FROM "public"."escola_users"
          WHERE ("escola_users"."papel" = 'professor'::"text")
          GROUP BY "escola_users"."escola_id") "professores_total" ON (("professores_total"."escola_id" = "e"."id")))
     LEFT JOIN ( SELECT "m"."escola_id",
            "count"("n"."id") AS "avaliacoes_total"
           FROM ("public"."notas" "n"
             JOIN "public"."matriculas" "m" ON (("m"."id" = "n"."matricula_id")))
          GROUP BY "m"."escola_id") "avaliacoes_total" ON (("avaliacoes_total"."escola_id" = "e"."id")))
  WITH NO DATA;


ALTER MATERIALIZED VIEW "internal"."mv_admin_dashboard_counts" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "internal"."mv_admin_matriculas_por_mes" AS
 SELECT "escola_id",
    ("date_trunc"('month'::"text", COALESCE(("data_matricula")::timestamp with time zone, "created_at")))::"date" AS "mes",
    ("count"(*))::integer AS "total"
   FROM "public"."matriculas"
  WHERE (COALESCE(("data_matricula")::timestamp with time zone, "created_at") >= ("date_trunc"('month'::"text", (CURRENT_DATE)::timestamp with time zone) - '11 mons'::interval))
  GROUP BY "escola_id", ("date_trunc"('month'::"text", COALESCE(("data_matricula")::timestamp with time zone, "created_at")))
  WITH NO DATA;


ALTER MATERIALIZED VIEW "internal"."mv_admin_matriculas_por_mes" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "internal"."mv_admin_pending_turmas_count" AS
 SELECT "escola_id",
    ("count"(*) FILTER (WHERE ("status_validacao" <> 'ativo'::"text")))::integer AS "pendentes_total"
   FROM "public"."turmas"
  GROUP BY "escola_id"
  WITH NO DATA;


ALTER MATERIALIZED VIEW "internal"."mv_admin_pending_turmas_count" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."candidaturas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "aluno_id" "uuid",
    "curso_id" "uuid",
    "ano_letivo" integer DEFAULT (EXTRACT(year FROM CURRENT_DATE))::integer,
    "status" "text" DEFAULT 'rascunho'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "turma_preferencial_id" "uuid",
    "dados_candidato" "jsonb" DEFAULT '{}'::"jsonb",
    "nome_candidato" "text",
    "classe_id" "uuid",
    "turno" "text",
    "source" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "matricula_id" "uuid",
    "matriculado_em" timestamp with time zone,
    CONSTRAINT "candidaturas_required_when_not_draft" CHECK ((("status" = 'rascunho'::"text") OR (("curso_id" IS NOT NULL) AND ("ano_letivo" IS NOT NULL))))
);


ALTER TABLE "public"."candidaturas" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "internal"."mv_admissoes_counts_por_status" AS
 WITH "counts" AS (
         SELECT "candidaturas"."escola_id",
            ("count"(*) FILTER (WHERE ("candidaturas"."status" = ANY (ARRAY['submetida'::"text", 'pendente'::"text"]))))::integer AS "submetida_total",
            ("count"(*) FILTER (WHERE ("candidaturas"."status" = 'em_analise'::"text")))::integer AS "em_analise_total",
            ("count"(*) FILTER (WHERE ("candidaturas"."status" = ANY (ARRAY['aprovada'::"text", 'aguardando_pagamento'::"text"]))))::integer AS "aprovada_total",
            ("count"(*) FILTER (WHERE (("candidaturas"."status" = ANY (ARRAY['matriculado'::"text", 'convertida'::"text"])) AND ("candidaturas"."matriculado_em" >= ("now"() - '7 days'::interval)))))::integer AS "matriculado_7d_total"
           FROM "public"."candidaturas"
          GROUP BY "candidaturas"."escola_id"
        )
 SELECT "escola_id",
    "submetida_total",
    "em_analise_total",
    "aprovada_total",
    "matriculado_7d_total"
   FROM "counts"
  WITH NO DATA;


ALTER MATERIALIZED VIEW "internal"."mv_admissoes_counts_por_status" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."curso_matriz" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "curso_id" "uuid" NOT NULL,
    "classe_id" "uuid" NOT NULL,
    "disciplina_id" "uuid" NOT NULL,
    "carga_horaria" integer,
    "obrigatoria" boolean DEFAULT true NOT NULL,
    "ordem" integer,
    "ativo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "curso_curriculo_id" "uuid"
);


ALTER TABLE "public"."curso_matriz" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cursos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "codigo" "text" NOT NULL,
    "nome" "text" NOT NULL,
    "tipo" "text",
    "descricao" "text",
    "nivel" "text",
    "semestre_id" "uuid",
    "curso_global_id" "text",
    "is_custom" boolean DEFAULT false,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "course_code" "text",
    "curriculum_key" "text",
    "status_aprovacao" "text" DEFAULT 'aprovado'::"text",
    "import_id" "uuid",
    CONSTRAINT "ck_cursos_codigo_igual_course_code" CHECK ((("course_code" IS NULL) OR ("codigo" = "course_code")))
);


ALTER TABLE "public"."cursos" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "internal"."mv_cursos_reais" AS
 SELECT "id",
    "escola_id",
    "codigo",
    "nome",
    "tipo",
    "descricao",
    "nivel",
    "semestre_id",
    "course_code",
    "curriculum_key",
    "status_aprovacao"
   FROM "public"."cursos" "c"
  WHERE (("status_aprovacao" = 'aprovado'::"text") AND (EXISTS ( SELECT 1
           FROM "public"."curso_matriz" "cm"
          WHERE (("cm"."curso_id" = "c"."id") AND (("cm"."ativo" IS NULL) OR ("cm"."ativo" = true))))))
  WITH NO DATA;


ALTER MATERIALIZED VIEW "internal"."mv_cursos_reais" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."classes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "descricao" "text",
    "ordem" integer DEFAULT 0,
    "nivel" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "numero" integer,
    "curso_id" "uuid",
    CONSTRAINT "classes_curso_obrigatorio_10a_13a" CHECK ((NOT ((("nome" ~ '(^|\s)(10|11|12|13)'::"text") OR ("nome" ~~* '10%classe'::"text") OR ("nome" ~~* '11%classe'::"text") OR ("nome" ~~* '12%classe'::"text") OR ("nome" ~~* '13%classe'::"text")) AND ("curso_id" IS NULL)))),
    CONSTRAINT "classes_numero_range_check" CHECK ((("numero" IS NULL) OR (("numero" >= 1) AND ("numero" <= 13))))
);


ALTER TABLE "public"."classes" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "internal"."mv_escola_estrutura_counts" AS
 WITH "cursos_total" AS (
         SELECT "cursos"."escola_id",
            ("count"(*))::integer AS "total"
           FROM "public"."cursos"
          GROUP BY "cursos"."escola_id"
        ), "classes_total" AS (
         SELECT "classes"."escola_id",
            ("count"(*))::integer AS "total"
           FROM "public"."classes"
          GROUP BY "classes"."escola_id"
        ), "disciplinas_total" AS (
         SELECT "curso_matriz"."escola_id",
            ("count"(DISTINCT "curso_matriz"."disciplina_id"))::integer AS "total"
           FROM "public"."curso_matriz"
          GROUP BY "curso_matriz"."escola_id"
        )
 SELECT "e"."id" AS "escola_id",
    COALESCE("cursos_total"."total", 0) AS "cursos_total",
    COALESCE("classes_total"."total", 0) AS "classes_total",
    COALESCE("disciplinas_total"."total", 0) AS "disciplinas_total"
   FROM ((("public"."escolas" "e"
     LEFT JOIN "cursos_total" ON (("cursos_total"."escola_id" = "e"."id")))
     LEFT JOIN "classes_total" ON (("classes_total"."escola_id" = "e"."id")))
     LEFT JOIN "disciplinas_total" ON (("disciplinas_total"."escola_id" = "e"."id")))
  WITH NO DATA;


ALTER MATERIALIZED VIEW "internal"."mv_escola_estrutura_counts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."anos_letivos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "ano" integer NOT NULL,
    "data_inicio" "date" NOT NULL,
    "data_fim" "date" NOT NULL,
    "ativo" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "anos_letivos_ano_check" CHECK ((("ano" >= 2000) AND ("ano" <= 2100))),
    CONSTRAINT "anos_letivos_check" CHECK (("data_fim" > "data_inicio"))
);


ALTER TABLE "public"."anos_letivos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."curso_curriculos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "curso_id" "uuid" NOT NULL,
    "ano_letivo_id" "uuid" NOT NULL,
    "version" integer NOT NULL,
    "status" "public"."curriculo_status" DEFAULT 'draft'::"public"."curriculo_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."curso_curriculos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."periodos_letivos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "ano_letivo_id" "uuid" NOT NULL,
    "tipo" "public"."periodo_tipo" NOT NULL,
    "numero" smallint NOT NULL,
    "data_inicio" "date" NOT NULL,
    "data_fim" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "trava_notas_em" timestamp with time zone,
    CONSTRAINT "chk_periodos_numero_por_tipo" CHECK (((("tipo" = 'TRIMESTRE'::"public"."periodo_tipo") AND (("numero" >= 1) AND ("numero" <= 3))) OR (("tipo" = 'SEMESTRE'::"public"."periodo_tipo") AND (("numero" >= 1) AND ("numero" <= 2))) OR (("tipo" = 'BIMESTRE'::"public"."periodo_tipo") AND (("numero" >= 1) AND ("numero" <= 4))))),
    CONSTRAINT "periodos_letivos_check" CHECK (("data_fim" > "data_inicio")),
    CONSTRAINT "periodos_letivos_numero_check" CHECK ((("numero" >= 1) AND ("numero" <= 6)))
);


ALTER TABLE "public"."periodos_letivos" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "internal"."mv_escola_setup_status" AS
 SELECT "id" AS "escola_id",
    (EXISTS ( SELECT 1
           FROM "public"."anos_letivos"
          WHERE (("anos_letivos"."escola_id" = "e"."id") AND ("anos_letivos"."ativo" = true)))) AS "has_ano_letivo_ativo",
    (( SELECT "count"(*) AS "count"
           FROM ("public"."periodos_letivos" "pl"
             JOIN "public"."anos_letivos" "al" ON (("al"."id" = "pl"."ano_letivo_id")))
          WHERE (("al"."escola_id" = "e"."id") AND ("al"."ativo" = true) AND ("pl"."tipo" = 'TRIMESTRE'::"public"."periodo_tipo"))) >= 3) AS "has_3_trimestres",
    (EXISTS ( SELECT 1
           FROM ("public"."curso_curriculos" "cc"
             JOIN "public"."anos_letivos" "al" ON (("al"."id" = "cc"."ano_letivo_id")))
          WHERE (("cc"."escola_id" = "e"."id") AND ("al"."ativo" = true) AND ("cc"."status" = 'published'::"public"."curriculo_status")))) AS "has_curriculo_published",
    (EXISTS ( SELECT 1
           FROM ("public"."turmas" "t"
             JOIN "public"."anos_letivos" "al" ON ((("al"."escola_id" = "t"."escola_id") AND ("al"."ano" = "t"."ano_letivo"))))
          WHERE (("t"."escola_id" = "e"."id") AND ("al"."ativo" = true)))) AS "has_turmas_no_ano",
    (((
        CASE
            WHEN (EXISTS ( SELECT 1
               FROM "public"."anos_letivos"
              WHERE (("anos_letivos"."escola_id" = "e"."id") AND ("anos_letivos"."ativo" = true)))) THEN 25
            ELSE 0
        END +
        CASE
            WHEN (( SELECT "count"(*) AS "count"
               FROM ("public"."periodos_letivos" "pl"
                 JOIN "public"."anos_letivos" "al" ON (("al"."id" = "pl"."ano_letivo_id")))
              WHERE (("al"."escola_id" = "e"."id") AND ("al"."ativo" = true) AND ("pl"."tipo" = 'TRIMESTRE'::"public"."periodo_tipo"))) >= 3) THEN 25
            ELSE 0
        END) +
        CASE
            WHEN (EXISTS ( SELECT 1
               FROM ("public"."curso_curriculos" "cc"
                 JOIN "public"."anos_letivos" "al" ON (("al"."id" = "cc"."ano_letivo_id")))
              WHERE (("cc"."escola_id" = "e"."id") AND ("al"."ativo" = true) AND ("cc"."status" = 'published'::"public"."curriculo_status")))) THEN 25
            ELSE 0
        END) +
        CASE
            WHEN (EXISTS ( SELECT 1
               FROM ("public"."turmas" "t"
                 JOIN "public"."anos_letivos" "al" ON ((("al"."escola_id" = "t"."escola_id") AND ("al"."ano" = "t"."ano_letivo"))))
              WHERE (("t"."escola_id" = "e"."id") AND ("al"."ativo" = true)))) THEN 25
            ELSE 0
        END) AS "percentage"
   FROM "public"."escolas" "e"
  WITH NO DATA;


ALTER MATERIALIZED VIEW "internal"."mv_escola_setup_status" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."financeiro_cobrancas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "aluno_id" "uuid" NOT NULL,
    "mensalidade_id" "uuid",
    "canal" "text" NOT NULL,
    "status" "public"."cobranca_status" DEFAULT 'enviada'::"public"."cobranca_status" NOT NULL,
    "mensagem" "text",
    "resposta" "text",
    "enviado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "financeiro_cobrancas_canal_check" CHECK (("canal" = ANY (ARRAY['whatsapp'::"text", 'sms'::"text", 'email'::"text", 'manual'::"text"])))
);


ALTER TABLE "public"."financeiro_cobrancas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mensalidades" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "aluno_id" "uuid" NOT NULL,
    "valor" numeric(10,2) NOT NULL,
    "data_vencimento" "date" NOT NULL,
    "status" "text",
    "escola_id" "uuid",
    "turma_id" "uuid",
    "ano_letivo" "text",
    "mes_referencia" smallint,
    "ano_referencia" integer,
    "valor_previsto" numeric(14,2),
    "valor_pago_total" numeric(14,2) DEFAULT 0,
    "data_pagamento_efetiva" "date",
    "observacoes" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "matricula_id" "uuid",
    "metodo_pagamento" "text",
    "observacao" "text",
    "updated_by" "uuid",
    CONSTRAINT "mensalidades_status_check" CHECK (("status" = ANY (ARRAY['pendente'::"text", 'pago_parcial'::"text", 'pago'::"text", 'isento'::"text", 'cancelado'::"text"])))
);


ALTER TABLE "public"."mensalidades" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "internal"."mv_financeiro_cobrancas_diario" AS
 SELECT "c"."escola_id",
    ("c"."enviado_em")::"date" AS "dia",
    ("count"(*) FILTER (WHERE ("c"."status" = 'enviada'::"public"."cobranca_status")))::integer AS "enviadas",
    ("count"(*) FILTER (WHERE ("c"."status" = 'respondida'::"public"."cobranca_status")))::integer AS "respondidas",
    ("count"(*) FILTER (WHERE ("c"."status" = 'paga'::"public"."cobranca_status")))::integer AS "pagos",
    ("sum"(
        CASE
            WHEN ("c"."status" = 'paga'::"public"."cobranca_status") THEN COALESCE("m"."valor_previsto", "m"."valor", (0)::numeric)
            ELSE (0)::numeric
        END))::numeric(14,2) AS "valor_recuperado"
   FROM ("public"."financeiro_cobrancas" "c"
     LEFT JOIN "public"."mensalidades" "m" ON (("m"."id" = "c"."mensalidade_id")))
  GROUP BY "c"."escola_id", (("c"."enviado_em")::"date")
  WITH NO DATA;


ALTER MATERIALIZED VIEW "internal"."mv_financeiro_cobrancas_diario" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "internal"."mv_financeiro_kpis_geral" AS
 WITH "matriculas" AS (
         SELECT "matriculas"."escola_id",
            ("count"(*) FILTER (WHERE ("matriculas"."status" = ANY (ARRAY['ativo'::"text", 'ativa'::"text"]))))::integer AS "matriculados_total"
           FROM "public"."matriculas"
          GROUP BY "matriculas"."escola_id"
        ), "mensalidades" AS (
         SELECT "mensalidades"."escola_id",
            ("count"(*) FILTER (WHERE ("mensalidades"."status" = 'pago'::"text")))::integer AS "pagos_total",
            ("sum"(
                CASE
                    WHEN ("mensalidades"."status" = 'pago'::"text") THEN COALESCE("mensalidades"."valor_previsto", "mensalidades"."valor", (0)::numeric)
                    ELSE (0)::numeric
                END))::numeric(14,2) AS "pagos_valor",
            ("count"(*) FILTER (WHERE ("mensalidades"."status" <> 'pago'::"text")))::integer AS "pendentes_total",
            ("sum"(
                CASE
                    WHEN ("mensalidades"."status" <> 'pago'::"text") THEN COALESCE("mensalidades"."valor_previsto", "mensalidades"."valor", (0)::numeric)
                    ELSE (0)::numeric
                END))::numeric(14,2) AS "pendentes_valor"
           FROM "public"."mensalidades"
          GROUP BY "mensalidades"."escola_id"
        ), "inadimplencia" AS (
         SELECT "mensalidades"."escola_id",
            ("count"(DISTINCT "mensalidades"."aluno_id"))::integer AS "inadimplentes_total",
            ("sum"(COALESCE("mensalidades"."valor_previsto", "mensalidades"."valor", (0)::numeric)))::numeric(14,2) AS "risco_total"
           FROM "public"."mensalidades"
          WHERE (("mensalidades"."status" <> 'pago'::"text") AND ("mensalidades"."data_vencimento" < CURRENT_DATE))
          GROUP BY "mensalidades"."escola_id"
        )
 SELECT "e"."id" AS "escola_id",
    COALESCE("m"."matriculados_total", 0) AS "matriculados_total",
    COALESCE("i"."inadimplentes_total", 0) AS "inadimplentes_total",
    COALESCE("i"."risco_total", (0)::numeric) AS "risco_total",
    COALESCE("ms"."pagos_total", 0) AS "pagos_total",
    COALESCE("ms"."pagos_valor", (0)::numeric) AS "pagos_valor",
    COALESCE("ms"."pendentes_total", 0) AS "pendentes_total",
    COALESCE("ms"."pendentes_valor", (0)::numeric) AS "pendentes_valor"
   FROM ((("public"."escolas" "e"
     LEFT JOIN "matriculas" "m" ON (("m"."escola_id" = "e"."id")))
     LEFT JOIN "mensalidades" "ms" ON (("ms"."escola_id" = "e"."id")))
     LEFT JOIN "inadimplencia" "i" ON (("i"."escola_id" = "e"."id")))
  WITH NO DATA;


ALTER MATERIALIZED VIEW "internal"."mv_financeiro_kpis_geral" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pagamentos" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "mensalidade_id" "uuid",
    "valor_pago" numeric(10,2) NOT NULL,
    "data_pagamento" "date" DEFAULT CURRENT_DATE,
    "conciliado" boolean DEFAULT false,
    "transacao_id_externo" "text",
    "metodo_pagamento" "text",
    "telemovel_origem" "text",
    "status" "text" DEFAULT 'concluido'::"text",
    "metodo" "text",
    "referencia" "text",
    "escola_id" "uuid" NOT NULL,
    CONSTRAINT "pagamentos_metodo_pagamento_check" CHECK (("metodo_pagamento" = ANY (ARRAY['dinheiro'::"text", 'tpa_fisico'::"text", 'mcx_express'::"text", 'transferencia'::"text", 'referencia'::"text"]))),
    CONSTRAINT "pagamentos_status_check" CHECK (("status" = ANY (ARRAY['pendente'::"text", 'concluido'::"text", 'falhado'::"text", 'estornado'::"text"])))
);

ALTER TABLE ONLY "public"."pagamentos" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."pagamentos" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "internal"."mv_financeiro_kpis_mes" AS
 WITH "previsto" AS (
         SELECT "m"."escola_id",
            ("date_trunc"('month'::"text", ("m"."data_vencimento")::timestamp with time zone))::"date" AS "mes_ref",
            ("sum"(COALESCE("m"."valor_previsto", "m"."valor", (0)::numeric)))::numeric(14,2) AS "previsto_total"
           FROM "public"."mensalidades" "m"
          WHERE ("m"."status" = ANY (ARRAY['pendente'::"text", 'pago'::"text", 'atrasado'::"text", 'parcial'::"text", 'pago_parcial'::"text"]))
          GROUP BY "m"."escola_id", (("date_trunc"('month'::"text", ("m"."data_vencimento")::timestamp with time zone))::"date")
        ), "realizado" AS (
         SELECT "p"."escola_id",
            ("date_trunc"('month'::"text", ("p"."data_pagamento")::timestamp with time zone))::"date" AS "mes_ref",
            ("sum"(COALESCE("p"."valor_pago", (0)::numeric)))::numeric(14,2) AS "realizado_total"
           FROM "public"."pagamentos" "p"
          WHERE (("p"."data_pagamento" IS NOT NULL) AND ("p"."status" = ANY (ARRAY['pago'::"text", 'concluido'::"text"])))
          GROUP BY "p"."escola_id", (("date_trunc"('month'::"text", ("p"."data_pagamento")::timestamp with time zone))::"date")
        ), "inadimplencia" AS (
         SELECT "m"."escola_id",
            ("sum"(GREATEST((COALESCE("m"."valor_previsto", "m"."valor", (0)::numeric) - COALESCE("m"."valor_pago_total", (0)::numeric)), (0)::numeric)))::numeric(14,2) AS "inadimplencia_total"
           FROM "public"."mensalidades" "m"
          WHERE (("m"."data_vencimento" < CURRENT_DATE) AND ("m"."status" = ANY (ARRAY['pendente'::"text", 'atrasado'::"text", 'parcial'::"text", 'pago_parcial'::"text"])))
          GROUP BY "m"."escola_id"
        ), "meses" AS (
         SELECT DISTINCT "previsto_1"."escola_id",
            "previsto_1"."mes_ref"
           FROM "previsto" "previsto_1"
        UNION
         SELECT DISTINCT "realizado_1"."escola_id",
            "realizado_1"."mes_ref"
           FROM "realizado" "realizado_1"
        )
 SELECT "meses"."escola_id",
    "meses"."mes_ref",
    COALESCE("previsto"."previsto_total", (0)::numeric) AS "previsto_total",
    COALESCE("realizado"."realizado_total", (0)::numeric) AS "realizado_total",
    COALESCE("inadimplencia"."inadimplencia_total", (0)::numeric) AS "inadimplencia_total"
   FROM ((("meses"
     LEFT JOIN "previsto" ON ((("previsto"."escola_id" = "meses"."escola_id") AND ("previsto"."mes_ref" = "meses"."mes_ref"))))
     LEFT JOIN "realizado" ON ((("realizado"."escola_id" = "meses"."escola_id") AND ("realizado"."mes_ref" = "meses"."mes_ref"))))
     LEFT JOIN "inadimplencia" ON (("inadimplencia"."escola_id" = "meses"."escola_id")))
  WITH NO DATA;


ALTER MATERIALIZED VIEW "internal"."mv_financeiro_kpis_mes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."alunos" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "nome" "text" NOT NULL,
    "responsavel" "text",
    "telefone_responsavel" "text",
    "status" "text" DEFAULT 'pendente'::"text",
    "profile_id" "uuid",
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "deletion_reason" "text",
    "escola_id" "uuid" NOT NULL,
    "updated_at" timestamp with time zone,
    "import_id" "uuid",
    "telefone" "text",
    "bi_numero" "text",
    "data_nascimento" "date",
    "email" "text",
    "sexo" "text",
    "responsavel_nome" "text",
    "responsavel_contato" "text",
    "tsv" "tsvector" GENERATED ALWAYS AS ("to_tsvector"('"simple"'::"regconfig", ((COALESCE("nome", ''::"text") || ' '::"text") || COALESCE("responsavel_nome", ''::"text")))) STORED,
    "naturalidade" "text",
    "numero_processo" "text",
    "nif" "text",
    "encarregado_nome" "text",
    "encarregado_telefone" "text",
    "encarregado_email" "text",
    "nome_completo" "text",
    "search_text" "text" GENERATED ALWAYS AS (((((((COALESCE("nome_completo", "nome", ''::"text") || ' '::"text") || COALESCE("numero_processo", ''::"text")) || ' '::"text") || COALESCE("bi_numero", ''::"text")) || ' '::"text") || COALESCE("encarregado_nome", ''::"text"))) STORED,
    "acesso_liberado" boolean DEFAULT false NOT NULL,
    "codigo_ativacao" "text",
    "data_ativacao" timestamp with time zone,
    "usuario_auth_id" "uuid",
    "ultimo_reset_senha" timestamp with time zone,
    "numero_processo_legado" "text",
    "nome_busca" "text",
    CONSTRAINT "alunos_status_check" CHECK ((("status" IS NULL) OR ("status" = ANY (ARRAY['ativo'::"text", 'inativo'::"text", 'suspenso'::"text", 'pendente'::"text", 'trancado'::"text", 'concluido'::"text", 'transferido'::"text", 'desistente'::"text"]))))
);

ALTER TABLE ONLY "public"."alunos" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."alunos" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_matriculas_validas" WITH ("security_invoker"='true') AS
 SELECT "m"."id",
    "m"."escola_id",
    "m"."aluno_id",
    "a"."nome" AS "aluno_nome",
    "a"."nome_completo",
    "a"."bi_numero",
    "a"."numero_processo",
    "m"."numero_matricula",
    "m"."numero_chamada",
    "m"."status",
    "m"."ano_letivo",
    "pl"."ano_letivo_id",
    "m"."session_id",
    "m"."data_matricula",
    "m"."created_at",
    "m"."turma_id",
    "t"."nome" AS "turma_nome",
    "t"."sala",
    "t"."turno",
    "t"."classe_id",
    "cl"."nome" AS "classe_nome",
    "t"."curso_id",
    "c"."nome" AS "curso_nome",
    "c"."tipo" AS "curso_tipo"
   FROM ((((("public"."matriculas" "m"
     JOIN "public"."alunos" "a" ON (("a"."id" = "m"."aluno_id")))
     LEFT JOIN "public"."turmas" "t" ON (("t"."id" = "m"."turma_id")))
     LEFT JOIN "public"."classes" "cl" ON (("cl"."id" = "t"."classe_id")))
     LEFT JOIN "public"."cursos" "c" ON (("c"."id" = "t"."curso_id")))
     LEFT JOIN "public"."periodos_letivos" "pl" ON (("pl"."id" = "m"."session_id")));


ALTER VIEW "public"."vw_matriculas_validas" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "internal"."mv_financeiro_radar_resumo" AS
 WITH "matriculas_ativas" AS (
         SELECT DISTINCT ON ("vw_matriculas_validas"."aluno_id") "vw_matriculas_validas"."aluno_id",
            "vw_matriculas_validas"."turma_nome"
           FROM "public"."vw_matriculas_validas"
          ORDER BY "vw_matriculas_validas"."aluno_id", "vw_matriculas_validas"."data_matricula" DESC NULLS LAST
        )
 SELECT "m"."escola_id",
    "m"."aluno_id",
    "a"."nome" AS "aluno_nome",
    "ma"."turma_nome",
    "array_agg"(DISTINCT ("date_trunc"('month'::"text", ("m"."data_vencimento")::timestamp with time zone))::"date" ORDER BY (("date_trunc"('month'::"text", ("m"."data_vencimento")::timestamp with time zone))::"date")) AS "meses_atraso",
    ("sum"(GREATEST((COALESCE("m"."valor_previsto", "m"."valor", (0)::numeric) - COALESCE("m"."valor_pago_total", (0)::numeric)), (0)::numeric)))::numeric(14,2) AS "valor_total_atraso",
    "max"(COALESCE("a"."responsavel_nome", "a"."responsavel", "a"."encarregado_nome")) AS "responsavel_nome",
    "max"(COALESCE("a"."telefone_responsavel", "a"."telefone", "a"."encarregado_telefone")) AS "telefone_responsavel"
   FROM (("public"."mensalidades" "m"
     JOIN "public"."alunos" "a" ON (("a"."id" = "m"."aluno_id")))
     LEFT JOIN "matriculas_ativas" "ma" ON (("ma"."aluno_id" = "m"."aluno_id")))
  WHERE (("m"."data_vencimento" < CURRENT_DATE) AND ("m"."status" = ANY (ARRAY['pendente'::"text", 'atrasado'::"text", 'parcial'::"text", 'pago_parcial'::"text"])))
  GROUP BY "m"."escola_id", "m"."aluno_id", "a"."nome", "ma"."turma_nome"
  WITH NO DATA;


ALTER MATERIALIZED VIEW "internal"."mv_financeiro_radar_resumo" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "internal"."mv_financeiro_sidebar_badges" AS
 WITH "candidaturas" AS (
         SELECT "candidaturas_1"."escola_id",
            ("count"(*))::integer AS "candidaturas_pendentes"
           FROM "public"."candidaturas" "candidaturas_1"
          WHERE ("candidaturas_1"."status" = ANY (ARRAY['pendente'::"text", 'aguardando_compensacao'::"text"]))
          GROUP BY "candidaturas_1"."escola_id"
        ), "cobrancas" AS (
         SELECT "financeiro_cobrancas"."escola_id",
            ("count"(*))::integer AS "cobrancas_pendentes"
           FROM "public"."financeiro_cobrancas"
          WHERE ("financeiro_cobrancas"."status" = ANY (ARRAY['enviada'::"public"."cobranca_status", 'entregue'::"public"."cobranca_status"]))
          GROUP BY "financeiro_cobrancas"."escola_id"
        )
 SELECT "e"."id" AS "escola_id",
    COALESCE("candidaturas"."candidaturas_pendentes", 0) AS "candidaturas_pendentes",
    COALESCE("cobrancas"."cobrancas_pendentes", 0) AS "cobrancas_pendentes"
   FROM (("public"."escolas" "e"
     LEFT JOIN "candidaturas" ON (("candidaturas"."escola_id" = "e"."id")))
     LEFT JOIN "cobrancas" ON (("cobrancas"."escola_id" = "e"."id")))
  WITH NO DATA;


ALTER MATERIALIZED VIEW "internal"."mv_financeiro_sidebar_badges" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "internal"."mv_migracao_cursos_lookup" AS
 SELECT "id",
    "escola_id",
    "codigo",
    "course_code",
    "status_aprovacao"
   FROM "public"."cursos" "c"
  WITH NO DATA;


ALTER MATERIALIZED VIEW "internal"."mv_migracao_cursos_lookup" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "internal"."mv_migracao_turmas_lookup" AS
 SELECT "id",
    "escola_id",
    "turma_code",
    "ano_letivo",
    "nome"
   FROM "public"."turmas" "t"
  WITH NO DATA;


ALTER MATERIALIZED VIEW "internal"."mv_migracao_turmas_lookup" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "internal"."mv_ocupacao_turmas" AS
 WITH "base" AS (
         SELECT "t"."id",
            "t"."escola_id",
            "t"."nome",
            "cl"."nome" AS "classe",
            "t"."turno",
            "t"."sala",
            "t"."capacidade_maxima",
            ( SELECT "count"(*) AS "count"
                   FROM "public"."matriculas" "m"
                  WHERE (("m"."turma_id" = "t"."id") AND ("m"."status" = ANY (ARRAY['ativa'::"text", 'ativo'::"text"])))) AS "total_matriculas_ativas"
           FROM ("public"."turmas" "t"
             LEFT JOIN "public"."classes" "cl" ON (("cl"."id" = "t"."classe_id")))
        )
 SELECT "id",
    "escola_id",
    "nome",
    "classe",
    "turno",
    "sala",
    "capacidade_maxima",
    "total_matriculas_ativas",
        CASE
            WHEN (("capacidade_maxima" IS NULL) OR ("capacidade_maxima" = 0)) THEN (0)::numeric
            ELSE "round"(((("total_matriculas_ativas")::numeric / ("capacidade_maxima")::numeric) * (100)::numeric), 2)
        END AS "ocupacao_percentual",
        CASE
            WHEN (("capacidade_maxima" IS NULL) OR ("capacidade_maxima" = 0)) THEN 'disponivel'::"text"
            WHEN (((("total_matriculas_ativas")::numeric / ("capacidade_maxima")::numeric) * (100)::numeric) >= (110)::numeric) THEN 'superlotada'::"text"
            WHEN (((("total_matriculas_ativas")::numeric / ("capacidade_maxima")::numeric) * (100)::numeric) >= (100)::numeric) THEN 'cheia'::"text"
            WHEN (((("total_matriculas_ativas")::numeric / ("capacidade_maxima")::numeric) * (100)::numeric) >= (70)::numeric) THEN 'ideal'::"text"
            ELSE 'disponivel'::"text"
        END AS "status_ocupacao"
   FROM "base" "b"
  WITH NO DATA;


ALTER MATERIALIZED VIEW "internal"."mv_ocupacao_turmas" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "internal"."mv_pagamentos_status" AS
 SELECT "escola_id",
    COALESCE("status", 'desconhecido'::"text") AS "status",
    ("count"(*))::integer AS "total"
   FROM "public"."pagamentos" "p"
  GROUP BY "escola_id", COALESCE("status", 'desconhecido'::"text")
  WITH NO DATA;


ALTER MATERIALIZED VIEW "internal"."mv_pagamentos_status" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "internal"."mv_radar_inadimplencia" AS
 SELECT "m"."escola_id",
    "m"."id" AS "mensalidade_id",
    "m"."aluno_id",
    "a"."nome" AS "nome_aluno",
    "a"."responsavel",
    "a"."telefone_responsavel" AS "telefone",
    "t"."nome" AS "nome_turma",
    (COALESCE("m"."valor_previsto", (0)::numeric))::numeric(10,2) AS "valor_previsto",
    COALESCE("m"."valor_pago_total", (0)::numeric) AS "valor_pago_total",
    GREATEST((0)::numeric, (COALESCE("m"."valor_previsto", (0)::numeric) - COALESCE("m"."valor_pago_total", (0)::numeric))) AS "valor_em_atraso",
    "m"."data_vencimento",
    GREATEST(0, (CURRENT_DATE - "m"."data_vencimento")) AS "dias_em_atraso",
        CASE
            WHEN ((CURRENT_DATE - "m"."data_vencimento") >= 30) THEN 'critico'::"text"
            WHEN ((CURRENT_DATE - "m"."data_vencimento") >= 10) THEN 'atencao'::"text"
            ELSE 'recente'::"text"
        END AS "status_risco",
    "m"."status" AS "status_mensalidade"
   FROM ((("public"."mensalidades" "m"
     JOIN "public"."alunos" "a" ON (("a"."id" = "m"."aluno_id")))
     LEFT JOIN "public"."matriculas" "mat" ON ((("mat"."aluno_id" = "m"."aluno_id") AND (("mat"."status" = ANY (ARRAY['ativo'::"text", 'ativa'::"text"])) OR ("mat"."ativo" = true)))))
     LEFT JOIN "public"."turmas" "t" ON (("t"."id" = "mat"."turma_id")))
  WHERE (("m"."status" = ANY (ARRAY['pendente'::"text", 'pago_parcial'::"text"])) AND ("m"."data_vencimento" < CURRENT_DATE))
  WITH NO DATA;


ALTER MATERIALIZED VIEW "internal"."mv_radar_inadimplencia" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "internal"."mv_secretaria_dashboard_counts" AS
 SELECT "e"."id" AS "escola_id",
    (COALESCE("alunos_ativos"."alunos_ativos", (0)::bigint))::integer AS "alunos_ativos",
    (COALESCE("matriculas_total"."matriculas_total", (0)::bigint))::integer AS "matriculas_total",
    (COALESCE("turmas_total"."turmas_total", (0)::bigint))::integer AS "turmas_total"
   FROM ((("public"."escolas" "e"
     LEFT JOIN ( SELECT "matriculas"."escola_id",
            "count"(DISTINCT "matriculas"."aluno_id") AS "alunos_ativos"
           FROM "public"."matriculas"
          WHERE ("matriculas"."status" = ANY (ARRAY['ativa'::"text", 'ativo'::"text", 'active'::"text"]))
          GROUP BY "matriculas"."escola_id") "alunos_ativos" ON (("alunos_ativos"."escola_id" = "e"."id")))
     LEFT JOIN ( SELECT "matriculas"."escola_id",
            "count"(*) AS "matriculas_total"
           FROM "public"."matriculas"
          GROUP BY "matriculas"."escola_id") "matriculas_total" ON (("matriculas_total"."escola_id" = "e"."id")))
     LEFT JOIN ( SELECT "turmas"."escola_id",
            "count"(*) AS "turmas_total"
           FROM "public"."turmas"
          GROUP BY "turmas"."escola_id") "turmas_total" ON (("turmas_total"."escola_id" = "e"."id")))
  WITH NO DATA;


ALTER MATERIALIZED VIEW "internal"."mv_secretaria_dashboard_counts" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "internal"."mv_secretaria_matriculas_status" AS
 SELECT "escola_id",
    "lower"(COALESCE("status", 'indefinido'::"text")) AS "status",
    ("count"(*))::integer AS "total"
   FROM "public"."matriculas"
  GROUP BY "escola_id", ("lower"(COALESCE("status", 'indefinido'::"text")))
  WITH NO DATA;


ALTER MATERIALIZED VIEW "internal"."mv_secretaria_matriculas_status" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "internal"."mv_secretaria_matriculas_turma_status" AS
 SELECT "escola_id",
    "turma_id",
    "lower"(COALESCE("status", 'indefinido'::"text")) AS "status",
    ("count"(*))::integer AS "total"
   FROM "public"."matriculas"
  GROUP BY "escola_id", "turma_id", ("lower"(COALESCE("status", 'indefinido'::"text")))
  WITH NO DATA;


ALTER MATERIALIZED VIEW "internal"."mv_secretaria_matriculas_turma_status" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staging_alunos" (
    "id" bigint NOT NULL,
    "import_id" "uuid" NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "profile_id" "uuid",
    "nome" "text",
    "data_nascimento" "date",
    "telefone" "text",
    "bi" "text",
    "email" "text",
    "raw_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "curso_codigo" "text",
    "classe_numero" integer,
    "turno_codigo" "text",
    "turma_letra" "text",
    "ano_letivo" integer,
    "numero_matricula" "text",
    "numero_processo" "text",
    "bi_numero" "text",
    "nif" "text",
    "encarregado_telefone" "text",
    "encarregado_email" "text",
    "turma_codigo" "text",
    "encarregado_nome" "text",
    "sexo" "text",
    "row_number" integer
);


ALTER TABLE "public"."staging_alunos" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "internal"."mv_staging_alunos_summary" AS
 SELECT "escola_id",
    "import_id",
    "turma_codigo",
    "ano_letivo",
    "count"("id") AS "total_alunos"
   FROM "public"."staging_alunos" "sa"
  WHERE ("turma_codigo" IS NOT NULL)
  GROUP BY "escola_id", "import_id", "turma_codigo", "ano_letivo"
  WITH NO DATA;


ALTER MATERIALIZED VIEW "internal"."mv_staging_alunos_summary" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "internal"."mv_total_em_aberto_por_mes" AS
 SELECT "escola_id",
    "ano_referencia" AS "ano",
    "mes_referencia" AS "mes",
    ("sum"(GREATEST((0)::numeric, (COALESCE("valor_previsto", "valor", (0)::numeric) - COALESCE("valor_pago_total", (0)::numeric)))))::numeric(14,2) AS "total_aberto"
   FROM "public"."mensalidades"
  WHERE ("status" = ANY (ARRAY['pendente'::"text", 'pago_parcial'::"text"]))
  GROUP BY "escola_id", "ano_referencia", "mes_referencia"
  WITH NO DATA;


ALTER MATERIALIZED VIEW "internal"."mv_total_em_aberto_por_mes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cursos_globais_cache" (
    "hash" "text" NOT NULL,
    "nome" "text" NOT NULL,
    "tipo" "text" NOT NULL,
    "usage_count" integer DEFAULT 1,
    "first_seen_at" timestamp with time zone DEFAULT "now"(),
    "last_used_at" timestamp with time zone DEFAULT "now"(),
    "created_by_escola" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "cursos_globais_cache_tipo_check" CHECK (("tipo" = ANY (ARRAY['primario'::"text", 'ciclo1'::"text", 'puniv'::"text", 'tecnico'::"text", 'geral'::"text"])))
);


ALTER TABLE "public"."cursos_globais_cache" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."turma_disciplinas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "turma_id" "uuid" NOT NULL,
    "curso_matriz_id" "uuid" NOT NULL,
    "professor_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."turma_disciplinas" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "internal"."mv_turmas_para_matricula" AS
 WITH "base" AS (
         SELECT "t"."id",
            "t"."escola_id",
            COALESCE("t"."session_id", "al"."id") AS "session_id",
            "t"."nome" AS "turma_nome",
            "t"."turma_codigo",
            "t"."turno",
            "t"."capacidade_maxima",
            "t"."sala",
            "t"."classe_id",
            "t"."curso_id" AS "turma_curso_id",
            "t"."ano_letivo",
            "t"."status_validacao",
            COALESCE("cm_map"."curso_id", "cl"."curso_id", "t"."curso_id") AS "curso_id_resolved",
            "cl"."nome" AS "classe_nome"
           FROM ((("public"."turmas" "t"
             LEFT JOIN "public"."classes" "cl" ON (("t"."classe_id" = "cl"."id")))
             LEFT JOIN LATERAL ( SELECT DISTINCT ON ("td"."turma_id") "cm"."curso_id"
                   FROM ("public"."turma_disciplinas" "td"
                     JOIN "public"."curso_matriz" "cm" ON (("cm"."id" = "td"."curso_matriz_id")))
                  WHERE ("td"."turma_id" = "t"."id")
                  ORDER BY "td"."turma_id", "cm"."created_at" DESC, "cm"."id" DESC) "cm_map" ON (true))
             LEFT JOIN "public"."anos_letivos" "al" ON ((("al"."escola_id" = "t"."escola_id") AND ("al"."ano" = "t"."ano_letivo"))))
        )
 SELECT "b"."id",
    "b"."escola_id",
    "b"."session_id",
    "b"."turma_nome",
    "b"."turma_codigo",
    "b"."turno",
    "b"."capacidade_maxima",
    "b"."sala",
    COALESCE("b"."classe_nome", 'Classe não definida'::"text") AS "classe_nome",
    COALESCE("c"."nome", 'Ensino Geral'::"text") AS "curso_nome",
    COALESCE("c"."tipo", 'geral'::"text") AS "curso_tipo",
    COALESCE("c"."is_custom", false) AS "curso_is_custom",
    "cgc"."hash" AS "curso_global_hash",
    "b"."classe_id",
    "b"."curso_id_resolved" AS "curso_id",
    "b"."ano_letivo",
    ( SELECT "count"(*) AS "count"
           FROM "public"."matriculas" "m"
          WHERE (("m"."turma_id" = "b"."id") AND ("m"."status" = ANY (ARRAY['ativa'::"text", 'ativo'::"text"])))) AS "ocupacao_atual",
    ( SELECT "max"("m"."created_at") AS "max"
           FROM "public"."matriculas" "m"
          WHERE ("m"."turma_id" = "b"."id")) AS "ultima_matricula",
    "b"."status_validacao"
   FROM (("base" "b"
     LEFT JOIN "public"."cursos" "c" ON (("b"."curso_id_resolved" = "c"."id")))
     LEFT JOIN "public"."cursos_globais_cache" "cgc" ON (("c"."curso_global_id" = "cgc"."hash")))
  WITH NO DATA;


ALTER MATERIALIZED VIEW "internal"."mv_turmas_para_matricula" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."aluno_processo_counters" (
    "escola_id" "uuid" NOT NULL,
    "last_value" bigint DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."aluno_processo_counters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."alunos_excluidos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "aluno_id" "uuid",
    "profile_id" "uuid",
    "numero_login" "text",
    "nome" "text",
    "aluno_created_at" timestamp with time zone,
    "aluno_deleted_at" timestamp with time zone,
    "exclusao_motivo" "text",
    "excluido_por" "uuid",
    "dados_anonimizados" boolean DEFAULT false NOT NULL,
    "anonimizacao_data" timestamp with time zone,
    "snapshot" "jsonb"
);


ALTER TABLE "public"."alunos_excluidos" OWNER TO "postgres";


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
    "acao" "text",
    "tabela" "text",
    "registro_id" "text",
    "meta" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "escola_id" "uuid",
    "portal" "text",
    "action" "text",
    "entity" "text",
    "entity_id" "text",
    "details" "jsonb",
    "actor_id" "uuid" DEFAULT "auth"."uid"(),
    "before" "jsonb",
    "after" "jsonb",
    "ip" "text",
    "user_agent" "text",
    "actor_role" "text"
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



CREATE TABLE IF NOT EXISTS "public"."aulas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "turma_disciplina_id" "uuid" NOT NULL,
    "data" "date" NOT NULL,
    "conteudo" "text",
    "numero_aula" integer,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."aulas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."avaliacoes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "turma_disciplina_id" "uuid" NOT NULL,
    "periodo_letivo_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "peso" numeric(6,2) DEFAULT 1 NOT NULL,
    "nota_max" numeric(6,2) DEFAULT 20 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ano_letivo" integer NOT NULL,
    "trimestre" smallint NOT NULL,
    "tipo" "text" NOT NULL,
    CONSTRAINT "ck_avaliacoes_trimestre" CHECK ((("trimestre" >= 1) AND ("trimestre" <= 3)))
);


ALTER TABLE "public"."avaliacoes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."candidaturas_status_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "candidatura_id" "uuid" NOT NULL,
    "from_status" "text",
    "to_status" "text" NOT NULL,
    "actor_user_id" "uuid" DEFAULT "auth"."uid"(),
    "motivo" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."candidaturas_status_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."configuracoes_curriculo" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "curso_id" "uuid" NOT NULL,
    "config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."configuracoes_curriculo" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."configuracoes_escola" (
    "escola_id" "uuid" NOT NULL,
    "estrutura" "text" NOT NULL,
    "tipo_presenca" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "periodo_tipo" "text",
    "autogerar_periodos" boolean DEFAULT false,
    "modelo_avaliacao" "text" DEFAULT 'SIMPLIFICADO'::"text" NOT NULL,
    "frequencia_modelo" "text" DEFAULT 'POR_AULA'::"text" NOT NULL,
    "frequencia_min_percent" integer DEFAULT 75 NOT NULL,
    "avaliacao_config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "configuracoes_escola_estrutura_check" CHECK (("estrutura" = ANY (ARRAY['classes'::"text", 'secoes'::"text", 'cursos'::"text"]))),
    CONSTRAINT "configuracoes_escola_frequencia_min_percent_check" CHECK ((("frequencia_min_percent" >= 0) AND ("frequencia_min_percent" <= 100))),
    CONSTRAINT "configuracoes_escola_frequencia_modelo_check" CHECK (("frequencia_modelo" = ANY (ARRAY['POR_AULA'::"text", 'POR_PERIODO'::"text"]))),
    CONSTRAINT "configuracoes_escola_modelo_avaliacao_check" CHECK (("modelo_avaliacao" = ANY (ARRAY['SIMPLIFICADO'::"text", 'ANGOLANO_TRADICIONAL'::"text", 'COMPETENCIAS'::"text", 'DEPOIS'::"text"]))),
    CONSTRAINT "configuracoes_escola_periodo_tipo_check" CHECK (("periodo_tipo" = ANY (ARRAY['semestre'::"text", 'trimestre'::"text"]))),
    CONSTRAINT "configuracoes_escola_tipo_presenca_check" CHECK (("tipo_presenca" = ANY (ARRAY['secao'::"text", 'curso'::"text"])))
);


ALTER TABLE "public"."configuracoes_escola" OWNER TO "postgres";


COMMENT ON TABLE "public"."configuracoes_escola" IS 'Preferências acadêmicas por escola (onboarding etapa 2)';



COMMENT ON COLUMN "public"."configuracoes_escola"."estrutura" IS 'Estrutura acadêmica principal: classes | secoes | cursos';



COMMENT ON COLUMN "public"."configuracoes_escola"."tipo_presenca" IS 'Registro de presença por secao ou por curso';



CREATE TABLE IF NOT EXISTS "public"."disciplinas_catalogo" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "sigla" "text",
    "nome_norm" "text" GENERATED ALWAYS AS ("lower"("regexp_replace"("public"."immutable_unaccent"(TRIM(BOTH FROM "nome")), '\s+'::"text", ' '::"text", 'g'::"text"))) STORED,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."disciplinas_catalogo" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."documentos_emitidos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "public_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "aluno_id" "uuid" NOT NULL,
    "mensalidade_id" "uuid",
    "tipo" "public"."tipo_documento" NOT NULL,
    "dados_snapshot" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "revoked_at" timestamp with time zone,
    "revoked_by" "uuid",
    "hash_validacao" "text" NOT NULL,
    CONSTRAINT "chk_revoked_consistency" CHECK (((("revoked_at" IS NULL) AND ("revoked_by" IS NULL)) OR (("revoked_at" IS NOT NULL) AND ("revoked_by" IS NOT NULL))))
);


ALTER TABLE "public"."documentos_emitidos" OWNER TO "postgres";


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


CREATE OR REPLACE VIEW "public"."escola_usuarios" WITH ("security_invoker"='true') AS
 SELECT "id",
    "escola_id",
    "user_id",
    "papel",
    "created_at"
   FROM "public"."escola_users" "eu"
  WHERE ("escola_id" IN ( SELECT "eu_filter"."escola_id"
           FROM "public"."escola_users" "eu_filter"
          WHERE ("eu_filter"."user_id" = "auth"."uid"())));


ALTER VIEW "public"."escola_usuarios" OWNER TO "postgres";


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
    "deleted_at" timestamp with time zone,
    "data_nascimento" "date",
    "sexo" "text",
    "bi_numero" "text",
    "naturalidade" "text",
    "provincia" "text",
    "encarregado_relacao" "text"
);

ALTER TABLE ONLY "public"."profiles" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."escolas_view" WITH ("security_invoker"='true') AS
 SELECT "e"."id",
    "e"."nome",
    "e"."status",
    "e"."plano_atual",
    ("e"."plano_atual")::"text" AS "plano",
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


CREATE TABLE IF NOT EXISTS "public"."financeiro_contratos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "aluno_id" "uuid" NOT NULL,
    "matricula_id" "uuid" NOT NULL,
    "ano_letivo" integer NOT NULL,
    "plano" "text",
    "desconto_percentual" numeric(5,2) DEFAULT 0,
    "status" "text" DEFAULT 'ativo'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."financeiro_contratos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."financeiro_estornos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "mensalidade_id" "uuid" NOT NULL,
    "valor" numeric(14,2) DEFAULT 0 NOT NULL,
    "motivo" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."financeiro_estornos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."financeiro_itens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "categoria" "public"."financeiro_categoria_item" DEFAULT 'outros'::"public"."financeiro_categoria_item" NOT NULL,
    "preco" numeric(12,2) DEFAULT 0 NOT NULL,
    "controla_estoque" boolean DEFAULT false NOT NULL,
    "estoque_atual" integer DEFAULT 0 NOT NULL,
    "ativo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."financeiro_itens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."financeiro_lancamentos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "aluno_id" "uuid" NOT NULL,
    "matricula_id" "uuid",
    "tipo" "public"."financeiro_tipo_transacao" NOT NULL,
    "origem" "public"."financeiro_origem" NOT NULL,
    "descricao" "text" NOT NULL,
    "valor_original" numeric(12,2) DEFAULT 0 NOT NULL,
    "valor_multa" numeric(12,2) DEFAULT 0,
    "valor_desconto" numeric(12,2) DEFAULT 0,
    "valor_total" numeric(12,2) GENERATED ALWAYS AS ((("valor_original" + "valor_multa") - "valor_desconto")) STORED,
    "mes_referencia" integer,
    "ano_referencia" integer,
    "status" "public"."financeiro_status" DEFAULT 'pendente'::"public"."financeiro_status",
    "data_vencimento" "date",
    "data_pagamento" timestamp with time zone,
    "metodo_pagamento" "public"."metodo_pagamento_enum",
    "comprovativo_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "categoria" "public"."financeiro_categoria_item" DEFAULT 'outros'::"public"."financeiro_categoria_item" NOT NULL
);


ALTER TABLE "public"."financeiro_lancamentos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."financeiro_tabelas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "ano_letivo" integer NOT NULL,
    "curso_id" "uuid",
    "classe_id" "uuid",
    "valor_mensalidade" numeric(12,2) DEFAULT 0 NOT NULL,
    "dia_vencimento" integer DEFAULT 10,
    "multa_atraso_percentual" numeric(5,2) DEFAULT 0,
    "multa_diaria" numeric(10,2) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "valor_matricula" numeric(12,2) DEFAULT 0 NOT NULL,
    CONSTRAINT "financeiro_tabelas_dia_vencimento_chk" CHECK ((("dia_vencimento" IS NULL) OR (("dia_vencimento" >= 1) AND ("dia_vencimento" <= 31))))
);


ALTER TABLE "public"."financeiro_tabelas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."financeiro_titulos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "contrato_id" "uuid",
    "aluno_id" "uuid" NOT NULL,
    "tipo" "text" NOT NULL,
    "competencia" "text",
    "vencimento" "date" NOT NULL,
    "valor_original" numeric(12,2) NOT NULL,
    "valor_desconto" numeric(12,2) DEFAULT 0,
    "valor_pago" numeric(12,2) DEFAULT 0,
    "status" "text" DEFAULT 'pendente'::"text" NOT NULL,
    "pago_em" "date",
    "referencia" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "financeiro_titulos_status_check" CHECK (("status" = ANY (ARRAY['pendente'::"text", 'pago'::"text", 'atrasado'::"text", 'cancelado'::"text"]))),
    CONSTRAINT "financeiro_titulos_tipo_check" CHECK (("tipo" = ANY (ARRAY['matricula'::"text", 'mensalidade'::"text", 'multa'::"text", 'outro'::"text"])))
);


ALTER TABLE "public"."financeiro_titulos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."frequencia_status_periodo" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "turma_id" "uuid" NOT NULL,
    "periodo_letivo_id" "uuid" NOT NULL,
    "aluno_id" "uuid" NOT NULL,
    "matricula_id" "uuid" NOT NULL,
    "aulas_previstas" integer DEFAULT 0 NOT NULL,
    "presencas" integer DEFAULT 0 NOT NULL,
    "faltas" integer DEFAULT 0 NOT NULL,
    "atrasos" integer DEFAULT 0 NOT NULL,
    "percentual_presenca" numeric(5,2) DEFAULT 0 NOT NULL,
    "frequencia_min_percent" integer DEFAULT 75 NOT NULL,
    "abaixo_minimo" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."frequencia_status_periodo" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."frequencias" (
    "id" "uuid" NOT NULL,
    "matricula_id" "uuid" NOT NULL,
    "routine_id" "uuid",
    "curso_oferta_id" "uuid",
    "data" "date" NOT NULL,
    "status" "text" NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "aula_id" "uuid",
    "observacao" "text",
    "periodo_letivo_id" "uuid"
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
    "escola_id" "uuid" NOT NULL,
    "aula_id" "uuid",
    "observacao" "text",
    "periodo_letivo_id" "uuid"
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
    "escola_id" "uuid" NOT NULL,
    "aula_id" "uuid",
    "observacao" "text",
    "periodo_letivo_id" "uuid"
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
    "escola_id" "uuid" NOT NULL,
    "aula_id" "uuid",
    "observacao" "text",
    "periodo_letivo_id" "uuid"
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
    "escola_id" "uuid" NOT NULL,
    "aula_id" "uuid",
    "observacao" "text",
    "periodo_letivo_id" "uuid"
);

ALTER TABLE ONLY "public"."frequencias_2025_12" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."frequencias_2025_12" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."frequencias_2026_01" (
    "id" "uuid" NOT NULL,
    "matricula_id" "uuid" NOT NULL,
    "routine_id" "uuid",
    "curso_oferta_id" "uuid",
    "data" "date" NOT NULL,
    "status" "text" NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "aula_id" "uuid",
    "observacao" "text",
    "periodo_letivo_id" "uuid"
);

ALTER TABLE ONLY "public"."frequencias_2026_01" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."frequencias_2026_01" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."frequencias_2026_02" (
    "id" "uuid" NOT NULL,
    "matricula_id" "uuid" NOT NULL,
    "routine_id" "uuid",
    "curso_oferta_id" "uuid",
    "data" "date" NOT NULL,
    "status" "text" NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "aula_id" "uuid",
    "observacao" "text",
    "periodo_letivo_id" "uuid"
);

ALTER TABLE ONLY "public"."frequencias_2026_02" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."frequencias_2026_02" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."frequencias_default" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "matricula_id" "uuid" NOT NULL,
    "routine_id" "uuid",
    "curso_oferta_id" "uuid",
    "data" "date" NOT NULL,
    "status" "text" NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "aula_id" "uuid",
    "observacao" "text",
    "periodo_letivo_id" "uuid",
    CONSTRAINT "frequencias_ck_routine_or_curso" CHECK ((("routine_id" IS NOT NULL) OR ("curso_oferta_id" IS NOT NULL))),
    CONSTRAINT "frequencias_status_check" CHECK (("status" = ANY (ARRAY['presente'::"text", 'ausente'::"text", 'atraso'::"text", 'justificado'::"text"])))
);

ALTER TABLE ONLY "public"."frequencias_default" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."frequencias_default" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."historico_anos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "aluno_id" "uuid" NOT NULL,
    "ano_letivo" integer NOT NULL,
    "turma_id" "uuid" NOT NULL,
    "resultado_final" "text" NOT NULL,
    "media_geral" numeric(6,2),
    "data_fechamento" "date" DEFAULT CURRENT_DATE NOT NULL
);


ALTER TABLE "public"."historico_anos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."historico_disciplinas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "historico_ano_id" "uuid" NOT NULL,
    "disciplina_id" "uuid" NOT NULL,
    "media_final" numeric(6,2),
    "resultado" "text",
    "faltas_totais" integer
);


ALTER TABLE "public"."historico_disciplinas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."import_errors" (
    "id" bigint NOT NULL,
    "import_id" "uuid" NOT NULL,
    "row_number" integer,
    "column_name" "text",
    "message" "text" NOT NULL,
    "raw_value" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."import_errors" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."import_errors_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."import_errors_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."import_errors_id_seq" OWNED BY "public"."import_errors"."id";



CREATE TABLE IF NOT EXISTS "public"."import_migrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "created_by" "uuid",
    "file_name" "text",
    "file_hash" "text",
    "storage_path" "text",
    "status" "text" DEFAULT 'uploaded'::"text" NOT NULL,
    "total_rows" integer DEFAULT 0,
    "imported_rows" integer DEFAULT 0,
    "error_rows" integer DEFAULT 0,
    "processed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "column_map" "jsonb"
);


ALTER TABLE "public"."import_migrations" OWNER TO "postgres";


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


CREATE TABLE IF NOT EXISTS "public"."lancamentos_2026_01" (
    "id" "uuid" NOT NULL,
    "avaliacao_id" "uuid" NOT NULL,
    "matricula_id" "uuid" NOT NULL,
    "valor" numeric NOT NULL,
    "final" boolean NOT NULL,
    "criado_em" timestamp with time zone NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "tenant_id" "uuid"
);

ALTER TABLE ONLY "public"."lancamentos_2026_01" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."lancamentos_2026_01" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lancamentos_2026_02" (
    "id" "uuid" NOT NULL,
    "avaliacao_id" "uuid" NOT NULL,
    "matricula_id" "uuid" NOT NULL,
    "valor" numeric NOT NULL,
    "final" boolean NOT NULL,
    "criado_em" timestamp with time zone NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "tenant_id" "uuid"
);

ALTER TABLE ONLY "public"."lancamentos_2026_02" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."lancamentos_2026_02" OWNER TO "postgres";


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


CREATE TABLE IF NOT EXISTS "public"."matricula_counters" (
    "escola_id" "uuid" NOT NULL,
    "last_value" bigint DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."matricula_counters" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."matricula_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."matricula_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."matriculas_cursos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "matricula_id" "uuid" NOT NULL,
    "curso_oferta_id" "uuid" NOT NULL,
    "escola_id" "uuid" NOT NULL
);


ALTER TABLE "public"."matriculas_cursos" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."matriculas_por_ano" WITH ("security_invoker"='true') AS
 SELECT "escola_id",
    "to_char"(COALESCE("created_at", "now"()), 'YYYY'::"text") AS "ano",
    ("count"(*))::integer AS "total"
   FROM "public"."matriculas" "m"
  GROUP BY "escola_id", ("to_char"(COALESCE("created_at", "now"()), 'YYYY'::"text"));


ALTER VIEW "public"."matriculas_por_ano" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "public"."mv_financeiro_escola_dia" AS
 SELECT NULL::"uuid" AS "escola_id",
    ("created_at")::"date" AS "dia",
    "count"(*) FILTER (WHERE ("status" = 'pago'::"text")) AS "qtd_pagos",
    "count"(*) AS "qtd_total"
   FROM "public"."pagamentos" "p"
  GROUP BY (("created_at")::"date")
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


CREATE TABLE IF NOT EXISTS "public"."notas_avaliacoes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "avaliacao_id" "uuid" NOT NULL,
    "matricula_id" "uuid" NOT NULL,
    "aluno_id" "uuid" NOT NULL,
    "valor" numeric(6,2) NOT NULL,
    "observado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "observacao" "text"
);


ALTER TABLE "public"."notas_avaliacoes" OWNER TO "postgres";


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


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "target_role" "public"."user_role" DEFAULT 'financeiro'::"public"."user_role" NOT NULL,
    "tipo" "text" NOT NULL,
    "titulo" "text" NOT NULL,
    "mensagem" "text",
    "link_acao" "text",
    "lida" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."onboarding_drafts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "step" smallint DEFAULT 1 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."onboarding_drafts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."outbox_notificacoes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "aluno_id" "uuid" NOT NULL,
    "canal" "text" NOT NULL,
    "destino" "text",
    "mensagem" "text",
    "payload" "jsonb",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "error_message" "text",
    "mensagem_id" "text",
    "request_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processed_at" timestamp with time zone,
    "sent_at" timestamp with time zone,
    CONSTRAINT "outbox_notificacoes_canal_check" CHECK (("canal" = ANY (ARRAY['whatsapp'::"text", 'email'::"text"]))),
    CONSTRAINT "outbox_notificacoes_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'sent'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."outbox_notificacoes" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."pagamentos_status" WITH ("security_invoker"='true') AS
 SELECT "escola_id",
    "status",
    "total"
   FROM "internal"."mv_pagamentos_status" "m"
  WHERE ("escola_id" IN ( SELECT "eu"."escola_id"
           FROM "public"."escola_users" "eu"
          WHERE ("eu"."user_id" = "auth"."uid"())));


ALTER VIEW "public"."pagamentos_status" OWNER TO "postgres";


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
    "disciplina_id" "uuid",
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


CREATE TABLE IF NOT EXISTS "public"."secoes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "turma_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "sala" "text",
    "escola_id" "uuid" NOT NULL
);

ALTER TABLE ONLY "public"."secoes" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."secoes" OWNER TO "postgres";


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


CREATE SEQUENCE IF NOT EXISTS "public"."staging_alunos_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."staging_alunos_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."staging_alunos_id_seq" OWNED BY "public"."staging_alunos"."id";



CREATE TABLE IF NOT EXISTS "public"."syllabi" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "curso_oferta_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "arquivo_url" "text" NOT NULL,
    "criado_em" "date" DEFAULT CURRENT_DATE NOT NULL,
    "escola_id" "uuid" NOT NULL
);


ALTER TABLE "public"."syllabi" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tabelas_mensalidade" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "curso_id" "uuid",
    "classe_id" "uuid",
    "valor" numeric(14,2) NOT NULL,
    "dia_vencimento" smallint,
    "ativo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tabelas_mensalidade_dia_vencimento_check" CHECK ((("dia_vencimento" >= 1) AND ("dia_vencimento" <= 31)))
);


ALTER TABLE "public"."tabelas_mensalidade" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."turma_disciplinas_professores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escola_id" "uuid" NOT NULL,
    "turma_id" "uuid" NOT NULL,
    "disciplina_id" "uuid" NOT NULL,
    "professor_id" "uuid" NOT NULL,
    "horarios" "jsonb",
    "planejamento" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "syllabus_id" "uuid"
);

ALTER TABLE ONLY "public"."turma_disciplinas_professores" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."turma_disciplinas_professores" OWNER TO "postgres";


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


CREATE OR REPLACE VIEW "public"."v_total_em_aberto_por_mes" WITH ("security_invoker"='true') AS
 SELECT "escola_id",
    "ano_referencia" AS "ano",
    "mes_referencia" AS "mes",
    ("sum"(GREATEST((0)::numeric, (COALESCE("valor_previsto", "valor", (0)::numeric) - COALESCE("valor_pago_total", (0)::numeric)))))::numeric(14,2) AS "total_aberto"
   FROM "public"."mensalidades" "m"
  WHERE (("escola_id" = "public"."current_tenant_escola_id"()) AND ("status" = ANY (ARRAY['pendente'::"text", 'pago_parcial'::"text"])))
  GROUP BY "escola_id", "ano_referencia", "mes_referencia"
  ORDER BY "ano_referencia", "mes_referencia";


ALTER VIEW "public"."v_total_em_aberto_por_mes" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_admin_dashboard_counts" WITH ("security_invoker"='true') AS
 SELECT "escola_id",
    "alunos_ativos",
    "turmas_total",
    "professores_total",
    "avaliacoes_total"
   FROM "internal"."mv_admin_dashboard_counts" "m"
  WHERE ("escola_id" IN ( SELECT "eu"."escola_id"
           FROM "public"."escola_users" "eu"
          WHERE ("eu"."user_id" = "auth"."uid"())));


ALTER VIEW "public"."vw_admin_dashboard_counts" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_admin_matriculas_por_mes" WITH ("security_invoker"='true') AS
 SELECT "escola_id",
    "mes",
    "total"
   FROM "internal"."mv_admin_matriculas_por_mes" "m"
  WHERE ("escola_id" IN ( SELECT "eu"."escola_id"
           FROM "public"."escola_users" "eu"
          WHERE ("eu"."user_id" = "auth"."uid"())));


ALTER VIEW "public"."vw_admin_matriculas_por_mes" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_admin_pending_turmas_count" WITH ("security_invoker"='true') AS
 SELECT "escola_id",
    "pendentes_total"
   FROM "internal"."mv_admin_pending_turmas_count" "m"
  WHERE ("escola_id" IN ( SELECT "eu"."escola_id"
           FROM "public"."escola_users" "eu"
          WHERE ("eu"."user_id" = "auth"."uid"())));


ALTER VIEW "public"."vw_admin_pending_turmas_count" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_admissoes_counts_por_status" WITH ("security_invoker"='true') AS
 SELECT "escola_id",
    "submetida_total",
    "em_analise_total",
    "aprovada_total",
    "matriculado_7d_total"
   FROM "internal"."mv_admissoes_counts_por_status" "m"
  WHERE ("escola_id" IN ( SELECT "eu"."escola_id"
           FROM "public"."escola_users" "eu"
          WHERE ("eu"."user_id" = "auth"."uid"())));


ALTER VIEW "public"."vw_admissoes_counts_por_status" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_alunos_active" WITH ("security_invoker"='true') AS
 SELECT "id",
    "created_at",
    "nome",
    "responsavel",
    "telefone_responsavel",
    "status",
    "profile_id",
    "deleted_at",
    "deleted_by",
    "deletion_reason",
    "escola_id",
    "updated_at",
    "import_id",
    "telefone",
    "bi_numero",
    "data_nascimento",
    "email",
    "sexo",
    "responsavel_nome",
    "responsavel_contato",
    "tsv",
    "naturalidade",
    "numero_processo",
    "nif",
    "encarregado_nome",
    "encarregado_telefone",
    "encarregado_email",
    "nome_completo",
    "search_text"
   FROM "public"."alunos"
  WHERE (("deleted_at" IS NULL) AND ("status" = 'ativo'::"text"));


ALTER VIEW "public"."vw_alunos_active" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_boletim_consolidado" WITH ("security_invoker"='true') AS
 WITH "configuracoes" AS (
         SELECT "configuracoes_escola"."escola_id",
            COALESCE("configuracoes_escola"."modelo_avaliacao", 'SIMPLIFICADO'::"text") AS "modelo_avaliacao",
            "configuracoes_escola"."avaliacao_config"
           FROM "public"."configuracoes_escola"
        ), "componentes" AS (
         SELECT "c"."escola_id",
            "upper"("comp"."code") AS "code",
            "comp"."peso",
            COALESCE("comp"."ativo", true) AS "ativo"
           FROM ("configuracoes" "c"
             LEFT JOIN LATERAL "jsonb_to_recordset"(("c"."avaliacao_config" -> 'componentes'::"text")) "comp"("code" "text", "peso" numeric, "ativo" boolean) ON (true))
        ), "notas_base" AS (
         SELECT "m"."escola_id",
            "m"."aluno_id",
            "m"."id" AS "matricula_id",
            "td"."id" AS "turma_disciplina_id",
            "dc"."nome" AS "disciplina",
            "a"."trimestre",
            COALESCE("cfg"."modelo_avaliacao", 'SIMPLIFICADO'::"text") AS "modelo_avaliacao",
            "n"."valor" AS "nota",
            COALESCE("comp"."peso", "a"."peso", (1)::numeric) AS "peso_aplicado"
           FROM ((((((("public"."matriculas" "m"
             JOIN "public"."turma_disciplinas" "td" ON ((("td"."turma_id" = "m"."turma_id") AND ("td"."escola_id" = "m"."escola_id"))))
             JOIN "public"."curso_matriz" "cm" ON (("cm"."id" = "td"."curso_matriz_id")))
             JOIN "public"."disciplinas_catalogo" "dc" ON (("dc"."id" = "cm"."disciplina_id")))
             LEFT JOIN "public"."avaliacoes" "a" ON ((("a"."turma_disciplina_id" = "td"."id") AND ("a"."escola_id" = "m"."escola_id"))))
             LEFT JOIN "public"."notas" "n" ON ((("n"."avaliacao_id" = "a"."id") AND ("n"."matricula_id" = "m"."id"))))
             LEFT JOIN "configuracoes" "cfg" ON (("cfg"."escola_id" = "m"."escola_id")))
             LEFT JOIN "componentes" "comp" ON ((("comp"."escola_id" = "m"."escola_id") AND ("comp"."ativo" IS TRUE) AND ("comp"."code" = "upper"(COALESCE("a"."tipo", "a"."nome"))))))
          WHERE (("m"."status" = ANY (ARRAY['ativo'::"text", 'ativa'::"text", 'active'::"text"])) AND ("m"."escola_id" IN ( SELECT "eu"."escola_id"
                   FROM "public"."escola_users" "eu"
                  WHERE ("eu"."user_id" = "auth"."uid"()))))
        ), "notas_final" AS (
         SELECT "nb_1"."escola_id",
            "nb_1"."aluno_id",
            "nb_1"."matricula_id",
            "nb_1"."turma_disciplina_id",
            "nb_1"."disciplina",
            "nb_1"."trimestre",
                CASE
                    WHEN ("count"("nb_1"."nota") FILTER (WHERE ("nb_1"."nota" IS NOT NULL)) = 0) THEN NULL::numeric
                    WHEN ("nb_1"."modelo_avaliacao" = 'DEPOIS'::"text") THEN NULL::numeric
                    ELSE ("sum"(("nb_1"."nota" * "nb_1"."peso_aplicado")) FILTER (WHERE ("nb_1"."nota" IS NOT NULL)) / NULLIF("sum"("nb_1"."peso_aplicado") FILTER (WHERE ("nb_1"."nota" IS NOT NULL)), (0)::numeric))
                END AS "nota_final",
                CASE
                    WHEN ("nb_1"."modelo_avaliacao" = 'DEPOIS'::"text") THEN 'PENDENTE_CONFIG'::"text"
                    ELSE NULL::"text"
                END AS "status",
            ("nb_1"."modelo_avaliacao" = 'DEPOIS'::"text") AS "needs_config"
           FROM "notas_base" "nb_1"
          GROUP BY "nb_1"."escola_id", "nb_1"."aluno_id", "nb_1"."matricula_id", "nb_1"."turma_disciplina_id", "nb_1"."disciplina", "nb_1"."trimestre", "nb_1"."modelo_avaliacao"
        ), "faltas" AS (
         SELECT "f_1"."escola_id",
            "f_1"."matricula_id",
            "td"."id" AS "turma_disciplina_id",
            "pl"."numero" AS "trimestre",
            "count"(*) FILTER (WHERE ("f_1"."status" = 'falta'::"text")) AS "faltas_total"
           FROM ((((("public"."frequencias" "f_1"
             JOIN "public"."aulas" "au" ON (("au"."id" = "f_1"."aula_id")))
             JOIN "public"."turma_disciplinas" "td" ON ((("td"."id" = "au"."turma_disciplina_id") AND ("td"."escola_id" = "f_1"."escola_id"))))
             JOIN "public"."matriculas" "m" ON ((("m"."id" = "f_1"."matricula_id") AND ("m"."escola_id" = "f_1"."escola_id"))))
             JOIN "public"."anos_letivos" "al" ON ((("al"."escola_id" = "m"."escola_id") AND ("al"."ano" = "m"."ano_letivo"))))
             JOIN "public"."periodos_letivos" "pl" ON ((("pl"."escola_id" = "f_1"."escola_id") AND ("pl"."ano_letivo_id" = "al"."id") AND ("pl"."tipo" = 'TRIMESTRE'::"public"."periodo_tipo") AND (("au"."data" >= "pl"."data_inicio") AND ("au"."data" <= "pl"."data_fim")))))
          GROUP BY "f_1"."escola_id", "f_1"."matricula_id", "td"."id", "pl"."numero"
        )
 SELECT "nb"."aluno_id",
    "nb"."disciplina",
    "nb"."trimestre",
    "nb"."nota_final",
    "nb"."status",
    "nb"."needs_config",
    COALESCE("f"."faltas_total", (0)::bigint) AS "faltas_total"
   FROM ("notas_final" "nb"
     LEFT JOIN "faltas" "f" ON ((("f"."escola_id" = "nb"."escola_id") AND ("f"."matricula_id" = "nb"."matricula_id") AND ("f"."turma_disciplina_id" = "nb"."turma_disciplina_id") AND ("f"."trimestre" = "nb"."trimestre"))));


ALTER VIEW "public"."vw_boletim_consolidado" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_boletim_por_matricula" WITH ("security_invoker"='true') AS
 WITH "configuracoes" AS (
         SELECT "configuracoes_escola"."escola_id",
            COALESCE("configuracoes_escola"."modelo_avaliacao", 'SIMPLIFICADO'::"text") AS "modelo_avaliacao",
            "configuracoes_escola"."avaliacao_config"
           FROM "public"."configuracoes_escola"
        ), "componentes" AS (
         SELECT "c"."escola_id",
            "upper"("comp"."code") AS "code",
            "comp"."peso",
            COALESCE("comp"."ativo", true) AS "ativo"
           FROM ("configuracoes" "c"
             LEFT JOIN LATERAL "jsonb_to_recordset"(("c"."avaliacao_config" -> 'componentes'::"text")) "comp"("code" "text", "peso" numeric, "ativo" boolean) ON (true))
        ), "base" AS (
         SELECT "m"."id" AS "matricula_id",
            "m"."aluno_id",
            "m"."turma_id",
            "m"."escola_id",
            "m"."ano_letivo",
            "td"."id" AS "turma_disciplina_id",
            "cm"."disciplina_id",
            "dc"."nome" AS "disciplina_nome",
            "dc"."sigla" AS "disciplina_sigla"
           FROM ((("public"."matriculas" "m"
             JOIN "public"."turma_disciplinas" "td" ON ((("td"."turma_id" = "m"."turma_id") AND ("td"."escola_id" = "m"."escola_id"))))
             JOIN "public"."curso_matriz" "cm" ON (("cm"."id" = "td"."curso_matriz_id")))
             JOIN "public"."disciplinas_catalogo" "dc" ON (("dc"."id" = "cm"."disciplina_id")))
          WHERE (("m"."status" = ANY (ARRAY['ativo'::"text", 'ativa'::"text", 'active'::"text"])) AND ("m"."escola_id" IN ( SELECT "eu"."escola_id"
                   FROM "public"."escola_users" "eu"
                  WHERE ("eu"."user_id" = "auth"."uid"()))))
        ), "avaliacoes" AS (
         SELECT "b"."matricula_id",
            "b"."aluno_id",
            "b"."turma_id",
            "b"."escola_id",
            "b"."ano_letivo",
            "b"."turma_disciplina_id",
            "b"."disciplina_id",
            "b"."disciplina_nome",
            "b"."disciplina_sigla",
            "a"."id" AS "avaliacao_id",
            "a"."nome" AS "avaliacao_nome",
            "a"."tipo" AS "avaliacao_tipo",
            "a"."trimestre",
            "a"."peso" AS "avaliacao_peso"
           FROM ("base" "b"
             LEFT JOIN "public"."avaliacoes" "a" ON ((("a"."turma_disciplina_id" = "b"."turma_disciplina_id") AND ("a"."ano_letivo" = "b"."ano_letivo"))))
        ), "notas" AS (
         SELECT "a"."matricula_id",
            "a"."aluno_id",
            "a"."turma_id",
            "a"."escola_id",
            "a"."ano_letivo",
            "a"."turma_disciplina_id",
            "a"."disciplina_id",
            "a"."disciplina_nome",
            "a"."disciplina_sigla",
            "a"."avaliacao_id",
            "a"."avaliacao_nome",
            "a"."avaliacao_tipo",
            "a"."trimestre",
            "a"."avaliacao_peso",
            "n_1"."valor" AS "nota"
           FROM ("avaliacoes" "a"
             LEFT JOIN "public"."notas" "n_1" ON ((("n_1"."matricula_id" = "a"."matricula_id") AND ("n_1"."avaliacao_id" = "a"."avaliacao_id"))))
        ), "calc" AS (
         SELECT "n_1"."matricula_id",
            "n_1"."aluno_id",
            "n_1"."turma_id",
            "n_1"."escola_id",
            "n_1"."ano_letivo",
            "n_1"."turma_disciplina_id",
            "n_1"."disciplina_id",
            "n_1"."disciplina_nome",
            "n_1"."disciplina_sigla",
            "n_1"."avaliacao_id",
            "n_1"."avaliacao_nome",
            "n_1"."avaliacao_tipo",
            "n_1"."trimestre",
            "n_1"."avaliacao_peso",
            "n_1"."nota",
            COALESCE("cfg"."modelo_avaliacao", 'SIMPLIFICADO'::"text") AS "modelo_avaliacao",
            COALESCE("comp"."peso", "n_1"."avaliacao_peso", (1)::numeric) AS "peso_aplicado"
           FROM (("notas" "n_1"
             LEFT JOIN "configuracoes" "cfg" ON (("cfg"."escola_id" = "n_1"."escola_id")))
             LEFT JOIN "componentes" "comp" ON ((("comp"."escola_id" = "n_1"."escola_id") AND ("comp"."ativo" IS TRUE) AND ("comp"."code" = "upper"(COALESCE("n_1"."avaliacao_tipo", "n_1"."avaliacao_nome"))))))
        )
 SELECT "escola_id",
    "matricula_id",
    "aluno_id",
    "turma_id",
    "ano_letivo",
    "disciplina_id",
    "disciplina_nome",
    "disciplina_sigla",
    "trimestre",
    "jsonb_object_agg"(COALESCE("avaliacao_tipo", "avaliacao_nome"), "nota") FILTER (WHERE (COALESCE("avaliacao_tipo", "avaliacao_nome") IS NOT NULL)) AS "notas_por_tipo",
        CASE
            WHEN ("count"("nota") FILTER (WHERE ("nota" IS NOT NULL)) = 0) THEN NULL::numeric
            WHEN ("modelo_avaliacao" = 'DEPOIS'::"text") THEN NULL::numeric
            ELSE ("sum"(("nota" * "peso_aplicado")) FILTER (WHERE ("nota" IS NOT NULL)) / NULLIF("sum"("peso_aplicado") FILTER (WHERE ("nota" IS NOT NULL)), (0)::numeric))
        END AS "nota_final",
        CASE
            WHEN ("modelo_avaliacao" = 'DEPOIS'::"text") THEN 'PENDENTE_CONFIG'::"text"
            ELSE NULL::"text"
        END AS "status",
    ("modelo_avaliacao" = 'DEPOIS'::"text") AS "needs_config",
    "count"("avaliacao_id") FILTER (WHERE ("avaliacao_id" IS NOT NULL)) AS "total_avaliacoes",
    "count"("nota") FILTER (WHERE ("nota" IS NOT NULL)) AS "total_notas",
        CASE
            WHEN ("count"("avaliacao_id") FILTER (WHERE ("avaliacao_id" IS NOT NULL)) = 0) THEN (1)::bigint
            ELSE GREATEST(("count"("avaliacao_id") FILTER (WHERE ("avaliacao_id" IS NOT NULL)) - "count"("nota") FILTER (WHERE ("nota" IS NOT NULL))), (0)::bigint)
        END AS "missing_count",
        CASE
            WHEN ("count"("nota") FILTER (WHERE ("nota" IS NOT NULL)) = 0) THEN true
            ELSE ("count"("nota") FILTER (WHERE ("nota" IS NOT NULL)) < "count"("avaliacao_id") FILTER (WHERE ("avaliacao_id" IS NOT NULL)))
        END AS "has_missing"
   FROM "calc" "n"
  GROUP BY "escola_id", "matricula_id", "aluno_id", "turma_id", "ano_letivo", "disciplina_id", "disciplina_nome", "disciplina_sigla", "trimestre", "modelo_avaliacao";


ALTER VIEW "public"."vw_boletim_por_matricula" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_cursos_reais" WITH ("security_invoker"='true') AS
 SELECT "id",
    "escola_id",
    "codigo",
    "nome",
    "tipo",
    "descricao",
    "nivel",
    "semestre_id",
    "course_code",
    "curriculum_key",
    "status_aprovacao"
   FROM "internal"."mv_cursos_reais" "m"
  WHERE ("escola_id" IN ( SELECT "eu"."escola_id"
           FROM "public"."escola_users" "eu"
          WHERE ("eu"."user_id" = "auth"."uid"())));


ALTER VIEW "public"."vw_cursos_reais" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_escola_ano_letivo_preferido" WITH ("security_invoker"='true') AS
 SELECT DISTINCT ON ("escola_id") "escola_id",
    "id" AS "ano_letivo_id"
   FROM "public"."anos_letivos" "al"
  WHERE ("escola_id" IN ( SELECT "eu"."escola_id"
           FROM "public"."escola_users" "eu"
          WHERE ("eu"."user_id" = "auth"."uid"())))
  ORDER BY "escola_id", "ativo" DESC, "created_at" DESC;


ALTER VIEW "public"."vw_escola_ano_letivo_preferido" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_escola_estrutura_counts" WITH ("security_invoker"='true') AS
 SELECT "escola_id",
    "cursos_total",
    "classes_total",
    "disciplinas_total"
   FROM "internal"."mv_escola_estrutura_counts" "m"
  WHERE ("escola_id" IN ( SELECT "eu"."escola_id"
           FROM "public"."escola_users" "eu"
          WHERE ("eu"."user_id" = "auth"."uid"())));


ALTER VIEW "public"."vw_escola_estrutura_counts" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_escola_setup_status" WITH ("security_invoker"='true') AS
 SELECT "escola_id",
    "has_ano_letivo_ativo",
    "has_3_trimestres",
    "has_curriculo_published",
    "has_turmas_no_ano",
    "percentage"
   FROM "internal"."mv_escola_setup_status" "m"
  WHERE ("escola_id" IN ( SELECT "eu"."escola_id"
           FROM "public"."escola_users" "eu"
          WHERE ("eu"."user_id" = "auth"."uid"())));


ALTER VIEW "public"."vw_escola_setup_status" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_financeiro_cobrancas_diario" WITH ("security_invoker"='true') AS
 SELECT "escola_id",
    "dia",
    "enviadas",
    "respondidas",
    "pagos",
    "valor_recuperado"
   FROM "internal"."mv_financeiro_cobrancas_diario" "m"
  WHERE ("escola_id" IN ( SELECT "eu"."escola_id"
           FROM "public"."escola_users" "eu"
          WHERE ("eu"."user_id" = "auth"."uid"())));


ALTER VIEW "public"."vw_financeiro_cobrancas_diario" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_financeiro_kpis_geral" WITH ("security_invoker"='true') AS
 SELECT "escola_id",
    "matriculados_total",
    "inadimplentes_total",
    "risco_total",
    "pagos_total",
    "pagos_valor",
    "pendentes_total",
    "pendentes_valor"
   FROM "internal"."mv_financeiro_kpis_geral" "m"
  WHERE ("escola_id" IN ( SELECT "eu"."escola_id"
           FROM "public"."escola_users" "eu"
          WHERE ("eu"."user_id" = "auth"."uid"())));


ALTER VIEW "public"."vw_financeiro_kpis_geral" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_financeiro_kpis_mes" WITH ("security_invoker"='true') AS
 SELECT "escola_id",
    "mes_ref",
    "previsto_total",
    "realizado_total",
    "inadimplencia_total"
   FROM "internal"."mv_financeiro_kpis_mes" "m"
  WHERE ("escola_id" IN ( SELECT "eu"."escola_id"
           FROM "public"."escola_users" "eu"
          WHERE ("eu"."user_id" = "auth"."uid"())));


ALTER VIEW "public"."vw_financeiro_kpis_mes" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_financeiro_radar_resumo" WITH ("security_invoker"='true') AS
 SELECT "escola_id",
    "aluno_id",
    "aluno_nome",
    "turma_nome",
    "meses_atraso",
    "valor_total_atraso",
    "responsavel_nome",
    "telefone_responsavel"
   FROM "internal"."mv_financeiro_radar_resumo" "m"
  WHERE ("escola_id" IN ( SELECT "eu"."escola_id"
           FROM "public"."escola_users" "eu"
          WHERE ("eu"."user_id" = "auth"."uid"())));


ALTER VIEW "public"."vw_financeiro_radar_resumo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_financeiro_sidebar_badges" WITH ("security_invoker"='true') AS
 SELECT "escola_id",
    "candidaturas_pendentes",
    "cobrancas_pendentes"
   FROM "internal"."mv_financeiro_sidebar_badges" "m"
  WHERE ("escola_id" IN ( SELECT "eu"."escola_id"
           FROM "public"."escola_users" "eu"
          WHERE ("eu"."user_id" = "auth"."uid"())));


ALTER VIEW "public"."vw_financeiro_sidebar_badges" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_frequencia_resumo_aluno" WITH ("security_invoker"='true') AS
 SELECT "m"."escola_id",
    "m"."turma_id",
    "m"."aluno_id",
    "count"("f"."id") AS "total_registros",
    "count"(*) FILTER (WHERE ("f"."status" = 'presente'::"text")) AS "presentes",
    "count"(*) FILTER (WHERE ("f"."status" = 'falta'::"text")) AS "faltas",
    "count"(*) FILTER (WHERE ("f"."status" = 'atraso'::"text")) AS "atrasos",
        CASE
            WHEN ("count"("f"."id") = 0) THEN (0)::numeric
            ELSE "round"(((("count"(*) FILTER (WHERE ("f"."status" = 'presente'::"text")))::numeric / ("count"("f"."id"))::numeric) * (100)::numeric), 2)
        END AS "percentual_presenca"
   FROM ("public"."frequencias" "f"
     JOIN "public"."matriculas" "m" ON ((("m"."id" = "f"."matricula_id") AND ("m"."escola_id" = "f"."escola_id"))))
  WHERE (("m"."status" = ANY (ARRAY['ativo'::"text", 'ativa'::"text", 'active'::"text"])) AND ("m"."escola_id" IN ( SELECT "eu"."escola_id"
           FROM "public"."escola_users" "eu"
          WHERE ("eu"."user_id" = "auth"."uid"()))))
  GROUP BY "m"."escola_id", "m"."turma_id", "m"."aluno_id";


ALTER VIEW "public"."vw_frequencia_resumo_aluno" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_matriculas_secretaria" WITH ("security_invoker"='true') AS
 SELECT "m"."id" AS "matricula_id",
    "m"."escola_id",
    "m"."ano_letivo",
    "m"."status" AS "matricula_status",
    "m"."numero_matricula",
    "m"."created_at",
    "a"."id" AS "aluno_id",
    "a"."nome" AS "aluno_nome",
    "a"."status" AS "aluno_status",
    "t"."id" AS "turma_id",
    "t"."nome" AS "turma_nome"
   FROM (("public"."matriculas" "m"
     JOIN "public"."alunos" "a" ON (("a"."id" = "m"."aluno_id")))
     LEFT JOIN "public"."turmas" "t" ON (("t"."id" = "m"."turma_id")))
  WHERE ("m"."escola_id" IN ( SELECT "eu"."escola_id"
           FROM "public"."escola_users" "eu"
          WHERE ("eu"."user_id" = "auth"."uid"())));


ALTER VIEW "public"."vw_matriculas_secretaria" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_migracao_cursos_lookup" WITH ("security_invoker"='true') AS
 SELECT "id",
    "escola_id",
    "codigo",
    "course_code",
    "status_aprovacao"
   FROM "internal"."mv_migracao_cursos_lookup" "m"
  WHERE ("escola_id" IN ( SELECT "eu"."escola_id"
           FROM "public"."escola_users" "eu"
          WHERE ("eu"."user_id" = "auth"."uid"())));


ALTER VIEW "public"."vw_migracao_cursos_lookup" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_migracao_turmas_lookup" WITH ("security_invoker"='true') AS
 SELECT "id",
    "escola_id",
    "turma_code",
    "ano_letivo",
    "nome"
   FROM "internal"."mv_migracao_turmas_lookup" "m"
  WHERE ("escola_id" IN ( SELECT "eu"."escola_id"
           FROM "public"."escola_users" "eu"
          WHERE ("eu"."user_id" = "auth"."uid"())));


ALTER VIEW "public"."vw_migracao_turmas_lookup" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_ocupacao_turmas" WITH ("security_invoker"='true') AS
 SELECT "id",
    "escola_id",
    "nome",
    "classe",
    "turno",
    "sala",
    "capacidade_maxima",
    "total_matriculas_ativas",
    "ocupacao_percentual",
    "status_ocupacao"
   FROM "internal"."mv_ocupacao_turmas" "m"
  WHERE ("escola_id" IN ( SELECT "eu"."escola_id"
           FROM "public"."escola_users" "eu"
          WHERE ("eu"."user_id" = "auth"."uid"())));


ALTER VIEW "public"."vw_ocupacao_turmas" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_presencas_por_turma" WITH ("security_invoker"='true') AS
 SELECT "p"."escola_id",
    "p"."turma_id",
    "m"."id" AS "matricula_id",
    "p"."aluno_id",
    "a"."nome" AS "aluno_nome",
    "p"."data",
    "p"."status",
    "p"."disciplina_id",
    "p"."created_at"
   FROM (("public"."presencas" "p"
     JOIN "public"."alunos" "a" ON (("a"."id" = "p"."aluno_id")))
     LEFT JOIN "public"."matriculas" "m" ON ((("m"."aluno_id" = "p"."aluno_id") AND ("m"."turma_id" = "p"."turma_id") AND ("m"."escola_id" = "p"."escola_id") AND ("m"."status" = ANY (ARRAY['ativo'::"text", 'ativa'::"text", 'active'::"text"])))))
  WHERE ("p"."escola_id" IN ( SELECT "eu"."escola_id"
           FROM "public"."escola_users" "eu"
          WHERE ("eu"."user_id" = "auth"."uid"())));


ALTER VIEW "public"."vw_presencas_por_turma" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_radar_inadimplencia" WITH ("security_invoker"='true') AS
 SELECT "escola_id",
    "mensalidade_id",
    "aluno_id",
    "nome_aluno",
    "responsavel",
    "telefone",
    "nome_turma",
    "valor_previsto",
    "valor_pago_total",
    "valor_em_atraso",
    "data_vencimento",
    "dias_em_atraso",
    "status_risco",
    "status_mensalidade"
   FROM "internal"."mv_radar_inadimplencia" "m"
  WHERE ("escola_id" IN ( SELECT "eu"."escola_id"
           FROM "public"."escola_users" "eu"
          WHERE ("eu"."user_id" = "auth"."uid"())));


ALTER VIEW "public"."vw_radar_inadimplencia" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_search_alunos" WITH ("security_invoker"='true') AS
 SELECT "id",
    "escola_id",
    'aluno'::"text" AS "type",
    COALESCE("nome_completo", "nome") AS "label",
    COALESCE("numero_processo", "bi_numero") AS "highlight",
    COALESCE("search_text", ''::"text") AS "search_text",
    COALESCE("updated_at", "created_at") AS "updated_at",
    "created_at"
   FROM "public"."alunos" "a"
  WHERE (("deleted_at" IS NULL) AND ("escola_id" IN ( SELECT "eu"."escola_id"
           FROM "public"."escola_users" "eu"
          WHERE ("eu"."user_id" = "auth"."uid"()))));


ALTER VIEW "public"."vw_search_alunos" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_search_classes" WITH ("security_invoker"='true') AS
 SELECT "id",
    "escola_id",
    'classe'::"text" AS "type",
    "nome" AS "label",
    COALESCE(("numero")::"text", "nivel", ''::"text") AS "highlight",
    "concat_ws"(' '::"text", "nome", "descricao", "nivel", ("numero")::"text") AS "search_text",
    "created_at" AS "updated_at",
    "created_at"
   FROM "public"."classes" "cl"
  WHERE ("escola_id" IN ( SELECT "eu"."escola_id"
           FROM "public"."escola_users" "eu"
          WHERE ("eu"."user_id" = "auth"."uid"())));


ALTER VIEW "public"."vw_search_classes" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_search_cursos" WITH ("security_invoker"='true') AS
 SELECT "id",
    "escola_id",
    'curso'::"text" AS "type",
    "nome" AS "label",
    COALESCE("codigo", "course_code", ''::"text") AS "highlight",
    "concat_ws"(' '::"text", "nome", "codigo", "course_code", "tipo", "nivel") AS "search_text",
    COALESCE("updated_at", "created_at") AS "updated_at",
    "created_at"
   FROM "public"."cursos" "c"
  WHERE ("escola_id" IN ( SELECT "eu"."escola_id"
           FROM "public"."escola_users" "eu"
          WHERE ("eu"."user_id" = "auth"."uid"())));


ALTER VIEW "public"."vw_search_cursos" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_search_documentos" WITH ("security_invoker"='true') AS
 SELECT "d"."id",
    "d"."escola_id",
    'documento'::"text" AS "type",
    "concat_ws"(' · '::"text", ("d"."tipo")::"text", COALESCE("a"."nome_completo", "a"."nome")) AS "label",
    ("d"."tipo")::"text" AS "highlight",
    "concat_ws"(' '::"text", ("d"."tipo")::"text", COALESCE("a"."search_text", ''::"text")) AS "search_text",
    "d"."created_at" AS "updated_at",
    "d"."created_at"
   FROM ("public"."documentos_emitidos" "d"
     JOIN "public"."alunos" "a" ON (("a"."id" = "d"."aluno_id")))
  WHERE (("d"."revoked_at" IS NULL) AND ("d"."escola_id" IN ( SELECT "eu"."escola_id"
           FROM "public"."escola_users" "eu"
          WHERE ("eu"."user_id" = "auth"."uid"()))));


ALTER VIEW "public"."vw_search_documentos" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_search_matriculas" WITH ("security_invoker"='true') AS
 SELECT "m"."id",
    "m"."escola_id",
    'matricula'::"text" AS "type",
    "concat_ws"(' · '::"text", COALESCE("a"."nome_completo", "a"."nome"), "t"."nome") AS "label",
    COALESCE("m"."status", ''::"text") AS "highlight",
    "concat_ws"(' '::"text", COALESCE("a"."search_text", ''::"text"), "t"."nome", COALESCE("m"."status", ''::"text"), COALESCE("m"."numero_matricula", ''::"text")) AS "search_text",
    COALESCE("m"."updated_at", "m"."created_at") AS "updated_at",
    "m"."created_at"
   FROM (("public"."matriculas" "m"
     JOIN "public"."alunos" "a" ON (("a"."id" = "m"."aluno_id")))
     JOIN "public"."turmas" "t" ON (("t"."id" = "m"."turma_id")))
  WHERE (("a"."deleted_at" IS NULL) AND ("m"."escola_id" IN ( SELECT "eu"."escola_id"
           FROM "public"."escola_users" "eu"
          WHERE ("eu"."user_id" = "auth"."uid"()))));


ALTER VIEW "public"."vw_search_matriculas" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_search_mensalidades" WITH ("security_invoker"='true') AS
 SELECT "m"."id",
    "m"."escola_id",
    'mensalidade'::"text" AS "type",
    "concat_ws"(' · '::"text", COALESCE("a"."nome_completo", "a"."nome", 'Aluno'::"text"), (("lpad"((COALESCE(("m"."mes_referencia")::integer, 0))::"text", 2, '0'::"text") || '/'::"text") || COALESCE(("m"."ano_referencia")::"text", "m"."ano_letivo", ''::"text"))) AS "label",
    COALESCE("m"."status", ''::"text") AS "highlight",
    "concat_ws"(' '::"text", COALESCE("a"."search_text", ''::"text"), COALESCE("m"."status", ''::"text"), COALESCE("m"."metodo_pagamento", ''::"text"), COALESCE("m"."ano_letivo", ''::"text"), COALESCE(("m"."mes_referencia")::"text", ''::"text"), COALESCE(("m"."ano_referencia")::"text", ''::"text")) AS "search_text",
    COALESCE("m"."updated_at", "m"."created_at") AS "updated_at",
    "m"."created_at"
   FROM ("public"."mensalidades" "m"
     LEFT JOIN "public"."alunos" "a" ON (("a"."id" = "m"."aluno_id")))
  WHERE ((("a"."deleted_at" IS NULL) OR ("a"."id" IS NULL)) AND ("m"."escola_id" IN ( SELECT "eu"."escola_id"
           FROM "public"."escola_users" "eu"
          WHERE ("eu"."user_id" = "auth"."uid"()))));


ALTER VIEW "public"."vw_search_mensalidades" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_search_pagamentos" WITH ("security_invoker"='true') AS
 SELECT "p"."id",
    "p"."escola_id",
    'pagamento'::"text" AS "type",
    "concat_ws"(' · '::"text", COALESCE("a"."nome_completo", "a"."nome", 'Pagamento'::"text"), COALESCE(("p"."valor_pago")::"text", ''::"text")) AS "label",
    COALESCE("p"."status", "p"."metodo_pagamento", ''::"text") AS "highlight",
    "concat_ws"(' '::"text", COALESCE("a"."search_text", ''::"text"), COALESCE("p"."status", ''::"text"), COALESCE("p"."metodo_pagamento", ''::"text"), COALESCE("p"."referencia", ''::"text"), COALESCE("p"."transacao_id_externo", ''::"text")) AS "search_text",
    COALESCE("p"."created_at", "now"()) AS "updated_at",
    "p"."created_at"
   FROM (("public"."pagamentos" "p"
     LEFT JOIN "public"."mensalidades" "m" ON (("m"."id" = "p"."mensalidade_id")))
     LEFT JOIN "public"."alunos" "a" ON (("a"."id" = "m"."aluno_id")))
  WHERE ((("a"."deleted_at" IS NULL) OR ("a"."id" IS NULL)) AND ("p"."escola_id" IN ( SELECT "eu"."escola_id"
           FROM "public"."escola_users" "eu"
          WHERE ("eu"."user_id" = "auth"."uid"()))));


ALTER VIEW "public"."vw_search_pagamentos" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_search_professores" WITH ("security_invoker"='true') AS
 SELECT "p"."id",
    "p"."escola_id",
    'professor'::"text" AS "type",
    COALESCE("pr"."nome", "p"."apelido", 'Professor'::"text") AS "label",
    COALESCE("pr"."email", ''::"text") AS "highlight",
    "concat_ws"(' '::"text", COALESCE("pr"."nome", ''::"text"), COALESCE("p"."apelido", ''::"text"), COALESCE("pr"."email", ''::"text"), COALESCE("pr"."numero_login", ''::"text")) AS "search_text",
    COALESCE("pr"."updated_at", "p"."created_at") AS "updated_at",
    COALESCE("pr"."created_at", "p"."created_at") AS "created_at"
   FROM ("public"."professores" "p"
     LEFT JOIN "public"."profiles" "pr" ON (("pr"."user_id" = "p"."profile_id")))
  WHERE ((("pr"."deleted_at" IS NULL) OR ("pr"."user_id" IS NULL)) AND ("p"."escola_id" IN ( SELECT "eu"."escola_id"
           FROM "public"."escola_users" "eu"
          WHERE ("eu"."user_id" = "auth"."uid"()))));


ALTER VIEW "public"."vw_search_professores" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_search_recibos" WITH ("security_invoker"='true') AS
 SELECT "d"."id",
    "d"."escola_id",
    'recibo'::"text" AS "type",
    "concat_ws"(' · '::"text", 'Recibo', COALESCE("a"."nome_completo", "a"."nome", 'Aluno'::"text")) AS "label",
    ("d"."public_id")::"text" AS "highlight",
    "concat_ws"(' '::"text", ("d"."public_id")::"text", COALESCE("a"."search_text", ''::"text"), 'recibo') AS "search_text",
    "d"."created_at" AS "updated_at",
    "d"."created_at"
   FROM ("public"."documentos_emitidos" "d"
     JOIN "public"."alunos" "a" ON (("a"."id" = "d"."aluno_id")))
  WHERE (("d"."tipo" = 'recibo'::"public"."tipo_documento") AND ("d"."revoked_at" IS NULL) AND ("d"."escola_id" IN ( SELECT "eu"."escola_id"
           FROM "public"."escola_users" "eu"
          WHERE ("eu"."user_id" = "auth"."uid"()))));


ALTER VIEW "public"."vw_search_recibos" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_search_turmas" WITH ("security_invoker"='true') AS
 SELECT "id",
    "escola_id",
    'turma'::"text" AS "type",
    "nome" AS "label",
    COALESCE("turma_codigo", "turma_code", "turno") AS "highlight",
    "concat_ws"(' '::"text", "nome", "turma_codigo", "turma_code", "turno") AS "search_text",
    COALESCE("updated_at", "created_at") AS "updated_at",
    "created_at"
   FROM "public"."turmas" "t"
  WHERE ("escola_id" IN ( SELECT "eu"."escola_id"
           FROM "public"."escola_users" "eu"
          WHERE ("eu"."user_id" = "auth"."uid"())));


ALTER VIEW "public"."vw_search_turmas" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_search_usuarios" WITH ("security_invoker"='true') AS
 SELECT "eu"."id",
    "eu"."escola_id",
    'usuario'::"text" AS "type",
    COALESCE("pr"."nome", "pr"."email", 'Usuário'::"text") AS "label",
    COALESCE("eu"."papel", "eu"."role", ''::"text") AS "highlight",
    "concat_ws"(' '::"text", COALESCE("pr"."nome", ''::"text"), COALESCE("pr"."email", ''::"text"), COALESCE("eu"."papel", ''::"text"), COALESCE("eu"."role", ''::"text"), COALESCE("pr"."numero_login", ''::"text")) AS "search_text",
    COALESCE("pr"."updated_at", "eu"."created_at") AS "updated_at",
    COALESCE("pr"."created_at", "eu"."created_at") AS "created_at"
   FROM ("public"."escola_users" "eu"
     LEFT JOIN "public"."profiles" "pr" ON (("pr"."user_id" = "eu"."user_id")))
  WHERE ((("pr"."deleted_at" IS NULL) OR ("pr"."user_id" IS NULL)) AND ("eu"."escola_id" IN ( SELECT "eu_filter"."escola_id"
           FROM "public"."escola_users" "eu_filter"
          WHERE ("eu_filter"."user_id" = "auth"."uid"()))));


ALTER VIEW "public"."vw_search_usuarios" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_secretaria_dashboard_counts" WITH ("security_invoker"='true') AS
 SELECT "escola_id",
    "alunos_ativos",
    "matriculas_total",
    "turmas_total"
   FROM "internal"."mv_secretaria_dashboard_counts" "m"
  WHERE ("escola_id" IN ( SELECT "eu"."escola_id"
           FROM "public"."escola_users" "eu"
          WHERE ("eu"."user_id" = "auth"."uid"())));


ALTER VIEW "public"."vw_secretaria_dashboard_counts" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_secretaria_dashboard_kpis" AS
SELECT
    NULL::"uuid" AS "escola_id",
    NULL::integer AS "total_alunos",
    NULL::integer AS "total_turmas",
    NULL::integer AS "matriculas_ativas",
    NULL::integer AS "pendencias_importacao",
    NULL::integer AS "turmas_sem_professor",
    NULL::integer AS "alunos_sem_turma",
    NULL::integer AS "inadimplentes_total",
    NULL::numeric(14,2) AS "risco_total",
    NULL::"jsonb" AS "resumo_status",
    NULL::"jsonb" AS "turmas_destaque",
    NULL::"jsonb" AS "novas_matriculas",
    NULL::"jsonb" AS "avisos_recentes";


ALTER VIEW "public"."vw_secretaria_dashboard_kpis" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_secretaria_matriculas_status" WITH ("security_invoker"='true') AS
 SELECT "escola_id",
    "status",
    "total"
   FROM "internal"."mv_secretaria_matriculas_status" "m"
  WHERE ("escola_id" IN ( SELECT "eu"."escola_id"
           FROM "public"."escola_users" "eu"
          WHERE ("eu"."user_id" = "auth"."uid"())));


ALTER VIEW "public"."vw_secretaria_matriculas_status" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_secretaria_matriculas_turma_status" WITH ("security_invoker"='true') AS
 SELECT "escola_id",
    "turma_id",
    "status",
    "total"
   FROM "internal"."mv_secretaria_matriculas_turma_status" "m"
  WHERE ("escola_id" IN ( SELECT "eu"."escola_id"
           FROM "public"."escola_users" "eu"
          WHERE ("eu"."user_id" = "auth"."uid"())));


ALTER VIEW "public"."vw_secretaria_matriculas_turma_status" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_staging_alunos_summary" WITH ("security_invoker"='true') AS
 SELECT "escola_id",
    "import_id",
    "turma_codigo",
    "ano_letivo",
    "total_alunos"
   FROM "internal"."mv_staging_alunos_summary" "m"
  WHERE ("escola_id" IN ( SELECT "eu"."escola_id"
           FROM "public"."escola_users" "eu"
          WHERE ("eu"."user_id" = "auth"."uid"())));


ALTER VIEW "public"."vw_staging_alunos_summary" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_total_em_aberto_por_mes" WITH ("security_invoker"='true') AS
 SELECT "escola_id",
    "ano",
    "mes",
    "total_aberto"
   FROM "internal"."mv_total_em_aberto_por_mes" "m"
  WHERE ("escola_id" IN ( SELECT "eu"."escola_id"
           FROM "public"."escola_users" "eu"
          WHERE ("eu"."user_id" = "auth"."uid"())));


ALTER VIEW "public"."vw_total_em_aberto_por_mes" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_turmas_para_matricula" WITH ("security_invoker"='true') AS
 SELECT "id",
    "escola_id",
    "session_id",
    "turma_nome",
    "turma_codigo",
    "turno",
    "capacidade_maxima",
    "sala",
    "classe_nome",
    "curso_nome",
    "curso_tipo",
    "curso_is_custom",
    "curso_global_hash",
    "classe_id",
    "curso_id",
    "ano_letivo",
    "ocupacao_atual",
    "ultima_matricula",
    "status_validacao"
   FROM "internal"."mv_turmas_para_matricula" "m"
  WHERE ("escola_id" IN ( SELECT "eu"."escola_id"
           FROM "public"."escola_users" "eu"
          WHERE ("eu"."user_id" = "auth"."uid"())));


ALTER VIEW "public"."vw_turmas_para_matricula" OWNER TO "postgres";


ALTER TABLE ONLY "public"."frequencias" ATTACH PARTITION "public"."frequencias_2025_09" FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');



ALTER TABLE ONLY "public"."frequencias" ATTACH PARTITION "public"."frequencias_2025_10" FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');



ALTER TABLE ONLY "public"."frequencias" ATTACH PARTITION "public"."frequencias_2025_11" FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');



ALTER TABLE ONLY "public"."frequencias" ATTACH PARTITION "public"."frequencias_2025_12" FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');



ALTER TABLE ONLY "public"."frequencias" ATTACH PARTITION "public"."frequencias_2026_01" FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');



ALTER TABLE ONLY "public"."frequencias" ATTACH PARTITION "public"."frequencias_2026_02" FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');



ALTER TABLE ONLY "public"."frequencias" ATTACH PARTITION "public"."frequencias_default" DEFAULT;



ALTER TABLE ONLY "public"."lancamentos" ATTACH PARTITION "public"."lancamentos_2025_09" FOR VALUES FROM ('2025-09-01 00:00:00+00') TO ('2025-10-01 00:00:00+00');



ALTER TABLE ONLY "public"."lancamentos" ATTACH PARTITION "public"."lancamentos_2025_10" FOR VALUES FROM ('2025-10-01 00:00:00+00') TO ('2025-11-01 00:00:00+00');



ALTER TABLE ONLY "public"."lancamentos" ATTACH PARTITION "public"."lancamentos_2025_11" FOR VALUES FROM ('2025-11-01 00:00:00+00') TO ('2025-12-01 00:00:00+00');



ALTER TABLE ONLY "public"."lancamentos" ATTACH PARTITION "public"."lancamentos_2025_12" FOR VALUES FROM ('2025-12-01 00:00:00+00') TO ('2026-01-01 00:00:00+00');



ALTER TABLE ONLY "public"."lancamentos" ATTACH PARTITION "public"."lancamentos_2026_01" FOR VALUES FROM ('2026-01-01 00:00:00+00') TO ('2026-02-01 00:00:00+00');



ALTER TABLE ONLY "public"."lancamentos" ATTACH PARTITION "public"."lancamentos_2026_02" FOR VALUES FROM ('2026-02-01 00:00:00+00') TO ('2026-03-01 00:00:00+00');



ALTER TABLE ONLY "public"."lancamentos" ATTACH PARTITION "public"."lancamentos_default" DEFAULT;



ALTER TABLE ONLY "public"."audit_logs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."audit_logs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."import_errors" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."import_errors_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."permissions" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."permissions_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."roles" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."roles_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."staging_alunos" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."staging_alunos_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."turmas"
    ADD CONSTRAINT "turmas_pkey" PRIMARY KEY ("id");



CREATE MATERIALIZED VIEW "internal"."mv_secretaria_dashboard_kpis" AS
 WITH "alunos_ativos" AS (
         SELECT "matriculas"."escola_id",
            "count"(DISTINCT "matriculas"."aluno_id") AS "total"
           FROM "public"."matriculas"
          WHERE ("matriculas"."status" = ANY (ARRAY['ativa'::"text", 'ativo'::"text", 'active'::"text"]))
          GROUP BY "matriculas"."escola_id"
        ), "matriculas_ativas" AS (
         SELECT "matriculas"."escola_id",
            "count"(*) AS "total"
           FROM "public"."matriculas"
          WHERE ("matriculas"."status" = ANY (ARRAY['ativa'::"text", 'ativo'::"text", 'active'::"text"]))
          GROUP BY "matriculas"."escola_id"
        ), "turmas_total" AS (
         SELECT "turmas_1"."escola_id",
            "count"(*) AS "total"
           FROM "public"."turmas" "turmas_1"
          GROUP BY "turmas_1"."escola_id"
        ), "pendencias_importacao" AS (
         SELECT "import_migrations"."escola_id",
            "count"(*) AS "total"
           FROM "public"."import_migrations"
          WHERE (("import_migrations"."status" IS NULL) OR ("import_migrations"."status" <> 'imported'::"text"))
          GROUP BY "import_migrations"."escola_id"
        ), "turmas_sem_professor" AS (
         SELECT "t"."escola_id",
            "count"(DISTINCT "t"."id") AS "total"
           FROM ("public"."turmas" "t"
             LEFT JOIN ( SELECT DISTINCT "turma_disciplinas"."turma_id",
                    "turma_disciplinas"."escola_id"
                   FROM "public"."turma_disciplinas"
                  WHERE ("turma_disciplinas"."professor_id" IS NOT NULL)) "td" ON ((("td"."turma_id" = "t"."id") AND ("td"."escola_id" = "t"."escola_id"))))
          WHERE ("td"."turma_id" IS NULL)
          GROUP BY "t"."escola_id"
        ), "alunos_sem_turma" AS (
         SELECT "a"."escola_id",
            "count"(DISTINCT "a"."id") AS "total"
           FROM ("public"."alunos" "a"
             LEFT JOIN "public"."matriculas" "m" ON ((("m"."aluno_id" = "a"."id") AND ("m"."escola_id" = "a"."escola_id") AND ("m"."status" = ANY (ARRAY['ativa'::"text", 'ativo'::"text", 'active'::"text"])))))
          WHERE ("m"."id" IS NULL)
          GROUP BY "a"."escola_id"
        )
 SELECT "e"."id" AS "escola_id",
    (COALESCE("alunos_ativos"."total", (0)::bigint))::integer AS "total_alunos",
    (COALESCE("turmas_total"."total", (0)::bigint))::integer AS "total_turmas",
    (COALESCE("matriculas_ativas"."total", (0)::bigint))::integer AS "matriculas_ativas",
    (COALESCE("pendencias_importacao"."total", (0)::bigint))::integer AS "pendencias_importacao",
    (COALESCE("turmas_sem_professor"."total", (0)::bigint))::integer AS "turmas_sem_professor",
    (COALESCE("alunos_sem_turma"."total", (0)::bigint))::integer AS "alunos_sem_turma",
    COALESCE("fin"."inadimplentes_total", 0) AS "inadimplentes_total",
    (COALESCE("fin"."risco_total", (0)::numeric))::numeric(14,2) AS "risco_total",
    COALESCE("resumo"."resumo_status", '[]'::"jsonb") AS "resumo_status",
    COALESCE("turmas"."turmas_destaque", '[]'::"jsonb") AS "turmas_destaque",
    COALESCE("novas"."novas_matriculas", '[]'::"jsonb") AS "novas_matriculas",
    '[]'::"jsonb" AS "avisos_recentes"
   FROM (((((((((("public"."escolas" "e"
     LEFT JOIN "alunos_ativos" ON (("alunos_ativos"."escola_id" = "e"."id")))
     LEFT JOIN "turmas_total" ON (("turmas_total"."escola_id" = "e"."id")))
     LEFT JOIN "matriculas_ativas" ON (("matriculas_ativas"."escola_id" = "e"."id")))
     LEFT JOIN "pendencias_importacao" ON (("pendencias_importacao"."escola_id" = "e"."id")))
     LEFT JOIN "turmas_sem_professor" ON (("turmas_sem_professor"."escola_id" = "e"."id")))
     LEFT JOIN "alunos_sem_turma" ON (("alunos_sem_turma"."escola_id" = "e"."id")))
     LEFT JOIN "internal"."mv_financeiro_kpis_geral" "fin" ON (("fin"."escola_id" = "e"."id")))
     LEFT JOIN LATERAL ( SELECT "jsonb_agg"("jsonb_build_object"('status', "s"."status", 'total', "s"."total") ORDER BY "s"."status") AS "resumo_status"
           FROM "internal"."mv_secretaria_matriculas_status" "s"
          WHERE ("s"."escola_id" = "e"."id")) "resumo" ON (true))
     LEFT JOIN LATERAL ( SELECT "jsonb_agg"("jsonb_build_object"('id', "t"."id", 'nome', "t"."nome", 'total_alunos', "t"."total_alunos") ORDER BY "t"."total_alunos" DESC) AS "turmas_destaque"
           FROM ( SELECT "t_1"."id",
                    "t_1"."nome",
                    "count"("m"."id") AS "total_alunos"
                   FROM ("public"."turmas" "t_1"
                     LEFT JOIN "public"."matriculas" "m" ON ((("m"."turma_id" = "t_1"."id") AND ("m"."status" = ANY (ARRAY['ativa'::"text", 'ativo'::"text", 'active'::"text"])))))
                  WHERE ("t_1"."escola_id" = "e"."id")
                  GROUP BY "t_1"."id"
                  ORDER BY ("count"("m"."id")) DESC
                 LIMIT 4) "t") "turmas" ON (true))
     LEFT JOIN LATERAL ( SELECT "jsonb_agg"("jsonb_build_object"('id', "m"."id", 'created_at', "m"."created_at", 'aluno', "jsonb_build_object"('nome', COALESCE("a"."nome_completo", "a"."nome", 'Aluno'::"text")), 'turma', "jsonb_build_object"('nome', COALESCE("t"."nome", 'Sem turma'::"text"))) ORDER BY "m"."created_at" DESC) AS "novas_matriculas"
           FROM ((( SELECT "matriculas"."id",
                    "matriculas"."aluno_id",
                    "matriculas"."turma_id",
                    "matriculas"."created_at"
                   FROM "public"."matriculas"
                  WHERE ("matriculas"."escola_id" = "e"."id")
                  ORDER BY "matriculas"."created_at" DESC
                 LIMIT 6) "m"
             LEFT JOIN "public"."alunos" "a" ON (("a"."id" = "m"."aluno_id")))
             LEFT JOIN "public"."turmas" "t" ON (("t"."id" = "m"."turma_id")))) "novas" ON (true))
  WITH NO DATA;


ALTER MATERIALIZED VIEW "internal"."mv_secretaria_dashboard_kpis" OWNER TO "postgres";


ALTER TABLE ONLY "public"."aluno_processo_counters"
    ADD CONSTRAINT "aluno_processo_counters_pkey" PRIMARY KEY ("escola_id");



ALTER TABLE ONLY "public"."alunos_excluidos"
    ADD CONSTRAINT "alunos_excluidos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."alunos"
    ADD CONSTRAINT "alunos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."alunos"
    ADD CONSTRAINT "alunos_profile_escola_uniq" UNIQUE ("profile_id", "escola_id");



ALTER TABLE ONLY "public"."anos_letivos"
    ADD CONSTRAINT "anos_letivos_escola_id_ano_key" UNIQUE ("escola_id", "ano");



ALTER TABLE ONLY "public"."anos_letivos"
    ADD CONSTRAINT "anos_letivos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."atribuicoes_prof"
    ADD CONSTRAINT "atribuicoes_prof_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."aulas"
    ADD CONSTRAINT "aulas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."avaliacoes"
    ADD CONSTRAINT "avaliacoes_escola_turma_ano_trimestre_tipo_uk" UNIQUE ("escola_id", "turma_disciplina_id", "ano_letivo", "trimestre", "tipo");



ALTER TABLE ONLY "public"."avaliacoes"
    ADD CONSTRAINT "avaliacoes_pkey1" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."candidaturas"
    ADD CONSTRAINT "candidaturas_matricula_id_unique" UNIQUE ("matricula_id");



ALTER TABLE ONLY "public"."candidaturas"
    ADD CONSTRAINT "candidaturas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."candidaturas_status_log"
    ADD CONSTRAINT "candidaturas_status_log_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."matriculas"
    ADD CONSTRAINT "chk_matricula_turma_obrigatoria_se_ativa" CHECK ((("status" <> ALL (ARRAY['ativo'::"text", 'concluido'::"text", 'transferido'::"text"])) OR ("turma_id" IS NOT NULL))) NOT VALID;



ALTER TABLE "public"."turmas"
    ADD CONSTRAINT "chk_turma_classe_obrigatoria_se_ativa" CHECK ((("status_validacao" <> 'ativo'::"text") OR ("classe_id" IS NOT NULL))) NOT VALID;



ALTER TABLE "public"."turmas"
    ADD CONSTRAINT "chk_turma_curso_obrigatorio_se_ativa" CHECK ((("status_validacao" <> 'ativo'::"text") OR ("curso_id" IS NOT NULL))) NOT VALID;



ALTER TABLE ONLY "public"."classes"
    ADD CONSTRAINT "classes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."configuracoes_curriculo"
    ADD CONSTRAINT "configuracoes_curriculo_escola_id_curso_id_key" UNIQUE ("escola_id", "curso_id");



ALTER TABLE ONLY "public"."configuracoes_curriculo"
    ADD CONSTRAINT "configuracoes_curriculo_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."configuracoes_escola"
    ADD CONSTRAINT "configuracoes_escola_pkey" PRIMARY KEY ("escola_id");



ALTER TABLE ONLY "public"."curso_curriculos"
    ADD CONSTRAINT "curso_curriculos_escola_curso_ano_version_uk" UNIQUE ("escola_id", "curso_id", "ano_letivo_id", "version");



ALTER TABLE ONLY "public"."curso_curriculos"
    ADD CONSTRAINT "curso_curriculos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."curso_matriz"
    ADD CONSTRAINT "curso_matriz_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cursos_globais_cache"
    ADD CONSTRAINT "cursos_globais_cache_pkey" PRIMARY KEY ("hash");



ALTER TABLE ONLY "public"."cursos"
    ADD CONSTRAINT "cursos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."disciplinas_catalogo"
    ADD CONSTRAINT "disciplinas_catalogo_escola_id_nome_norm_key" UNIQUE ("escola_id", "nome_norm");



ALTER TABLE ONLY "public"."disciplinas_catalogo"
    ADD CONSTRAINT "disciplinas_catalogo_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."documentos_emitidos"
    ADD CONSTRAINT "documentos_emitidos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."documentos_emitidos"
    ADD CONSTRAINT "documentos_emitidos_public_id_key" UNIQUE ("public_id");



ALTER TABLE ONLY "public"."escola_administradores"
    ADD CONSTRAINT "escola_administradores_escola_id_user_id_key" UNIQUE ("escola_id", "user_id");



ALTER TABLE ONLY "public"."escola_administradores"
    ADD CONSTRAINT "escola_administradores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."escola_auditoria"
    ADD CONSTRAINT "escola_auditoria_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."escola_configuracoes"
    ADD CONSTRAINT "escola_configuracoes_pkey" PRIMARY KEY ("escola_id");



ALTER TABLE ONLY "public"."escola_users"
    ADD CONSTRAINT "escola_users_escola_id_user_id_key" UNIQUE ("escola_id", "user_id");



ALTER TABLE ONLY "public"."escola_users"
    ADD CONSTRAINT "escola_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."escolas"
    ADD CONSTRAINT "escolas_cnpj_key" UNIQUE ("nif");



ALTER TABLE ONLY "public"."escolas"
    ADD CONSTRAINT "escolas_nome_unique" UNIQUE ("nome");



ALTER TABLE ONLY "public"."escolas"
    ADD CONSTRAINT "escolas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."finance_payment_intents"
    ADD CONSTRAINT "finance_payment_intents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."financeiro_cobrancas"
    ADD CONSTRAINT "financeiro_cobrancas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."financeiro_contratos"
    ADD CONSTRAINT "financeiro_contratos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."financeiro_estornos"
    ADD CONSTRAINT "financeiro_estornos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."financeiro_itens"
    ADD CONSTRAINT "financeiro_itens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."financeiro_lancamentos"
    ADD CONSTRAINT "financeiro_lancamentos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."financeiro_tabelas"
    ADD CONSTRAINT "financeiro_tabelas_escola_id_ano_letivo_curso_id_classe_id_key" UNIQUE ("escola_id", "ano_letivo", "curso_id", "classe_id");



ALTER TABLE ONLY "public"."financeiro_tabelas"
    ADD CONSTRAINT "financeiro_tabelas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."financeiro_titulos"
    ADD CONSTRAINT "financeiro_titulos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."frequencia_status_periodo"
    ADD CONSTRAINT "frequencia_status_periodo_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."frequencias"
    ADD CONSTRAINT "uq_frequencias_escola_matricula_data" UNIQUE ("escola_id", "matricula_id", "data");



ALTER TABLE ONLY "public"."frequencias_2025_09"
    ADD CONSTRAINT "frequencias_2025_09_escola_id_matricula_id_data_key" UNIQUE ("escola_id", "matricula_id", "data");



ALTER TABLE ONLY "public"."frequencias_2025_09"
    ADD CONSTRAINT "frequencias_2025_09_pkey" PRIMARY KEY ("id", "data");



ALTER TABLE ONLY "public"."frequencias_2025_10"
    ADD CONSTRAINT "frequencias_2025_10_escola_id_matricula_id_data_key" UNIQUE ("escola_id", "matricula_id", "data");



ALTER TABLE ONLY "public"."frequencias_2025_10"
    ADD CONSTRAINT "frequencias_2025_10_pkey" PRIMARY KEY ("id", "data");



ALTER TABLE ONLY "public"."frequencias_2025_11"
    ADD CONSTRAINT "frequencias_2025_11_escola_id_matricula_id_data_key" UNIQUE ("escola_id", "matricula_id", "data");



ALTER TABLE ONLY "public"."frequencias_2025_11"
    ADD CONSTRAINT "frequencias_2025_11_pkey" PRIMARY KEY ("id", "data");



ALTER TABLE ONLY "public"."frequencias_2025_12"
    ADD CONSTRAINT "frequencias_2025_12_escola_id_matricula_id_data_key" UNIQUE ("escola_id", "matricula_id", "data");



ALTER TABLE ONLY "public"."frequencias_2025_12"
    ADD CONSTRAINT "frequencias_2025_12_pkey" PRIMARY KEY ("id", "data");



ALTER TABLE ONLY "public"."frequencias_2026_01"
    ADD CONSTRAINT "frequencias_2026_01_escola_id_matricula_id_data_key" UNIQUE ("escola_id", "matricula_id", "data");



ALTER TABLE ONLY "public"."frequencias_2026_01"
    ADD CONSTRAINT "frequencias_2026_01_pkey" PRIMARY KEY ("id", "data");



ALTER TABLE ONLY "public"."frequencias_2026_02"
    ADD CONSTRAINT "frequencias_2026_02_escola_id_matricula_id_data_key" UNIQUE ("escola_id", "matricula_id", "data");



ALTER TABLE ONLY "public"."frequencias_2026_02"
    ADD CONSTRAINT "frequencias_2026_02_pkey" PRIMARY KEY ("id", "data");



ALTER TABLE ONLY "public"."frequencias_default"
    ADD CONSTRAINT "frequencias_default_escola_id_matricula_id_data_key" UNIQUE ("escola_id", "matricula_id", "data");



ALTER TABLE ONLY "public"."frequencias_default"
    ADD CONSTRAINT "frequencias_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."historico_anos"
    ADD CONSTRAINT "historico_anos_escola_id_aluno_id_ano_letivo_key" UNIQUE ("escola_id", "aluno_id", "ano_letivo");



ALTER TABLE ONLY "public"."historico_anos"
    ADD CONSTRAINT "historico_anos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."historico_disciplinas"
    ADD CONSTRAINT "historico_disciplinas_historico_ano_id_disciplina_id_key" UNIQUE ("historico_ano_id", "disciplina_id");



ALTER TABLE ONLY "public"."historico_disciplinas"
    ADD CONSTRAINT "historico_disciplinas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."import_errors"
    ADD CONSTRAINT "import_errors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."import_migrations"
    ADD CONSTRAINT "import_migrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lancamentos_2025_09"
    ADD CONSTRAINT "lancamentos_2025_09_pkey" PRIMARY KEY ("id", "criado_em");



ALTER TABLE ONLY "public"."lancamentos_2025_10"
    ADD CONSTRAINT "lancamentos_2025_10_pkey" PRIMARY KEY ("id", "criado_em");



ALTER TABLE ONLY "public"."lancamentos_2025_11"
    ADD CONSTRAINT "lancamentos_2025_11_pkey" PRIMARY KEY ("id", "criado_em");



ALTER TABLE ONLY "public"."lancamentos_2025_12"
    ADD CONSTRAINT "lancamentos_2025_12_pkey" PRIMARY KEY ("id", "criado_em");



ALTER TABLE ONLY "public"."lancamentos_2026_01"
    ADD CONSTRAINT "lancamentos_2026_01_pkey" PRIMARY KEY ("id", "criado_em");



ALTER TABLE ONLY "public"."lancamentos_2026_02"
    ADD CONSTRAINT "lancamentos_2026_02_pkey" PRIMARY KEY ("id", "criado_em");



ALTER TABLE ONLY "public"."lancamentos_default"
    ADD CONSTRAINT "lancamentos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."matricula_counters"
    ADD CONSTRAINT "matricula_counters_pkey" PRIMARY KEY ("escola_id");



ALTER TABLE ONLY "public"."matriculas"
    ADD CONSTRAINT "matricula_unica_ano" UNIQUE ("escola_id", "aluno_id", "ano_letivo");



ALTER TABLE ONLY "public"."matriculas"
    ADD CONSTRAINT "matriculas_aluno_id_turma_id_key" UNIQUE ("aluno_id", "turma_id");



ALTER TABLE ONLY "public"."matriculas_cursos"
    ADD CONSTRAINT "matriculas_cursos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."matriculas"
    ADD CONSTRAINT "matriculas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mensalidades"
    ADD CONSTRAINT "mensalidades_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notas_avaliacoes"
    ADD CONSTRAINT "notas_avaliacoes_avaliacao_id_matricula_id_aluno_id_key" UNIQUE ("avaliacao_id", "matricula_id", "aluno_id");



ALTER TABLE ONLY "public"."notas_avaliacoes"
    ADD CONSTRAINT "notas_avaliacoes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notas"
    ADD CONSTRAINT "notas_escola_matricula_avaliacao_uk" UNIQUE ("escola_id", "matricula_id", "avaliacao_id");



ALTER TABLE ONLY "public"."notas"
    ADD CONSTRAINT "notas_pkey1" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notices"
    ADD CONSTRAINT "notices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."onboarding_drafts"
    ADD CONSTRAINT "onboarding_drafts_escola_user_unique" UNIQUE ("escola_id", "user_id");



ALTER TABLE ONLY "public"."onboarding_drafts"
    ADD CONSTRAINT "onboarding_drafts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."outbox_events"
    ADD CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."outbox_notificacoes"
    ADD CONSTRAINT "outbox_notificacoes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pagamentos"
    ADD CONSTRAINT "pagamentos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."periodos_letivos"
    ADD CONSTRAINT "periodos_letivos_escola_ano_tipo_numero_uk" UNIQUE ("escola_id", "ano_letivo_id", "tipo", "numero");



ALTER TABLE ONLY "public"."periodos_letivos"
    ADD CONSTRAINT "periodos_letivos_pkey1" PRIMARY KEY ("id");



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



ALTER TABLE ONLY "public"."secoes"
    ADD CONSTRAINT "secoes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sistemas_notas"
    ADD CONSTRAINT "sistemas_notas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staging_alunos"
    ADD CONSTRAINT "staging_alunos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."syllabi"
    ADD CONSTRAINT "syllabi_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tabelas_mensalidade"
    ADD CONSTRAINT "tabelas_mensalidade_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."turma_disciplinas"
    ADD CONSTRAINT "turma_disciplinas_pkey1" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."turma_disciplinas_professores"
    ADD CONSTRAINT "turma_disciplinas_professores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."turmas_auditoria"
    ADD CONSTRAINT "turmas_auditoria_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."classes"
    ADD CONSTRAINT "unique_estrutura_classe" UNIQUE ("escola_id", "curso_id", "nome");



ALTER TABLE ONLY "public"."cursos_globais_cache"
    ADD CONSTRAINT "unique_nome_tipo" UNIQUE ("nome", "tipo");



ALTER TABLE ONLY "public"."turmas"
    ADD CONSTRAINT "unique_turma_angola" UNIQUE ("escola_id", "curso_id", "classe_id", "ano_letivo", "nome", "turno");



ALTER TABLE ONLY "public"."turma_disciplinas_professores"
    ADD CONSTRAINT "uq_tdp_unique" UNIQUE ("turma_id", "disciplina_id");



CREATE INDEX "idx_mv_turmas_para_matricula_escola_nome" ON "internal"."mv_turmas_para_matricula" USING "btree" ("escola_id", "turma_nome", "id");



CREATE UNIQUE INDEX "ux_mv_admin_dashboard_counts" ON "internal"."mv_admin_dashboard_counts" USING "btree" ("escola_id");



CREATE UNIQUE INDEX "ux_mv_admin_matriculas_por_mes" ON "internal"."mv_admin_matriculas_por_mes" USING "btree" ("escola_id", "mes");



CREATE UNIQUE INDEX "ux_mv_admin_pending_turmas_count" ON "internal"."mv_admin_pending_turmas_count" USING "btree" ("escola_id");



CREATE UNIQUE INDEX "ux_mv_admissoes_counts_por_status" ON "internal"."mv_admissoes_counts_por_status" USING "btree" ("escola_id");



CREATE UNIQUE INDEX "ux_mv_cursos_reais" ON "internal"."mv_cursos_reais" USING "btree" ("escola_id", "id");



CREATE UNIQUE INDEX "ux_mv_escola_estrutura_counts" ON "internal"."mv_escola_estrutura_counts" USING "btree" ("escola_id");



CREATE UNIQUE INDEX "ux_mv_escola_setup_status" ON "internal"."mv_escola_setup_status" USING "btree" ("escola_id");



CREATE UNIQUE INDEX "ux_mv_financeiro_cobrancas_diario" ON "internal"."mv_financeiro_cobrancas_diario" USING "btree" ("escola_id", "dia");



CREATE UNIQUE INDEX "ux_mv_financeiro_kpis_geral" ON "internal"."mv_financeiro_kpis_geral" USING "btree" ("escola_id");



CREATE UNIQUE INDEX "ux_mv_financeiro_kpis_mes" ON "internal"."mv_financeiro_kpis_mes" USING "btree" ("escola_id", "mes_ref");



CREATE UNIQUE INDEX "ux_mv_financeiro_radar_resumo" ON "internal"."mv_financeiro_radar_resumo" USING "btree" ("escola_id", "aluno_id");



CREATE UNIQUE INDEX "ux_mv_financeiro_sidebar_badges" ON "internal"."mv_financeiro_sidebar_badges" USING "btree" ("escola_id");



CREATE UNIQUE INDEX "ux_mv_migracao_cursos_lookup" ON "internal"."mv_migracao_cursos_lookup" USING "btree" ("escola_id", "id");



CREATE UNIQUE INDEX "ux_mv_migracao_turmas_lookup" ON "internal"."mv_migracao_turmas_lookup" USING "btree" ("escola_id", "turma_code", "ano_letivo");



CREATE UNIQUE INDEX "ux_mv_ocupacao_turmas" ON "internal"."mv_ocupacao_turmas" USING "btree" ("escola_id", "id");



CREATE UNIQUE INDEX "ux_mv_pagamentos_status" ON "internal"."mv_pagamentos_status" USING "btree" ("escola_id", "status");



CREATE UNIQUE INDEX "ux_mv_radar_inadimplencia" ON "internal"."mv_radar_inadimplencia" USING "btree" ("escola_id", "mensalidade_id");



CREATE UNIQUE INDEX "ux_mv_secretaria_dashboard_counts" ON "internal"."mv_secretaria_dashboard_counts" USING "btree" ("escola_id");



CREATE UNIQUE INDEX "ux_mv_secretaria_dashboard_kpis" ON "internal"."mv_secretaria_dashboard_kpis" USING "btree" ("escola_id");



CREATE UNIQUE INDEX "ux_mv_secretaria_matriculas_status" ON "internal"."mv_secretaria_matriculas_status" USING "btree" ("escola_id", "status");



CREATE UNIQUE INDEX "ux_mv_secretaria_matriculas_turma_status" ON "internal"."mv_secretaria_matriculas_turma_status" USING "btree" ("escola_id", "turma_id", "status");



CREATE UNIQUE INDEX "ux_mv_staging_alunos_summary" ON "internal"."mv_staging_alunos_summary" USING "btree" ("escola_id", "import_id", "turma_codigo", "ano_letivo");



CREATE UNIQUE INDEX "ux_mv_total_em_aberto_por_mes" ON "internal"."mv_total_em_aberto_por_mes" USING "btree" ("escola_id", "ano", "mes");



CREATE UNIQUE INDEX "ux_mv_turmas_para_matricula" ON "internal"."mv_turmas_para_matricula" USING "btree" ("escola_id", "id");



CREATE UNIQUE INDEX "alunos_bi_key" ON "public"."alunos" USING "btree" ("escola_id", "bi_numero") WHERE ("bi_numero" IS NOT NULL);



CREATE INDEX "alunos_email_idx" ON "public"."alunos" USING "btree" ("email");



CREATE INDEX "alunos_escola_email_idx" ON "public"."alunos" USING "btree" ("escola_id", "email");



CREATE INDEX "alunos_escola_id_idx" ON "public"."alunos" USING "btree" ("escola_id");



CREATE INDEX "alunos_nome_data_idx" ON "public"."alunos" USING "btree" ("nome", "data_nascimento");



CREATE INDEX "alunos_tel_idx" ON "public"."alunos" USING "btree" ("telefone");



CREATE INDEX "audit_logs_action_idx" ON "public"."audit_logs" USING "btree" ("action");



CREATE INDEX "audit_logs_created_at_desc_idx" ON "public"."audit_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "audit_logs_details_gin_idx" ON "public"."audit_logs" USING "gin" ("details");



CREATE INDEX "audit_logs_escola_id_idx" ON "public"."audit_logs" USING "btree" ("escola_id");



CREATE INDEX "audit_logs_portal_idx" ON "public"."audit_logs" USING "btree" ("portal");



CREATE INDEX "brin_freq_data" ON "public"."frequencias_default" USING "brin" ("data") WITH ("pages_per_range"='16');



CREATE INDEX "classes_escola_ordem_idx" ON "public"."classes" USING "btree" ("escola_id", "ordem");



CREATE INDEX "curso_curriculos_lookup_idx" ON "public"."curso_curriculos" USING "btree" ("escola_id", "curso_id", "ano_letivo_id", "status", "version" DESC);



CREATE UNIQUE INDEX "curso_curriculos_one_published_per_year_ux" ON "public"."curso_curriculos" USING "btree" ("escola_id", "curso_id", "ano_letivo_id") WHERE ("status" = 'published'::"public"."curriculo_status");



CREATE INDEX "documentos_emitidos_public_id_hash_idx" ON "public"."documentos_emitidos" USING "btree" ("public_id", "hash_validacao");



CREATE UNIQUE INDEX "financeiro_itens_escola_nome_uniq" ON "public"."financeiro_itens" USING "btree" ("escola_id", "lower"("nome"));



CREATE INDEX "idx_frequencias_aula_id_fk" ON ONLY "public"."frequencias" USING "btree" ("aula_id");



CREATE INDEX "frequencias_2025_09_aula_id_idx" ON "public"."frequencias_2025_09" USING "btree" ("aula_id");



CREATE INDEX "idx_frequencias_escola_id_fk" ON ONLY "public"."frequencias" USING "btree" ("escola_id");



CREATE INDEX "frequencias_2025_09_escola_id_idx" ON "public"."frequencias_2025_09" USING "btree" ("escola_id");



CREATE INDEX "idx_frequencias_escola_matricula_data" ON ONLY "public"."frequencias" USING "btree" ("escola_id", "matricula_id", "data");



CREATE INDEX "frequencias_2025_09_escola_id_matricula_id_data_idx" ON "public"."frequencias_2025_09" USING "btree" ("escola_id", "matricula_id", "data");



CREATE INDEX "idx_frequencias_lookup" ON ONLY "public"."frequencias" USING "btree" ("escola_id", "matricula_id", "data" DESC);



CREATE INDEX "frequencias_2025_09_escola_id_matricula_id_data_idx1" ON "public"."frequencias_2025_09" USING "btree" ("escola_id", "matricula_id", "data" DESC);



CREATE INDEX "idx_frequencias_escola_periodo" ON ONLY "public"."frequencias" USING "btree" ("escola_id", "periodo_letivo_id", "matricula_id");



CREATE INDEX "frequencias_2025_09_escola_id_periodo_letivo_id_matricula_i_idx" ON "public"."frequencias_2025_09" USING "btree" ("escola_id", "periodo_letivo_id", "matricula_id");



CREATE INDEX "frequencias_2025_10_aula_id_idx" ON "public"."frequencias_2025_10" USING "btree" ("aula_id");



CREATE INDEX "frequencias_2025_10_escola_id_idx" ON "public"."frequencias_2025_10" USING "btree" ("escola_id");



CREATE INDEX "frequencias_2025_10_escola_id_matricula_id_data_idx" ON "public"."frequencias_2025_10" USING "btree" ("escola_id", "matricula_id", "data");



CREATE INDEX "frequencias_2025_10_escola_id_matricula_id_data_idx1" ON "public"."frequencias_2025_10" USING "btree" ("escola_id", "matricula_id", "data" DESC);



CREATE INDEX "frequencias_2025_10_escola_id_periodo_letivo_id_matricula_i_idx" ON "public"."frequencias_2025_10" USING "btree" ("escola_id", "periodo_letivo_id", "matricula_id");



CREATE INDEX "frequencias_2025_11_aula_id_idx" ON "public"."frequencias_2025_11" USING "btree" ("aula_id");



CREATE INDEX "frequencias_2025_11_escola_id_idx" ON "public"."frequencias_2025_11" USING "btree" ("escola_id");



CREATE INDEX "frequencias_2025_11_escola_id_matricula_id_data_idx" ON "public"."frequencias_2025_11" USING "btree" ("escola_id", "matricula_id", "data");



CREATE INDEX "frequencias_2025_11_escola_id_matricula_id_data_idx1" ON "public"."frequencias_2025_11" USING "btree" ("escola_id", "matricula_id", "data" DESC);



CREATE INDEX "frequencias_2025_11_escola_id_periodo_letivo_id_matricula_i_idx" ON "public"."frequencias_2025_11" USING "btree" ("escola_id", "periodo_letivo_id", "matricula_id");



CREATE INDEX "frequencias_2025_12_aula_id_idx" ON "public"."frequencias_2025_12" USING "btree" ("aula_id");



CREATE INDEX "frequencias_2025_12_escola_id_idx" ON "public"."frequencias_2025_12" USING "btree" ("escola_id");



CREATE INDEX "frequencias_2025_12_escola_id_matricula_id_data_idx" ON "public"."frequencias_2025_12" USING "btree" ("escola_id", "matricula_id", "data");



CREATE INDEX "frequencias_2025_12_escola_id_matricula_id_data_idx1" ON "public"."frequencias_2025_12" USING "btree" ("escola_id", "matricula_id", "data" DESC);



CREATE INDEX "frequencias_2025_12_escola_id_periodo_letivo_id_matricula_i_idx" ON "public"."frequencias_2025_12" USING "btree" ("escola_id", "periodo_letivo_id", "matricula_id");



CREATE INDEX "frequencias_2026_01_aula_id_idx" ON "public"."frequencias_2026_01" USING "btree" ("aula_id");



CREATE INDEX "frequencias_2026_01_escola_id_idx" ON "public"."frequencias_2026_01" USING "btree" ("escola_id");



CREATE INDEX "frequencias_2026_01_escola_id_matricula_id_data_idx" ON "public"."frequencias_2026_01" USING "btree" ("escola_id", "matricula_id", "data");



CREATE INDEX "frequencias_2026_01_escola_id_matricula_id_data_idx1" ON "public"."frequencias_2026_01" USING "btree" ("escola_id", "matricula_id", "data" DESC);



CREATE INDEX "frequencias_2026_01_escola_id_periodo_letivo_id_matricula_i_idx" ON "public"."frequencias_2026_01" USING "btree" ("escola_id", "periodo_letivo_id", "matricula_id");



CREATE INDEX "frequencias_2026_02_aula_id_idx" ON "public"."frequencias_2026_02" USING "btree" ("aula_id");



CREATE INDEX "frequencias_2026_02_escola_id_idx" ON "public"."frequencias_2026_02" USING "btree" ("escola_id");



CREATE INDEX "frequencias_2026_02_escola_id_matricula_id_data_idx" ON "public"."frequencias_2026_02" USING "btree" ("escola_id", "matricula_id", "data");



CREATE INDEX "frequencias_2026_02_escola_id_matricula_id_data_idx1" ON "public"."frequencias_2026_02" USING "btree" ("escola_id", "matricula_id", "data" DESC);



CREATE INDEX "frequencias_2026_02_escola_id_periodo_letivo_id_matricula_i_idx" ON "public"."frequencias_2026_02" USING "btree" ("escola_id", "periodo_letivo_id", "matricula_id");



CREATE INDEX "frequencias_default_aula_id_idx" ON "public"."frequencias_default" USING "btree" ("aula_id");



CREATE INDEX "frequencias_default_escola_id_matricula_id_data_idx" ON "public"."frequencias_default" USING "btree" ("escola_id", "matricula_id", "data");



CREATE INDEX "frequencias_default_escola_id_matricula_id_data_idx1" ON "public"."frequencias_default" USING "btree" ("escola_id", "matricula_id", "data" DESC);



CREATE INDEX "frequencias_default_escola_id_periodo_letivo_id_matricula_i_idx" ON "public"."frequencias_default" USING "btree" ("escola_id", "periodo_letivo_id", "matricula_id");



CREATE INDEX "idx_alunos_deleted_at" ON "public"."alunos" USING "btree" ("deleted_at");



CREATE INDEX "idx_alunos_deleted_by_fk" ON "public"."alunos" USING "btree" ("deleted_by");



CREATE INDEX "idx_alunos_escola_acesso_liberado" ON "public"."alunos" USING "btree" ("escola_id", "acesso_liberado") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_alunos_escola_nome_busca" ON "public"."alunos" USING "btree" ("escola_id", "nome_busca", "id");



CREATE UNIQUE INDEX "idx_alunos_escola_processo" ON "public"."alunos" USING "btree" ("escola_id", "numero_processo");



CREATE INDEX "idx_alunos_escola_processo_hash" ON "public"."alunos" USING "btree" ("escola_id", "numero_processo");



CREATE INDEX "idx_alunos_excluidos_aluno_deleted_at" ON "public"."alunos_excluidos" USING "btree" ("aluno_deleted_at");



CREATE INDEX "idx_alunos_excluidos_escola" ON "public"."alunos_excluidos" USING "btree" ("escola_id");



CREATE INDEX "idx_alunos_excluidos_excluido_por_fk" ON "public"."alunos_excluidos" USING "btree" ("excluido_por");



CREATE INDEX "idx_alunos_numero_processo_legado" ON "public"."alunos" USING "btree" ("numero_processo_legado");



CREATE INDEX "idx_alunos_profile_id" ON "public"."alunos" USING "btree" ("profile_id");



CREATE INDEX "idx_alunos_search_gin" ON "public"."alunos" USING "gin" ("to_tsvector"('"simple"'::"regconfig", "search_text"));



CREATE INDEX "idx_alunos_usuario_auth_id_fk" ON "public"."alunos" USING "btree" ("usuario_auth_id");



CREATE INDEX "idx_anos_letivos_escola_ano" ON "public"."anos_letivos" USING "btree" ("escola_id", "ano");



CREATE INDEX "idx_anos_letivos_escola_id_fk" ON "public"."anos_letivos" USING "btree" ("escola_id");



CREATE INDEX "idx_atribuicoes_prof_escola_id_fk" ON "public"."atribuicoes_prof" USING "btree" ("escola_id");



CREATE INDEX "idx_atribuicoes_prof_prof" ON "public"."atribuicoes_prof" USING "btree" ("professor_user_id");



CREATE INDEX "idx_atribuicoes_prof_secao_id_fk" ON "public"."atribuicoes_prof" USING "btree" ("secao_id");



CREATE INDEX "idx_audit_logs_user_id_fk" ON "public"."audit_logs" USING "btree" ("user_id");



CREATE INDEX "idx_aulas_escola_id_fk" ON "public"."aulas" USING "btree" ("escola_id");



CREATE INDEX "idx_avaliacoes_escola_id_fk" ON "public"."avaliacoes" USING "btree" ("escola_id");



CREATE INDEX "idx_avaliacoes_lookup" ON "public"."avaliacoes" USING "btree" ("escola_id", "turma_disciplina_id", "periodo_letivo_id");



CREATE INDEX "idx_avaliacoes_periodo_letivo_id_fk" ON "public"."avaliacoes" USING "btree" ("periodo_letivo_id");



CREATE INDEX "idx_cand_status_log_cand_id" ON "public"."candidaturas_status_log" USING "btree" ("candidatura_id");



CREATE INDEX "idx_cand_status_log_escola_id" ON "public"."candidaturas_status_log" USING "btree" ("escola_id");



CREATE INDEX "idx_candidaturas_aluno_id_fk" ON "public"."candidaturas" USING "btree" ("aluno_id");



CREATE INDEX "idx_candidaturas_classe_id_fk" ON "public"."candidaturas" USING "btree" ("classe_id");



CREATE INDEX "idx_candidaturas_curso_id_fk" ON "public"."candidaturas" USING "btree" ("curso_id");



CREATE INDEX "idx_candidaturas_escola_id_fk" ON "public"."candidaturas" USING "btree" ("escola_id");



CREATE INDEX "idx_candidaturas_escola_status_created" ON "public"."candidaturas" USING "btree" ("escola_id", "status", "created_at" DESC, "id");



CREATE INDEX "idx_candidaturas_status" ON "public"."candidaturas" USING "btree" ("escola_id", "status");



CREATE INDEX "idx_candidaturas_turma_pref" ON "public"."candidaturas" USING "btree" ("turma_preferencial_id");



CREATE INDEX "idx_classes_curso" ON "public"."classes" USING "btree" ("curso_id");



CREATE INDEX "idx_classes_escola_id" ON "public"."classes" USING "btree" ("escola_id");



CREATE INDEX "idx_classes_numero" ON "public"."classes" USING "btree" ("numero");



CREATE INDEX "idx_cobrancas_aluno" ON "public"."financeiro_cobrancas" USING "btree" ("aluno_id", "enviado_em" DESC);



CREATE INDEX "idx_cobrancas_escola_enviado" ON "public"."financeiro_cobrancas" USING "btree" ("escola_id", "enviado_em" DESC);



CREATE INDEX "idx_cobrancas_status" ON "public"."financeiro_cobrancas" USING "btree" ("status");



CREATE INDEX "idx_configuracoes_curriculo_curso_id_fk" ON "public"."configuracoes_curriculo" USING "btree" ("curso_id");



CREATE INDEX "idx_configuracoes_curriculo_escola_id_fk" ON "public"."configuracoes_curriculo" USING "btree" ("escola_id");



CREATE INDEX "idx_configuracoes_escola_escola_id_fk" ON "public"."configuracoes_escola" USING "btree" ("escola_id");



CREATE INDEX "idx_configuracoes_escola_periodo_tipo" ON "public"."configuracoes_escola" USING "btree" ("periodo_tipo");



CREATE INDEX "idx_curso_curriculos_ano_letivo_id_fk" ON "public"."curso_curriculos" USING "btree" ("ano_letivo_id");



CREATE INDEX "idx_curso_curriculos_created_by_fk" ON "public"."curso_curriculos" USING "btree" ("created_by");



CREATE INDEX "idx_curso_curriculos_curso_id_fk" ON "public"."curso_curriculos" USING "btree" ("curso_id");



CREATE INDEX "idx_curso_curriculos_escola_id_fk" ON "public"."curso_curriculos" USING "btree" ("escola_id");



CREATE INDEX "idx_curso_matriz_classe_id_fk" ON "public"."curso_matriz" USING "btree" ("classe_id");



CREATE INDEX "idx_curso_matriz_curriculo_lookup" ON "public"."curso_matriz" USING "btree" ("escola_id", "curso_curriculo_id", "classe_id");



CREATE INDEX "idx_curso_matriz_curso_curriculo_id_fk" ON "public"."curso_matriz" USING "btree" ("curso_curriculo_id");



CREATE INDEX "idx_curso_matriz_curso_id_fk" ON "public"."curso_matriz" USING "btree" ("curso_id");



CREATE INDEX "idx_curso_matriz_disciplina" ON "public"."curso_matriz" USING "btree" ("escola_id", "disciplina_id");



CREATE INDEX "idx_curso_matriz_disciplina_id_fk" ON "public"."curso_matriz" USING "btree" ("disciplina_id");



CREATE INDEX "idx_curso_matriz_escola_id_fk" ON "public"."curso_matriz" USING "btree" ("escola_id");



CREATE INDEX "idx_curso_matriz_lookup" ON "public"."curso_matriz" USING "btree" ("escola_id", "curso_id", "classe_id");



CREATE INDEX "idx_cursos_curso_global_id_fk" ON "public"."cursos" USING "btree" ("curso_global_id");



CREATE INDEX "idx_cursos_escola" ON "public"."cursos" USING "btree" ("escola_id");



CREATE INDEX "idx_cursos_escola_codigo" ON "public"."cursos" USING "btree" ("escola_id", "codigo");



CREATE INDEX "idx_cursos_escola_course_code" ON "public"."cursos" USING "btree" ("escola_id", "course_code");



CREATE INDEX "idx_cursos_escola_global" ON "public"."cursos" USING "btree" ("escola_id", "curso_global_id");



CREATE UNIQUE INDEX "idx_cursos_escola_nome" ON "public"."cursos" USING "btree" ("escola_id", "nome");



CREATE INDEX "idx_cursos_globais_cache_created_by_escola_fk" ON "public"."cursos_globais_cache" USING "btree" ("created_by_escola");



CREATE INDEX "idx_cursos_globais_hash" ON "public"."cursos_globais_cache" USING "btree" ("hash");



CREATE INDEX "idx_cursos_import_id" ON "public"."cursos" USING "btree" ("import_id");



CREATE INDEX "idx_disciplinas_catalogo_escola" ON "public"."disciplinas_catalogo" USING "btree" ("escola_id");



CREATE INDEX "idx_docs_aluno_created" ON "public"."documentos_emitidos" USING "btree" ("aluno_id", "created_at" DESC);



CREATE INDEX "idx_docs_escola_created" ON "public"."documentos_emitidos" USING "btree" ("escola_id", "created_at" DESC);



CREATE INDEX "idx_docs_public_id" ON "public"."documentos_emitidos" USING "btree" ("public_id");



CREATE INDEX "idx_documentos_emitidos_aluno_id_fk" ON "public"."documentos_emitidos" USING "btree" ("aluno_id");



CREATE INDEX "idx_documentos_emitidos_escola_id_fk" ON "public"."documentos_emitidos" USING "btree" ("escola_id");



CREATE INDEX "idx_documentos_emitidos_mensalidade_id_fk" ON "public"."documentos_emitidos" USING "btree" ("mensalidade_id");



CREATE INDEX "idx_escola_administradores_escola_id" ON "public"."escola_administradores" USING "btree" ("escola_id");



CREATE INDEX "idx_escola_administradores_user_id" ON "public"."escola_administradores" USING "btree" ("user_id");



CREATE INDEX "idx_escola_auditoria_escola_id_fk" ON "public"."escola_auditoria" USING "btree" ("escola_id");



CREATE INDEX "idx_escola_configuracoes_escola_id_fk" ON "public"."escola_configuracoes" USING "btree" ("escola_id");



CREATE INDEX "idx_escola_users_escola_id_fk" ON "public"."escola_users" USING "btree" ("escola_id");



CREATE INDEX "idx_escola_users_user_id_fk" ON "public"."escola_users" USING "btree" ("user_id");



CREATE INDEX "idx_estornos_escola_created" ON "public"."financeiro_estornos" USING "btree" ("escola_id", "created_at" DESC);



CREATE INDEX "idx_estornos_mensalidade" ON "public"."financeiro_estornos" USING "btree" ("mensalidade_id");



CREATE INDEX "idx_events_escola" ON "public"."events" USING "btree" ("escola_id");



CREATE INDEX "idx_fin_lancamentos_aluno" ON "public"."financeiro_lancamentos" USING "btree" ("aluno_id");



CREATE INDEX "idx_fin_lancamentos_escola_ano_mes" ON "public"."financeiro_lancamentos" USING "btree" ("escola_id", "ano_referencia", "mes_referencia");



CREATE INDEX "idx_fin_lancamentos_escola_status" ON "public"."financeiro_lancamentos" USING "btree" ("escola_id", "status");



CREATE INDEX "idx_fin_tabelas_escola_ano_classe_curso" ON "public"."financeiro_tabelas" USING "btree" ("escola_id", "ano_letivo", "classe_id", "curso_id");



CREATE INDEX "idx_finance_payment_intents_aluno_id_fk" ON "public"."finance_payment_intents" USING "btree" ("aluno_id");



CREATE INDEX "idx_finance_payment_intents_confirmed_by_fk" ON "public"."finance_payment_intents" USING "btree" ("confirmed_by");



CREATE INDEX "idx_finance_payment_intents_escola_id_fk" ON "public"."finance_payment_intents" USING "btree" ("escola_id");



CREATE INDEX "idx_finance_payment_intents_escola_status" ON "public"."finance_payment_intents" USING "btree" ("escola_id", "status", "created_at" DESC);



CREATE INDEX "idx_finance_payment_intents_mensalidade_id_fk" ON "public"."finance_payment_intents" USING "btree" ("mensalidade_id");



CREATE INDEX "idx_financeiro_cobrancas_aluno_id_fk" ON "public"."financeiro_cobrancas" USING "btree" ("aluno_id");



CREATE INDEX "idx_financeiro_cobrancas_escola_id_fk" ON "public"."financeiro_cobrancas" USING "btree" ("escola_id");



CREATE INDEX "idx_financeiro_cobrancas_mensalidade_id_fk" ON "public"."financeiro_cobrancas" USING "btree" ("mensalidade_id");



CREATE INDEX "idx_financeiro_contratos_aluno_id_fk" ON "public"."financeiro_contratos" USING "btree" ("aluno_id");



CREATE INDEX "idx_financeiro_contratos_escola_id_fk" ON "public"."financeiro_contratos" USING "btree" ("escola_id");



CREATE INDEX "idx_financeiro_contratos_matricula_id_fk" ON "public"."financeiro_contratos" USING "btree" ("matricula_id");



CREATE INDEX "idx_financeiro_estornos_escola_id_fk" ON "public"."financeiro_estornos" USING "btree" ("escola_id");



CREATE INDEX "idx_financeiro_itens_escola_id_fk" ON "public"."financeiro_itens" USING "btree" ("escola_id");



CREATE INDEX "idx_financeiro_lancamentos_escola_id" ON "public"."financeiro_lancamentos" USING "btree" ("escola_id");



CREATE INDEX "idx_financeiro_lancamentos_matricula_id_fk" ON "public"."financeiro_lancamentos" USING "btree" ("matricula_id");



CREATE INDEX "idx_financeiro_tabelas_busca" ON "public"."financeiro_tabelas" USING "btree" ("escola_id", "ano_letivo");



CREATE INDEX "idx_financeiro_tabelas_classe_id_fk" ON "public"."financeiro_tabelas" USING "btree" ("classe_id");



CREATE INDEX "idx_financeiro_tabelas_curso_id_fk" ON "public"."financeiro_tabelas" USING "btree" ("curso_id");



CREATE INDEX "idx_financeiro_tabelas_escola_id_fk" ON "public"."financeiro_tabelas" USING "btree" ("escola_id");



CREATE INDEX "idx_financeiro_titulos_aluno_id_fk" ON "public"."financeiro_titulos" USING "btree" ("aluno_id");



CREATE INDEX "idx_financeiro_titulos_contrato_id_fk" ON "public"."financeiro_titulos" USING "btree" ("contrato_id");



CREATE INDEX "idx_financeiro_titulos_escola_id" ON "public"."financeiro_titulos" USING "btree" ("escola_id");



CREATE INDEX "idx_frequencia_status_periodo_aluno_id_fk" ON "public"."frequencia_status_periodo" USING "btree" ("aluno_id");



CREATE INDEX "idx_frequencia_status_periodo_escola_id_fk" ON "public"."frequencia_status_periodo" USING "btree" ("escola_id");



CREATE INDEX "idx_frequencia_status_periodo_lookup" ON "public"."frequencia_status_periodo" USING "btree" ("escola_id", "turma_id", "periodo_letivo_id");



CREATE INDEX "idx_frequencia_status_periodo_matricula_id_fk" ON "public"."frequencia_status_periodo" USING "btree" ("matricula_id");



CREATE INDEX "idx_frequencia_status_periodo_periodo_letivo_id_fk" ON "public"."frequencia_status_periodo" USING "btree" ("periodo_letivo_id");



CREATE INDEX "idx_frequencia_status_periodo_turma_id_fk" ON "public"."frequencia_status_periodo" USING "btree" ("turma_id");



CREATE INDEX "idx_frequencias_data" ON "public"."frequencias_default" USING "btree" ("data");



CREATE INDEX "idx_frequencias_default_escola_id_fk" ON "public"."frequencias_default" USING "btree" ("escola_id");



CREATE INDEX "idx_frequencias_default_routine_id_fk" ON "public"."frequencias_default" USING "btree" ("routine_id");



CREATE INDEX "idx_frequencias_matricula" ON "public"."frequencias_default" USING "btree" ("matricula_id");



CREATE INDEX "idx_historico_anos_aluno_id_fk" ON "public"."historico_anos" USING "btree" ("aluno_id");



CREATE INDEX "idx_historico_anos_escola_id_fk" ON "public"."historico_anos" USING "btree" ("escola_id");



CREATE INDEX "idx_historico_anos_turma_id_fk" ON "public"."historico_anos" USING "btree" ("turma_id");



CREATE INDEX "idx_historico_disciplinas_historico_ano_id_fk" ON "public"."historico_disciplinas" USING "btree" ("historico_ano_id");



CREATE INDEX "idx_import_migrations_escola_id_fk" ON "public"."import_migrations" USING "btree" ("escola_id");



CREATE INDEX "idx_import_migrations_escola_status_created" ON "public"."import_migrations" USING "btree" ("escola_id", "status", "created_at" DESC, "id");



CREATE INDEX "idx_lancamentos_2025_09_tenant_id" ON "public"."lancamentos_2025_09" USING "btree" ("tenant_id");



CREATE INDEX "idx_lancamentos_avaliacao" ON "public"."lancamentos_default" USING "btree" ("avaliacao_id");



CREATE INDEX "idx_lancamentos_escola_id_fk" ON ONLY "public"."lancamentos" USING "btree" ("escola_id");



CREATE INDEX "idx_lancamentos_default_escola_id_fk" ON "public"."lancamentos_default" USING "btree" ("escola_id");



CREATE INDEX "idx_matricula_counters_escola_id_fk" ON "public"."matricula_counters" USING "btree" ("escola_id");



CREATE INDEX "idx_matriculas_aluno_ano_escola" ON "public"."matriculas" USING "btree" ("aluno_id", "ano_letivo", "escola_id");



CREATE INDEX "idx_matriculas_cursos_escola_id_fk" ON "public"."matriculas_cursos" USING "btree" ("escola_id");



CREATE INDEX "idx_matriculas_cursos_matricula" ON "public"."matriculas_cursos" USING "btree" ("matricula_id");



CREATE INDEX "idx_matriculas_escola_ano_created_at" ON "public"."matriculas" USING "btree" ("escola_id", "ano_letivo", "created_at" DESC);



CREATE INDEX "idx_matriculas_escola_ativa_com_numero" ON "public"."matriculas" USING "btree" ("escola_id", "ano_letivo", "created_at" DESC) WHERE (("status" = ANY (ARRAY['ativa'::"text", 'ativo'::"text"])) AND ("numero_matricula" IS NOT NULL) AND ("btrim"("numero_matricula") <> ''::"text"));



CREATE INDEX "idx_matriculas_escola_id" ON "public"."matriculas" USING "btree" ("escola_id");



CREATE INDEX "idx_matriculas_escola_session_ano_created_at" ON "public"."matriculas" USING "btree" ("escola_id", "session_id", "ano_letivo", "created_at" DESC);



CREATE INDEX "idx_matriculas_escola_status" ON "public"."matriculas" USING "btree" ("escola_id", "status");



CREATE INDEX "idx_matriculas_escola_status_turma" ON "public"."matriculas" USING "btree" ("escola_id", "status", "turma_id");



CREATE INDEX "idx_matriculas_import_id" ON "public"."matriculas" USING "btree" ("import_id");



CREATE INDEX "idx_matriculas_secao" ON "public"."matriculas" USING "btree" ("secao_id");



CREATE INDEX "idx_matriculas_session" ON "public"."matriculas" USING "btree" ("session_id");



CREATE INDEX "idx_matriculas_turma_id_fk" ON "public"."matriculas" USING "btree" ("turma_id");



CREATE INDEX "idx_mensalidades_aluno" ON "public"."mensalidades" USING "btree" ("aluno_id");



CREATE INDEX "idx_mensalidades_aluno_vencimento" ON "public"."mensalidades" USING "btree" ("aluno_id", "data_vencimento");



CREATE INDEX "idx_mensalidades_escola_id" ON "public"."mensalidades" USING "btree" ("escola_id");



CREATE INDEX "idx_mensalidades_matricula_id_fk" ON "public"."mensalidades" USING "btree" ("matricula_id");



CREATE INDEX "idx_mensalidades_status" ON "public"."mensalidades" USING "btree" ("status");



CREATE INDEX "idx_mensalidades_status_vencimento" ON "public"."mensalidades" USING "btree" ("status", "data_vencimento");



CREATE INDEX "idx_notas_avaliacao_id_fk" ON "public"."notas" USING "btree" ("avaliacao_id");



CREATE INDEX "idx_notas_avaliacoes_aluno_id_fk" ON "public"."notas_avaliacoes" USING "btree" ("aluno_id");



CREATE INDEX "idx_notas_avaliacoes_matricula_id_fk" ON "public"."notas_avaliacoes" USING "btree" ("matricula_id");



CREATE INDEX "idx_notas_escola_id_fk" ON "public"."notas" USING "btree" ("escola_id");



CREATE INDEX "idx_notas_lookup" ON "public"."notas" USING "btree" ("escola_id", "matricula_id");



CREATE INDEX "idx_notices_escola" ON "public"."notices" USING "btree" ("escola_id");



CREATE INDEX "idx_notifications_escola_id_fk" ON "public"."notifications" USING "btree" ("escola_id");



CREATE INDEX "idx_onboarding_drafts_escola_id_fk" ON "public"."onboarding_drafts" USING "btree" ("escola_id");



CREATE INDEX "idx_outbox_escola_status" ON "public"."outbox_notificacoes" USING "btree" ("escola_id", "status", "created_at");



CREATE INDEX "idx_outbox_notificacoes_aluno_id_fk" ON "public"."outbox_notificacoes" USING "btree" ("aluno_id");



CREATE INDEX "idx_outbox_notificacoes_escola_id_fk" ON "public"."outbox_notificacoes" USING "btree" ("escola_id");



CREATE INDEX "idx_outbox_pending" ON "public"."outbox_notificacoes" USING "btree" ("status", "created_at");



CREATE INDEX "idx_pagamentos_escola" ON "public"."pagamentos" USING "btree" ("escola_id");



CREATE INDEX "idx_pagamentos_mensalidade" ON "public"."pagamentos" USING "btree" ("mensalidade_id");



CREATE INDEX "idx_pagamentos_mensalidade_status" ON "public"."pagamentos" USING "btree" ("mensalidade_id", "status");



CREATE INDEX "idx_pagamentos_transacao_externa" ON "public"."pagamentos" USING "btree" ("transacao_id_externo");



CREATE INDEX "idx_periodos_letivos_ano_letivo_id_fk" ON "public"."periodos_letivos" USING "btree" ("ano_letivo_id");



CREATE INDEX "idx_periodos_letivos_escola_id_fk" ON "public"."periodos_letivos" USING "btree" ("escola_id");



CREATE INDEX "idx_periodos_letivos_lookup" ON "public"."periodos_letivos" USING "btree" ("escola_id", "ano_letivo_id", "tipo", "numero");



CREATE INDEX "idx_permissions_role_id_fk" ON "public"."permissions" USING "btree" ("role_id");



CREATE INDEX "idx_presencas_disciplina" ON "public"."presencas" USING "btree" ("disciplina_id");



CREATE INDEX "idx_presencas_escola_data" ON "public"."presencas" USING "btree" ("escola_id", "data");



CREATE INDEX "idx_presencas_escola_id_fk" ON "public"."presencas" USING "btree" ("escola_id");



CREATE INDEX "idx_presencas_turma_id_fk" ON "public"."presencas" USING "btree" ("turma_id");



CREATE INDEX "idx_professores_escola_id_fk" ON "public"."professores" USING "btree" ("escola_id");



CREATE INDEX "idx_professores_profile_id_fk" ON "public"."professores" USING "btree" ("profile_id");



CREATE INDEX "idx_profiles_current_escola" ON "public"."profiles" USING "btree" ("current_escola_id");



CREATE INDEX "idx_profiles_escola_id" ON "public"."profiles" USING "btree" ("escola_id");



CREATE INDEX "idx_profiles_user_id" ON "public"."profiles" USING "btree" ("user_id");



CREATE INDEX "idx_regras_escala_escola_id_fk" ON "public"."regras_escala" USING "btree" ("escola_id");



CREATE INDEX "idx_regras_escala_sistema" ON "public"."regras_escala" USING "btree" ("sistema_notas_id");



CREATE INDEX "idx_rotinas_curso_oferta" ON "public"."rotinas" USING "btree" ("curso_oferta_id");



CREATE INDEX "idx_rotinas_escola_id_fk" ON "public"."rotinas" USING "btree" ("escola_id");



CREATE INDEX "idx_rotinas_professor_user_id_fk" ON "public"."rotinas" USING "btree" ("professor_user_id");



CREATE INDEX "idx_rotinas_secao" ON "public"."rotinas" USING "btree" ("secao_id");



CREATE INDEX "idx_rotinas_turma" ON "public"."rotinas" USING "btree" ("turma_id");



CREATE INDEX "idx_secoes_escola_id_fk" ON "public"."secoes" USING "btree" ("escola_id");



CREATE INDEX "idx_secoes_turma" ON "public"."secoes" USING "btree" ("turma_id");



CREATE INDEX "idx_sistemas_notas_escola_id_fk" ON "public"."sistemas_notas" USING "btree" ("escola_id");



CREATE INDEX "idx_sistemas_notas_semestre" ON "public"."sistemas_notas" USING "btree" ("semestre_id");



CREATE INDEX "idx_sistemas_notas_turma" ON "public"."sistemas_notas" USING "btree" ("turma_id");



CREATE INDEX "idx_staging_alunos_escola_import" ON "public"."staging_alunos" USING "btree" ("escola_id", "import_id", "turma_codigo", "id");



CREATE INDEX "idx_staging_alunos_import_turma" ON "public"."staging_alunos" USING "btree" ("escola_id", "import_id", "turma_codigo", "ano_letivo");



CREATE INDEX "idx_syllabi_curso_oferta" ON "public"."syllabi" USING "btree" ("curso_oferta_id");



CREATE INDEX "idx_syllabi_escola_id_fk" ON "public"."syllabi" USING "btree" ("escola_id");



CREATE INDEX "idx_tabelas_mensalidade_classe_id_fk" ON "public"."tabelas_mensalidade" USING "btree" ("classe_id");



CREATE INDEX "idx_tabelas_mensalidade_curso_id_fk" ON "public"."tabelas_mensalidade" USING "btree" ("curso_id");



CREATE INDEX "idx_tabmens_chave" ON "public"."tabelas_mensalidade" USING "btree" ("escola_id", "curso_id", "classe_id");



CREATE INDEX "idx_tabmens_escola" ON "public"."tabelas_mensalidade" USING "btree" ("escola_id");



CREATE INDEX "idx_tdp_disciplina" ON "public"."turma_disciplinas_professores" USING "btree" ("disciplina_id");



CREATE INDEX "idx_tdp_escola" ON "public"."turma_disciplinas_professores" USING "btree" ("escola_id");



CREATE INDEX "idx_tdp_professor" ON "public"."turma_disciplinas_professores" USING "btree" ("professor_id");



CREATE INDEX "idx_tdp_syllabus" ON "public"."turma_disciplinas_professores" USING "btree" ("syllabus_id");



CREATE INDEX "idx_tdp_turma" ON "public"."turma_disciplinas_professores" USING "btree" ("turma_id");



CREATE INDEX "idx_turma_disciplinas_escola_id_fk" ON "public"."turma_disciplinas" USING "btree" ("escola_id");



CREATE INDEX "idx_turma_disciplinas_matriz" ON "public"."turma_disciplinas" USING "btree" ("curso_matriz_id");



CREATE INDEX "idx_turmas_auditoria_escola_id_fk" ON "public"."turmas_auditoria" USING "btree" ("escola_id");



CREATE INDEX "idx_turmas_classe_id" ON "public"."turmas" USING "btree" ("classe_id");



CREATE INDEX "idx_turmas_coordenador_pedagogico_id" ON "public"."turmas" USING "btree" ("coordenador_pedagogico_id");



CREATE INDEX "idx_turmas_curso_id" ON "public"."turmas" USING "btree" ("curso_id");



CREATE INDEX "idx_turmas_diretor_turma_id" ON "public"."turmas" USING "btree" ("diretor_turma_id");



CREATE INDEX "idx_turmas_escola_ano" ON "public"."turmas" USING "btree" ("escola_id", "ano_letivo");



CREATE INDEX "idx_turmas_escola_ano_classe" ON "public"."turmas" USING "btree" ("escola_id", "ano_letivo", "classe_id", "nome", "id");



CREATE INDEX "idx_turmas_escola_ano_curso" ON "public"."turmas" USING "btree" ("escola_id", "ano_letivo", "curso_id", "nome", "id");



CREATE INDEX "idx_turmas_escola_ano_nome" ON "public"."turmas" USING "btree" ("escola_id", "ano_letivo", "nome", "id");



CREATE INDEX "idx_turmas_escola_id" ON "public"."turmas" USING "btree" ("escola_id");



CREATE INDEX "idx_turmas_escola_turma_code" ON "public"."turmas" USING "btree" ("escola_id", "turma_code", "ano_letivo");



CREATE INDEX "idx_turmas_import_id" ON "public"."turmas" USING "btree" ("import_id");



CREATE INDEX "idx_turmas_session_id" ON "public"."turmas" USING "btree" ("session_id");



CREATE INDEX "idx_turmas_smart_match" ON "public"."turmas" USING "btree" ("escola_id", "ano_letivo", "upper"("regexp_replace"("turma_codigo", '[^a-zA-Z0-9]'::"text", ''::"text", 'g'::"text")));



CREATE UNIQUE INDEX "idx_turmas_unica" ON "public"."turmas" USING "btree" ("escola_id", "ano_letivo", "classe_id", "turno", "nome");



CREATE INDEX "import_errors_import_id_idx" ON "public"."import_errors" USING "btree" ("import_id");



CREATE INDEX "ix_alunos_bi_trgm" ON "public"."alunos" USING "gin" ("bi_numero" "extensions"."gin_trgm_ops");



CREATE INDEX "ix_alunos_escola_deleted_status_created" ON "public"."alunos" USING "btree" ("escola_id", "deleted_at", "status", "created_at" DESC);



CREATE INDEX "ix_alunos_nome_trgm" ON "public"."alunos" USING "gin" ("nome" "extensions"."gin_trgm_ops");



CREATE INDEX "ix_alunos_numero_processo_trgm" ON "public"."alunos" USING "gin" ("numero_processo" "extensions"."gin_trgm_ops");



CREATE INDEX "ix_alunos_tsv" ON "public"."alunos" USING "gin" ("tsv");



CREATE INDEX "ix_attrprof_escola_prof_oferta" ON "public"."atribuicoes_prof" USING "btree" ("escola_id", "professor_user_id", "curso_oferta_id", "secao_id");



CREATE INDEX "ix_candidaturas_escola_ano_status_created" ON "public"."candidaturas" USING "btree" ("escola_id", "ano_letivo", "status", "created_at" DESC);



CREATE INDEX "ix_candidaturas_matricula_id" ON "public"."candidaturas" USING "btree" ("matricula_id");



CREATE INDEX "ix_candidaturas_nome_trgm" ON "public"."candidaturas" USING "gin" ("nome_candidato" "extensions"."gin_trgm_ops");



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



CREATE INDEX "ix_frequencias_2026_01_escola_curso_data" ON "public"."frequencias_2026_01" USING "btree" ("escola_id", "curso_oferta_id", "data");



CREATE INDEX "ix_frequencias_2026_01_escola_routine_data" ON "public"."frequencias_2026_01" USING "btree" ("escola_id", "routine_id", "data");



CREATE INDEX "ix_frequencias_2026_02_escola_curso_data" ON "public"."frequencias_2026_02" USING "btree" ("escola_id", "curso_oferta_id", "data");



CREATE INDEX "ix_frequencias_2026_02_escola_routine_data" ON "public"."frequencias_2026_02" USING "btree" ("escola_id", "routine_id", "data");



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



CREATE INDEX "ix_lancamentos_2026_01_escola_avaliacao_matricula" ON "public"."lancamentos_2026_01" USING "btree" ("escola_id", "avaliacao_id", "matricula_id");



CREATE INDEX "ix_lancamentos_2026_01_escola_matricula" ON "public"."lancamentos_2026_01" USING "btree" ("escola_id", "matricula_id");



CREATE INDEX "ix_lancamentos_2026_02_escola_avaliacao_matricula" ON "public"."lancamentos_2026_02" USING "btree" ("escola_id", "avaliacao_id", "matricula_id");



CREATE INDEX "ix_lancamentos_2026_02_escola_matricula" ON "public"."lancamentos_2026_02" USING "btree" ("escola_id", "matricula_id");



CREATE INDEX "ix_matriculas_escola_turma_secao" ON "public"."matriculas" USING "btree" ("escola_id", "turma_id", "secao_id", "status");



CREATE INDEX "ix_matriculas_lookup_ativo" ON "public"."matriculas" USING "btree" ("escola_id", "ano_letivo", "aluno_id", "status");



CREATE INDEX "ix_notices_escola_criado" ON "public"."notices" USING "btree" ("escola_id", "criado_em" DESC);



CREATE INDEX "ix_outbox_processing" ON "public"."outbox_events" USING "btree" ("status", "locked_at") WHERE ("status" = 'processing'::"public"."outbox_status");



CREATE INDEX "ix_outbox_ready" ON "public"."outbox_events" USING "btree" ("status", "next_attempt_at") WHERE ("status" = ANY (ARRAY['pending'::"public"."outbox_status", 'failed'::"public"."outbox_status"]));



CREATE INDEX "ix_rotinas_escola_secao_weekday_inicio" ON "public"."rotinas" USING "btree" ("escola_id", "secao_id", "weekday", "inicio");



CREATE INDEX "lancamentos_2025_09_escola_id_idx" ON "public"."lancamentos_2025_09" USING "btree" ("escola_id");



CREATE INDEX "lancamentos_2025_10_escola_id_idx" ON "public"."lancamentos_2025_10" USING "btree" ("escola_id");



CREATE INDEX "lancamentos_2025_11_escola_id_idx" ON "public"."lancamentos_2025_11" USING "btree" ("escola_id");



CREATE INDEX "lancamentos_2025_12_escola_id_idx" ON "public"."lancamentos_2025_12" USING "btree" ("escola_id");



CREATE INDEX "lancamentos_2026_01_escola_id_idx" ON "public"."lancamentos_2026_01" USING "btree" ("escola_id");



CREATE INDEX "lancamentos_2026_02_escola_id_idx" ON "public"."lancamentos_2026_02" USING "btree" ("escola_id");



CREATE INDEX "notifications_escola_target_idx" ON "public"."notifications" USING "btree" ("escola_id", "target_role", "lida", "created_at" DESC);



CREATE UNIQUE INDEX "profiles_escola_numero_login_uidx" ON "public"."profiles" USING "btree" ("escola_id", "numero_login") WHERE ("numero_login" IS NOT NULL);



CREATE INDEX "staging_alunos_import_id_idx" ON "public"."staging_alunos" USING "btree" ("import_id");



CREATE INDEX "staging_alunos_import_matricula_idx" ON "public"."staging_alunos" USING "btree" ("import_id", "escola_id", "ano_letivo", "curso_codigo", "classe_numero", "turno_codigo", "turma_letra");



CREATE UNIQUE INDEX "unique_approved_course_code" ON "public"."cursos" USING "btree" ("escola_id", "course_code") WHERE ("status_aprovacao" = 'aprovado'::"text");



CREATE UNIQUE INDEX "unique_matriculas_escola_aluno_turma_ano_status" ON "public"."matriculas" USING "btree" ("escola_id", "aluno_id", "turma_id", "ano_letivo") WHERE ("status" = ANY (ARRAY['ativo'::"text", 'pendente'::"text", 'concluido'::"text"]));



CREATE UNIQUE INDEX "unique_mensalidade_aluno" ON "public"."financeiro_lancamentos" USING "btree" ("escola_id", "aluno_id", "ano_referencia", "mes_referencia") WHERE (("origem" = 'mensalidade'::"public"."financeiro_origem") AND ("tipo" = 'debito'::"public"."financeiro_tipo_transacao"));



CREATE UNIQUE INDEX "uq_alunos_escola_codigo_ativacao" ON "public"."alunos" USING "btree" ("escola_id", "codigo_ativacao") WHERE ("codigo_ativacao" IS NOT NULL);



CREATE UNIQUE INDEX "uq_anos_letivos_ativo_por_escola" ON "public"."anos_letivos" USING "btree" ("escola_id") WHERE ("ativo" = true);



CREATE UNIQUE INDEX "uq_atribuicoes_prof_unique" ON "public"."atribuicoes_prof" USING "btree" ("professor_user_id", "curso_oferta_id", "secao_id");



CREATE UNIQUE INDEX "uq_avaliacoes_trimestre_tipo" ON "public"."avaliacoes" USING "btree" ("escola_id", "turma_disciplina_id", "ano_letivo", "trimestre", "tipo") WHERE (("ano_letivo" IS NOT NULL) AND ("trimestre" IS NOT NULL) AND ("tipo" IS NOT NULL));



CREATE UNIQUE INDEX "uq_cursos_escola_codigo" ON "public"."cursos" USING "btree" ("escola_id", "codigo");



CREATE UNIQUE INDEX "uq_cursos_escola_course_code" ON "public"."cursos" USING "btree" ("escola_id", "course_code") WHERE ("course_code" IS NOT NULL);



CREATE UNIQUE INDEX "uq_documentos_recibo_por_mensalidade" ON "public"."documentos_emitidos" USING "btree" ("mensalidade_id") WHERE (("tipo" = 'recibo'::"public"."tipo_documento") AND ("mensalidade_id" IS NOT NULL));



CREATE UNIQUE INDEX "uq_frequencia_status_periodo" ON "public"."frequencia_status_periodo" USING "btree" ("escola_id", "turma_id", "periodo_letivo_id", "aluno_id");



CREATE UNIQUE INDEX "uq_lancamentos_unique" ON "public"."lancamentos_default" USING "btree" ("matricula_id", "avaliacao_id");



CREATE UNIQUE INDEX "uq_matriculas_aluno_session" ON "public"."matriculas" USING "btree" ("aluno_id", "session_id") WHERE ("session_id" IS NOT NULL);



CREATE UNIQUE INDEX "uq_matriculas_cursos_unique" ON "public"."matriculas_cursos" USING "btree" ("matricula_id", "curso_oferta_id");



CREATE UNIQUE INDEX "uq_matriculas_escola_numero" ON "public"."matriculas" USING "btree" ("escola_id", "numero_matricula");



CREATE UNIQUE INDEX "uq_matriculas_numero_por_escola_ativa" ON "public"."matriculas" USING "btree" ("escola_id", "numero_matricula") WHERE ("status" = 'ativa'::"text");



CREATE UNIQUE INDEX "uq_notas_matricula_avaliacao" ON "public"."notas" USING "btree" ("matricula_id", "avaliacao_id");



CREATE UNIQUE INDEX "uq_profiles_numero_login_notnull" ON "public"."profiles" USING "btree" ("numero_login") WHERE ("numero_login" IS NOT NULL);



CREATE UNIQUE INDEX "uq_rotina_sala_tempo" ON "public"."rotinas" USING "btree" ("escola_id", "sala", "weekday", "inicio", "fim");



CREATE UNIQUE INDEX "uq_turma_disciplinas_unique" ON "public"."turma_disciplinas" USING "btree" ("escola_id", "turma_id", "curso_matriz_id");



CREATE UNIQUE INDEX "uq_turmas_escola_ano_code" ON "public"."turmas" USING "btree" ("escola_id", "ano_letivo", "turma_code") WHERE (("turma_code" IS NOT NULL) AND ("ano_letivo" IS NOT NULL));



CREATE UNIQUE INDEX "uq_turmas_escola_ano_codigo" ON "public"."turmas" USING "btree" ("escola_id", "ano_letivo", "turma_codigo");



CREATE UNIQUE INDEX "uq_turmas_ssot" ON "public"."turmas" USING "btree" ("escola_id", "ano_letivo", "turma_codigo") WHERE ("turma_codigo" IS NOT NULL);



CREATE UNIQUE INDEX "ux_curso_matriz_curriculo_classe_disciplina" ON "public"."curso_matriz" USING "btree" ("escola_id", "curso_curriculo_id", "classe_id", "disciplina_id") WHERE ("curso_curriculo_id" IS NOT NULL);



CREATE UNIQUE INDEX "ux_curso_matriz_curriculo_classe_disciplina_full" ON "public"."curso_matriz" USING "btree" ("escola_id", "curso_curriculo_id", "classe_id", "disciplina_id");



CREATE UNIQUE INDEX "ux_curso_matriz_curso_classe_disciplina" ON "public"."curso_matriz" USING "btree" ("escola_id", "curso_id", "classe_id", "disciplina_id") WHERE ("curso_curriculo_id" IS NULL);



CREATE UNIQUE INDEX "ux_curso_matriz_curso_classe_disciplina_full" ON "public"."curso_matriz" USING "btree" ("escola_id", "curso_id", "classe_id", "disciplina_id");



CREATE UNIQUE INDEX "ux_finance_payment_intents_dedupe" ON "public"."finance_payment_intents" USING "btree" ("escola_id", "dedupe_key");



CREATE UNIQUE INDEX "ux_frequencias_2025_09_escola_matricula_data_aula" ON "public"."frequencias_2025_09" USING "btree" ("escola_id", "matricula_id", "data", "aula_id");



CREATE UNIQUE INDEX "ux_frequencias_2025_10_escola_matricula_data_aula" ON "public"."frequencias_2025_10" USING "btree" ("escola_id", "matricula_id", "data", "aula_id");



CREATE UNIQUE INDEX "ux_frequencias_2025_11_escola_matricula_data_aula" ON "public"."frequencias_2025_11" USING "btree" ("escola_id", "matricula_id", "data", "aula_id");



CREATE UNIQUE INDEX "ux_frequencias_2025_12_escola_matricula_data_aula" ON "public"."frequencias_2025_12" USING "btree" ("escola_id", "matricula_id", "data", "aula_id");



CREATE UNIQUE INDEX "ux_frequencias_2026_01_escola_matricula_data_aula" ON "public"."frequencias_2026_01" USING "btree" ("escola_id", "matricula_id", "data", "aula_id");



CREATE UNIQUE INDEX "ux_frequencias_2026_02_escola_matricula_data_aula" ON "public"."frequencias_2026_02" USING "btree" ("escola_id", "matricula_id", "data", "aula_id");



CREATE UNIQUE INDEX "ux_frequencias_default_escola_matricula_data_aula" ON "public"."frequencias_default" USING "btree" ("escola_id", "matricula_id", "data", "aula_id");



CREATE UNIQUE INDEX "ux_mensalidades_aluno_mes" ON "public"."mensalidades" USING "btree" ("escola_id", "aluno_id", "ano_referencia", "mes_referencia");



CREATE UNIQUE INDEX "ux_outbox_dedupe" ON "public"."outbox_events" USING "btree" (COALESCE("escola_id", '00000000-0000-0000-0000-000000000000'::"uuid"), "event_type", "dedupe_key") WHERE (("dedupe_key" IS NOT NULL) AND ("status" <> 'dead'::"public"."outbox_status"));



CREATE UNIQUE INDEX "ux_pagamentos_escola_transacao" ON "public"."pagamentos" USING "btree" ("escola_id", "transacao_id_externo") WHERE ("transacao_id_externo" IS NOT NULL);



ALTER INDEX "public"."idx_frequencias_aula_id_fk" ATTACH PARTITION "public"."frequencias_2025_09_aula_id_idx";



ALTER INDEX "public"."idx_frequencias_escola_id_fk" ATTACH PARTITION "public"."frequencias_2025_09_escola_id_idx";



ALTER INDEX "public"."idx_frequencias_escola_matricula_data" ATTACH PARTITION "public"."frequencias_2025_09_escola_id_matricula_id_data_idx";



ALTER INDEX "public"."idx_frequencias_lookup" ATTACH PARTITION "public"."frequencias_2025_09_escola_id_matricula_id_data_idx1";



ALTER INDEX "public"."uq_frequencias_escola_matricula_data" ATTACH PARTITION "public"."frequencias_2025_09_escola_id_matricula_id_data_key";



ALTER INDEX "public"."idx_frequencias_escola_periodo" ATTACH PARTITION "public"."frequencias_2025_09_escola_id_periodo_letivo_id_matricula_i_idx";



ALTER INDEX "public"."idx_frequencias_aula_id_fk" ATTACH PARTITION "public"."frequencias_2025_10_aula_id_idx";



ALTER INDEX "public"."idx_frequencias_escola_id_fk" ATTACH PARTITION "public"."frequencias_2025_10_escola_id_idx";



ALTER INDEX "public"."idx_frequencias_escola_matricula_data" ATTACH PARTITION "public"."frequencias_2025_10_escola_id_matricula_id_data_idx";



ALTER INDEX "public"."idx_frequencias_lookup" ATTACH PARTITION "public"."frequencias_2025_10_escola_id_matricula_id_data_idx1";



ALTER INDEX "public"."uq_frequencias_escola_matricula_data" ATTACH PARTITION "public"."frequencias_2025_10_escola_id_matricula_id_data_key";



ALTER INDEX "public"."idx_frequencias_escola_periodo" ATTACH PARTITION "public"."frequencias_2025_10_escola_id_periodo_letivo_id_matricula_i_idx";



ALTER INDEX "public"."idx_frequencias_aula_id_fk" ATTACH PARTITION "public"."frequencias_2025_11_aula_id_idx";



ALTER INDEX "public"."idx_frequencias_escola_id_fk" ATTACH PARTITION "public"."frequencias_2025_11_escola_id_idx";



ALTER INDEX "public"."idx_frequencias_escola_matricula_data" ATTACH PARTITION "public"."frequencias_2025_11_escola_id_matricula_id_data_idx";



ALTER INDEX "public"."idx_frequencias_lookup" ATTACH PARTITION "public"."frequencias_2025_11_escola_id_matricula_id_data_idx1";



ALTER INDEX "public"."uq_frequencias_escola_matricula_data" ATTACH PARTITION "public"."frequencias_2025_11_escola_id_matricula_id_data_key";



ALTER INDEX "public"."idx_frequencias_escola_periodo" ATTACH PARTITION "public"."frequencias_2025_11_escola_id_periodo_letivo_id_matricula_i_idx";



ALTER INDEX "public"."idx_frequencias_aula_id_fk" ATTACH PARTITION "public"."frequencias_2025_12_aula_id_idx";



ALTER INDEX "public"."idx_frequencias_escola_id_fk" ATTACH PARTITION "public"."frequencias_2025_12_escola_id_idx";



ALTER INDEX "public"."idx_frequencias_escola_matricula_data" ATTACH PARTITION "public"."frequencias_2025_12_escola_id_matricula_id_data_idx";



ALTER INDEX "public"."idx_frequencias_lookup" ATTACH PARTITION "public"."frequencias_2025_12_escola_id_matricula_id_data_idx1";



ALTER INDEX "public"."uq_frequencias_escola_matricula_data" ATTACH PARTITION "public"."frequencias_2025_12_escola_id_matricula_id_data_key";



ALTER INDEX "public"."idx_frequencias_escola_periodo" ATTACH PARTITION "public"."frequencias_2025_12_escola_id_periodo_letivo_id_matricula_i_idx";



ALTER INDEX "public"."idx_frequencias_aula_id_fk" ATTACH PARTITION "public"."frequencias_2026_01_aula_id_idx";



ALTER INDEX "public"."idx_frequencias_escola_id_fk" ATTACH PARTITION "public"."frequencias_2026_01_escola_id_idx";



ALTER INDEX "public"."idx_frequencias_escola_matricula_data" ATTACH PARTITION "public"."frequencias_2026_01_escola_id_matricula_id_data_idx";



ALTER INDEX "public"."idx_frequencias_lookup" ATTACH PARTITION "public"."frequencias_2026_01_escola_id_matricula_id_data_idx1";



ALTER INDEX "public"."uq_frequencias_escola_matricula_data" ATTACH PARTITION "public"."frequencias_2026_01_escola_id_matricula_id_data_key";



ALTER INDEX "public"."idx_frequencias_escola_periodo" ATTACH PARTITION "public"."frequencias_2026_01_escola_id_periodo_letivo_id_matricula_i_idx";



ALTER INDEX "public"."idx_frequencias_aula_id_fk" ATTACH PARTITION "public"."frequencias_2026_02_aula_id_idx";



ALTER INDEX "public"."idx_frequencias_escola_id_fk" ATTACH PARTITION "public"."frequencias_2026_02_escola_id_idx";



ALTER INDEX "public"."idx_frequencias_escola_matricula_data" ATTACH PARTITION "public"."frequencias_2026_02_escola_id_matricula_id_data_idx";



ALTER INDEX "public"."idx_frequencias_lookup" ATTACH PARTITION "public"."frequencias_2026_02_escola_id_matricula_id_data_idx1";



ALTER INDEX "public"."uq_frequencias_escola_matricula_data" ATTACH PARTITION "public"."frequencias_2026_02_escola_id_matricula_id_data_key";



ALTER INDEX "public"."idx_frequencias_escola_periodo" ATTACH PARTITION "public"."frequencias_2026_02_escola_id_periodo_letivo_id_matricula_i_idx";



ALTER INDEX "public"."idx_frequencias_aula_id_fk" ATTACH PARTITION "public"."frequencias_default_aula_id_idx";



ALTER INDEX "public"."idx_frequencias_escola_matricula_data" ATTACH PARTITION "public"."frequencias_default_escola_id_matricula_id_data_idx";



ALTER INDEX "public"."idx_frequencias_lookup" ATTACH PARTITION "public"."frequencias_default_escola_id_matricula_id_data_idx1";



ALTER INDEX "public"."uq_frequencias_escola_matricula_data" ATTACH PARTITION "public"."frequencias_default_escola_id_matricula_id_data_key";



ALTER INDEX "public"."idx_frequencias_escola_periodo" ATTACH PARTITION "public"."frequencias_default_escola_id_periodo_letivo_id_matricula_i_idx";



ALTER INDEX "public"."idx_frequencias_escola_id_fk" ATTACH PARTITION "public"."idx_frequencias_default_escola_id_fk";



ALTER INDEX "public"."idx_lancamentos_escola_id_fk" ATTACH PARTITION "public"."idx_lancamentos_default_escola_id_fk";



ALTER INDEX "public"."idx_lancamentos_escola_id_fk" ATTACH PARTITION "public"."lancamentos_2025_09_escola_id_idx";



ALTER INDEX "public"."idx_lancamentos_escola_id_fk" ATTACH PARTITION "public"."lancamentos_2025_10_escola_id_idx";



ALTER INDEX "public"."idx_lancamentos_escola_id_fk" ATTACH PARTITION "public"."lancamentos_2025_11_escola_id_idx";



ALTER INDEX "public"."idx_lancamentos_escola_id_fk" ATTACH PARTITION "public"."lancamentos_2025_12_escola_id_idx";



ALTER INDEX "public"."idx_lancamentos_escola_id_fk" ATTACH PARTITION "public"."lancamentos_2026_01_escola_id_idx";



ALTER INDEX "public"."idx_lancamentos_escola_id_fk" ATTACH PARTITION "public"."lancamentos_2026_02_escola_id_idx";



CREATE OR REPLACE VIEW "public"."vw_secretaria_dashboard_kpis" WITH ("security_invoker"='true') AS
 SELECT "escola_id",
    "total_alunos",
    "total_turmas",
    "matriculas_ativas",
    "pendencias_importacao",
    "turmas_sem_professor",
    "alunos_sem_turma",
    "inadimplentes_total",
    "risco_total",
    "resumo_status",
    "turmas_destaque",
    "novas_matriculas",
    "avisos_recentes"
   FROM "internal"."mv_secretaria_dashboard_kpis" "m"
  WHERE ("escola_id" IN ( SELECT "eu"."escola_id"
           FROM "public"."escola_users" "eu"
          WHERE ("eu"."user_id" = "auth"."uid"())));



CREATE OR REPLACE TRIGGER "escolas_audit_delete" AFTER DELETE ON "public"."escolas" FOR EACH ROW EXECUTE FUNCTION "public"."log_escola_auditoria"();



CREATE OR REPLACE TRIGGER "escolas_audit_insert" AFTER INSERT ON "public"."escolas" FOR EACH ROW EXECUTE FUNCTION "public"."log_escola_auditoria"();



CREATE OR REPLACE TRIGGER "escolas_audit_update" AFTER UPDATE ON "public"."escolas" FOR EACH ROW EXECUTE FUNCTION "public"."log_escola_auditoria"();



CREATE OR REPLACE TRIGGER "fill_turma_disciplinas_on_turma_insert" AFTER INSERT ON "public"."turmas" FOR EACH ROW EXECUTE FUNCTION "public"."tg_fill_turma_disciplinas"();



CREATE OR REPLACE TRIGGER "on_turmas_update" BEFORE UPDATE ON "public"."turmas" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_timestamp_financeiro_itens" BEFORE UPDATE ON "public"."financeiro_itens" FOR EACH ROW EXECUTE FUNCTION "public"."set_timestamp"();



CREATE OR REPLACE TRIGGER "set_timestamp_financeiro_tabelas" BEFORE UPDATE ON "public"."financeiro_tabelas" FOR EACH ROW EXECUTE FUNCTION "public"."set_timestamp"();



CREATE OR REPLACE TRIGGER "trg_20_set_matricula_number" BEFORE INSERT OR UPDATE ON "public"."matriculas" FOR EACH ROW EXECUTE FUNCTION "public"."trg_set_matricula_number"();



CREATE OR REPLACE TRIGGER "trg_activate_aluno_after_matricula" AFTER INSERT OR UPDATE ON "public"."matriculas" FOR EACH ROW EXECUTE FUNCTION "public"."activate_aluno_after_matricula"();



CREATE OR REPLACE TRIGGER "trg_alunos_nome_busca" BEFORE INSERT OR UPDATE OF "nome", "nome_completo" ON "public"."alunos" FOR EACH ROW EXECUTE FUNCTION "public"."sync_alunos_nome_busca"();



CREATE OR REPLACE TRIGGER "trg_audit_alunos" AFTER INSERT OR DELETE OR UPDATE ON "public"."alunos" FOR EACH ROW EXECUTE FUNCTION "public"."audit_dml_trigger"();



CREATE OR REPLACE TRIGGER "trg_audit_candidaturas" AFTER INSERT OR DELETE OR UPDATE ON "public"."candidaturas" FOR EACH ROW EXECUTE FUNCTION "public"."audit_dml_trigger"();



CREATE OR REPLACE TRIGGER "trg_audit_cursos" AFTER INSERT OR DELETE OR UPDATE ON "public"."cursos" FOR EACH ROW EXECUTE FUNCTION "public"."audit_dml_trigger"();



CREATE OR REPLACE TRIGGER "trg_audit_financeiro_cobrancas" AFTER INSERT OR DELETE OR UPDATE ON "public"."financeiro_cobrancas" FOR EACH ROW EXECUTE FUNCTION "public"."audit_dml_trigger"();



CREATE OR REPLACE TRIGGER "trg_audit_financeiro_estornos" AFTER INSERT OR DELETE OR UPDATE ON "public"."financeiro_estornos" FOR EACH ROW EXECUTE FUNCTION "public"."audit_dml_trigger"();



CREATE OR REPLACE TRIGGER "trg_audit_financeiro_lancamentos" AFTER INSERT OR DELETE OR UPDATE ON "public"."financeiro_lancamentos" FOR EACH ROW EXECUTE FUNCTION "public"."audit_dml_trigger"();



CREATE OR REPLACE TRIGGER "trg_audit_financeiro_titulos" AFTER INSERT OR DELETE OR UPDATE ON "public"."financeiro_titulos" FOR EACH ROW EXECUTE FUNCTION "public"."audit_dml_trigger"();



CREATE OR REPLACE TRIGGER "trg_audit_matriculas" AFTER INSERT OR DELETE OR UPDATE ON "public"."matriculas" FOR EACH ROW EXECUTE FUNCTION "public"."audit_dml_trigger"();



CREATE OR REPLACE TRIGGER "trg_audit_mensalidades" AFTER INSERT OR DELETE OR UPDATE ON "public"."mensalidades" FOR EACH ROW EXECUTE FUNCTION "public"."audit_dml_trigger"();



CREATE OR REPLACE TRIGGER "trg_audit_pagamentos" AFTER INSERT OR DELETE OR UPDATE ON "public"."pagamentos" FOR EACH ROW EXECUTE FUNCTION "public"."audit_dml_trigger"();



CREATE OR REPLACE TRIGGER "trg_audit_profiles" AFTER INSERT OR DELETE OR UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."audit_dml_trigger"();



CREATE OR REPLACE TRIGGER "trg_audit_turmas" AFTER INSERT OR DELETE OR UPDATE ON "public"."turmas" FOR EACH ROW EXECUTE FUNCTION "public"."audit_dml_trigger"();



CREATE OR REPLACE TRIGGER "trg_auto_disciplinas" AFTER INSERT ON "public"."turmas" FOR EACH ROW EXECUTE FUNCTION "public"."sync_disciplinas_ao_criar_turma"();



CREATE OR REPLACE TRIGGER "trg_auto_numero_processo" BEFORE INSERT ON "public"."alunos" FOR EACH ROW EXECUTE FUNCTION "public"."trg_auto_numero_processo"();



CREATE OR REPLACE TRIGGER "trg_avaliacoes_consistency" BEFORE INSERT OR UPDATE ON "public"."avaliacoes" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_avaliacoes_consistency"();



CREATE OR REPLACE TRIGGER "trg_bi_atribuicoes_prof_escola" BEFORE INSERT OR UPDATE OF "curso_oferta_id" ON "public"."atribuicoes_prof" FOR EACH ROW EXECUTE FUNCTION "public"."trg_set_escola_atribuicoes_prof"();



CREATE OR REPLACE TRIGGER "trg_bi_frequencias_escola" BEFORE INSERT OR UPDATE OF "matricula_id" ON "public"."frequencias_default" FOR EACH ROW EXECUTE FUNCTION "public"."trg_set_escola_frequencias"();



CREATE OR REPLACE TRIGGER "trg_bi_lancamentos_escola" BEFORE INSERT OR UPDATE OF "matricula_id" ON "public"."lancamentos_default" FOR EACH ROW EXECUTE FUNCTION "public"."trg_set_escola_lancamentos"();



CREATE OR REPLACE TRIGGER "trg_bi_matriculas_cursos_escola" BEFORE INSERT OR UPDATE OF "matricula_id" ON "public"."matriculas_cursos" FOR EACH ROW EXECUTE FUNCTION "public"."trg_set_escola_matriculas_cursos"();



CREATE OR REPLACE TRIGGER "trg_bi_regras_escala_escola" BEFORE INSERT OR UPDATE OF "sistema_notas_id" ON "public"."regras_escala" FOR EACH ROW EXECUTE FUNCTION "public"."trg_set_escola_regras_escala"();



CREATE OR REPLACE TRIGGER "trg_bi_rotinas_escola" BEFORE INSERT OR UPDATE OF "curso_oferta_id", "turma_id" ON "public"."rotinas" FOR EACH ROW EXECUTE FUNCTION "public"."trg_set_escola_rotinas"();



CREATE OR REPLACE TRIGGER "trg_bi_sistemas_notas_escola" BEFORE INSERT OR UPDATE OF "turma_id", "semestre_id" ON "public"."sistemas_notas" FOR EACH ROW EXECUTE FUNCTION "public"."trg_set_escola_sistemas_notas"();



CREATE OR REPLACE TRIGGER "trg_bi_syllabi_escola" BEFORE INSERT OR UPDATE OF "curso_oferta_id" ON "public"."syllabi" FOR EACH ROW EXECUTE FUNCTION "public"."trg_set_escola_syllabi"();



CREATE OR REPLACE TRIGGER "trg_block_frequencias_after_close" BEFORE INSERT OR UPDATE ON "public"."frequencias" FOR EACH ROW EXECUTE FUNCTION "public"."block_frequencias_after_close"();



CREATE OR REPLACE TRIGGER "trg_bu_config_escola_updated_at" BEFORE UPDATE ON "public"."configuracoes_escola" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_candidaturas_set_updated_at" BEFORE UPDATE ON "public"."candidaturas" FOR EACH ROW EXECUTE FUNCTION "public"."tg_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_curso_curriculos_force_fields" BEFORE INSERT ON "public"."curso_curriculos" FOR EACH ROW EXECUTE FUNCTION "public"."curso_curriculos_force_fields"();



CREATE OR REPLACE TRIGGER "trg_curso_matriz_assert_same_escola" BEFORE INSERT OR UPDATE OF "curso_curriculo_id", "escola_id" ON "public"."curso_matriz" FOR EACH ROW EXECUTE FUNCTION "public"."curso_matriz_assert_same_escola"();



CREATE OR REPLACE TRIGGER "trg_curso_matriz_fill_curriculo_id" BEFORE INSERT ON "public"."curso_matriz" FOR EACH ROW EXECUTE FUNCTION "public"."curso_matriz_fill_curriculo_id"();



CREATE OR REPLACE TRIGGER "trg_escolas_updated" BEFORE UPDATE ON "public"."escolas" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_guard_candidaturas_status_change" BEFORE UPDATE ON "public"."candidaturas" FOR EACH ROW EXECUTE FUNCTION "public"."_guard_candidaturas_status_change"();



CREATE OR REPLACE TRIGGER "trg_guard_matricula_status_numero" BEFORE INSERT OR UPDATE ON "public"."matriculas" FOR EACH ROW EXECUTE FUNCTION "public"."guard_matricula_status_numero"();



CREATE OR REPLACE TRIGGER "trg_matriculas_set_updated_at" BEFORE UPDATE ON "public"."matriculas" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_matriculas_status_canonical" BEFORE INSERT OR UPDATE OF "status" ON "public"."matriculas" FOR EACH ROW EXECUTE FUNCTION "public"."matriculas_status_before_ins_upd"();



CREATE OR REPLACE TRIGGER "trg_matriculas_tenant_consistency" BEFORE INSERT OR UPDATE ON "public"."matriculas" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_matriculas_tenant_consistency"();



CREATE OR REPLACE TRIGGER "trg_normalize_course_code" BEFORE INSERT OR UPDATE OF "course_code" ON "public"."cursos" FOR EACH ROW EXECUTE FUNCTION "public"."normalize_course_code"();



CREATE OR REPLACE TRIGGER "trg_normalize_turma_code" BEFORE INSERT OR UPDATE OF "turma_code" ON "public"."turmas" FOR EACH ROW EXECUTE FUNCTION "public"."normalize_turma_code"();



CREATE OR REPLACE TRIGGER "trg_notas_consistency" BEFORE INSERT OR UPDATE ON "public"."notas" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_notas_consistency"();



CREATE OR REPLACE TRIGGER "trg_pagamentos_tenant_consistency" BEFORE INSERT OR UPDATE ON "public"."pagamentos" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_pagamentos_tenant_consistency"();



CREATE OR REPLACE TRIGGER "trg_profiles_updated" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_sync_nome_completo" BEFORE INSERT OR UPDATE ON "public"."alunos" FOR EACH ROW EXECUTE FUNCTION "public"."sync_alunos_nome_completo"();



CREATE OR REPLACE TRIGGER "trg_tdp_touch" BEFORE UPDATE ON "public"."turma_disciplinas_professores" FOR EACH ROW EXECUTE FUNCTION "public"."trg_touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_turma_disciplinas_consistency" BEFORE INSERT OR UPDATE ON "public"."turma_disciplinas" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_turma_disciplina_consistency"();



CREATE OR REPLACE TRIGGER "trigger_alunos_updated_at" BEFORE UPDATE ON "public"."alunos" FOR EACH ROW EXECUTE FUNCTION "public"."atualiza_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_mensalidades_updated_at" BEFORE UPDATE ON "public"."mensalidades" FOR EACH ROW EXECUTE FUNCTION "public"."atualiza_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_pagamentos_updated_at" BEFORE UPDATE ON "public"."pagamentos" FOR EACH ROW EXECUTE FUNCTION "public"."atualiza_updated_at"();



CREATE OR REPLACE TRIGGER "turmas_audit_delete" AFTER DELETE ON "public"."turmas" FOR EACH ROW EXECUTE FUNCTION "public"."log_turma_auditoria"();



CREATE OR REPLACE TRIGGER "turmas_audit_insert" AFTER INSERT ON "public"."turmas" FOR EACH ROW EXECUTE FUNCTION "public"."log_turma_auditoria"();



CREATE OR REPLACE TRIGGER "turmas_audit_update" AFTER UPDATE ON "public"."turmas" FOR EACH ROW EXECUTE FUNCTION "public"."log_turma_auditoria"();



ALTER TABLE ONLY "public"."alunos"
    ADD CONSTRAINT "alunos_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."profiles"("user_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."alunos"
    ADD CONSTRAINT "alunos_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."alunos_excluidos"
    ADD CONSTRAINT "alunos_excluidos_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."alunos_excluidos"
    ADD CONSTRAINT "alunos_excluidos_excluido_por_fkey" FOREIGN KEY ("excluido_por") REFERENCES "public"."profiles"("user_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."alunos"
    ADD CONSTRAINT "alunos_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("user_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."alunos"
    ADD CONSTRAINT "alunos_usuario_auth_id_fkey" FOREIGN KEY ("usuario_auth_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."anos_letivos"
    ADD CONSTRAINT "anos_letivos_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



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



ALTER TABLE ONLY "public"."aulas"
    ADD CONSTRAINT "aulas_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."avaliacoes"
    ADD CONSTRAINT "avaliacoes_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."avaliacoes"
    ADD CONSTRAINT "avaliacoes_periodo_letivo_id_fkey" FOREIGN KEY ("periodo_letivo_id") REFERENCES "public"."periodos_letivos"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."candidaturas"
    ADD CONSTRAINT "candidaturas_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "public"."alunos"("id");



ALTER TABLE ONLY "public"."candidaturas"
    ADD CONSTRAINT "candidaturas_classe_id_fkey" FOREIGN KEY ("classe_id") REFERENCES "public"."classes"("id");



ALTER TABLE ONLY "public"."candidaturas"
    ADD CONSTRAINT "candidaturas_curso_id_fkey" FOREIGN KEY ("curso_id") REFERENCES "public"."cursos"("id");



ALTER TABLE ONLY "public"."candidaturas"
    ADD CONSTRAINT "candidaturas_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."candidaturas_status_log"
    ADD CONSTRAINT "candidaturas_status_log_candidatura_id_fkey" FOREIGN KEY ("candidatura_id") REFERENCES "public"."candidaturas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."candidaturas_status_log"
    ADD CONSTRAINT "candidaturas_status_log_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."candidaturas"
    ADD CONSTRAINT "candidaturas_turma_preferencial_id_fkey" FOREIGN KEY ("turma_preferencial_id") REFERENCES "public"."turmas"("id");



ALTER TABLE ONLY "public"."classes"
    ADD CONSTRAINT "classes_curso_id_fkey" FOREIGN KEY ("curso_id") REFERENCES "public"."cursos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."classes"
    ADD CONSTRAINT "classes_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."configuracoes_curriculo"
    ADD CONSTRAINT "configuracoes_curriculo_curso_id_fkey" FOREIGN KEY ("curso_id") REFERENCES "public"."cursos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."configuracoes_curriculo"
    ADD CONSTRAINT "configuracoes_curriculo_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."configuracoes_escola"
    ADD CONSTRAINT "configuracoes_escola_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."curso_curriculos"
    ADD CONSTRAINT "curso_curriculos_ano_letivo_id_fkey" FOREIGN KEY ("ano_letivo_id") REFERENCES "public"."anos_letivos"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."curso_curriculos"
    ADD CONSTRAINT "curso_curriculos_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."curso_curriculos"
    ADD CONSTRAINT "curso_curriculos_curso_id_fkey" FOREIGN KEY ("curso_id") REFERENCES "public"."cursos"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."curso_curriculos"
    ADD CONSTRAINT "curso_curriculos_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."curso_matriz"
    ADD CONSTRAINT "curso_matriz_classe_id_fkey" FOREIGN KEY ("classe_id") REFERENCES "public"."classes"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."curso_matriz"
    ADD CONSTRAINT "curso_matriz_curso_curriculo_id_fkey" FOREIGN KEY ("curso_curriculo_id") REFERENCES "public"."curso_curriculos"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."curso_matriz"
    ADD CONSTRAINT "curso_matriz_curso_id_fkey" FOREIGN KEY ("curso_id") REFERENCES "public"."cursos"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."curso_matriz"
    ADD CONSTRAINT "curso_matriz_disciplina_id_fkey" FOREIGN KEY ("disciplina_id") REFERENCES "public"."disciplinas_catalogo"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."curso_matriz"
    ADD CONSTRAINT "curso_matriz_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cursos"
    ADD CONSTRAINT "cursos_curso_global_id_fkey" FOREIGN KEY ("curso_global_id") REFERENCES "public"."cursos_globais_cache"("hash");



ALTER TABLE ONLY "public"."cursos"
    ADD CONSTRAINT "cursos_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cursos_globais_cache"
    ADD CONSTRAINT "cursos_globais_cache_created_by_escola_fkey" FOREIGN KEY ("created_by_escola") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."disciplinas_catalogo"
    ADD CONSTRAINT "disciplinas_catalogo_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."documentos_emitidos"
    ADD CONSTRAINT "documentos_emitidos_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "public"."alunos"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."documentos_emitidos"
    ADD CONSTRAINT "documentos_emitidos_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."documentos_emitidos"
    ADD CONSTRAINT "documentos_emitidos_mensalidade_id_fkey" FOREIGN KEY ("mensalidade_id") REFERENCES "public"."mensalidades"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."escola_administradores"
    ADD CONSTRAINT "escola_administradores_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."escola_administradores"
    ADD CONSTRAINT "escola_administradores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."escola_auditoria"
    ADD CONSTRAINT "escola_auditoria_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."escola_configuracoes"
    ADD CONSTRAINT "escola_configuracoes_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."escola_users"
    ADD CONSTRAINT "escola_users_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."escola_users"
    ADD CONSTRAINT "escola_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."finance_payment_intents"
    ADD CONSTRAINT "finance_payment_intents_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "public"."alunos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."finance_payment_intents"
    ADD CONSTRAINT "finance_payment_intents_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."finance_payment_intents"
    ADD CONSTRAINT "finance_payment_intents_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."finance_payment_intents"
    ADD CONSTRAINT "finance_payment_intents_mensalidade_id_fkey" FOREIGN KEY ("mensalidade_id") REFERENCES "public"."mensalidades"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."financeiro_cobrancas"
    ADD CONSTRAINT "financeiro_cobrancas_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "public"."alunos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."financeiro_cobrancas"
    ADD CONSTRAINT "financeiro_cobrancas_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."financeiro_cobrancas"
    ADD CONSTRAINT "financeiro_cobrancas_mensalidade_id_fkey" FOREIGN KEY ("mensalidade_id") REFERENCES "public"."mensalidades"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."financeiro_contratos"
    ADD CONSTRAINT "financeiro_contratos_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "public"."alunos"("id");



ALTER TABLE ONLY "public"."financeiro_contratos"
    ADD CONSTRAINT "financeiro_contratos_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."financeiro_contratos"
    ADD CONSTRAINT "financeiro_contratos_matricula_id_fkey" FOREIGN KEY ("matricula_id") REFERENCES "public"."matriculas"("id");



ALTER TABLE ONLY "public"."financeiro_estornos"
    ADD CONSTRAINT "financeiro_estornos_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."financeiro_estornos"
    ADD CONSTRAINT "financeiro_estornos_mensalidade_id_fkey" FOREIGN KEY ("mensalidade_id") REFERENCES "public"."mensalidades"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."financeiro_itens"
    ADD CONSTRAINT "financeiro_itens_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."financeiro_lancamentos"
    ADD CONSTRAINT "financeiro_lancamentos_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "public"."alunos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."financeiro_lancamentos"
    ADD CONSTRAINT "financeiro_lancamentos_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."financeiro_lancamentos"
    ADD CONSTRAINT "financeiro_lancamentos_matricula_id_fkey" FOREIGN KEY ("matricula_id") REFERENCES "public"."matriculas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."financeiro_tabelas"
    ADD CONSTRAINT "financeiro_tabelas_classe_id_fkey" FOREIGN KEY ("classe_id") REFERENCES "public"."classes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."financeiro_tabelas"
    ADD CONSTRAINT "financeiro_tabelas_curso_id_fkey" FOREIGN KEY ("curso_id") REFERENCES "public"."cursos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."financeiro_tabelas"
    ADD CONSTRAINT "financeiro_tabelas_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."financeiro_titulos"
    ADD CONSTRAINT "financeiro_titulos_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "public"."alunos"("id");



ALTER TABLE ONLY "public"."financeiro_titulos"
    ADD CONSTRAINT "financeiro_titulos_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "public"."financeiro_contratos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."financeiro_titulos"
    ADD CONSTRAINT "financeiro_titulos_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."escola_administradores"
    ADD CONSTRAINT "fk_escola_admin_escola" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."escola_administradores"
    ADD CONSTRAINT "fk_escola_admin_user" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."frequencia_status_periodo"
    ADD CONSTRAINT "frequencia_status_periodo_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "public"."alunos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."frequencia_status_periodo"
    ADD CONSTRAINT "frequencia_status_periodo_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."frequencia_status_periodo"
    ADD CONSTRAINT "frequencia_status_periodo_matricula_id_fkey" FOREIGN KEY ("matricula_id") REFERENCES "public"."matriculas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."frequencia_status_periodo"
    ADD CONSTRAINT "frequencia_status_periodo_periodo_letivo_id_fkey" FOREIGN KEY ("periodo_letivo_id") REFERENCES "public"."periodos_letivos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."frequencia_status_periodo"
    ADD CONSTRAINT "frequencia_status_periodo_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "public"."turmas"("id") ON DELETE CASCADE;



ALTER TABLE "public"."frequencias"
    ADD CONSTRAINT "frequencias_aula_id_fkey" FOREIGN KEY ("aula_id") REFERENCES "public"."aulas"("id") ON DELETE CASCADE;



ALTER TABLE "public"."frequencias"
    ADD CONSTRAINT "frequencias_escola_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."frequencias_default"
    ADD CONSTRAINT "frequencias_matricula_id_fkey" FOREIGN KEY ("matricula_id") REFERENCES "public"."matriculas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."frequencias_default"
    ADD CONSTRAINT "frequencias_routine_id_fkey" FOREIGN KEY ("routine_id") REFERENCES "public"."rotinas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."historico_anos"
    ADD CONSTRAINT "historico_anos_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "public"."alunos"("id");



ALTER TABLE ONLY "public"."historico_anos"
    ADD CONSTRAINT "historico_anos_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."historico_anos"
    ADD CONSTRAINT "historico_anos_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "public"."turmas"("id");



ALTER TABLE ONLY "public"."historico_disciplinas"
    ADD CONSTRAINT "historico_disciplinas_historico_ano_id_fkey" FOREIGN KEY ("historico_ano_id") REFERENCES "public"."historico_anos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."import_errors"
    ADD CONSTRAINT "import_errors_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "public"."import_migrations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."import_migrations"
    ADD CONSTRAINT "import_migrations_escola_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE "public"."lancamentos"
    ADD CONSTRAINT "lancamentos_escola_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lancamentos_default"
    ADD CONSTRAINT "lancamentos_matricula_id_fkey" FOREIGN KEY ("matricula_id") REFERENCES "public"."matriculas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matricula_counters"
    ADD CONSTRAINT "matricula_counters_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matriculas"
    ADD CONSTRAINT "matriculas_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "public"."alunos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matriculas_cursos"
    ADD CONSTRAINT "matriculas_cursos_escola_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matriculas_cursos"
    ADD CONSTRAINT "matriculas_cursos_matricula_id_fkey" FOREIGN KEY ("matricula_id") REFERENCES "public"."matriculas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matriculas"
    ADD CONSTRAINT "matriculas_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matriculas"
    ADD CONSTRAINT "matriculas_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "public"."import_migrations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."matriculas"
    ADD CONSTRAINT "matriculas_secao_id_fkey" FOREIGN KEY ("secao_id") REFERENCES "public"."secoes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."matriculas"
    ADD CONSTRAINT "matriculas_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "public"."turmas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mensalidades"
    ADD CONSTRAINT "mensalidades_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "public"."alunos"("id");



ALTER TABLE ONLY "public"."mensalidades"
    ADD CONSTRAINT "mensalidades_matricula_id_fkey" FOREIGN KEY ("matricula_id") REFERENCES "public"."matriculas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notas"
    ADD CONSTRAINT "notas_avaliacao_id_fkey" FOREIGN KEY ("avaliacao_id") REFERENCES "public"."avaliacoes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notas_avaliacoes"
    ADD CONSTRAINT "notas_avaliacoes_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "public"."alunos"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."notas_avaliacoes"
    ADD CONSTRAINT "notas_avaliacoes_matricula_id_fkey" FOREIGN KEY ("matricula_id") REFERENCES "public"."matriculas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notas"
    ADD CONSTRAINT "notas_escola_id_fkey1" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notas"
    ADD CONSTRAINT "notas_matricula_id_fkey" FOREIGN KEY ("matricula_id") REFERENCES "public"."matriculas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notices"
    ADD CONSTRAINT "notices_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."onboarding_drafts"
    ADD CONSTRAINT "onboarding_drafts_escola_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."outbox_notificacoes"
    ADD CONSTRAINT "outbox_notificacoes_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "public"."alunos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."outbox_notificacoes"
    ADD CONSTRAINT "outbox_notificacoes_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pagamentos"
    ADD CONSTRAINT "pagamentos_mensalidade_id_fkey" FOREIGN KEY ("mensalidade_id") REFERENCES "public"."mensalidades"("id");



ALTER TABLE ONLY "public"."periodos_letivos"
    ADD CONSTRAINT "periodos_letivos_ano_letivo_id_fkey" FOREIGN KEY ("ano_letivo_id") REFERENCES "public"."anos_letivos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."periodos_letivos"
    ADD CONSTRAINT "periodos_letivos_escola_id_fkey1" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."permissions"
    ADD CONSTRAINT "permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE;



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
    ADD CONSTRAINT "rotinas_escola_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rotinas"
    ADD CONSTRAINT "rotinas_professor_user_id_fkey" FOREIGN KEY ("professor_user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rotinas"
    ADD CONSTRAINT "rotinas_secao_id_fkey" FOREIGN KEY ("secao_id") REFERENCES "public"."secoes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."rotinas"
    ADD CONSTRAINT "rotinas_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "public"."turmas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."secoes"
    ADD CONSTRAINT "secoes_escola_fk_linter_fix" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."secoes"
    ADD CONSTRAINT "secoes_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "public"."turmas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sistemas_notas"
    ADD CONSTRAINT "sistemas_notas_escola_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sistemas_notas"
    ADD CONSTRAINT "sistemas_notas_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "public"."turmas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staging_alunos"
    ADD CONSTRAINT "staging_alunos_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "public"."import_migrations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."syllabi"
    ADD CONSTRAINT "syllabi_escola_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tabelas_mensalidade"
    ADD CONSTRAINT "tabelas_mensalidade_classe_id_fkey" FOREIGN KEY ("classe_id") REFERENCES "public"."classes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tabelas_mensalidade"
    ADD CONSTRAINT "tabelas_mensalidade_curso_id_fkey" FOREIGN KEY ("curso_id") REFERENCES "public"."cursos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tabelas_mensalidade"
    ADD CONSTRAINT "tabelas_mensalidade_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."turma_disciplinas"
    ADD CONSTRAINT "turma_disciplinas_curso_matriz_id_fkey" FOREIGN KEY ("curso_matriz_id") REFERENCES "public"."curso_matriz"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."turma_disciplinas"
    ADD CONSTRAINT "turma_disciplinas_escola_id_fkey1" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."turma_disciplinas_professores"
    ADD CONSTRAINT "turma_disciplinas_professores_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."turma_disciplinas_professores"
    ADD CONSTRAINT "turma_disciplinas_professores_professor_id_fkey" FOREIGN KEY ("professor_id") REFERENCES "public"."professores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."turma_disciplinas_professores"
    ADD CONSTRAINT "turma_disciplinas_professores_syllabus_id_fkey" FOREIGN KEY ("syllabus_id") REFERENCES "public"."syllabi"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."turma_disciplinas_professores"
    ADD CONSTRAINT "turma_disciplinas_professores_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "public"."turmas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."turma_disciplinas"
    ADD CONSTRAINT "turma_disciplinas_turma_id_fkey1" FOREIGN KEY ("turma_id") REFERENCES "public"."turmas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."turmas_auditoria"
    ADD CONSTRAINT "turmas_auditoria_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."turmas"
    ADD CONSTRAINT "turmas_classe_id_fkey" FOREIGN KEY ("classe_id") REFERENCES "public"."classes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."turmas"
    ADD CONSTRAINT "turmas_curso_id_fkey" FOREIGN KEY ("curso_id") REFERENCES "public"."cursos"("id");



ALTER TABLE ONLY "public"."turmas"
    ADD CONSTRAINT "turmas_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "public"."escolas"("id") ON DELETE CASCADE;



CREATE POLICY "Allow read access to authenticated users" ON "public"."permissions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow read access to authenticated users" ON "public"."roles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Escola gerencia config" ON "public"."configuracoes_curriculo" TO "authenticated" USING (("escola_id" IN ( SELECT "p"."escola_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) WITH CHECK (("escola_id" IN ( SELECT "p"."escola_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Tenant Isolation" ON "public"."escola_auditoria" USING (("escola_id" = "public"."current_tenant_escola_id"())) WITH CHECK (("escola_id" = "public"."current_tenant_escola_id"()));



CREATE POLICY "Tenant Isolation" ON "public"."lancamentos" USING (("escola_id" = "public"."current_tenant_escola_id"())) WITH CHECK (("escola_id" = "public"."current_tenant_escola_id"()));



CREATE POLICY "Tenant Isolation" ON "public"."presencas" USING (("escola_id" = "public"."current_tenant_escola_id"())) WITH CHECK (("escola_id" = "public"."current_tenant_escola_id"()));



CREATE POLICY "Tenant Isolation" ON "public"."professores" USING (("escola_id" = "public"."current_tenant_escola_id"())) WITH CHECK (("escola_id" = "public"."current_tenant_escola_id"()));



CREATE POLICY "Tenant Isolation" ON "public"."secoes" USING (("escola_id" = "public"."current_tenant_escola_id"())) WITH CHECK (("escola_id" = "public"."current_tenant_escola_id"()));



CREATE POLICY "Tenant Isolation" ON "public"."turmas_auditoria" USING (("escola_id" = "public"."current_tenant_escola_id"())) WITH CHECK (("escola_id" = "public"."current_tenant_escola_id"()));



ALTER TABLE "public"."aluno_processo_counters" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."alunos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "alunos_delete_staff_v3" ON "public"."alunos" FOR DELETE TO "authenticated" USING ("public"."is_staff_escola"("escola_id"));



ALTER TABLE "public"."alunos_excluidos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "alunos_excluidos_select_opt" ON "public"."alunos_excluidos" FOR SELECT TO "authenticated" USING (("escola_id" IN ( SELECT "p"."escola_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "alunos_insert_staff_v3" ON "public"."alunos" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_staff_escola"("escola_id"));



CREATE POLICY "alunos_select_combined" ON "public"."alunos" FOR SELECT TO "authenticated" USING (("public"."has_access_to_escola"("escola_id") OR "public"."is_staff_escola"("escola_id") OR ( SELECT ("count"(*) > 0)
   FROM "public"."profiles" "p"
  WHERE (("p"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("p"."user_id" = "alunos"."profile_id") OR (("p"."role" = 'encarregado'::"public"."user_role") AND ("p"."telefone" = "alunos"."encarregado_telefone")))))));



CREATE POLICY "alunos_service_import" ON "public"."alunos" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "alunos_update_staff_v3" ON "public"."alunos" FOR UPDATE TO "authenticated" USING ("public"."is_staff_escola"("escola_id")) WITH CHECK ("public"."is_staff_escola"("escola_id"));



ALTER TABLE "public"."anos_letivos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "anos_letivos_select" ON "public"."anos_letivos" FOR SELECT TO "authenticated" USING (("escola_id" = "public"."current_tenant_escola_id"()));



ALTER TABLE "public"."atribuicoes_prof" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_logs_insert_v3" ON "public"."audit_logs" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL));



CREATE POLICY "audit_logs_select_v3" ON "public"."audit_logs" FOR SELECT TO "authenticated" USING (((( SELECT "auth"."role"() AS "role") = 'service_role'::"text") OR ("escola_id" IN ( SELECT "p"."escola_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR (("escola_id" IS NULL) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'super_admin'::"public"."user_role")))))));



ALTER TABLE "public"."aulas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."avaliacoes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "avaliacoes_delete" ON "public"."avaliacoes" FOR DELETE TO "authenticated" USING ((("escola_id" = "public"."current_tenant_escola_id"()) AND "public"."user_has_role_in_school"("escola_id", ARRAY['admin_escola'::"text", 'secretaria'::"text", 'professor'::"text"])));



CREATE POLICY "avaliacoes_insert" ON "public"."avaliacoes" FOR INSERT TO "authenticated" WITH CHECK ((("escola_id" = "public"."current_tenant_escola_id"()) AND "public"."user_has_role_in_school"("escola_id", ARRAY['admin_escola'::"text", 'secretaria'::"text", 'professor'::"text"])));



CREATE POLICY "avaliacoes_select" ON "public"."avaliacoes" FOR SELECT TO "authenticated" USING (("escola_id" = "public"."current_tenant_escola_id"()));



CREATE POLICY "avaliacoes_update" ON "public"."avaliacoes" FOR UPDATE TO "authenticated" USING ((("escola_id" = "public"."current_tenant_escola_id"()) AND "public"."user_has_role_in_school"("escola_id", ARRAY['admin_escola'::"text", 'secretaria'::"text", 'professor'::"text"]))) WITH CHECK ((("escola_id" = "public"."current_tenant_escola_id"()) AND "public"."user_has_role_in_school"("escola_id", ARRAY['admin_escola'::"text", 'secretaria'::"text", 'professor'::"text"])));



ALTER TABLE "public"."candidaturas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."candidaturas_status_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "candidaturas_status_log_isolation" ON "public"."candidaturas_status_log" FOR SELECT TO "authenticated" USING (("escola_id" = "public"."current_tenant_escola_id"()));



CREATE POLICY "candidaturas_tenant_isolation_delete" ON "public"."candidaturas" FOR DELETE TO "authenticated" USING ((("escola_id" = "public"."current_tenant_escola_id"()) AND (("status" = 'rascunho'::"text") OR "public"."check_super_admin_role"())));



CREATE POLICY "candidaturas_tenant_isolation_insert" ON "public"."candidaturas" FOR INSERT TO "authenticated" WITH CHECK (("escola_id" = "public"."current_tenant_escola_id"()));



CREATE POLICY "candidaturas_tenant_isolation_select" ON "public"."candidaturas" FOR SELECT TO "authenticated" USING (("escola_id" = "public"."current_tenant_escola_id"()));



CREATE POLICY "candidaturas_tenant_isolation_update" ON "public"."candidaturas" FOR UPDATE TO "authenticated" USING ((("escola_id" = "public"."current_tenant_escola_id"()) AND (("status" = 'rascunho'::"text") OR "public"."check_super_admin_role"()))) WITH CHECK (("escola_id" = "public"."current_tenant_escola_id"()));



ALTER TABLE "public"."classes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "classes_unificado_v3" ON "public"."classes" TO "authenticated" USING (("escola_id" IN ( SELECT "p"."escola_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "cobrancas_tenant_isolation" ON "public"."financeiro_cobrancas" USING (("escola_id" = "public"."current_tenant_escola_id"())) WITH CHECK (("escola_id" = "public"."current_tenant_escola_id"()));



CREATE POLICY "config_escola_unificado_v3" ON "public"."configuracoes_escola" TO "authenticated" USING (("escola_id" IN ( SELECT "p"."escola_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



ALTER TABLE "public"."configuracoes_curriculo" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."configuracoes_escola" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."curso_curriculos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "curso_curriculos_delete_admin" ON "public"."curso_curriculos" FOR DELETE TO "authenticated" USING ((("escola_id" = "public"."current_tenant_escola_id"()) AND "public"."user_has_role_in_school"("escola_id", ARRAY['admin_escola'::"text"])));



CREATE POLICY "curso_curriculos_insert_admin" ON "public"."curso_curriculos" FOR INSERT TO "authenticated" WITH CHECK ((("escola_id" = "public"."current_tenant_escola_id"()) AND "public"."user_has_role_in_school"("escola_id", ARRAY['admin_escola'::"text"])));



CREATE POLICY "curso_curriculos_select" ON "public"."curso_curriculos" FOR SELECT TO "authenticated" USING (("escola_id" = "public"."current_tenant_escola_id"()));



CREATE POLICY "curso_curriculos_update_admin" ON "public"."curso_curriculos" FOR UPDATE TO "authenticated" USING ((("escola_id" = "public"."current_tenant_escola_id"()) AND "public"."user_has_role_in_school"("escola_id", ARRAY['admin_escola'::"text"]))) WITH CHECK ((("escola_id" = "public"."current_tenant_escola_id"()) AND "public"."user_has_role_in_school"("escola_id", ARRAY['admin_escola'::"text"])));



ALTER TABLE "public"."curso_matriz" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "curso_matriz_insert" ON "public"."curso_matriz" FOR INSERT TO "authenticated" WITH CHECK ((("escola_id" = "public"."current_tenant_escola_id"()) AND "public"."user_has_role_in_school"("escola_id", ARRAY['admin_escola'::"text", 'secretaria'::"text", 'admin'::"text"])));



CREATE POLICY "curso_matriz_select" ON "public"."curso_matriz" FOR SELECT TO "authenticated" USING ((("escola_id" = "public"."current_tenant_escola_id"()) AND "public"."user_has_role_in_school"("escola_id", ARRAY['admin_escola'::"text", 'secretaria'::"text", 'admin'::"text"])));



CREATE POLICY "curso_matriz_update" ON "public"."curso_matriz" FOR UPDATE TO "authenticated" USING ((("escola_id" = "public"."current_tenant_escola_id"()) AND "public"."user_has_role_in_school"("escola_id", ARRAY['admin_escola'::"text", 'secretaria'::"text", 'admin'::"text"]))) WITH CHECK ((("escola_id" = "public"."current_tenant_escola_id"()) AND "public"."user_has_role_in_school"("escola_id", ARRAY['admin_escola'::"text", 'secretaria'::"text", 'admin'::"text"])));



ALTER TABLE "public"."cursos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cursos_globais_cache" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cursos_globais_insert_v3" ON "public"."cursos_globais_cache" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."role"() AS "role") = ANY (ARRAY['authenticated'::"text", 'service_role'::"text"])));



CREATE POLICY "cursos_globais_read_v2" ON "public"."cursos_globais_cache" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "cursos_select_combined" ON "public"."cursos" FOR SELECT TO "authenticated" USING ((("escola_id" IN ( SELECT "p"."escola_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."has_access_to_escola"("escola_id")));



ALTER TABLE "public"."disciplinas_catalogo" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "disciplinas_delete_policy" ON "public"."disciplinas_catalogo" FOR DELETE USING (("escola_id" = "public"."current_tenant_escola_id"()));



CREATE POLICY "disciplinas_insert_policy" ON "public"."disciplinas_catalogo" FOR INSERT WITH CHECK (("escola_id" = "public"."current_tenant_escola_id"()));



CREATE POLICY "disciplinas_select_policy" ON "public"."disciplinas_catalogo" FOR SELECT USING (("escola_id" = "public"."current_tenant_escola_id"()));



CREATE POLICY "disciplinas_update_policy" ON "public"."disciplinas_catalogo" FOR UPDATE USING (("escola_id" = "public"."current_tenant_escola_id"())) WITH CHECK (("escola_id" = "public"."current_tenant_escola_id"()));



CREATE POLICY "docs_insert_school" ON "public"."documentos_emitidos" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_super_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("p"."escola_id" = "documentos_emitidos"."escola_id") OR ("p"."current_escola_id" = "documentos_emitidos"."escola_id")))))));



CREATE POLICY "docs_select_school" ON "public"."documentos_emitidos" FOR SELECT TO "authenticated" USING (("public"."is_super_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("p"."escola_id" = "documentos_emitidos"."escola_id") OR ("p"."current_escola_id" = "documentos_emitidos"."escola_id")))))));



ALTER TABLE "public"."documentos_emitidos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."escola_administradores" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "escola_admins_unificado_v3" ON "public"."escola_administradores" TO "authenticated" USING (((( SELECT "auth"."role"() AS "role") = 'service_role'::"text") OR ("escola_id" IN ( SELECT "p"."escola_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "public"."escola_auditoria" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."escola_configuracoes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "escola_configuracoes_unificado_v3" ON "public"."escola_configuracoes" TO "authenticated" USING (("escola_id" IN ( SELECT "p"."escola_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



ALTER TABLE "public"."escola_users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "escola_users_delete" ON "public"."escola_users" FOR DELETE TO "authenticated" USING (("escola_id" = "public"."current_escola_id"()));



CREATE POLICY "escola_users_insert" ON "public"."escola_users" FOR INSERT TO "authenticated" WITH CHECK (("escola_id" = "public"."current_escola_id"()));



CREATE POLICY "escola_users_select_v3" ON "public"."escola_users" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "escola_users_update" ON "public"."escola_users" FOR UPDATE TO "authenticated" USING (("escola_id" = "public"."current_escola_id"())) WITH CHECK (("escola_id" = "public"."current_escola_id"()));



ALTER TABLE "public"."escolas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "escolas_select_combined" ON "public"."escolas" FOR SELECT TO "authenticated" USING (("public"."has_access_to_escola"("id") OR "public"."check_super_admin_role"()));



CREATE POLICY "estornos_tenant_isolation" ON "public"."financeiro_estornos" USING (("escola_id" = "public"."current_tenant_escola_id"())) WITH CHECK (("escola_id" = "public"."current_tenant_escola_id"()));



ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."finance_payment_intents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "finance_payment_intents_insert" ON "public"."finance_payment_intents" FOR INSERT TO "authenticated" WITH CHECK ("public"."can_manage_school"("escola_id"));



CREATE POLICY "finance_payment_intents_select" ON "public"."finance_payment_intents" FOR SELECT TO "authenticated" USING ("public"."can_manage_school"("escola_id"));



CREATE POLICY "finance_payment_intents_update" ON "public"."finance_payment_intents" FOR UPDATE TO "authenticated" USING ("public"."can_manage_school"("escola_id")) WITH CHECK ("public"."can_manage_school"("escola_id"));



ALTER TABLE "public"."financeiro_cobrancas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."financeiro_contratos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."financeiro_estornos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."financeiro_itens" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "financeiro_itens_unificado_v3" ON "public"."financeiro_itens" TO "authenticated" USING (("escola_id" IN ( SELECT "p"."escola_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



ALTER TABLE "public"."financeiro_lancamentos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "financeiro_lancamentos_unificado_v3" ON "public"."financeiro_lancamentos" TO "authenticated" USING (("escola_id" IN ( SELECT "p"."escola_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



ALTER TABLE "public"."financeiro_tabelas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "financeiro_tabelas_mutation" ON "public"."financeiro_tabelas" USING (("escola_id" = "public"."current_tenant_escola_id"())) WITH CHECK (("escola_id" = "public"."current_tenant_escola_id"()));



ALTER TABLE "public"."financeiro_titulos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "financeiro_titulos_delete" ON "public"."financeiro_titulos" FOR DELETE TO "authenticated" USING ((("escola_id" = "public"."current_tenant_escola_id"()) AND "public"."user_has_role_in_school"("escola_id", ARRAY['admin_escola'::"text", 'secretaria'::"text"])));



CREATE POLICY "financeiro_titulos_insert" ON "public"."financeiro_titulos" FOR INSERT TO "authenticated" WITH CHECK ((("escola_id" = "public"."current_tenant_escola_id"()) AND "public"."user_has_role_in_school"("escola_id", ARRAY['admin_escola'::"text", 'secretaria'::"text"])));



CREATE POLICY "financeiro_titulos_select" ON "public"."financeiro_titulos" FOR SELECT TO "authenticated" USING (("escola_id" = "public"."current_tenant_escola_id"()));



CREATE POLICY "financeiro_titulos_update" ON "public"."financeiro_titulos" FOR UPDATE TO "authenticated" USING ((("escola_id" = "public"."current_tenant_escola_id"()) AND "public"."user_has_role_in_school"("escola_id", ARRAY['admin_escola'::"text", 'secretaria'::"text"]))) WITH CHECK ((("escola_id" = "public"."current_tenant_escola_id"()) AND "public"."user_has_role_in_school"("escola_id", ARRAY['admin_escola'::"text", 'secretaria'::"text"])));



ALTER TABLE "public"."frequencia_status_periodo" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."frequencias" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."frequencias_2025_09" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."frequencias_2025_10" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."frequencias_2025_11" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."frequencias_2025_12" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."frequencias_2026_01" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."frequencias_2026_02" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."frequencias_default" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "frequencias_delete" ON "public"."frequencias" FOR DELETE TO "authenticated" USING ((("escola_id" = "public"."current_tenant_escola_id"()) AND "public"."user_has_role_in_school"("escola_id", ARRAY['admin_escola'::"text", 'secretaria'::"text"])));



CREATE POLICY "frequencias_insert" ON "public"."frequencias" FOR INSERT TO "authenticated" WITH CHECK ((("escola_id" = "public"."current_tenant_escola_id"()) AND "public"."user_has_role_in_school"("escola_id", ARRAY['admin_escola'::"text", 'secretaria'::"text", 'professor'::"text"])));



CREATE POLICY "frequencias_select" ON "public"."frequencias" FOR SELECT TO "authenticated" USING (("escola_id" = "public"."current_tenant_escola_id"()));



CREATE POLICY "frequencias_update" ON "public"."frequencias" FOR UPDATE TO "authenticated" USING ((("escola_id" = "public"."current_tenant_escola_id"()) AND "public"."user_has_role_in_school"("escola_id", ARRAY['admin_escola'::"text", 'secretaria'::"text", 'professor'::"text"])));



CREATE POLICY "fsp_insert_admin_only" ON "public"."frequencia_status_periodo" FOR INSERT TO "authenticated" WITH CHECK (("escola_id" IN ( SELECT "eu"."escola_id"
   FROM "public"."escola_users" "eu"
  WHERE (("eu"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("eu"."papel" = ANY (ARRAY['admin_escola'::"text", 'secretaria'::"text"]))))));



CREATE POLICY "fsp_select_same_escola" ON "public"."frequencia_status_periodo" FOR SELECT TO "authenticated" USING (("escola_id" IN ( SELECT "eu"."escola_id"
   FROM "public"."escola_users" "eu"
  WHERE ("eu"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "fsp_update_admin_only" ON "public"."frequencia_status_periodo" FOR UPDATE TO "authenticated" USING (("escola_id" IN ( SELECT "eu"."escola_id"
   FROM "public"."escola_users" "eu"
  WHERE (("eu"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("eu"."papel" = ANY (ARRAY['admin_escola'::"text", 'secretaria'::"text"])))))) WITH CHECK (("escola_id" IN ( SELECT "eu"."escola_id"
   FROM "public"."escola_users" "eu"
  WHERE (("eu"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("eu"."papel" = ANY (ARRAY['admin_escola'::"text", 'secretaria'::"text"]))))));



ALTER TABLE "public"."historico_anos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."historico_disciplinas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."import_errors" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "import_errors_service_full" ON "public"."import_errors" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "import_errors_staff_read" ON "public"."import_errors" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."import_migrations" "m"
  WHERE (("m"."id" = "import_errors"."import_id") AND "public"."is_staff_escola"("m"."escola_id")))));



CREATE POLICY "import_errors_staff_write" ON "public"."import_errors" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."import_migrations" "m"
  WHERE (("m"."id" = "import_errors"."import_id") AND "public"."is_staff_escola"("m"."escola_id")))));



ALTER TABLE "public"."import_migrations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "import_migrations_service_full" ON "public"."import_migrations" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "import_migrations_staff_read" ON "public"."import_migrations" FOR SELECT TO "authenticated" USING ("public"."is_staff_escola"("escola_id"));



CREATE POLICY "import_migrations_staff_update" ON "public"."import_migrations" FOR UPDATE TO "authenticated" USING ("public"."is_staff_escola"("escola_id")) WITH CHECK ("public"."is_staff_escola"("escola_id"));



CREATE POLICY "import_migrations_staff_write" ON "public"."import_migrations" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_staff_escola"("escola_id"));



ALTER TABLE "public"."lancamentos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lancamentos_2025_09" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lancamentos_2025_10" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lancamentos_2025_11" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lancamentos_2025_12" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lancamentos_2026_01" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lancamentos_2026_02" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lancamentos_default" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."matricula_counters" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."matriculas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."matriculas_cursos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "matriculas_delete_staff_v3" ON "public"."matriculas" FOR DELETE TO "authenticated" USING ("public"."is_staff_escola"("escola_id"));



CREATE POLICY "matriculas_insert_staff_v3" ON "public"."matriculas" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_staff_escola"("escola_id"));



CREATE POLICY "matriculas_select_combined" ON "public"."matriculas" FOR SELECT TO "authenticated" USING ((("escola_id" IN ( SELECT "p"."escola_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."has_access_to_escola"("escola_id")));



CREATE POLICY "matriculas_update_staff_v3" ON "public"."matriculas" FOR UPDATE TO "authenticated" USING ("public"."is_staff_escola"("escola_id")) WITH CHECK ("public"."is_staff_escola"("escola_id"));



ALTER TABLE "public"."mensalidades" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "mensalidades_unificado_v3" ON "public"."mensalidades" TO "authenticated" USING (("escola_id" IN ( SELECT "p"."escola_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



ALTER TABLE "public"."notas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notas_avaliacoes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notas_delete" ON "public"."notas" FOR DELETE TO "authenticated" USING ((("escola_id" = "public"."current_tenant_escola_id"()) AND "public"."user_has_role_in_school"("escola_id", ARRAY['admin_escola'::"text", 'secretaria'::"text", 'professor'::"text"])));



CREATE POLICY "notas_insert" ON "public"."notas" FOR INSERT TO "authenticated" WITH CHECK ((("escola_id" = "public"."current_tenant_escola_id"()) AND "public"."user_has_role_in_school"("escola_id", ARRAY['admin_escola'::"text", 'secretaria'::"text", 'professor'::"text"])));



CREATE POLICY "notas_select" ON "public"."notas" FOR SELECT TO "authenticated" USING (("escola_id" = "public"."current_tenant_escola_id"()));



CREATE POLICY "notas_update" ON "public"."notas" FOR UPDATE TO "authenticated" USING ((("escola_id" = "public"."current_tenant_escola_id"()) AND "public"."user_has_role_in_school"("escola_id", ARRAY['admin_escola'::"text", 'secretaria'::"text", 'professor'::"text"]))) WITH CHECK ((("escola_id" = "public"."current_tenant_escola_id"()) AND "public"."user_has_role_in_school"("escola_id", ARRAY['admin_escola'::"text", 'secretaria'::"text", 'professor'::"text"])));



ALTER TABLE "public"."notices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications_delete_staff" ON "public"."notifications" FOR DELETE TO "authenticated" USING ("public"."is_staff_escola"("escola_id"));



CREATE POLICY "notifications_insert_staff" ON "public"."notifications" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_staff_escola"("escola_id"));



CREATE POLICY "notifications_select_membro" ON "public"."notifications" FOR SELECT TO "authenticated" USING ("public"."is_membro_escola"("escola_id"));



CREATE POLICY "notifications_update_membro" ON "public"."notifications" FOR UPDATE TO "authenticated" USING ("public"."is_membro_escola"("escola_id")) WITH CHECK ("public"."is_membro_escola"("escola_id"));



ALTER TABLE "public"."onboarding_drafts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "onboarding_drafts_select_opt" ON "public"."onboarding_drafts" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."outbox_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "outbox_events_insert" ON "public"."outbox_events" FOR INSERT TO "authenticated" WITH CHECK ("public"."can_manage_school"("escola_id"));



ALTER TABLE "public"."outbox_notificacoes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pagamentos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pagamentos_delete" ON "public"."pagamentos" FOR DELETE TO "authenticated" USING ((("escola_id" = "public"."current_tenant_escola_id"()) AND "public"."user_has_role_in_school"("escola_id", ARRAY['admin_escola'::"text", 'secretaria'::"text"])));



CREATE POLICY "pagamentos_insert" ON "public"."pagamentos" FOR INSERT TO "authenticated" WITH CHECK ((("escola_id" = "public"."current_tenant_escola_id"()) AND "public"."user_has_role_in_school"("escola_id", ARRAY['admin_escola'::"text", 'secretaria'::"text"])));



CREATE POLICY "pagamentos_select" ON "public"."pagamentos" FOR SELECT TO "authenticated" USING (("escola_id" = "public"."current_tenant_escola_id"()));



CREATE POLICY "pagamentos_update" ON "public"."pagamentos" FOR UPDATE TO "authenticated" USING ((("escola_id" = "public"."current_tenant_escola_id"()) AND "public"."user_has_role_in_school"("escola_id", ARRAY['admin_escola'::"text", 'secretaria'::"text"]))) WITH CHECK ((("escola_id" = "public"."current_tenant_escola_id"()) AND "public"."user_has_role_in_school"("escola_id", ARRAY['admin_escola'::"text", 'secretaria'::"text"])));



ALTER TABLE "public"."periodos_letivos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "periodos_letivos_select" ON "public"."periodos_letivos" FOR SELECT TO "authenticated" USING (("escola_id" = "public"."current_tenant_escola_id"()));



ALTER TABLE "public"."permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."presencas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."professores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles_archive" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_select_unificado_final" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR (("escola_id" IS NOT NULL) AND ("escola_id" = "public"."get_my_escola_id"())) OR "public"."is_super_admin"()));



CREATE POLICY "profiles_update_opt" ON "public"."profiles" FOR UPDATE USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."check_super_admin_role"()));



ALTER TABLE "public"."regras_escala" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rotinas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."secoes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sistemas_notas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staging_alunos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "staging_alunos_service_full" ON "public"."staging_alunos" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "staging_alunos_staff_read" ON "public"."staging_alunos" FOR SELECT TO "authenticated" USING ("public"."is_staff_escola"("escola_id"));



CREATE POLICY "staging_alunos_staff_write" ON "public"."staging_alunos" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_staff_escola"("escola_id"));



ALTER TABLE "public"."syllabi" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tabelas_mens_unificado" ON "public"."tabelas_mensalidade" TO "authenticated" USING (("escola_id" IN ( SELECT "p"."escola_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



ALTER TABLE "public"."tabelas_mensalidade" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tdp_delete_staff" ON "public"."turma_disciplinas_professores" FOR DELETE TO "authenticated" USING ("public"."is_staff_escola"("escola_id"));



CREATE POLICY "tdp_insert_staff" ON "public"."turma_disciplinas_professores" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_staff_escola"("escola_id"));



CREATE POLICY "tdp_select_membro" ON "public"."turma_disciplinas_professores" FOR SELECT TO "authenticated" USING ("public"."is_membro_escola"("escola_id"));



CREATE POLICY "tdp_update_staff" ON "public"."turma_disciplinas_professores" FOR UPDATE TO "authenticated" USING ("public"."is_staff_escola"("escola_id")) WITH CHECK ("public"."is_staff_escola"("escola_id"));



CREATE POLICY "tenant_isolation" ON "public"."atribuicoes_prof" USING (("escola_id" = "public"."current_tenant_escola_id"())) WITH CHECK (("escola_id" = "public"."current_tenant_escola_id"()));



CREATE POLICY "tenant_isolation" ON "public"."events" USING (("escola_id" = "public"."current_tenant_escola_id"())) WITH CHECK (("escola_id" = "public"."current_tenant_escola_id"()));



CREATE POLICY "tenant_isolation" ON "public"."lancamentos" USING (("escola_id" = "public"."current_tenant_escola_id"())) WITH CHECK (("escola_id" = "public"."current_tenant_escola_id"()));



CREATE POLICY "tenant_isolation" ON "public"."matriculas_cursos" USING (("escola_id" = "public"."current_tenant_escola_id"())) WITH CHECK (("escola_id" = "public"."current_tenant_escola_id"()));



CREATE POLICY "tenant_isolation" ON "public"."notices" USING (("escola_id" = "public"."current_tenant_escola_id"())) WITH CHECK (("escola_id" = "public"."current_tenant_escola_id"()));



CREATE POLICY "tenant_isolation" ON "public"."regras_escala" USING (("escola_id" = "public"."current_tenant_escola_id"())) WITH CHECK (("escola_id" = "public"."current_tenant_escola_id"()));



CREATE POLICY "tenant_isolation" ON "public"."rotinas" USING (("escola_id" = "public"."current_tenant_escola_id"())) WITH CHECK (("escola_id" = "public"."current_tenant_escola_id"()));



CREATE POLICY "tenant_isolation" ON "public"."sistemas_notas" USING (("escola_id" = "public"."current_tenant_escola_id"())) WITH CHECK (("escola_id" = "public"."current_tenant_escola_id"()));



CREATE POLICY "tenant_isolation" ON "public"."syllabi" USING (("escola_id" = "public"."current_tenant_escola_id"())) WITH CHECK (("escola_id" = "public"."current_tenant_escola_id"()));



CREATE POLICY "tenant_select" ON "public"."turmas" FOR SELECT TO "authenticated" USING ("public"."has_access_to_escola"("escola_id"));



ALTER TABLE "public"."turma_disciplinas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "turma_disciplinas_insert" ON "public"."turma_disciplinas" FOR INSERT TO "authenticated" WITH CHECK ((("escola_id" = "public"."current_tenant_escola_id"()) AND "public"."user_has_role_in_school"("escola_id", ARRAY['admin_escola'::"text", 'secretaria'::"text", 'admin'::"text"])));



ALTER TABLE "public"."turma_disciplinas_professores" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "turma_disciplinas_select" ON "public"."turma_disciplinas" FOR SELECT TO "authenticated" USING ((("escola_id" = "public"."current_tenant_escola_id"()) AND "public"."user_has_role_in_school"("escola_id", ARRAY['admin_escola'::"text", 'secretaria'::"text", 'admin'::"text"])));



CREATE POLICY "turma_disciplinas_update" ON "public"."turma_disciplinas" FOR UPDATE TO "authenticated" USING ((("escola_id" = "public"."current_tenant_escola_id"()) AND "public"."user_has_role_in_school"("escola_id", ARRAY['admin_escola'::"text", 'secretaria'::"text", 'admin'::"text"]))) WITH CHECK ((("escola_id" = "public"."current_tenant_escola_id"()) AND "public"."user_has_role_in_school"("escola_id", ARRAY['admin_escola'::"text", 'secretaria'::"text", 'admin'::"text"])));



ALTER TABLE "public"."turmas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."turmas_auditoria" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "turmas_delete" ON "public"."turmas" FOR DELETE TO "authenticated" USING ((("escola_id" = "public"."current_tenant_escola_id"()) AND "public"."user_has_role_in_school"("escola_id", ARRAY['admin_escola'::"text", 'secretaria'::"text"])));



CREATE POLICY "turmas_insert" ON "public"."turmas" FOR INSERT TO "authenticated" WITH CHECK ((("escola_id" = "public"."current_tenant_escola_id"()) AND "public"."user_has_role_in_school"("escola_id", ARRAY['admin_escola'::"text", 'secretaria'::"text"])));



CREATE POLICY "turmas_update" ON "public"."turmas" FOR UPDATE TO "authenticated" USING ((("escola_id" = "public"."current_tenant_escola_id"()) AND "public"."user_has_role_in_school"("escola_id", ARRAY['admin_escola'::"text", 'secretaria'::"text"]))) WITH CHECK ((("escola_id" = "public"."current_tenant_escola_id"()) AND "public"."user_has_role_in_school"("escola_id", ARRAY['admin_escola'::"text", 'secretaria'::"text"])));



CREATE POLICY "unified_delete_escolas" ON "public"."escolas" FOR DELETE USING ("public"."check_super_admin_role"());



CREATE POLICY "unified_delete_frequencias" ON "public"."frequencias_2025_09" FOR DELETE USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_delete_frequencias" ON "public"."frequencias_2025_10" FOR DELETE USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_delete_frequencias" ON "public"."frequencias_2025_11" FOR DELETE USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_delete_frequencias" ON "public"."frequencias_2025_12" FOR DELETE USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_delete_frequencias" ON "public"."frequencias_2026_01" FOR DELETE USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_delete_frequencias" ON "public"."frequencias_2026_02" FOR DELETE USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_delete_frequencias" ON "public"."frequencias_default" FOR DELETE USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_delete_lancamentos" ON "public"."lancamentos_2025_09" FOR DELETE USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_delete_lancamentos" ON "public"."lancamentos_2025_10" FOR DELETE USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_delete_lancamentos" ON "public"."lancamentos_2025_11" FOR DELETE USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_delete_lancamentos" ON "public"."lancamentos_2025_12" FOR DELETE USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_delete_lancamentos" ON "public"."lancamentos_2026_01" FOR DELETE USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_delete_lancamentos" ON "public"."lancamentos_2026_02" FOR DELETE USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_delete_lancamentos" ON "public"."lancamentos_default" FOR DELETE USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_insert_escolas" ON "public"."escolas" FOR INSERT WITH CHECK ("public"."check_super_admin_role"());



CREATE POLICY "unified_insert_frequencias" ON "public"."frequencias_2025_09" FOR INSERT WITH CHECK (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_insert_frequencias" ON "public"."frequencias_2025_10" FOR INSERT WITH CHECK (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_insert_frequencias" ON "public"."frequencias_2025_11" FOR INSERT WITH CHECK (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_insert_frequencias" ON "public"."frequencias_2025_12" FOR INSERT WITH CHECK (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_insert_frequencias" ON "public"."frequencias_2026_01" FOR INSERT WITH CHECK (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_insert_frequencias" ON "public"."frequencias_2026_02" FOR INSERT WITH CHECK (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_insert_frequencias" ON "public"."frequencias_default" FOR INSERT WITH CHECK (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_insert_lancamentos" ON "public"."lancamentos_2025_09" FOR INSERT WITH CHECK (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_insert_lancamentos" ON "public"."lancamentos_2025_10" FOR INSERT WITH CHECK (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_insert_lancamentos" ON "public"."lancamentos_2025_11" FOR INSERT WITH CHECK (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_insert_lancamentos" ON "public"."lancamentos_2025_12" FOR INSERT WITH CHECK (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_insert_lancamentos" ON "public"."lancamentos_2026_01" FOR INSERT WITH CHECK (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_insert_lancamentos" ON "public"."lancamentos_2026_02" FOR INSERT WITH CHECK (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_insert_lancamentos" ON "public"."lancamentos_default" FOR INSERT WITH CHECK (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_select_frequencias" ON "public"."frequencias_2025_09" FOR SELECT USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_select_frequencias" ON "public"."frequencias_2025_10" FOR SELECT USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_select_frequencias" ON "public"."frequencias_2025_11" FOR SELECT USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_select_frequencias" ON "public"."frequencias_2025_12" FOR SELECT USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_select_frequencias" ON "public"."frequencias_2026_01" FOR SELECT USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_select_frequencias" ON "public"."frequencias_2026_02" FOR SELECT USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_select_frequencias" ON "public"."frequencias_default" FOR SELECT USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_select_lancamentos" ON "public"."lancamentos_2025_09" FOR SELECT USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_select_lancamentos" ON "public"."lancamentos_2025_10" FOR SELECT USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_select_lancamentos" ON "public"."lancamentos_2025_11" FOR SELECT USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_select_lancamentos" ON "public"."lancamentos_2025_12" FOR SELECT USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_select_lancamentos" ON "public"."lancamentos_2026_01" FOR SELECT USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_select_lancamentos" ON "public"."lancamentos_2026_02" FOR SELECT USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_select_lancamentos" ON "public"."lancamentos_default" FOR SELECT USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_update_escolas" ON "public"."escolas" FOR UPDATE USING ("public"."check_super_admin_role"()) WITH CHECK ("public"."check_super_admin_role"());



CREATE POLICY "unified_update_frequencias" ON "public"."frequencias_2025_09" FOR UPDATE USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id"))) WITH CHECK (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_update_frequencias" ON "public"."frequencias_2025_10" FOR UPDATE USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id"))) WITH CHECK (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_update_frequencias" ON "public"."frequencias_2025_11" FOR UPDATE USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id"))) WITH CHECK (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_update_frequencias" ON "public"."frequencias_2025_12" FOR UPDATE USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id"))) WITH CHECK (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_update_frequencias" ON "public"."frequencias_2026_01" FOR UPDATE USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id"))) WITH CHECK (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_update_frequencias" ON "public"."frequencias_2026_02" FOR UPDATE USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id"))) WITH CHECK (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_update_frequencias" ON "public"."frequencias_default" FOR UPDATE USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id"))) WITH CHECK (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_update_lancamentos" ON "public"."lancamentos_2025_09" FOR UPDATE USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id"))) WITH CHECK (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_update_lancamentos" ON "public"."lancamentos_2025_10" FOR UPDATE USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id"))) WITH CHECK (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_update_lancamentos" ON "public"."lancamentos_2025_11" FOR UPDATE USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id"))) WITH CHECK (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_update_lancamentos" ON "public"."lancamentos_2025_12" FOR UPDATE USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id"))) WITH CHECK (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_update_lancamentos" ON "public"."lancamentos_2026_01" FOR UPDATE USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id"))) WITH CHECK (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_update_lancamentos" ON "public"."lancamentos_2026_02" FOR UPDATE USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id"))) WITH CHECK (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));



CREATE POLICY "unified_update_lancamentos" ON "public"."lancamentos_default" FOR UPDATE USING (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id"))) WITH CHECK (("public"."is_escola_admin"("escola_id") OR "public"."is_escola_member"("escola_id")));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."outbox_notificacoes";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";
















































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































GRANT ALL ON FUNCTION "public"."_each_month"("start_date" "date", "end_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."_each_month"("start_date" "date", "end_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_each_month"("start_date" "date", "end_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."_guard_candidaturas_status_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."_guard_candidaturas_status_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_guard_candidaturas_status_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."activate_aluno_after_matricula"() TO "anon";
GRANT ALL ON FUNCTION "public"."activate_aluno_after_matricula"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."activate_aluno_after_matricula"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."admissao_approve"("p_escola_id" "uuid", "p_candidatura_id" "uuid", "p_observacao" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admissao_approve"("p_escola_id" "uuid", "p_candidatura_id" "uuid", "p_observacao" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admissao_approve"("p_escola_id" "uuid", "p_candidatura_id" "uuid", "p_observacao" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admissao_approve"("p_escola_id" "uuid", "p_candidatura_id" "uuid", "p_observacao" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admissao_archive"("p_escola_id" "uuid", "p_candidatura_id" "uuid", "p_motivo" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admissao_archive"("p_escola_id" "uuid", "p_candidatura_id" "uuid", "p_motivo" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admissao_archive"("p_escola_id" "uuid", "p_candidatura_id" "uuid", "p_motivo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admissao_archive"("p_escola_id" "uuid", "p_candidatura_id" "uuid", "p_motivo" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."admissao_convert"("p_candidatura_id" "uuid", "p_turma_id" "uuid", "p_metodo_pagamento" "text", "p_comprovativo_url" "text", "p_amount" numeric, "p_idempotency_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admissao_convert"("p_candidatura_id" "uuid", "p_turma_id" "uuid", "p_metodo_pagamento" "text", "p_comprovativo_url" "text", "p_amount" numeric, "p_idempotency_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admissao_convert"("p_candidatura_id" "uuid", "p_turma_id" "uuid", "p_metodo_pagamento" "text", "p_comprovativo_url" "text", "p_amount" numeric, "p_idempotency_key" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admissao_convert_to_matricula"("p_escola_id" "uuid", "p_candidatura_id" "uuid", "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admissao_convert_to_matricula"("p_escola_id" "uuid", "p_candidatura_id" "uuid", "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."admissao_convert_to_matricula"("p_escola_id" "uuid", "p_candidatura_id" "uuid", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admissao_convert_to_matricula"("p_escola_id" "uuid", "p_candidatura_id" "uuid", "p_metadata" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admissao_reject"("p_escola_id" "uuid", "p_candidatura_id" "uuid", "p_motivo" "text", "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admissao_reject"("p_escola_id" "uuid", "p_candidatura_id" "uuid", "p_motivo" "text", "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."admissao_reject"("p_escola_id" "uuid", "p_candidatura_id" "uuid", "p_motivo" "text", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admissao_reject"("p_escola_id" "uuid", "p_candidatura_id" "uuid", "p_motivo" "text", "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."admissao_submit"("p_escola_id" "uuid", "p_candidatura_id" "uuid", "p_source" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admissao_submit"("p_escola_id" "uuid", "p_candidatura_id" "uuid", "p_source" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admissao_submit"("p_escola_id" "uuid", "p_candidatura_id" "uuid", "p_source" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admissao_unsubmit"("p_escola_id" "uuid", "p_candidatura_id" "uuid", "p_motivo" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admissao_unsubmit"("p_escola_id" "uuid", "p_candidatura_id" "uuid", "p_motivo" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admissao_unsubmit"("p_escola_id" "uuid", "p_candidatura_id" "uuid", "p_motivo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admissao_unsubmit"("p_escola_id" "uuid", "p_candidatura_id" "uuid", "p_motivo" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."admissao_upsert_draft"("p_escola_id" "uuid", "p_candidatura_id" "uuid", "p_source" "text", "p_dados_candidato" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."admissao_upsert_draft"("p_escola_id" "uuid", "p_candidatura_id" "uuid", "p_source" "text", "p_dados_candidato" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admissao_upsert_draft"("p_escola_id" "uuid", "p_candidatura_id" "uuid", "p_source" "text", "p_dados_candidato" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."aprovar_turmas"("p_turma_ids" "uuid"[], "p_escola_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."aprovar_turmas"("p_turma_ids" "uuid"[], "p_escola_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."aprovar_turmas"("p_turma_ids" "uuid"[], "p_escola_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."aprovar_turmas"("p_escola_id" "uuid", "p_turma_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."aprovar_turmas"("p_escola_id" "uuid", "p_turma_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."aprovar_turmas"("p_escola_id" "uuid", "p_turma_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."assert_course_class_range"("p_curriculum_key" "text", "p_class_num" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."assert_course_class_range"("p_curriculum_key" "text", "p_class_num" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."assert_course_class_range"("p_curriculum_key" "text", "p_class_num" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."atualiza_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."atualiza_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."atualiza_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."audit_dml_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."audit_dml_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."audit_dml_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."audit_redact_jsonb"("p_entity" "text", "p_payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."audit_redact_jsonb"("p_entity" "text", "p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."audit_redact_jsonb"("p_entity" "text", "p_payload" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."audit_request_context"() TO "anon";
GRANT ALL ON FUNCTION "public"."audit_request_context"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."audit_request_context"() TO "service_role";



GRANT ALL ON FUNCTION "public"."before_insert_alunos_set_processo"() TO "anon";
GRANT ALL ON FUNCTION "public"."before_insert_alunos_set_processo"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."before_insert_alunos_set_processo"() TO "service_role";



GRANT ALL ON FUNCTION "public"."block_frequencias_after_close"() TO "anon";
GRANT ALL ON FUNCTION "public"."block_frequencias_after_close"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."block_frequencias_after_close"() TO "service_role";



GRANT ALL ON FUNCTION "public"."can_access"("eid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_access"("eid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_access"("eid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_manage_school"("p_escola_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_manage_school"("p_escola_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_manage_school"("p_escola_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_professor_school"("p_escola_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_professor_school"("p_escola_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_professor_school"("p_escola_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."canonicalize_matricula_status_text"("input" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."canonicalize_matricula_status_text"("input" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."canonicalize_matricula_status_text"("input" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_super_admin_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_super_admin_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_super_admin_role"() TO "service_role";



GRANT ALL ON TABLE "public"."outbox_events" TO "anon";
GRANT ALL ON TABLE "public"."outbox_events" TO "authenticated";
GRANT ALL ON TABLE "public"."outbox_events" TO "service_role";



GRANT ALL ON FUNCTION "public"."claim_outbox_events"("p_topic" "text", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."claim_outbox_events"("p_topic" "text", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_outbox_events"("p_topic" "text", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."confirmar_matricula"("p_matricula_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."confirmar_matricula"("p_matricula_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."confirmar_matricula"("p_matricula_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."confirmar_matricula_core"("p_candidatura_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."confirmar_matricula_core"("p_candidatura_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."confirmar_matricula_core"("p_candidatura_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."confirmar_matricula_core"("p_aluno_id" "uuid", "p_ano_letivo" integer, "p_turma_id" "uuid", "p_matricula_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."confirmar_matricula_core"("p_aluno_id" "uuid", "p_ano_letivo" integer, "p_turma_id" "uuid", "p_matricula_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."confirmar_matricula_core"("p_aluno_id" "uuid", "p_ano_letivo" integer, "p_turma_id" "uuid", "p_matricula_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_audit_event"("p_escola_id" "uuid", "p_action" "text", "p_entity" "text", "p_entity_id" "text", "p_before" "jsonb", "p_after" "jsonb", "p_portal" "text", "p_details" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_audit_event"("p_escola_id" "uuid", "p_action" "text", "p_entity" "text", "p_entity_id" "text", "p_before" "jsonb", "p_after" "jsonb", "p_portal" "text", "p_details" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_audit_event"("p_escola_id" "uuid", "p_action" "text", "p_entity" "text", "p_entity_id" "text", "p_before" "jsonb", "p_after" "jsonb", "p_portal" "text", "p_details" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_escola_with_admin"("p_nome" "text", "p_nif" "text", "p_endereco" "text", "p_admin_email" "text", "p_admin_telefone" "text", "p_admin_nome" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_escola_with_admin"("p_nome" "text", "p_nif" "text", "p_endereco" "text", "p_admin_email" "text", "p_admin_telefone" "text", "p_admin_nome" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_escola_with_admin"("p_nome" "text", "p_nif" "text", "p_endereco" "text", "p_admin_email" "text", "p_admin_telefone" "text", "p_admin_nome" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_month_partition"("tbl" "text", "month_start" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."create_month_partition"("tbl" "text", "month_start" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_month_partition"("tbl" "text", "month_start" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_month_partition_ts"("tbl" "text", "month_start" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."create_month_partition_ts"("tbl" "text", "month_start" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_month_partition_ts"("tbl" "text", "month_start" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_or_confirm_matricula"("p_aluno_id" "uuid", "p_turma_id" "uuid", "p_ano_letivo" integer, "p_matricula_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_or_confirm_matricula"("p_aluno_id" "uuid", "p_turma_id" "uuid", "p_ano_letivo" integer, "p_matricula_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_or_confirm_matricula"("p_aluno_id" "uuid", "p_turma_id" "uuid", "p_ano_letivo" integer, "p_matricula_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_or_confirm_matricula"("p_aluno_id" "uuid", "p_turma_id" "uuid", "p_ano_letivo" integer, "p_matricula_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."turmas" TO "anon";
GRANT ALL ON TABLE "public"."turmas" TO "authenticated";
GRANT ALL ON TABLE "public"."turmas" TO "service_role";



GRANT ALL ON FUNCTION "public"."create_or_get_turma_by_code"("p_escola_id" "uuid", "p_ano_letivo" integer, "p_turma_code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_or_get_turma_by_code"("p_escola_id" "uuid", "p_ano_letivo" integer, "p_turma_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_or_get_turma_by_code"("p_escola_id" "uuid", "p_ano_letivo" integer, "p_turma_code" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."current_escola_id"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."current_escola_id"() TO "service_role";
GRANT ALL ON FUNCTION "public"."current_escola_id"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."current_tenant_escola_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_tenant_escola_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_tenant_escola_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."current_user_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_user_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_user_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."current_user_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_user_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_user_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."curriculo_publish"("p_escola_id" "uuid", "p_curso_id" "uuid", "p_ano_letivo_id" "uuid", "p_version" integer, "p_rebuild_turmas" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."curriculo_publish"("p_escola_id" "uuid", "p_curso_id" "uuid", "p_ano_letivo_id" "uuid", "p_version" integer, "p_rebuild_turmas" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."curriculo_publish"("p_escola_id" "uuid", "p_curso_id" "uuid", "p_ano_letivo_id" "uuid", "p_version" integer, "p_rebuild_turmas" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."curriculo_rebuild_turma_disciplinas"("p_escola_id" "uuid", "p_curso_id" "uuid", "p_ano_letivo_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."curriculo_rebuild_turma_disciplinas"("p_escola_id" "uuid", "p_curso_id" "uuid", "p_ano_letivo_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."curriculo_rebuild_turma_disciplinas"("p_escola_id" "uuid", "p_curso_id" "uuid", "p_ano_letivo_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."curso_curriculos_force_fields"() TO "anon";
GRANT ALL ON FUNCTION "public"."curso_curriculos_force_fields"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."curso_curriculos_force_fields"() TO "service_role";



GRANT ALL ON FUNCTION "public"."curso_matriz_assert_same_escola"() TO "anon";
GRANT ALL ON FUNCTION "public"."curso_matriz_assert_same_escola"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."curso_matriz_assert_same_escola"() TO "service_role";



GRANT ALL ON FUNCTION "public"."curso_matriz_fill_curriculo_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."curso_matriz_fill_curriculo_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."curso_matriz_fill_curriculo_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."dashboard"() TO "anon";
GRANT ALL ON FUNCTION "public"."dashboard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."dashboard"() TO "service_role";



GRANT ALL ON FUNCTION "public"."emitir_recibo"("p_mensalidade_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."emitir_recibo"("p_mensalidade_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."emitir_recibo"("p_mensalidade_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_avaliacoes_consistency"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_avaliacoes_consistency"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_avaliacoes_consistency"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_matriculas_tenant_consistency"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_matriculas_tenant_consistency"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_matriculas_tenant_consistency"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_notas_consistency"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_notas_consistency"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_notas_consistency"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_pagamentos_tenant_consistency"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_pagamentos_tenant_consistency"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_pagamentos_tenant_consistency"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_turma_disciplina_consistency"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_turma_disciplina_consistency"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_turma_disciplina_consistency"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enqueue_outbox_event"("p_escola_id" "uuid", "p_topic" "text", "p_payload" "jsonb", "p_request_id" "uuid", "p_idempotency_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."enqueue_outbox_event"("p_escola_id" "uuid", "p_topic" "text", "p_payload" "jsonb", "p_request_id" "uuid", "p_idempotency_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."enqueue_outbox_event"("p_escola_id" "uuid", "p_topic" "text", "p_payload" "jsonb", "p_request_id" "uuid", "p_idempotency_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."enqueue_outbox_event_professor"("p_escola_id" "uuid", "p_event_type" "text", "p_payload" "jsonb", "p_idempotency_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."enqueue_outbox_event_professor"("p_escola_id" "uuid", "p_event_type" "text", "p_payload" "jsonb", "p_idempotency_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."enqueue_outbox_event_professor"("p_escola_id" "uuid", "p_event_type" "text", "p_payload" "jsonb", "p_idempotency_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_aluno_from_escola_usuario"() TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_aluno_from_escola_usuario"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_aluno_from_escola_usuario"() TO "service_role";



GRANT ALL ON FUNCTION "public"."escola_has_feature"("p_escola_id" "uuid", "p_feature" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."escola_has_feature"("p_escola_id" "uuid", "p_feature" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."escola_has_feature"("p_escola_id" "uuid", "p_feature" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."estornar_mensalidade"("p_mensalidade_id" "uuid", "p_motivo" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."estornar_mensalidade"("p_mensalidade_id" "uuid", "p_motivo" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."estornar_mensalidade"("p_mensalidade_id" "uuid", "p_motivo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."estornar_mensalidade"("p_mensalidade_id" "uuid", "p_motivo" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fill_frequencias_periodo_letivo"() TO "anon";
GRANT ALL ON FUNCTION "public"."fill_frequencias_periodo_letivo"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fill_frequencias_periodo_letivo"() TO "service_role";



GRANT ALL ON TABLE "public"."finance_payment_intents" TO "anon";
GRANT ALL ON TABLE "public"."finance_payment_intents" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_payment_intents" TO "service_role";



GRANT ALL ON FUNCTION "public"."finance_confirm_payment"("p_intent_id" "uuid", "p_dedupe_key_override" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."finance_confirm_payment"("p_intent_id" "uuid", "p_dedupe_key_override" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."finance_confirm_payment"("p_intent_id" "uuid", "p_dedupe_key_override" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."frequencia_resumo_periodo"("p_turma_id" "uuid", "p_periodo_letivo_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."frequencia_resumo_periodo"("p_turma_id" "uuid", "p_periodo_letivo_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."frequencia_resumo_periodo"("p_turma_id" "uuid", "p_periodo_letivo_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_activation_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_activation_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_activation_code"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_unique_numero_login"("p_escola_id" "uuid", "p_role" "public"."user_role", "p_prefix" "text", "p_start" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."generate_unique_numero_login"("p_escola_id" "uuid", "p_role" "public"."user_role", "p_prefix" "text", "p_start" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_unique_numero_login"("p_escola_id" "uuid", "p_role" "public"."user_role", "p_prefix" "text", "p_start" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."gerar_mensalidades_lote"("p_escola_id" "uuid", "p_ano_letivo" integer, "p_mes_referencia" integer, "p_dia_vencimento_default" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."gerar_mensalidades_lote"("p_escola_id" "uuid", "p_ano_letivo" integer, "p_mes_referencia" integer, "p_dia_vencimento_default" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."gerar_mensalidades_lote"("p_escola_id" "uuid", "p_ano_letivo" integer, "p_mes_referencia" integer, "p_dia_vencimento_default" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."gerar_mensalidades_lote"("p_escola_id" "uuid", "p_ano_letivo" integer, "p_mes_referencia" integer, "p_dia_vencimento_default" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."gerar_mensalidades_lote"("p_escola_id" "uuid", "p_ano_letivo" integer, "p_mes_referencia" integer, "p_dia_vencimento_default" integer, "p_turma_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."gerar_mensalidades_lote"("p_escola_id" "uuid", "p_ano_letivo" integer, "p_mes_referencia" integer, "p_dia_vencimento_default" integer, "p_turma_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."gerar_mensalidades_lote"("p_escola_id" "uuid", "p_ano_letivo" integer, "p_mes_referencia" integer, "p_dia_vencimento_default" integer, "p_turma_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gerar_mensalidades_lote"("p_escola_id" "uuid", "p_ano_letivo" integer, "p_mes_referencia" integer, "p_dia_vencimento_default" integer, "p_turma_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_aluno_dossier"("p_escola_id" "uuid", "p_aluno_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_aluno_dossier"("p_escola_id" "uuid", "p_aluno_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_aluno_dossier"("p_escola_id" "uuid", "p_aluno_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_aluno_dossier"("p_escola_id" "uuid", "p_aluno_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_classes_sem_preco"("p_escola_id" "uuid", "p_ano_letivo" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_classes_sem_preco"("p_escola_id" "uuid", "p_ano_letivo" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_classes_sem_preco"("p_escola_id" "uuid", "p_ano_letivo" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_import_summary"("p_import_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_import_summary"("p_import_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_import_summary"("p_import_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_metricas_acesso_alunos"("p_escola_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_metricas_acesso_alunos"("p_escola_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_metricas_acesso_alunos"("p_escola_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_escola_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_escola_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_escola_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_escola_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_escola_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_escola_ids"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_outbox_status_summary"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_outbox_status_summary"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_outbox_status_summary"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_outbox_status_summary"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_pending_turmas_count"("p_escola_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_pending_turmas_count"("p_escola_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_pending_turmas_count"("p_escola_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_profile_dependencies"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_profile_dependencies"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_profile_dependencies"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_propinas_por_turma"("p_ano_letivo" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_propinas_por_turma"("p_ano_letivo" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_propinas_por_turma"("p_ano_letivo" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_recent_cron_runs"("p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_recent_cron_runs"("p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_recent_cron_runs"("p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_recent_cron_runs"("p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_staging_alunos_summary"("p_import_id" "uuid", "p_escola_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_staging_alunos_summary"("p_import_id" "uuid", "p_escola_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_staging_alunos_summary"("p_import_id" "uuid", "p_escola_id" "uuid") TO "service_role";



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



GRANT ALL ON FUNCTION "public"."guard_matricula_status_numero"() TO "anon";
GRANT ALL ON FUNCTION "public"."guard_matricula_status_numero"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."guard_matricula_status_numero"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."hard_delete_aluno"("p_aluno_id" "uuid", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hard_delete_aluno"("p_aluno_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hard_delete_aluno"("p_aluno_id" "uuid", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hard_delete_curso"("p_curso_id" "uuid", "p_escola_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."hard_delete_curso"("p_curso_id" "uuid", "p_escola_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hard_delete_curso"("p_curso_id" "uuid", "p_escola_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_access_to_escola"("_escola_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."has_access_to_escola"("_escola_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_access_to_escola"("_escola_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_access_to_escola_fast"("p_escola_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."has_access_to_escola_fast"("p_escola_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_access_to_escola_fast"("p_escola_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."immutable_unaccent"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."immutable_unaccent"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."immutable_unaccent"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."importar_alunos"("p_import_id" "uuid", "p_escola_id" "uuid", "p_ano_letivo" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."importar_alunos"("p_import_id" "uuid", "p_escola_id" "uuid", "p_ano_letivo" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."importar_alunos"("p_import_id" "uuid", "p_escola_id" "uuid", "p_ano_letivo" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."importar_alunos_v2"("p_escola_id" "uuid", "p_ano_letivo" integer, "p_import_id" "uuid", "p_alunos" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."importar_alunos_v2"("p_escola_id" "uuid", "p_ano_letivo" integer, "p_import_id" "uuid", "p_alunos" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."importar_alunos_v2"("p_escola_id" "uuid", "p_ano_letivo" integer, "p_import_id" "uuid", "p_alunos" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."importar_alunos_v4"("p_import_id" "uuid", "p_escola_id" "uuid", "p_modo" "text", "p_data_inicio_financeiro" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."importar_alunos_v4"("p_import_id" "uuid", "p_escola_id" "uuid", "p_modo" "text", "p_data_inicio_financeiro" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."importar_alunos_v4"("p_import_id" "uuid", "p_escola_id" "uuid", "p_modo" "text", "p_data_inicio_financeiro" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."initcap_angola"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."initcap_angola"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."initcap_angola"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin_escola"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin_escola"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin_escola"() TO "service_role";



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



REVOKE ALL ON FUNCTION "public"."is_staff_escola"("escola_uuid" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_staff_escola"("escola_uuid" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."is_staff_escola"("escola_uuid" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."is_super_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_super_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_super_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."liberar_acesso_alunos_v2"("p_escola_id" "uuid", "p_aluno_ids" "uuid"[], "p_canal" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."liberar_acesso_alunos_v2"("p_escola_id" "uuid", "p_aluno_ids" "uuid"[], "p_canal" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."liberar_acesso_alunos_v2"("p_escola_id" "uuid", "p_aluno_ids" "uuid"[], "p_canal" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."lock_curriculo_install"("p_escola_id" "uuid", "p_preset_key" "text", "p_ano_letivo_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."lock_curriculo_install"("p_escola_id" "uuid", "p_preset_key" "text", "p_ano_letivo_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."lock_curriculo_install"("p_escola_id" "uuid", "p_preset_key" "text", "p_ano_letivo_id" "uuid") TO "service_role";



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



GRANT ALL ON FUNCTION "public"."mark_outbox_event_failed"("p_event_id" "uuid", "p_error" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_outbox_event_failed"("p_event_id" "uuid", "p_error" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_outbox_event_failed"("p_event_id" "uuid", "p_error" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_outbox_event_processed"("p_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_outbox_event_processed"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_outbox_event_processed"("p_event_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."matricula_counter_floor"("p_escola_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."matricula_counter_floor"("p_escola_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."matricula_counter_floor"("p_escola_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."matricula_counter_floor"("p_escola_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."matricular_em_massa"("p_import_id" "uuid", "p_escola_id" "uuid", "p_curso_codigo" "text", "p_classe_numero" integer, "p_turno_codigo" "text", "p_turma_letra" "text", "p_ano_letivo" integer, "p_turma_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."matricular_em_massa"("p_import_id" "uuid", "p_escola_id" "uuid", "p_curso_codigo" "text", "p_classe_numero" integer, "p_turno_codigo" "text", "p_turma_letra" "text", "p_ano_letivo" integer, "p_turma_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."matricular_em_massa"("p_import_id" "uuid", "p_escola_id" "uuid", "p_curso_codigo" "text", "p_classe_numero" integer, "p_turno_codigo" "text", "p_turma_letra" "text", "p_ano_letivo" integer, "p_turma_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."matricular_em_massa"("p_import_id" "uuid", "p_escola_id" "uuid", "p_curso_codigo" "text", "p_classe_numero" integer, "p_turno_codigo" "text", "p_turma_letra" "text", "p_ano_letivo" integer, "p_turma_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."matricular_em_massa_por_turma"("p_import_id" "uuid", "p_escola_id" "uuid", "p_turma_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."matricular_em_massa_por_turma"("p_import_id" "uuid", "p_escola_id" "uuid", "p_turma_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."matricular_em_massa_por_turma"("p_import_id" "uuid", "p_escola_id" "uuid", "p_turma_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."matricular_em_massa_por_turma"("p_import_id" "uuid", "p_escola_id" "uuid", "p_turma_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."matricular_lista_alunos"("p_escola_id" "uuid", "p_turma_id" "uuid", "p_ano_letivo" integer, "p_aluno_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."matricular_lista_alunos"("p_escola_id" "uuid", "p_turma_id" "uuid", "p_ano_letivo" integer, "p_aluno_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."matricular_lista_alunos"("p_escola_id" "uuid", "p_turma_id" "uuid", "p_ano_letivo" integer, "p_aluno_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."matriculas_status_before_ins_upd"() TO "anon";
GRANT ALL ON FUNCTION "public"."matriculas_status_before_ins_upd"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."matriculas_status_before_ins_upd"() TO "service_role";



GRANT ALL ON FUNCTION "public"."move_profile_to_archive"("p_user_id" "uuid", "p_performed_by" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."move_profile_to_archive"("p_user_id" "uuid", "p_performed_by" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."move_profile_to_archive"("p_user_id" "uuid", "p_performed_by" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."next_matricula_number"("p_escola_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."next_matricula_number"("p_escola_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."next_matricula_number"("p_escola_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."next_matricula_number"("p_escola_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."next_numero_processo"("p_escola_id" "uuid", "p_year" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."next_numero_processo"("p_escola_id" "uuid", "p_year" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."next_numero_processo"("p_escola_id" "uuid", "p_year" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_course_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_course_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_course_code"() TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_date"("input_text" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_date"("input_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_date"("input_text" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_text"("input_text" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_text"("input_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_text"("input_text" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_turma_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_turma_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_turma_code"() TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_turma_code"("p_code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_turma_code"("p_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_turma_code"("p_code" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."outbox_claim"("batch_size" integer, "worker_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."outbox_claim"("batch_size" integer, "worker_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."outbox_claim"("batch_size" integer, "worker_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."outbox_claim"("batch_size" integer, "worker_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."outbox_report_result"("p_id" "uuid", "p_ok" boolean, "p_error" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."outbox_report_result"("p_id" "uuid", "p_ok" boolean, "p_error" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."outbox_report_result"("p_id" "uuid", "p_ok" boolean, "p_error" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."outbox_report_result"("p_id" "uuid", "p_ok" boolean, "p_error" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."outbox_requeue_stuck"() TO "anon";
GRANT ALL ON FUNCTION "public"."outbox_requeue_stuck"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."outbox_requeue_stuck"() TO "service_role";



GRANT ALL ON FUNCTION "public"."partitions_info"() TO "anon";
GRANT ALL ON FUNCTION "public"."partitions_info"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."partitions_info"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."preview_matricula_number"("p_escola_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."preview_matricula_number"("p_escola_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."preview_matricula_number"("p_escola_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."preview_matricula_number"("p_escola_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."process_outbox_batch"("p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."process_outbox_batch"("p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_outbox_batch"("p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."professor_list_presencas_turma"("p_turma_id" "uuid", "p_data_inicio" "date", "p_data_fim" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."professor_list_presencas_turma"("p_turma_id" "uuid", "p_data_inicio" "date", "p_data_fim" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."professor_list_presencas_turma"("p_turma_id" "uuid", "p_data_inicio" "date", "p_data_fim" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."public_get_documento_by_token"("p_public_id" "uuid", "p_hash" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."public_get_documento_by_token"("p_public_id" "uuid", "p_hash" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."public_get_documento_by_token"("p_public_id" "uuid", "p_hash" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."public_get_documento_by_token"("p_public_id" "uuid", "p_hash" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_all_materialized_views"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_all_materialized_views"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_all_materialized_views"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_frequencia_status_periodo"("p_turma_id" "uuid", "p_periodo_letivo_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_frequencia_status_periodo"("p_turma_id" "uuid", "p_periodo_letivo_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_frequencia_status_periodo"("p_turma_id" "uuid", "p_periodo_letivo_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_mv_admin_dashboard_counts"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_mv_admin_dashboard_counts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_mv_admin_dashboard_counts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_mv_admin_matriculas_por_mes"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_mv_admin_matriculas_por_mes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_mv_admin_matriculas_por_mes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_mv_admin_pending_turmas_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_mv_admin_pending_turmas_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_mv_admin_pending_turmas_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_mv_admissoes_counts_por_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_mv_admissoes_counts_por_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_mv_admissoes_counts_por_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_mv_cursos_reais"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_mv_cursos_reais"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_mv_cursos_reais"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_mv_escola_estrutura_counts"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_mv_escola_estrutura_counts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_mv_escola_estrutura_counts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_mv_escola_setup_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_mv_escola_setup_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_mv_escola_setup_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_mv_financeiro_cobrancas_diario"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_mv_financeiro_cobrancas_diario"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_mv_financeiro_cobrancas_diario"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_mv_financeiro_kpis_geral"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_mv_financeiro_kpis_geral"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_mv_financeiro_kpis_geral"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_mv_financeiro_kpis_mes"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_mv_financeiro_kpis_mes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_mv_financeiro_kpis_mes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_mv_financeiro_radar_resumo"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_mv_financeiro_radar_resumo"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_mv_financeiro_radar_resumo"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_mv_financeiro_sidebar_badges"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_mv_financeiro_sidebar_badges"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_mv_financeiro_sidebar_badges"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_mv_migracao_cursos_lookup"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_mv_migracao_cursos_lookup"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_mv_migracao_cursos_lookup"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_mv_migracao_turmas_lookup"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_mv_migracao_turmas_lookup"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_mv_migracao_turmas_lookup"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_mv_ocupacao_turmas"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_mv_ocupacao_turmas"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_mv_ocupacao_turmas"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_mv_pagamentos_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_mv_pagamentos_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_mv_pagamentos_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_mv_radar_inadimplencia"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_mv_radar_inadimplencia"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_mv_radar_inadimplencia"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_mv_secretaria_dashboard_counts"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_mv_secretaria_dashboard_counts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_mv_secretaria_dashboard_counts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_mv_secretaria_dashboard_kpis"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_mv_secretaria_dashboard_kpis"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_mv_secretaria_dashboard_kpis"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_mv_secretaria_matriculas_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_mv_secretaria_matriculas_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_mv_secretaria_matriculas_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_mv_secretaria_matriculas_turma_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_mv_secretaria_matriculas_turma_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_mv_secretaria_matriculas_turma_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_mv_staging_alunos_summary"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_mv_staging_alunos_summary"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_mv_staging_alunos_summary"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_mv_total_em_aberto_por_mes"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_mv_total_em_aberto_por_mes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_mv_total_em_aberto_por_mes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_mv_turmas_para_matricula"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_mv_turmas_para_matricula"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_mv_turmas_para_matricula"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."registrar_pagamento"("p_mensalidade_id" "uuid", "p_metodo_pagamento" "text", "p_observacao" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."registrar_pagamento"("p_mensalidade_id" "uuid", "p_metodo_pagamento" "text", "p_observacao" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."registrar_pagamento"("p_mensalidade_id" "uuid", "p_metodo_pagamento" "text", "p_observacao" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."registrar_pagamento"("p_mensalidade_id" "uuid", "p_metodo_pagamento" "text", "p_observacao" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."registrar_venda_avulsa"("p_escola_id" "uuid", "p_aluno_id" "uuid", "p_item_id" "uuid", "p_quantidade" integer, "p_valor_unit" numeric, "p_desconto" numeric, "p_metodo_pagamento" "public"."metodo_pagamento_enum", "p_status" "public"."financeiro_status", "p_descricao" "text", "p_created_by" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."registrar_venda_avulsa"("p_escola_id" "uuid", "p_aluno_id" "uuid", "p_item_id" "uuid", "p_quantidade" integer, "p_valor_unit" numeric, "p_desconto" numeric, "p_metodo_pagamento" "public"."metodo_pagamento_enum", "p_status" "public"."financeiro_status", "p_descricao" "text", "p_created_by" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."registrar_venda_avulsa"("p_escola_id" "uuid", "p_aluno_id" "uuid", "p_item_id" "uuid", "p_quantidade" integer, "p_valor_unit" numeric, "p_desconto" numeric, "p_metodo_pagamento" "public"."metodo_pagamento_enum", "p_status" "public"."financeiro_status", "p_descricao" "text", "p_created_by" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."rematricula_em_massa"("p_escola_id" "uuid", "p_origem_turma_id" "uuid", "p_destino_turma_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."rematricula_em_massa"("p_escola_id" "uuid", "p_origem_turma_id" "uuid", "p_destino_turma_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rematricula_em_massa"("p_escola_id" "uuid", "p_origem_turma_id" "uuid", "p_destino_turma_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."request_liberar_acesso"("p_escola_id" "uuid", "p_aluno_ids" "uuid"[], "p_canal" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."request_liberar_acesso"("p_escola_id" "uuid", "p_aluno_ids" "uuid"[], "p_canal" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."request_liberar_acesso"("p_escola_id" "uuid", "p_aluno_ids" "uuid"[], "p_canal" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."resync_matricula_counter"("p_escola_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."resync_matricula_counter"("p_escola_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."resync_matricula_counter"("p_escola_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resync_matricula_counter"("p_escola_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."retry_outbox_event"("p_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."retry_outbox_event"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."retry_outbox_event"("p_event_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."search_alunos_global"("p_escola_id" "uuid", "p_query" "text", "p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."search_alunos_global"("p_escola_id" "uuid", "p_query" "text", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_alunos_global"("p_escola_id" "uuid", "p_query" "text", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_alunos_global"("p_escola_id" "uuid", "p_query" "text", "p_limit" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."search_alunos_global_min"("p_escola_id" "uuid", "p_query" "text", "p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."search_alunos_global_min"("p_escola_id" "uuid", "p_query" "text", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_alunos_global_min"("p_escola_id" "uuid", "p_query" "text", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_alunos_global_min"("p_escola_id" "uuid", "p_query" "text", "p_limit" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."search_alunos_global_min"("p_escola_id" "uuid", "p_query" "text", "p_limit" integer, "p_cursor_score" double precision, "p_cursor_updated_at" timestamp with time zone, "p_cursor_created_at" timestamp with time zone, "p_cursor_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."search_alunos_global_min"("p_escola_id" "uuid", "p_query" "text", "p_limit" integer, "p_cursor_score" double precision, "p_cursor_updated_at" timestamp with time zone, "p_cursor_created_at" timestamp with time zone, "p_cursor_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."search_alunos_global_min"("p_escola_id" "uuid", "p_query" "text", "p_limit" integer, "p_cursor_score" double precision, "p_cursor_updated_at" timestamp with time zone, "p_cursor_created_at" timestamp with time zone, "p_cursor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_alunos_global_min"("p_escola_id" "uuid", "p_query" "text", "p_limit" integer, "p_cursor_score" double precision, "p_cursor_updated_at" timestamp with time zone, "p_cursor_created_at" timestamp with time zone, "p_cursor_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."search_global_entities"("p_escola_id" "uuid", "p_query" "text", "p_types" "text"[], "p_limit" integer, "p_cursor_score" double precision, "p_cursor_updated_at" timestamp with time zone, "p_cursor_created_at" timestamp with time zone, "p_cursor_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."search_global_entities"("p_escola_id" "uuid", "p_query" "text", "p_types" "text"[], "p_limit" integer, "p_cursor_score" double precision, "p_cursor_updated_at" timestamp with time zone, "p_cursor_created_at" timestamp with time zone, "p_cursor_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."search_global_entities"("p_escola_id" "uuid", "p_query" "text", "p_types" "text"[], "p_limit" integer, "p_cursor_score" double precision, "p_cursor_updated_at" timestamp with time zone, "p_cursor_created_at" timestamp with time zone, "p_cursor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_global_entities"("p_escola_id" "uuid", "p_query" "text", "p_types" "text"[], "p_limit" integer, "p_cursor_score" double precision, "p_cursor_updated_at" timestamp with time zone, "p_cursor_created_at" timestamp with time zone, "p_cursor_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."secretaria_audit_by_aluno_matricula"("p_aluno_id" "uuid", "p_matricula_id" "uuid", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."secretaria_audit_by_aluno_matricula"("p_aluno_id" "uuid", "p_matricula_id" "uuid", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."secretaria_audit_by_aluno_matricula"("p_aluno_id" "uuid", "p_matricula_id" "uuid", "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."secretaria_list_alunos_kf2"("p_escola_id" "uuid", "p_status" "text", "p_q" "text", "p_ano_letivo" integer, "p_limit" integer, "p_offset" integer, "p_cursor_created_at" timestamp with time zone, "p_cursor_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."secretaria_list_alunos_kf2"("p_escola_id" "uuid", "p_status" "text", "p_q" "text", "p_ano_letivo" integer, "p_limit" integer, "p_offset" integer, "p_cursor_created_at" timestamp with time zone, "p_cursor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."secretaria_list_alunos_kf2"("p_escola_id" "uuid", "p_status" "text", "p_q" "text", "p_ano_letivo" integer, "p_limit" integer, "p_offset" integer, "p_cursor_created_at" timestamp with time zone, "p_cursor_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."soft_delete_aluno"("p_id" "uuid", "p_deleted_by" "uuid", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."soft_delete_aluno"("p_id" "uuid", "p_deleted_by" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."soft_delete_aluno"("p_id" "uuid", "p_deleted_by" "uuid", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_alunos_nome_busca"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_alunos_nome_busca"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_alunos_nome_busca"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_alunos_nome_completo"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_alunos_nome_completo"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_alunos_nome_completo"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_disciplinas_ao_criar_turma"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_disciplinas_ao_criar_turma"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_disciplinas_ao_criar_turma"() TO "service_role";



GRANT ALL ON FUNCTION "public"."tg_fill_turma_disciplinas"() TO "anon";
GRANT ALL ON FUNCTION "public"."tg_fill_turma_disciplinas"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tg_fill_turma_disciplinas"() TO "service_role";



GRANT ALL ON FUNCTION "public"."tg_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."tg_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tg_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_auto_numero_processo"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_auto_numero_processo"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_auto_numero_processo"() TO "service_role";



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



GRANT ALL ON FUNCTION "public"."trg_set_matricula_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_set_matricula_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_set_matricula_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_touch_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_import_configuration"("p_import_id" "uuid", "p_cursos_data" "jsonb", "p_turmas_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."update_import_configuration"("p_import_id" "uuid", "p_cursos_data" "jsonb", "p_turmas_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_import_configuration"("p_import_id" "uuid", "p_cursos_data" "jsonb", "p_turmas_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_has_role_in_school"("p_escola_id" "uuid", "p_roles" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."user_has_role_in_school"("p_escola_id" "uuid", "p_roles" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_has_role_in_school"("p_escola_id" "uuid", "p_roles" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."verificar_documento_publico"("p_public_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."verificar_documento_publico"("p_public_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."verificar_documento_publico"("p_public_id" "uuid") TO "service_role";
























GRANT ALL ON TABLE "public"."escola_users" TO "anon";
GRANT ALL ON TABLE "public"."escola_users" TO "authenticated";
GRANT ALL ON TABLE "public"."escola_users" TO "service_role";



GRANT ALL ON TABLE "public"."escolas" TO "anon";
GRANT ALL ON TABLE "public"."escolas" TO "authenticated";
GRANT ALL ON TABLE "public"."escolas" TO "service_role";



GRANT ALL ON TABLE "public"."matriculas" TO "anon";
GRANT ALL ON TABLE "public"."matriculas" TO "authenticated";
GRANT ALL ON TABLE "public"."matriculas" TO "service_role";



GRANT ALL ON TABLE "public"."notas" TO "anon";
GRANT ALL ON TABLE "public"."notas" TO "authenticated";
GRANT ALL ON TABLE "public"."notas" TO "service_role";



GRANT ALL ON TABLE "internal"."mv_admin_dashboard_counts" TO "anon";
GRANT ALL ON TABLE "internal"."mv_admin_dashboard_counts" TO "authenticated";
GRANT ALL ON TABLE "internal"."mv_admin_dashboard_counts" TO "service_role";



GRANT ALL ON TABLE "internal"."mv_admin_matriculas_por_mes" TO "anon";
GRANT ALL ON TABLE "internal"."mv_admin_matriculas_por_mes" TO "authenticated";
GRANT ALL ON TABLE "internal"."mv_admin_matriculas_por_mes" TO "service_role";



GRANT ALL ON TABLE "internal"."mv_admin_pending_turmas_count" TO "anon";
GRANT ALL ON TABLE "internal"."mv_admin_pending_turmas_count" TO "authenticated";
GRANT ALL ON TABLE "internal"."mv_admin_pending_turmas_count" TO "service_role";



GRANT ALL ON TABLE "public"."candidaturas" TO "anon";
GRANT ALL ON TABLE "public"."candidaturas" TO "authenticated";
GRANT ALL ON TABLE "public"."candidaturas" TO "service_role";



GRANT ALL ON TABLE "internal"."mv_admissoes_counts_por_status" TO "anon";
GRANT ALL ON TABLE "internal"."mv_admissoes_counts_por_status" TO "authenticated";
GRANT ALL ON TABLE "internal"."mv_admissoes_counts_por_status" TO "service_role";



GRANT ALL ON TABLE "public"."curso_matriz" TO "anon";
GRANT ALL ON TABLE "public"."curso_matriz" TO "authenticated";
GRANT ALL ON TABLE "public"."curso_matriz" TO "service_role";



GRANT ALL ON TABLE "public"."cursos" TO "anon";
GRANT ALL ON TABLE "public"."cursos" TO "authenticated";
GRANT ALL ON TABLE "public"."cursos" TO "service_role";



GRANT ALL ON TABLE "internal"."mv_cursos_reais" TO "anon";
GRANT ALL ON TABLE "internal"."mv_cursos_reais" TO "authenticated";
GRANT ALL ON TABLE "internal"."mv_cursos_reais" TO "service_role";



GRANT ALL ON TABLE "public"."classes" TO "anon";
GRANT ALL ON TABLE "public"."classes" TO "authenticated";
GRANT ALL ON TABLE "public"."classes" TO "service_role";



GRANT ALL ON TABLE "internal"."mv_escola_estrutura_counts" TO "anon";
GRANT ALL ON TABLE "internal"."mv_escola_estrutura_counts" TO "authenticated";
GRANT ALL ON TABLE "internal"."mv_escola_estrutura_counts" TO "service_role";



GRANT ALL ON TABLE "public"."anos_letivos" TO "anon";
GRANT ALL ON TABLE "public"."anos_letivos" TO "authenticated";
GRANT ALL ON TABLE "public"."anos_letivos" TO "service_role";



GRANT ALL ON TABLE "public"."curso_curriculos" TO "anon";
GRANT ALL ON TABLE "public"."curso_curriculos" TO "authenticated";
GRANT ALL ON TABLE "public"."curso_curriculos" TO "service_role";



GRANT ALL ON TABLE "public"."periodos_letivos" TO "anon";
GRANT ALL ON TABLE "public"."periodos_letivos" TO "authenticated";
GRANT ALL ON TABLE "public"."periodos_letivos" TO "service_role";



GRANT ALL ON TABLE "internal"."mv_escola_setup_status" TO "anon";
GRANT ALL ON TABLE "internal"."mv_escola_setup_status" TO "authenticated";
GRANT ALL ON TABLE "internal"."mv_escola_setup_status" TO "service_role";



GRANT ALL ON TABLE "public"."financeiro_cobrancas" TO "anon";
GRANT ALL ON TABLE "public"."financeiro_cobrancas" TO "authenticated";
GRANT ALL ON TABLE "public"."financeiro_cobrancas" TO "service_role";



GRANT ALL ON TABLE "public"."mensalidades" TO "anon";
GRANT ALL ON TABLE "public"."mensalidades" TO "authenticated";
GRANT ALL ON TABLE "public"."mensalidades" TO "service_role";



GRANT ALL ON TABLE "internal"."mv_financeiro_cobrancas_diario" TO "anon";
GRANT ALL ON TABLE "internal"."mv_financeiro_cobrancas_diario" TO "authenticated";
GRANT ALL ON TABLE "internal"."mv_financeiro_cobrancas_diario" TO "service_role";



GRANT ALL ON TABLE "internal"."mv_financeiro_kpis_geral" TO "anon";
GRANT ALL ON TABLE "internal"."mv_financeiro_kpis_geral" TO "authenticated";
GRANT ALL ON TABLE "internal"."mv_financeiro_kpis_geral" TO "service_role";



GRANT ALL ON TABLE "public"."pagamentos" TO "anon";
GRANT ALL ON TABLE "public"."pagamentos" TO "authenticated";
GRANT ALL ON TABLE "public"."pagamentos" TO "service_role";



GRANT ALL ON TABLE "internal"."mv_financeiro_kpis_mes" TO "anon";
GRANT ALL ON TABLE "internal"."mv_financeiro_kpis_mes" TO "authenticated";
GRANT ALL ON TABLE "internal"."mv_financeiro_kpis_mes" TO "service_role";



GRANT ALL ON TABLE "public"."alunos" TO "anon";
GRANT ALL ON TABLE "public"."alunos" TO "authenticated";
GRANT ALL ON TABLE "public"."alunos" TO "service_role";



GRANT ALL ON TABLE "public"."vw_matriculas_validas" TO "anon";
GRANT ALL ON TABLE "public"."vw_matriculas_validas" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_matriculas_validas" TO "service_role";



GRANT ALL ON TABLE "internal"."mv_financeiro_radar_resumo" TO "anon";
GRANT ALL ON TABLE "internal"."mv_financeiro_radar_resumo" TO "authenticated";
GRANT ALL ON TABLE "internal"."mv_financeiro_radar_resumo" TO "service_role";



GRANT ALL ON TABLE "internal"."mv_financeiro_sidebar_badges" TO "anon";
GRANT ALL ON TABLE "internal"."mv_financeiro_sidebar_badges" TO "authenticated";
GRANT ALL ON TABLE "internal"."mv_financeiro_sidebar_badges" TO "service_role";



GRANT ALL ON TABLE "internal"."mv_migracao_cursos_lookup" TO "anon";
GRANT ALL ON TABLE "internal"."mv_migracao_cursos_lookup" TO "authenticated";
GRANT ALL ON TABLE "internal"."mv_migracao_cursos_lookup" TO "service_role";



GRANT ALL ON TABLE "internal"."mv_migracao_turmas_lookup" TO "anon";
GRANT ALL ON TABLE "internal"."mv_migracao_turmas_lookup" TO "authenticated";
GRANT ALL ON TABLE "internal"."mv_migracao_turmas_lookup" TO "service_role";



GRANT ALL ON TABLE "internal"."mv_ocupacao_turmas" TO "anon";
GRANT ALL ON TABLE "internal"."mv_ocupacao_turmas" TO "authenticated";
GRANT ALL ON TABLE "internal"."mv_ocupacao_turmas" TO "service_role";



GRANT ALL ON TABLE "internal"."mv_pagamentos_status" TO "anon";
GRANT ALL ON TABLE "internal"."mv_pagamentos_status" TO "authenticated";
GRANT ALL ON TABLE "internal"."mv_pagamentos_status" TO "service_role";



GRANT ALL ON TABLE "internal"."mv_radar_inadimplencia" TO "anon";
GRANT ALL ON TABLE "internal"."mv_radar_inadimplencia" TO "authenticated";
GRANT ALL ON TABLE "internal"."mv_radar_inadimplencia" TO "service_role";



GRANT ALL ON TABLE "internal"."mv_secretaria_dashboard_counts" TO "anon";
GRANT ALL ON TABLE "internal"."mv_secretaria_dashboard_counts" TO "authenticated";
GRANT ALL ON TABLE "internal"."mv_secretaria_dashboard_counts" TO "service_role";



GRANT ALL ON TABLE "internal"."mv_secretaria_matriculas_status" TO "anon";
GRANT ALL ON TABLE "internal"."mv_secretaria_matriculas_status" TO "authenticated";
GRANT ALL ON TABLE "internal"."mv_secretaria_matriculas_status" TO "service_role";



GRANT ALL ON TABLE "internal"."mv_secretaria_matriculas_turma_status" TO "anon";
GRANT ALL ON TABLE "internal"."mv_secretaria_matriculas_turma_status" TO "authenticated";
GRANT ALL ON TABLE "internal"."mv_secretaria_matriculas_turma_status" TO "service_role";



GRANT ALL ON TABLE "public"."staging_alunos" TO "anon";
GRANT ALL ON TABLE "public"."staging_alunos" TO "authenticated";
GRANT ALL ON TABLE "public"."staging_alunos" TO "service_role";



GRANT ALL ON TABLE "internal"."mv_staging_alunos_summary" TO "anon";
GRANT ALL ON TABLE "internal"."mv_staging_alunos_summary" TO "authenticated";
GRANT ALL ON TABLE "internal"."mv_staging_alunos_summary" TO "service_role";



GRANT ALL ON TABLE "internal"."mv_total_em_aberto_por_mes" TO "anon";
GRANT ALL ON TABLE "internal"."mv_total_em_aberto_por_mes" TO "authenticated";
GRANT ALL ON TABLE "internal"."mv_total_em_aberto_por_mes" TO "service_role";



GRANT ALL ON TABLE "public"."cursos_globais_cache" TO "anon";
GRANT ALL ON TABLE "public"."cursos_globais_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."cursos_globais_cache" TO "service_role";



GRANT ALL ON TABLE "public"."turma_disciplinas" TO "anon";
GRANT ALL ON TABLE "public"."turma_disciplinas" TO "authenticated";
GRANT ALL ON TABLE "public"."turma_disciplinas" TO "service_role";



GRANT ALL ON TABLE "internal"."mv_turmas_para_matricula" TO "anon";
GRANT ALL ON TABLE "internal"."mv_turmas_para_matricula" TO "authenticated";
GRANT ALL ON TABLE "internal"."mv_turmas_para_matricula" TO "service_role";



GRANT ALL ON TABLE "public"."aluno_processo_counters" TO "anon";
GRANT ALL ON TABLE "public"."aluno_processo_counters" TO "authenticated";
GRANT ALL ON TABLE "public"."aluno_processo_counters" TO "service_role";



GRANT ALL ON TABLE "public"."alunos_excluidos" TO "anon";
GRANT ALL ON TABLE "public"."alunos_excluidos" TO "authenticated";
GRANT ALL ON TABLE "public"."alunos_excluidos" TO "service_role";



GRANT ALL ON TABLE "public"."atribuicoes_prof" TO "anon";
GRANT ALL ON TABLE "public"."atribuicoes_prof" TO "authenticated";
GRANT ALL ON TABLE "public"."atribuicoes_prof" TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";
GRANT SELECT,INSERT ON TABLE "public"."audit_logs" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."audit_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."audit_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."audit_logs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."aulas" TO "anon";
GRANT ALL ON TABLE "public"."aulas" TO "authenticated";
GRANT ALL ON TABLE "public"."aulas" TO "service_role";



GRANT ALL ON TABLE "public"."avaliacoes" TO "anon";
GRANT ALL ON TABLE "public"."avaliacoes" TO "authenticated";
GRANT ALL ON TABLE "public"."avaliacoes" TO "service_role";



GRANT ALL ON TABLE "public"."candidaturas_status_log" TO "anon";
GRANT ALL ON TABLE "public"."candidaturas_status_log" TO "authenticated";
GRANT ALL ON TABLE "public"."candidaturas_status_log" TO "service_role";



GRANT ALL ON TABLE "public"."configuracoes_curriculo" TO "anon";
GRANT ALL ON TABLE "public"."configuracoes_curriculo" TO "authenticated";
GRANT ALL ON TABLE "public"."configuracoes_curriculo" TO "service_role";



GRANT ALL ON TABLE "public"."configuracoes_escola" TO "anon";
GRANT ALL ON TABLE "public"."configuracoes_escola" TO "authenticated";
GRANT ALL ON TABLE "public"."configuracoes_escola" TO "service_role";



GRANT ALL ON TABLE "public"."disciplinas_catalogo" TO "anon";
GRANT ALL ON TABLE "public"."disciplinas_catalogo" TO "authenticated";
GRANT ALL ON TABLE "public"."disciplinas_catalogo" TO "service_role";



GRANT ALL ON TABLE "public"."documentos_emitidos" TO "anon";
GRANT ALL ON TABLE "public"."documentos_emitidos" TO "authenticated";
GRANT ALL ON TABLE "public"."documentos_emitidos" TO "service_role";



GRANT ALL ON TABLE "public"."escola_administradores" TO "anon";
GRANT ALL ON TABLE "public"."escola_administradores" TO "authenticated";
GRANT ALL ON TABLE "public"."escola_administradores" TO "service_role";



GRANT ALL ON TABLE "public"."escola_auditoria" TO "anon";
GRANT ALL ON TABLE "public"."escola_auditoria" TO "authenticated";
GRANT ALL ON TABLE "public"."escola_auditoria" TO "service_role";



GRANT ALL ON TABLE "public"."escola_configuracoes" TO "anon";
GRANT ALL ON TABLE "public"."escola_configuracoes" TO "authenticated";
GRANT ALL ON TABLE "public"."escola_configuracoes" TO "service_role";



GRANT ALL ON TABLE "public"."escola_usuarios" TO "authenticated";
GRANT ALL ON TABLE "public"."escola_usuarios" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."escolas_view" TO "anon";
GRANT ALL ON TABLE "public"."escolas_view" TO "authenticated";
GRANT ALL ON TABLE "public"."escolas_view" TO "service_role";



GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON TABLE "public"."financeiro_contratos" TO "anon";
GRANT ALL ON TABLE "public"."financeiro_contratos" TO "authenticated";
GRANT ALL ON TABLE "public"."financeiro_contratos" TO "service_role";



GRANT ALL ON TABLE "public"."financeiro_estornos" TO "anon";
GRANT ALL ON TABLE "public"."financeiro_estornos" TO "authenticated";
GRANT ALL ON TABLE "public"."financeiro_estornos" TO "service_role";



GRANT ALL ON TABLE "public"."financeiro_itens" TO "anon";
GRANT ALL ON TABLE "public"."financeiro_itens" TO "authenticated";
GRANT ALL ON TABLE "public"."financeiro_itens" TO "service_role";



GRANT ALL ON TABLE "public"."financeiro_lancamentos" TO "anon";
GRANT ALL ON TABLE "public"."financeiro_lancamentos" TO "authenticated";
GRANT ALL ON TABLE "public"."financeiro_lancamentos" TO "service_role";



GRANT ALL ON TABLE "public"."financeiro_tabelas" TO "anon";
GRANT ALL ON TABLE "public"."financeiro_tabelas" TO "authenticated";
GRANT ALL ON TABLE "public"."financeiro_tabelas" TO "service_role";



GRANT ALL ON TABLE "public"."financeiro_titulos" TO "anon";
GRANT ALL ON TABLE "public"."financeiro_titulos" TO "authenticated";
GRANT ALL ON TABLE "public"."financeiro_titulos" TO "service_role";



GRANT ALL ON TABLE "public"."frequencia_status_periodo" TO "anon";
GRANT ALL ON TABLE "public"."frequencia_status_periodo" TO "authenticated";
GRANT ALL ON TABLE "public"."frequencia_status_periodo" TO "service_role";



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



GRANT ALL ON TABLE "public"."frequencias_2026_01" TO "anon";
GRANT ALL ON TABLE "public"."frequencias_2026_01" TO "authenticated";
GRANT ALL ON TABLE "public"."frequencias_2026_01" TO "service_role";



GRANT ALL ON TABLE "public"."frequencias_2026_02" TO "anon";
GRANT ALL ON TABLE "public"."frequencias_2026_02" TO "authenticated";
GRANT ALL ON TABLE "public"."frequencias_2026_02" TO "service_role";



GRANT ALL ON TABLE "public"."frequencias_default" TO "anon";
GRANT ALL ON TABLE "public"."frequencias_default" TO "authenticated";
GRANT ALL ON TABLE "public"."frequencias_default" TO "service_role";



GRANT ALL ON TABLE "public"."historico_anos" TO "anon";
GRANT ALL ON TABLE "public"."historico_anos" TO "authenticated";
GRANT ALL ON TABLE "public"."historico_anos" TO "service_role";



GRANT ALL ON TABLE "public"."historico_disciplinas" TO "anon";
GRANT ALL ON TABLE "public"."historico_disciplinas" TO "authenticated";
GRANT ALL ON TABLE "public"."historico_disciplinas" TO "service_role";



GRANT ALL ON TABLE "public"."import_errors" TO "anon";
GRANT ALL ON TABLE "public"."import_errors" TO "authenticated";
GRANT ALL ON TABLE "public"."import_errors" TO "service_role";



GRANT ALL ON SEQUENCE "public"."import_errors_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."import_errors_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."import_errors_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."import_migrations" TO "anon";
GRANT ALL ON TABLE "public"."import_migrations" TO "authenticated";
GRANT ALL ON TABLE "public"."import_migrations" TO "service_role";



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



GRANT ALL ON TABLE "public"."lancamentos_2026_01" TO "anon";
GRANT ALL ON TABLE "public"."lancamentos_2026_01" TO "authenticated";
GRANT ALL ON TABLE "public"."lancamentos_2026_01" TO "service_role";



GRANT ALL ON TABLE "public"."lancamentos_2026_02" TO "anon";
GRANT ALL ON TABLE "public"."lancamentos_2026_02" TO "authenticated";
GRANT ALL ON TABLE "public"."lancamentos_2026_02" TO "service_role";



GRANT ALL ON TABLE "public"."lancamentos_default" TO "anon";
GRANT ALL ON TABLE "public"."lancamentos_default" TO "authenticated";
GRANT ALL ON TABLE "public"."lancamentos_default" TO "service_role";



GRANT ALL ON TABLE "public"."matricula_counters" TO "anon";
GRANT ALL ON TABLE "public"."matricula_counters" TO "authenticated";
GRANT ALL ON TABLE "public"."matricula_counters" TO "service_role";



GRANT ALL ON SEQUENCE "public"."matricula_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."matricula_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."matricula_seq" TO "service_role";



GRANT ALL ON TABLE "public"."matriculas_cursos" TO "anon";
GRANT ALL ON TABLE "public"."matriculas_cursos" TO "authenticated";
GRANT ALL ON TABLE "public"."matriculas_cursos" TO "service_role";



GRANT ALL ON TABLE "public"."matriculas_por_ano" TO "anon";
GRANT ALL ON TABLE "public"."matriculas_por_ano" TO "authenticated";
GRANT ALL ON TABLE "public"."matriculas_por_ano" TO "service_role";



GRANT ALL ON TABLE "public"."mv_financeiro_escola_dia" TO "service_role";



GRANT ALL ON TABLE "public"."mv_freq_por_turma_dia" TO "service_role";



GRANT ALL ON TABLE "public"."notas_avaliacoes" TO "anon";
GRANT ALL ON TABLE "public"."notas_avaliacoes" TO "authenticated";
GRANT ALL ON TABLE "public"."notas_avaliacoes" TO "service_role";



GRANT ALL ON TABLE "public"."notices" TO "anon";
GRANT ALL ON TABLE "public"."notices" TO "authenticated";
GRANT ALL ON TABLE "public"."notices" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."onboarding_drafts" TO "anon";
GRANT ALL ON TABLE "public"."onboarding_drafts" TO "authenticated";
GRANT ALL ON TABLE "public"."onboarding_drafts" TO "service_role";



GRANT ALL ON TABLE "public"."outbox_notificacoes" TO "anon";
GRANT ALL ON TABLE "public"."outbox_notificacoes" TO "authenticated";
GRANT ALL ON TABLE "public"."outbox_notificacoes" TO "service_role";



GRANT ALL ON TABLE "public"."pagamentos_status" TO "authenticated";
GRANT ALL ON TABLE "public"."pagamentos_status" TO "service_role";



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



GRANT ALL ON TABLE "public"."secoes" TO "anon";
GRANT ALL ON TABLE "public"."secoes" TO "authenticated";
GRANT ALL ON TABLE "public"."secoes" TO "service_role";



GRANT ALL ON TABLE "public"."sistemas_notas" TO "anon";
GRANT ALL ON TABLE "public"."sistemas_notas" TO "authenticated";
GRANT ALL ON TABLE "public"."sistemas_notas" TO "service_role";



GRANT ALL ON SEQUENCE "public"."staging_alunos_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."staging_alunos_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."staging_alunos_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."syllabi" TO "anon";
GRANT ALL ON TABLE "public"."syllabi" TO "authenticated";
GRANT ALL ON TABLE "public"."syllabi" TO "service_role";



GRANT ALL ON TABLE "public"."tabelas_mensalidade" TO "anon";
GRANT ALL ON TABLE "public"."tabelas_mensalidade" TO "authenticated";
GRANT ALL ON TABLE "public"."tabelas_mensalidade" TO "service_role";



GRANT ALL ON TABLE "public"."turma_disciplinas_professores" TO "anon";
GRANT ALL ON TABLE "public"."turma_disciplinas_professores" TO "authenticated";
GRANT ALL ON TABLE "public"."turma_disciplinas_professores" TO "service_role";



GRANT ALL ON TABLE "public"."turmas_auditoria" TO "anon";
GRANT ALL ON TABLE "public"."turmas_auditoria" TO "authenticated";
GRANT ALL ON TABLE "public"."turmas_auditoria" TO "service_role";



GRANT ALL ON TABLE "public"."v_financeiro_escola_dia" TO "anon";
GRANT ALL ON TABLE "public"."v_financeiro_escola_dia" TO "authenticated";
GRANT ALL ON TABLE "public"."v_financeiro_escola_dia" TO "service_role";



GRANT ALL ON TABLE "public"."v_freq_por_turma_dia" TO "anon";
GRANT ALL ON TABLE "public"."v_freq_por_turma_dia" TO "authenticated";
GRANT ALL ON TABLE "public"."v_freq_por_turma_dia" TO "service_role";



GRANT ALL ON TABLE "public"."v_top_turmas_hoje" TO "anon";
GRANT ALL ON TABLE "public"."v_top_turmas_hoje" TO "authenticated";
GRANT ALL ON TABLE "public"."v_top_turmas_hoje" TO "service_role";



GRANT ALL ON TABLE "public"."v_total_em_aberto_por_mes" TO "anon";
GRANT ALL ON TABLE "public"."v_total_em_aberto_por_mes" TO "authenticated";
GRANT ALL ON TABLE "public"."v_total_em_aberto_por_mes" TO "service_role";



GRANT ALL ON TABLE "public"."vw_admin_dashboard_counts" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_admin_dashboard_counts" TO "service_role";



GRANT ALL ON TABLE "public"."vw_admin_matriculas_por_mes" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_admin_matriculas_por_mes" TO "service_role";



GRANT ALL ON TABLE "public"."vw_admin_pending_turmas_count" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_admin_pending_turmas_count" TO "service_role";



GRANT ALL ON TABLE "public"."vw_admissoes_counts_por_status" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_admissoes_counts_por_status" TO "service_role";



GRANT ALL ON TABLE "public"."vw_alunos_active" TO "anon";
GRANT ALL ON TABLE "public"."vw_alunos_active" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_alunos_active" TO "service_role";



GRANT ALL ON TABLE "public"."vw_boletim_consolidado" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_boletim_consolidado" TO "service_role";



GRANT ALL ON TABLE "public"."vw_boletim_por_matricula" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_boletim_por_matricula" TO "service_role";



GRANT ALL ON TABLE "public"."vw_cursos_reais" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_cursos_reais" TO "service_role";



GRANT ALL ON TABLE "public"."vw_escola_ano_letivo_preferido" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_escola_ano_letivo_preferido" TO "service_role";



GRANT ALL ON TABLE "public"."vw_escola_estrutura_counts" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_escola_estrutura_counts" TO "service_role";



GRANT ALL ON TABLE "public"."vw_escola_setup_status" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_escola_setup_status" TO "service_role";



GRANT ALL ON TABLE "public"."vw_financeiro_cobrancas_diario" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_financeiro_cobrancas_diario" TO "service_role";



GRANT ALL ON TABLE "public"."vw_financeiro_kpis_geral" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_financeiro_kpis_geral" TO "service_role";



GRANT ALL ON TABLE "public"."vw_financeiro_kpis_mes" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_financeiro_kpis_mes" TO "service_role";



GRANT ALL ON TABLE "public"."vw_financeiro_radar_resumo" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_financeiro_radar_resumo" TO "service_role";



GRANT ALL ON TABLE "public"."vw_financeiro_sidebar_badges" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_financeiro_sidebar_badges" TO "service_role";



GRANT ALL ON TABLE "public"."vw_frequencia_resumo_aluno" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_frequencia_resumo_aluno" TO "service_role";



GRANT ALL ON TABLE "public"."vw_matriculas_secretaria" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_matriculas_secretaria" TO "service_role";



GRANT ALL ON TABLE "public"."vw_migracao_cursos_lookup" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_migracao_cursos_lookup" TO "service_role";



GRANT ALL ON TABLE "public"."vw_migracao_turmas_lookup" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_migracao_turmas_lookup" TO "service_role";



GRANT ALL ON TABLE "public"."vw_ocupacao_turmas" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_ocupacao_turmas" TO "service_role";



GRANT ALL ON TABLE "public"."vw_presencas_por_turma" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_presencas_por_turma" TO "service_role";



GRANT ALL ON TABLE "public"."vw_radar_inadimplencia" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_radar_inadimplencia" TO "service_role";



GRANT ALL ON TABLE "public"."vw_search_alunos" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_search_alunos" TO "service_role";



GRANT ALL ON TABLE "public"."vw_search_classes" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_search_classes" TO "service_role";



GRANT ALL ON TABLE "public"."vw_search_cursos" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_search_cursos" TO "service_role";



GRANT ALL ON TABLE "public"."vw_search_documentos" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_search_documentos" TO "service_role";



GRANT ALL ON TABLE "public"."vw_search_matriculas" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_search_matriculas" TO "service_role";



GRANT ALL ON TABLE "public"."vw_search_mensalidades" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_search_mensalidades" TO "service_role";



GRANT ALL ON TABLE "public"."vw_search_pagamentos" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_search_pagamentos" TO "service_role";



GRANT ALL ON TABLE "public"."vw_search_professores" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_search_professores" TO "service_role";



GRANT ALL ON TABLE "public"."vw_search_recibos" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_search_recibos" TO "service_role";



GRANT ALL ON TABLE "public"."vw_search_turmas" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_search_turmas" TO "service_role";



GRANT ALL ON TABLE "public"."vw_search_usuarios" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_search_usuarios" TO "service_role";



GRANT ALL ON TABLE "public"."vw_secretaria_dashboard_counts" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_secretaria_dashboard_counts" TO "service_role";



GRANT ALL ON TABLE "public"."vw_secretaria_dashboard_kpis" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_secretaria_dashboard_kpis" TO "service_role";



GRANT ALL ON TABLE "public"."vw_secretaria_matriculas_status" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_secretaria_matriculas_status" TO "service_role";



GRANT ALL ON TABLE "public"."vw_secretaria_matriculas_turma_status" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_secretaria_matriculas_turma_status" TO "service_role";



GRANT ALL ON TABLE "public"."vw_staging_alunos_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_staging_alunos_summary" TO "service_role";



GRANT ALL ON TABLE "public"."vw_total_em_aberto_por_mes" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_total_em_aberto_por_mes" TO "service_role";



GRANT ALL ON TABLE "public"."vw_turmas_para_matricula" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_turmas_para_matricula" TO "service_role";









GRANT ALL ON TABLE "internal"."mv_secretaria_dashboard_kpis" TO "anon";
GRANT ALL ON TABLE "internal"."mv_secretaria_dashboard_kpis" TO "authenticated";
GRANT ALL ON TABLE "internal"."mv_secretaria_dashboard_kpis" TO "service_role";



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































