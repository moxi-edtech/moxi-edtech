-- Fiscal/AGT recovery after main-alignment regression.
-- This migration supersedes the unapplied historical files 20260927230500,
-- 20260927231200 and 20260928002000. It preserves current live writers
-- and adapts BILL-018 to consolidated proof uploads.
--
-- IMPORTANT:
--   * This migration intentionally does NOT backfill public.pagamentos.idempotency_key.
--   * Historical NULL rows remain historical evidence.
--   * Only new payment operations become fail-closed on stable identity.

BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.fiscal_chaves') IS NULL THEN
    RAISE EXCEPTION 'RECOVERY_PREFLIGHT: public.fiscal_chaves missing';
  END IF;

  IF to_regclass('public.pagamentos') IS NULL THEN
    RAISE EXCEPTION 'RECOVERY_PREFLIGHT: public.pagamentos missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='pagamentos'
      AND column_name='idempotency_key'
  ) THEN
    RAISE EXCEPTION 'RECOVERY_PREFLIGHT: pagamentos.idempotency_key missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname='public'
      AND tablename='pagamentos'
      AND indexname='ux_pagamentos_escola_idempotency'
  ) THEN
    RAISE EXCEPTION 'RECOVERY_PREFLIGHT: ux_pagamentos_escola_idempotency missing';
  END IF;

  IF to_regprocedure(
    'public.aluno_submeter_comprovativo_pagamento(uuid,text,numeric,jsonb,text)'
  ) IS NULL THEN
    RAISE EXCEPTION 'RECOVERY_PREFLIGHT: singular comprovativo RPC missing';
  END IF;

  IF to_regprocedure(
    'public.aluno_submeter_comprovativo_pagamentos(uuid[],text,jsonb,text)'
  ) IS NULL THEN
    RAISE EXCEPTION 'RECOVERY_PREFLIGHT: consolidated comprovativo RPC missing';
  END IF;

  IF to_regprocedure(
    'public.financeiro_registrar_pagamento_secretaria(uuid,uuid,uuid,numeric,pagamento_metodo,text,text,text,jsonb)'
  ) IS NULL THEN
    RAISE EXCEPTION 'RECOVERY_PREFLIGHT: canonical secretaria payment writer missing';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public'
      AND p.proname NOT IN ('registrar_pagamento','realizar_pagamento_balcao')
      AND (
        pg_get_functiondef(p.oid) ~ 'registrar_pagamento\s*\('
        OR pg_get_functiondef(p.oid) ~ 'realizar_pagamento_balcao\s*\('
      )
  ) THEN
    RAISE EXCEPTION 'RECOVERY_PREFLIGHT: legacy payment RPC still has database callers';
  END IF;
END
$preflight$;

-- Key custody least privilege.
revoke all on table public.fiscal_chaves from public,anon,authenticated,service_role;
grant select on table public.fiscal_chaves to service_role;

-- Financial ledger append-only TRUNCATE hardening.
create or replace function public.financeiro_block_immutable_truncate()
returns trigger
language plpgsql
set search_path to 'pg_catalog','public'
as $$
begin
  raise exception 'IMMUTABILITY: histórico financeiro append-only não pode ser truncado';
end;
$$;

drop trigger if exists trg_fin_ledger_immutable_truncate on public.financeiro_ledger;
create trigger trg_fin_ledger_immutable_truncate
before truncate on public.financeiro_ledger
for each statement execute function public.financeiro_block_immutable_truncate();

drop trigger if exists trg_fin_estornos_immutable_truncate on public.financeiro_estornos;
create trigger trg_fin_estornos_immutable_truncate
before truncate on public.financeiro_estornos
for each statement execute function public.financeiro_block_immutable_truncate();

drop trigger if exists trg_fin_pag_reversao_immutable_truncate on public.financeiro_pagamento_reversoes;
create trigger trg_fin_pag_reversao_immutable_truncate
before truncate on public.financeiro_pagamento_reversoes
for each statement execute function public.financeiro_block_immutable_truncate();

drop trigger if exists trg_fin_pag_aloc_immutable_truncate on public.financeiro_pagamento_alocacoes;
create trigger trg_fin_pag_aloc_immutable_truncate
before truncate on public.financeiro_pagamento_alocacoes
for each statement execute function public.financeiro_block_immutable_truncate();

