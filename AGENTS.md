# KLASSE — Engineering Agents Contract
> Versão: 2.0.0
> Hash de versão: verificar com `sha256sum agents/ENGINEERING_AGENTS_CONTRACT.md`
> Precedência: este ficheiro tem autoridade sobre qualquer opinião de agente, dev, ou atalho técnico.
> Última revisão: 2026-02-24

---

## Como ler este contrato

Cada regra tem:
- **ID único** — referenciado nos reports e nos commits
- **Critério de detecção** — o que o agente procura, sem ambiguidade
- **Evidência obrigatória** — o formato exacto que o agente deve produzir
- **Classificação** — CRITICAL | HIGH | MEDIUM | LOW | PASS
- **Excepções documentadas** — casos onde a regra não se aplica

Um agente que não consegue preencher todos os campos de evidência obrigatória para um finding **não deve reportar esse finding**. Incerteza é WARN, não FAIL.

---

## Formato de evidência obrigatório

Todo o finding deve usar exactamente este formato.
Findings sem este formato completo são inválidos e ignorados.

```
FINDING
  id:            [REGRA_ID]-[SHA8_DO_FICHEIRO]
  regra:         [REGRA_ID]
  severidade:    CRITICAL | HIGH | MEDIUM | LOW
  status:        FAIL | WARN | REGRESSION | PASS
  ficheiro:      [path relativo à raiz do repo]
  linha:         [número de linha ou range]
  evidencia:     [trecho de código exacto, máximo 3 linhas]
  impacto:       [consequência concreta em 1 frase]
  recomendacao:  [acção exacta em 1 frase]
  bloqueante:    true | false
  excecao:       [ID da excepção se aplicável, ou null]
```

---

## Contrato de PASS

Um agente emite PASS quando:
- Zero findings com `bloqueante: true`
- Todos os WARNs têm ticket registado em `agents/outputs/WARN_REGISTRY.md`
- Nenhuma REGRESSION detectada face ao último report
- Output completo gerado sem erros

PASS parcial não existe. É PASS ou é FAIL/WARN.

---

## Contrato de REGRESSION

Uma REGRESSION ocorre quando um finding com `status: PASS` num report anterior passa a `status: FAIL`.

Regras:
1. REGRESSION é sempre `bloqueante: true` independentemente da severidade original
2. O agente deve incluir no finding:
   - `evidencia_anterior:` o estado PASS do run anterior
   - `evidencia_actual:` o estado FAIL actual
   - `commit_regressao:` hash do commit que introduziu a regressão (se identificável)
3. O agente compara com `agents/outputs/REPORT_SCAN_LAST_PASS.json` para detectar regressões
4. Se `REPORT_SCAN_LAST_PASS.json` não existir, não há regressões a reportar

---

## Tabela de cache — excepções documentadas

Esta tabela define quando `no-store` é obrigatório e quando `revalidate` é permitido.
O Agent 1 e o Agent 2 usam esta tabela para avaliar regras de cache.
**Regras de cache sem entrada nesta tabela são avaliadas como `no-store` obrigatório.**

| Padrão de path / componente | Política obrigatória | Justificação |
|---|---|---|
| `/api/financeiro/**` | `no-store` | Dados financeiros em tempo real |
| `/api/secretaria/balcao/**` | `no-store` | Operações de balcão ao vivo |
| `/api/secretaria/pagamentos/**` | `no-store` | Pagamentos não podem ser cacheados |
| `/api/secretaria/matriculas/**` | `no-store` | Estado de matrícula muda ao segundo |
| `/api/secretaria/notas/**` | `no-store` | Notas são dados académicos oficiais |
| `/api/secretaria/frequencias/**` | `no-store` | Frequência operacional |
| `/api/professor/**` | `no-store` | Dados de trabalho activo |
| `/api/aluno/**` | `no-store` | Portal do aluno: dados pessoais |
| `components/layout/*Layout*` | `revalidate: 300` | Branding e navegação — muda raramente |
| `/api/escola/*/configuracoes` | `revalidate: 60` | Configurações — muda raramente |
| `components/*Banner*` | `revalidate: 60` | Avisos de sistema |
| `/api/escola/*/plano` | `revalidate: 300` | Plano da escola — muda raramente |
| `/api/vw_*` | `no-store` | Wrappers de MV — dados frescos obrigatórios |

---

## Matriz de MVs obrigatórias

Cada rota listada exige a MV correspondente com todos os artefactos.
O Agent 2 valida esta matriz em cada run.

