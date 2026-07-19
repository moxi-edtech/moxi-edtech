# Apply result — Agent 3
run_id:          DD4BBEA0-561B-4DAD-BA24-B628EBFE0118
approval_commit: b79ee869c1bdfb7a9a165761fc6cd1cbed17e3f5
status:          PASS

## Alteração aplicada

Criada e aplicada `supabase/migrations/20270718135000_revoke_public_anon_admin_function_execute.sql`, removendo `EXECUTE` de `PUBLIC` e `anon` nas seis funções administrativas aprovadas.

## Execução

- `psql -v ON_ERROR_STOP=1 --single-transaction`: exit 0
- Seis comandos `REVOKE` executados.

## Verificação pós-apply

| Verificação | Resultado |
|---|---:|
| Assinaturas alvo | 6 |
| ACL de `PUBLIC` | 0 |
| `anon` com EXECUTE efectivo | 0 |
| `authenticated` com EXECUTE efectivo | 6 |
| `service_role` com EXECUTE efectivo | 6 |

## Reversão

Não necessária; todas as verificações passaram.
