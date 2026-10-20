# KLASSE IA — Inventário e base de consolidação

> Levantamento inicial em 2026-10-20. Base: `main` no commit `8bd1ef57b9d10456fbc91f5a6ade0de2ec614b73`.
> Branch de trabalho: `feature/klasse-ai-inventory-consolidation-20261020`.
> Este documento inventaria *evidências no repositório*. Não prova, por si só, que migrations estão aplicadas, que flags estão ligadas ou que funcionalidades funcionam em produção.

## 1. Decisão de escopo

Consolidar e evoluir o **KLASSE IA administrativo e pedagógico** sem copiar sistemas paralelos. Manter separados, mas documentados, os três canais já existentes:

1. **Copiloto administrativo interno:** widget, ajuda contextual, RAG local, Data Copilot, cockpit, insights, rascunhos e aprovação humana. Não escreve notas, pagamentos nem mensagens através da conversa.
2. **Integração externa KLASSE ↔ ChatGPT/Codex:** contrato de ferramentas autenticadas via JWT e RPCs que **inclui operações de escrita controladas**, com confirmação explícita e RLS. Não confundir com o assistente interno nem herdar permissões silenciosamente.
3. **IA pedagógica:** contratos de fontes e pedidos de geração de rascunhos do professor. A existência do endpoint de pedidos não equivale à existência de worker gerador.

Os documentos históricos de sprint são registros de intenção/estado na sua data, não uma segunda especificação normativa. Prioridade de verificação: **código e schema em `main` → testes → documentação operacional vigente → planos históricos**; validar o banco remoto separadamente antes de alterações SQL.

## 2. Inventário documental — fontes relevantes em main

### A. Fonte central do assistente

- `apps/web/src/lib/assistant/docs/readme-klasse-ai.md` — **leitura obrigatória**, arquitetura, ferramentas, permissões, cockpit, insights, limites e backlog P0–P2 (estado de julho de 2026).
- `apps/web/src/lib/assistant/docs/plano-actions-v2.md` — contrato de ações, matriz de risco, aprovação e evolução proposta; contém estados históricos que precisam ser reconciliados com código atual.
- `apps/web/src/lib/assistant/docs/manual-central-acoes-ai.md` — rascunhos e revisão/aprovação.
- `apps/web/src/lib/assistant/docs/regras-negocio-ia-whatsapp.md` — limites do assistente, fast path, geração e comunicação.
- `apps/web/src/lib/assistant/docs/manual-geral-klasse.md` — mapa geral de produto usado pela base de conhecimento.

### B. Regras, tutoriais e conhecimento incorporado

- `apps/web/src/lib/assistant/docs/regras-negocio-academico.md`
- `apps/web/src/lib/assistant/docs/regras-negocio-financeiro.md`
- `apps/web/src/lib/assistant/docs/regras-negocio-secretaria.md`
- `apps/web/src/lib/assistant/docs/regras-negocio-estrutura.md`
- `apps/web/src/lib/assistant/docs/manual-secretaria.md`
- `apps/web/src/lib/assistant/docs/manual-financeiro.md`
- `apps/web/src/lib/assistant/docs/manual-whatsapp-utility.md`
- `apps/web/src/lib/assistant/docs/tutoriais-alunos-turmas.md`
- `apps/web/src/lib/assistant/docs/tutoriais-comunicados-documentos.md`

**Regra de consolidação:** não editar cegamente instruções de navegação; reconciliar cada rota e permissão contra os registos de rotas e o código atual, principalmente depois do Command Center/Balcão.

### C. Data Copilot, inteligência e roadmap

- `docs/SPRINT_EXECUTIVO_KLASSE_DATA_COPILOT_V1.md` — plano e inventário de fontes canônicas de julho; várias rotas/arquivos propostos não devem ser assumidos como implementados.
- `docs/PLAN_EVOLUTION_PRE_CANDIDATURA_V2_INTELIGENCIA.md` — *proposta*, scoring e automação de admissões; não usar como feature já entregue.
- `docs/PROMPT_GEMINI_APRENDIZAGEM_CONTINUA_KLASSE_2026-08-12.md` — extensão segura de IA no editor pedagógico.
- `docs/PROMPT_GEMINI_BACKEND_PEDAGOGICO_KLASSE_2026-08-12.md` — contratos pedagógicos e plano de worker.
- `docs/STATUS_APRENDIZAGEM_CONTINUA_2026-08-12.md` — fotografia datada: geração automática de provas ainda pendente.
- `docs/SPRINT_LACUNAS_PRODUTO_KLASSE_2026-08-12.md` — dependências de aprendizagem contínua.

