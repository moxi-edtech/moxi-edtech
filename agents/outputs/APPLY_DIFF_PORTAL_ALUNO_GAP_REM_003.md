# Diff proposto — GAP-REM-003

run_id: PORTAL-ALUNO-REM-JANELA-20260604
status: APPLIED

## Escopo

Exigir janela explícita para rematrícula online no portal do aluno.

## Diff

O diff proposto está registrado em:

- `agents/outputs/PENDING_APPROVAL_PORTAL_ALUNO_REMATRICULA_JANELA.md`

## Resultado

Aplicado após aprovação `APPROVE: PORTAL-ALUNO-REM-JANELA-20260604`.

- Migration: `supabase/migrations/20270604201000_aluno_rematricula_janela_portal.sql`
- API: `apps/web/src/app/api/aluno/rematricula/status/route.ts`
- Validação DB com rollback: PASS
- Registro em `supabase_migrations.schema_migrations`: PASS
- Typecheck/lint: PASS

## Motivo da aprovação

Esta correção cria uma tabela nova, políticas RLS e altera o contrato da RPC `aluno_confirmar_rematricula`. Pelo contrato dos agentes, mudança de schema/contrato SQL deve ficar pendente até aprovação humana.
