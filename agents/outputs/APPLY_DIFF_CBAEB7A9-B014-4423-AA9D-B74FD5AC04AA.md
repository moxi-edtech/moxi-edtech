# Diff proposto — DB lint, lote 9 pesquisa paginada
run_id: CBAEB7A9-B014-4423-AA9D-B74FD5AC04AA
timestamp: 2026-07-18T13:06:09Z
commit_base: f12d43a2

Migration proposta: `supabase/migrations/20260718141000_fix_paginated_search_aliases.sql`

```diff
--- public.search_alunos_global_min(...cursor...)
+++ public.search_alunos_global_min(...cursor...)
@@
-    FROM base
+    FROM base AS base_row
     WHERE NOT v_has_cursor
-       OR (score, updated_at_sort, created_at, id)
+       OR (base_row.score, base_row.updated_at_sort, base_row.created_at, base_row.id)
@@
-    FROM filtered
-    ORDER BY score DESC, updated_at_sort DESC, created_at DESC, id DESC
+    FROM filtered AS filtered_row
+    ORDER BY filtered_row.score DESC, filtered_row.updated_at_sort DESC,
+             filtered_row.created_at DESC, filtered_row.id DESC
@@
+ALTER FUNCTION public.search_alunos_global_min(...cursor...)
+  SET search_path = public, extensions;

--- public.search_global_entities(...cursor...)
+++ public.search_global_entities(...cursor...)
@@
-    from ranked
+    from ranked as ranked_row
     where not v_has_cursor
-       or (score, updated_at, created_at, id)
+       or (ranked_row.score, ranked_row.updated_at,
+           ranked_row.created_at, ranked_row.id)
@@
-    from filtered
-    order by score desc, updated_at desc, created_at desc, id desc
+    from filtered as filtered_row
+    order by filtered_row.score desc, filtered_row.updated_at desc,
+             filtered_row.created_at desc, filtered_row.id desc
@@
+ALTER FUNCTION public.search_global_entities(...cursor...)
+  SET search_path = public, extensions;
```

As queries, filtros, cursores e ordenação permanecem iguais; apenas as
referências passam a ser qualificadas pelos aliases dos CTEs.

