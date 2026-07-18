BEGIN;

CREATE OR REPLACE FUNCTION public.admin_recalc_all_aggregates()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  escola_record record;
  result jsonb := '{"processed": 0, "errors": []}'::jsonb;
BEGIN
  FOR escola_record IN SELECT id FROM escolas WHERE status = 'ativa'
  LOOP
    BEGIN
      PERFORM recalc_escola_financeiro_totals(
        escola_record.id,
        date_trunc('month', now())::date
      );
      result := jsonb_set(
        result,
        '{processed}',
        to_jsonb((result->>'processed')::int + 1)
      );
    EXCEPTION WHEN OTHERS THEN
      result := jsonb_set(
        result,
        '{errors}',
        (result->'errors') || jsonb_build_object(
          'escola_id', escola_record.id,
          'error', SQLERRM
        )
      );
    END;
  END LOOP;

  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.claim_ai_usage_slot(
  p_school_id uuid,
  p_user_id uuid,
  p_feature text,
  p_prompt_template_key text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'extensions', 'pg_catalog'
AS $function$
DECLARE
  v_daily_limit integer;
  v_monthly_limit integer;
  v_daily_count integer;
  v_monthly_count integer;
  v_minute_count integer;
  v_template_id uuid;
  v_log_id uuid;
  v_now timestamptz := now();
  v_start_of_day timestamptz := date_trunc('day', v_now);
  v_start_of_month timestamptz := date_trunc('month', v_now);
  v_one_minute_ago timestamptz := v_now - interval '1 minute';
  v_pending_expiry timestamptz := v_now - interval '2 minutes';
BEGIN
  IF p_school_id IS NULL THEN
    RAISE EXCEPTION 'school_id_required' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id_required' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT daily_limit, monthly_limit
  INTO v_daily_limit, v_monthly_limit
  FROM public.ai_school_settings
  WHERE school_id = p_school_id
    AND enabled = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A IA não está configurada ou habilitada para esta escola.'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT count(*)
  INTO v_minute_count
  FROM public.ai_usage_logs
  WHERE school_id = p_school_id
    AND user_id = p_user_id
    AND created_at >= v_one_minute_ago;

  IF v_minute_count >= 10 THEN
    RAISE EXCEPTION 'Muitas solicitações seguidas. Aguarde um minuto.'
      USING ERRCODE = '22003';
  END IF;

  SELECT count(*)
  INTO v_daily_count
  FROM public.ai_usage_logs
  WHERE school_id = p_school_id
    AND (status = 'success' OR (status = 'pending' AND created_at >= v_pending_expiry))
    AND created_at >= v_start_of_day;

  IF v_daily_count >= v_daily_limit THEN
    RAISE EXCEPTION 'Limite de uso diário do KLASSE AI atingido para esta escola.'
      USING ERRCODE = '22003';
  END IF;

  SELECT count(*)
  INTO v_monthly_count
  FROM public.ai_usage_logs
  WHERE school_id = p_school_id
    AND (status = 'success' OR (status = 'pending' AND created_at >= v_pending_expiry))
    AND created_at >= v_start_of_month;

  IF v_monthly_count >= v_monthly_limit THEN
    RAISE EXCEPTION 'Limite de uso mensal do KLASSE AI atingido para esta escola.'
      USING ERRCODE = '22003';
  END IF;

  IF p_prompt_template_key IS NOT NULL AND p_prompt_template_key <> '' THEN
    SELECT id
    INTO v_template_id
    FROM public.ai_prompt_templates
    WHERE key = p_prompt_template_key
      AND is_active = true;
  END IF;

  INSERT INTO public.ai_usage_logs (
    school_id,
    user_id,
    feature,
    prompt_template_id,
    status,
    created_at
  )
  VALUES (
    p_school_id,
    p_user_id,
    p_feature,
    v_template_id,
    'pending',
    v_now
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_documento_print(
  p_doc_id uuid,
  p_actor_id uuid DEFAULT NULL::uuid,
  p_actor_email text DEFAULT NULL::text
)
RETURNS TABLE(print_count integer, last_printed_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_doc public.documentos_emitidos%ROWTYPE;
BEGIN
  UPDATE public.documentos_emitidos AS de
  SET print_count = coalesce(de.print_count, 0) + 1,
      last_printed_at = now()
  WHERE de.id = p_doc_id
  RETURNING * INTO v_doc;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DOCUMENTO_NOT_FOUND';
  END IF;

  INSERT INTO public.audit_logs (
    escola_id,
    user_id,
    user_email,
    portal,
    acao,
    tabela,
    entity,
    entity_id,
    details
  ) VALUES (
    v_doc.escola_id,
    p_actor_id,
    p_actor_email,
    'secretaria',
    'documento_recibo_reprint',
    'documentos_emitidos',
    'documentos_emitidos',
    v_doc.id,
    jsonb_build_object(
      'doc_id', v_doc.id,
      'via', greatest(coalesce(v_doc.print_count, 0), 1),
      'print_count', coalesce(v_doc.print_count, 0),
      'timestamp', now()
    )
  );

  RETURN QUERY SELECT v_doc.print_count, v_doc.last_printed_at;
END;
$function$;

CREATE OR REPLACE FUNCTION public.registrar_venda_avulsa(
  p_escola_id uuid,
  p_aluno_id uuid,
  p_item_id uuid,
  p_quantidade integer,
  p_valor_unit numeric,
  p_desconto numeric DEFAULT 0,
  p_metodo_pagamento metodo_pagamento_enum DEFAULT 'numerario'::metodo_pagamento_enum,
  p_status financeiro_status DEFAULT 'pago'::financeiro_status,
  p_descricao text DEFAULT NULL::text,
  p_created_by uuid DEFAULT NULL::uuid
)
RETURNS TABLE(lancamento_id uuid, estoque_atual integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_item financeiro_itens%ROWTYPE;
  v_total numeric(12,2);
  v_desc text;
BEGIN
  IF p_quantidade IS NULL OR p_quantidade <= 0 THEN
    RAISE EXCEPTION 'Quantidade inválida';
  END IF;

  SELECT *
  INTO v_item
  FROM financeiro_itens
  WHERE id = p_item_id
    AND escola_id = p_escola_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item não encontrado para a escola';
  END IF;

  IF v_item.controla_estoque AND v_item.estoque_atual < p_quantidade THEN
    RAISE EXCEPTION 'Estoque insuficiente';
  END IF;

  v_total := coalesce(p_valor_unit, v_item.preco) * p_quantidade;
  v_desc := coalesce(p_descricao, 'Venda de ' || v_item.nome);

  UPDATE financeiro_itens AS fi
  SET estoque_atual = fi.estoque_atual
        - CASE WHEN v_item.controla_estoque THEN p_quantidade ELSE 0 END,
      updated_at = now()
  WHERE fi.id = v_item.id
  RETURNING fi.estoque_atual INTO estoque_atual;

  INSERT INTO financeiro_lancamentos (
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
  ) VALUES (
    p_escola_id,
    p_aluno_id,
    NULL,
    'debito',
    'venda_avulsa',
    v_desc,
    v_total,
    0,
    coalesce(p_desconto, 0),
    coalesce(p_status, 'pago'),
    CASE WHEN coalesce(p_status, 'pago') = 'pago' THEN now() ELSE NULL END,
    p_metodo_pagamento,
    p_created_by
  ) RETURNING id INTO lancamento_id;

  RETURN NEXT;
END;
$function$;

COMMIT;
