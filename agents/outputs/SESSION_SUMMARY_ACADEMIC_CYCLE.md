# Resumo rápido — Ciclo Acadêmico (Full Academic Cycle)

Esta é uma versão curta do resumo completo em:
`agents/outputs/SESSION_SUMMARY_FULL_ACADEMIC_CYCLE.md`

## Entregas principais
- UI Admin conectada (SettingsHub + StructureMarketplace) com CTAs reais.
- RPCs SSOT + idempotência para gerar turmas e setup acadêmico.
- Schema acadêmico ampliado (classes, disciplinas, tur
ma_disciplinas).
- Modelos de avaliação com RLS e backfill do default.
- API/UI expõe novos campos, com bloqueio de edição em currículo publicado.
- Editor visual de modelos de avaliação e filtros/paginação de disciplinas.

## Arquivos-chave
- `agents/outputs/SESSION_SUMMARY_FULL_ACADEMIC_CYCLE.md`
- `supabase/migrations/20260305000000_rpc_academic_setup_contracts.sql`
- `supabase/migrations/20260305000020_academic_contract_schema.sql`
- `supabase/migrations/20260305000021_modelos_avaliacao.sql`
- `supabase/migrations/20260305000022_update_curriculo_publish_contract.sql`
- `apps/web/src/app/escola/[id]/admin/configuracoes/ConfiguracoesClient.tsx`
 +                                                                                               │
│ 22 + ## 8. Auditoria de Segurança e Robustez (Admin Setup)                                         │
│ 23 +                                                                                               │
│ 24 + Uma auditoria E2E do fluxo de Admin Setup foi conduzida, resultando em:                       │
│ 25 +                                                                                               │
│ 26 + ### Melhorias de Segurança e Robustez Implementadas:                                          │
│ 27 + - **Corrigida Violação P0:** Erro crítico na API `ano-letivo/upsert` devido a chamada de RPC  │
│    inexistente.                                                                                    │
│ 28 + - **Fortalecido Isolamento de Tenant (P0):** A coluna `escola_id` em `audit_logs` foi tornada │
│    `NOT NULL` após remoção de registros inconsistentes, garantindo rastreabilidade.                │
│ 29 + - **Eliminado Uso Indevido de `service_role` (P0 - Exemplo):** A rota                         │
│    `apps/web/src/app/api/escolas/[id]/onboarding/core/session` foi refatorada para usar a sessão   │
│    do usuário e RPCs seguros, removendo uma falha de segurança que ignorava o RLS.                 │
│ 30 +                                                                                               │
│ 31 + ### Gaps P1 Identificados (Pendentes):                                                        │
│ 32 + - **Outras Violações P0 de `service_role`:** O uso indevido da `service_role` persiste em     │
│    outros endpoints da aplicação.                                                                  │
│ 33 + - **Validação de Períodos:** O sistema não impede a sobreposição de datas de períodos         │
│    letivos.                                                                                        │
│ 34 + - **Publicação de Currículo Vazio:** Não há validação para impedir a publicação de currículos │
│    sem itens.                                                                                      │
│ 35 + - **Padrão de


 + - **Outras Violações P0 de `service_role`:** O uso indevido da `service_role` persiste em     │
│    outros endpoints da aplicação. A lista abaixo detalha as rotas que precisam de refatoração      │
│    urgente para usar a sessão do usuário e RPCs seguros, em vez da chave de serviço:               │
│ 33 +   - **Matrículas em Massa:**                                                                  │
│ 34 +     - `api/matriculas/massa/route.ts`                                                         │
│ 35 +     - `api/matriculas/massa/por-turma/route.ts`                                               │
│ 36 +   - **Financeiro:**                                                                           │
│ 37 +     - `api/financeiro/orcamento/matricula/route.ts`                                           │
│ 38 +     - `api/financeiro/tabelas-mensalidade/route.ts`                                           │
│ 39 +     - `api/escolas/[id]/financeiro/pagamentos/novo/route.ts`                                  │
│ 40 +     - `api/escolas/[id]/financeiro/vendas/avulsa/route.ts`                                    │
│ 41 +   - **Onboarding & Setup (Legado):**                                                          │
│ 42 +     - `api/escolas/[id]/onboarding/curriculum/apply-matrix/route.ts`                          │
│ 43 +     - `api/escolas/[id]/onboarding/curriculum/apply/route.ts`                                 │
│ 44 +     - `api/escolas/[id]/onboarding/session/[sessionId]/route.ts`                              │
│ 45 +     - `api/escolas/[id]/onboarding/session/[sessionId]/reassign/route.ts`                     │
│ 46 +     - `api/escolas/[id]/onboarding/session/repair-names/route.ts`                             │
│ 47 +     - `api/escolas/[id]/onboarding/session/rotate/route.ts`                                   │
│ 48 +     - `api/escolas/[id]/onboarding/core/finalize/route.ts`                                    │
│ 49 +     - `api/escolas/[id]/onboarding/preferences/route.ts`                                      │
│ 50 +     - `api/escolas/[id]/onboarding/draft/route.ts`                                            │
│ 51 +   - **Gestão de Alunos:**                                                                     │
│ 52 +     - `api/escolas/[id]/admin/alunos/[alunoId]/restore/route.ts`                              │
│ 53 +     - `api/escolas/[id]/admin/alunos/[alunoId]/route.ts`                                      │
│ 54 +     - `api/escolas/[id]/admin/alunos/[alunoId]/archive/route.ts`                              │
│ 55 +     - `api/escolas/[id]/alunos/invite/route.ts`                                               │
│ 56 +     - `api/escolas/[id]/alunos/novo/route.ts`                                                 │
│ 57 +     - `api/alunos/ativar-acesso/route.ts`                                                     │
│ 58 +   - **Gestão Acadêmica (Diversos):**                                                          │
│ 59 +     - `api/escolas/[id]/configuracoes/status/route.ts`                                        │
│ 60 +     - `api/escolas/[id]/semestres/[semestreId]/route.ts`                                      │
│ 61 +     - `api/escolas/[id]/semestres/route.ts`                                                   │
│ 62 +     - `api/escolas/[id]/semestres/reset/route.ts`                                             │
│ 63 +     - `api/escolas/[id]/academico/wipe/route.ts`                                              │
│ 64 +     - `api/secretaria/turmas/[id]/detalhes/route.ts`                                          │
│ 65 +   - **Autenticação (Alto Risco):**                                                            │
│ 66 +     - `api/auth/login/route.ts`     