| Rota | MV obrigatória | INDEX | Refresh fn | Wrapper | Cron |
|---|---|---|---|---|---|
| `/secretaria/dashboard` | `mv_secretaria_dashboard_counts` | `ux_mv_secretaria_dashboard_counts` | `refresh_mv_secretaria_dashboard_counts` | `vw_secretaria_dashboard_counts` | obrigatório |
| `/secretaria/matriculas` | `mv_secretaria_matriculas_status` | `ux_mv_secretaria_matriculas_status` | `refresh_mv_secretaria_matriculas_status` | `vw_secretaria_matriculas_status` | obrigatório |
| `/financeiro/radar` | `mv_radar_inadimplencia` | `ux_mv_radar_inadimplencia` | `refresh_mv_radar_inadimplencia` | `vw_radar_inadimplencia` | obrigatório |
| `/financeiro/pagamentos` | `mv_pagamentos_status` | `ux_mv_pagamentos_status` | `refresh_mv_pagamentos_status` | `vw_pagamentos_status` | obrigatório |

**Status de artefacto de MV:**
- Todos presentes → PASS
- 1–2 em falta → PARTIAL (HIGH, bloqueante: true)
- MV inexistente → FAIL (CRITICAL, bloqueante: true)
- MV existe mas sem cron → PARTIAL (HIGH, bloqueante: true)

---

## AGENT 1 — Codex Scan (Auditor)

**Versão:** 1.2
**Escopo:** Frontend, API Routes, SQL/Migrations, Supabase helpers
**Output obrigatório:** `agents/outputs/REPORT_SCAN.md`, `agents/outputs/REPORT_SCAN.json`
**Compara com:** `agents/outputs/REPORT_SCAN_LAST_PASS.json`

### Regras CRITICAL (bloqueante: true)

---

**RULE: SEC-001**
Endpoint humano sem `resolveEscolaIdForUser`

```
detecção:
  ficheiros: apps/web/src/app/api/**/*.ts
  excluir:   paths contendo /jobs/, /workers/, /cron/, /inngest/, /super-admin/
  condição:  ficheiro exporta GET, POST, PUT, PATCH, DELETE
             E não contém "resolveEscolaIdForUser"
             E contém "supabase" (faz queries)

evidência obrigatória:
  - linha da export handler
  - presença/ausência de resolveEscolaIdForUser
  - primeira query encontrada no ficheiro

excepções:
  EXC-SEC-001-A: rotas de autenticação (/api/auth/**)
  EXC-SEC-001-B: rotas públicas documentadas em agents/exceptions/public-routes.md
```

---

**RULE: SEC-002**
Service Role em endpoint humano

```
detecção:
  ficheiros: apps/web/src/app/api/**/*.ts
  excluir:   paths contendo /jobs/, /workers/, /cron/, /inngest/
  condição:  contém SUPABASE_SERVICE_ROLE_KEY
             OU contém supabaseAdmin
             OU contém createClient({ serviceRole })

evidência obrigatória:
  - linha exacta com service role
  - nome da variável/função usada

excepções:
  EXC-SEC-002-A: rotas de provisionamento documentadas em agents/exceptions/service-role-allowed.md
```

---

**RULE: SEC-003**
Query em tabela crítica sem `.eq('escola_id', ...)`

```
detecção:
  ficheiros: apps/web/src/app/api/**/*.ts
  tabelas:   anos_letivos, periodos_letivos, cursos, classes, turmas,
             matriculas, turma_disciplinas, avaliacoes, notas, frequencias,
             financeiro_titulos, financeiro_cobrancas, pagamentos
  condição:  ficheiro faz .from('[tabela_crítica]')
             E não contém .eq('escola_id'
             E não contém .eq(`escola_id`
             E não está numa rpc() call (RPCs têm escola_id no argumento)

evidência obrigatória:
  - linha do .from()
  - ausência de .eq('escola_id')
  - nome da tabela afectada
```

---

**RULE: SEC-004**
Helper Supabase deprecated

```
detecção:
  ficheiros: **/*.ts, **/*.tsx
  condição:  contém @supabase/auth-helpers-nextjs
             OU contém createRouteHandlerClient
             OU contém createMiddlewareClient
             OU contém createBrowserSupabaseClient (legado)

evidência obrigatória:
  - import exacto encontrado
  - substituto correcto (ex: @supabase/ssr → createServerClient)
```

---

