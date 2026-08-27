# KLASSE — Apply Result
run_id: 3EF4B171-1EB9-4AF8-A0E6-289CC133BC26
timestamp: 2026-07-26T11:10:30Z
approval_commit: 04bb0b8e2ea99bc71faa5c21d529707db5e5a404
status: APPLIED

## Migration

- `supabase/migrations/20270726111500_harden_radar_inadimplencia_finance_roles.sql`

## Cargos autorizados

- `admin`
- `admin_escola`
- `staff_admin`
- `secretaria`
- `financeiro`
- `admin_financeiro`
- `secretaria_financeiro`

## Testes empíricos

| Papel | Esperado | Linhas visíveis | Outro tenant | Resultado |
|---|---:|---:|---:|---|
| admin_escola | autorizado | 47 | 0 | PASS |
| admin_financeiro | autorizado | 47 | 0 | PASS |
| financeiro | autorizado | 47 | 0 | PASS |
| secretaria | autorizado | 47 | 0 | PASS |
| aluno | bloqueado | 0 | 0 | PASS |
| professor | bloqueado | 0 | 0 | PASS |

Não existiam utilizadores ligados às escolas com dados do radar para testar
empiricamente `admin`, `staff_admin` ou `secretaria_financeiro`. Esses valores
estão presentes na allowlist SQL aprovada e permanecem fail-closed para todos
os demais cargos.

## Grants e isolamento

- `anon` com `SELECT` na view: false.
- `authenticated` com `SELECT` directo na MV: false.
- `authenticated` com `SELECT` na view pública: true.
- `service_role`: 1.994 linhas em 2 escolas.
- Linhas cross-tenant nos testes autorizados: 0.

## Meta p95

- Consulta completa do radar: abaixo de 500 ms p95.
- Nenhuma query adicional por linha foi introduzida.

## Próximos passos

- Validar o widget autenticado com `secretaria` e `financeiro`.
- Harmonizar as listas `FINANCE_ROLES` duplicadas no frontend.
- Rodar a senha PostgreSQL exposta durante a sessão.
