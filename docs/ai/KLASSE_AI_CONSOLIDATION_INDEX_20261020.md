# KLASSE IA — índice de consolidação (2026-10-20)

> Branch de trabalho: `feature/klasse-ai-consolidation-20261020` · base: `main` (`8bd1ef57b9d10456fbc91f5a6ade0de2ec614b73`).
>
> Objetivo: centralizar a documentação e os contratos existentes antes de alterar o KLASSE IA. Este índice é um **mapa de fontes**, não uma segunda fonte de verdade nem uma declaração de prontidão de produção.
>
> Critério: caminhos confirmados na árvore da `main` por pesquisa/fetch GitHub em 2026-10-20. Status de execução, RLS, migrações e produção **não** foram revalidados neste inventário.

## 1. Documentação principal — ler nesta ordem

| Prioridade | Fonte existente | Porquê |
|---|---|---|
| P0 | [readme-klasse-ai.md](../../apps/web/src/lib/assistant/docs/readme-klasse-ai.md) | Visão atual do copiloto operacional, arquitetura, modos, ferramentas, permissões, cockpit, limitações e backlog de liberação. Documento principal para reconciliar especificações históricas. |
| P0 | [SPRINT_EXECUTIVO_KLASSE_DATA_COPILOT_V1.md](../SPRINT_EXECUTIVO_KLASSE_DATA_COPILOT_V1.md) | Definições canônicas, autorização por tenant, fontes de dados reais, privacidade e contrato das ferramentas fechadas. Documento de concepção (2026-07-04): verificar implementação presente. |
| P0 | [plano-actions-v2.md](../../apps/web/src/lib/assistant/docs/plano-actions-v2.md) | Contrato de `actions[]`, risco, aprovação humana e evolução do assistente. Plano: afirmações de “falta” podem estar ultrapassadas. |
| P0 | [regras-negocio-ia-whatsapp.md](../../apps/web/src/lib/assistant/docs/regras-negocio-ia-whatsapp.md) | Limites do modelo, fast/smart path, rascunhos, publicação, PII e WhatsApp. |
| P0 | [manual-central-acoes-ai.md](../../apps/web/src/lib/assistant/docs/manual-central-acoes-ai.md) | Workflow de `ai_actions`, draft/revisão/aprovação e trilha auditável. |
| P0 | [integrations/klasse-chatgpt.md](../integrations/klasse-chatgpt.md) | Contratos de ferramenta externos, JWT do utilizador, RPCs de leitura/escrita restritas e integração ChatGPT/Codex. **Não confundir** com o assistente interno. |
| P1 | [manual-geral-klasse.md](../../apps/web/src/lib/assistant/docs/manual-geral-klasse.md) | Visão do produto e fonte declarada para a base de conhecimento. |
| P1 | [manual-secretaria.md](../../apps/web/src/lib/assistant/docs/manual-secretaria.md) + [regras-negocio-secretaria.md](../../apps/web/src/lib/assistant/docs/regras-negocio-secretaria.md) | Intenções, papéis, matrículas, admissão e documentos. Validar rotas com a UI atual. |
| P1 | [manual-financeiro.md](../../apps/web/src/lib/assistant/docs/manual-financeiro.md) + [regras-negocio-financeiro.md](../../apps/web/src/lib/assistant/docs/regras-negocio-financeiro.md) | Financeiro, inadimplência, cobranças, limites de alteração e recibos. |
| P1 | [regras-negocio-academico.md](../../apps/web/src/lib/assistant/docs/regras-negocio-academico.md) | Notas, frequência, modelos de avaliação e permissões do professor/secretaria. |
| P1 | [manual-whatsapp-utility.md](../../apps/web/src/lib/assistant/docs/manual-whatsapp-utility.md) | Integração da central WhatsApp, revisão de rascunhos e privacy placeholders. |
| P1 | [WAHA_WHATSAPP_KLASSE_IMPLEMENTATION.md](../WAHA_WHATSAPP_KLASSE_IMPLEMENTATION.md) | Outbox, worker, webhook, templates, tenant e aprovações. Documento histórico de implantação; reconfirmar estado atual. |
| P1 | [PROMPT_GEMINI_BACKEND_PEDAGOGICO_KLASSE_2026-08-12.md](../PROMPT_GEMINI_BACKEND_PEDAGOGICO_KLASSE_2026-08-12.md) | `fontes_pedagogicas`, `pedagogical_ai_requests`, revisão humana e worker ainda descrito como pendente. |
| P1 | [PROMPT_GEMINI_APRENDIZAGEM_CONTINUA_KLASSE_2026-08-12.md](../PROMPT_GEMINI_APRENDIZAGEM_CONTINUA_KLASSE_2026-08-12.md) | Contratos de materiais/atividades aluno-professor, sem tabelas paralelas. |
| P1 | [SPRINT_LACUNAS_PRODUTO_KLASSE_2026-08-12.md](../SPRINT_LACUNAS_PRODUTO_KLASSE_2026-08-12.md) | Critério para diferenciar “implementado”, “parcial” e “pronto para venda”; roadmap pedagógico. |
| P1 | [sprints/compute-scale-v1.md](../sprints/compute-scale-v1.md) | Crons e IA sob demanda, custos, fan-out, jobs idempotentes, backoff e observabilidade multi-tenant. |
| P2 | [HANDOFF_KLASSE.md](../HANDOFF_KLASSE.md) | Contexto de deploy/migrações e alertas de segurança; ponto no tempo de setembro de 2026. |
| P2 | [DEMO_ESCOLA_KLASSE.md](../DEMO_ESCOLA_KLASSE.md) | Cenários de validação, mas dados da demonstração são históricos e não devem ser tratados como dados vivos. |
| P2 | [services/whatsapp-sales-agent/README.md](../../services/whatsapp-sales-agent/README.md) | Agente comercial WAHA separado: não misturar sua autonomia com as permissões do assistente escolar. |