**RULE: PERF-001**
Cálculo ao vivo em dashboard

```
detecção:
  ficheiros: apps/web/src/app/api/**/*.ts
  condição:  path contém /dashboard/ OU /relatorio/ OU /admin/
             E contém .select('*').count('exact')
             OU contém COUNT(*) em query string
             OU contém SUM( em query string
             OU contém GROUP BY em query string
             E NÃO usa .from('mv_') E NÃO usa .from('vw_')

evidência obrigatória:
  - query completa (máximo 5 linhas)
  - path da rota
  - MV equivalente se existir na matriz
```

---

**RULE: PERF-002**
MV sem UNIQUE INDEX

```
detecção:
  ficheiros: supabase/migrations/**/*.sql
  condição:  contém CREATE MATERIALIZED VIEW [nome]
             E NÃO existe CREATE UNIQUE INDEX [qualquer_nome] ON [nome]
             no mesmo ficheiro OU em migration posterior

evidência obrigatória:
  - linha da CREATE MATERIALIZED VIEW
  - ausência de UNIQUE INDEX
  - nome da MV afectada
```

---

**RULE: CACHE-001**
Cache indevido em rota financeira/operacional

```
detecção:
  ficheiros: apps/web/src/app/api/**/*.ts
  condição:  path corresponde a padrão no-store obrigatório na tabela de cache
             E contém revalidate = [número > 0]
             OU contém cache: 'force-cache'
             OU contém next: { revalidate: [número > 0] }

evidência obrigatória:
  - linha com cache indevido
  - path da rota
  - política correcta segundo tabela de cache

excepções: nenhuma para rotas financeiras/operacionais
```

---

**RULE: PLAN-001**
Feature premium sem backend guard

```
detecção:
  ficheiros: apps/web/src/app/api/**/*.ts
  features:  fin_recibo_pdf, doc_qr_code, relatorio_avancado
  condição:  path contém rota associada à feature (ver agents/exceptions/premium-routes.md)
             E NÃO contém requireFeature( OU checkPlan( OU planGuard(

evidência obrigatória:
  - path da rota
  - feature esperada
  - ausência de guard
  - curl de bypass possível (exemplo)
```

---

### Regras MEDIUM (bloqueante: false)

---

**RULE: PERF-003**
Pesquisa sem debounce

```
detecção:
  ficheiros: apps/web/src/**/*.tsx, apps/web/src/**/*.ts
  condição:  contém onChange= OU onInput=
             E query/search string vai para fetch/supabase
             E NÃO contém debounce( OU useDebounce( OU setTimeout(

evidência obrigatória:
  - componente/hook afectado
  - ausência de debounce
  - impacto estimado (queries por keystroke)
```

---

**RULE: PERF-004**
Limit > 50 em query de lista

```
detecção:
  ficheiros: apps/web/src/app/api/**/*.ts
  condição:  contém .limit([número > 50])
             OU url.searchParams.get('limit') sem validação de máximo

evidência obrigatória:
  - linha com limit
  - valor encontrado
  - rota afectada
```

---

**RULE: DATA-001**
`orderBy` não determinístico

```
detecção:
  ficheiros: apps/web/src/app/api/**/*.ts
  condição:  contém .order( sem campo único como id ou created_at como tie-breaker

evidência obrigatória:
  - query completa
  - campo de ordenação encontrado
  - tie-breaker em falta
```

---

### Output do Agent 1

Ficheiros gerados obrigatoriamente após cada run:

**`agents/outputs/REPORT_SCAN.md`**
```markdown
# KLASSE — Codex Scan Report
contrato_versao: 2.0.0
run_timestamp:   [ISO 8601]
run_id:          [UUID]
commit:          [git SHA]

## Sumário
| Severidade | Total | Bloqueantes |
|---|---|---|
| CRITICAL | N | N |
| HIGH | N | N |
| MEDIUM | N | 0 |
| LOW | N | 0 |
| REGRESSION | N | N |

## Veredito
PASS | FAIL | WARN

## Blockers activos
[lista de finding IDs bloqueantes]

## Findings
[um bloco FINDING por violação, formato obrigatório acima]

## Regressões
[comparação com REPORT_SCAN_LAST_PASS.json]

## Excepções activas
[lista de excepções aplicadas neste run]
```