### D. Integrações e comunicação

- `docs/integrations/klasse-chatgpt.md` — contrato público ChatGPT/Codex, autenticação Bearer, lista de tools, confirmação e isolamento.
- `docs/WAHA_WHATSAPP_KLASSE_IMPLEMENTATION.md` — outbox, worker, aprovação, RLS e comunicação.
- `apps/web/public/.well-known/ai-plugin.json` — manifesto legado externo.
- `apps/web/public/.well-known/klasse-openapi.yaml` — contrato OpenAPI da integração externa (validar existência/versão no tree).
- `services/whatsapp-sales-agent/README.md` e `services/whatsapp-sales-agent/knowledge.md` — serviço adjacente; **não confundir** com o assistente central nem integrar sem revisão de escopo.

### E. Reconciliação histórica e PRs

- `work/klasse-ai-20261013:docs/ops/KLASSE_AI_BASE_RECONCILIATION_20261013.md` — não está em `main`; informa que PR #133/integração antiga já estava reconciliado e prescreve testes de contrato.
- `work/klasse-ai-20261013:.github/workflows/klasse-ai-reconciliation-guard.yml` — CI adicional nessa branch, **ainda não incorporado** à main.
- `work/klasse-ai-20261013:apps/web/tests/unit/klasse-ai-reconciliation.spec.ts` — testes adicionais nessa branch, ainda não incorporados.
- PR #133: `https://github.com/moxi-edtech/moxi-edtech/pull/133` — integração ChatGPT v0.2.0.
- PR #192: `https://github.com/moxi-edtech/moxi-edtech/pull/192` — reconciliação da integração a partir de main.
- PR #163: `https://github.com/moxi-edtech/moxi-edtech/pull/163` — DATA-INT/Impact institucional (escopo relacionado mas separado).

**Atenção:** `work/klasse-ai-20261013` divergiu de `main` (1 commit à frente, 9 atrás na data do levantamento). Não fazer merge/cherry-pick em bloco. Usar comparação seletiva e confirmar redundância dos contratos.

## 3. Inventário técnico — fonte de verdade a inspecionar antes de editar

### Orquestração e conhecimento

- `apps/web/src/components/ai/AiChatWidget.tsx`
- `apps/web/src/app/api/admin/ai/assistant/route.ts`
- `apps/web/src/lib/assistant/klasse-brain.ts`
- `apps/web/src/lib/assistant/knowledge-base-data.json`
- `apps/web/src/lib/assistant/build-knowledge.ts`
- `apps/web/src/lib/assistant/knowledge-search.ts`
- `apps/web/src/lib/assistant/knowledge-types.ts`
- `apps/web/src/lib/assistant/route-registry.ts`
- `apps/web/src/lib/assistant/screen-context.ts`
- `apps/web/src/lib/assistant/derive-widget-context.ts`
- `apps/web/src/lib/assistant/assistant-suggestions.ts`

### Data Copilot — ferramentas fechadas existentes no registry

- `apps/web/src/lib/assistant/data-copilot/tool-registry.ts`
- `apps/web/src/lib/assistant/data-copilot/types.ts`
- `apps/web/src/lib/assistant/data-copilot/answer-composer.ts`
- `apps/web/src/lib/assistant/data-copilot/finance-debt-by-class.ts`
- `apps/web/src/lib/assistant/data-copilot/tools/finance-risk-summary.ts`
- `apps/web/src/lib/assistant/data-copilot/tools/admissions-pending.ts`
- `apps/web/src/lib/assistant/data-copilot/tools/academic-pedagogical-risk.ts`
- `apps/web/src/lib/assistant/data-copilot/tools/academic-grade-gaps.ts`
- `apps/web/src/lib/assistant/data-copilot/tools/academic-low-attendance.ts`
- `apps/web/src/lib/assistant/data-copilot/tools/academic-calendar-operations.ts`
- `apps/web/src/lib/assistant/data-copilot/tools/school-daily-briefing.ts`

