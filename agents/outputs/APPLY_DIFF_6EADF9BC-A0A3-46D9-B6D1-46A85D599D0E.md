# Diff proposto — KLASSE Fortress v1, lote 6
run_id: 6EADF9BC-A0A3-46D9-B6D1-46A85D599D0E
timestamp: 2026-07-18T20:41:58Z
commit_base: 37f69abc

Migration proposta: `supabase/migrations/20270718133000_harden_boletim_refresh_grant.sql`

```diff
--- /dev/null
+++ b/supabase/migrations/20270718133000_harden_boletim_refresh_grant.sql
@@
+BEGIN;
+
+REVOKE EXECUTE ON FUNCTION public.refresh_mv_boletim_por_matricula()
+FROM PUBLIC, anon, authenticated;
+
+GRANT EXECUTE ON FUNCTION public.refresh_mv_boletim_por_matricula()
+TO service_role;
+
+COMMIT;
```

O código da aplicação tem zero consumidores desta função. O cron backend
`refresh-boletim-hourly` permanece ativo e executa o refresh como owner.
