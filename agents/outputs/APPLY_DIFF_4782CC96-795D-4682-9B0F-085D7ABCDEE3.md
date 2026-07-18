# KLASSE — Apply Diff
run_id: 4782CC96-795D-4682-9B0F-085D7ABCDEE3
timestamp: 2026-07-18T12:20:35Z
commit_base: dea66ad0

## P0 checklist

Todos os itens de `P0_CHECKLIST.md` estão marcados como PASS.

## Acção

Adicionar `ai_insights` ao augment tipado do Supabase usado pelas APIs server-side.

## Diff proposto

```diff
--- a/apps/web/src/types/supabase-augment.ts
+++ b/apps/web/src/types/supabase-augment.ts
@@
     Tables: Database["public"]["Tables"] & {
+      ai_insights: {
+        Row: { ...campos da migration ai_insights... };
+        Insert: { ...campos obrigatórios e defaults... };
+        Update: { ...campos opcionais... };
+        Relationships: [{ foreignKeyName: "ai_insights_school_id_fkey"; ... }];
+      };
       ai_actions: {
```

## Risco e reversão

Risco baixo: alteração apenas de tipos TypeScript, alinhada ao schema já aplicado.

