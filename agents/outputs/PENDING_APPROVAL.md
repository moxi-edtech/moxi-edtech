# Aprovação necessária — Agent 3
run_id:    867FFE3C-59C2-43CE-9F5C-9651264D8680
timestamp: 2026-07-18T00:00:00-03:00

## Acção proposta

Revogar de `authenticated` a execução de `admin_recalc_all_aggregates()` após a migração do fluxo para worker Inngest interno.

## Diff

```diff
+REVOKE EXECUTE ON FUNCTION public.admin_recalc_all_aggregates()
+FROM PUBLIC, anon, authenticated;
+GRANT EXECUTE ON FUNCTION public.admin_recalc_all_aggregates() TO service_role;
```

## Risco

Uma versão antiga da aplicação ainda chamando diretamente a RPC falharia; o código atual validado usa exclusivamente o evento e o worker.

## Como aprovar

Commit com mensagem: `APPROVE: 867FFE3C-59C2-43CE-9F5C-9651264D8680`

## Como rejeitar

Commit com mensagem: `REJECT: 867FFE3C-59C2-43CE-9F5C-9651264D8680 [motivo]`
