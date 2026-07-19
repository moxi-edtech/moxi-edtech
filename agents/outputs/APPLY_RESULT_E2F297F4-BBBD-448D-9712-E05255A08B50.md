# Apply result — Agent 3
run_id:          E2F297F4-BBBD-448D-9712-E05255A08B50
approval_commit: 64569b4749c90b520b7e299986a0f90fc906f8be
status:          PASS

## Alteração aplicada

Criada e aplicada `supabase/migrations/20270718144000_harden_formacao_leads_insert_policy.sql`, substituindo `WITH CHECK (true)` por validações estruturais.

## Execução

- `psql -v ON_ERROR_STOP=1 --single-transaction`: exit 0
- Um `DROP POLICY` e um `CREATE POLICY` executados.

## Verificação pós-apply

| Verificação | Resultado |
|---|---:|
| Policy INSERT com `true` | 0 |
| Lead `anon` válido | Aceite e revertido |
| Lead sem email e telefone | Rejeitado por RLS |
| Policy SELECT de backoffice | Preservada |
| Dados de teste persistidos | 0 |

## Reversão

Não necessária; todas as verificações passaram.
