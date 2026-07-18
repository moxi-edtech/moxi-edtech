BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.replace_function_fragment(
  p_function regprocedure,
  p_old text,
  p_new text
)
RETURNS void
LANGUAGE plpgsql
AS $helper$
DECLARE
  v_definition text;
BEGIN
  SELECT pg_get_functiondef(p_function::oid) INTO v_definition;
  IF strpos(v_definition, p_old) = 0 THEN
    RAISE EXCEPTION 'Expected fragment not found in %', p_function;
  END IF;
  EXECUTE replace(v_definition, p_old, p_new);
END;
$helper$;

SELECT pg_temp.replace_function_fragment(
  'public.realizar_pagamento_balcao(uuid,uuid,jsonb,text,numeric)'::regprocedure,
  $old$  v_lancamentos_ids uuid[] := '{}';
  v_mensalidades_pagas_ids uuid[] := '{}';$old$,
  $new$  v_lancamentos_ids uuid[] := ARRAY[]::uuid[];
  v_mensalidades_pagas_ids uuid[] := ARRAY[]::uuid[];$new$
);

SELECT pg_temp.replace_function_fragment(
  'public.realizar_pagamento_balcao(uuid,uuid,jsonb,text,numeric)'::regprocedure,
  $old$        p_metodo_pagamento,
        v_actor_id,$old$,
  $new$        p_metodo_pagamento::public.metodo_pagamento_enum,
        v_actor_id,$new$
);

SELECT pg_temp.replace_function_fragment(
  'public.realizar_pagamento_balcao(uuid,uuid,jsonb,text,numeric)'::regprocedure,
  $old$  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, portal, details)$old$,
  $new$  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details)$new$
);

SELECT pg_temp.replace_function_fragment(
  'public.confirmar_conciliacao_transacao(uuid,uuid,uuid,uuid,uuid)'::regprocedure,
  $old$            metodo_pagamento = v_transacao_importada.banco, -- Usar o banco como método inicial$old$,
  $new$            metodo_pagamento = 'transferencia', -- Método canónico para transação bancária$new$
);

SELECT pg_temp.replace_function_fragment(
  'public.confirmar_conciliacao_transacao(uuid,uuid,uuid,uuid,uuid)'::regprocedure,
  $old$        'conciliacao_bancaria',
        'Pagamento conciliado:$old$,
  $new$        (CASE WHEN p_mensalidade_id IS NULL THEN 'ajuste' ELSE 'mensalidade' END)::public.financeiro_origem,
        'Pagamento conciliado:$new$
);

SELECT pg_temp.replace_function_fragment(
  'public.confirmar_conciliacao_transacao(uuid,uuid,uuid,uuid,uuid)'::regprocedure,
  $old$        NOW(), -- Data de registro do lançamento
        v_transacao_importada.banco,
        v_actor_id,$old$,
  $new$        NOW(), -- Data de registro do lançamento
        'transferencia'::public.metodo_pagamento_enum,
        v_actor_id,$new$
);

COMMIT;
