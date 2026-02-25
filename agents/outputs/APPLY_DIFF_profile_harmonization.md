diff --git a/AGENTS.md b/AGENTS.md
index 22139997..1fb231d1 100644
--- a/AGENTS.md
+++ b/AGENTS.md
@@ -1,170 +1,654 @@
 # KLASSE — Engineering Agents Contract
+> Versão: 2.0.0
+> Hash de versão: verificar com `sha256sum agents/ENGINEERING_AGENTS_CONTRACT.md`
+> Precedência: este ficheiro tem autoridade sobre qualquer opinião de agente, dev, ou atalho técnico.
+> Última revisão: 2026-02-24
 
-Este arquivo define os agentes automáticos do repositório KLASSE.
-Eles NÃO são assistentes genéricos.
-São agentes de fundador, com poder de BLOQUEIO.
+---
+
+## Como ler este contrato
+
+Cada regra tem:
+- **ID único** — referenciado nos reports e nos commits
+- **Critério de detecção** — o que o agente procura, sem ambiguidade
+- **Evidência obrigatória** — o formato exacto que o agente deve produzir
+- **Classificação** — CRITICAL | HIGH | MEDIUM | LOW | PASS
+- **Excepções documentadas** — casos onde a regra não se aplica
 
-Nenhum PR passa sem respeitar este contrato.
+Um agente que não consegue preencher todos os campos de evidência obrigatória para um finding **não deve reportar esse finding**. Incerteza é WARN, não FAIL.
 
 ---
 
-## 🧠 AGENT 1 — Codex Scan v2 (Auditor)
+## Formato de evidência obrigatório
+
+Todo o finding deve usar exactamente este formato.
+Findings sem este formato completo são inválidos e ignorados.
+
+```
+FINDING
+  id:            [REGRA_ID]-[SHA8_DO_FICHEIRO]
+  regra:         [REGRA_ID]
+  severidade:    CRITICAL | HIGH | MEDIUM | LOW
+  status:        FAIL | WARN | REGRESSION | PASS
+  ficheiro:      [path relativo à raiz do repo]
+  linha:         [número de linha ou range]
+  evidencia:     [trecho de código exacto, máximo 3 linhas]
+  impacto:       [consequência concreta em 1 frase]
+  recomendacao:  [acção exacta em 1 frase]
+  bloqueante:    true | false
+  excecao:       [ID da excepção se aplicável, ou null]
+```
 
-### Objetivo
-Detectar violações estruturais, riscos de multi-tenant, regressões de performance e uso de APIs deprecated.
+---
 
-### Escopo
-- Frontend (Next.js)
-- API Routes
-- SQL / Migrations
-- Supabase helpers
-- Performance invariants
+## Contrato de PASS
 
-### Falhas CRÍTICAS (BLOCKER)
-O agente deve FALHAR o scan se detectar qualquer um dos itens abaixo:
+Um agente emite PASS quando:
+- Zero findings com `bloqueante: true`
+- Todos os WARNs têm ticket registado em `agents/outputs/WARN_REGISTRY.md`
+- Nenhuma REGRESSION detectada face ao último report
+- Output completo gerado sem erros
 
-#### Segurança & Multi-tenant
-- Resolução de `escola_id` sem `user_id`
-- Query em tabelas sem RLS
-- Uso de `profiles` sem `.eq('user_id', user.id)`
-- Endpoint que não usa `resolveEscolaIdForUser`
+PASS parcial não existe. É PASS ou é FAIL/WARN.
+
+---
 
-#### Infra & APIs
-- Uso de `@supabase/auth-helpers-nextjs`
-- Uso de `createRouteHandlerClient`
-- Uso de helpers deprecated do Supabase
+## Contrato de REGRESSION
 
-#### Performance
-- Dashboard com `COUNT`, `SUM`, `GROUP BY` direto
-- Métrica calculada ao vivo
-- Falta de MATERIALIZED VIEW em dashboards
-- MATERIALIZED VIEW sem UNIQUE INDEX
+Uma REGRESSION ocorre quando um finding com `status: PASS` num report anterior passa a `status: FAIL`.
 
-#### Cache indevido
-- Cache ativo (`revalidate`, ISR, fetch cache) em:
-  - Financeiro
-  - Secretaria
-  - Dashboards
-  - Relatórios
+Regras:
+1. REGRESSION é sempre `bloqueante: true` independentemente da severidade original
+2. O agente deve incluir no finding:
+   - `evidencia_anterior:` o estado PASS do run anterior
+   - `evidencia_actual:` o estado FAIL actual
+   - `commit_regressao:` hash do commit que introduziu a regressão (se identificável)
+3. O agente compara com `agents/outputs/REPORT_SCAN_LAST_PASS.json` para detectar regressões
+4. Se `REPORT_SCAN_LAST_PASS.json` não existir, não há regressões a reportar
 
 ---
 
-### Falhas MÉDIAS (WARN)
-- Pesquisa global sem debounce 250–400ms
-- Payload excessivo em busca
-- `limit > 50`
-- `orderBy` não determinístico
+## Tabela de cache — excepções documentadas
+
+Esta tabela define quando `no-store` é obrigatório e quando `revalidate` é permitido.
+O Agent 1 e o Agent 2 usam esta tabela para avaliar regras de cache.
+**Regras de cache sem entrada nesta tabela são avaliadas como `no-store` obrigatório.**
+
+| Padrão de path / componente | Política obrigatória | Justificação |
+|---|---|---|
+| `/api/financeiro/**` | `no-store` | Dados financeiros em tempo real |
+| `/api/secretaria/balcao/**` | `no-store` | Operações de balcão ao vivo |
+| `/api/secretaria/pagamentos/**` | `no-store` | Pagamentos não podem ser cacheados |
+| `/api/secretaria/matriculas/**` | `no-store` | Estado de matrícula muda ao segundo |
+| `/api/secretaria/notas/**` | `no-store` | Notas são dados académicos oficiais |
+| `/api/secretaria/frequencias/**` | `no-store` | Frequência operacional |
+| `/api/professor/**` | `no-store` | Dados de trabalho activo |
+| `/api/aluno/**` | `no-store` | Portal do aluno: dados pessoais |
+| `components/layout/*Layout*` | `revalidate: 300` | Branding e navegação — muda raramente |
+| `/api/escola/*/configuracoes` | `revalidate: 60` | Configurações — muda raramente |
+| `components/*Banner*` | `revalidate: 60` | Avisos de sistema |
+| `/api/escola/*/plano` | `revalidate: 300` | Plano da escola — muda raramente |
+| `/api/vw_*` | `no-store` | Wrappers de MV — dados frescos obrigatórios |
 
 ---
 
-### Output
-Gera obrigatoriamente:
-- `agents/outputs/REPORT_SCAN.md`
-- `agents/ACADEMIC_REPORT_SCAN.md`
-- `agents/outputs/REPORT_INDEX.md`
-- Severidade: CRITICAL | HIGH | MEDIUM | LOW
-- Evidências com paths reais
-- Recomendação objetiva (1 linha)
+## Matriz de MVs obrigatórias
+
+Cada rota listada exige a MV correspondente com todos os artefactos.
+O Agent 2 valida esta matriz em cada run.
+
+| Rota | MV obrigatória | INDEX | Refresh fn | Wrapper | Cron |
+|---|---|---|---|---|---|
+| `/secretaria/dashboard` | `mv_secretaria_dashboard_counts` | `ux_mv_secretaria_dashboard_counts` | `refresh_mv_secretaria_dashboard_counts` | `vw_secretaria_dashboard_counts` | obrigatório |
+| `/secretaria/matriculas` | `mv_secretaria_matriculas_status` | `ux_mv_secretaria_matriculas_status` | `refresh_mv_secretaria_matriculas_status` | `vw_secretaria_matriculas_status` | obrigatório |
+| `/financeiro/radar` | `mv_radar_inadimplencia` | `ux_mv_radar_inadimplencia` | `refresh_mv_radar_inadimplencia` | `vw_radar_inadimplencia` | obrigatório |
+| `/financeiro/pagamentos` | `mv_pagamentos_status` | `ux_mv_pagamentos_status` | `refresh_mv_pagamentos_status` | `vw_pagamentos_status` | obrigatório |
+
+**Status de artefacto de MV:**
+- Todos presentes → PASS
+- 1–2 em falta → PARTIAL (HIGH, bloqueante: true)
+- MV inexistente → FAIL (CRITICAL, bloqueante: true)
+- MV existe mas sem cron → PARTIAL (HIGH, bloqueante: true)
 
 ---
 
-## ⚡ AGENT 2 — Performance Agent (Hard Gate)
+## AGENT 1 — Codex Scan (Auditor)
 
-### Objetivo
-Garantir que KLASSE nunca degrade com escala.
-Este agente BLOQUEIA merges.
+**Versão:** 1.2
+**Escopo:** Frontend, API Routes, SQL/Migrations, Supabase helpers
+**Output obrigatório:** `agents/outputs/REPORT_SCAN.md`, `agents/outputs/REPORT_SCAN.json`
+**Compara com:** `agents/outputs/REPORT_SCAN_LAST_PASS.json`
+
+### Regras CRITICAL (bloqueante: true)
 
 ---
 
-### Regras Invioláveis
+**RULE: SEC-001**
+Endpoint humano sem `resolveEscolaIdForUser`
+
+```
+detecção:
+  ficheiros: apps/web/src/app/api/**/*.ts
+  excluir:   paths contendo /jobs/, /workers/, /cron/, /inngest/, /super-admin/
+  condição:  ficheiro exporta GET, POST, PUT, PATCH, DELETE
+             E não contém "resolveEscolaIdForUser"
+             E contém "supabase" (faz queries)
+
+evidência obrigatória:
+  - linha da export handler
+  - presença/ausência de resolveEscolaIdForUser
+  - primeira query encontrada no ficheiro
+
+excepções:
+  EXC-SEC-001-A: rotas de autenticação (/api/auth/**)
+  EXC-SEC-001-B: rotas públicas documentadas em agents/exceptions/public-routes.md
+```
+
+---
 
-#### Dashboards
-- ❌ Proibido cálculo ao vivo
-- ✅ Somente `vw_*`
-- ✅ Toda `vw_*` encapsula `mv_*`
+**RULE: SEC-002**
+Service Role em endpoint humano
 
-#### MATERIALIZED VIEWS
-Cada MV DEVE ter:
-- UNIQUE INDEX
-- REFRESH CONCURRENTLY
-- Função `refresh_mv_*`
-- `cron.schedule`
-- View wrapper `vw_*`
+```
+detecção:
+  ficheiros: apps/web/src/app/api/**/*.ts
+  excluir:   paths contendo /jobs/, /workers/, /cron/, /inngest/
+  condição:  contém SUPABASE_SERVICE_ROLE_KEY
+             OU contém supabaseAdmin
+             OU contém createClient({ serviceRole })
+
+evidência obrigatória:
+  - linha exacta com service role
+  - nome da variável/função usada
+
+excepções:
+  EXC-SEC-002-A: rotas de provisionamento documentadas em agents/exceptions/service-role-allowed.md
+```
 
 ---
 
-### Cache Policy
-Para dados críticos:
+**RULE: SEC-003**
+Query em tabela crítica sem `.eq('escola_id', ...)`
 
-```ts
-export const dynamic = 'force-dynamic'
-export const revalidate = 0
-cache: 'no-store'
 ```
