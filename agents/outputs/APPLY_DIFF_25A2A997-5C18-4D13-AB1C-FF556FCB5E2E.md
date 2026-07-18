# KLASSE — Apply Diff
run_id: 25A2A997-5C18-4D13-AB1C-FF556FCB5E2E
timestamp: 2026-07-18T12:18:34Z
commit_base: dea66ad0

## P0 checklist

Todos os itens de `P0_CHECKLIST.md` estão marcados como PASS.

## Acção

Corrigir grants padrão aplicados pelo Supabase à nova tabela `ai_insights`, alinhando o banco ao contrato aprovado.

## Diff proposto

```diff
diff --git a/supabase/migrations/20270718123500_harden_ai_insights_grants.sql b/supabase/migrations/20270718123500_harden_ai_insights_grants.sql
new file mode 100644
--- /dev/null
+++ b/supabase/migrations/20270718123500_harden_ai_insights_grants.sql
@@
+BEGIN;
+REVOKE ALL ON TABLE public.ai_insights FROM PUBLIC;
+REVOKE ALL ON TABLE public.ai_insights FROM anon;
+REVOKE ALL ON TABLE public.ai_insights FROM authenticated;
+GRANT SELECT, INSERT, UPDATE ON TABLE public.ai_insights TO authenticated;
+GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_insights TO service_role;
+COMMIT;
```

## Risco e reversão

Risco baixo: remove privilégios não pretendidos de `anon` e mantém exatamente as operações aprovadas para `authenticated` e `service_role`.

