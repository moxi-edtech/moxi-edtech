# Apply Result — Agent 3
run_id: 8CF08237-EB0E-48DB-B764-F1A87D52E271
status: PASS

## Aplicado

- Revogado `EXECUTE` de `PUBLIC` e `anon` em 20 helpers internos de autorização/tenant.
- Mantido `EXECUTE` para `authenticated` e `service_role` nesses helpers.
- Revogado também `authenticated` nos helpers internos `require_influencer_active_session` e `require_influencer_owner_session`; mantido apenas `service_role`.

## Verificação live

- Nomes esperados: 22.
- Assinaturas encontradas: 22.
- Violações de privilégios esperados: 0.
- `check_public_rate_limit`: `anon=true`, `PUBLIC=false`, preservado por ainda possuir chamadas directas em rotas públicas.

## Verificação de regressão

- Todos os helpers destinados à aplicação autenticada continuam executáveis por `authenticated`: PASS.
- Os dois helpers internos de sessão continuam executáveis por `service_role`: PASS.
- A RPC pública usada por rate limiting não foi alterada: PASS.
