-- BILL-018 — payment idempotency hardening.
--
-- IMPORTANT:
--   * This migration intentionally does NOT backfill public.pagamentos.idempotency_key.
--   * Historical NULL rows remain historical evidence.
--   * Enforcement is performed by the existing BEFORE INSERT guard, so only new rows
--     are required to carry a stable operation identity.
--   * Apply only after staging/readiness validation of every payment writer.

BEGIN;

DO $preflight$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='pagamentos'
      AND column_name='idempotency_key'
  ) THEN
    RAISE EXCEPTION 'BILL018_PREFLIGHT: pagamentos.idempotency_key missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname='public'
      AND tablename='pagamentos'
      AND indexname='ux_pagamentos_escola_idempotency'
  ) THEN
    RAISE EXCEPTION 'BILL018_PREFLIGHT: ux_pagamentos_escola_idempotency missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid=t.tgrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public'
      AND c.relname='pagamentos'
      AND t.tgname='trg_pagamentos_financial_insert_guard'
      AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION 'BILL018_PREFLIGHT: payment INSERT guard trigger missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid=t.tgrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public'
      AND c.relname='pagamentos'
      AND t.tgname='trg_pagamentos_financial_update_guard'
      AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION 'BILL018_PREFLIGHT: payment UPDATE guard trigger missing';
  END IF;
END
$preflight$;

-- Fix the remaining SQL writers before enabling the fail-closed table guard.
-- Both definitions are based on the live schema/function bodies captured during
-- BILL-018 discovery; only payment identity semantics are changed.

CREATE OR REPLACE FUNCTION public.finance_confirm_payment(p_intent_id uuid, p_dedupe_key_override text DEFAULT NULL::text)
 RETURNS finance_payment_intents
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
          escola_id,
          idempotency_key
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
          v_intent.escola_id,
          format('finance-intent:%s', v_intent.id)
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
$function$;

CREATE OR REPLACE FUNCTION public.aluno_submeter_comprovativo_pagamento(p_mensalidade_id uuid, p_evidence_url text, p_valor_informado numeric DEFAULT NULL::numeric, p_meta jsonb DEFAULT '{}'::jsonb, p_mensagem text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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

-- These compatibility RPCs cannot satisfy a stable retry identity because
-- their signatures do not accept one. Repository call-site audit found no
-- active application caller and production has zero rows with
-- meta.origem='registrar_pagamento_compat'. Keep the functions for forensic
-- compatibility, but remove application execution rights.
REVOKE ALL PRIVILEGES
ON FUNCTION public.registrar_pagamento(uuid,text,text,numeric,date)
FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES
ON FUNCTION public.realizar_pagamento_balcao(uuid,uuid,jsonb,text,numeric)
FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON COLUMN public.pagamentos.idempotency_key IS
  'BILL-018: stable identity required for every new payment; historical NULL rows are intentionally preserved.';

COMMENT ON FUNCTION public.financeiro_guard_pagamento_insert() IS
  'BILL-018: fail-closed idempotency guard for newly inserted payments.';

COMMENT ON FUNCTION public.financeiro_guard_pagamento_update() IS
  'BILL-018: payment financial guard plus immutable idempotency identity.';

COMMIT;
