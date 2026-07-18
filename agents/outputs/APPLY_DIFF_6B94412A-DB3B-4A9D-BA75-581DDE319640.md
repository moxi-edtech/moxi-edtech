# Diff proposto — DB lint, lote 4 financeiro
run_id: 6B94412A-DB3B-4A9D-BA75-581DDE319640
timestamp: 2026-07-18T12:51:51Z
commit_base: 86b0cc34

Migration proposta: `supabase/migrations/20260718132000_fix_finance_rpc_enum_lint.sql`

```diff
--- public.aprovar_fecho_caixa(uuid)
+++ public.aprovar_fecho_caixa(uuid)
@@
-        WHEN lower(l.metodo_pagamento) IN ('numerario', 'dinheiro') THEN 'especie'
-        WHEN lower(l.metodo_pagamento) IN ('multicaixa', 'tpa') THEN 'tpa'
+        WHEN lower(l.metodo_pagamento::text) IN ('numerario', 'dinheiro') THEN 'especie'
+        WHEN lower(l.metodo_pagamento::text) IN ('multicaixa', 'tpa') THEN 'tpa'

--- public.realizar_pagamento_balcao(uuid,uuid,jsonb,text,numeric)
+++ public.realizar_pagamento_balcao(uuid,uuid,jsonb,text,numeric)
@@
-        p_metodo_pagamento,
+        p_metodo_pagamento::public.metodo_pagamento_enum,

--- public.confirmar_conciliacao_transacao(uuid,uuid,uuid,uuid,uuid)
+++ public.confirmar_conciliacao_transacao(uuid,uuid,uuid,uuid,uuid)
@@
-            metodo_pagamento = v_transacao_importada.banco,
+            metodo_pagamento = 'transferencia',
@@
-        'conciliacao_bancaria',
+        CASE WHEN p_mensalidade_id IS NULL THEN 'ajuste' ELSE 'mensalidade' END,
@@
-        v_transacao_importada.banco,
+        'transferencia',
```

Os valores usados existem nos enums atuais. `conciliacao_bancaria` não existe em
`financeiro_origem`; uma conciliação vinculada passa a `mensalidade`, e uma sem
mensalidade passa a `ajuste`. Transações bancárias usam `transferencia` como
método canónico, preservando o nome do banco na descrição e na origem importada.