## 2. Implementação canônica existente

### Assistente interno (manter uma rota/orquestração)

- `apps/web/src/app/api/admin/ai/assistant/route.ts` — endpoint conversacional existente.
- `apps/web/src/lib/assistant/klasse-brain.ts` — orquestração e fast/smart path.
- `apps/web/src/lib/assistant/knowledge-search.ts` — recuperação de conhecimento.
- `apps/web/src/lib/assistant/knowledge-base-data.json` — base gerada, **não editar manualmente como fonte primária**.
- `apps/web/src/lib/assistant/build-knowledge.ts` — geração a partir dos registries e dos tópicos.
- `apps/web/src/lib/assistant/route-registry.ts`, `action-registry.ts`, `actions-v2.ts`, `permission-registry.ts`, `assistant-suggestions.ts` — contratos e allowlists reutilizáveis.
- `apps/web/src/lib/assistant/screen-context.ts`, `derive-widget-context.ts` — contexto contextual sem inventar telas.
- `apps/web/src/lib/klasse-help/help-topics.ts` — documentação in-product e aliases.
- `apps/web/src/components/ai/AiChatWidget.tsx` — widget.
- `apps/web/src/app/escola/[id]/(portal)/admin/ai/KlasseAiCockpitClient.tsx` e `page.tsx` — cockpit.

### Data Copilot (não criar outra camada de queries)

- `apps/web/src/lib/assistant/data-copilot/tool-registry.ts`, `types.ts`, `answer-composer.ts`, `query-matcher.ts`.
- `apps/web/src/lib/assistant/data-copilot/finance-debt-by-class.ts`.
- `apps/web/src/lib/assistant/data-copilot/tools/`: `finance-risk-summary.ts`, `admissions-pending.ts`, `academic-grade-gaps.ts`, `academic-low-attendance.ts`, `academic-pedagogical-risk.ts`, `academic-calendar-operations.ts`, `school-daily-briefing.ts`.

### Segurança, créditos, providers, ações, insights

- `apps/web/src/lib/server/ai/ai-guards.ts`, `provider-client.ts`, `text-generation.ts`, `ai-actions.ts`, `ai-insights.ts`.
- `apps/web/src/app/api/admin/ai/access/route.ts`, `insights/route.ts`, `insights/[id]/route.ts`, `actions/route.ts`, `actions/[id]/route.ts`, `actions/save/route.ts`.
- `apps/web/src/app/api/admin/ai/rewrite/route.ts`, `summary/route.ts`, `finance-message/route.ts`, `generate-communication/route.ts`.
- `apps/web/src/app/escola/[id]/(portal)/admin/ai/actions/AiActionsCenterClient.tsx` — UI de revisão.

### IA pedagógica / integração externa

- `apps/web/src/app/api/professor/pedagogia/ai-requests/route.ts`.
- `apps/web/src/lib/integrations/klasse-chatgpt/tools.ts`, `apps/web/public/.well-known/klasse-openapi.yaml`.
- `supabase/migrations/20260927232530_klasse_chatgpt_readonly_rpcs.sql`, `20260928120000_klasse_chatgpt_write_rpcs.sql`.
- `supabase/migrations/20270812170000_learning_platform_contracts.sql`, `20270812160000_learning_activities_backend.sql`, `20260812130000_guardian_learning_visibility.sql`.

