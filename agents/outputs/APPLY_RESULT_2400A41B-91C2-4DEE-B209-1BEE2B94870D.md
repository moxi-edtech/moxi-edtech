# KLASSE — Apply Result
run_id: 2400A41B-91C2-4DEE-B209-1BEE2B94870D
approval_commit: 9a8fc8b77da46618fbafe0437b43886f43f3a56a
status: APPLIED

## Migration

- `supabase/migrations/20270726115000_create_pedagogical_risk_radar.sql`

## Artefactos

- MV: `internal.mv_risco_pedagogico_aluno`
- UNIQUE INDEX: `ux_mv_risco_pedagogico_aluno`
- Refresh: `public.refresh_mv_risco_pedagogico_aluno()`
- Wrapper: `public.vw_risco_pedagogico_aluno`
- Cron: job `206`, a cada 15 minutos

## Dados materializados

- 583 matrículas activas.
- 583 matrículas únicas.
- Cobertura complete: 0.
- Cobertura partial: 14.
- Cobertura insufficient: 569.
- Score inconsistente: 0.
- Quatro matrículas com score 20 por média actual abaixo de 50%.
- Nenhum risco medium/high, coerente com a ausência de frequência e de um
  segundo trimestre com notas.

## Segurança

- `anon` com acesso directo à MV: false.
- `authenticated` com acesso directo à MV: false.
- `service_role` com acesso à MV: true.
- `admin_escola`: PASS.
- `secretaria`: PASS.
- `admin_financeiro`, `financeiro`, `professor` e `aluno`: bloqueados.
- Linhas cross-tenant: 0.

Durante o gate foi detectado um default grant de `authenticated` na MV. O grant
foi revogado antes da conclusão e incorporado na migration final.

## Performance

- Consulta autenticada, ordenada e limitada a 50: 31,111 ms.
- Meta p95 da view: abaixo de 300 ms.

## Próximos passos

- Criar a ferramenta fechada `academic-pedagogical-risk`.
- Renderizar cobertura insuficiente sem chamar o aluno de “baixo risco”.
- Criar o fluxo auditável de intervenção humana.
