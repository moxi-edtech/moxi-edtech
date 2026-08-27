# Apply Result — dedicated school profile audit

run_id: 09A6BDE4-B4F4-4A5C-AEB5-8C7290EF9520
timestamp: 2026-08-21
status: APPLIED

## Migrations aplicadas

- `20260821140000_school_operating_profile_foundation.sql`
- `20260821150000_school_profile_audit_logs.sql`

## Verificações pós-aplicação

- `school_operating_profiles`: 7 linhas;
- distribuição: 7 escolas `private / tuition / custom`;
- `school_profile_audit_logs`: 0 linhas, conforme esperado antes da API de configuração;
- RLS: habilitada nas duas tabelas;
- `record_school_profile_audit(uuid, uuid, text, text, jsonb, jsonb, date)`: presente;
- trigger append-only: presente.

## Observação

Nenhuma migration não relacionada foi aplicada. A ativação de escola pública continua dependente da API administrativa exclusiva do `super_admin` e da auditoria dessa alteração.
