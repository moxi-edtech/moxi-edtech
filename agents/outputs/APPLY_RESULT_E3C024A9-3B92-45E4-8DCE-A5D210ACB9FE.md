# Apply result — Agent 3
run_id:          E3C024A9-3B92-45E4-8DCE-A5D210ACB9FE
approval_commit: 0d4e027b5dabc784365db6f239d35b153605ddc3
status:          PASS

## Alteração aplicada

Criada e aplicada `supabase/migrations/20270718140000_guard_admin_health_functions.sql`, adicionando guards nulo-seguros de `service_role` ou super/global admin às três RPCs administrativas.

## Execução

- `psql -v ON_ERROR_STOP=1 --single-transaction`: exit 0
- Três `CREATE OR REPLACE FUNCTION` executados.

## Verificação pós-apply

| Verificação | Resultado |
|---|---:|
| Chamadas sem JWT bloqueadas com `42501` | 3/3 |
| Corpos com `IS DISTINCT FROM` e helper admin | 3/3 |
| `anon` com EXECUTE efectivo | 0/3 |
| `authenticated` com EXECUTE preservado | 3/3 |
| `service_role` com EXECUTE preservado | 3/3 |

## Reversão

Não necessária; todas as verificações passaram.
