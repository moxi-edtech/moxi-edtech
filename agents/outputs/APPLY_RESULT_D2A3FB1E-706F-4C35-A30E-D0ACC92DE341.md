# Apply result — Agent 3
run_id:          D2A3FB1E-706F-4C35-A30E-D0ACC92DE341
approval_commit: 0996479f28465039788335172031933f6ee3f670
status:          PASS

## Alteração aplicada

Criada e aplicada `supabase/migrations/20270718143000_harden_formacao_funnel_insert_policies.sql`, substituindo as duas policies `WITH CHECK (true)` por validações estruturais e de identidade.

## Execução

- Primeira tentativa: deadlock antes da alteração; transacção integralmente revertida.
- Segunda tentativa com o mesmo diff: exit 0.
- Dois `DROP POLICY` e dois `CREATE POLICY` executados.

## Verificação pós-apply

| Verificação | Resultado |
|---|---:|
| Policies INSERT com `true` | 0 |
| Inserção `anon` válida | Aceite e revertida |
| Inserção `anon` com `user_id` forjado | Rejeitada por RLS |
| Policy SELECT autenticada | Preservada |
| Dados de teste persistidos | 0 |

## Reversão

Não necessária; todas as verificações finais passaram.