### Actions, cockpit e permissões

- `apps/web/src/lib/assistant/action-registry.ts`
- `apps/web/src/lib/assistant/actions-v2.ts`
- `apps/web/src/lib/assistant/permission-registry.ts`
- `apps/web/src/lib/roles/ai-roles.ts`
- `apps/web/src/lib/ai/default-features.ts`
- `apps/web/src/lib/server/ai/ai-actions.ts`
- `apps/web/src/lib/server/ai/ai-insights.ts`
- `apps/web/src/lib/server/ai/ai-guards.ts`
- `apps/web/src/lib/server/ai/provider-client.ts`
- `apps/web/src/lib/server/ai/text-generation.ts`
- `apps/web/src/app/escola/[id]/(portal)/admin/ai/KlasseAiCockpitClient.tsx`
- `apps/web/src/app/escola/[id]/(portal)/admin/ai/actions/AiActionsCenterClient.tsx`
- `apps/web/src/app/api/admin/ai/{access,actions,assistant,feedback,finance-message,generate-communication,insights,rewrite,summary}/`
- `apps/web/src/app/api/cron/ai/calendar-alerts/route.ts`

### Integração externa e IA pedagógica

- `apps/web/src/app/api/integrations/chatgpt/[tool]/route.ts`
- `apps/web/src/lib/integrations/klasse-chatgpt/{client,schemas,tools}.ts`
- `apps/web/src/app/api/professor/pedagogia/ai-requests/route.ts`
- `apps/web/src/app/api/professor/pedagogia/interventions/route.ts`
- `apps/web/src/app/api/aluno/pedagogia/{badges,diario}/route.ts`

### Migrations e contratos DB explicitamente relacionados

- `supabase/migrations/20260626120000_create_ai_actions.sql`
- `supabase/migrations/20260626153000_fix_ai_school_settings_select_policy.sql`
- `supabase/migrations/20260626220000_assistant_v3_feedback.sql`
- `supabase/migrations/20270718123000_create_ai_insights.sql`
- `supabase/migrations/20270718123500_harden_ai_insights_grants.sql`
- `supabase/migrations/20270726115000_create_pedagogical_risk_radar.sql`
- `supabase/migrations/20260927232530_klasse_chatgpt_readonly_rpcs.sql`
- `supabase/migrations/20260928120000_klasse_chatgpt_write_rpcs.sql`
- `supabase/migrations/20270718161000_revoke_anon_pedagogical_operations_execute.sql`
- `supabase/migrations/20270812160000_learning_activities_backend.sql` e `20270812170000_learning_platform_contracts.sql` — documentos pedagógicos referem estas migrations; validar sua presença e estado remoto separadamente.

### Testes atuais na main

- `apps/web/tests/unit/assistant-kb-modules.spec.ts`
- `apps/web/tests/unit/assistant-widget-context.spec.ts`
- `apps/web/tests/unit/klasse-chatgpt-contract.spec.ts`

## 4. Situação observada e riscos de divergência

| Área | Evidência de código/documento | Limite / trabalho de confirmação |
|---|---|---|
| Ajuda contextual / KB | `klasse-brain.ts`, `knowledge-base-data.json`, scripts KB | Identificar conteúdo desatualizado e rotas inexistentes; tratar documentos como conhecimento versionado |
| Data Copilot | registry com 8 ferramentas fechadas | Auditar cada fonte/RPC, scoping de tenant, limites, freshness e modos de falha |
| IA textual | `provider-client.ts` usa DeepSeek por padrão configurável, Gemini como fallback configurável | Não inferir credenciais/modelo ativo de produção a partir de defaults do código |
| Cockpit/insights | código de UI, API e migrações `ai_insights` | Validar RLS, workflow de estados e E2E com dados controlados |
| Actions/WhatsApp | actions v2 + Central + WAHA/outbox | Nenhum efeito externo automático por resposta; revisão humana preservada |
| ChatGPT externo | 11 tools documentadas, inclusive escrita com confirmação | **Difere intencionalmente** do copiloto interno; revisar contract tests e isolamento DB |
| IA pedagógica | fontes e `pedagogical_ai_requests` | Endpoint de pedidos não gera texto; worker deve ser provado antes de ativar UI |
| Aprendizagem contínua | documentação de agosto e APIs | Não vender como NotebookLM completo, correção automática ou ensino adaptativo |

