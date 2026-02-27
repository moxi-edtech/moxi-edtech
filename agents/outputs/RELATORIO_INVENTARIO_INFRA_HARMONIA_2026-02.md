# KLASSE — Inventário de Integração (Infra & Harmonia de Fluxos)

Data: 2026-02-27  
Base: documento interno **"KLASSE — Infra para 100 Escolas + Harmonia de Fluxos UX"**  
Escopo verificado: `apps/web`, `supabase/functions`, `supabase/migrations`, `docs`

## 1) Sumário executivo (direto)

- **Infra base multi-tenant existe e está funcional** (RLS + resolução de escola por utilizador), mas ainda há dependência de disciplina em rotas para não regressar segurança.
- **Edge Functions e jobs assíncronos existem** (dispatcher + worker + runbook), com trilho de auditoria parcial.
- **Realtime está integrado para notificações**, com publicação no Postgres e subscription no cliente.
- **Storage está ativo**, com buckets específicos e políticas; porém o requisito de **backup de 7 anos** não está explícito/automatizado.
- **Observabilidade está parcial**: health endpoints e startup check existem; **Sentry/Logflare não está integrado no código**.
- **Harmonia UX (FluxoPosAccao/ConfirmacaoContextual/EstadoVazio/LIVE)** está **majoritariamente não materializada com esses contratos nominais**.
- **Onboarding self-service está bem avançado** (criação de escola + provisionamento + fluxos onboarding), mas **SLA 1h sem suporte** ainda depende de robustez operacional (monitorização + rate limiting + QA de importação).

---

## 2) Inventário por feature (com pontos de integração e referências)

## 2.1 RLS multi-tenant por escola
**Status:** Implementado (com risco de regressão por endpoint humano sem guard)

**Pontos de integração**
- **DB / Segurança (RLS policies):** políticas tenant/super-admin e limpeza de políticas redundantes.
- **App / API guard:** helper de resolução de `escola_id` por utilizador para isolar queries.

**Referências**
- `supabase/migrations/20260127020200_klasse_p0b_rls_cleanup.sql`
- `supabase/migrations/20260202006000_balcao_servicos_rls.sql`
- `supabase/migrations/20261120133000_onboarding_drafts_rls_policies.sql`
- `apps/web/src/lib/tenant/resolveEscolaIdForUser.ts`

**Nota cética**
- A base está correta; o ponto frágil é **consistência de uso** do helper em todos os endpoints humanos.

## 2.2 Edge Functions em produção
**Status:** Implementado (focado em outbox/jobs)

**Pontos de integração**
- **Dispatcher (Edge):** aciona job HTTP interno com token de cron.
- **Worker (Edge):** consome eventos com RPC `outbox_claim` e reporta sucesso/falha.
- **Operação:** runbook de deploy, secrets, schedule e teste rápido.

**Referências**
- `supabase/functions/outbox-dispatch/index.ts`
- `supabase/functions/outbox-worker/index.ts`
- `docs/outbox-worker-runbook.md`

**Nota cética**
- Há TODOs no worker; sem handlers completos por `event_type`, risco de backlog/dead-letter crescer.

## 2.3 Realtime ativo
**Status:** Implementado (notificações)

**Pontos de integração**
- **DB:** tabela de notificações adicionada à publication `supabase_realtime`.
- **Client:** subscription para INSERT/UPDATE por `destinatario_id`.

**Referências**
- `supabase/migrations/20260225000003_eventos_notificacoes_realtime.sql`
- `apps/web/src/hooks/useNotificacoes.ts`

**Nota cética**
- Bom para sensação de “sistema vivo”; validar consumo de canais em alta concorrência (100 escolas) e limites de fan-out.

## 2.4 Storage para documentos
**Status:** Parcial

**Pontos de integração**
- **Buckets:** criação de buckets dedicados para documentos oficiais/lotes.
- **API:** upload/remoção em fluxos de migração e operações administrativas.

