# Apply diff — Agent 3
run_id: E30E9BFE-3935-4ECF-87FC-E1C003448F0F
timestamp: 2026-07-18T00:00:00-03:00

## Acção proposta

Restringir a execução directa do helper genérico `check_public_rate_limit` ao `service_role`, mantendo intactas as chamadas internas feitas por RPCs `SECURITY DEFINER`.

## Diff

```diff
--- /dev/null
+++ b/supabase/migrations/20270718195000_restrict_generic_public_rate_limit_helper.sql
@@
+REVOKE ALL ON FUNCTION public.check_public_rate_limit(text, text, integer, integer, integer)
+FROM PUBLIC, anon, authenticated;
+
+GRANT EXECUTE ON FUNCTION public.check_public_rate_limit(text, text, integer, integer, integer)
+TO service_role;
```

## Verificação prévia

- As duas chamadas TypeScript directas usam `supabaseServerRole()`.
- As demais referências são chamadas internas em migrations/RPCs `SECURITY DEFINER`.
- O `service_role` conserva `EXECUTE`.

## Reversão

```sql
GRANT EXECUTE ON FUNCTION public.check_public_rate_limit(text, text, integer, integer, integer)
TO anon, authenticated;
```