+detecção:
+  ficheiros: apps/web/src/app/api/**/*.ts
+  tabelas:   anos_letivos, periodos_letivos, cursos, classes, turmas,
+             matriculas, turma_disciplinas, avaliacoes, notas, frequencias,
+             financeiro_titulos, financeiro_cobrancas, pagamentos
+  condição:  ficheiro faz .from('[tabela_crítica]')
+             E não contém .eq('escola_id'
+             E não contém .eq(`escola_id`
+             E não está numa rpc() call (RPCs têm escola_id no argumento)
+
+evidência obrigatória:
+  - linha do .from()
+  - ausência de .eq('escola_id')
+  - nome da tabela afectada
+```
+
+---
 
-Qualquer violação = FAIL.
+**RULE: SEC-004**
+Helper Supabase deprecated
 
-### P0.3 — Rotas obrigatórias para MV
-Consulte `docs/mv-required-routes.md` para a matriz de decisão e a lista oficial.
+```
+detecção:
+  ficheiros: **/*.ts, **/*.tsx
+  condição:  contém @supabase/auth-helpers-nextjs
+             OU contém createRouteHandlerClient
+             OU contém createMiddlewareClient
+             OU contém createBrowserSupabaseClient (legado)
+
+evidência obrigatória:
+  - import exacto encontrado
+  - substituto correcto (ex: @supabase/ssr → createServerClient)
+```
 
 ---
 
-### Output
-- Lista de MVs existentes
-- Lista de dashboards cobertos
-- Alertas de cálculo ao vivo
-- Status final: PASS | FAIL
+**RULE: PERF-001**
+Cálculo ao vivo em dashboard
+
+```
+detecção:
+  ficheiros: apps/web/src/app/api/**/*.ts
+  condição:  path contém /dashboard/ OU /relatorio/ OU /admin/
+             E contém .select('*').count('exact')
+             OU contém COUNT(*) em query string
+             OU contém SUM( em query string
+             OU contém GROUP BY em query string
+             E NÃO usa .from('mv_') E NÃO usa .from('vw_')
+
+evidência obrigatória:
+  - query completa (máximo 5 linhas)
+  - path da rota
+  - MV equivalente se existir na matriz
+```
 
 ---
 
-## 🛠️ AGENT 3 — Apply Agent (Executor Seguro)
+**RULE: PERF-002**
+MV sem UNIQUE INDEX
 
-### Objetivo
+```
+detecção:
+  ficheiros: supabase/migrations/**/*.sql
+  condição:  contém CREATE MATERIALIZED VIEW [nome]
+             E NÃO existe CREATE UNIQUE INDEX [qualquer_nome] ON [nome]
+             no mesmo ficheiro OU em migration posterior
+
+evidência obrigatória:
+  - linha da CREATE MATERIALIZED VIEW
+  - ausência de UNIQUE INDEX
+  - nome da MV afectada
+```
 
-Aplicar correções automáticas SEM quebrar contratos.
+---
+
+**RULE: CACHE-001**
+Cache indevido em rota financeira/operacional
+
+```
+detecção:
+  ficheiros: apps/web/src/app/api/**/*.ts
+  condição:  path corresponde a padrão no-store obrigatório na tabela de cache
+             E contém revalidate = [número > 0]
+             OU contém cache: 'force-cache'
+             OU contém next: { revalidate: [número > 0] }
+
+evidência obrigatória:
+  - linha com cache indevido
+  - path da rota
+  - política correcta segundo tabela de cache
+
+excepções: nenhuma para rotas financeiras/operacionais
+```
 
 ---
 
-### Pode executar SEM aprovação
-- Adicionar índices
-- Ajustar debounce
-- Corrigir orderBy
-- Remover helpers deprecated
-- Padronizar resolução de escola
-- Ajustar imports Supabase SSR
+**RULE: PLAN-001**
+Feature premium sem backend guard
+
+```
+detecção:
+  ficheiros: apps/web/src/app/api/**/*.ts
+  features:  fin_recibo_pdf, doc_qr_code, relatorio_avancado
+  condição:  path contém rota associada à feature (ver agents/exceptions/premium-routes.md)
+             E NÃO contém requireFeature( OU checkPlan( OU planGuard(
+
+evidência obrigatória:
+  - path da rota
+  - feature esperada
+  - ausência de guard
+  - curl de bypass possível (exemplo)
+```
 
 ---
 
-### Exige aprovação explícita
-- DROP TABLE / COLUMN
-- Refactor estrutural
-- Mudança de contrato SQL
-- Alterar RLS
-- Alterar schema financeiro
+### Regras MEDIUM (bloqueante: false)
 
 ---
 
-### Regras
-- Nunca executar destructive SQL
-- Nunca alterar dados reais
-- Sempre gerar diff claro
-- Sempre respeitar `P0_CHECKLIST.md`
+**RULE: PERF-003**
+Pesquisa sem debounce
+
+```
+detecção:
+  ficheiros: apps/web/src/**/*.tsx, apps/web/src/**/*.ts
+  condição:  contém onChange= OU onInput=
+             E query/search string vai para fetch/supabase
+             E NÃO contém debounce( OU useDebounce( OU setTimeout(
+
+evidência obrigatória:
+  - componente/hook afectado
+  - ausência de debounce
+  - impacto estimado (queries por keystroke)
+```
 
 ---
 
-## 🧠 Princípios KLASSE (Obrigatórios)
-- Dados reais > cache
-- Pré-cálculo > cálculo ao vivo
-- Contrato > conveniência
-- Escala primeiro, feature depois
+**RULE: PERF-004**
+Limit > 50 em query de lista
+
+```
+detecção:
+  ficheiros: apps/web/src/app/api/**/*.ts
+  condição:  contém .limit([número > 50])
+             OU url.searchParams.get('limit') sem validação de máximo
+
+evidência obrigatória:
+  - linha com limit
+  - valor encontrado
+  - rota afectada
+```
 
 ---
 
-## 📌 Autoridade
+**RULE: DATA-001**
+`orderBy` não determinístico
+
+```
+detecção:
+  ficheiros: apps/web/src/app/api/**/*.ts
+  condição:  contém .order( sem campo único como id ou created_at como tie-breaker
+
+evidência obrigatória:
+  - query completa
+  - campo de ordenação encontrado
+  - tie-breaker em falta
+```
+
+---
+
+### Output do Agent 1
+
+Ficheiros gerados obrigatoriamente após cada run:
+
+**`agents/outputs/REPORT_SCAN.md`**
+```markdown
+# KLASSE — Codex Scan Report
+contrato_versao: 2.0.0
+run_timestamp:   [ISO 8601]
+run_id:          [UUID]
+commit:          [git SHA]
+
+## Sumário
+| Severidade | Total | Bloqueantes |
+|---|---|---|
+| CRITICAL | N | N |
+| HIGH | N | N |
+| MEDIUM | N | 0 |
+| LOW | N | 0 |
+| REGRESSION | N | N |
+
+## Veredito
+PASS | FAIL | WARN
+
+## Blockers activos
+[lista de finding IDs bloqueantes]
+
+## Findings
+[um bloco FINDING por violação, formato obrigatório acima]
 
-Este arquivo tem precedência sobre:
-- Opinião do agente
-- Opinião do dev
-- Atalho técnico
+## Regressões
+[comparação com REPORT_SCAN_LAST_PASS.json]
+
+## Excepções activas
+[lista de excepções aplicadas neste run]
+```
+
+**`agents/outputs/REPORT_SCAN.json`**
+```json
+{
+  "contrato_versao": "2.0.0",
+  "run_id": "uuid",
+  "run_timestamp": "ISO8601",
+  "commit": "sha",
+  "veredito": "PASS|FAIL|WARN",
+  "can_merge": true|false,
+  "summary": { "critical": 0, "high": 0, "medium": 0, "regressions": 0 },
+  "findings": [ ... ],
+  "exceptions_applied": [ ... ]
+}
+```
+
+Se `veredito = PASS`, copiar `REPORT_SCAN.json` para `REPORT_SCAN_LAST_PASS.json`.
+
+---
+
+## AGENT 2 — Performance Gate (Hard Gate)
+
+**Versão:** 1.2
+**Escopo:** MVs, dashboards, cache, queries de escala
+**Output obrigatório:** `agents/outputs/PERFORMANCE_GATE.md`
+**Bloqueia merge:** sim, se `can_merge: false`
+
+### Regras invioláveis
+
+---
+
+**RULE: MV-001**
+Dashboard usa query directa em vez de `vw_*`
+
+```
+detecção:
+  para cada rota na matriz de MVs obrigatórias:
+    verificar se a rota usa .from('vw_[nome]') OU rpc('vw_[nome]')
+    se não → FAIL
+
+evidência obrigatória:
+  - rota afectada
+  - MV esperada segundo matriz
+  - query encontrada
+```
+
+---
+
+**RULE: MV-002**
+MV na matriz sem todos os artefactos
+
+```
+para cada MV na matriz de MVs obrigatórias, verificar em supabase/migrations/**:
+  □ CREATE MATERIALIZED VIEW [mv_nome]
+  □ CREATE UNIQUE INDEX [ux_mv_nome] ON [mv_nome]
+  □ CREATE OR REPLACE FUNCTION refresh_[mv_nome]
+  □ SELECT cron.schedule(... 'refresh_[mv_nome]' ...)
+  □ CREATE OR REPLACE VIEW [vw_nome] AS SELECT * FROM [mv_nome]
+
+status por MV:
+  5/5 presentes → PASS
+  3-4/5 presentes → PARTIAL (HIGH, bloqueante: true)
+  1-2/5 presentes → FAIL (CRITICAL, bloqueante: true)
+  0/5 presentes → FAIL (CRITICAL, bloqueante: true)
+
+evidência obrigatória:
+  - tabela de artefactos com ✅/❌ por item
+  - migration onde cada artefacto foi encontrado
+  - artefactos em falta com migration sugerida
+```
+
+---
+
+**RULE: MV-003**
+`REFRESH MATERIALIZED VIEW` sem `CONCURRENTLY`
+
+```
+detecção:
+  ficheiros: supabase/migrations/**/*.sql
+  condição:  contém REFRESH MATERIALIZED VIEW [nome]
+             E NÃO contém REFRESH MATERIALIZED VIEW CONCURRENTLY [nome]
+
+evidência obrigatória:
+  - linha exacta
+  - migration afectada
+  - impacto: lock exclusivo durante refresh
+```
+
+---
+
+**RULE: CACHE-002**
+`force-dynamic` ausente em rota de dashboard/financeiro
+
+```
+detecção:
+  ficheiros: apps/web/src/app/**/page.tsx, apps/web/src/app/api/**/*.ts
+  condição:  path corresponde a no-store obrigatório na tabela de cache
+             E NÃO contém export const dynamic = 'force-dynamic'
+             E NÃO contém cache: 'no-store' em todos os fetch()
+
+evidência obrigatória:
+  - path do ficheiro
+  - ausência de force-dynamic
+  - fetch sem no-store encontrado (se aplicável)
+```
+
+---
+
+### Output do Agent 2
+
+**`agents/outputs/PERFORMANCE_GATE.md`**
+```markdown
+# KLASSE — Performance Gate
+contrato_versao: 2.0.0
+run_timestamp:   [ISO 8601]
+run_id:          [UUID]
+
+## Status: PASS | FAIL
+
+## MVs
+| MV | INDEX | Refresh Fn | Cron | Wrapper | Status |
+|---|---|---|---|---|---|
+| mv_radar_inadimplencia | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | PASS/PARTIAL/FAIL |
+...
+
+## Dashboards cobertos
+[lista de rotas com MV correspondente]
+
+## Alertas de cálculo ao vivo
+[findings MV-001]
+
+## Veredito
+can_merge: true | false
+```
+
+---
+
+## AGENT 3 — Apply Agent (Executor Seguro)
+
+**Versão:** 1.1
+**Escopo:** Correções automáticas de baixo risco
+**Princípio:** Nunca executar o que não consegue reverter com um único `git revert`
+
+### Pode executar SEM aprovação humana
+
+Estas acções são seguras, reversíveis, e não alteram contratos:
+
+| Acção | Condição |
+|---|---|
+| Adicionar índice não-único | Tabela existe, índice não existe |
+| Ajustar debounce para 250–400ms | Valor actual fora do range |
+| Corrigir `orderBy` sem tie-breaker | Adicionar `.order('id')` como secondary sort |
+| Remover helper deprecated | Substituto confirmado na tabela de migração de helpers |
+| Padronizar `resolveEscolaIdForUser` | Padrão correcto identificado na rota |
+| Ajustar imports `@supabase/ssr` | Import antigo → import novo sem mudança de comportamento |
+| Adicionar `cache: 'no-store'` | Rota na lista no-store obrigatório |
+| Corrigir `limit` para máximo 50 | Valor actual > 50 |
+
+### Exige aprovação antes de executar
+
+Quando o Agent 3 detecta uma destas situações, **para completamente**, gera `agents/outputs/PENDING_APPROVAL.md` com o diff proposto, e aguarda um commit com mensagem `APPROVE: [run_id]`.
+
+| Acção | Razão |
+|---|---|
+| DROP TABLE / DROP COLUMN | Destrutivo e irreversível |
+| ALTER TABLE em tabela financeira | Risco de perda de dados |
+| Alteração de política RLS | Impacto de segurança |
+| Alteração de schema em `pagamentos`, `audit_logs` | Dados financeiros e auditoria |
+| Refactor estrutural (move de ficheiros) | Pode quebrar imports |
+| Mudança de contrato SQL (nomes de colunas, tipos) | Impacto em produção |
+
+**Formato de `PENDING_APPROVAL.md`:**
+```markdown
+# Aprovação necessária — Agent 3
+run_id:    [UUID]
+timestamp: [ISO 8601]
+
+## Acção proposta
+[descrição em linguagem humana]
+
+## Diff
+```diff
+[diff exacto]
+```
+
+## Risco
+[consequência se algo correr mal]
+
+## Como aprovar
+Commit com mensagem: `APPROVE: [run_id]`
+
+## Como rejeitar
+Commit com mensagem: `REJECT: [run_id] [motivo]`
+```
+
+### Regras absolutas do Agent 3
+
+1. **Nunca executar SQL destrutivo** — DROP, TRUNCATE, DELETE sem WHERE são proibidos sem aprovação
+2. **Nunca alterar dados reais** — apenas schema e código
+3. **Sempre gerar diff antes de aplicar** — o diff deve estar em `agents/outputs/APPLY_DIFF_[run_id].md`
+4. **Sempre verificar `P0_CHECKLIST.md` antes de qualquer apply** — se algum item P0 estiver em FAIL, não aplica nada
+5. **Nunca resolver dois findings em simultâneo** se forem de ficheiros diferentes — um apply por ficheiro por run
+6. **Reverter automaticamente** se os testes pós-apply falharem (se pipeline de testes disponível)
+
+---
+
+## Registo de excepções
+
+Excepções às regras devem ser documentadas em `agents/exceptions/`.
+Uma excepção não documentada não é válida.
+
+**Formato de excepção:**
+```markdown
+# Excepção [EXC-RULE-ID-LETRA]
+regra:       [RULE ID]
+ficheiro:    [path afectado]
+motivo:      [justificação técnica obrigatória]
+aprovado_por: [user_id ou nome]
+data:        [ISO 8601]
+expira_em:   [data ou "permanente"]
+```
+
+---
+
+## Registo de WARNs activos
+
+WARNs não resolvidos devem ter entrada em `agents/outputs/WARN_REGISTRY.md`.
+Um WARN sem entrada no registo bloqueia PASS.
+
+**Formato:**
+```markdown
+| WARN ID | Regra | Ficheiro | Ticket | Responsável | Prazo |
+|---|---|---|---|---|---|
+| WARN-001 | PERF-003 | components/Search.tsx | #42 | @dev | 2026-03-01 |
+```
+
+---
+
+## Princípios KLASSE
+
+```
+Dados reais > cache
+Pré-cálculo > cálculo ao vivo
+Contrato > conveniência
+Evidência > opinião
+Escala primeiro, feature depois
+Ambiguidade é WARN, não PASS
+```
+
+---
+
+## Versionamento deste contrato
+
+| Versão | Data | Mudanças |
+|---|---|---|
+| 1.0 | 2026-02-10 | Versão inicial |
+| 2.0 | 2026-02-24 | Critério de PASS, formato de evidência, contrato de REGRESSION, tabela de cache, matriz de MVs, Agent 3 com PENDING_APPROVAL |
+
+---
+
+## Autoridade e precedência
+
+```
+ENGINEERING_AGENTS_CONTRACT.md
+  > P0_CHECKLIST.md
+  > AGENT_INSTRUCTIONS.md
+  > Opinião do agente
+  > Opinião do dev
+  > Atalho técnico
+  > Prazo de entrega
+```
 
-Se violar → FAIL.
+Se violar qualquer regra CRITICAL → FAIL imediato.
+Se violar qualquer regra sem excepção documentada → FAIL.
+Se REGRESSION detectada → FAIL imediato, independente de severidade.
\ No newline at end of file
diff --git a/apps/web/src/app/(auth)/login/actions.ts b/apps/web/src/app/(auth)/login/actions.ts
index ff0a311f..9d8d803a 100644
--- a/apps/web/src/app/(auth)/login/actions.ts
+++ b/apps/web/src/app/(auth)/login/actions.ts
@@ -34,17 +34,32 @@ export async function loginAction(_: unknown, formData: FormData) {
   }
 
   if (data.user) {
+    const { data: prof } = await supabase
+      .from("profiles")
+      .select("current_escola_id, escola_id")
+      .eq("user_id", data.user.id)
+      .order("created_at", { ascending: false })
+      .limit(1)
+      .maybeSingle();
+
+    const metaEscolaId = (data.user.app_metadata as { escola_id?: string | null } | null)?.escola_id ?? null;
+    const preferredEscolaId = (prof as any)?.current_escola_id || (prof as any)?.escola_id || metaEscolaId || null;
+
     const { data: escolaUsuarios, error: userError } = await supabase
       .from("escola_users")
       .select("papel, escola_id")
       .eq("user_id", data.user.id)
-      .limit(1);
+      .order("created_at", { ascending: false })
+      .limit(5);
 
     if (userError) {
       console.error("Erro ao buscar papel/escola do usuário:", userError);
     }
 
-    const firstLink = Array.isArray(escolaUsuarios) ? escolaUsuarios[0] : null;
+    const preferredLink = Array.isArray(escolaUsuarios)
+      ? escolaUsuarios.find((link) => link.escola_id === preferredEscolaId)
+      : null;
+    const firstLink = preferredLink || (Array.isArray(escolaUsuarios) ? escolaUsuarios[0] : null);
 
     if (firstLink) {
       const { papel, escola_id } = firstLink;
diff --git a/apps/web/src/app/api/escolas/[id]/admin/alunos/route.ts b/apps/web/src/app/api/escolas/[id]/admin/alunos/route.ts
index 573d7eb3..c9d017e2 100644
--- a/apps/web/src/app/api/escolas/[id]/admin/alunos/route.ts
+++ b/apps/web/src/app/api/escolas/[id]/admin/alunos/route.ts
@@ -1,80 +1,21 @@
 import { NextRequest, NextResponse } from "next/server";
 import { supabaseServerTyped } from "@/lib/supabaseServer";
-import { applyKf2ListInvariants } from "@/lib/kf2";
 import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
+import { requireRoleInSchool } from "@/lib/authz";
+import { listAlunos, parseAlunoListFilters } from "@/lib/services/alunos.service";
 import type { Database } from "~types/supabase";
 
-type ProfileResumo = { email: string | null; numero_login: string | null };
-type AlunoRow = {
-  id: string;
-  nome: string | null;
-  numero_processo: string | null;
-  status: string | null;
-  created_at: string | null;
-  profile_id: string | null;
-  escola_id: string;
-  profiles?: ProfileResumo | ProfileResumo[] | null;
-};
-
-type MatriculaResumo = {
-  id: string;
-  aluno_id: string;
-  status: string | null;
-  turma_id: string | null;
-  created_at: string | null;
-  turmas?:
-    | {
-        nome?: string | null;
-        turma_codigo?: string | null;
-        ano_letivo?: number | null;
-        cursos?: { nome?: string | null } | { nome?: string | null }[] | null;
-      }
-    | {
-        nome?: string | null;
-        turma_codigo?: string | null;
-        ano_letivo?: number | null;
-        cursos?: { nome?: string | null } | { nome?: string | null }[] | null;
-      }[]
-    | null;
-};
-
-type MensalidadeResumo = {
-  aluno_id: string;
-  status: string | null;
-  data_vencimento: string | null;
-  valor_previsto: number | null;
-  valor: number | null;
-  valor_pago_total: number | null;
-};
-
-type CandidaturaRow = {
-  id: string;
-  aluno_id: string | null;
-  status: string | null;
-  created_at: string | null;
-  nome_candidato: string | null;
-  dados_candidato: { [key: string]: unknown } | null;
-  alunos?: {
-    id?: string | null;
-    nome?: string | null;
-    nome_completo?: string | null;
-    numero_processo?: string | null;
-    bi_numero?: string | null;
-    email?: string | null;
-  } | Array<{
-    id?: string | null;
-    nome?: string | null;
-    nome_completo?: string | null;
-    numero_processo?: string | null;
-    bi_numero?: string | null;
-    email?: string | null;
-  }> | null;
-};
-
 export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
   const { id: escolaId } = await ctx.params;
   try {
     const s = await supabaseServerTyped<Database>();
+    const { error: roleError } = await requireRoleInSchool({
+      supabase: s,
+      escolaId,
+      roles: ["admin", "admin_escola", "staff_admin"],
+    });
+    if (roleError) return roleError;
+
     const { data: userRes } = await s.auth.getUser();
     const user = userRes?.user;
     if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
@@ -85,259 +26,13 @@ export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string
     }
 
     const url = new URL(req.url);
-    const status = (url.searchParams.get("status") || "active").toLowerCase();
-    const q = (url.searchParams.get("q") || "").trim();
-    const limitParam = Number(url.searchParams.get("limit") || 30);
-    const limit = Number.isFinite(limitParam) ? Math.min(limitParam, 50) : 30;
-    const cursor = url.searchParams.get("cursor");
-
-    let query = s
-      .from("alunos")
-      .select(
-        "id, nome, numero_processo, status, created_at, profile_id, escola_id, profiles!alunos_profile_id_fkey ( email, numero_login )"
-      )
-      .eq("escola_id", escolaId);
-
-    if (status === "archived") {
-      query = query.not("deleted_at", "is", null);
-    } else {
-      query = query.is("deleted_at", null);
-    }
-
-    if (q) {
-      const uuidRe = /^[0-9a-fA-F-]{36}$/;
-      if (uuidRe.test(q)) {
-        query = query.or(`id.eq.${q}`);
-      } else {
-        const normalized = q.toLowerCase();
-        const orParts = [
-          `nome_busca.like.${normalized}%`,
-          `responsavel.ilike.${normalized}%`,
-          `profiles.numero_login.ilike.${normalized}%`,
-        ];
-        query = query.or(orParts.join(","));
-      }
-    }
-
-    if (cursor) {
-      const [cursorCreatedAt, cursorId] = cursor.split(",");
-      if (cursorCreatedAt && cursorId) {
-        query = query.or(
-          `created_at.lt.${cursorCreatedAt},and(created_at.eq.${cursorCreatedAt},id.lt.${cursorId})`
-        );
-      }
-    }
-
-    query = applyKf2ListInvariants(query, {
-      limit,
-      order: [
-        { column: "created_at", ascending: false },
-        { column: "id", ascending: false },
-      ],
-    });
-
-    const { data, error } = await query;
-    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
-
-    const alunoItems = (data ?? []).map((row: AlunoRow) => {
-      const prof = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
-      return {
-        id: row.id,
-        nome: row.nome,
-        email: prof?.email ?? null,
-        numero_login: prof?.numero_login ?? null,
-        numero_processo: row.numero_processo ?? null,
-        created_at: row.created_at,
-        status: row.status ?? null,
-        origem: 'aluno',
-      };
-    });
-
-    const alunoIds = alunoItems.map((item) => item.id);
-    const matriculaMap = new Map<
-      string,
-      {
-        status: string | null;
-        turma_id: string | null;
-        turma_nome: string | null;
-        turma_codigo: string | null;
-        turma_ano: number | null;
-        turma_curso: string | null;
-      }
-    >();
-
-    if (alunoIds.length > 0) {
-      const { data: matriculas } = await s
-        .from("matriculas")
-        .select(
-          "id, aluno_id, status, turma_id, created_at, turmas ( nome, turma_codigo, ano_letivo, cursos ( nome ) )"
-        )
-        .eq("escola_id", escolaId)
-        .in("aluno_id", alunoIds)
-        .order("created_at", { ascending: false });
-
-      (matriculas as MatriculaResumo[] | null)?.forEach((row) => {
-        if (!row?.aluno_id || matriculaMap.has(row.aluno_id)) return;
-        const turma = Array.isArray(row.turmas) ? row.turmas[0] : row.turmas;
-        const curso = Array.isArray(turma?.cursos) ? turma?.cursos[0] : turma?.cursos;
-        matriculaMap.set(row.aluno_id, {
-          status: row.status ?? null,
-          turma_id: row.turma_id ?? null,
-          turma_nome: turma?.nome ?? null,
-          turma_codigo: turma?.turma_codigo ?? null,
-          turma_ano: turma?.ano_letivo ?? null,
-          turma_curso: curso?.nome ?? null,
-        });
-      });
-    }
-
-    const mensalidadeMap = new Map<
-      string,
-      { situacao: "em_dia" | "em_atraso" | "sem_registo"; meses: number; valor: number }
-    >();
-    if (alunoIds.length > 0) {
-      const { data: mensalidades } = await s
-        .from("mensalidades")
-        .select("aluno_id, status, data_vencimento, valor_previsto, valor, valor_pago_total")
-        .eq("escola_id", escolaId)
-        .in("aluno_id", alunoIds);
-
-      const today = new Date();
-      (mensalidades as MensalidadeResumo[] | null)?.forEach((row) => {
-        if (!row?.aluno_id) return;
-        const entry = mensalidadeMap.get(row.aluno_id) ?? {
-          situacao: "sem_registo" as const,
-          meses: 0,
-          valor: 0,
-        };
-
-        const dueDate = row.data_vencimento ? new Date(row.data_vencimento) : null;
-        const status = (row.status ?? "").toLowerCase();
-        const isPago = status === "pago" || status === "isento" || status === "cancelado";
-        const isOverdue = !isPago && !!dueDate && dueDate < today;
-
-        entry.situacao = entry.situacao === "sem_registo" ? "em_dia" : entry.situacao;
-        if (isOverdue) {
-          entry.situacao = "em_atraso";
-          entry.meses += 1;
-          const valorPrevisto = Number(row.valor_previsto ?? row.valor ?? 0);
-          const valorPago = Number(row.valor_pago_total ?? 0);
-          entry.valor += Math.max(valorPrevisto - valorPago, 0);
-        }
-
-        mensalidadeMap.set(row.aluno_id, entry);
-      });
-    }
-
-    let candidaturaItems: Array<{ id: string; nome: string; email: string | null; numero_login: null; created_at: string | null; status: string | null; origem: 'candidatura'; aluno_id: string | null; }> = [];
-    if (status !== "archived") {
-      let candQuery = s
-        .from("candidaturas")
-        .select(
-          `id, aluno_id, status, created_at, nome_candidato, dados_candidato,
-          alunos:aluno_id ( id, nome, nome_completo, numero_processo, bi_numero, email )`
-        )
-        .eq("escola_id", escolaId)
-        .not("status", "in", "(matriculado,rejeitada,cancelada)")
-        .order("created_at", { ascending: false });
-
-      candQuery = applyKf2ListInvariants(candQuery, { defaultLimit: 50 });
-
-      if (q) {
-        const uuidRe = /^[0-9a-fA-F-]{36}$/;
-        if (uuidRe.test(q)) {
-          candQuery = candQuery.or(`id.eq.${q}`);
-        } else {
-          const orParts = [
-            `nome_candidato.ilike.%${q}%`,
-            `alunos.nome.ilike.%${q}%`,
-            `alunos.nome_completo.ilike.%${q}%`,
-            `alunos.numero_processo.ilike.%${q}%`,
-          ];
-          candQuery = candQuery.or(orParts.join(","));
-        }
-      }
-
-      const { data: candData, error: candError } = await candQuery;
-      if (candError) {
-        return NextResponse.json({ ok: false, error: candError.message }, { status: 400 });
-      }
-
-      candidaturaItems = (candData ?? []).map((row) => {
-        const alunoRaw = Array.isArray(row.alunos) ? row.alunos[0] : row.alunos;
-        const payload = (row.dados_candidato || {}) as Record<string, unknown>;
-        const nome =
-          alunoRaw?.nome_completo ||
-          alunoRaw?.nome ||
-          (payload.nome_completo as string | undefined) ||
-          (payload.nome as string | undefined) ||
-          row.nome_candidato ||
-          "";
-        const email = alunoRaw?.email || (payload.email as string | undefined) || (payload.encarregado_email as string | undefined) || null;
-        return {
-          id: row.id,
-          nome,
-          email,
-          numero_login: null,
-          numero_processo: alunoRaw?.numero_processo ?? (payload.numero_processo as string | undefined) ?? null,
-          created_at: row.created_at,
-          status: row.status ?? null,
-          origem: 'candidatura',
-          aluno_id: row.aluno_id ?? null,
-        };
-      });
-    }
-
-    const items = [...candidaturaItems, ...alunoItems].map((item) => {
-      if (item.origem !== "aluno") {
-        return {
-          ...item,
-          turma_nome: null,
-          turma_id: null,
-          turma_codigo: null,
-          turma_ano: null,
-          turma_curso: null,
-          situacao_financeira: "sem_registo" as const,
-          meses_atraso: 0,
-          valor_em_divida: 0,
-          status_matricula: "sem_matricula" as const,
-        };
-      }
-
-      const matricula = matriculaMap.get(item.id);
-      const statusRaw = (matricula?.status ?? "").toLowerCase();
-      const statusMatricula = ["ativa", "ativo", "active", "matriculado"].includes(statusRaw)
-        ? "matriculado"
-        : ["pendente", "rascunho"].includes(statusRaw)
-          ? "pendente"
-          : "sem_matricula";
-
-      const financeiro = mensalidadeMap.get(item.id) ?? {
-        situacao: "sem_registo" as const,
-        meses: 0,
-        valor: 0,
-      };
-
-      return {
-        ...item,
-        turma_nome: matricula?.turma_nome ?? null,
-        turma_id: matricula?.turma_id ?? null,
-        turma_codigo: matricula?.turma_codigo ?? null,
-        turma_ano: matricula?.turma_ano ?? null,
-        turma_curso: matricula?.turma_curso ?? null,
-        situacao_financeira: financeiro.situacao,
-        meses_atraso: financeiro.meses,
-        valor_em_divida: financeiro.valor,
-        status_matricula: statusMatricula,
-      };
+    const filters = parseAlunoListFilters(url);
+    const { items, page } = await listAlunos(s, escolaId, filters, {
+      includeFinanceiro: true,
+      includeResumo: true,
     });
-    const last = alunoItems[alunoItems.length - 1];
-    const nextCursor =
-      alunoItems.length === limit && last
-        ? `${last.created_at},${last.id}`
-        : null;
 
-    return NextResponse.json({ ok: true, items, next_cursor: nextCursor });
+    return NextResponse.json({ ok: true, items, next_cursor: page.nextCursor ? `${page.nextCursor.created_at},${page.nextCursor.id}` : null });
   } catch (e) {
     const message = e instanceof Error ? e.message : String(e);
     return NextResponse.json({ ok: false, error: message }, { status: 500 });
diff --git a/apps/web/src/app/api/secretaria/admissoes/config/route.ts b/apps/web/src/app/api/secretaria/admissoes/config/route.ts
index f571b992..58e028de 100644
--- a/apps/web/src/app/api/secretaria/admissoes/config/route.ts
+++ b/apps/web/src/app/api/secretaria/admissoes/config/route.ts
@@ -30,7 +30,7 @@ export async function GET(request: Request) {
   try {
     const [cursos, classes] = await Promise.all([
       supabase.from('cursos').select('id, nome').eq('escola_id', escolaId),
-      supabase.from('classes').select('id, nome').eq('escola_id', escolaId),
+      supabase.from('classes').select('id, nome, curso_id').eq('escola_id', escolaId),
     ])
 
     return NextResponse.json({
diff --git a/apps/web/src/app/api/secretaria/admissoes/draft/route.ts b/apps/web/src/app/api/secretaria/admissoes/draft/route.ts
index acc3fe6d..c1737f63 100644
--- a/apps/web/src/app/api/secretaria/admissoes/draft/route.ts
+++ b/apps/web/src/app/api/secretaria/admissoes/draft/route.ts
@@ -213,6 +213,22 @@ export async function POST(request: Request) {
       p_candidatura_id: candidaturaId ?? null,
     };
 
+    if (candidateData.turma_preferencial_id && (!candidateData.curso_id || !candidateData.classe_id)) {
+      const { data: turmaRow } = await supabase
+        .from("turmas")
+        .select("curso_id, classe_id")
+        .eq("id", candidateData.turma_preferencial_id)
+        .eq("escola_id", escolaId)
+        .maybeSingle();
+      if (turmaRow?.curso_id && !candidateData.curso_id) {
+        candidateData.curso_id = turmaRow.curso_id;
+      }
+      if (turmaRow?.classe_id && !candidateData.classe_id) {
+        candidateData.classe_id = turmaRow.classe_id;
+      }
+      rpcArgs.p_dados_candidato = candidateData;
+    }
+
     const { data, error } = await supabase.rpc("admissao_upsert_draft", rpcArgs);
 
     if (error) throw error;
diff --git a/apps/web/src/app/api/secretaria/admissoes/vagas/route.ts b/apps/web/src/app/api/secretaria/admissoes/vagas/route.ts
index d25d4c7e..41d52fae 100644
--- a/apps/web/src/app/api/secretaria/admissoes/vagas/route.ts
+++ b/apps/web/src/app/api/secretaria/admissoes/vagas/route.ts
@@ -7,8 +7,9 @@ import { requireRoleInSchool } from '@/lib/authz';
 
 const searchParamsSchema = z.object({
   escolaId: z.string().uuid(),
-  cursoId: z.string().uuid(),
-  classeId: z.string().uuid(),
+  cursoId: z.string().uuid().optional(),
+  classeId: z.string().uuid().optional(),
+  ano: z.coerce.number().optional(),
 })
 
 export async function GET(request: Request) {
@@ -19,7 +20,7 @@ export async function GET(request: Request) {
     return NextResponse.json({ error: validation.error.format() }, { status: 400 })
   }
 
-  const { escolaId, cursoId, classeId } = validation.data
+  const { escolaId, cursoId, classeId, ano } = validation.data
   const supabase = await createClient()
 
   const { error: authError } = await requireRoleInSchool({ 
@@ -30,33 +31,102 @@ export async function GET(request: Request) {
   if (authError) return authError;
 
   try {
-    const { data: turmas, error } = await supabase
+    let query = supabase
       .from('vw_turmas_para_matricula')
-      .select('id, turma_nome, turno, capacidade_maxima, ocupacao_atual')
+      .select('id, turma_nome, turma_codigo, turno, capacidade_maxima, ocupacao_atual, curso_id, classe_id, curso_nome, classe_nome, ano_letivo')
       .eq('escola_id', escolaId)
-      .eq('curso_id', cursoId)
-      .eq('classe_id', classeId)
+
+    if (cursoId) query = query.eq('curso_id', cursoId)
+    if (classeId) query = query.eq('classe_id', classeId)
+    if (ano) query = query.eq('ano_letivo', ano)
+
+    query = query.order('turma_nome', { ascending: true }).order('id', { ascending: true }).limit(50)
+
+    const { data: turmas, error } = await query
 
     if (error) {
       throw error
     }
 
-    const turmasComVagas = (turmas || []).map((turma) => {
-      const capacidade = turma.capacidade_maxima ?? 0;
-      const ocupacao = turma.ocupacao_atual ?? 0;
-      const vagas_disponiveis = Math.max(0, capacidade - ocupacao);
-
-      return {
-        id: turma.id,
-        nome: turma.turma_nome,
-        turno: turma.turno,
-        vagas_disponiveis,
-        ocupacao_atual: ocupacao,
-        capacidade_maxima: capacidade,
-      }
-    })
+    const turmaRows = turmas || [];
+
+    const cursoIds = Array.from(new Set(turmaRows.map((row) => row.curso_id).filter(Boolean))) as string[];
+    const classeIds = Array.from(new Set(turmaRows.map((row) => row.classe_id).filter(Boolean))) as string[];
+
+    const { data: tabelas } = cursoIds.length
+      ? await supabase
+          .from('financeiro_tabelas')
+          .select('curso_id, classe_id, valor_matricula, ano_letivo')
+          .eq('escola_id', escolaId)
+          .in('curso_id', cursoIds)
+          .order('ano_letivo', { ascending: false })
+      : { data: [] };
 
-    return NextResponse.json(turmasComVagas)
+    const tabelaRows = (tabelas || []) as Array<{
+      curso_id: string | null;
+      classe_id: string | null;
+      valor_matricula: number | null;
+      ano_letivo: number | null;
+    }>;
+
+    const findTabela = (cursoIdValue: string | null, classeIdValue: string | null) => {
+      if (!cursoIdValue) return null;
+      const exact = tabelaRows.find(
+        (row) => row.curso_id === cursoIdValue && row.classe_id === classeIdValue
+      );
+      if (exact) return exact;
+      return tabelaRows.find(
+        (row) => row.curso_id === cursoIdValue && row.classe_id === null
+      );
+    };
+
+    const turmasComVagas = turmaRows
+      .filter((turma) => {
+        const tabela = findTabela(turma.curso_id, turma.classe_id);
+        const valor = Number(tabela?.valor_matricula ?? 0);
+        return Number.isFinite(valor) && valor > 0;
+      })
+      .map((turma) => {
+        const capacidade = turma.capacidade_maxima ?? 0;
+        const ocupacao = turma.ocupacao_atual ?? 0;
+        const vagas_disponiveis = Math.max(0, capacidade - ocupacao);
+
+        return {
+          id: turma.id,
+          nome: turma.turma_nome,
+          turma_codigo: turma.turma_codigo,
+          turno: turma.turno,
+          vagas_disponiveis,
+          ocupacao_atual: ocupacao,
+          capacidade_maxima: capacidade,
+          curso_id: turma.curso_id,
+          classe_id: turma.classe_id,
+          curso_nome: turma.curso_nome,
+          classe_nome: turma.classe_nome,
+          ano_letivo: turma.ano_letivo,
+        };
+      });
+
+    const classesComPreco = Array.from(
+      new Set(
+        turmaRows
+          .filter((turma) => {
+            const tabela = findTabela(turma.curso_id, turma.classe_id);
+            const valor = Number(tabela?.valor_matricula ?? 0);
+            return Number.isFinite(valor) && valor > 0;
+          })
+          .map((turma) => turma.classe_id)
+          .filter(Boolean)
+      )
+    ) as string[];
+
+    return NextResponse.json({
+      ok: true,
+      items: turmasComVagas,
+      meta: {
+        classesComPreco,
+      },
+    })
   } catch (error) {
     console.error('Error fetching vagas data:', error)
     return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
diff --git a/apps/web/src/app/api/secretaria/alunos/[id]/route.ts b/apps/web/src/app/api/secretaria/alunos/[id]/route.ts
index 5c1833e4..e08d8c5c 100644
--- a/apps/web/src/app/api/secretaria/alunos/[id]/route.ts
+++ b/apps/web/src/app/api/secretaria/alunos/[id]/route.ts
@@ -50,7 +50,7 @@ export async function GET(_req: Request, { params }: { params: Promise<{ id: str
 
     let alunoQuery = s
       .from('alunos')
-      .select('id, nome, responsavel, telefone_responsavel, status, created_at, profile_id, escola_id, profiles:profiles!alunos_profile_id_fkey(user_id, email, nome, telefone, data_nascimento, sexo, bi_numero, naturalidade, provincia, encarregado_relacao, numero_login)')
+      .select('id, nome, email, telefone, data_nascimento, sexo, bi_numero, naturalidade, responsavel, responsavel_nome, responsavel_contato, encarregado_nome, encarregado_telefone, telefone_responsavel, status, created_at, profile_id, escola_id, profiles:profiles!alunos_profile_id_fkey(user_id, email, nome, telefone, data_nascimento, sexo, bi_numero, naturalidade, provincia, encarregado_relacao, numero_login)')
       .eq('id', alunoId)
       .order('created_at', { ascending: false })
       .limit(1)
@@ -81,25 +81,47 @@ export async function GET(_req: Request, { params }: { params: Promise<{ id: str
     }
 
     const profObj = Array.isArray((aluno as any).profiles) ? (aluno as any).profiles[0] : (aluno as any).profiles
+    const { data: matricula } = await s
+      .from('matriculas')
+      .select('id, turma_id, created_at, status, turmas ( nome, cursos ( nome ) )')
+      .eq('aluno_id', alunoId)
+      .eq('escola_id', alunoEscolaId)
+      .order('created_at', { ascending: false })
+      .limit(1)
+      .maybeSingle()
+
+    const turma = Array.isArray((matricula as any)?.turmas) ? (matricula as any)?.turmas?.[0] : (matricula as any)?.turmas
+    const curso = Array.isArray((turma as any)?.cursos) ? (turma as any)?.cursos?.[0] : (turma as any)?.cursos
+    const responsavelNome =
+      (aluno as any).responsavel || (aluno as any).responsavel_nome || (aluno as any).encarregado_nome || null
+    const responsavelTelefone =
+      (aluno as any).telefone_responsavel ||
+      (aluno as any).responsavel_contato ||
+      (aluno as any).encarregado_telefone ||
+      null
+
     return NextResponse.json({
       ok: true,
       item: {
         id: (aluno as any).id,
         nome: (aluno as any).nome,
-        responsavel: (aluno as any).responsavel,
-        telefone_responsavel: (aluno as any).telefone_responsavel,
+        responsavel: responsavelNome,
+        telefone_responsavel: responsavelTelefone,
         status: (aluno as any).status,
         profile_id: (aluno as any).profile_id,
         escola_id: alunoEscolaId,
-        email: profObj?.email ?? null,
+        email: (aluno as any).email ?? profObj?.email ?? null,
         numero_login: profObj?.numero_login ?? null,
-        telefone: profObj?.telefone ?? null,
-        data_nascimento: profObj?.data_nascimento ?? null,
-        sexo: profObj?.sexo ?? null,
-        bi_numero: profObj?.bi_numero ?? null,
-        naturalidade: profObj?.naturalidade ?? null,
+        telefone: (aluno as any).telefone ?? profObj?.telefone ?? null,
+        data_nascimento: (aluno as any).data_nascimento ?? profObj?.data_nascimento ?? null,
+        sexo: (aluno as any).sexo ?? profObj?.sexo ?? null,
+        bi_numero: (aluno as any).bi_numero ?? profObj?.bi_numero ?? null,
+        naturalidade: (aluno as any).naturalidade ?? profObj?.naturalidade ?? null,
         provincia: profObj?.provincia ?? null,
         encarregado_relacao: profObj?.encarregado_relacao ?? null,
+        turma_id: (matricula as any)?.turma_id ?? null,
+        turma_nome: (turma as any)?.nome ?? null,
+        turma_curso: (curso as any)?.nome ?? null,
       }
     })
   } catch (e) {
diff --git a/apps/web/src/app/api/secretaria/alunos/route.ts b/apps/web/src/app/api/secretaria/alunos/route.ts
index f00b9a58..89d524d9 100644
--- a/apps/web/src/app/api/secretaria/alunos/route.ts
+++ b/apps/web/src/app/api/secretaria/alunos/route.ts
@@ -1,7 +1,8 @@
 // @kf2 allow-scan
-import { kf2Range } from "@/lib/db/kf2";
 import { createRouteClient } from "@/lib/supabase/route-client";
 import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
+import { requireRoleInSchool } from "@/lib/authz";
+import { listAlunos, parseAlunoListFilters } from "@/lib/services/alunos.service";
 import { NextResponse } from "next/server";
 
 export const dynamic = "force-dynamic";
@@ -19,78 +20,25 @@ export async function GET(req: Request) {
     }
     const user = userRes.user;
 
-    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
+    const url = new URL(req.url);
+    const requestedEscolaId = url.searchParams.get("escolaId") || url.searchParams.get("escola_id");
+    const escolaId = await resolveEscolaIdForUser(supabase, user.id, requestedEscolaId);
     if (!escolaId) {
       return NextResponse.json({ ok: false, error: "Usuário não vinculado a nenhuma escola" }, { status: 403 });
     }
 
-    const url = new URL(req.url);
-    const q = (url.searchParams.get("q") || url.searchParams.get("search"))?.trim() || null;
-    const status = (url.searchParams.get("status") || "ativo").toLowerCase();
-    const anoParamRaw = url.searchParams.get("ano") || url.searchParams.get("ano_letivo");
-    const anoParam = anoParamRaw ? Number(anoParamRaw) : null;
-    const targetAno = Number.isFinite(anoParam) ? (anoParam as number) : null;
-
-    const limitParam = url.searchParams.get("limit") ?? url.searchParams.get("pageSize");
-    const pageParam = url.searchParams.get("page");
-    const offsetParam = url.searchParams.get("offset");
-    const cursorCreatedAt = url.searchParams.get("cursor_created_at");
-    const cursorId = url.searchParams.get("cursor_id");
-    const hasCursor = Boolean(cursorCreatedAt && cursorId);
-    const derivedOffset = pageParam && limitParam ? (Number(pageParam) - 1) * Number(limitParam) : undefined;
-    const { limit, from } = kf2Range(
-      limitParam ? Number(limitParam) : undefined,
-      hasCursor ? 0 : offsetParam ? Number(offsetParam) : derivedOffset
-    );
-
-    const { data, error } = await supabase.rpc("secretaria_list_alunos_kf2", {
-      p_escola_id: escolaId,
-      p_status: status,
-      p_q: q ?? undefined,
-      p_ano_letivo: targetAno ?? undefined,
-      p_limit: limit,
-      p_offset: from,
-      p_cursor_created_at: cursorCreatedAt ?? undefined,
-      p_cursor_id: cursorId ?? undefined,
+    const { error: roleError } = await requireRoleInSchool({
+      supabase,
+      escolaId,
+      roles: ["secretaria", "admin", "admin_escola", "staff_admin"],
     });
+    if (roleError) return roleError;
 
-    if (error) throw error;
-
-    let items = (data ?? []).map((row: any) => ({
-      ...row,
-      bilhete: row?.bi_numero ?? null,
-    }));
-
-    const includeResumo = url.searchParams.get("includeResumo") === "1";
-    if (includeResumo && q && items.length > 0 && items.length <= 10) {
-      const alunoIds = items.map((row: any) => row.aluno_id ?? row.id).filter(Boolean);
-
-      const { data: resumoRows } = await supabase
-        .from("vw_secretaria_alunos_resumo")
-        .select("aluno_id, turma_nome, total_em_atraso")
-        .in("aluno_id", alunoIds);
-
-      const resumoByAluno = new Map(
-        (resumoRows ?? []).map((row: any) => [row.aluno_id, row])
-      );
-
-      items = items.map((row: any) => {
-        const alunoId = row.aluno_id ?? row.id;
-        const resumo = resumoByAluno.get(alunoId);
-        return {
-          ...row,
-          turma_atual: resumo?.turma_nome ?? null,
-          total_em_atraso: Number(resumo?.total_em_atraso ?? 0),
-        };
-      });
-    }
-
-    const hasMore = items.length === limit;
-    const lastItem = hasMore ? items[items.length - 1] : null;
-    const nextCursor = lastItem
-      ? { created_at: lastItem.created_at, id: lastItem.id }
-      : null;
-    const nextOffset = hasMore ? from + items.length : null;
+    const filters = parseAlunoListFilters(url);
+    const { items, page } = await listAlunos(supabase, escolaId, filters, {
+      includeFinanceiro: true,
+      includeResumo: filters.includeResumo,
+    });
 
     return NextResponse.json({
       ok: true,
@@ -98,12 +46,8 @@ export async function GET(req: Request) {
       items,
       total: items.length,
       page: {
-        limit,
-        offset: from,
-        nextOffset,
-        hasMore,
+        ...page,
         total: items.length,
-        nextCursor,
       },
     });
   } catch (e: any) {
diff --git a/apps/web/src/app/escola/[id]/secretaria/(portal-secretaria)/alunos/page.tsx b/apps/web/src/app/escola/[id]/secretaria/(portal-secretaria)/alunos/page.tsx
index 6de3043b..b219774b 100644
--- a/apps/web/src/app/escola/[id]/secretaria/(portal-secretaria)/alunos/page.tsx
+++ b/apps/web/src/app/escola/[id]/secretaria/(portal-secretaria)/alunos/page.tsx
@@ -1 +1,31 @@
-export { default } from "@/app/secretaria/(portal-secretaria)/alunos/page";
+import { redirect } from "next/navigation";
+import AuditPageView from "@/components/audit/AuditPageView";
+import AlunosSecretariaPage from "@/components/secretaria/AlunosSecretariaPage";
+import { supabaseServer } from "@/lib/supabaseServer";
+import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
+
+export const dynamic = "force-dynamic";
+export const revalidate = 0;
+
+export default async function Page({ params }: { params: Promise<{ id: string }> }) {
+  const { id: escolaId } = await params;
+  const supabase = await supabaseServer();
+  const { data: session } = await supabase.auth.getUser();
+  const user = session?.user;
+
+  if (!user) {
+    redirect("/login");
+  }
+
+  const resolvedEscolaId = await resolveEscolaIdForUser(supabase, user.id, escolaId);
+  if (!resolvedEscolaId || resolvedEscolaId !== escolaId) {
+    redirect("/login");
+  }
+
+  return (
+    <>
+      <AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="alunos_list" />
+      <AlunosSecretariaPage escolaId={escolaId} />
+    </>
+  );
+}
diff --git a/apps/web/src/app/secretaria/(portal-secretaria)/alunos/page.tsx b/apps/web/src/app/secretaria/(portal-secretaria)/alunos/page.tsx
index e131f6fc..b012f540 100644
--- a/apps/web/src/app/secretaria/(portal-secretaria)/alunos/page.tsx
+++ b/apps/web/src/app/secretaria/(portal-secretaria)/alunos/page.tsx
@@ -1,41 +1,31 @@
-import { supabaseServer } from "@/lib/supabaseServer";
+import { redirect } from "next/navigation";
 import AuditPageView from "@/components/audit/AuditPageView";
-import AlunosListClient from "@/components/secretaria/AlunosListClient";
+import AlunosSecretariaPage from "@/components/secretaria/AlunosSecretariaPage";
+import { supabaseServer } from "@/lib/supabaseServer";
+import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
 
-export const dynamic = 'force-dynamic'
+export const dynamic = "force-dynamic";
+export const revalidate = 0;
 
-type SearchParams = { q?: string; days?: string }
+export default async function Page() {
+  const supabase = await supabaseServer();
+  const { data: session } = await supabase.auth.getUser();
+  const user = session?.user;
 
-export default async function Page(props: { searchParams?: Promise<SearchParams> }) {
-  const searchParams = (await props.searchParams) ?? ({} as SearchParams)
-  const s = await supabaseServer()
-  const { data: sess } = await s.auth.getUser()
-  const user = sess?.user
-  let escolaId: string | null = null
-  if (user) {
-    const { data: prof } = await s
-      .from('profiles')
-      .select('escola_id')
-      .eq('user_id', user.id)
-      .maybeSingle()
-    escolaId = (prof as any)?.escola_id ?? null
+  if (!user) {
+    redirect("/login");
   }
 
+  const escolaId = await resolveEscolaIdForUser(supabase, user.id);
+
   if (!escolaId) {
-    return (
-      <>
-<AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="alunos_list" />
-        <div className="p-4 bg-amber-50 border border-amber-200 rounded text-amber-800 text-sm">
-          Vincule seu perfil a uma escola para ver alunos.
-        </div>
-      </>
-    )
+    redirect("/login");
   }
 
   return (
     <>
       <AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="alunos_list" />
-      <AlunosListClient />
+      <AlunosSecretariaPage />
     </>
-  )
+  );
 }
diff --git a/apps/web/src/components/aluno/AlunoPerfilPage.tsx b/apps/web/src/components/aluno/AlunoPerfilPage.tsx
index 6b98840b..04c95a73 100644
--- a/apps/web/src/components/aluno/AlunoPerfilPage.tsx
+++ b/apps/web/src/components/aluno/AlunoPerfilPage.tsx
@@ -2,7 +2,7 @@ import { notFound } from "next/navigation";
 import { AcoesRapidasBalcao } from "@/components/secretaria/AcoesRapidasBalcao";
 import { DossierHeader } from "@/components/aluno/DossierHeader";
 import { DossierTabs } from "@/components/aluno/DossierTabs";
-import { DossierFinanceiroSection, DossierHistoricoSection, DossierPerfilSection } from "@/components/aluno/DossierSeccoes";
+import { DossierDocumentosSection, DossierFinanceiroSection, DossierHistoricoSection, DossierPerfilSection } from "@/components/aluno/DossierSeccoes";
 import { normalizeDossier, toMensalidadeAcoes } from "@/lib/aluno";
 import { supabaseServer } from "@/lib/supabaseServer";
 import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
@@ -34,11 +34,10 @@ export default async function AlunoPerfilPage({ escolaId, alunoId, role }: { esc
           slotPerfil={<DossierPerfilSection aluno={aluno} />}
           slotFinanceiro={<DossierFinanceiroSection aluno={aluno} />}
           slotHistorico={<DossierHistoricoSection aluno={aluno} />}
-          slotDocumentos={<div className="text-sm text-slate-500">Documentos disponíveis no balcão.</div>}
+          slotDocumentos={<DossierDocumentosSection alunoId={alunoId} />}
         />
         {role === "secretaria" && (
           <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
-            <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">Balcão Rápido</h2>
             <AcoesRapidasBalcao
               alunoId={alunoId}
               alunoNome={aluno.perfil.nome}
diff --git a/apps/web/src/components/aluno/DossierAcoes.tsx b/apps/web/src/components/aluno/DossierAcoes.tsx
index dfe955b9..9099ac2b 100644
--- a/apps/web/src/components/aluno/DossierAcoes.tsx
+++ b/apps/web/src/components/aluno/DossierAcoes.tsx
@@ -32,13 +32,13 @@ export function DossierAcoes({ role, aluno, escolaId }: { role: DossierRole; alu
     const isArquivado = aluno.perfil.status === "arquivado";
     return (
       <div className="flex items-center gap-2 flex-wrap">
-        <Link href={`/escola/${escolaId}/admin/alunos/${aluno.id}/editar`} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:border-[#1F6B3B] hover:text-[#1F6B3B]"><Pencil size={14} className="inline mr-1" />Editar</Link>
+        <Link href={`/escola/${escolaId}/admin/alunos/${aluno.id}/editar`} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-[#1F6B3B] hover:text-[#1F6B3B]"><Pencil size={14} className="inline mr-1" />Editar</Link>
         {!isArquivado ? (
-          <button disabled={loading} onClick={() => run(`/api/secretaria/alunos/${aluno.id}/delete`, { reason: "Arquivado via Admin" })} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:border-amber-300 hover:text-amber-600"><Archive size={14} className="inline mr-1" />Arquivar</button>
+          <button disabled={loading} onClick={() => run(`/api/secretaria/alunos/${aluno.id}/delete`, { reason: "Arquivado via Admin" })} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-[#E3B23C]/40 hover:text-[#9a7010]"><Archive size={14} className="inline mr-1" />Arquivar</button>
         ) : (
           <>
-            <button disabled={loading} onClick={() => run(`/api/secretaria/alunos/${aluno.id}/restore`)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:border-[#1F6B3B] hover:text-[#1F6B3B]"><RotateCcw size={14} className="inline mr-1" />Restaurar</button>
-            <button disabled={loading} onClick={() => run(`/api/secretaria/alunos/${aluno.id}/hard-delete`)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:border-rose-300 hover:text-rose-600"><Trash2 size={14} className="inline mr-1" />Eliminar</button>
+            <button disabled={loading} onClick={() => run(`/api/secretaria/alunos/${aluno.id}/restore`)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-[#1F6B3B] hover:text-[#1F6B3B]"><RotateCcw size={14} className="inline mr-1" />Restaurar</button>
+            <button disabled={loading} onClick={() => run(`/api/secretaria/alunos/${aluno.id}/hard-delete`)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-rose-200 hover:text-rose-700"><Trash2 size={14} className="inline mr-1" />Eliminar</button>
           </>
         )}
       </div>
@@ -47,10 +47,36 @@ export function DossierAcoes({ role, aluno, escolaId }: { role: DossierRole; alu
 
   return (
     <div className="flex items-center gap-2 flex-wrap">
-      <Link href={`/secretaria/alunos/${aluno.id}/editar`} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:border-[#1F6B3B] hover:text-[#1F6B3B]"><Pencil size={14} className="inline mr-1" />Editar</Link>
-      <Link href={`/secretaria/alunos/${aluno.id}/documentos`} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:border-slate-400 hover:text-slate-700"><FileText size={14} className="inline mr-1" />Documentos</Link>
-      {aluno.financeiro.situacao === "inadimplente" && <Link href={`/secretaria/alunos/${aluno.id}/pagamento`} className="rounded-xl border border-[#E3B23C]/40 bg-[#E3B23C]/5 px-4 py-2.5 text-sm font-bold text-[#9a7010] hover:bg-[#E3B23C]/10"><DollarSign size={14} className="inline mr-1" />Registar pagamento</Link>}
-      {!aluno.matricula_atual?.is_atual && <Link href={`/secretaria/admissoes/nova?alunoId=${aluno.id}`} className="rounded-xl border border-[#1F6B3B]/30 bg-[#1F6B3B]/5 px-4 py-2.5 text-sm font-bold text-[#1F6B3B] hover:bg-[#1F6B3B]/10"><FileCheck size={14} className="inline mr-1" />Matricular</Link>}
+      <Link
+        href={`/secretaria/alunos/${aluno.id}/pagamento`}
+        className={`rounded-xl px-4 py-2.5 text-sm font-bold text-white ${
+          aluno.financeiro.situacao === "inadimplente"
+            ? "bg-[#E3B23C] hover:brightness-95"
+            : "bg-[#1F6B3B] hover:bg-[#185830]"
+        }`}
+      >
+        <DollarSign size={14} className="inline mr-1" />Registar pagamento
+      </Link>
+      <Link
+        href={`/secretaria/alunos/${aluno.id}/editar`}
+        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
+      >
+        <Pencil size={14} className="inline mr-1" />Editar
+      </Link>
+      <Link
+        href={`/secretaria/alunos/${aluno.id}/documentos`}
+        className="px-2 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700"
+      >
+        <FileText size={14} className="inline mr-1" />Documentos
+      </Link>
+      {!aluno.matricula_atual?.is_atual && (
+        <Link
+          href={`/secretaria/admissoes/nova?alunoId=${aluno.id}`}
+          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
+        >
+          <FileCheck size={14} className="inline mr-1" />Matricular
+        </Link>
+      )}
     </div>
   );
 }
diff --git a/apps/web/src/components/aluno/DossierHeader.tsx b/apps/web/src/components/aluno/DossierHeader.tsx
index 8d8d721d..a1f04674 100644
--- a/apps/web/src/components/aluno/DossierHeader.tsx
+++ b/apps/web/src/components/aluno/DossierHeader.tsx
@@ -1,40 +1,183 @@
 "use client";
 
 import Link from "next/link";
-import { BookOpen, CalendarCheck, Users } from "lucide-react";
+import { BookOpen, CalendarCheck, Users, ChevronRight } from "lucide-react";
 import { DossierAcoes, type DossierRole } from "@/components/aluno/DossierAcoes";
-import { StatusPill } from "@/components/ui/StatusPill";
 import { formatDate, initials } from "@/lib/formatters";
 import type { AlunoNormalizado } from "@/lib/aluno/types";
 
-export function DossierHeader({ aluno, role, escolaId }: { aluno: AlunoNormalizado; role: DossierRole; escolaId: string }) {
+export function DossierHeader({
+  aluno,
+  role,
+  escolaId,
+}: {
+  aluno: AlunoNormalizado;
+  role: DossierRole;
+  escolaId: string;
+}) {
   const { perfil, matricula_atual } = aluno;
+
+  const status = (perfil.status ?? "pendente").toLowerCase();
+  const statusLabel = status.replace(/_/g, " ");
+  const statusClasses =
+    status === "ativo"
+      ? "bg-[#1F6B3B]/10 text-[#1F6B3B]"
+      : status === "arquivado" || status === "inativo"
+      ? "bg-slate-100 text-slate-500"
+      : "bg-[#E3B23C]/10 text-[#9a7010]";
+
+  const isInadimplente = ["inadimplente", "em_atraso", "atrasado"].includes(
+    (aluno.financeiro.situacao ?? "").toLowerCase()
+  );
+  const valorEmDivida = aluno.financeiro.total_em_atraso ?? 0;
+
+  const renderMetaValue = (value?: string | null) =>
+    value ? (
+      <span className="font-semibold text-slate-700">{value}</span>
+    ) : (
+      <span className="text-slate-400 italic text-[11px]">Não preenchido</span>
+    );
+
+  const birthValue = (() => {
+    const label = formatDate(perfil.data_nascimento);
+    return label === "—" ? null : label;
+  })();
+
+  const turmaLabel = matricula_atual
+    ? (matricula_atual.turma_codigo ?? matricula_atual.turma)
+    : null;
+
+  // Metadata agrupada semanticamente
+  const metaIdentificacao = [
+    { icon: <BookOpen size={12} />,      label: "Proc",  value: perfil.numero_processo },
+    { icon: <Users size={12} />,         label: "BI",    value: perfil.bi_numero },
+    { icon: <CalendarCheck size={12} />, label: "Nasc.", value: birthValue },
+  ];
+
+  const metaAcademico = [
+    { icon: <BookOpen size={12} />, label: "Turma", value: turmaLabel },
+  ];
+
   return (
     <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
       <div className="px-6 py-5 md:px-8 md:py-6 space-y-4">
-        <nav className="text-xs text-slate-400">
-          {role === "admin" ? <Link href={`/escola/${escolaId}/admin/alunos`}>Admin / Alunos</Link> : <Link href="/secretaria/alunos">Secretaria / Alunos</Link>} / <span className="text-slate-700">{perfil.nome}</span>
+
+        {/* Breadcrumb */}
+        <nav className="flex items-center gap-1 text-xs text-slate-400">
+          {role === "admin" ? (
+            <Link
+              href={`/escola/${escolaId}/admin/alunos`}
+              className="hover:text-slate-600 transition-colors"
+            >
+              Admin
+            </Link>
+          ) : (
+            <Link
+              href="/secretaria/alunos"
+              className="hover:text-slate-600 transition-colors"
+            >
+              Secretaria
+            </Link>
+          )}
+          <ChevronRight size={12} className="text-slate-400 flex-shrink-0" />
+          <span className="text-slate-400">Alunos</span>
+          <ChevronRight size={12} className="text-slate-400 flex-shrink-0" />
+          <span className="text-slate-600 font-medium truncate max-w-[180px]">
+            {perfil.nome}
+          </span>
         </nav>
+
+        {/* Corpo do header */}
         <div className="flex flex-col md:flex-row gap-5">
-          <div className="h-16 w-16 rounded-xl border border-slate-200 bg-[#1F6B3B]/10 overflow-hidden flex items-center justify-center">
-            {perfil.foto_url ? <img src={perfil.foto_url} alt="" className="h-full w-full object-cover" /> : <span className="text-xl font-black text-[#1F6B3B]">{initials(perfil.nome)}</span>}
+
+          {/* Avatar */}
+          <div className="h-16 w-16 flex-shrink-0 rounded-2xl bg-[#1F6B3B]/10
+            border border-[#1F6B3B]/20 overflow-hidden flex items-center justify-center">
+            {perfil.foto_url ? (
+              <img
+                src={perfil.foto_url}
+                alt={perfil.nome ?? ""}
+                className="h-full w-full object-cover"
+              />
+            ) : (
+              <span className="text-xl font-black text-[#1F6B3B]">
+                {initials(perfil.nome)}
+              </span>
+            )}
           </div>
-          <div className="flex-1 space-y-2">
-            <div className="flex items-center gap-3 flex-wrap">
-              <h1 className="text-2xl font-black text-[#1F6B3B]">{perfil.nome}</h1>
-              <StatusPill status={perfil.status} variant="matricula" />
-              <StatusPill status={aluno.financeiro.situacao} variant="financeiro" size="xs" />
+
+          {/* Info */}
+          <div className="flex-1 min-w-0 space-y-2.5">
+
+            {/* Nome + badges — hierarquia clara: nome domina */}
+            <div className="flex items-center gap-2 flex-wrap">
+              <h1 className="text-2xl font-black text-slate-900 leading-tight">
+                {perfil.nome}
+              </h1>
+              {/* Status (ativo/arquivado) — peso leve */}
+              <span className={`inline-flex items-center rounded-full px-2 py-0.5
+                text-[10px] font-bold uppercase tracking-wide ${statusClasses}`}>
+                {statusLabel}
+              </span>
+              {/* Inadimplente — badge secundário, não compete com o nome */}
+              {isInadimplente && (
+                <span className="inline-flex items-center gap-1 rounded-full
+                  bg-rose-100 px-2.5 py-0.5 text-[10px] font-bold text-rose-700">
+                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
+                  Inadimplente
+                </span>
+              )}
             </div>
-            <div className="flex flex-wrap gap-5 text-xs text-slate-600">
-              <span><BookOpen size={13} className="inline mr-1" />Proc: <b>{perfil.numero_processo ?? "—"}</b></span>
-              <span><Users size={13} className="inline mr-1" />BI: <b>{perfil.bi_numero ?? "—"}</b></span>
-              <span><CalendarCheck size={13} className="inline mr-1" />Nasc: <b>{formatDate(perfil.data_nascimento)}</b></span>
-              {matricula_atual && <span><BookOpen size={13} className="inline mr-1" />Turma: <b>{matricula_atual.turma_codigo ?? matricula_atual.turma}</b></span>}
+
+            {/* Metadata — dois grupos separados semanticamente */}
+            <div className="space-y-1.5">
+              {/* Grupo 1: identificação */}
+              <div className="flex flex-wrap gap-4">
+                {metaIdentificacao.map(({ icon, label, value }) => (
+                  <span key={label} className="flex items-center gap-1.5 text-xs text-slate-500">
+                    <span className="text-slate-400">{icon}</span>
+                    <span className="text-slate-400">{label}:</span>
+                    {renderMetaValue(value)}
+                  </span>
+                ))}
+              </div>
+              {/* Grupo 2: académico */}
+              <div className="flex flex-wrap gap-4">
+                {metaAcademico.map(({ icon, label, value }) => (
+                  <span key={label} className="flex items-center gap-1.5 text-xs text-slate-500">
+                    <span className="text-slate-400">{icon}</span>
+                    <span className="text-slate-400">{label}:</span>
+                    {renderMetaValue(value)}
+                  </span>
+                ))}
+              </div>
             </div>
           </div>
+
+          {/* Acções */}
           <DossierAcoes role={role} aluno={aluno} escolaId={escolaId} />
         </div>
       </div>
+
+      {/* Faixa de aviso financeiro — só aparece quando inadimplente */}
+      {isInadimplente && (
+        <div className="border-t border-rose-100 bg-rose-50 px-6 py-2.5 md:px-8
+          flex items-center justify-between gap-4">
+          <p className="text-xs text-rose-600 font-medium">
+            Este aluno tem propinas em atraso.
+          </p>
+          {valorEmDivida > 0 ? (
+            <span className="text-sm font-black text-rose-700 flex-shrink-0">
+              {new Intl.NumberFormat("pt-AO", {
+                style: "currency",
+                currency: "AOA",
+                maximumFractionDigits: 0,
+              }).format(valorEmDivida)}{" "}
+              em dívida
+            </span>
+          ) : null}
+        </div>
+      )}
     </div>
   );
 }
diff --git a/apps/web/src/components/aluno/DossierSeccoes.tsx b/apps/web/src/components/aluno/DossierSeccoes.tsx
index 84ede0e9..9fd36893 100644
--- a/apps/web/src/components/aluno/DossierSeccoes.tsx
+++ b/apps/web/src/components/aluno/DossierSeccoes.tsx
@@ -1,23 +1,260 @@
-import { BookOpen, CheckCircle2, CreditCard, MapPin, Phone, TrendingDown, Users, Wallet } from "lucide-react";
+import Link from "next/link";
+import { CheckCircle2, FileText, TrendingDown, Wallet } from "lucide-react";
 import { StatusPill } from "@/components/ui/StatusPill";
 import { formatDate, formatKwanza, monthName } from "@/lib/formatters";
 import type { AlunoNormalizado, DossierMensalidade } from "@/lib/aluno/types";
 
 export function DossierPerfilSection({ aluno }: { aluno: AlunoNormalizado }) {
   const p = aluno.perfil;
-  return <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm"><div><CreditCard size={12} className="inline" /> BI: {p.bi_numero ?? "—"}</div><div><Users size={12} className="inline" /> Resp: {p.responsavel_nome ?? "—"}</div><div><Phone size={12} className="inline" /> Contacto: {p.responsavel_tel ?? "—"}</div><div><MapPin size={12} className="inline" /> Endereço: {p.endereco ?? "—"}</div><div><BookOpen size={12} className="inline" /> Processo: {p.numero_processo ?? "—"}</div><div>Nascimento: {formatDate(p.data_nascimento)}</div></div>;
+  const matricula = aluno.matricula_atual;
+
+  const renderValue = (value?: string | null) =>
+    value ? (
+      <span className="text-sm font-semibold text-slate-700">{value}</span>
+    ) : (
+      <span className="text-xs text-slate-400 italic">Não preenchido</span>
+    );
+
+  const nascimento = formatDate(p.data_nascimento);
+  const nascimentoValue = nascimento === "—" ? null : nascimento;
+  const turmaValue = matricula?.turma ?? null;
+  const anoLetivoValue = matricula?.ano_letivo ?? null;
+  const estadoMatricula = matricula?.status ?? null;
+
+  return (
+    <div className="space-y-4">
+      <div className="border-b border-slate-100 pb-4">
+        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
+          Identificação
+        </p>
+        <div className="grid gap-3 md:grid-cols-3">
+          <div>
+            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">BI</p>
+            {renderValue(p.bi_numero)}
+          </div>
+          <div>
+            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Processo</p>
+            {renderValue(p.numero_processo)}
+          </div>
+          <div>
+            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Nascimento</p>
+            {renderValue(nascimentoValue)}
+          </div>
+        </div>
+      </div>
+
+      <div className="border-b border-slate-100 pb-4">
+        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
+          Contacto
+        </p>
+        <div className="grid gap-3 md:grid-cols-3">
+          <div>
+            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Responsável</p>
+            {renderValue(p.responsavel_nome)}
+          </div>
+          <div>
+            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Contacto</p>
+            {renderValue(p.responsavel_tel)}
+          </div>
+          <div>
+            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Endereço</p>
+            {renderValue(p.endereco)}
+          </div>
+        </div>
+      </div>
+
+      <div>
+        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
+          Académico
+        </p>
+        <div className="grid gap-3 md:grid-cols-3">
+          <div>
+            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Turma</p>
+            {renderValue(turmaValue)}
+          </div>
+          <div>
+            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Ano lectivo</p>
+            {renderValue(anoLetivoValue)}
+          </div>
+          <div>
+            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Estado matrícula</p>
+            {renderValue(estadoMatricula)}
+          </div>
+        </div>
+      </div>
+    </div>
+  );
 }
 
 function MensalidadeRow({ m }: { m: DossierMensalidade }) {
-  return <div className="flex items-center justify-between border border-slate-200 rounded-xl p-3"><div><p className="font-semibold capitalize">{monthName(m.mes)} {m.ano}</p><p className="text-xs text-slate-400">{m.vencimento ? `Venc. ${formatDate(m.vencimento)}` : "Sem vencimento"}</p></div><div className="text-right"><p className="font-bold">{formatKwanza(m.valor)}</p>{m.saldo > 0 && <p className="text-xs text-rose-600">Saldo: {formatKwanza(m.saldo)}</p>}</div><StatusPill status={m.status} variant="financeiro" size="xs" /></div>;
+  const vencimentoLabel = m.vencimento ? formatDate(m.vencimento) : null;
+  const vencimentoDate = m.vencimento ? new Date(m.vencimento) : null;
+  const today = new Date();
+  const daysDiff = vencimentoDate
+    ? Math.ceil((vencimentoDate.getTime() - today.setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24))
+    : null;
+  const isOverdue = typeof daysDiff === "number" && daysDiff < 0;
+  const vencimentoInfo = vencimentoLabel
+    ? isOverdue
+      ? `Atraso ${Math.abs(daysDiff ?? 0)} dia(s)`
+      : `Vence ${vencimentoLabel}`
+    : null;
+
+  return (
+    <div className="grid gap-3 rounded-xl border border-slate-200 p-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] md:items-center">
+      <div>
+        <p className="font-semibold text-slate-900 capitalize">
+          {monthName(m.mes)} {m.ano}
+        </p>
+        <p className="text-xs text-slate-400">
+          {m.vencimento ? `Venc. ${vencimentoLabel}` : "Sem vencimento"}
+        </p>
+      </div>
+      <div className="text-right">
+        <p className="font-bold text-slate-900">{formatKwanza(m.valor)}</p>
+        {m.saldo > 0 && (
+          <p className="text-xs text-rose-700">Saldo pendente: {formatKwanza(m.saldo)}</p>
+        )}
+      </div>
+      <div className="md:justify-self-end text-right">
+        <StatusPill status={m.status} variant="financeiro" size="xs" />
+        {vencimentoInfo && (
+          <p className={`mt-1 text-[10px] font-semibold ${isOverdue ? "text-rose-600" : "text-slate-400"}`}>
+            {vencimentoInfo}
+          </p>
+        )}
+      </div>
+    </div>
+  );
 }
 
 export function DossierFinanceiroSection({ aluno }: { aluno: AlunoNormalizado }) {
   const f = aluno.financeiro;
-  return <div className="space-y-4"><div className="grid grid-cols-2 gap-3"><div className="rounded-xl border border-slate-200 p-4"><p className="text-xs text-slate-400">Em atraso</p><p className="text-xl font-black">{formatKwanza(f.total_em_atraso)}</p></div><div className="rounded-xl border border-slate-200 p-4"><p className="text-xs text-slate-400">Total pago</p><p className="text-xl font-black text-[#1F6B3B]">{formatKwanza(f.total_pago)}</p></div></div>{f.situacao === "em_dia" ? <div className="rounded-xl border border-[#1F6B3B]/20 bg-[#1F6B3B]/5 p-3 text-xs text-[#1F6B3B]"><CheckCircle2 size={14} className="inline mr-1" /> Situação regular</div> : <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700"><TrendingDown size={14} className="inline mr-1" /> {f.mensalidades_atrasadas.length} mensalidades em atraso</div>}<div className="space-y-2">{f.mensalidades.length ? f.mensalidades.map((m) => <MensalidadeRow key={m.id} m={m} />) : <div className="text-center py-6 text-slate-400"><Wallet className="mx-auto mb-2" />Sem cobranças.</div>}</div></div>;
+  const atrasado = f.situacao === "inadimplente";
+  return (
+    <div className="space-y-4">
+      <div className="border-b border-slate-100 pb-4">
+        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
+          Resumo financeiro
+        </p>
+        <div className="grid gap-3 md:grid-cols-2">
+          <div className={`rounded-2xl border p-4 shadow-sm ${atrasado ? "bg-rose-50 border-rose-100" : "bg-slate-50 border-slate-200"}`}>
+            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Em atraso</p>
+            <p className={`mt-1 text-2xl font-black ${atrasado ? "text-rose-600" : "text-slate-900"}`}>
+              {formatKwanza(f.total_em_atraso)}
+            </p>
+            <p className="text-xs text-slate-500 mt-1">Valores com cobrança pendente.</p>
+          </div>
+          <div className="rounded-2xl border border-[#1F6B3B]/20 bg-[#1F6B3B]/5 p-4 shadow-sm">
+            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total pago</p>
+            <p className="mt-1 text-2xl font-black text-[#1F6B3B]">{formatKwanza(f.total_pago)}</p>
+            <p className="text-xs text-[#1F6B3B]/70 mt-1">Resumo de pagamentos.</p>
+          </div>
+        </div>
+      </div>
+
+      <div>
+        {f.situacao === "em_dia" ? (
+          <div className="rounded-xl border border-[#1F6B3B]/20 bg-[#1F6B3B]/5 p-3 text-xs text-[#1F6B3B]">
+            <CheckCircle2 size={14} className="inline mr-1" /> Situação regular
+          </div>
+        ) : (
+          <div className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs text-rose-600">
+            <TrendingDown size={14} className="inline mr-1" /> {f.mensalidades_atrasadas.length} mensalidades em atraso
+          </div>
+        )}
+      </div>
+
+      <div>
+        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
+          Mensalidades
+        </p>
+        {f.mensalidades.length ? (
+          <div className="space-y-2">
+            <div className="hidden md:grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] text-[10px] font-bold uppercase tracking-widest text-slate-400 px-3">
+              <span>Mês</span>
+              <span className="text-right">Valor</span>
+              <span className="text-right">Estado</span>
+            </div>
+            {f.mensalidades.map((m) => (
+              <MensalidadeRow key={m.id} m={m} />
+            ))}
+          </div>
+        ) : (
+          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
+            <Wallet className="mx-auto mb-2" />Sem cobranças.
+          </div>
+        )}
+      </div>
+    </div>
+  );
 }
 
 export function DossierHistoricoSection({ aluno }: { aluno: AlunoNormalizado }) {
-  if (!aluno.historico.length) return <div className="text-center py-6 text-slate-400">Sem histórico de matrículas.</div>;
-  return <div className="space-y-3">{aluno.historico.map((mat, idx) => <div key={mat.numero_matricula ?? idx} className={`rounded-xl border p-4 ${mat.is_atual ? "border-[#1F6B3B]/20 bg-[#1F6B3B]/5" : "border-slate-200"}`}><div className="flex justify-between"><div><p className="font-black">{mat.ano_letivo}</p><p className="text-sm">{mat.turma}</p></div><StatusPill status={mat.status} variant="matricula" size="xs" /></div></div>)}</div>;
+  if (!aluno.historico.length) {
+    return <div className="text-center py-6 text-slate-400">Sem histórico de matrículas.</div>;
+  }
+
+  return (
+    <div className="space-y-4">
+      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Histórico de matrículas</p>
+      <div className="space-y-3">
+        {aluno.historico.map((mat, idx) => (
+          <div
+            key={mat.numero_matricula ?? idx}
+            className={`rounded-xl border p-4 ${
+              mat.is_atual ? "border-[#1F6B3B]/20 bg-[#1F6B3B]/5" : "border-slate-200"
+            }`}
+          >
+            <div className="flex items-start justify-between gap-3">
+              <div>
+                <p className="text-sm font-black text-slate-900">{mat.ano_letivo}</p>
+                <p className="text-sm text-slate-700">{mat.turma}</p>
+              </div>
+              <StatusPill status={mat.status} variant="matricula" size="xs" />
+            </div>
+            <div className="mt-2 text-xs text-slate-500">
+              {mat.curso ? `${mat.curso} · ` : ""}
+              {mat.classe ? `${mat.classe} · ` : ""}
+              <span>
+                Turno: {mat.turno ? mat.turno : <span className="text-slate-400 italic">Não preenchido</span>}
+              </span>
+            </div>
+          </div>
+        ))}
+      </div>
+    </div>
+  );
+}
+
+export function DossierDocumentosSection({ alunoId }: { alunoId: string }) {
+  const actions = [
+    { title: "Declaração", subtitle: "Frequência", tipo: "declaracao_frequencia" },
+    { title: "Declaração", subtitle: "Notas", tipo: "declaracao_notas" },
+    { title: "Ficha", subtitle: "Aluno", tipo: "ficha_aluno" },
+  ];
+
+  return (
+    <div className="space-y-3">
+      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Documentos</p>
+      <div className="grid gap-3 md:grid-cols-3">
+        {actions.map((item) => (
+          <Link
+            key={item.tipo}
+            href={`/secretaria/documentos?alunoId=${alunoId}&tipo=${item.tipo}`}
+            className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-[#1F6B3B]/30 hover:shadow-sm"
+          >
+            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-500">
+              <FileText size={18} />
+            </div>
+            <p className="text-sm font-bold text-slate-900">{item.title}</p>
+            <p className="text-xs text-slate-500">{item.subtitle}</p>
+            <span className="mt-3 inline-block text-xs font-semibold text-[#1F6B3B] underline">
+              Solicitar
+            </span>
+          </Link>
+        ))}
+      </div>
+    </div>
+  );
 }
diff --git a/apps/web/src/components/aluno/DossierTabs.tsx b/apps/web/src/components/aluno/DossierTabs.tsx
index 452c67c5..7b5ed65c 100644
--- a/apps/web/src/components/aluno/DossierTabs.tsx
+++ b/apps/web/src/components/aluno/DossierTabs.tsx
@@ -20,13 +20,28 @@ export function DossierTabs({ aluno, slotPerfil, slotFinanceiro, slotHistorico,
   return (
     <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
       <div className="flex gap-1 border-b border-slate-200 px-5 pt-4 -mb-px">
-        {tabs.map((tab) => (
-          <button key={tab.id} onClick={() => setActive(tab.id)} className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 ${active === tab.id ? "border-[#1F6B3B] text-[#1F6B3B]" : "border-transparent text-slate-400 hover:text-slate-600"}`}>
-            {tab.icon}
-            {tab.label}
-            {tab.badge ? <span className="rounded-full px-2 py-0.5 text-[9px] font-black bg-rose-100 text-rose-700">{tab.badge}</span> : null}
-          </button>
-        ))}
+        {tabs.map((tab) => {
+          const isActive = active === tab.id;
+          return (
+            <button
+              key={tab.id}
+              onClick={() => setActive(tab.id)}
+              className={`relative flex items-center gap-2 px-4 py-3 text-sm border-b-2 ${
+                isActive
+                  ? "border-slate-900 text-slate-900 font-bold"
+                  : "border-transparent text-slate-400 font-medium hover:text-slate-700"
+              }`}
+            >
+              {tab.icon}
+              {tab.label}
+              {tab.badge ? (
+                <span className="absolute -top-1 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-black text-white">
+                  {tab.badge}
+                </span>
+              ) : null}
+            </button>
+          );
+        })}
       </div>
       <div className="p-6">{slots[active]}</div>
     </div>
diff --git a/apps/web/src/components/secretaria/AcoesRapidasBalcao.tsx b/apps/web/src/components/secretaria/AcoesRapidasBalcao.tsx
index 0953ade1..b2fa1f01 100644
--- a/apps/web/src/components/secretaria/AcoesRapidasBalcao.tsx
+++ b/apps/web/src/components/secretaria/AcoesRapidasBalcao.tsx
@@ -57,8 +57,9 @@ type QuickAction = {
   subtitle: string;
   icon: React.ComponentType<{ className?: string }>;
   onClick: () => void;
-  emphasis?: "primary";
   badge?: "alert" | null;
+  isPagamento?: boolean;
+  inadimplente?: boolean;
   disabled?: boolean;
 };
 
@@ -69,36 +70,37 @@ function QuickCard(props: {
   const { action } = props;
   const Icon = action.icon;
 
+  const isPagamentoCritico = action.isPagamento && action.inadimplente;
+
   return (
     <button
       type="button"
       onClick={action.onClick}
       disabled={action.disabled}
       className={cx(
-        "relative w-full rounded-xl border border-slate-200 bg-white p-4 text-left",
-        "hover:bg-slate-50 transition-colors",
+        "relative w-full rounded-2xl border border-slate-200 bg-white p-4 text-left",
+        "hover:border-[#1F6B3B]/30 hover:shadow-sm transition-all",
         "disabled:opacity-60 disabled:cursor-not-allowed",
-        action.emphasis === "primary" && "ring-1 ring-klasse-gold/25"
+        isPagamentoCritico && "border-rose-200"
       )}
     >
       {action.badge === "alert" ? (
-        <span className="absolute top-2 right-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white text-xs font-semibold">
-          !
-        </span>
+        <span className="absolute top-3 right-3 inline-flex h-2.5 w-2.5 items-center justify-center rounded-full bg-rose-500 animate-pulse" />
       ) : null}
 
       <div className="flex items-start gap-3">
         <div
           className={cx(
-            "h-10 w-10 rounded-xl border border-slate-200 bg-slate-100 flex items-center justify-center shrink-0"
+            "rounded-xl border border-slate-200 p-2 flex items-center justify-center shrink-0",
+            isPagamentoCritico ? "bg-rose-100 text-rose-600 border-rose-200" : "bg-slate-100 text-slate-500"
           )}
         >
-          <Icon className="h-5 w-5 text-slate-600" />
+          <Icon className="h-5 w-5" />
         </div>
 
         <div className="min-w-0">
-          <div className="text-sm font-semibold text-slate-900">{action.title}</div>
-          <div className="text-xs text-slate-500">{action.subtitle}</div>
+          <div className="text-sm font-bold text-slate-900">{action.title}</div>
+          <div className="text-xs text-slate-400">{action.subtitle}</div>
         </div>
       </div>
     </button>
@@ -166,7 +168,8 @@ export function AcoesRapidasBalcao({
         subtitle: "Propina",
         icon: CreditCard,
         onClick: openPagamento,
-        emphasis: "primary",
+        isPagamento: true,
+        inadimplente: totalPendente > 0,
         badge: totalPendente > 0 ? "alert" : null,
         disabled: !mensalidadeSugerida,
       },
@@ -205,54 +208,71 @@ export function AcoesRapidasBalcao({
   return (
     <>
       <div className="space-y-4">
-        <div className="flex items-start justify-between gap-3">
-          <div className="min-w-0">
-            <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
-              Ações rápidas
-            </div>
-            <div className="text-sm font-medium text-slate-900 truncate">
-              {alunoNome}
-            </div>
+        <div className="flex items-center justify-between gap-3">
+          <div className="flex items-center gap-3 min-w-0">
+            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Balcão rápido</span>
+            <span className="text-sm font-bold text-slate-900 truncate">{alunoNome}</span>
           </div>
+        </div>
 
-          <div className="text-right">
-            <div className="text-xs text-slate-500">Pendente</div>
+        <div
+          className={cx(
+            "rounded-2xl border px-4 py-3 shadow-sm flex flex-col gap-1",
+            totalPendente > 0
+              ? "bg-rose-50 border-rose-200"
+              : "bg-[#1F6B3B]/5 border-[#1F6B3B]/20"
+          )}
+        >
+          <div className="flex items-center justify-between gap-3">
+            <span
+              className={cx(
+                "text-[10px] font-bold uppercase tracking-widest",
+                totalPendente > 0 ? "text-rose-600" : "text-[#1F6B3B]/70"
+              )}
+            >
+              {totalPendente > 0 ? "Em dívida" : "Situação financeira"}
+            </span>
+            <span className="text-[10px] font-semibold text-slate-400">Resumo</span>
+          </div>
+          <div className="flex items-end justify-between gap-3">
             <div
               className={cx(
-                "text-sm font-semibold",
-                totalPendente > 0 ? "text-slate-900" : "text-slate-500"
+                "text-2xl font-black",
+                totalPendente > 0 ? "text-rose-700" : "text-[#1F6B3B]"
               )}
-              title={moneyAOA.format(totalPendente)}
             >
               {moneyAOA.format(totalPendente)}
             </div>
+            <span className="text-xs text-slate-400">Kz</span>
           </div>
         </div>
 
-        {/* Top actions (3 col) */}
-        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
-          {actions.slice(0, 3).map((a) => (
-            <QuickCard key={a.id} action={a} />
-          ))}
-        </div>
-
-        {/* Secondary actions (2 col) */}
-        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
-          {actions.slice(3).map((a) => (
-            <QuickCard key={a.id} action={a} />
-          ))}
-        </div>
-
-        {/* Context hint (optional, neutral) */}
         {pendentes.length > 0 && mensalidadeSugerida ? (
-          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
-            Sugestão: pagar{" "}
-            <span className="font-semibold text-slate-900">
-              {mensalidadeSugerida.mes}/{mensalidadeSugerida.ano}
+          <div className="rounded-2xl border border-[#E3B23C]/20 bg-[#E3B23C]/10 px-4 py-3 text-xs text-slate-500">
+            Mês em aberto: {" "}
+            <span className="text-sm font-bold text-[#9a7010]">
+              {mensalidadeSugerida.mes}/{mensalidadeSugerida.ano} — {moneyAOA.format(mensalidadeSugerida.valor)}
             </span>{" "}
-            ({moneyAOA.format(mensalidadeSugerida.valor)}).
+            <button
+              type="button"
+              onClick={openPagamento}
+              className="ml-2 text-xs font-bold text-[#1F6B3B] underline"
+            >
+              Pagar agora
+            </button>
           </div>
         ) : null}
+
+        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
+          {actions.map((a, index) => {
+            const shouldSpan = actions.length === 5 && index === actions.length - 1;
+            return (
+              <div key={a.id} className={shouldSpan ? "sm:col-span-3" : ""}>
+                <QuickCard action={a} />
+              </div>
+            );
+          })}
+        </div>
       </div>
 
       <ModalPagamentoRapido
diff --git a/apps/web/src/components/secretaria/AdmissaoWizardClient.tsx b/apps/web/src/components/secretaria/AdmissaoWizardClient.tsx
index 3cc2cfe9..c7c6a34c 100644
--- a/apps/web/src/components/secretaria/AdmissaoWizardClient.tsx
+++ b/apps/web/src/components/secretaria/AdmissaoWizardClient.tsx
@@ -2,7 +2,7 @@
 "use client";
 
 import { useCallback, useEffect, useMemo, useRef, useState } from "react";
-import { useSearchParams } from "next/navigation";
+import { useRouter, useSearchParams } from "next/navigation";
 import { AlertCircle, Check, RefreshCw, Save } from "lucide-react";
 
 /**
@@ -47,6 +47,39 @@ function useDebouncedValue<T>(value: T, delayMs: number) {
   return debounced;
 }
 
+type LocalDraftCache = {
+  updatedAt: number;
+  candidaturaId?: string | null;
+  identificacao?: DraftIdentificacao;
+  fit?: { cursoId?: string; classeId?: string; turmaId?: string };
+};
+
+const LOCAL_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
+const getDraftKey = (escolaId: string) => `admissao:draft:${escolaId}`;
+
+const readLocalDraft = (escolaId: string): LocalDraftCache | null => {
+  if (typeof window === "undefined") return null;
+  try {
+    const raw = window.localStorage.getItem(getDraftKey(escolaId));
+    if (!raw) return null;
+    const parsed = JSON.parse(raw) as LocalDraftCache;
+    if (!parsed?.updatedAt || Date.now() - parsed.updatedAt > LOCAL_DRAFT_TTL_MS) {
+      window.localStorage.removeItem(getDraftKey(escolaId));
+      return null;
+    }
+    return parsed;
+  } catch {
+    return null;
+  }
+};
+
+const writeLocalDraft = (escolaId: string, patch: Partial<LocalDraftCache>) => {
+  if (typeof window === "undefined") return;
+  const current = readLocalDraft(escolaId) ?? { updatedAt: Date.now() };
+  const next = { ...current, ...patch, updatedAt: Date.now() };
+  window.localStorage.setItem(getDraftKey(escolaId), JSON.stringify(next));
+};
+
 type JsonRecord = Record<string, unknown>;
 
 function isJsonRecord(value: unknown): value is JsonRecord {
@@ -182,6 +215,7 @@ function Step1Identificacao(props: {
   const [error, setError] = useState<string | null>(null);
   const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
   const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
+  const [localRestored, setLocalRestored] = useState(false);
 
   // hydrate initial
   useEffect(() => {
@@ -211,6 +245,23 @@ function Step1Identificacao(props: {
     });
   }, [initialData]);
 
+  useEffect(() => {
+    if (!hydrated || initialData || !isUuid(escolaId)) return;
+    const cached = readLocalDraft(escolaId);
+    if (cached?.identificacao) {
+      setForm((prev) => ({ ...prev, ...cached.identificacao }));
+      const hasAny = Object.values(cached.identificacao).some(
+        (value) =>
+          (typeof value === "string" && value.trim() !== "") ||
+          (typeof value === "boolean" && value)
+      );
+      if (hasAny) setLocalRestored(true);
+    }
+    if (!candidaturaId && cached?.candidaturaId && isUuid(String(cached.candidaturaId))) {
+      setCandidaturaId(String(cached.candidaturaId));
+    }
+  }, [hydrated, initialData, escolaId, candidaturaId, setCandidaturaId]);
+
   const debouncedForm = useDebouncedValue(form, 650);
 
   const [extraOpen, setExtraOpen] = useState(false);
@@ -263,16 +314,38 @@ function Step1Identificacao(props: {
   const lastHashRef = useRef<string>("");
 
   const payload = useMemo(() => {
+    const telefoneRaw = (form.telefone ?? "").trim();
+    const telefoneDigits = telefoneRaw.replace(/\D/g, "");
+    const telefone = telefoneDigits.length >= 6 ? telefoneRaw : undefined;
+
+    const responsavelContatoRaw = (form.responsavel_contato ?? "").trim();
+    const responsavelContatoDigits = responsavelContatoRaw.replace(/\D/g, "");
+    const responsavelContato = responsavelContatoDigits.length >= 6 ? responsavelContatoRaw : undefined;
+
+    const emailRaw = (form.email ?? "").trim();
+    const email = /[^@\s]+@[^@\s]+\.[^@\s]+/.test(emailRaw) ? emailRaw : undefined;
+
+    const numeroDocumentoRaw = (form.numero_documento ?? "").trim();
+    const numeroDocumento = numeroDocumentoRaw.length >= 3 ? numeroDocumentoRaw : undefined;
+
+    const biNumero =
+      form.tipo_documento === "BI" && numeroDocumentoRaw.length === 14
+        ? numeroDocumentoRaw
+        : undefined;
+
     // IMPORTANT: no nulls; no empty strings
     const clean = pickDefined({
       escolaId: safeUuid(escolaId), // must be uuid
       candidaturaId: safeUuid(candidaturaId),
       source: "walkin",
-      ...pickDefined(form),
-      bi_numero:
-        form.tipo_documento === "BI"
-          ? (form.numero_documento ?? "")
-          : undefined,
+      ...pickDefined({
+        ...form,
+        telefone,
+        responsavel_contato: responsavelContato,
+        email,
+        numero_documento: numeroDocumento,
+      }),
+      bi_numero: biNumero,
     });
 
     return clean;
@@ -340,6 +413,14 @@ function Step1Identificacao(props: {
     // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [debouncedForm, hydrated]);
 
+  useEffect(() => {
+    if (!hydrated || !isUuid(escolaId)) return;
+    writeLocalDraft(escolaId, {
+      candidaturaId,
+      identificacao: debouncedForm,
+    });
+  }, [debouncedForm, hydrated, escolaId, candidaturaId]);
+
   const normalizePhone = (value: string) => {
     const trimmed = value.trim();
     const hasPlus = trimmed.startsWith("+");
@@ -357,9 +438,9 @@ function Step1Identificacao(props: {
     if (docType || docNumber) {
       if (!docType) errors.tipo_documento = "Selecione o tipo de documento.";
       if (!docNumber) errors.numero_documento = "Informe o número do documento.";
-      if (docType.toUpperCase() === "BI" && docNumber && !/^[A-Za-z0-9]{14}$/.test(docNumber)) {
-        errors.numero_documento = "BI deve ter 14 caracteres alfanuméricos.";
-      }
+    if (docType.toUpperCase() === "BI" && docNumber && !/^[A-Za-z0-9]{14}$/.test(docNumber)) {
+      errors.numero_documento = "BI deve ter 14 caracteres alfanuméricos.";
+    }
     }
     const phone = (draft.telefone ?? "").replace(/\D/g, "");
     if (phone && phone.length < 6) {
@@ -383,6 +464,14 @@ function Step1Identificacao(props: {
       setForm((p) => ({ ...p, [name]: normalizePhone(value) }));
       return;
     }
+    if (name === "numero_documento") {
+      const docType = (form.tipo_documento ?? "").toUpperCase();
+      const nextValue = docType === "BI"
+        ? value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 14)
+        : value;
+      setForm((p) => ({ ...p, [name]: nextValue }));
+      return;
+    }
     setForm((p) => ({ ...p, [name]: value }));
   };
 
@@ -408,6 +497,11 @@ function Step1Identificacao(props: {
           <p className="text-sm text-slate-500">
             Preencha o básico. O sistema salva automaticamente como rascunho.
           </p>
+          {localRestored && !initialData && (
+            <p className="mt-1 text-xs text-emerald-700">
+              Dados restaurados localmente após queda ou retorno.
+            </p>
+          )}
           {!canEditDraft && (
             <p className="mt-1 text-xs text-amber-700">
               Esta candidatura já foi submetida e não pode ser editada.
@@ -668,8 +762,19 @@ function Step1Identificacao(props: {
  * Step 2: Fit Acadêmico
  * ========================= */
 
-type RefItem = { id: string; nome: string };
-type TurmaVaga = { id: string; nome: string; turno?: string | null; vagas_disponiveis?: number | null };
+type RefItem = { id: string; nome: string; curso_id?: string | null };
+type TurmaVaga = {
+  id: string;
+  nome: string;
+  turma_codigo?: string | null;
+  turno?: string | null;
+  vagas_disponiveis?: number | null;
+  curso_id?: string | null;
+  classe_id?: string | null;
+  curso_nome?: string | null;
+  classe_nome?: string | null;
+  ano_letivo?: number | null;
+};
 
 function Step2FitAcademico(props: {
   onBack: () => void;
@@ -681,12 +786,25 @@ function Step2FitAcademico(props: {
   setClasseId: (id: string | null) => void;
   initialData: CandidaturaDraft | null;
   canEditDraft: boolean;
+  hydrated: boolean;
 }) {
-  const { onBack, onNext, escolaId, candidaturaId, setTurmaId, setCursoId, setClasseId, initialData, canEditDraft } = props;
+  const {
+    onBack,
+    onNext,
+    escolaId,
+    candidaturaId,
+    setTurmaId,
+    setCursoId,
+    setClasseId,
+    initialData,
+    canEditDraft,
+    hydrated,
+  } = props;
 
   const [cursos, setCursos] = useState<RefItem[]>([]);
   const [classes, setClasses] = useState<RefItem[]>([]);
   const [turmas, setTurmas] = useState<TurmaVaga[]>([]);
+  const [classesComPreco, setClassesComPreco] = useState<string[]>([]);
 
   const [sel, setSel] = useState({
     cursoId: "",
@@ -698,6 +816,7 @@ function Step2FitAcademico(props: {
   const [loadingVagas, setLoadingVagas] = useState(false);
   const [saving, setSaving] = useState(false);
   const [error, setError] = useState<string | null>(null);
+  const [localRestored, setLocalRestored] = useState(false);
 
   // hydrate initial
   useEffect(() => {
@@ -714,6 +833,24 @@ function Step2FitAcademico(props: {
     }
   }, [initialData, setClasseId, setCursoId, setTurmaId]);
 
+  useEffect(() => {
+    if (!hydrated || initialData || !isUuid(escolaId)) return;
+    const cached = readLocalDraft(escolaId);
+    if (cached?.fit) {
+      setSel((prev) => ({
+        ...prev,
+        cursoId: cached.fit?.cursoId ?? prev.cursoId,
+        classeId: cached.fit?.classeId ?? prev.classeId,
+        turmaId: cached.fit?.turmaId ?? prev.turmaId,
+      }));
+      const hasAny = Boolean(cached.fit?.cursoId || cached.fit?.classeId || cached.fit?.turmaId);
+      if (hasAny) setLocalRestored(true);
+      if (cached.fit?.cursoId) setCursoId(cached.fit.cursoId);
+      if (cached.fit?.classeId) setClasseId(cached.fit.classeId);
+      if (cached.fit?.turmaId) setTurmaId(cached.fit.turmaId);
+    }
+  }, [hydrated, initialData, escolaId, setClasseId, setCursoId, setTurmaId]);
+
   // load cursos/classes
   useEffect(() => {
     if (!isUuid(escolaId)) {
@@ -740,11 +877,12 @@ function Step2FitAcademico(props: {
 
   // load turmas/vagas
   useEffect(() => {
-    if (!isUuid(escolaId)) return;
-    const cursoId = safeUuid(sel.cursoId);
-    const classeId = safeUuid(sel.classeId);
+    if (!isUuid(escolaId)) {
+      setError("Contexto inválido: escolaId não é UUID.");
+      return;
+    }
 
-    if (!cursoId || !classeId) {
+    if (!safeUuid(sel.cursoId)) {
       setTurmas([]);
       return;
     }
@@ -752,21 +890,36 @@ function Step2FitAcademico(props: {
     (async () => {
       setLoadingVagas(true);
       setError(null);
-      const url = `/api/secretaria/admissoes/vagas?escolaId=${encodeURIComponent(
-        escolaId
-      )}&cursoId=${encodeURIComponent(cursoId)}&classeId=${encodeURIComponent(classeId)}`;
-      const res = await fetch(url);
+      const params = new URLSearchParams({ escolaId });
+      if (initialData?.ano_letivo) {
+        params.set("ano", String(initialData.ano_letivo));
+      }
+      params.set("cursoId", sel.cursoId);
+      if (safeUuid(sel.classeId)) {
+        params.set("classeId", sel.classeId);
+      }
+      const res = await fetch(`/api/secretaria/admissoes/vagas?${params.toString()}`);
       const json = await res.json().catch(() => ({}));
       setLoadingVagas(false);
 
       if (!res.ok) {
-        setError(json?.error ?? "Falha ao carregar vagas.");
+        setError(json?.error ?? "Falha ao carregar turmas.");
         return;
       }
 
-      setTurmas(Array.isArray(json) ? json : []);
+      const rows = Array.isArray(json?.items) ? json.items : Array.isArray(json) ? json : [];
+      const metaClasses = Array.isArray(json?.meta?.classesComPreco)
+        ? json.meta.classesComPreco
+        : [];
+      setTurmas(rows);
+      setClassesComPreco(metaClasses);
+      if (initialData?.turma_preferencial_id) {
+        const turma = rows.find((row) => row.id === initialData.turma_preferencial_id);
+        if (turma?.curso_id) setCursoId(turma.curso_id);
+        if (turma?.classe_id) setClasseId(turma.classe_id);
+      }
     })();
-  }, [sel.cursoId, sel.classeId, escolaId]);
+  }, [escolaId, initialData?.ano_letivo, initialData?.turma_preferencial_id, sel.cursoId, sel.classeId, setClasseId, setCursoId]);
 
   const updateDraft = useCallback(
     async (patch: { curso_id?: string; classe_id?: string; turma_preferencial_id?: string }) => {
@@ -807,32 +960,72 @@ function Step2FitAcademico(props: {
     [escolaId, candidaturaId, canEditDraft]
   );
 
-  const onSelectCurso = async (cursoId: string) => {
+  const onSelectCurso = (cursoId: string) => {
     setSel((p) => ({ ...p, cursoId, turmaId: "" }));
-    setCursoId(cursoId || null);
-    await updateDraft({ curso_id: cursoId, classe_id: sel.classeId, turma_preferencial_id: "" });
   };
 
-  const onSelectClasse = async (classeId: string) => {
+  const onSelectClasse = (classeId: string) => {
     setSel((p) => ({ ...p, classeId, turmaId: "" }));
-    setClasseId(classeId || null);
-    await updateDraft({ curso_id: sel.cursoId, classe_id: classeId, turma_preferencial_id: "" });
   };
 
   const onSelectTurma = async (turmaId: string) => {
     setSel((p) => ({ ...p, turmaId }));
     setTurmaId(turmaId);
-    await updateDraft({ curso_id: sel.cursoId, classe_id: sel.classeId, turma_preferencial_id: turmaId });
+    const turma = turmas.find((row) => row.id === turmaId);
+    const cursoId = turma?.curso_id || null;
+    const classeId = turma?.classe_id || null;
+    setCursoId(cursoId);
+    setClasseId(classeId);
+    await updateDraft({ curso_id: cursoId ?? undefined, classe_id: classeId ?? undefined, turma_preferencial_id: turmaId });
   };
 
   const canAdvance = safeUuid(sel.turmaId) && safeUuid(candidaturaId);
 
+  useEffect(() => {
+    if (!hydrated || !isUuid(escolaId)) return;
+    writeLocalDraft(escolaId, {
+      candidaturaId,
+      fit: {
+        cursoId: sel.cursoId,
+        classeId: sel.classeId,
+        turmaId: sel.turmaId,
+      },
+    });
+  }, [hydrated, escolaId, candidaturaId, sel.cursoId, sel.classeId, sel.turmaId]);
+
+  const classesFromTurmas = useMemo(() => {
+    const map = new Map<string, RefItem>();
+    turmas.forEach((turma) => {
+      if (turma.classe_id) {
+        map.set(turma.classe_id, {
+          id: turma.classe_id,
+          nome: turma.classe_nome || "Classe",
+          curso_id: turma.curso_id ?? null,
+        });
+      }
+    });
+    return Array.from(map.values());
+  }, [turmas]);
+
+  const classOptions = useMemo(() => {
+    const filtered = sel.cursoId
+      ? classes.filter((c) => c.curso_id === sel.cursoId)
+      : classes;
+    const priceFiltered = classesComPreco.length > 0
+      ? filtered.filter((c) => classesComPreco.includes(c.id))
+      : filtered;
+    if (priceFiltered.length > 0) return priceFiltered;
+    return sel.cursoId
+      ? classesFromTurmas.filter((c) => c.curso_id === sel.cursoId)
+      : classesFromTurmas;
+  }, [classes, classesComPreco, classesFromTurmas, sel.cursoId]);
+
   return (
     <div className="space-y-5">
       <div className="flex items-start justify-between gap-4">
         <div>
           <h2 className="text-lg font-semibold text-klasse-green">Fit Acadêmico</h2>
-          <p className="text-sm text-slate-500">Curso, classe e turma preferencial.</p>
+          <p className="text-sm text-slate-500">Selecione a turma preferencial.</p>
         </div>
 
         <div className="flex items-center gap-2 text-sm">
@@ -857,14 +1050,22 @@ function Step2FitAcademico(props: {
         </div>
       )}
 
+      {localRestored && !initialData && (
+        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
+          <p className="text-sm font-semibold text-emerald-700">
+            Dados restaurados localmente após queda ou retorno.
+          </p>
+        </div>
+      )}
+
       <div className="grid gap-3 md:grid-cols-2">
         <select
           value={sel.cursoId}
-          onChange={(e) => void onSelectCurso(e.target.value)}
+          onChange={(e) => onSelectCurso(e.target.value)}
           disabled={loadingCfg || !safeUuid(candidaturaId) || !canEditDraft}
           className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold disabled:opacity-60"
         >
-          <option value="">Selecione o curso</option>
+          <option value="">Filtrar por curso</option>
           {cursos.map((c) => (
             <option key={c.id} value={c.id}>
               {c.nome}
@@ -874,12 +1075,12 @@ function Step2FitAcademico(props: {
 
         <select
           value={sel.classeId}
-          onChange={(e) => void onSelectClasse(e.target.value)}
-          disabled={loadingCfg || !sel.cursoId || !safeUuid(candidaturaId) || !canEditDraft}
+          onChange={(e) => onSelectClasse(e.target.value)}
+          disabled={loadingCfg || !safeUuid(candidaturaId) || !canEditDraft}
           className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold disabled:opacity-60"
         >
-          <option value="">Selecione a classe</option>
-          {classes.map((c) => (
+          <option value="">Filtrar por classe</option>
+          {classOptions.map((c) => (
             <option key={c.id} value={c.id}>
               {c.nome}
             </option>
@@ -917,8 +1118,14 @@ function Step2FitAcademico(props: {
               >
                 <div className="flex items-center justify-between gap-3">
                   <div className="min-w-0">
-                    <p className="truncate font-semibold text-slate-900">{t.nome}</p>
-                    <p className="text-xs text-slate-500">{t.turno ? `Turno: ${t.turno}` : "Turno: —"}</p>
+                    <p className="truncate font-semibold text-slate-900">
+                      {t.turma_codigo ? `${t.turma_codigo} · ${t.nome}` : t.nome}
+                    </p>
+                    <p className="text-xs text-slate-500">
+                      {t.curso_nome ? `${t.curso_nome} · ` : ""}
+                      {t.classe_nome ? `${t.classe_nome} · ` : ""}
+                      {t.turno ? `Turno: ${t.turno}` : "Turno: —"}
+                    </p>
                   </div>
                   <div className="shrink-0 text-xs text-slate-600">
                     Vagas: {t.vagas_disponiveis ?? "—"}
@@ -927,9 +1134,17 @@ function Step2FitAcademico(props: {
               </button>
             );
           })}
-          {!loadingVagas && turmas.length === 0 ? (
-            <p className="text-sm text-slate-500">Nenhuma turma disponível para esta seleção.</p>
-          ) : null}
+      {!loadingVagas && turmas.length === 0 ? (
+        <p className="text-sm text-slate-500">
+          {sel.cursoId
+            ? sel.classeId
+              ? "Preço de matrícula não configurado — peça ao admin."
+              : classesComPreco.length === 0
+                ? "Preço de matrícula não configurado para este curso — peça ao admin."
+                : "Selecione a classe para ver turmas disponíveis."
+            : "Selecione um curso para ver turmas disponíveis."}
+        </p>
+      ) : null}
         </div>
       </div>
 
@@ -971,6 +1186,9 @@ function Step3Pagamento(props: {
   initialData: CandidaturaDraft | null;
   resumeMode: boolean;
   onEditDados: () => void;
+  setBaseCanEditDraft: (value: boolean) => void;
+  setEditOverride: (value: boolean) => void;
+  setResumeMode: (value: boolean) => void;
 }) {
   const {
     onBack,
@@ -984,6 +1202,9 @@ function Step3Pagamento(props: {
     initialData,
     resumeMode,
     onEditDados,
+    setBaseCanEditDraft,
+    setEditOverride,
+    setResumeMode,
   } = props;
 
   const [payment, setPayment] = useState({
@@ -991,11 +1212,13 @@ function Step3Pagamento(props: {
     comprovativo_url: "",
     amount: "",
     referencia: "",
+    parcial: false,
   });
 
   const [loading, setLoading] = useState(false);
   const [result, setResult] = useState<SimpleResult | null>(null);
   const [priceHint, setPriceHint] = useState<string | null>(null);
+  const router = useRouter();
 
   useEffect(() => {
     if (!isUuid(escolaId) || !isUuid(cursoId) || !isUuid(classeId)) return;
@@ -1027,7 +1250,7 @@ function Step3Pagamento(props: {
         const valorMatricula = Number(json?.data?.valor_matricula ?? 0);
         if (valorMatricula > 0) {
           setPriceHint(String(valorMatricula));
-          if (!payment.amount) {
+          if (!payment.parcial) {
             setPayment((p) => ({ ...p, amount: String(valorMatricula) }));
           }
         } else {
@@ -1043,7 +1266,18 @@ function Step3Pagamento(props: {
   }, [escolaId, cursoId, classeId, anoLetivo, payment.amount]);
 
   const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
-    const { name, value } = e.target;
+    const { name, value, type } = e.target;
+    if (type === "checkbox") {
+      const checked = (e.target as HTMLInputElement).checked;
+      setPayment((p) => {
+        const next = { ...p, [name]: checked };
+        if (!checked && priceHint) {
+          next.amount = String(priceHint);
+        }
+        return next;
+      });
+      return;
+    }
     setPayment((p) => ({ ...p, [name]: value }));
   };
 
@@ -1061,6 +1295,21 @@ function Step3Pagamento(props: {
       return;
     }
 
+    const amountValue = payment.amount ? Number(payment.amount) : null;
+    if (payment.parcial) {
+      if (!amountValue || amountValue <= 0) {
+        setResult({ ok: false, error: "Informe o valor pago." });
+        return;
+      }
+      if (priceHint && amountValue >= Number(priceHint)) {
+        setResult({ ok: false, error: "Pagamento parcial deve ser menor que o valor total." });
+        return;
+      }
+    } else if (!priceHint && (!amountValue || amountValue <= 0)) {
+      setResult({ ok: false, error: "Informe o valor da matrícula." });
+      return;
+    }
+
     setLoading(true);
     const approveResp = await postJson<SimpleResult>(
       "/api/secretaria/admissoes/approve",
@@ -1093,7 +1342,23 @@ function Step3Pagamento(props: {
     );
 
     setLoading(false);
-    if (!convertResp.ok) return setResult({ ok: false, error: convertResp.error });
+    if (!convertResp.ok) {
+      const shouldReopen = convertResp.status >= 500;
+      if (shouldReopen && isUuid(candidaturaId)) {
+        try {
+          await postJson<SimpleResult>(
+            "/api/secretaria/admissoes/reabrir",
+            { candidatura_id: candidaturaId }
+          );
+          setBaseCanEditDraft(true);
+          setEditOverride(true);
+          setResumeMode(false);
+          setResult({ ok: false, error: "Falha na conversão. Candidatura reaberta para edição." });
+          return;
+        } catch {}
+      }
+      return setResult({ ok: false, error: convertResp.error });
+    }
     setResult({ ok: true, message: "Matrícula concluída pela secretaria." });
   };
 
@@ -1116,15 +1381,66 @@ function Step3Pagamento(props: {
   if (result) {
     return (
       <div className="space-y-4">
-        <h2 className="text-lg font-semibold text-klasse-green">Resultado</h2>
+        <div>
+          <h2 className="text-lg font-semibold text-klasse-green">Resultado</h2>
+          {result.ok ? (
+            <p className="text-sm font-semibold text-klasse-green">
+              {result.message || "Operação concluída com sucesso."}
+            </p>
+          ) : (
+            <p className="text-sm font-semibold text-red-600">Erro: {result.error}</p>
+          )}
+        </div>
+
         {result.ok ? (
-          <p className="text-sm font-semibold text-klasse-green">
-            {result.message || "Operação concluída com sucesso."}
-          </p>
+          <div className="flex flex-wrap gap-2">
+            <button
+              type="button"
+              onClick={() => router.push(`/escola/${escolaId}/secretaria/matriculas`)}
+              className="rounded-xl bg-klasse-green px-4 py-2 text-sm font-semibold text-white hover:brightness-95"
+            >
+              Ir para matrículas
+            </button>
+            <button
+              type="button"
+              onClick={() => router.push(`/escola/${escolaId}/secretaria/admissoes/nova`)}
+              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-klasse-gold/40"
+            >
+              Nova admissão
+            </button>
+            <button
+              type="button"
+              onClick={() => router.push(`/escola/${escolaId}/secretaria/admissoes`)}
+              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-klasse-gold/40"
+            >
+              Voltar ao radar
+            </button>
+          </div>
         ) : (
-          <p className="text-sm font-semibold text-red-600">Erro: {result.error}</p>
+          <div className="flex flex-wrap gap-2">
+            <button
+              type="button"
+              onClick={() => setResult(null)}
+              className="rounded-xl bg-klasse-gold px-4 py-2 text-sm font-semibold text-white hover:brightness-95"
+            >
+              Tentar novamente
+            </button>
+            <button
+              type="button"
+              onClick={() => router.push(`/escola/${escolaId}/secretaria/admissoes`)}
+              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-klasse-gold/40"
+            >
+              Voltar ao radar
+            </button>
+          </div>
+        )}
+
+        {!result.ok && (
+          <details className="rounded-xl bg-slate-100 px-4 py-3 text-xs text-slate-600">
+            <summary className="cursor-pointer font-semibold text-slate-600">Detalhes técnicos</summary>
+            <pre className="mt-2 whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
+          </details>
         )}
-        <pre className="rounded-xl bg-slate-100 p-4 text-xs">{JSON.stringify(result, null, 2)}</pre>
       </div>
     );
   }
@@ -1132,10 +1448,10 @@ function Step3Pagamento(props: {
   return (
     <div className="space-y-5">
       {resumeMode && (
-        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
+        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
           <div className="flex items-start justify-between gap-4">
             <div>
-              <h3 className="text-sm font-semibold text-slate-700">Resumo do Candidato</h3>
+              <h3 className="text-sm font-semibold text-klasse-green">Resumo do Candidato</h3>
               <p className="text-xs text-slate-500">
                 Dados bloqueados até ação explícita de edição.
               </p>
@@ -1143,7 +1459,7 @@ function Step3Pagamento(props: {
             <button
               type="button"
               onClick={onEditDados}
-              className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-white"
+              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-klasse-gold/40"
             >
               Editar Dados
             </button>
@@ -1199,20 +1515,37 @@ function Step3Pagamento(props: {
           <option value="TRANSFERENCIA">Transferência</option>
         </select>
 
-        <input
-          type="number"
-          name="amount"
-          value={payment.amount}
-          onChange={onChange}
-          placeholder="Valor"
-          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold"
-        />
+        <label className="flex items-center gap-2 text-xs text-slate-600">
+          <input
+            type="checkbox"
+            name="parcial"
+            checked={payment.parcial}
+            onChange={onChange}
+            className="h-4 w-4 rounded border-slate-300 text-klasse-green focus:ring-klasse-gold/40"
+          />
+          Pagamento parcial
+        </label>
 
-        {priceHint ? (
-          <p className="text-xs text-slate-500">
-            Valor da matrícula configurado: <span className="font-semibold">{priceHint}</span>
+        {payment.parcial || !priceHint ? (
+          <input
+            type="number"
+            name="amount"
+            value={payment.amount}
+            onChange={onChange}
+            placeholder={priceHint ? "Valor pago" : "Valor da matrícula"}
+            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold"
+          />
+        ) : (
+          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
+            Valor da matrícula: <span className="font-semibold">{priceHint}</span>
+          </div>
+        )}
+
+        {!priceHint && !payment.parcial && (
+          <p className="text-xs text-amber-700">
+            Sem tabela de preço configurada. Informe o valor da matrícula.
           </p>
-        ) : null}
+        )}
 
         {(payment.metodo_pagamento === "TPA" || payment.metodo_pagamento === "TRANSFERENCIA") && (
           <input
@@ -1273,6 +1606,7 @@ function Step3Pagamento(props: {
  * ========================= */
 
 export default function AdmissaoWizardClient({ escolaId }: { escolaId: string }) {
+  const router = useRouter();
   const [step, setStep] = useState(1);
   const [candidaturaId, setCandidaturaId] = useState<string | null>(null);
   const [turmaId, setTurmaId] = useState<string | null>(null);
@@ -1283,6 +1617,11 @@ export default function AdmissaoWizardClient({ escolaId }: { escolaId: string })
   const [baseCanEditDraft, setBaseCanEditDraft] = useState(true);
   const [resumeMode, setResumeMode] = useState(false);
   const [editOverride, setEditOverride] = useState(false);
+  const [showDrafts, setShowDrafts] = useState(false);
+  const [draftsLoading, setDraftsLoading] = useState(false);
+  const [draftsError, setDraftsError] = useState<string | null>(null);
+  const [wizardError, setWizardError] = useState<string | null>(null);
+  const [draftItems, setDraftItems] = useState<Array<{ id: string; nome_candidato: string | null; status: string | null; updated_at?: string | null }>>([]);
 
   const canEditDraft = baseCanEditDraft || editOverride;
 
@@ -1303,11 +1642,13 @@ export default function AdmissaoWizardClient({ escolaId }: { escolaId: string })
           setClasseId(json.item?.classe_id ?? null);
           setTurmaId(json.item?.turma_preferencial_id ?? null);
           const status = String(json.item?.status ?? '').toLowerCase();
-          const isResumeStatus = status === 'matriculado';
-          setBaseCanEditDraft(status === 'rascunho' || status === '');
-          setResumeMode(isResumeStatus);
+          const canEdit = status === 'rascunho' || status === '';
+          const resumeStatuses = ['matriculado', 'aprovada', 'aguardando_pagamento'];
+          const paymentStatuses = ['matriculado', 'aprovada', 'aguardando_pagamento'];
+          setBaseCanEditDraft(canEdit);
+          setResumeMode(resumeStatuses.includes(status));
           setEditOverride(false);
-          if (isResumeStatus) {
+          if (paymentStatuses.includes(status)) {
             setStep(3);
           }
         }
@@ -1321,22 +1662,179 @@ export default function AdmissaoWizardClient({ escolaId }: { escolaId: string })
     }
   }, [searchParams]);
 
-  const handleEditDados = () => {
+  const handleEditDados = async () => {
+    setWizardError(null);
+    if (candidaturaId && initialData?.status) {
+      const status = String(initialData.status).toLowerCase();
+      if (status !== 'rascunho') {
+        const resp = await postJson<SimpleResult>(
+          "/api/secretaria/admissoes/reabrir",
+          { candidatura_id: candidaturaId }
+        );
+        if (!resp.ok) {
+          setWizardError(resp.error);
+          return;
+        }
+      }
+    }
     setEditOverride(true);
     setResumeMode(false);
     setStep(1);
   };
 
+  const loadDrafts = useCallback(async () => {
+    if (!isUuid(escolaId)) return;
+    setDraftsLoading(true);
+    setDraftsError(null);
+    try {
+      const params = new URLSearchParams({ escolaId, limit: "20" });
+      const res = await fetch(`/api/secretaria/admissoes/rascunhos?${params.toString()}`, { cache: "no-store" });
+      const json = await res.json().catch(() => ({}));
+      if (!res.ok || !json?.ok) {
+        throw new Error(json?.error ?? "Falha ao carregar rascunhos.");
+      }
+      setDraftItems(Array.isArray(json.items) ? json.items : []);
+    } catch (err: any) {
+      setDraftsError(err.message || "Falha ao carregar rascunhos.");
+    } finally {
+      setDraftsLoading(false);
+    }
+  }, [escolaId]);
+
+  const handleResume = (id: string) => {
+    if (!isUuid(id)) return;
+    const next = `/escola/${escolaId}/secretaria/admissoes/nova?candidaturaId=${id}`;
+    router.push(next);
+  };
+
+  const handleDeleteDraft = async (id: string) => {
+    if (!isUuid(id)) return;
+    const confirmDelete = window.confirm("Excluir este rascunho? Esta ação não pode ser desfeita.");
+    if (!confirmDelete) return;
+    try {
+      const params = new URLSearchParams({ escolaId });
+      const res = await fetch(`/api/secretaria/admissoes/rascunhos?${params.toString()}`, {
+        method: "DELETE",
+        headers: { "Content-Type": "application/json" },
+        body: JSON.stringify({ id }),
+      });
+      const json = await res.json().catch(() => ({}));
+      if (!res.ok || !json?.ok) {
+        throw new Error(json?.error ?? "Falha ao excluir rascunho.");
+      }
+      setDraftItems((prev) => prev.filter((item) => item.id !== id));
+      const cached = readLocalDraft(escolaId);
+      if (cached?.candidaturaId === id) {
+        writeLocalDraft(escolaId, { candidaturaId: null, identificacao: {}, fit: {} });
+      }
+    } catch (err: any) {
+      setDraftsError(err.message || "Falha ao excluir rascunho.");
+    }
+  };
+
+  const handleDeleteAllDrafts = async () => {
+    const confirmDelete = window.confirm("Excluir todos os rascunhos? Esta ação não pode ser desfeita.");
+    if (!confirmDelete) return;
+    try {
+      const params = new URLSearchParams({ escolaId });
+      const res = await fetch(`/api/secretaria/admissoes/rascunhos?${params.toString()}`, {
+        method: "DELETE",
+        headers: { "Content-Type": "application/json" },
+        body: JSON.stringify({ all: true }),
+      });
+      const json = await res.json().catch(() => ({}));
+      if (!res.ok || !json?.ok) {
+        throw new Error(json?.error ?? "Falha ao excluir rascunhos.");
+      }
+      setDraftItems([]);
+      writeLocalDraft(escolaId, { candidaturaId: null, identificacao: {}, fit: {} });
+    } catch (err: any) {
+      setDraftsError(err.message || "Falha ao excluir rascunhos.");
+    }
+  };
+
   return (
     <div className="space-y-4">
-      <div>
+      <div className="flex items-start justify-between gap-3">
         <h1 className="text-xl font-semibold text-klasse-green">Nova Admissão</h1>
-        <p className="text-sm text-slate-500">
-          Fluxo rascunho → submetida → aprovada → matriculado.
-        </p>
+        <div className="relative">
+          <button
+            type="button"
+            onClick={() => {
+              setShowDrafts((prev) => !prev);
+              if (!showDrafts) void loadDrafts();
+            }}
+            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-klasse-gold/40"
+          >
+            Retomar rascunho
+          </button>
+          {showDrafts && (
+            <div className="absolute right-0 mt-2 w-72 rounded-xl border border-slate-200 bg-white shadow-xl p-3 z-30">
+              <div className="flex items-center justify-between mb-2">
+                <p className="text-[11px] font-semibold text-slate-500 uppercase">Rascunhos</p>
+                {draftItems.length > 0 && (
+                  <button
+                    type="button"
+                    onClick={handleDeleteAllDrafts}
+                    className="text-[11px] font-semibold text-rose-600 hover:text-rose-700"
+                  >
+                    Limpar tudo
+                  </button>
+                )}
+              </div>
+              {draftsLoading && (
+                <p className="text-xs text-slate-500">Carregando rascunhos…</p>
+              )}
+              {draftsError && (
+                <p className="text-xs text-rose-600">{draftsError}</p>
+              )}
+              {!draftsLoading && !draftsError && draftItems.length === 0 && (
+                <p className="text-xs text-slate-500">Nenhum rascunho encontrado.</p>
+              )}
+              <div className="space-y-2">
+                {draftItems.map((item) => (
+                  <div
+                    key={item.id}
+                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
+                  >
+                    <div className="flex items-start justify-between gap-2">
+                      <button
+                        type="button"
+                        onClick={() => handleResume(item.id)}
+                        className="text-left flex-1"
+                      >
+                        <p className="font-semibold text-slate-700">
+                          {item.nome_candidato || "Sem nome"}
+                        </p>
+                        <p className="text-[10px] text-slate-400">
+                          {item.status || "rascunho"}
+                        </p>
+                      </button>
+                      <button
+                        type="button"
+                        onClick={() => handleDeleteDraft(item.id)}
+                        className="text-[10px] font-semibold text-rose-600 hover:text-rose-700"
+                      >
+                        Limpar
+                      </button>
+                    </div>
+                  </div>
+                ))}
+              </div>
+            </div>
+          )}
+        </div>
       </div>
+      <p className="text-sm text-slate-500">
+        Fluxo rascunho → submetida → aprovada → matriculado.
+      </p>
 
       <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
+        {wizardError && (
+          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
+            {wizardError}
+          </div>
+        )}
         {step === 1 ? (
           <Step1Identificacao
             onNext={() => setStep(2)}
@@ -1358,6 +1856,7 @@ export default function AdmissaoWizardClient({ escolaId }: { escolaId: string })
             setClasseId={setClasseId}
             initialData={initialData}
             canEditDraft={canEditDraft}
+            hydrated={hydrated}
           />
         ) : (
           <Step3Pagamento
@@ -1372,6 +1871,9 @@ export default function AdmissaoWizardClient({ escolaId }: { escolaId: string })
             initialData={initialData}
             resumeMode={resumeMode}
             onEditDados={handleEditDados}
+            setBaseCanEditDraft={setBaseCanEditDraft}
+            setEditOverride={setEditOverride}
+            setResumeMode={setResumeMode}
           />
         )}
       </div>
diff --git a/apps/web/src/components/secretaria/AlunosListClient.tsx b/apps/web/src/components/secretaria/AlunosListClient.tsx
deleted file mode 100644
index 5a983c8a..00000000
--- a/apps/web/src/components/secretaria/AlunosListClient.tsx
+++ /dev/null
@@ -1,662 +0,0 @@
-// apps/web/src/components/secretaria/AlunosListClient.tsx
-"use client";
-
-import { useCallback, useEffect, useMemo, useRef, useState } from "react";
-import Link from "next/link";
-import { useRouter } from "next/navigation";
-import {
-  Search,
-  Filter,
-  Plus,
-  ArrowLeft,
-  Users,
-  Mail,
-  Phone,
-  Shield,
-  Eye,
-  Pencil,
-  Trash2,
-} from "lucide-react";
-import { useVirtualizer } from "@tanstack/react-virtual";
-import { fetchJsonWithOffline } from "@/lib/offline/fetch";
-import { OfflineBanner } from "@/components/system/OfflineBanner";
-import { Skeleton } from "@/components/feedback/FeedbackSystem";
-
-/**
- * KLASSE UI notes:
- * - Gold (#E3B23C) = action/active states
- * - Green (#1F6B3B) = brand/headings
- * - Radius: rounded-xl (cards/inputs/buttons), rounded-full (badges)
- * - Focus: ring-4 ring-klasse-gold/20 + border-klasse-gold
- */
-
-// -----------------------------
-// Types
-// -----------------------------
-type Aluno = {
-  id: string;
-  nome: string;
-  email?: string | null;
-  responsavel?: string | null;
-  telefone_responsavel?: string | null;
-  status?: string | null;
-  created_at: string;
-
-  // Identifiers
-  numero_login?: string | null; // existe quando virou aluno/matricula
-  numero_processo?: string | null; // pode existir se vocês mantiveram "processo" em alunos
-
-  // Lead/origem
-  origem?: "aluno" | "candidatura" | null;
-  candidatura_id?: string | null;
-};
-
-type Cursor = { created_at: string; id: string };
-
-type ApiResponse = {
-  ok: boolean;
-  items: Aluno[];
-  total?: number;
-  page?: { hasMore?: boolean; nextCursor?: Cursor | null };
-  error?: string;
-};
-
-const fetchJson = async <T,>(url: string, opts?: RequestInit): Promise<T> => {
-  const res = await fetch(url, opts);
-  const json = await res.json().catch(() => ({}));
-  return json as T;
-};
-
-// -----------------------------
-// Small utilities
-// -----------------------------
-function useDebounce<T>(value: T, delayMs: number) {
-  const [debounced, setDebounced] = useState(value);
-  useEffect(() => {
-    const t = setTimeout(() => setDebounced(value), delayMs);
-    return () => clearTimeout(t);
-  }, [value, delayMs]);
-  return debounced;
-}
-
-type OfflineMeta = { fromCache: boolean; updatedAt: string | null };
-
-// -----------------------------
-// UI micro-components
-// -----------------------------
-function KpiCard({
-  title,
-  value,
-  icon: Icon,
-}: {
-  title: string;
-  value: number | string;
-  icon: React.ComponentType<{ className?: string }>;
-}) {
-  return (
-    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 flex items-start justify-between">
-      <div className="min-w-0">
-        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{title}</p>
-        <p className="text-2xl font-black text-slate-950 mt-1">{value}</p>
-      </div>
-
-      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
-        <Icon className="h-4 w-4 text-slate-400" />
-      </div>
-    </div>
-  );
-}
-
-function StatusBadge({ status }: { status?: string | null }) {
-  const st = (status || "pendente").toLowerCase();
-
-  // Ajusta conforme teus status reais do backend
-  const styles: Record<string, string> = {
-    ativo: "bg-emerald-50 text-emerald-700 border-emerald-200",
-    matriculado: "bg-emerald-50 text-emerald-700 border-emerald-200",
-    pendente: "bg-amber-50 text-amber-800 border-amber-200",
-    submetida: "bg-amber-50 text-amber-800 border-amber-200",
-    em_analise: "bg-sky-50 text-sky-700 border-sky-200",
-    aprovada: "bg-indigo-50 text-indigo-700 border-indigo-200",
-    suspenso: "bg-amber-50 text-amber-800 border-amber-200",
-    inativo: "bg-rose-50 text-rose-700 border-rose-200",
-    arquivado: "bg-slate-100 text-slate-600 border-slate-200",
-    todos: "bg-slate-100 text-slate-600 border-slate-200",
-  };
-
-  return (
-    <span
-      className={[
-        "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border capitalize",
-        styles[st] || styles.pendente,
-      ].join(" ")}
-      title={st}
-    >
-      {st.replace(/_/g, " ")}
-    </span>
-  );
-}
-
-function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
-  return (
-    <div className="p-12 text-center">
-      <p className="text-sm font-semibold text-slate-700">{title}</p>
-      {subtitle ? <p className="text-sm text-slate-500 mt-1">{subtitle}</p> : null}
-    </div>
-  );
-}
-
-// -----------------------------
-// Main
-// -----------------------------
-export default function AlunosListClient() {
-  const router = useRouter();
-
-  // Filters
-  const [q, setQ] = useState("");
-  const debouncedQ = useDebounce(q, 300);
-
-  // Mantive teus filtros (porque não tenho certeza do teu endpoint /api/secretaria/alunos).
-  // Se teu backend mudou para status de candidatura (submetida/em_analise/aprovada/matriculado),
-  // você só troca a lista abaixo + o "default".
-  const [status, setStatus] = useState<"pendente" | "ativo" | "inativo" | "arquivado" | "todos">("pendente");
-
-  // Paging/cursor
-  const [page, setPage] = useState(1);
-  const pageSize = 20;
-
-  // Data
-  const [items, setItems] = useState<Aluno[]>([]);
-  const [total, setTotal] = useState(0);
-  const [hasMore, setHasMore] = useState(false);
-  const pageCursors = useRef<Array<Cursor | null>>([null]);
-
-  // UI state
-  const [loading, setLoading] = useState(true);
-  const [error, setError] = useState<string | null>(null);
-  const [offlineMeta, setOfflineMeta] = useState<OfflineMeta>({
-    fromCache: false,
-    updatedAt: null,
-  });
-
-  // Delete modal
-  const [showDeleteModal, setShowDeleteModal] = useState(false);
-  const [deleteReason, setDeleteReason] = useState("");
-  const [deleting, setDeleting] = useState(false);
-  const [alunoSelecionado, setAlunoSelecionado] = useState<Aluno | null>(null);
-
-  const scrollParentRef = useRef<HTMLDivElement | null>(null);
-
-  const rowVirtualizer = useVirtualizer({
-    count: items.length,
-    getScrollElement: () => scrollParentRef.current,
-    estimateSize: () => 76,
-    overscan: 6,
-  });
-
-  const hasRows = !loading && items.length > 0;
-
-  const load = useCallback(
-    async (p: number) => {
-      setLoading(true);
-      setError(null);
-
-      try {
-        const cursor = pageCursors.current[p - 1] ?? null;
-
-        const params = new URLSearchParams({
-          q: debouncedQ,
-          status,
-          pageSize: String(pageSize),
-        });
-
-        if (cursor) {
-          params.set("cursor_created_at", cursor.created_at);
-          params.set("cursor_id", cursor.id);
-        } else {
-          params.set("page", String(p));
-        }
-
-        const cacheKey = `secretaria:alunos:${params.toString()}`;
-        const { data: json, fromCache, updatedAt } = await fetchJsonWithOffline<ApiResponse>(
-          `/api/secretaria/alunos?${params.toString()}`,
-          undefined,
-          cacheKey
-        );
-
-        if (!json?.ok) throw new Error(json?.error || "Falha ao carregar.");
-
-        setItems(json.items || []);
-        setTotal(json.total ?? json.items?.length ?? 0);
-        setOfflineMeta({ fromCache, updatedAt });
-
-        const more = Boolean(json.page?.hasMore);
-        setHasMore(more);
-
-        const nextCursor = json.page?.nextCursor ?? null;
-        pageCursors.current[p] = nextCursor;
-      } catch (e: any) {
-        setError(e.message || "Erro inesperado.");
-        setItems([]);
-        setTotal(0);
-        setHasMore(false);
-        setOfflineMeta({ fromCache: false, updatedAt: null });
-      } finally {
-        setLoading(false);
-      }
-    },
-    [debouncedQ, pageSize, status]
-  );
-
-  // Reload triggers
-  useEffect(() => {
-    setPage(1);
-    pageCursors.current = [null];
-    load(1);
-  }, [debouncedQ, status, load]);
-
-  useEffect(() => {
-    if (page !== 1) {
-      load(page);
-    }
-  }, [page, load]);
-
-  // Actions
-  const handleOpenDelete = (aluno: Aluno) => {
-    setAlunoSelecionado(aluno);
-    setDeleteReason("");
-    setShowDeleteModal(true);
-  };
-
-  const handleConfirmDelete = async () => {
-    if (!alunoSelecionado) return;
-    const reason = deleteReason.trim();
-    if (!reason) {
-      alert("Motivo obrigatório.");
-      return;
-    }
-
-    setDeleting(true);
-    try {
-      const json = await fetchJson<{ ok: boolean; error?: string }>(
-        `/api/secretaria/alunos/${alunoSelecionado.id}/delete`,
-        {
-          method: "DELETE",
-          headers: { "Content-Type": "application/json" },
-          body: JSON.stringify({ reason }),
-        }
-      );
-
-      if (!json.ok) throw new Error(json.error || "Falha ao arquivar.");
-
-      await load(1);
-      setShowDeleteModal(false);
-    } catch (e: any) {
-      alert(e.message || "Erro ao arquivar.");
-    } finally {
-      setDeleting(false);
-    }
-  };
-
-  // Derived stats (só na página atual; se quiser global, precisa endpoint)
-  const stats = useMemo(() => {
-    const pendentes = items.filter((a) => (a.status || "").toLowerCase() === "pendente").length;
-    const ativos = items.filter((a) => (a.status || "").toLowerCase() === "ativo").length;
-    const comEmail = items.filter((a) => !!a.email).length;
-    const comResp = items.filter((a) => !!a.responsavel).length;
-    return { pendentes, ativos, comEmail, comResp };
-  }, [items]);
-
-  // Filter options
-  const statusOptions: Array<{ label: string; value: typeof status }> = [
-    { label: "Leads (pendente)", value: "pendente" },
-    { label: "Matriculados (ativo)", value: "ativo" },
-    { label: "Inativos", value: "inativo" },
-    { label: "Arquivados", value: "arquivado" },
-    { label: "Todos", value: "todos" },
-  ];
-
-  return (
-    <div className="w-full max-w-7xl mx-auto p-6 space-y-6 pb-20">
-      {/* Header */}
-      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
-        <div className="min-w-0">
-          <button
-            onClick={() => router.back()}
-            className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors mb-2"
-          >
-            <ArrowLeft size={16} className="text-slate-400" />
-            Voltar
-          </button>
-
-          <h1 className="text-2xl font-black text-klasse-green tracking-tight">Gestão de Alunos</h1>
-          <p className="text-sm text-slate-600 mt-1">
-            Leads (candidaturas) podem aparecer como <span className="font-semibold">pendentes</span> até a conversão para matrícula.
-          </p>
-        </div>
-
-        <Link
-          href="/secretaria/admissoes/nova"
-          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-klasse-gold text-white hover:brightness-95 shadow-sm"
-        >
-          <Plus size={16} />
-          Nova Admissão
-        </Link>
-      </div>
-
-      <OfflineBanner fromCache={offlineMeta.fromCache} updatedAt={offlineMeta.updatedAt} />
-
-      {/* Error */}
-      {error ? (
-        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-700">
-          <div className="font-bold">Erro ao carregar</div>
-          <div className="mt-1">{error}</div>
-          <button
-            onClick={() => load(1)}
-            className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-white border border-rose-200 text-rose-700 hover:bg-rose-50"
-          >
-            Tentar novamente
-          </button>
-        </div>
-      ) : null}
-
-      {/* KPIs */}
-      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
-        <KpiCard title="Total (página)" value={total} icon={Users} />
-        <KpiCard title="Leads pendentes" value={stats.pendentes} icon={Filter} />
-        <KpiCard title="Ativos" value={stats.ativos} icon={Shield} />
-        <KpiCard title="Com responsável" value={stats.comResp} icon={Users} />
-      </div>
-
-      {/* Table card */}
-      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
-        {/* Toolbar */}
-        <div className="p-5 border-b border-slate-200 bg-slate-50">
-          <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
-            <div className="relative w-full lg:max-w-md">
-              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
-              <input
-                value={q}
-                onChange={(e) => setQ(e.target.value)}
-                placeholder="Buscar por nome, responsável, processo ou login…"
-                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none
-                           focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold"
-              />
-            </div>
-
-            <div className="flex gap-2 w-full lg:w-auto overflow-x-auto">
-              {statusOptions.map((s) => {
-                const active = status === s.value;
-                return (
-                  <button
-                    key={s.value}
-                    onClick={() => setStatus(s.value)}
-                    className={[
-                      "whitespace-nowrap px-4 py-2 rounded-xl text-sm font-bold border transition-all",
-                      active
-                        ? "bg-white border-klasse-gold text-klasse-gold ring-1 ring-klasse-gold/25"
-                        : "bg-white border-slate-200 text-slate-600 hover:text-slate-800",
-                    ].join(" ")}
-                  >
-                    {s.label}
-                  </button>
-                );
-              })}
-            </div>
-          </div>
-        </div>
-
-        {/* Table */}
-        <div className="overflow-x-auto">
-          <div ref={scrollParentRef} className="max-h-[560px] overflow-y-auto">
-            <table className="min-w-full table-fixed divide-y divide-slate-200">
-              <thead className="bg-white sticky top-0 z-10" style={{ display: "table", width: "100%", tableLayout: "fixed" }}>
-                <tr>
-                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Aluno</th>
-                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Contato</th>
-                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Responsável</th>
-                  <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
-                  <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Ações</th>
-                </tr>
-              </thead>
-
-              <tbody
-                className="bg-white divide-y divide-slate-100"
-                style={
-                  hasRows
-                    ? { position: "relative", display: "block", height: rowVirtualizer.getTotalSize() }
-                    : undefined
-                }
-              >
-                {loading ? (
-                  <tr style={{ display: "table", width: "100%", tableLayout: "fixed" }}>
-                    <td colSpan={5} className="p-12 text-center text-slate-600">
-                      <div className="space-y-2">
-                        <Skeleton className="h-4 w-40 mx-auto" />
-                        <Skeleton className="h-3 w-56 mx-auto" />
-                      </div>
-                    </td>
-                  </tr>
-                ) : items.length === 0 ? (
-                  <tr style={{ display: "table", width: "100%", tableLayout: "fixed" }}>
-                    <td colSpan={5}>
-                      <EmptyState
-                        title="Nenhum registro encontrado."
-                        subtitle="Tente outro termo de busca ou ajuste o filtro."
-                      />
-                    </td>
-                  </tr>
-                ) : (
-                  rowVirtualizer.getVirtualItems().map((virtualRow) => {
-                    const aluno = items[virtualRow.index];
-
-                    const isLead = aluno.origem === "candidatura";
-                    const identificador =
-                      aluno.numero_processo || aluno.numero_login || "—";
-                    const identificadorLabel = aluno.numero_processo
-                      ? "Proc."
-                      : aluno.numero_login
-                        ? "Login"
-                        : "—";
-
-                    const matriculaHref =
-                      isLead && aluno.candidatura_id
-                        ? `/secretaria/admissoes/nova?candidaturaId=${aluno.candidatura_id}`
-                        : !isLead
-                          ? `/secretaria/admissoes/nova?alunoId=${aluno.id}`
-                          : null;
-
-                    const initials = (aluno.nome || "—")
-                      .trim()
-                      .split(/\s+/)
-                      .slice(0, 2)
-                      .map((p) => p[0]?.toUpperCase())
-                      .join("")
-                      .slice(0, 2);
-
-                    return (
-                      <tr
-                        key={aluno.id}
-                        className="hover:bg-slate-50 transition-colors group"
-                        style={{
-                          position: "absolute",
-                          top: 0,
-                          left: 0,
-                          transform: `translateY(${virtualRow.start}px)`,
-                          width: "100%",
-                          display: "table",
-                          tableLayout: "fixed",
-                        }}
-                      >
-                        <td className="px-6 py-4">
-                          <div className="flex items-center gap-3 min-w-0">
-                            <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center">
-                              <span className="text-xs font-black text-slate-600">{initials || "—"}</span>
-                            </div>
-
-                            <div className="min-w-0">
-                              <p className="font-bold text-sm text-slate-950 truncate">{aluno.nome}</p>
-
-                              <p className="text-xs text-slate-500 font-mono mt-0.5">
-                                {identificadorLabel !== "—" ? `${identificadorLabel}: ${identificador}` : "—"}
-                              </p>
-
-                              {isLead ? (
-                                <span className="inline-flex mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-amber-50 text-amber-800 border-amber-200 uppercase">
-                                  Lead
-                                </span>
-                              ) : null}
-                            </div>
-                          </div>
-                        </td>
-
-                        <td className="px-6 py-4 text-sm text-slate-700">
-                          {aluno.email ? (
-                            <div className="flex items-center gap-2">
-                              <Mail className="w-4 h-4 text-slate-400" />
-                              <span className="truncate">{aluno.email}</span>
-                            </div>
-                          ) : (
-                            <span className="text-slate-300 text-sm">—</span>
-                          )}
-                        </td>
-
-                        <td className="px-6 py-4 text-sm text-slate-700">
-                          {aluno.responsavel ? (
-                            <div className="min-w-0">
-                              <p className="font-semibold truncate">{aluno.responsavel}</p>
-                              {aluno.telefone_responsavel ? (
-                                <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
-                                  <Phone className="w-4 h-4 text-slate-400" />
-                                  {aluno.telefone_responsavel}
-                                </p>
-                              ) : null}
-                            </div>
-                          ) : (
-                            <span className="text-slate-300 text-sm">—</span>
-                          )}
-                        </td>
-
-                        <td className="px-6 py-4 text-center">
-                          <StatusBadge status={aluno.status} />
-                        </td>
-
-                        <td className="px-6 py-4 text-right">
-                          <div className="flex justify-end gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
-                            {/* Matricular (se não ativo ainda) */}
-                            {matriculaHref && (aluno.status || "").toLowerCase() !== "ativo" ? (
-                              <Link
-                                href={matriculaHref}
-                                className="p-2 rounded-xl text-slate-400 hover:text-klasse-gold hover:bg-amber-50 transition"
-                                title="Abrir matrícula"
-                              >
-                                <Plus className="w-4 h-4" />
-                              </Link>
-                            ) : null}
-
-                            {/* Ações só para aluno (não lead) */}
-                            {!isLead ? (
-                              <>
-                                <Link
-                                  href={`/secretaria/alunos/${aluno.id}`}
-                                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
-                                  title="Ver"
-                                >
-                                  <Eye className="w-4 h-4" />
-                                </Link>
-
-                                <Link
-                                  href={`/secretaria/alunos/${aluno.id}/editar`}
-                                  className="p-2 rounded-xl text-slate-400 hover:text-klasse-gold hover:bg-amber-50 transition"
-                                  title="Editar"
-                                >
-                                  <Pencil className="w-4 h-4" />
-                                </Link>
-
-                                <button
-                                  onClick={() => handleOpenDelete(aluno)}
-                                  className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
-                                  title="Arquivar"
-                                >
-                                  <Trash2 className="w-4 h-4" />
-                                </button>
-                              </>
-                            ) : null}
-                          </div>
-                        </td>
-                      </tr>
-                    );
-                  })
-                )}
-              </tbody>
-            </table>
-          </div>
-        </div>
-
-        {/* Pagination */}
-        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between text-sm text-slate-600">
-          <span className="font-semibold">Página {page}</span>
-          <div className="flex gap-2">
-            <button
-              disabled={page <= 1}
-              onClick={() => setPage((p) => p - 1)}
-              className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold disabled:opacity-50"
-            >
-              Anterior
-            </button>
-            <button
-              disabled={!hasMore}
-              onClick={() => setPage((p) => p + 1)}
-              className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold disabled:opacity-50"
-            >
-              Próximo
-            </button>
-          </div>
-        </div>
-      </div>
-
-      {/* Delete / Archive modal */}
-      {showDeleteModal ? (
-        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
-          <div className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-md p-6">
-            <h3 className="text-lg font-black text-slate-950">Arquivar aluno</h3>
-            <p className="text-sm text-slate-600 mt-2">
-              Confirma arquivar <span className="font-bold">{alunoSelecionado?.nome}</span>? Isso não apaga histórico financeiro.
-            </p>
-
-            <div className="mt-4">
-              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
-                Motivo (obrigatório)
-              </label>
-              <textarea
-                value={deleteReason}
-                onChange={(e) => setDeleteReason(e.target.value)}
-                placeholder="Ex.: desistiu / transferência / duplicado…"
-                rows={3}
-                className="mt-2 w-full p-3 border border-slate-200 rounded-xl text-sm outline-none
-                           focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold"
-              />
-            </div>
-
-            <div className="mt-6 flex justify-end gap-3">
-              <button
-                onClick={() => setShowDeleteModal(false)}
-                className="px-4 py-2 rounded-xl text-sm font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50"
-              >
-                Cancelar
-              </button>
-
-              <button
-                onClick={handleConfirmDelete}
-                disabled={deleting}
-                className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-red-600 hover:brightness-95 disabled:opacity-60"
-              >
-                {deleting ? "Arquivando…" : "Confirmar"}
-              </button>
-            </div>
-          </div>
-        </div>
-      ) : null}
-    </div>
-  );
-}
diff --git a/apps/web/src/components/secretaria/ModalPagamentoRapido.tsx b/apps/web/src/components/secretaria/ModalPagamentoRapido.tsx
index d6576e64..c80407ae 100644
--- a/apps/web/src/components/secretaria/ModalPagamentoRapido.tsx
+++ b/apps/web/src/components/secretaria/ModalPagamentoRapido.tsx
@@ -1,162 +1,146 @@
 "use client";
 
-import { useEffect, useMemo, useRef, useState, useCallback } from "react";
+import { useCallback, useEffect, useMemo, useRef, useState } from "react";
 import {
-  X,
-  CreditCard,
-  Wallet,
-  Banknote,
-  Calculator,
-  CheckCircle,
-  Smartphone,
-  Loader2,
+  Banknote, Calculator, CheckCircle, CreditCard,
+  Loader2, Smartphone, Wallet, X,
 } from "lucide-react";
 import { Button } from "@/components/ui/Button";
 import { ReciboImprimivel } from "@/components/financeiro/ReciboImprimivel";
 import { usePlanFeature } from "@/hooks/usePlanFeature";
 import { useToast } from "@/components/feedback/FeedbackSystem";
 
+// ─── Tokens ──────────────────────────────────────────────────────────────────
+// Fonte de verdade: nunca usar cores avulsas fora deste mapa.
+const T = {
+  green:      "#1F6B3B",
+  green_ring: "ring-[#1F6B3B]/20",
+  gold:       "#E3B23C",
+  gold_ring:  "ring-[#E3B23C]/20",
+  rose:       "text-rose-600",
+  rose_bg:    "bg-rose-50",
+  rose_border:"border-rose-200",
+} as const;
+
+// ─── Tipos ────────────────────────────────────────────────────────────────────
+
 type MetodoPagamento = "cash" | "tpa" | "transfer" | "mcx" | "kiwk";
 
-interface ModalPagamentoRapidoProps {
-  escolaId?: string | null;
+type MetodoDetalhes = {
+  referencia:    string;
+  evidencia_url: string;
+  gateway_ref:   string;
+};
+
+type ReciboState = { url_validacao: string | null } | null;
+
+export interface ModalPagamentoRapidoProps {
+  escolaId?:    string | null;
   aluno: {
-    id: string;
-    nome: string;
+    id:    string;
+    nome:  string;
     turma?: string;
-    bi?: string;
+    bi?:    string;
   };
   mensalidade: {
-    id: string;
-    mes: number;
-    ano: number;
-    valor: number;
+    id:          string;
+    mes:         number;
+    ano:         number;
+    valor:       number;
     vencimento?: string;
-    status: string;
+    status:      string;
   } | null;
-  open: boolean;
-  onClose: () => void;
+  open:       boolean;
+  onClose:    () => void;
   onSuccess?: () => void;
 }
 
-const MESES = [
-  "Jan",
-  "Fev",
-  "Mar",
-  "Abr",
-  "Mai",
-  "Jun",
-  "Jul",
-  "Ago",
-  "Set",
-  "Out",
-  "Nov",
-  "Dez",
+// ─── Constantes ───────────────────────────────────────────────────────────────
+
+const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun",
+               "Jul","Ago","Set","Out","Nov","Dez"] as const;
+
+const METODOS_CONFIG = [
+  { id: "cash"     as const, label: "Cash",       helper: "Balcão",       icon: Banknote   },
+  { id: "tpa"      as const, label: "TPA",        helper: "Cartão",       icon: CreditCard },
+  { id: "transfer" as const, label: "Transferência", helper: "Comprovativo", icon: Wallet  },
+  { id: "mcx"      as const, label: "Multicaixa", helper: "MCX",          icon: Smartphone },
+  { id: "kiwk"     as const, label: "KIWK",       helper: "Instantâneo",  icon: Smartphone },
 ] as const;
 
-const cx = (...classes: Array<string | false | null | undefined>) =>
-  classes.filter(Boolean).join(" ");
+const DETALHES_VAZIOS: MetodoDetalhes = {
+  referencia: "", evidencia_url: "", gateway_ref: "",
+};
+
+// ─── Formatters ───────────────────────────────────────────────────────────────
 
 const moneyAOA = new Intl.NumberFormat("pt-AO", {
-  style: "currency",
-  currency: "AOA",
-  minimumFractionDigits: 2,
+  style: "currency", currency: "AOA", minimumFractionDigits: 2,
 });
 
-
-function clampMonth(m?: number) {
-  if (!m) return null;
-  if (m < 1 || m > 12) return null;
-  return m;
-}
-
-function safeNumber(input: string) {
-  // aceita "123", "123.45", "123,45" sem quebrar UX
-  const normalized = input.replace(",", ".");
-  const n = Number(normalized);
+function safeNumber(input: string): number {
+  const n = Number(input.replace(",", "."));
   return Number.isFinite(n) ? n : 0;
 }
 
-function formatStatusLabel(status?: string | null) {
-  const s = (status ?? "").toLowerCase();
-  if (s === "pendente") return "Pendente";
-  if (s === "pago_parcial") return "Parcial";
-  if (s === "pago") return "Pago";
-  if (s === "em_atraso" || s === "atraso") return "Em atraso";
-  return status ?? "—";
+function mesAnoLabel(mes?: number | null, ano?: number | null): string {
+  if (!mes || mes < 1 || mes > 12 || !ano) return "Mensalidade";
+  return `${MESES[mes - 1]}/${ano}`;
 }
 
-function badgeTone(status?: string | null) {
+function statusConfig(status?: string | null) {
   const s = (status ?? "").toLowerCase();
-  if (s === "pago") return "ok";
-  if (s === "pendente" || s === "pago_parcial") return "warn";
-  return "danger";
+  if (s === "pago")
+    return { label: "Pago",      cls: "bg-[#1F6B3B]/10 text-[#1F6B3B] border-[#1F6B3B]/20" };
+  if (s === "pago_parcial")
+    return { label: "Parcial",   cls: "bg-[#E3B23C]/10 text-[#9a7010] border-[#E3B23C]/20" };
+  if (s === "pendente")
+    return { label: "Pendente",  cls: "bg-[#E3B23C]/10 text-[#9a7010] border-[#E3B23C]/20" };
+  if (s === "em_atraso" || s === "atraso")
+    return { label: "Em atraso", cls: "bg-rose-50 text-rose-700 border-rose-200" };
+  return { label: status ?? "—", cls: "bg-slate-100 text-slate-600 border-slate-200" };
 }
 
-type MetodoItem = {
-  id: MetodoPagamento;
-  label: string;
-  helper: string;
-  icon: React.ComponentType<{ className?: string }>;
-};
-
-const METODOS: MetodoItem[] = [
-  { id: "cash", label: "Cash", helper: "Balcão", icon: Banknote },
-  { id: "tpa", label: "TPA", helper: "Cartão", icon: CreditCard },
-  { id: "transfer", label: "Transfer", helper: "Comprovativo", icon: Wallet },
-  { id: "mcx", label: "MCX", helper: "Multicaixa", icon: Smartphone },
-  { id: "kiwk", label: "KIWK", helper: "Instantâneo", icon: Smartphone },
-];
+// ─── Sub-componentes ──────────────────────────────────────────────────────────
 
-function SegmentedMethod({
+function MetodoGrid({
   value,
   onChange,
   disabled,
 }: {
-  value: MetodoPagamento;
+  value:    MetodoPagamento;
   onChange: (v: MetodoPagamento) => void;
   disabled?: boolean;
 }) {
   return (
     <div className="grid grid-cols-2 gap-2">
-      {METODOS.map((m) => {
-        const Icon = m.icon;
-        const active = value === m.id;
-
+      {METODOS_CONFIG.map(({ id, label, helper, icon: Icon }) => {
+        const active = value === id;
         return (
           <button
-            key={m.id}
+            key={id}
             type="button"
-            onClick={() => onChange(m.id)}
+            onClick={() => onChange(id)}
             disabled={disabled}
-            className={cx(
-              "group rounded-xl border px-3 py-3 text-left transition",
-              "bg-white hover:bg-slate-50",
-              "disabled:opacity-60 disabled:cursor-not-allowed",
+            className={[
+              "flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition-all",
+              "disabled:opacity-50 disabled:cursor-not-allowed",
               active
-                ? "border-klasse-gold ring-4 ring-klasse-gold/10"
-                : "border-slate-200"
-            )}
+                ? "border-[#E3B23C] ring-4 ring-[#E3B23C]/10 bg-white"
+                : "border-slate-200 bg-white hover:bg-slate-50",
+            ].join(" ")}
           >
-            <div className="flex items-start gap-3">
-              <div
-                className={cx(
-                  "h-10 w-10 rounded-xl border flex items-center justify-center shrink-0",
-                  active ? "border-klasse-gold/30 bg-klasse-gold/10" : "border-slate-200 bg-slate-100"
-                )}
-              >
-                <Icon
-                  className={cx(
-                    "h-5 w-5",
-                    active ? "text-klasse-gold" : "text-slate-600"
-                  )}
-                />
-              </div>
-
-              <div className="min-w-0">
-                <div className="text-sm font-semibold text-slate-900">{m.label}</div>
-                <div className="text-[11px] text-slate-500">{m.helper}</div>
-              </div>
+            <div className={[
+              "h-9 w-9 rounded-xl border flex items-center justify-center flex-shrink-0",
+              active
+                ? "border-[#E3B23C]/30 bg-[#E3B23C]/10"
+                : "border-slate-200 bg-slate-100",
+            ].join(" ")}>
+              <Icon className={`h-4 w-4 ${active ? "text-[#E3B23C]" : "text-slate-500"}`} />
+            </div>
+            <div>
+              <p className="text-sm font-bold text-slate-900">{label}</p>
+              <p className="text-[11px] text-slate-400">{helper}</p>
             </div>
           </button>
         );
@@ -165,222 +149,320 @@ function SegmentedMethod({
   );
 }
 
-function KpiRow({
-  label,
-  value,
-  strong,
+function DetalhesMetodo({
+  metodo,
+  detalhes,
+  onChange,
+  disabled,
 }: {
-  label: string;
-  value: string;
-  strong?: boolean;
+  metodo:   MetodoPagamento;
+  detalhes: MetodoDetalhes;
+  onChange: (d: Partial<MetodoDetalhes>) => void;
+  disabled?: boolean;
 }) {
+  if (metodo === "cash") return null;
+
+  const inputCls = [
+    "w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold",
+    "text-slate-900 outline-none transition-all",
+    "focus:border-[#E3B23C] focus:ring-4 focus:ring-[#E3B23C]/20",
+    disabled ? "opacity-50 cursor-not-allowed" : "",
+  ].join(" ");
+
   return (
-    <div className="flex items-center justify-between gap-4">
-      <span className="text-slate-600">{label}</span>
-      <span className={cx("text-right", strong ? "font-black text-slate-900" : "font-semibold text-slate-900")}>
-        {value}
-      </span>
+    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
+      {/* Referência — obrigatória para TPA, opcional para outros */}
+      {(metodo === "tpa" || metodo === "mcx" || metodo === "kiwk") && (
+        <div>
+          <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
+            Referência {metodo === "tpa" ? <span className="text-rose-500">*</span> : "(opcional)"}
+          </label>
+          <input
+            value={detalhes.referencia}
+            onChange={e => onChange({ referencia: e.target.value })}
+            disabled={disabled}
+            placeholder={metodo === "tpa" ? "TPA-2026-000882" : "Opcional"}
+            className={inputCls}
+          />
+        </div>
+      )}
+
+      {/* Gateway ref — MCX e KIWK */}
+      {(metodo === "mcx" || metodo === "kiwk") && (
+        <div>
+          <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
+            Ref. gateway (opcional)
+          </label>
+          <input
+            value={detalhes.gateway_ref}
+            onChange={e => onChange({ gateway_ref: e.target.value })}
+            disabled={disabled}
+            placeholder={metodo === "kiwk" ? "KIWK-ref" : "Gateway ref"}
+            className={inputCls}
+          />
+        </div>
+      )}
+
+      {/* Comprovativo — transferência */}
+      {metodo === "transfer" && (
+        <div>
+          <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
+            URL do comprovativo <span className="text-rose-500">*</span>
+          </label>
+          <input
+            value={detalhes.evidencia_url}
+            onChange={e => onChange({ evidencia_url: e.target.value })}
+            disabled={disabled}
+            placeholder="https://..."
+            className={inputCls}
+          />
+        </div>
+      )}
     </div>
   );
 }
 
-export function ModalPagamentoRapido({
-  escolaId,
-  aluno,
-  mensalidade,
-  open,
-  onClose,
-  onSuccess,
-}: ModalPagamentoRapidoProps) {
-  const [metodo, setMetodo] = useState<MetodoPagamento>("cash");
-  const [valorPago, setValorPago] = useState<string>("");
-  const [processando, setProcessando] = useState(false);
-  const [concluido, setConcluido] = useState(false);
-  const [paymentReference, setPaymentReference] = useState("");
-  const [paymentEvidenceUrl, setPaymentEvidenceUrl] = useState("");
-  const { success, error } = useToast();
-  const [paymentGatewayRef, setPaymentGatewayRef] = useState("");
-  const [recibo, setRecibo] = useState<{ url_validacao: string | null } | null>(null);
-  const [printRequested, setPrintRequested] = useState(false);
-  const [escolaNome, setEscolaNome] = useState<string | null>(null);
-  const { isEnabled: canEmitirRecibo } = usePlanFeature("fin_recibo_pdf");
-
-  const abortRef = useRef<AbortController | null>(null);
-  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);
-
-  const valorDevido = mensalidade?.valor ?? 0;
-  const mensalidadeId = mensalidade?.id ?? null;
-  const mensalidadeMes = mensalidade?.mes ?? null;
-  const mensalidadeAno = mensalidade?.ano ?? null;
-  const mensalidadeValor = mensalidade?.valor ?? null;
-
-  const mesAno = useMemo(() => {
-    const m = clampMonth(mensalidadeMes ?? undefined);
-    if (!mensalidadeId || !m || !mensalidadeAno) return "Mensalidade";
-    return `${MESES[m - 1]}/${mensalidadeAno}`;
-  }, [mensalidadeId, mensalidadeMes, mensalidadeAno]);
-
-  const valorPagoNum = useMemo(() => safeNumber(valorPago), [valorPago]);
-
-  const troco = useMemo(() => valorPagoNum - valorDevido, [valorPagoNum, valorDevido]);
-  const trocoValido = useMemo(() => Number.isFinite(troco) && troco >= 0, [troco]);
-  const mostraTroco = useMemo(() => metodo === "cash" && valorPagoNum > 0, [metodo, valorPagoNum]);
-
-  const sugestoes = useMemo(() => {
-    if (metodo !== "cash" || valorDevido <= 0) return [];
-    const s = [
-      valorDevido,
-      Math.ceil(valorDevido / 100) * 100,
-      Math.ceil(valorDevido / 500) * 500,
-    ];
-    return Array.from(new Set(s)).sort((a, b) => a - b);
-  }, [metodo, valorDevido]);
-
-  // reset ao abrir (apenas quando mensalidade muda de verdade)
-  useEffect(() => {
-    if (!open) return;
+function ValorInput({
+  valor,
+  onChange,
+  sugestoes,
+  disabled,
+}: {
+  valor:     string;
+  onChange:  (v: string) => void;
+  sugestoes: number[];
+  disabled?: boolean;
+}) {
+  return (
+    <div className="space-y-2">
+      <label className="block text-sm font-bold text-slate-900">
+        Valor recebido
+      </label>
+      <div className="relative">
+        <input
+          type="text"
+          inputMode="decimal"
+          value={valor}
+          onChange={e => onChange(e.target.value)}
+          placeholder="0,00"
+          disabled={disabled}
+          aria-label="Valor recebido em AOA"
+          className={[
+            "w-full rounded-2xl border border-slate-200 bg-white",
+            "px-4 py-3 pr-16 text-xl font-black text-slate-900 outline-none transition-all",
+            "focus:border-[#E3B23C] focus:ring-4 focus:ring-[#E3B23C]/20",
+            disabled ? "opacity-50 cursor-not-allowed" : "",
+          ].join(" ")}
+        />
+        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
+          AOA
+        </span>
+      </div>
 
-    setConcluido(false);
-    setProcessando(false);
-    setMetodo("cash");
-    setValorPago(mensalidadeValor != null ? String(mensalidadeValor) : "");
-    setPaymentReference("");
-    setRecibo(null);
-    setPrintRequested(false);
+      {sugestoes.length > 0 && (
+        <div className="flex flex-wrap gap-2 pt-1">
+          {sugestoes.map(v => (
+            <button
+              key={v}
+              type="button"
+              onClick={() => onChange(String(v))}
+              disabled={disabled}
+              className="rounded-full border border-slate-200 bg-white px-3 py-1.5
+                text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:border-slate-300
+                transition-colors disabled:opacity-50"
+            >
+              {moneyAOA.format(v)}
+            </button>
+          ))}
+        </div>
+      )}
+    </div>
+  );
+}
 
-    // foco: botão confirmar (fluxo balcão é teclado-friendly)
-    window.setTimeout(() => confirmBtnRef.current?.focus(), 50);
-  }, [open, mensalidadeId, mensalidadeValor]);
+function TrocoCard({ troco, valido }: { troco: number; valido: boolean }) {
+  return (
+    <div className={[
+      "flex items-center justify-between rounded-2xl border p-4",
+      valido ? "border-slate-200 bg-white" : "border-rose-200 bg-rose-50",
+    ].join(" ")}>
+      <div className="flex items-center gap-3">
+        <div className="h-9 w-9 rounded-xl bg-slate-100 border border-slate-200
+          flex items-center justify-center">
+          <Calculator className="h-4 w-4 text-slate-500" />
+        </div>
+        <div>
+          <p className="text-sm font-bold text-slate-900">Troco</p>
+          <p className="text-[11px] text-slate-400">A devolver no balcão</p>
+        </div>
+      </div>
+      <div className="text-right">
+        <p className="text-[10px] text-slate-400 mb-0.5">Valor</p>
+        <p className={`text-xl font-black ${valido ? "text-slate-900" : "text-rose-600"}`}>
+          {moneyAOA.format(troco)}
+        </p>
+      </div>
+    </div>
+  );
+}
 
-  useEffect(() => {
-    if (!open || !escolaId) return;
-    fetch(`/api/escolas/${escolaId}/nome`, { cache: "no-store" })
-      .then((res) => res.json())
-      .then((json) => {
-        if (json?.ok && json?.nome) setEscolaNome(json.nome);
-      })
-      .catch(() => {});
-  }, [escolaId, open]);
+function ResumoCard({
+  valorDevido,
+  valorPago,
+  troco,
+  trocoValido,
+}: {
+  valorDevido: number;
+  valorPago:   number;
+  troco:       number;
+  trocoValido: boolean;
+}) {
+  return (
+    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
+      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
+        Resumo
+      </p>
+      <div className="space-y-2 text-sm">
+        {[
+          { label: "Valor da mensalidade", value: moneyAOA.format(valorDevido) },
+          { label: "Valor recebido",        value: moneyAOA.format(valorPago) },
+        ].map(({ label, value }) => (
+          <div key={label} className="flex items-center justify-between">
+            <span className="text-slate-500">{label}</span>
+            <span className="font-semibold text-slate-900">{value}</span>
+          </div>
+        ))}
+        <div className="border-t border-slate-200 pt-2 flex items-center justify-between">
+          <span className="font-bold text-slate-900">Troco</span>
+          <span className="font-black text-slate-900">{moneyAOA.format(troco)}</span>
+        </div>
+      </div>
 
-  useEffect(() => {
-    if (!printRequested || !recibo) return;
-    const id = window.setTimeout(() => {
-      window.print();
-      setPrintRequested(false);
-    }, 300);
-    return () => window.clearTimeout(id);
-  }, [printRequested, recibo]);
+      {!trocoValido && (
+        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2
+          text-xs text-rose-700 font-medium">
+          O valor recebido deve ser igual ou superior ao valor da mensalidade.
+        </div>
+      )}
+    </div>
+  );
+}
 
-  useEffect(() => {
-    if (metodo === "cash") {
-      setPaymentReference("");
-      setPaymentEvidenceUrl("");
-      setPaymentGatewayRef("");
-      return;
-    }
-    if (metodo === "transfer") {
-      setPaymentReference("");
-      setPaymentGatewayRef("");
-      return;
-    }
-    if (metodo === "tpa") {
-      setPaymentEvidenceUrl("");
-      setPaymentGatewayRef("");
-      return;
-    }
-    setPaymentEvidenceUrl("");
-  }, [metodo]);
+function EstadoConcluido() {
+  return (
+    <div className="py-10 text-center space-y-4">
+      <div className="mx-auto inline-flex h-16 w-16 items-center justify-center
+        rounded-full bg-[#1F6B3B]/10 ring-1 ring-[#1F6B3B]/20">
+        <CheckCircle className="h-8 w-8 text-[#1F6B3B]" />
+      </div>
+      <div>
+        <h3 className="text-xl font-black text-slate-900">Pagamento registado</h3>
+        <p className="mt-1 text-sm text-slate-500">
+          Recibo emitido automaticamente.
+        </p>
+      </div>
+      <p className="text-xs text-slate-400">A fechar automaticamente…</p>
+    </div>
+  );
+}
 
-  useEffect(() => {
-    return () => abortRef.current?.abort();
-  }, []);
+// ─── Hook: lógica de submissão ────────────────────────────────────────────────
 
-  const safeClose = useCallback(() => {
-    abortRef.current?.abort();
-    abortRef.current = null;
-    onClose();
-  }, [onClose]);
+function usePagamentoSubmit({
+  aluno,
+  mensalidade,
+  metodo,
+  detalhes,
+  valorPagoNum,
+  mesAno,
+  trocoValido,
+  canEmitirRecibo,
+  onConcluido,
+  onRecibo,
+  safeClose,
+  onSuccess,
+}: {
+  aluno:          ModalPagamentoRapidoProps["aluno"];
+  mensalidade:    ModalPagamentoRapidoProps["mensalidade"];
+  metodo:         MetodoPagamento;
+  detalhes:       MetodoDetalhes;
+  valorPagoNum:   number;
+  mesAno:         string;
+  trocoValido:    boolean;
+  canEmitirRecibo: boolean;
+  onConcluido:    () => void;
+  onRecibo:       (r: ReciboState) => void;
+  safeClose:      () => void;
+  onSuccess?:     () => void;
+}) {
+  const [processando, setProcessando] = useState(false);
+  const abortRef = useRef<AbortController | null>(null);
+  const { success, error } = useToast();
 
-  const handleConfirmarPagamento = useCallback(async () => {
-    if (!mensalidade) return;
+  useEffect(() => () => abortRef.current?.abort(), []);
 
-    if (!trocoValido) {
-      error("O valor pago deve ser maior ou igual ao valor devido.");
-      return;
-    }
+  const submit = useCallback(async () => {
+    if (!mensalidade || !trocoValido || processando) return;
 
-    if (metodo === "tpa" && !paymentReference.trim()) {
-      error("Referência obrigatória para TPA.");
-      return;
+    if (metodo === "tpa" && !detalhes.referencia.trim()) {
+      error("Referência obrigatória para TPA."); return;
     }
-
-    if (metodo === "transfer" && !paymentEvidenceUrl.trim()) {
-      error("Comprovativo obrigatório para Transferência.");
-      return;
+    if (metodo === "transfer" && !detalhes.evidencia_url.trim()) {
+      error("Comprovativo obrigatório para Transferência."); return;
     }
 
-    if (processando) return;
-
     setProcessando(true);
     abortRef.current?.abort();
     abortRef.current = new AbortController();
 
     try {
-      const idempotencyKey =
-        typeof crypto !== "undefined" && "randomUUID" in crypto
-          ? crypto.randomUUID()
-          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
+      const idempotencyKey = crypto.randomUUID?.() ??
+        `${Date.now()}-${Math.random().toString(16).slice(2)}`;
 
       const res = await fetch("/api/financeiro/pagamentos/registrar", {
-        method: "POST",
+        method:  "POST",
         headers: {
-          "Content-Type": "application/json",
+          "Content-Type":    "application/json",
           "Idempotency-Key": idempotencyKey,
         },
         signal: abortRef.current.signal,
         body: JSON.stringify({
-          aluno_id: aluno.id,
+          aluno_id:       aluno.id,
           mensalidade_id: mensalidade.id,
-          valor: valorPagoNum || mensalidade.valor,
+          valor:          valorPagoNum || mensalidade.valor,
           metodo,
-          reference: paymentReference || null,
-          evidence_url: paymentEvidenceUrl || null,
+          reference:      detalhes.referencia    || null,
+          evidence_url:   detalhes.evidencia_url || null,
           meta: {
-            observacao: `Pagamento rápido - ${mesAno}`,
-            origem: "pagamento_rapido",
-            gateway_ref: paymentGatewayRef || null,
+            observacao:  `Pagamento rápido - ${mesAno}`,
+            origem:      "pagamento_rapido",
+            gateway_ref: detalhes.gateway_ref || null,
           },
         }),
       });
 
       const json = await res.json().catch(() => ({}));
-      if (!res.ok || !json?.ok) {
-        throw new Error(json?.error || "Falha ao registrar pagamento");
-      }
+      if (!res.ok || !json?.ok)
+        throw new Error(json?.error || "Falha ao registar pagamento.");
 
+      // Recibo (guard de plano)
       if (canEmitirRecibo) {
         const reciboRes = await fetch("/api/financeiro/recibos/emitir", {
-          method: "POST",
+          method:  "POST",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify({ mensalidadeId: mensalidade.id }),
         }).catch(() => null);
 
         if (reciboRes?.ok) {
-          const reciboJson = await reciboRes.json().catch(() => null);
-          if (reciboJson?.ok) {
-            setRecibo({ url_validacao: reciboJson.url_validacao ?? null });
-            setPrintRequested(true);
-          }
+          const rj = await reciboRes.json().catch(() => null);
+          if (rj?.ok) onRecibo({ url_validacao: rj.url_validacao ?? null });
         }
       }
 
-      setConcluido(true);
       success("Pagamento registado.", "Recibo disponível para impressão.");
+      onConcluido();
+      setTimeout(() => { safeClose(); onSuccess?.(); }, 1200);
 
-      window.setTimeout(() => {
-        safeClose();
-        onSuccess?.();
-      }, 1200);
     } catch (err: any) {
       if (err?.name === "AbortError") return;
       error(err instanceof Error ? err.message : "Não foi possível processar o pagamento.");
@@ -388,357 +470,301 @@ export function ModalPagamentoRapido({
       setProcessando(false);
     }
   }, [
-    aluno.id,
-    mensalidade,
-    trocoValido,
-    processando,
-    metodo,
-    mesAno,
-    valorPagoNum,
-    paymentReference,
-    paymentEvidenceUrl,
-    paymentGatewayRef,
-    safeClose,
-    onSuccess,
-    canEmitirRecibo,
+    mensalidade, trocoValido, processando, metodo, detalhes,
+    valorPagoNum, mesAno, canEmitirRecibo, aluno.id,
+    onConcluido, onRecibo, safeClose, onSuccess, success, error,
   ]);
 
-  // teclado: Enter confirma (exceto se estiver digitando no input)
+  return { processando, submit };
+}
+
+// ═════════════════════════════════════════════════════════════════════════════
+// Componente principal
+// ═════════════════════════════════════════════════════════════════════════════
+
+export function ModalPagamentoRapido({
+  escolaId,
+  aluno,
+  mensalidade,
+  open,
+  onClose,
+  onSuccess,
+}: ModalPagamentoRapidoProps) {
+  // ── Estado do formulário ─────────────────────────────────────────────────
+  const [metodo,   setMetodo]   = useState<MetodoPagamento>("cash");
+  const [detalhes, setDetalhes] = useState<MetodoDetalhes>(DETALHES_VAZIOS);
+  const [valor,    setValor]    = useState("");
+  const [concluido, setConcluido] = useState(false);
+  const [recibo,    setRecibo]    = useState<ReciboState>(null);
+  const [escolaNome, setEscolaNome] = useState<string | null>(null);
+
+  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);
+  const { isEnabled: canEmitirRecibo } = usePlanFeature("fin_recibo_pdf");
+
+  // ── Derivados ────────────────────────────────────────────────────────────
+  const valorNum   = useMemo(() => safeNumber(valor), [valor]);
+  const valorDevido = mensalidade?.valor ?? 0;
+  const troco      = valorNum - valorDevido;
+  const trocoValido = Number.isFinite(troco) && troco >= 0;
+  const mesAno     = useMemo(
+    () => mesAnoLabel(mensalidade?.mes, mensalidade?.ano),
+    [mensalidade?.mes, mensalidade?.ano]
+  );
+
+  const sugestoes = useMemo(() => {
+    if (metodo !== "cash" || valorDevido <= 0) return [];
+    return Array.from(new Set([
+      valorDevido,
+      Math.ceil(valorDevido / 100) * 100,
+      Math.ceil(valorDevido / 500) * 500,
+    ])).sort((a, b) => a - b);
+  }, [metodo, valorDevido]);
+
+  const canConfirm = !!mensalidade && trocoValido;
+
+  const safeClose = useCallback(() => { onClose(); }, [onClose]);
+
+  // ── Reset ao abrir ───────────────────────────────────────────────────────
   useEffect(() => {
     if (!open) return;
+    setConcluido(false);
+    setMetodo("cash");
+    setDetalhes(DETALHES_VAZIOS);
+    setValor(mensalidade?.valor != null ? String(mensalidade.valor) : "");
+    setRecibo(null);
+    setTimeout(() => confirmBtnRef.current?.focus(), 50);
+  }, [open, mensalidade?.id, mensalidade?.valor]);
 
-    const onKeyDown = (e: KeyboardEvent) => {
-      if (e.key === "Escape") {
-        if (!concluido && !processando) safeClose();
-      }
+  // ── Reset detalhes ao mudar método ──────────────────────────────────────
+  useEffect(() => { setDetalhes(DETALHES_VAZIOS); }, [metodo]);
+
+  // ── Buscar nome da escola ────────────────────────────────────────────────
+  useEffect(() => {
+    if (!open || !escolaId) return;
+    fetch(`/api/escolas/${escolaId}/nome`, { cache: "no-store" })
+      .then(r => r.json())
+      .then(j => { if (j?.ok && j?.nome) setEscolaNome(j.nome); })
+      .catch(() => {});
+  }, [escolaId, open]);
+
+  // ── Print pós-pagamento ──────────────────────────────────────────────────
+  useEffect(() => {
+    if (!recibo) return;
+    const t = setTimeout(() => window.print(), 300);
+    return () => clearTimeout(t);
+  }, [recibo]);
+
+  // ── Submissão ────────────────────────────────────────────────────────────
+  const { processando, submit } = usePagamentoSubmit({
+    aluno, mensalidade, metodo, detalhes, valorPagoNum: valorNum,
+    mesAno, trocoValido, canEmitirRecibo,
+    onConcluido: () => setConcluido(true),
+    onRecibo:    setRecibo,
+    safeClose, onSuccess,
+  });
+
+  // ── Teclado ──────────────────────────────────────────────────────────────
+  useEffect(() => {
+    if (!open) return;
+    const handler = (e: KeyboardEvent) => {
+      if (e.key === "Escape" && !concluido && !processando) { safeClose(); return; }
       if (e.key === "Enter") {
-        const target = e.target as HTMLElement | null;
-        const typing =
-          target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || (target as any)?.isContentEditable;
-        if (!typing) {
-          // evita double submit
-          e.preventDefault();
-          handleConfirmarPagamento();
-        }
+        const t = e.target as HTMLElement;
+        const typing = t?.tagName === "INPUT" || t?.tagName === "TEXTAREA";
+        if (!typing) { e.preventDefault(); submit(); }
       }
     };
-
-    window.addEventListener("keydown", onKeyDown);
-    return () => window.removeEventListener("keydown", onKeyDown);
-  }, [open, concluido, processando, safeClose, handleConfirmarPagamento]);
+    window.addEventListener("keydown", handler);
+    return () => window.removeEventListener("keydown", handler);
+  }, [open, concluido, processando, safeClose, submit]);
 
   if (!open) return null;
 
-  const statusTone = badgeTone(mensalidade?.status);
-  const statusLabel = formatStatusLabel(mensalidade?.status);
+  const { label: statusLabel, cls: statusCls } = statusConfig(mensalidade?.status);
   const vencimentoLabel = mensalidade?.vencimento
     ? new Date(mensalidade.vencimento).toLocaleDateString("pt-PT")
     : null;
 
-  const headerTitle = concluido ? "Pagamento concluído" : "Pagamento rápido";
-  const canConfirm = !!mensalidade && trocoValido && !processando;
-
   return (
     <>
-      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
-        <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
-        {/* Header (subtle, premium) */}
-        <div className="relative border-b border-slate-200 px-6 py-4">
-          {/* “luz” sutil no topo (sem virar carnaval) */}
-          <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-klasse-gold/60 to-transparent" />
-
-          <div className="flex items-start justify-between gap-4">
-            <div className="flex items-start gap-3 min-w-0">
-              <div className="h-11 w-11 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center">
-                {concluido ? (
-                  <CheckCircle className="h-6 w-6 text-klasse-green" />
-                ) : (
-                  <CreditCard className="h-6 w-6 text-slate-700" />
-                )}
-              </div>
-
-              <div className="min-w-0">
-                <div className="flex items-center gap-2">
-                  <h2 className="text-base font-bold text-slate-900">{headerTitle}</h2>
-                  {mensalidade ? (
-                    <span
-                      className={cx(
-                        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
-                        statusTone === "ok" && "border-klasse-green/25 bg-klasse-green/10 text-klasse-green",
-                        statusTone === "warn" && "border-klasse-gold/25 bg-klasse-gold/10 text-klasse-gold",
-                        statusTone === "danger" && "border-red-500/20 bg-red-500/10 text-red-600"
-                      )}
-                    >
-                      {statusLabel}
-                    </span>
-                  ) : null}
+      {/* Overlay + modal */}
+      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
+        <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl
+          ring-1 ring-slate-200 overflow-hidden">
+
+          {/* ── Header ──────────────────────────────────────────────────── */}
+          <div className="relative border-b border-slate-100 px-6 py-4">
+            {/* Faixa dourada topo */}
+            <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5
+              bg-gradient-to-r from-transparent via-[#E3B23C]/60 to-transparent" />
+
+            <div className="flex items-start justify-between gap-4">
+              <div className="flex items-start gap-3 min-w-0">
+                {/* Ícone */}
+                <div className="h-11 w-11 rounded-2xl bg-slate-100 border border-slate-200
+                  flex items-center justify-center flex-shrink-0">
+                  {concluido
+                    ? <CheckCircle className="h-6 w-6 text-[#1F6B3B]" />
+                    : <CreditCard  className="h-6 w-6 text-slate-600" />
+                  }
                 </div>
 
-                <p className="mt-0.5 text-sm text-slate-600 truncate">{aluno.nome}</p>
-
-                <div className="mt-1 flex flex-wrap gap-2">
-                  {aluno.turma ? (
-                    <span className="inline-flex items-center rounded-full border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600">
-                      {aluno.turma}
-                    </span>
-                  ) : null}
-                  {aluno.bi ? (
-                    <span className="inline-flex items-center rounded-full border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600">
-                      BI: {aluno.bi}
-                    </span>
-                  ) : null}
+                {/* Título + aluno */}
+                <div className="min-w-0">
+                  <div className="flex items-center gap-2 flex-wrap">
+                    <h2 className="text-base font-black text-slate-900">
+                      {concluido ? "Pagamento concluído" : "Pagamento rápido"}
+                    </h2>
+                    {mensalidade && (
+                      <span className={`inline-flex items-center rounded-full border
+                        px-2 py-0.5 text-[10px] font-bold ${statusCls}`}>
+                        {statusLabel}
+                      </span>
+                    )}
+                  </div>
+                  <p className="mt-0.5 text-sm text-slate-500 truncate">{aluno.nome}</p>
+                  <div className="mt-1 flex flex-wrap gap-1.5">
+                    {aluno.turma && (
+                      <span className="inline-flex rounded-full border border-slate-200
+                        px-2 py-0.5 text-[10px] text-slate-500">{aluno.turma}</span>
+                    )}
+                    {aluno.bi && (
+                      <span className="inline-flex rounded-full border border-slate-200
+                        px-2 py-0.5 text-[10px] text-slate-500">BI: {aluno.bi}</span>
+                    )}
+                  </div>
                 </div>
               </div>
-            </div>
 
-            {!concluido && !processando ? (
-              <button
-                type="button"
-                onClick={safeClose}
-                className="rounded-xl p-2 transition hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-klasse-gold/20"
-                aria-label="Fechar"
-              >
-                <X className="h-5 w-5 text-slate-700" />
-              </button>
-            ) : null}
+              {!concluido && !processando && (
+                <button
+                  type="button"
+                  onClick={safeClose}
+                  aria-label="Fechar"
+                  className="flex-shrink-0 rounded-xl p-2 transition hover:bg-slate-100
+                    focus:outline-none focus:ring-4 focus:ring-[#E3B23C]/20"
+                >
+                  <X className="h-5 w-5 text-slate-500" />
+                </button>
+              )}
+            </div>
           </div>
-        </div>
 
-        {/* Body */}
-        <div className="space-y-5 px-6 py-5">
-          {!concluido ? (
-            <>
-              {/* Mensalidade card (neutral + gold accent) */}
-              {mensalidade ? (
-                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
-                  <div className="flex items-start justify-between gap-4">
-                    <div className="min-w-0">
-                      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
-                        Mensalidade
+          {/* ── Body ────────────────────────────────────────────────────── */}
+          <div className="max-h-[70vh] overflow-y-auto px-6 py-5 space-y-5">
+            {concluido ? (
+              <EstadoConcluido />
+            ) : (
+              <>
+                {/* Card da mensalidade */}
+                {mensalidade ? (
+                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
+                    <div className="flex items-start justify-between gap-4">
+                      <div>
+                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
+                          Mensalidade
+                        </p>
+                        <p className="mt-1 text-base font-bold text-slate-900">{mesAno}</p>
+                        {vencimentoLabel && (
+                          <p className="mt-0.5 text-xs text-slate-500">
+                            Venc. <span className="font-semibold text-slate-700">{vencimentoLabel}</span>
+                          </p>
+                        )}
                       </div>
-                      <div className="mt-1 text-base font-bold text-slate-900">{mesAno}</div>
-                      {vencimentoLabel ? (
-                        <div className="mt-1 text-xs text-slate-600">
-                          Vencimento: <span className="font-semibold text-slate-800">{vencimentoLabel}</span>
-                        </div>
-                      ) : null}
-                    </div>
-
-                    <div className="shrink-0 text-right">
-                      <div className="text-xs text-slate-500">Valor</div>
-                      <div className="text-xl font-black text-slate-900">
-                        {moneyAOA.format(mensalidade.valor)}
+                      <div className="text-right flex-shrink-0">
+                        <p className="text-[10px] text-slate-400">Valor</p>
+                        <p className="text-xl font-black text-slate-900">
+                          {moneyAOA.format(mensalidade.valor)}
+                        </p>
                       </div>
                     </div>
                   </div>
-                </div>
-              ) : (
-                <div className="rounded-2xl border border-klasse-gold/25 bg-klasse-gold/10 p-4 text-sm text-slate-900">
-                  Nenhuma mensalidade selecionada.
-                </div>
-              )}
-
-              {/* Método */}
-              <div className="space-y-3">
-                <div className="flex items-center justify-between">
-                  <p className="text-sm font-bold text-slate-900">Método de pagamento</p>
-                  <span className="text-xs text-slate-500">Padrão: Cash</span>
-                </div>
-
-                <SegmentedMethod
-                  value={metodo}
-                  onChange={setMetodo}
-                  disabled={processando}
-                />
-
-              {(metodo === "tpa" || metodo === "mcx" || metodo === "kiwk") && (
-                  <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
-                    <div className="flex items-start justify-between gap-3">
-                      <div className="min-w-0">
-                        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
-                          {metodo === "tpa" ? "Referência obrigatória" : "Referência (opcional)"}
-                        </div>
-                        <input
-                          value={paymentReference}
-                          onChange={(e) => setPaymentReference(e.target.value)}
-                          className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
-                          placeholder={metodo === "tpa" ? "TPA-2026-000882" : "Opcional"}
-                        />
-                        {(metodo === "mcx" || metodo === "kiwk") ? (
-                          <input
-                            value={paymentGatewayRef}
-                            onChange={(e) => setPaymentGatewayRef(e.target.value)}
-                            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
-                            placeholder={metodo === "kiwk" ? "KIWK ref (opcional)" : "Gateway ref (opcional)"}
-                          />
-                        ) : null}
-                      </div>
-                      <div className="h-10 w-10 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center">
-                        <Smartphone className="h-5 w-5 text-slate-700" />
-                      </div>
-                    </div>
+                ) : (
+                  <div className="rounded-2xl border border-[#E3B23C]/20 bg-[#E3B23C]/5
+                    p-4 text-sm text-slate-600">
+                    Nenhuma mensalidade seleccionada.
                   </div>
                 )}
 
-                {metodo === "transfer" ? (
-                  <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
-                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
-                      Comprovativo obrigatório (URL)
-                    </div>
-                    <input
-                      value={paymentEvidenceUrl}
-                      onChange={(e) => setPaymentEvidenceUrl(e.target.value)}
-                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
-                      placeholder="https://..."
-                    />
+                {/* Método de pagamento */}
+                <div className="space-y-3">
+                  <div className="flex items-center justify-between">
+                    <p className="text-sm font-bold text-slate-900">Método</p>
+                    <span className="text-[11px] text-slate-400">Padrão: Cash</span>
                   </div>
-                ) : null}
-              </div>
-
-              {/* Valor recebido */}
-              <div className="space-y-2">
-                <label className="block text-sm font-bold text-slate-900">
-                  Valor recebido
-                </label>
-
-                <div className="relative">
-                  <input
-                    type="text"
-                    inputMode="decimal"
-                    value={valorPago}
-                    onChange={(e) => setValorPago(e.target.value)}
-                    placeholder="0,00"
-                    className={cx(
-                      "w-full rounded-2xl border bg-white px-4 py-3 text-xl font-black outline-none",
-                      "focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold",
-                      "border-slate-200"
-                    )}
+                  <MetodoGrid value={metodo} onChange={setMetodo} disabled={processando} />
+                  <DetalhesMetodo
+                    metodo={metodo}
+                    detalhes={detalhes}
+                    onChange={d => setDetalhes(prev => ({ ...prev, ...d }))}
                     disabled={processando}
-                    aria-label="Valor recebido em AOA"
                   />
-                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 font-semibold">
-                    AOA
-                  </div>
                 </div>
 
-                {sugestoes.length > 0 ? (
-                  <div className="flex flex-wrap gap-2 pt-1">
-                    {sugestoes.map((v) => (
-                      <button
-                        key={v}
-                        type="button"
-                        onClick={() => setValorPago(String(v))}
-                        disabled={processando}
-                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
-                      >
-                        {moneyAOA.format(v)}
-                      </button>
-                    ))}
-                  </div>
-                ) : null}
-              </div>
-
-              {/* Troco (só cash) */}
-              {mostraTroco ? (
-                <div className="rounded-2xl border border-slate-200 bg-white p-4">
-                  <div className="flex items-center justify-between">
-                    <div className="flex items-center gap-2">
-                      <div className="h-9 w-9 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center">
-                        <Calculator className="h-5 w-5 text-slate-700" />
-                      </div>
-                      <div>
-                        <div className="text-sm font-bold text-slate-900">Troco</div>
-                        <div className="text-xs text-slate-600">A devolver no balcão</div>
-                      </div>
-                    </div>
-
-                    <div className={cx("text-right", trocoValido ? "text-slate-900" : "text-red-600")}>
-                      <div className="text-xs text-slate-500">Valor</div>
-                      <div className="text-xl font-black">{moneyAOA.format(troco)}</div>
-                    </div>
-                  </div>
-                </div>
-              ) : null}
+                {/* Valor recebido */}
+                <ValorInput
+                  valor={valor}
+                  onChange={setValor}
+                  sugestoes={sugestoes}
+                  disabled={processando}
+                />
 
-              {/* Resumo compacto */}
-              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
-                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
-                  Resumo
-                </div>
+                {/* Troco (só cash) */}
+                {metodo === "cash" && valorNum > 0 && (
+                  <TrocoCard troco={troco} valido={trocoValido} />
+                )}
 
-                <div className="mt-3 space-y-2 text-sm">
-                  <KpiRow label="Valor da mensalidade" value={moneyAOA.format(valorDevido)} />
-                  <KpiRow label="Valor recebido" value={moneyAOA.format(valorPagoNum)} />
-                  <div className="pt-2 border-t border-slate-200" />
-                  <KpiRow
-                    label="Troco"
-                    value={moneyAOA.format(troco)}
-                    strong
-                  />
-                </div>
+                {/* Resumo */}
+                <ResumoCard
+                  valorDevido={valorDevido}
+                  valorPago={valorNum}
+                  troco={troco}
+                  trocoValido={trocoValido}
+                />
+              </>
+            )}
+          </div>
 
-                {!trocoValido ? (
-                  <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-700">
-                    O valor recebido precisa ser maior ou igual ao valor da mensalidade.
-                  </div>
-                ) : null}
-              </div>
-            </>
-          ) : (
-            <div className="py-8 text-center">
-              <div className="mx-auto mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full bg-klasse-green/10 ring-1 ring-klasse-green/20">
-                <CheckCircle className="h-8 w-8 text-klasse-green" />
-              </div>
-              <h3 className="text-xl font-black text-slate-900">Pagamento registrado</h3>
-              <p className="mt-2 text-sm text-slate-600">
-                Recibo emitido automaticamente (quando habilitado).
-              </p>
-              <p className="mt-3 text-xs text-slate-500">
-                Dica: Enter confirma • Esc fecha
+          {/* ── Footer ──────────────────────────────────────────────────── */}
+          <div className="border-t border-slate-100 bg-white px-6 py-4">
+            {concluido ? (
+              <p className="text-center text-sm text-slate-400">
+                A fechar automaticamente…
               </p>
-            </div>
-          )}
-        </div>
-
-        {/* Footer */}
-        <div className="border-t border-slate-200 bg-white px-6 py-4">
-          {!concluido ? (
-            <div className="flex gap-3">
-              <Button
-                variant="outline"
-                onClick={safeClose}
-                disabled={processando}
-                className="flex-1 rounded-xl"
-              >
-                Cancelar
-              </Button>
-
-              <Button
-                ref={confirmBtnRef}
-                onClick={handleConfirmarPagamento}
-                disabled={!canConfirm}
-                className={cx(
-                  "flex-1 rounded-xl",
-                  "bg-klasse-gold text-white hover:brightness-95"
-                )}
-              >
-                {processando ? (
-                  <span className="inline-flex items-center gap-2">
-                    <Loader2 className="h-4 w-4 animate-spin" />
-                    Processando...
-                  </span>
-                ) : (
-                  "Confirmar"
-                )}
-              </Button>
-            </div>
-          ) : (
-            <p className="text-center text-sm text-slate-500">Fechando automaticamente…</p>
-          )}
-        </div>
+            ) : (
+              <div className="flex gap-3">
+                <Button
+                  variant="outline"
+                  onClick={safeClose}
+                  disabled={processando}
+                  className="flex-1 rounded-xl"
+                >
+                  Cancelar
+                </Button>
+                <Button
+                  ref={confirmBtnRef}
+                  onClick={submit}
+                  disabled={!canConfirm || processando}
+                  className="flex-1 rounded-xl bg-[#E3B23C] text-white
+                    hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed"
+                >
+                  {processando ? (
+                    <span className="inline-flex items-center gap-2">
+                      <Loader2 className="h-4 w-4 animate-spin" />
+                      A processar…
+                    </span>
+                  ) : (
+                    `Confirmar — ${moneyAOA.format(valorNum || valorDevido)}`
+                  )}
+                </Button>
+              </div>
+            )}
+          </div>
         </div>
       </div>
-      {recibo ? (
+
+      {/* Recibo (imprimível, fora do modal) */}
+      {recibo && (
         <ReciboImprimivel
           escolaNome={escolaNome ?? "Escola"}
           alunoNome={aluno.nome}
@@ -746,7 +772,7 @@ export function ModalPagamentoRapido({
           data={new Date().toISOString()}
           urlValidacao={recibo.url_validacao}
         />
-      ) : null}
+      )}
     </>
   );
-}
+}
\ No newline at end of file
diff --git a/apps/web/src/components/ui/StatusPill.tsx b/apps/web/src/components/ui/StatusPill.tsx
index 38a67523..644de0be 100644
--- a/apps/web/src/components/ui/StatusPill.tsx
+++ b/apps/web/src/components/ui/StatusPill.tsx
@@ -11,7 +11,7 @@ function classesFor(status: string, variant: Variant): string {
   }
 
   if (s === "ativo") return "bg-[#1F6B3B]/10 text-[#1F6B3B] border-[#1F6B3B]/20";
-  if (s === "arquivado" || s === "inativo") return "bg-slate-100 text-slate-600 border-slate-200";
+  if (s === "arquivado" || s === "inativo") return "bg-slate-100 text-slate-500 border-slate-200";
   return "bg-[#E3B23C]/10 text-[#9a7010] border-[#E3B23C]/30";
 }
 
diff --git a/apps/web/src/hooks/useEscolaId.ts b/apps/web/src/hooks/useEscolaId.ts
index 073d9cc2..d437fa10 100644
--- a/apps/web/src/hooks/useEscolaId.ts
+++ b/apps/web/src/hooks/useEscolaId.ts
@@ -30,12 +30,6 @@ export function useEscolaId(): UseEscolaIdState {
           return;
         }
 
-        const metaEscola = (user.app_metadata as any)?.escola_id as string | undefined;
-        if (metaEscola) {
-          if (active) setEscolaId(String(metaEscola));
-          return;
-        }
-
         const { data: prof } = await supabase
           .from("profiles")
           .select("current_escola_id, escola_id")
@@ -48,6 +42,12 @@ export function useEscolaId(): UseEscolaIdState {
           return;
         }
 
+        const metaEscola = (user.app_metadata as any)?.escola_id as string | undefined;
+        if (metaEscola) {
+          if (active) setEscolaId(String(metaEscola));
+          return;
+        }
+
         const { data: vinc } = await supabase
           .from("escola_users")
           .select("escola_id")
diff --git a/types/supabase.ts b/types/supabase.ts
index 063943a2..4268b730 100644
--- a/types/supabase.ts
+++ b/types/supabase.ts
@@ -188,6 +188,96 @@ export type Database = {
           },
         ]
       }
+      aluno_encarregados: {
+        Row: {
+          aluno_id: string
+          created_at: string | null
+          encarregado_id: string
+          escola_id: string
+          id: string
+          principal: boolean | null
+          relacao: string | null
+          updated_at: string | null
+        }
+        Insert: {
+          aluno_id: string
+          created_at?: string | null
+          encarregado_id: string
+          escola_id: string
+          id?: string
+          principal?: boolean | null
+          relacao?: string | null
+          updated_at?: string | null
+        }
+        Update: {
+          aluno_id?: string
+          created_at?: string | null
+          encarregado_id?: string
+          escola_id?: string
+          id?: string
+          principal?: boolean | null
+          relacao?: string | null
+          updated_at?: string | null
+        }
+        Relationships: [
+          {
+            foreignKeyName: "aluno_encarregados_aluno_id_fkey"
+            columns: ["aluno_id"]
+            isOneToOne: false
+            referencedRelation: "alunos"
+            referencedColumns: ["id"]
+          },
+          {
+            foreignKeyName: "aluno_encarregados_aluno_id_fkey"
+            columns: ["aluno_id"]
+            isOneToOne: false
+            referencedRelation: "vw_alunos_active"
+            referencedColumns: ["id"]
+          },
+          {
+            foreignKeyName: "aluno_encarregados_aluno_id_fkey"
+            columns: ["aluno_id"]
+            isOneToOne: false
+            referencedRelation: "vw_balcao_secretaria"
+            referencedColumns: ["aluno_id"]
+          },
+          {
+            foreignKeyName: "aluno_encarregados_aluno_id_fkey"
+            columns: ["aluno_id"]
+            isOneToOne: false
+            referencedRelation: "vw_matriculas_secretaria"
+            referencedColumns: ["aluno_id"]
+          },
+          {
+            foreignKeyName: "aluno_encarregados_aluno_id_fkey"
+            columns: ["aluno_id"]
+            isOneToOne: false
+            referencedRelation: "vw_search_alunos"
+            referencedColumns: ["id"]
+          },
+          {
+            foreignKeyName: "aluno_encarregados_encarregado_id_fkey"
+            columns: ["encarregado_id"]
+            isOneToOne: false
+            referencedRelation: "encarregados"
+            referencedColumns: ["id"]
+          },
+          {
+            foreignKeyName: "aluno_encarregados_escola_id_fkey"
+            columns: ["escola_id"]
+            isOneToOne: false
+            referencedRelation: "escolas"
+            referencedColumns: ["id"]
+          },
+          {
+            foreignKeyName: "aluno_encarregados_escola_id_fkey"
+            columns: ["escola_id"]
+            isOneToOne: false
+            referencedRelation: "escolas_view"
+            referencedColumns: ["id"]
+          },
+        ]
+      }
       aluno_processo_counters: {
         Row: {
           escola_id: string
@@ -1918,6 +2008,54 @@ export type Database = {
           },
         ]
       }
+      encarregados: {
+        Row: {
+          bi_numero: string | null
+          created_at: string | null
+          email: string | null
+          escola_id: string
+          id: string
+          nome: string
+          telefone: string | null
+          updated_at: string | null
+        }
+        Insert: {
+          bi_numero?: string | null
+          created_at?: string | null
+          email?: string | null
+          escola_id: string
+          id?: string
+          nome: string
+          telefone?: string | null
+          updated_at?: string | null
+        }
+        Update: {
+          bi_numero?: string | null
+          created_at?: string | null
+          email?: string | null
+          escola_id?: string
+          id?: string
+          nome?: string
+          telefone?: string | null
+          updated_at?: string | null
+        }
+        Relationships: [
+          {
+            foreignKeyName: "encarregados_escola_id_fkey"
+            columns: ["escola_id"]
+            isOneToOne: false
+            referencedRelation: "escolas"
+            referencedColumns: ["id"]
+          },
+          {
+            foreignKeyName: "encarregados_escola_id_fkey"
+            columns: ["escola_id"]
+            isOneToOne: false
+            referencedRelation: "escolas_view"
+            referencedColumns: ["id"]
+          },
+        ]
+      }
       escola_administradores: {
         Row: {
           cargo: string | null
