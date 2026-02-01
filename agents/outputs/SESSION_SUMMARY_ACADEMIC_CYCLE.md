# Resumo rápido — Ciclo Acadêmico (Full Academic Cycle)

Esta é uma versão curta do resumo completo em:
`agents/outputs/SESSION_SUMMARY_FULL_ACADEMIC_CYCLE.md`

## Entregas principais
- UI Admin conectada (SettingsHub + StructureMarketplace) com CTAs reais.
- RPCs SSOT + idempotência para gerar turmas e setup acadêmico.
- Schema acadêmico ampliado (classes, disciplinas, turma_disciplinas).
- Modelos de avaliação com RLS e backfill do default.
- API/UI expõe novos campos, com bloqueio de edição em currículo publicado.

## Arquivos-chave
- `agents/outputs/SESSION_SUMMARY_FULL_ACADEMIC_CYCLE.md`
- `supabase/migrations/20260305000000_rpc_academic_setup_contracts.sql`
- `supabase/migrations/20260305000020_academic_contract_schema.sql`
- `supabase/migrations/20260305000021_modelos_avaliacao.sql`
- `supabase/migrations/20260305000022_update_curriculo_publish_contract.sql`
- `apps/web/src/app/escola/[id]/admin/configuracoes/ConfiguracoesClient.tsx`