**`agents/outputs/REPORT_SCAN.json`**
```json
{
  "contrato_versao": "2.0.0",
  "run_id": "uuid",
  "run_timestamp": "ISO8601",
  "commit": "sha",
  "veredito": "PASS|FAIL|WARN",
  "can_merge": true|false,
  "summary": { "critical": 0, "high": 0, "medium": 0, "regressions": 0 },
  "findings": [ ... ],
  "exceptions_applied": [ ... ]
}
```

Se `veredito = PASS`, copiar `REPORT_SCAN.json` para `REPORT_SCAN_LAST_PASS.json`.

---

## AGENT 2 — Performance Gate (Hard Gate)

**Versão:** 1.2
**Escopo:** MVs, dashboards, cache, queries de escala
**Output obrigatório:** `agents/outputs/PERFORMANCE_GATE.md`
**Bloqueia merge:** sim, se `can_merge: false`

### Regras invioláveis

---

**RULE: MV-001**
Dashboard usa query directa em vez de `vw_*`

```
detecção:
  para cada rota na matriz de MVs obrigatórias:
    verificar se a rota usa .from('vw_[nome]') OU rpc('vw_[nome]')
    se não → FAIL

evidência obrigatória:
  - rota afectada
  - MV esperada segundo matriz
  - query encontrada
```

---

**RULE: MV-002**
MV na matriz sem todos os artefactos

```
para cada MV na matriz de MVs obrigatórias, verificar em supabase/migrations/**:
  □ CREATE MATERIALIZED VIEW [mv_nome]
  □ CREATE UNIQUE INDEX [ux_mv_nome] ON [mv_nome]
  □ CREATE OR REPLACE FUNCTION refresh_[mv_nome]
  □ SELECT cron.schedule(... 'refresh_[mv_nome]' ...)
  □ CREATE OR REPLACE VIEW [vw_nome] AS SELECT * FROM [mv_nome]

status por MV:
  5/5 presentes → PASS
  3-4/5 presentes → PARTIAL (HIGH, bloqueante: true)
  1-2/5 presentes → FAIL (CRITICAL, bloqueante: true)
  0/5 presentes → FAIL (CRITICAL, bloqueante: true)

evidência obrigatória:
  - tabela de artefactos com ✅/❌ por item
  - migration onde cada artefacto foi encontrado
  - artefactos em falta com migration sugerida
```

---

**RULE: MV-003**
`REFRESH MATERIALIZED VIEW` sem `CONCURRENTLY`

```
detecção:
  ficheiros: supabase/migrations/**/*.sql
  condição:  contém REFRESH MATERIALIZED VIEW [nome]
             E NÃO contém REFRESH MATERIALIZED VIEW CONCURRENTLY [nome]

evidência obrigatória:
  - linha exacta
  - migration afectada
  - impacto: lock exclusivo durante refresh
```

---

**RULE: CACHE-002**
`force-dynamic` ausente em rota de dashboard/financeiro

```
detecção:
  ficheiros: apps/web/src/app/**/page.tsx, apps/web/src/app/api/**/*.ts
  condição:  path corresponde a no-store obrigatório na tabela de cache
             E NÃO contém export const dynamic = 'force-dynamic'
             E NÃO contém cache: 'no-store' em todos os fetch()

evidência obrigatória:
  - path do ficheiro
  - ausência de force-dynamic
  - fetch sem no-store encontrado (se aplicável)
```

---

### Output do Agent 2

**`agents/outputs/PERFORMANCE_GATE.md`**
```markdown
# KLASSE — Performance Gate
contrato_versao: 2.0.0
run_timestamp:   [ISO 8601]
run_id:          [UUID]

## Status: PASS | FAIL

## MVs
| MV | INDEX | Refresh Fn | Cron | Wrapper | Status |
|---|---|---|---|---|---|
| mv_radar_inadimplencia | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | PASS/PARTIAL/FAIL |
...

## Dashboards cobertos
[lista de rotas com MV correspondente]

## Alertas de cálculo ao vivo
[findings MV-001]

## Veredito
can_merge: true | false
```

---

## AGENT 3 — Apply Agent (Executor Seguro)

**Versão:** 1.1
**Escopo:** Correções automáticas de baixo risco
**Princípio:** Nunca executar o que não consegue reverter com um único `git revert`

### Pode executar SEM aprovação humana

Estas acções são seguras, reversíveis, e não alteram contratos:

