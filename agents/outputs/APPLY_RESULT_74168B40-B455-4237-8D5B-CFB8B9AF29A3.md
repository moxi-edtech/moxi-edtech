# Apply Result — Agent 3
run_id: 74168B40-B455-4237-8D5B-CFB8B9AF29A3
status: PASS

## Aplicado

- Revogado `INSERT` direto em `public.onboarding_doubts` para `anon` e `authenticated`.
- Removida `onboarding_doubts_insert_policy` com `WITH CHECK (true)`.
- Mantido o caminho de escrita pela RPC token-bound.

## Verificação live

- `anon INSERT=false`: PASS.
- `authenticated INSERT=false`: PASS.
- `service_role INSERT=true`: PASS.
- Policies INSERT com `WITH CHECK (true)`: 0 — PASS.
- RPC executável por `anon`: PASS.
- RPC executável por `PUBLIC`: false — PASS.

## Verificação de regressão

- Nenhum INSERT direto restante no código da aplicação: PASS.
- O POST foi migrado e passou no typecheck no run anterior: PASS.
