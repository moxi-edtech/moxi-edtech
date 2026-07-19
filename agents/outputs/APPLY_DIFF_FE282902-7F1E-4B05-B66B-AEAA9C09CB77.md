# Apply diff — Agent 3
run_id:    FE282902-7F1E-4B05-B66B-AEAA9C09CB77
timestamp: 2026-07-18T21:02:48Z

## Acção proposta

Remover as três policies SELECT amplas que permitem listar todos os objectos dos buckets públicos `formacao-assets`, `formacao-comprovativos` e `school-branding`. O estado público dos buckets, URLs públicas e policies de upload não são alterados.

## Diff

```diff
diff --git a/supabase/migrations/20270718141000_remove_public_bucket_listing_policies.sql b/supabase/migrations/20270718141000_remove_public_bucket_listing_policies.sql
new file mode 100644
--- /dev/null
+++ b/supabase/migrations/20270718141000_remove_public_bucket_listing_policies.sql
@@
+-- Public object URLs do not require broad SELECT policies on storage.objects.
+DROP POLICY IF EXISTS "Public View Assets" ON storage.objects;
+DROP POLICY IF EXISTS "Public View Comprovativos" ON storage.objects;
+DROP POLICY IF EXISTS school_branding_select ON storage.objects;
```

## Evidência pré-apply

| Policy | Roles | Expressão |
|---|---|---|
| Public View Assets | anon, authenticated | `bucket_id = 'formacao-assets'` |
| Public View Comprovativos | anon, authenticated | `bucket_id = 'formacao-comprovativos'` |
| school_branding_select | authenticated | `bucket_id = 'school-branding'` |

Não foram encontrados consumidores `.list()` destes buckets no código. Foram encontrados apenas uploads e `getPublicUrl()`.

## Verificação prevista

- Aplicar transaccionalmente com `ON_ERROR_STOP=1`.
- Confirmar ausência das três policies em `pg_policies`.
- Confirmar que os três buckets continuam com `public = true`.
- Confirmar que as policies não-SELECT dos buckets permanecem inalteradas.