drop trigger if exists trg_fin_recibo_aloc_immutable_truncate on public.financeiro_recibo_alocacoes;
create trigger trg_fin_recibo_aloc_immutable_truncate
before truncate on public.financeiro_recibo_alocacoes
for each statement execute function public.financeiro_block_immutable_truncate();

revoke all on function public.financeiro_block_immutable_truncate()
  from public,anon,authenticated,service_role;
revoke all on function public.financeiro_block_immutable_row()
  from public,anon,authenticated,service_role;
revoke all on function public.fn_ledger_insert_once(
  uuid,uuid,text,text,text,uuid,text,integer,text,numeric,date,text,jsonb
) from public,anon,authenticated,service_role;

revoke references, trigger on table public.financeiro_ledger
  from anon,authenticated,service_role;
revoke references, trigger on table public.financeiro_estornos
  from anon,authenticated,service_role;
revoke references, trigger on table public.financeiro_pagamento_reversoes
  from anon,authenticated,service_role;
revoke references, trigger on table public.financeiro_pagamento_alocacoes
  from anon,authenticated,service_role;
revoke references, trigger on table public.financeiro_recibo_alocacoes
  from anon,authenticated,service_role;

-- Idempotent singular proof writer.
CREATE OR REPLACE FUNCTION public.aluno_submeter_comprovativo_pagamento(p_mensalidade_id uuid, p_evidence_url text, p_valor_informado numeric DEFAULT NULL::numeric, p_meta jsonb DEFAULT '{}'::jsonb, p_mensagem text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth', 'extensions'
AS $function$
DECLARE
  v_actor_id uuid := public.safe_auth_uid();
  v_escola_id uuid := public.current_tenant_escola_id();
  v_actor_email text;
  v_mensalidade public.mensalidades%ROWTYPE;
  v_pagamento public.pagamentos%ROWTYPE;
  v_valor_pendente numeric(12,2);
  v_valor_submetido numeric(12,2);
  v_idempotency_key text := NULLIF(btrim(COALESCE(p_meta->>'idempotency_key', '')), '');
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'AUTH: not_authenticated';
  END IF;

  IF v_escola_id IS NULL THEN
    RAISE EXCEPTION 'AUTH: tenant_not_resolved';
  END IF;

  IF v_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'IDEMPOTENCY: idempotency_key obrigatória';
  END IF;

  IF char_length(v_idempotency_key) > 200 THEN
    RAISE EXCEPTION 'IDEMPOTENCY: idempotency_key excede 200 caracteres';
  END IF;

  IF p_mensalidade_id IS NULL THEN
    RAISE EXCEPTION 'DATA: mensalidade_id obrigatório';
  END IF;

  IF COALESCE(trim(p_evidence_url), '') = '' THEN
    RAISE EXCEPTION 'DATA: evidence_url obrigatório';
  END IF;

  SELECT *
    INTO v_mensalidade
  FROM public.mensalidades
  WHERE id = p_mensalidade_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DATA: mensalidade não encontrada';
  END IF;

  IF v_mensalidade.escola_id IS DISTINCT FROM v_escola_id THEN
    RAISE EXCEPTION 'AUTH: cross_tenant_forbidden';
  END IF;

  SELECT u.email
    INTO v_actor_email
  FROM auth.users u
  WHERE u.id = v_actor_id;

  IF NOT EXISTS (
    SELECT 1
    FROM public.alunos a
    WHERE a.id = v_mensalidade.aluno_id
      AND a.escola_id = v_escola_id
      AND (
        a.profile_id = v_actor_id
        OR EXISTS (
          SELECT 1
          FROM public.aluno_encarregados ae
          JOIN public.encarregados e ON e.id = ae.encarregado_id
          WHERE ae.aluno_id = a.id
            AND ae.escola_id = v_escola_id
            AND e.escola_id = v_escola_id
            AND COALESCE(lower(e.email), '') = COALESCE(lower(v_actor_email), '')
        )
      )
  ) THEN
    RAISE EXCEPTION 'AUTH: aluno_not_allowed';
  END IF;

  IF COALESCE(v_mensalidade.status, 'pendente') = 'pago' THEN
    RAISE EXCEPTION 'DATA: mensalidade já paga';
  END IF;

  v_valor_pendente := GREATEST(
    COALESCE(v_mensalidade.valor_previsto, v_mensalidade.valor, 0) - COALESCE(v_mensalidade.valor_pago_total, 0),
    0
  );

  IF v_valor_pendente <= 0 THEN
    RAISE EXCEPTION 'DATA: mensalidade sem saldo pendente';
  END IF;

  v_valor_submetido := COALESCE(p_valor_informado, v_valor_pendente);

  IF v_valor_submetido <= 0 THEN
    RAISE EXCEPTION 'DATA: valor_informado inválido';
  END IF;

  IF v_valor_submetido > v_valor_pendente + 0.01 THEN
    RAISE EXCEPTION 'DATA: valor_informado excede saldo pendente';
  END IF;

  IF v_valor_submetido < v_valor_pendente - 0.01
     AND v_mensalidade.fiscal_documento_id IS NULL THEN
    RAISE EXCEPTION
      'STATE: comprovativo parcial exige FT/ND fiscal prévia; contacte a secretaria para preparar a factura antes do pagamento parcial';
  END IF;

  IF v_valor_submetido < v_valor_pendente - 0.01
     AND NOT EXISTS (
       SELECT 1
       FROM public.fiscal_documentos d
       WHERE d.id = v_mensalidade.fiscal_documento_id
         AND d.tipo_documento IN ('FT','ND')
         AND d.status = 'emitido'
     ) THEN
    RAISE EXCEPTION
      'STATE: documento fiscal origem do pagamento parcial não está emitido';
  END IF;

  SELECT *
    INTO v_pagamento
  FROM public.pagamentos
  WHERE escola_id = v_escola_id
    AND idempotency_key = v_idempotency_key
  LIMIT 1;

  IF FOUND THEN
    IF v_pagamento.mensalidade_id IS DISTINCT FROM v_mensalidade.id
       OR v_pagamento.created_by IS DISTINCT FROM v_actor_id THEN
      RAISE EXCEPTION 'IDEMPOTENCY: chave já usada por outro pagamento';
    END IF;

    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'pagamento_id', v_pagamento.id,
      'valor_enviado', v_pagamento.valor_pago,
      'status', v_pagamento.status
    );
  END IF;

  -- Bloquear se já existe um pagamento pendente de OUTRO utilizador para esta mensalidade
  IF EXISTS (
    SELECT 1 FROM public.pagamentos
    WHERE mensalidade_id = v_mensalidade.id
      AND status = 'pending'
      AND created_by IS DISTINCT FROM v_actor_id
  ) THEN
    RAISE EXCEPTION 'DATA: Já existe um comprovativo pendente de validação para esta mensalidade enviado por outro utilizador.';
  END IF;

  SELECT *
    INTO v_pagamento
  FROM public.pagamentos
  WHERE escola_id = v_escola_id
    AND mensalidade_id = v_mensalidade.id
    AND status = 'pending'
    AND created_by = v_actor_id
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.pagamentos
    SET evidence_url = p_evidence_url,
        valor_pago = v_valor_submetido,
        updated_at = now(),
        meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object(
          'comprovativo',
          jsonb_build_object(
            'resubmitted_at', now(),
            'resubmitted_by', v_actor_id,
            'mensagem_aluno', NULLIF(trim(p_mensagem), '')
          )
        ) || COALESCE(p_meta, '{}'::jsonb)
    WHERE id = v_pagamento.id
    RETURNING * INTO v_pagamento;

    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'pagamento_id', v_pagamento.id,
      'valor_enviado', v_pagamento.valor_pago,
      'status', v_pagamento.status
    );
  END IF;

  INSERT INTO public.pagamentos (
    escola_id,
    aluno_id,
    mensalidade_id,
    valor_pago,
    data_pagamento,
    metodo,
    metodo_pagamento,
    status,
    evidence_url,
    created_by,
    idempotency_key,
    meta
  ) VALUES (
    v_escola_id,
    v_mensalidade.aluno_id,
    v_mensalidade.id,
    v_valor_submetido,
    CURRENT_DATE,
    'transfer',
    'transferencia',
    'pending',
    p_evidence_url,
    v_actor_id,
    v_idempotency_key,
    COALESCE(p_meta, '{}'::jsonb) || jsonb_build_object(
      'origem', 'portal_aluno_upload_comprovativo',
      'submitted_at', now(),
      'submitted_by', v_actor_id,
      'comprovativo', jsonb_build_object(
        'mensagem_aluno', NULLIF(trim(p_mensagem), '')
      )
    )
  )
  RETURNING * INTO v_pagamento;

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'pagamento_id', v_pagamento.id,
    'valor_enviado', v_pagamento.valor_pago,
    'status', v_pagamento.status
  );