**Referências**
- `supabase/migrations/20261128063000_create_pautas_oficiais_bucket.sql`
- `supabase/migrations/20261128068000_create_pautas_zip_bucket.sql`
- `apps/web/src/app/api/migracao/upload/route.ts`
- `apps/web/src/app/api/migracao/[importId]/route.ts`

**Nota cética**
- No material validado não há evidência explícita de estratégia de **archive bucket com retenção legal (7 anos)** para todos os documentos críticos.

## 2.5 Background jobs / cron
**Status:** Implementado

**Pontos de integração**
- **Jobs assíncronos:** pipeline outbox (dispatch + worker).
- **Cron DB:** refresh de materialized views via `cron.schedule`.

**Referências**
- `supabase/functions/outbox-dispatch/index.ts`
- `docs/outbox-worker-runbook.md`
- `supabase/migrations/20260203000008_materialize_vw_boletim.sql`
- `supabase/migrations/20261107000000_financeiro_inadimplencia_top_mv.sql`

## 2.6 Índices críticos (Secção 3 do documento)
**Status:** Parcial

**Pontos de integração**
- Existem vários índices por `escola_id` e combinações de busca.
- Existe índice alinhado ao caso de matrículas por aluno/ano (variante com `escola_id`).
- Uso explícito de `CREATE INDEX CONCURRENTLY` em migrations ativas é praticamente inexistente (só comentário encontrado).

**Referências**
- `supabase/migrations/20260127020139_remote_schema.sql` (ex.: `alunos_escola_id_idx`, `idx_matriculas_aluno_ano_escola`, `idx_pagamentos_escola`)
- `supabase/migrations/20260127020500_fix_p0_issues.sql` (comentário sobre índice concurrently)

**Nota cética**
- Tens índice em muita coisa, mas não está claro que os **7 índices priorizados no documento** foram aplicados exatamente como definidos (nome/colunas/partial/concurrently).

## 2.7 Connection pooling (pgBouncer)
**Status:** Parcial (documentado, não “enforçado” por contrato de runtime)

**Pontos de integração**
- Guias operacionais distinguem uso de portas 6543/5432 por contexto.
- Scripts e docs reforçam DB_URL via pooler.

**Referências**
- `README-db.md`
- `docs/supabase-remote-pull.md`
- `scripts/README.md`

**Nota cética**
- Documentação ajuda, mas sem validação automática no CI/env, erro humano de string de conexão continua possível.

## 2.8 Observabilidade (Sentry, health, uptime, performance)
**Status:** Parcial

**Pontos de integração**
- **Health endpoint:** `/api/health` e `/api/health/supabase` disponíveis.
- **Startup diagnostics:** `instrumentation.ts` verifica health de auth Supabase.

**Referências**
- `apps/web/src/app/api/health/route.ts`
- `apps/web/src/app/api/health/supabase/route.ts`
- `apps/web/src/instrumentation.ts`

**Lacunas identificadas**
- Sem integração explícita de **Sentry** no código verificado.
- Sem evidência de dashboard consolidado (queries/s, p95, erros/hora) no app.

## 2.9 Harmonia de Fluxos UX (FluxoPosAccao, confirmação contextual, estados vazios, KPI vivo)
**Status:** Lacuna (por nomenclatura/contrato explícito)

**Pontos de integração encontrados**
- Não foram encontrados artefactos com as assinaturas nominais `FluxoPosAccao`, `ConfirmacaoContextual`, `EstadoVazio` ou marcador global `LIVE` via busca textual.

**Referências (evidência de ausência por varredura)**
- Busca em `apps/web/src/**` por: `FluxoPosAccao|ConfirmacaoContextual|EstadoVazio|LIVE` (sem matches)

**Nota cética**
- Aqui mora a retenção. Infra sem esse layer de UX consistente vira “ERP funcional”, não produto viciante.

## 2.10 Onboarding de escola self-service (ESCOLA_DNA + ativação)
**Status:** Parcial-avançado

