BEGIN;

-- =========================================================
-- PASSO 1: CRIAR A FUNÇÃO RPC PARA ATUALIZAÇÃO ATÔMICA E AUDITADA
-- Centraliza a lógica de negócio no banco de dados para segurança e consistência.
-- =========================================================

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
  
  v_old_record public.anos_letivos;
  v_new_record public.anos_letivos;
  
  v_actor_id uuid := auth.uid();
  
BEGIN
  -- Buscar o registro antigo para auditoria, se existir
  IF v_id IS NOT NULL THEN
    SELECT * INTO v_old_record FROM public.anos_letivos WHERE id = v_id AND escola_id = p_escola_id;
  END IF;

  -- Se o novo ano for ativo, desativar qualquer outro que esteja ativo na mesma escola.
  -- Esta abordagem garante que a transição (desativar um para ativar outro) seja explícita e atômica.
  IF v_ativo THEN
    UPDATE public.anos_letivos
    SET ativo = false
    WHERE
      escola_id = p_escola_id
      AND ativo = true
      AND id IS DISTINCT FROM v_id; -- Não desativa a si mesmo se já for o ativo
  END IF;
  
  -- Inserir ou atualizar o ano letivo
  INSERT INTO public.anos_letivos (id, escola_id, ano, data_inicio, data_fim, ativo)
  VALUES (
    COALESCE(v_id, gen_random_uuid()),
    p_escola_id,
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

  -- =========================================================
  -- PASSO 2: INSERIR REGISTRO DE AUDITORIA (REQUISITO P0)
  -- =========================================================
  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, before, after, portal)
  VALUES (
    p_escola_id,
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
    -- O índice unique `uq_anos_letivos_ativo_por_escola` nos protege de race conditions.
    RAISE EXCEPTION 'Database constraint violation: It is not possible to have two active school years at the same time.' USING ERRCODE = '23505';
  WHEN others THEN
    RAISE;
END;
$$;

ALTER FUNCTION public.setup_active_ano_letivo(uuid, jsonb) OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.setup_active_ano_letivo(uuid, jsonb) TO authenticated;

COMMIT;