END;
$function$;

-- Consolidated proof writer adapted to current multi-month flow.
CREATE OR REPLACE FUNCTION public.aluno_submeter_comprovativo_pagamentos(
  p_mensalidade_ids uuid[],
  p_evidence_url text,
  p_meta jsonb DEFAULT '{}'::jsonb,
  p_mensagem text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'pg_catalog', 'public', 'auth', 'extensions'
AS $function$
DECLARE
  v_ids uuid[];
  v_id uuid;
  v_parent_key text := NULLIF(btrim(COALESCE(p_meta->>'idempotency_key', '')), '');
  v_child_key text;
  v_lote_hash text;
  v_lote_id uuid;
  v_result jsonb;
  v_pagamento_ids uuid[] := ARRAY[]::uuid[];
  v_total numeric(14,2) := 0;
  v_all_idempotent boolean := true;
BEGIN
  IF v_parent_key IS NULL THEN
    RAISE EXCEPTION 'IDEMPOTENCY: idempotency_key obrigatória';
  END IF;

  IF char_length(v_parent_key) > 200 THEN
    RAISE EXCEPTION 'IDEMPOTENCY: idempotency_key excede 200 caracteres';
  END IF;

  SELECT array_agg(DISTINCT id ORDER BY id)
    INTO v_ids
  FROM unnest(COALESCE(p_mensalidade_ids, ARRAY[]::uuid[])) AS ids(id)
  WHERE id IS NOT NULL;

  IF COALESCE(array_length(v_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'DATA: seleccione pelo menos uma mensalidade';
  END IF;

  IF array_length(v_ids, 1) > 24 THEN
    RAISE EXCEPTION 'DATA: máximo de 24 mensalidades por comprovativo';
  END IF;

  -- Serialize identical retries/races before deriving child identities.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('aluno-comprovativo:' || v_parent_key, 0)
  );

  -- Stable lote identity for the same parent operation.
  v_lote_hash := md5(v_parent_key);
  v_lote_id := (
    substr(v_lote_hash, 1, 8) || '-' ||
    substr(v_lote_hash, 9, 4) || '-' ||
    substr(v_lote_hash, 13, 4) || '-' ||
    substr(v_lote_hash, 17, 4) || '-' ||
    substr(v_lote_hash, 21, 12)
  )::uuid;

  FOREACH v_id IN ARRAY v_ids LOOP
    v_child_key :=
      'aluno-comprovativo-item:' ||
      md5(v_parent_key || ':' || v_id::text);

    v_result := public.aluno_submeter_comprovativo_pagamento(
      v_id,
      p_evidence_url,
      NULL,
      (COALESCE(p_meta, '{}'::jsonb) - 'idempotency_key')
        || jsonb_build_object(
          'idempotency_key', v_child_key,
          'batch_idempotency_key', v_parent_key,
          'lote_id', v_lote_id,
          'lote_quantidade', array_length(v_ids, 1),
          'lote_mensalidade_ids', to_jsonb(v_ids),
          'origem', 'portal_aluno_comprovativo_consolidado'
        ),
      p_mensagem
    );

    IF COALESCE((v_result->>'ok')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'DATA: falha ao registar mensalidade %', v_id;
    END IF;

    v_pagamento_ids := array_append(
      v_pagamento_ids,
      (v_result->>'pagamento_id')::uuid
    );
    v_total := v_total + COALESCE((v_result->>'valor_enviado')::numeric, 0);

    IF COALESCE((v_result->>'idempotent')::boolean, false) IS NOT TRUE THEN
      v_all_idempotent := false;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', v_all_idempotent,
    'lote_id', v_lote_id,
    'pagamento_ids', to_jsonb(v_pagamento_ids),
    'mensalidade_ids', to_jsonb(v_ids),
    'quantidade', array_length(v_ids, 1),
    'valor_total', v_total,
    'status', 'pending'
  );
END;
$function$;

-- Fail-closed payment identity guards.
CREATE OR REPLACE FUNCTION public.financeiro_guard_pagamento_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_idempotency_key text;
  v_external_ref text;
BEGIN
  -- Prefer the canonical column. Compatibility writers may supply the same
  -- identity in meta while they are being migrated.
  v_idempotency_key :=
    NULLIF(btrim(COALESCE(NEW.idempotency_key, '')), '');

  IF v_idempotency_key IS NULL THEN
    v_idempotency_key :=
      NULLIF(btrim(COALESCE(NEW.meta->>'idempotency_key', '')), '');
  END IF;

  -- pagamento_intents has a durable UUID identity and is safe to derive from.
  IF v_idempotency_key IS NULL
     AND NEW.pagamento_intent_id IS NOT NULL THEN
    v_idempotency_key := format('intent:%s', NEW.pagamento_intent_id);
  END IF;

  -- Provider-originated rows may use the provider transaction identity.
  -- Never derive from amount/date/student because equal legitimate payments
  -- must remain distinct operations.
  IF v_idempotency_key IS NULL THEN
    v_external_ref :=
      NULLIF(btrim(COALESCE(NEW.transacao_id_externo, '')), '');

    IF v_external_ref IS NOT NULL THEN
      v_idempotency_key := format('provider-tx:%s', v_external_ref);
    END IF;
  END IF;

  IF v_idempotency_key IS NULL THEN
    RAISE EXCEPTION
      'IDEMPOTENCY: novos pagamentos exigem idempotency_key estável';
  END IF;

  IF char_length(v_idempotency_key) > 200 THEN
    RAISE EXCEPTION
      'IDEMPOTENCY: idempotency_key excede 200 caracteres';
  END IF;

  NEW.idempotency_key := v_idempotency_key;

  IF current_user <> 'postgres'
     AND NEW.status IN ('settled','concluido','pago','confirmed','paid','succeeded') THEN
    RAISE EXCEPTION
      'IMMUTABILITY: pagamento liquidado deve ser criado/liquidado por RPC canónica';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.financeiro_guard_pagamento_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  -- Operation identity is immutable even for SECURITY DEFINER payment writers.
  -- This also guarantees that historical NULL rows are never "backfilled" as
  -- a side effect of a later settlement/update.
  IF NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key THEN
    RAISE EXCEPTION
      'IMMUTABILITY: idempotency_key do pagamento não pode ser alterada';
  END IF;

  IF current_user <> 'postgres' THEN
    IF
      (to_jsonb(NEW) - ARRAY['status_fiscal','fiscal_documento_id','fiscal_error','updated_at']::text[])
      IS DISTINCT FROM
      (to_jsonb(OLD) - ARRAY['status_fiscal','fiscal_documento_id','fiscal_error','updated_at']::text[])
    THEN
      RAISE EXCEPTION
        'IMMUTABILITY: alterações financeiras do pagamento exigem RPC canónica';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

ALTER FUNCTION public.aluno_submeter_comprovativo_pagamento(
  uuid, text, numeric, jsonb, text
) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.aluno_submeter_comprovativo_pagamento(
  uuid, text, numeric, jsonb, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aluno_submeter_comprovativo_pagamento(
  uuid, text, numeric, jsonb, text
) TO authenticated, service_role;

ALTER FUNCTION public.aluno_submeter_comprovativo_pagamentos(
  uuid[], text, jsonb, text
) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.aluno_submeter_comprovativo_pagamentos(
  uuid[], text, jsonb, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aluno_submeter_comprovativo_pagamentos(
  uuid[], text, jsonb, text
) TO authenticated, service_role;

-- Repository and live-database call-site audits found no remaining callers.
REVOKE ALL PRIVILEGES
ON FUNCTION public.registrar_pagamento(uuid,text,text,numeric,date)
FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES
ON FUNCTION public.realizar_pagamento_balcao(uuid,uuid,jsonb,text,numeric)
FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON COLUMN public.pagamentos.idempotency_key IS
  'BILL-018 recovery: stable identity required for every new payment; historical NULL rows are intentionally preserved.';

COMMENT ON FUNCTION public.financeiro_guard_pagamento_insert() IS
  'BILL-018 recovery: fail-closed idempotency guard for newly inserted payments.';

COMMENT ON FUNCTION public.financeiro_guard_pagamento_update() IS
  'BILL-018 recovery: payment financial guard plus immutable idempotency identity.';

COMMIT;