**Pontos de integração**
- **Criação de escola + provisionamento admin + email de onboarding**.
- **Fluxos de onboarding em APIs dedicadas** (`core/session`, `preferences`, etc.).
- **Wizard/componentes de onboarding e presets curriculares**.

**Referências**
- `apps/web/src/app/api/escolas/create/route.ts`
- `apps/web/src/app/api/escolas/[id]/onboarding/core/session/route.ts`
- `apps/web/src/app/api/escolas/[id]/onboarding/preferences/route.ts`
- `apps/web/src/components/escola/onboarding/AcademicSetupWizard.tsx`
- `apps/web/src/lib/onboarding.ts`

**Nota cética**
- “Operacional em 1 hora sem falar contigo” exige ainda: monitorização ativa + limites de abuso + testes de ponta-a-ponta com dados reais.

## 2.11 Segurança mínima (service key, validação input, rate limiting, auditoria)
**Status:** Parcial

**Pontos de integração**
- **Validação de input com Zod** em rotas críticas (ex.: criação de escola).
- **Auditoria** em fluxos assíncronos (outbox) e migrations com reforço de audit em RPCs financeiras.
- **Verificação pública por hash** para autenticidade documental e QR em emissão/print.

**Referências**
- `apps/web/src/app/api/escolas/create/route.ts`
- `supabase/functions/outbox-worker/index.ts`
- `supabase/migrations/20260203000016_add_audit_to_finance_rpcs.sql`
- `apps/web/src/app/api/public/documentos/[publicId]/route.ts`
- `apps/web/src/app/documentos/[publicId]/page.tsx`
- `apps/web/src/components/financeiro/ReciboImprimivel.tsx`

**Lacunas identificadas**
- Não foi encontrada implementação concreta de **rate limiting** (apenas checklist/documentação menciona necessidade).

**Referências lacuna**
- `docs/checklists.md`

---

## 3) Mapa de integração por camada

| Feature | Frontend | API/Next | Edge Function | DB (migrations/RPC/MV) | Operação/docs |
|---|---|---|---|---|---|
| RLS multi-tenant | — | `resolveEscolaIdForUser` | — | policies RLS | contrato/agentes |
| Realtime | `useNotificacoes` | — | — | publication realtime | — |
| Jobs assíncronos | — | `/api/jobs/outbox` (via runbook) | outbox-dispatch/worker | RPC outbox/audit | runbook |
| Health/observabilidade base | páginas internas/monitor | `/api/health*` | — | — | uptime manual |
| Onboarding escola | wizard onboarding | criação + sessão + preferências | — | tabelas/rls onboarding | guias internos |
| Documentos oficiais + verificação | impressão/QR | API pública de verificação | — | hash + emissão em RPCs | fluxos secretaria |

---

## 4) Gaps prioritários (ordem de ataque recomendada)

1. **Observabilidade real de produção (Sentry + alertas + painéis p95/erro)**.  
2. **Rate limiting obrigatório** nos pontos públicos/sensíveis (`/ativar-acesso`, endpoints críticos de emissão/consulta).  
3. **Fechar contrato UX de Harmonia de Fluxos** (5 eventos críticos com pós-ação + confirmação contextual + empty-state intencional + indicador live consistente).  
4. **Formalizar checklist de índices críticos do documento com evidência SQL reproduzível** (incluindo estratégia `CONCURRENTLY` para produção).  
5. **Automatizar validação de configuração de pooling** por ambiente para reduzir erro operacional.

---

## 5) Veredito objetivo

- **Infra para chegar a 100 escolas:** viável **sem rewrite**.
- **Risco real hoje:** não é Postgres “cair”; é **qualidade operacional + consistência UX + guardrails de segurança/observabilidade**.
- **Mensagem direta:** a fundação está boa, mas sem os parafusos de monitorização, anti-abuso e harmonia de fluxo, vais escalar dor de suporte junto com escolas.
