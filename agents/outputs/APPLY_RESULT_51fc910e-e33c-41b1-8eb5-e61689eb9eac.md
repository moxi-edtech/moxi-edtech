# Apply result — 51fc910e-e33c-41b1-8eb5-e61689eb9eac

status: MIGRATION_APPLIED_NOT_DEPLOYED
branch: `integration/main-alignment-20260929`
validated_head: `bc43d92b22eaa870513c4656460d83b91ec07924`

## Mudanças aplicadas no branch

- `supabase/migrations/20260930104911_fix_secretaria_batch_payment_atomicity.sql`
- `apps/web/src/app/api/secretaria/pagamentos/processar/route.ts`
- `apps/web/src/components/secretaria/BalcaoAtendimento.tsx`

A RPC batch final usa `SECURITY INVOKER`, não `SECURITY DEFINER`, para preservar os privilégios/RLS do chamador. `anon` não recebe EXECUTE; `authenticated` e `service_role` recebem EXECUTE.

## Evidências

### TypeScript / lint

- `pnpm --filter web typecheck`: PASS.
- ESLint focado nos dois ficheiros alterados: 0 errors; 17 warnings preexistentes no componente `BalcaoAtendimento.tsx`.

### KF2

- `KF2 Search Audit #922`: SUCCESS no head `bc43d92b...`.
- Security Regression Tests: SUCCESS.
- Codex Scan: SUCCESS.
- Performance Gate: SUCCESS.

### Build

- Clean clone do branch no commit `8d08ffbbb07e9c9710c271d41de645c3e909b33d`.
- `vercel pull --environment=preview` + `vercel build`: exit code 0.
- Next.js 15.5.7 gerou 182 páginas e `.vercel/output`.
- O head final `bc43d92b...` difere desse build apenas pela migration SQL, portanto o artefacto `apps/web` é build-equivalente.

### Prova transacional local

Docker não estava disponível, e a Supabase Branch teria custo. Foi usado PostgreSQL local isolado em `/tmp`, sem tocar produção.

A migration real compilou com `ON_ERROR_STOP` num harness que reproduz:
- roles Supabase;
- enum `pagamento_metodo`;
- tabelas mínimas tocadas pelo batch;
- assinaturas reais dos helpers;
- assinatura canónica de `financeiro_registrar_pagamento_secretaria`.

Resultados:

- writer 1 succeeds + writer 2 raises -> `rollback_rows=0`.
- checkout válido com 2 itens -> `valid_rows=2`.
- retry mesma `Idempotency-Key` -> `retry_idempotent=true`, `retry_rows=2`.
- duas chamadas concorrentes mesma chave -> uma `idempotent=false`, outra `idempotent=true`, `concurrent_rows=2`.
- os mesmos testes foram repetidos após hardening para `SECURITY INVOKER`.

Limitação: o harness prova semântica transacional/idempotência/concorrência do batch e compatibilidade de compilação, mas não é clone integral do schema Supabase. O writer individual já permanece o writer canónico existente em produção.

### Review

- P1 `Make multi-item payment settlement atomic`: RESOLVED.
- PR #136: 0 review threads unresolved.

## Estado remoto

- A migration `fix_secretaria_batch_payment_atomicity` foi aplicada ao Supabase de produção.
- O Supabase registrou a execução como versão remota `20260930104911` (o nome permanece `fix_secretaria_batch_payment_atomicity`).
- A RPC live foi verificada como `SECURITY INVOKER`, com `anon_execute=false`, `authenticated_execute=true` e `service_role_execute=true`.
- Advisory lock, batch fingerprint e chamada ao writer canónico foram confirmados na definição live.
- Security advisors permaneceram nos mesmos counts anteriores: RLS sem policy 13; anon SECURITY DEFINER executável 46; authenticated SECURITY DEFINER executável 316; leaked-password protection 1.
- Nenhum merge em `main`.
- Nenhum deploy/promotion de Production.

## Ordem de release obrigatória

A nova API chama `financeiro_registrar_pagamentos_secretaria_batch`. Como a RPC ainda não existe no banco live, **não fazer deploy do app antes da migration**.

Sequência segura:

1. migration no Supabase de produção ✅;
2. função, grants e advisors verificados ✅;
3. merge em `main`;
4. deploy/promote do artefacto;
5. smoke test do app;
6. somente depois considerar o release concluído.

A migration é aditiva: cria/substitui apenas a nova RPC batch e grants associados; não contém DROP TABLE/COLUMN nem alteração de dados existentes.
