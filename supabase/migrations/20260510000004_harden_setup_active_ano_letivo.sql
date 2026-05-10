-- Migration: 20260510000004_harden_setup_active_ano_letivo.sql
-- Descrição: Implementação de guardrails anti-rollback para ativação de ano letivo.
-- Objetivo: Impedir que uma escola em produção "volte no tempo" acidentalmente.

BEGIN;

CREATE OR REPLACE FUNCTION public.setup_active_ano_letivo(
  p_escola_id uuid,
  p_ano_data jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid := (p_ano_data->>'id')::uuid;
  v_ano int := (p_ano_data->>'ano')::int;
  v_data_inicio date := (p_ano_data->>'data_inicio')::date;
  v_data_fim date := (p_ano_data->>'data_fim')::date;
  v_ativo boolean := (p_ano_data->>'ativo')::boolean;
  v_allow_rollback boolean := COALESCE((p_ano_data->>'allow_rollback')::boolean, false);
  
  v_escola_id uuid := public.current_tenant_escola_id();
  v_has_permission boolean;
  v_old_record public.anos_letivos;
  v_new_record public.anos_letivos;
  v_actor_id uuid := auth.uid();
  
  v_max_ano_movimento int;
BEGIN
  -- 1. Validação de Contexto e Permissão
  IF v_escola_id IS NULL OR p_escola_id IS DISTINCT FROM v_escola_id THEN
    RAISE EXCEPTION 'AUTH: escola_id inválido.';
  END IF;
  
  SELECT public.user_has_role_in_school(v_escola_id, ARRAY['admin', 'admin_escola'])
  INTO v_has_permission;
  IF NOT v_has_permission THEN
    RAISE EXCEPTION 'AUTH: Permissão negada.';
  END IF;

  -- 2. GUARDRAIL ANTI-ROLLBACK (Epic E1)
  -- Se estiver tentando ativar um ano e NÃO for um rollback permitido explicitamente
  IF v_ativo THEN
    -- Busca o maior ano que já possui "movimento" (Matrículas ou Mensalidades)
    SELECT MAX(ano) INTO v_max_ano_movimento
    FROM (
      SELECT MAX(ano_letivo) as ano FROM public.matriculas WHERE escola_id = v_escola_id
      UNION ALL
      SELECT MAX(ano_referencia) as ano FROM public.mensalidades WHERE escola_id = v_escola_id
      UNION ALL
      SELECT MAX(ano) as ano FROM public.anos_letivos WHERE escola_id = v_escola_id AND ativo = true
    ) as movimentos;

    -- Se o ano alvo for menor que o ano atual com movimento, bloqueia
    IF v_max_ano_movimento IS NOT NULL AND v_ano < v_max_ano_movimento AND NOT v_allow_rollback THEN
      RAISE EXCEPTION 'ANO_LETIVO_ROLLBACK_BLOCKED: Não é permitido ativar o ano % pois já existe movimentação acadêmica/financeira em %. Use allow_rollback=true se estiver em ambiente de testes.', v_ano, v_max_ano_movimento
      USING ERRCODE = 'P0001', 
            DETAIL = jsonb_build_object('target_ano', v_ano, 'max_ano_movimento', v_max_ano_movimento)::text;
    END IF;
  END IF;

  -- 3. Lógica Original de Ativação
  IF v_id IS NOT NULL THEN
    SELECT * INTO v_old_record FROM public.anos_letivos WHERE id = v_id AND escola_id = v_escola_id;
  END IF;

  IF v_ativo THEN
    UPDATE public.anos_letivos
    SET ativo = false
    WHERE escola_id = v_escola_id
      AND ativo = true
      AND id IS DISTINCT FROM v_id;
  END IF;

  INSERT INTO public.anos_letivos (id, escola_id, ano, data_inicio, data_fim, ativo)
  VALUES (
    COALESCE(v_id, gen_random_uuid()),
    v_escola_id,
    v_ano,
    v_data_inicio,
    v_data_fim,
    v_ativo
  )
  ON CONFLICT (escola_id, ano) DO UPDATE SET
    data_inicio = EXCLUDED.data_inicio,
    data_fim = EXCLUDED.data_fim,
    ativo = EXCLUDED.ativo,
    updated_at = now()
  RETURNING * INTO v_new_record;

  -- 4. Auditoria
  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, before, after, portal)
  VALUES (
    v_escola_id,
    v_actor_id,
    CASE WHEN v_old_record IS NULL THEN 'CREATE' ELSE 'UPDATE' END,
    'anos_letivos',
    v_new_record.id::text,
    to_jsonb(v_old_record),
    to_jsonb(v_new_record),
    'admin'
  );

  RETURN to_jsonb(v_new_record);
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Database constraint violation: It is not possible to have two active school years at the same time.' USING ERRCODE = '23505';
  WHEN others THEN
    RAISE;
END;
$$;

COMMIT;
