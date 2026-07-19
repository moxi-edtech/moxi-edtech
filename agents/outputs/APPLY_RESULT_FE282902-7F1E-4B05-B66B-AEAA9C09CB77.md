# Apply result — Agent 3
run_id:          FE282902-7F1E-4B05-B66B-AEAA9C09CB77
approval_commit: 7c86be3c7fe9211038929debbd8e888bfef17fa5
status:          PASS

## Alteração aplicada

Criada e aplicada `supabase/migrations/20270718141000_remove_public_bucket_listing_policies.sql`, removendo as três policies SELECT amplas aprovadas.

## Execução

- `psql -v ON_ERROR_STOP=1 --single-transaction`: exit 0
- Três `DROP POLICY` executados.

## Verificação pós-apply

| Verificação | Resultado |
|---|---:|
| Policies alvo ainda presentes | 0 |
| Buckets ainda públicos | 3/3 |
| Policies não-SELECT de `formacao-assets` | 2 (preservadas) |
| Policies não-SELECT de `formacao-comprovativos` | 2 (preservadas) |
| Policies não-SELECT de `school-branding` | 3 (preservadas) |

## Reversão

Não necessária; todas as verificações passaram.