### DB e operações — verificar no Supabase antes de qualquer mudança

- `supabase/migrations/20260626120000_create_ai_actions.sql`, `20260626153000_fix_ai_school_settings_select_policy.sql`, `20270625104500_grant_insert_ai_school_settings.sql`.
- `supabase/migrations/20270718123000_create_ai_insights.sql`, `20270718123500_harden_ai_insights_grants.sql`.
- `apps/web/src/app/api/cron/ai/calendar-alerts/route.ts` — calendário/IA; comparar com política de execução dirigida por eventos.
- `apps/web/src/app/api/jobs/waha-agent/eligibility/route.ts`, `apps/web/src/app/api/jobs/waha-webhook/route.ts` — integração de comunicações.
- `apps/web/src/types/supabase-augment.ts` — representação de tipos: reconciliar com schema real, sem presumir migração aplicada.

## 3. Testes/guardrails localizados

- `apps/web/tests/unit/assistant-kb-modules.spec.ts`
- `apps/web/tests/unit/assistant-widget-context.spec.ts`
- `apps/web/tests/unit/query-matcher.spec.ts`
- `apps/web/tests/unit/klasse-chatgpt-contract.spec.ts`
- `supabase/ops/tests/regression_waha_thread_idempotency.sql`

Também há, na branch histórica `work/klasse-ai-20261013` (não presente na base `main`), um teste `apps/web/tests/unit/klasse-ai-reconciliation.spec.ts` e workflow `.github/workflows/klasse-ai-reconciliation-guard.yml`. Avaliar cherry-pick *apenas* após diff e testes.

## 4. Reconciliação com a branch anterior

A comparação GitHub `main...work/klasse-ai-20261013` em 2026-10-20 indicou **divergência**: branch antiga **1 commit à frente** e **9 atrás**, com três ficheiros exclusivos:

- `.github/workflows/klasse-ai-reconciliation-guard.yml`;
- `apps/web/tests/unit/klasse-ai-reconciliation.spec.ts`;
- `docs/ops/KLASSE_AI_BASE_RECONCILIATION_20261013.md`.

O último documento informa que a integração herdada de `release/klasse-chatgpt-v0.2.0` / PR #133 já era byte-idêntica à `main` na data da conciliação. **Não duplicar endpoints, RPCs ou migrations.** Não foi feito merge nem cherry-pick.

## 5. Invariantes não negociáveis

1. `schoolId` derivado da sessão e vínculo autorizado, nunca confiado à entrada do modelo ou do cliente; RLS e `SECURITY INVOKER` quando aplicável.
2. Fonte única para fatos escolares: views/RPCs/serviços canônicos com autorização; sem SQL livre pelo LLM.
3. Papéis/permissões avaliados no **servidor** para cada ferramenta e ação; tool output é não confiável e não pode aumentar privilégios.
4. Sem pagamentos, notas, matrícula, mensagens ou publicação por comando livre. Ações de efeito externo somente por fluxo oficial, com aprovação quando exigida.
5. Minimização de PII, logging sanitizado, rate limits, custos/créditos e tratamento seguro de falhas/quotas.
6. Não prometer funcionalidade pronta com base apenas em docs/migrations; exigir testes de integração/E2E autenticados e prova de isolamento de escolas.
7. Distinguir **assistente operacional escolar**, **integração externa ChatGPT/Codex**, **geração pedagógica com revisão** e **agente comercial WAHA**: partilhar políticas úteis, não fundir permissões.

## 6. Próximo trabalho nesta branch

1. Auditar código atual vs documentos (P0), marcar cada promessa `implementada / parcial / não verificada / pendente` com evidências de testes.
2. Reconhecer contratos existentes e eliminar documentação contraditória, atualizando **os originais** — este índice não substitui documentação oficial.
3. Verificar tabelas, grants, RLS, funções e migrations no Supabase real, sem executar alterações ainda.
4. Definir backlog único ordenado por risco: auth/RLS multi-tenant, E2E cockpit/insights, consistência de tools e actions, WhatsApp com aprovação, IA pedagógica.
5. Validar `typecheck`, unit/integration, isolamento de tenant e QA visual antes de PR. Nenhum deploy automático por criação deste índice.
