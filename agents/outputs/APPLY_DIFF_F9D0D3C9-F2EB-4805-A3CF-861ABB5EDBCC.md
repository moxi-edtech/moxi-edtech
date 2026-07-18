# Diff proposto — DB lint, lote 1
run_id: F9D0D3C9-F2EB-4805-A3CF-861ABB5EDBCC
timestamp: 2026-07-18T12:37:08Z
commit_base: bd869804

Migration proposta: `supabase/migrations/20260718124000_fix_active_rpc_lint_batch_1.sql`

```diff
--- public.admin_recalc_all_aggregates()
+++ public.admin_recalc_all_aggregates()
@@
-      result := jsonb_set(result, '{processed}', (result->>'processed')::int + 1);
+      result := jsonb_set(
+        result,
+        '{processed}',
+        to_jsonb((result->>'processed')::int + 1)
+      );

--- public.claim_ai_usage_slot(uuid,uuid,text,text)
+++ public.claim_ai_usage_slot(uuid,uuid,text,text)
@@
-    RAISE EXCEPTION 'Muitas solicitações seguidas. Aguarde um minuto.' USING ERRCODE = 'limit_value_exceeded';
+    RAISE EXCEPTION 'Muitas solicitações seguidas. Aguarde um minuto.' USING ERRCODE = '22003';
@@
-    RAISE EXCEPTION 'Limite de uso diário do KLASSE AI atingido para esta escola.' USING ERRCODE = 'limit_value_exceeded';
+    RAISE EXCEPTION 'Limite de uso diário do KLASSE AI atingido para esta escola.' USING ERRCODE = '22003';
@@
-    RAISE EXCEPTION 'Limite de uso mensal do KLASSE AI atingido para esta escola.' USING ERRCODE = 'limit_value_exceeded';
+    RAISE EXCEPTION 'Limite de uso mensal do KLASSE AI atingido para esta escola.' USING ERRCODE = '22003';

--- public.increment_documento_print(uuid,uuid,text)
+++ public.increment_documento_print(uuid,uuid,text)
@@
-  UPDATE public.documentos_emitidos
-  SET print_count = COALESCE(print_count, 0) + 1,
+  UPDATE public.documentos_emitidos AS de
+  SET print_count = COALESCE(de.print_count, 0) + 1,
       last_printed_at = NOW()
-  WHERE id = p_doc_id
+  WHERE de.id = p_doc_id
   RETURNING * INTO v_doc;

--- public.registrar_venda_avulsa(uuid,uuid,uuid,integer,numeric,numeric,metodo_pagamento_enum,financeiro_status,text,uuid)
+++ public.registrar_venda_avulsa(uuid,uuid,uuid,integer,numeric,numeric,metodo_pagamento_enum,financeiro_status,text,uuid)
@@
-  update financeiro_itens
-     set estoque_atual = estoque_atual - case when v_item.controla_estoque then p_quantidade else 0 end,
+  update financeiro_itens as fi
+     set estoque_atual = fi.estoque_atual - case when v_item.controla_estoque then p_quantidade else 0 end,
          updated_at = now()
-   where id = v_item.id
-   returning estoque_atual into estoque_atual;
+   where fi.id = v_item.id
+   returning fi.estoque_atual into estoque_atual;
```

As assinaturas, grants, `SECURITY DEFINER`, `search_path`, tipos de retorno e payloads permanecem inalterados.
