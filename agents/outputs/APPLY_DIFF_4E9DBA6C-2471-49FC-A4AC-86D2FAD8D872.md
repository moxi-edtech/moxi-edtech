# Diff proposto — DB lint, lote 5 financeiro completo
run_id: 4E9DBA6C-2471-49FC-A4AC-86D2FAD8D872
timestamp: 2026-07-18T12:54:16Z
commit_base: ec64b73c

Migration proposta: `supabase/migrations/20260718133000_fix_finance_rpc_lint_complete.sql`

```diff
--- public.realizar_pagamento_balcao(uuid,uuid,jsonb,text,numeric)
+++ public.realizar_pagamento_balcao(uuid,uuid,jsonb,text,numeric)
@@
-  v_lancamentos_ids uuid[] := '{}';
-  v_mensalidades_pagas_ids uuid[] := '{}';
+  v_lancamentos_ids uuid[] := ARRAY[]::uuid[];
+  v_mensalidades_pagas_ids uuid[] := ARRAY[]::uuid[];
@@
-        p_metodo_pagamento,
+        p_metodo_pagamento::public.metodo_pagamento_enum,
@@
-  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, portal, details)
+  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details)

--- public.confirmar_conciliacao_transacao(uuid,uuid,uuid,uuid,uuid)
+++ public.confirmar_conciliacao_transacao(uuid,uuid,uuid,uuid,uuid)
@@
-            metodo_pagamento = v_transacao_importada.banco,
+            metodo_pagamento = 'transferencia',
@@
-        'conciliacao_bancaria',
+        (CASE WHEN p_mensalidade_id IS NULL THEN 'ajuste' ELSE 'mensalidade' END)::public.financeiro_origem,
@@
-        v_transacao_importada.banco,
+        'transferencia'::public.metodo_pagamento_enum,
```

As assinaturas e retornos permanecem inalterados. O nome do banco continua na
descrição e no registo importado; o lançamento usa enums canónicos.