**Conflitos/documentação desatualizada a auditar:**

1. `plano-actions-v2.md` descreve partes como "o que falta", enquanto `readme-klasse-ai.md` e o registry mostram implementação posterior.
2. Alguns manuais antigos descrevem rotas e UX anteriores ao workspace/Balcão atual; verificar `route-registry.ts` e a árvore Next.js.
3. O documento principal proíbe lançar notas/pagamentos por conversa no **copiloto interno**, enquanto a integração ChatGPT externa expõe ferramentas de escrita *com confirmação*. Não eliminar essa distinção por simplificação documental.
4. Os arquivos `docs/PROMPT_GEMINI_...` são instruções de implementação, não comprovação de operação em produção.
5. Métricas, RLS e disponibilidades do banco de produção não foram verificadas por este inventário.

## 5. Contratos invariantes de segurança

- Resolver identidade e escola **no servidor** a partir de sessão/JWT e vínculo verificado, não confiar em `schoolId` ou IDs enviados pelo modelo.
- Autorizar papel, feature flag e ferramenta **antes** de consultar os dados; respeitar RLS e restrições de `escola_id` em cada consulta.
- Não conceder ao modelo SQL livre, `service_role` ou endpoint arbitrário.
- Evitar PII desnecessária em prompts, logs, embeddings e respostas agregadas.
- Risco alto / comunicação externa: rascunho, confirmação visível e trilha de auditoria.
- Integração externa: manter invoker RPC, `anon` revogado, confirmação explícita, idempotência e proteção contra repetição de pagamentos.
- Dados académicos oficiais: notas, avaliações, pautas e frequências continuam no fluxo transacional e permissões existentes; IA não altera resultado sem a autorização formal prevista.
- Erros de serviço/fonte não podem ser mostrados como dados reais, nem respostas geradas ser persistidas como fato sem proveniência.

## 6. Plano de consolidação (próximas mudanças na própria branch)

**P0 — reconciliar realidade:** comparar documentação com código e rotas vigentes, mapear oito tools e permissões, checar flags, providers, schemas/índices e migrations aplicadas no Supabase; localizar qualquer segundo fluxo de IA em uso.

**P0 — contratos e regressão:** testes tenant A/B, anon, professor/aluno/encarregado, JWT inválido, quota, provider indisponível, ambiguidade, dados desatualizados, idempotência e aprovação; integrar seletivamente a guard da branch histórica se ainda útil.

**P1 — conhecimento:** fonte canônica versionada e processo de regeneração de `knowledge-base-data.json`; eliminar orientações de telas legadas, manter citações/proveniência e detectar discrepâncias de rotas no CI. Não criar segundo banco de conhecimento sem justificativa técnica.

**P1 — produto:** melhorar descoberta/contexto do widget e cockpit; observabilidade do modelo, limite de custo e qualidade de respostas; expandir ferramentas fechadas com fontes canônicas validadas.

**P2 — pedagógico:** confirmar worker, revisão docente, fontes MED versionadas, política de publicação e separação entre rascunho de exercício e avaliação oficial.

## 7. Critérios de conclusão

- Um contrato autoritativo por canal com inventário de arquivos e responsabilidades atualizado.
- Nenhuma regressão de RLS/role, pagamentos, notas, matrícula ou WhatsApp.
- Testes unitários/contrato, typecheck, lint, testes multi-tenant e fluxos E2E mínimos verdes.
- Comparação explícita entre schema local e remoto antes de SQL.
- PR isolado para `main`; sem merge nem deploy automático apenas por criar esta branch.

> **Estado deste commit:** só documentação de inventário/consolidação, nenhuma mudança funcional e nenhuma migration aplicada.