| Acção | Condição |
|---|---|
| Adicionar índice não-único | Tabela existe, índice não existe |
| Ajustar debounce para 250–400ms | Valor actual fora do range |
| Corrigir `orderBy` sem tie-breaker | Adicionar `.order('id')` como secondary sort |
| Remover helper deprecated | Substituto confirmado na tabela de migração de helpers |
| Padronizar `resolveEscolaIdForUser` | Padrão correcto identificado na rota |
| Ajustar imports `@supabase/ssr` | Import antigo → import novo sem mudança de comportamento |
| Adicionar `cache: 'no-store'` | Rota na lista no-store obrigatório |
| Corrigir `limit` para máximo 50 | Valor actual > 50 |

### Exige aprovação antes de executar

Quando o Agent 3 detecta uma destas situações, **para completamente**, gera `agents/outputs/PENDING_APPROVAL.md` com o diff proposto, e aguarda um commit com mensagem `APPROVE: [run_id]`.

| Acção | Razão |
|---|---|
| DROP TABLE / DROP COLUMN | Destrutivo e irreversível |
| ALTER TABLE em tabela financeira | Risco de perda de dados |
| Alteração de política RLS | Impacto de segurança |
| Alteração de schema em `pagamentos`, `audit_logs` | Dados financeiros e auditoria |
| Refactor estrutural (move de ficheiros) | Pode quebrar imports |
| Mudança de contrato SQL (nomes de colunas, tipos) | Impacto em produção |

**Formato de `PENDING_APPROVAL.md`:**
```markdown
# Aprovação necessária — Agent 3
run_id:    [UUID]
timestamp: [ISO 8601]

## Acção proposta
[descrição em linguagem humana]

## Diff
```diff
[diff exacto]
```

## Risco
[consequência se algo correr mal]

## Como aprovar
Commit com mensagem: `APPROVE: [run_id]`

## Como rejeitar
Commit com mensagem: `REJECT: [run_id] [motivo]`
```

### Regras absolutas do Agent 3

1. **Nunca executar SQL destrutivo** — DROP, TRUNCATE, DELETE sem WHERE são proibidos sem aprovação
2. **Nunca alterar dados reais** — apenas schema e código
3. **Sempre gerar diff antes de aplicar** — o diff deve estar em `agents/outputs/APPLY_DIFF_[run_id].md`
4. **Sempre verificar `P0_CHECKLIST.md` antes de qualquer apply** — se algum item P0 estiver em FAIL, não aplica nada
5. **Nunca resolver dois findings em simultâneo** se forem de ficheiros diferentes — um apply por ficheiro por run
6. **Reverter automaticamente** se os testes pós-apply falharem (se pipeline de testes disponível)

---

## Registo de excepções

Excepções às regras devem ser documentadas em `agents/exceptions/`.
Uma excepção não documentada não é válida.

**Formato de excepção:**
```markdown
# Excepção [EXC-RULE-ID-LETRA]
regra:       [RULE ID]
ficheiro:    [path afectado]
motivo:      [justificação técnica obrigatória]
aprovado_por: [user_id ou nome]
data:        [ISO 8601]
expira_em:   [data ou "permanente"]
```

---

## Registo de WARNs activos

WARNs não resolvidos devem ter entrada em `agents/outputs/WARN_REGISTRY.md`.
Um WARN sem entrada no registo bloqueia PASS.

**Formato:**
```markdown
| WARN ID | Regra | Ficheiro | Ticket | Responsável | Prazo |
|---|---|---|---|---|---|
| WARN-001 | PERF-003 | components/Search.tsx | #42 | @dev | 2026-03-01 |
```

---

## Princípios KLASSE

```
Dados reais > cache
Pré-cálculo > cálculo ao vivo
Contrato > conveniência
Evidência > opinião
Escala primeiro, feature depois
Ambiguidade é WARN, não PASS
```

---

## Versionamento deste contrato

| Versão | Data | Mudanças |
|---|---|---|
| 1.0 | 2026-02-10 | Versão inicial |
| 2.0 | 2026-02-24 | Critério de PASS, formato de evidência, contrato de REGRESSION, tabela de cache, matriz de MVs, Agent 3 com PENDING_APPROVAL |

---

## Autoridade e precedência

```
ENGINEERING_AGENTS_CONTRACT.md
  > P0_CHECKLIST.md
  > AGENT_INSTRUCTIONS.md
  > Opinião do agente
  > Opinião do dev
  > Atalho técnico
  > Prazo de entrega
```

Se violar qualquer regra CRITICAL → FAIL imediato.
Se violar qualquer regra sem excepção documentada → FAIL.
Se REGRESSION detectada → FAIL imediato, independente de severidade.