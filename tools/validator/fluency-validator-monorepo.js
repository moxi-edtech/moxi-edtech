#!/usr/bin/env node
// fluency-validator-monorepo.js
// KLASSE — Validador de Contratos v1.1
// Alinhado com: big-tech-performance v1.1, AGENT_INSTRUCTIONS v1.2, FEATURES_PRIORITY v1.2, REPORT_SCAN v1.1

import { readFileSync, writeFileSync, existsSync } from "fs"
import { glob } from "glob"
import path from "path"

// ─── Config ───────────────────────────────────────────────────────────────────

const ROOT = process.cwd()
const REPORT_PATH = path.join(ROOT, "MONOREPO_VALIDATION_REPORT.md")
const JSON_REPORT_PATH = path.join(ROOT, "REPORT_SCAN_LIVE.json")

const API_ROUTES_GLOB = "apps/web/src/app/api/**/*.ts"
const MIGRATIONS_GLOB = "supabase/migrations/**/*.sql"
const COMPONENTS_GLOB = "apps/web/src/{components,hooks,app}/**/*.{ts,tsx}"
const LAYOUTS_GLOB = "apps/web/src/components/layout/**/*.{ts,tsx}"

// Dados financeiros e operacionais — no-store é OBRIGATÓRIO
const NO_STORE_REQUIRED_PATTERNS = [
  /financeiro/i, /pagamento/i, /caixa/i, /recibo/i, /extrato/i,
  /matricula/i, /nota[^s]/i, /frequencia/i, /pauta/i, /balcao/i,
  /atendimento/i, /fila/i, /emissao/i, /importa/i,
]

// Configurações estáticas — revalidate é preferível
const REVALIDATE_PREFERRED_PATTERNS = [
  /PortalLayout/i, /StudentPortalLayout/i, /ConfigHealth/i,
  /AssignmentsBanner/i, /TurmaForm/i, /Professores.*List/i,
  /Usuarios.*List/i, /Horario/i, /documentos\/\[publicId\]/i,
]

// MVs obrigatórias com todos os artefactos
const REQUIRED_MVS = [
  {
    id: "mv_radar_inadimplencia",
    index: "ux_mv_radar_inadimplencia",
    refresh_fn: "refresh_mv_radar_inadimplencia",
    wrapper: "vw_radar_inadimplencia",
    cron_contains: "refresh_mv_radar_inadimplencia",
    contract_ref: "F09_MV",
  },
  {
    id: "mv_pagamentos_status",
    index: "ux_mv_pagamentos_status",
    refresh_fn: "refresh_mv_pagamentos_status",
    wrapper: "vw_pagamentos_status",
    cron_contains: "refresh_mv_pagamentos_status",
    contract_ref: "F18_MV",
  },
  {
    id: "mv_secretaria_dashboard_counts",
    index: "ux_mv_secretaria_dashboard_counts",
    refresh_fn: "refresh_mv_secretaria_dashboard_counts",
    wrapper: "vw_secretaria_dashboard_counts",
    cron_contains: "refresh_mv_secretaria_dashboard_counts",
    contract_ref: "P0_3_MV_DASHBOARDS",
  },
  {
    id: "mv_secretaria_matriculas_status",
    index: "ux_mv_secretaria_matriculas_status",
    refresh_fn: "refresh_mv_secretaria_matriculas_status",
    wrapper: "vw_secretaria_matriculas_status",
    cron_contains: "refresh_mv_secretaria_matriculas_status",
    contract_ref: "P0_3_MV_DASHBOARDS",
  },
  {
    id: "mv_secretaria_matriculas_turma_status",
    index: "ux_mv_secretaria_matriculas_turma_status",
    refresh_fn: "refresh_mv_secretaria_matriculas_turma_status",
    wrapper: "vw_secretaria_matriculas_turma_status",
    cron_contains: "refresh_mv_secretaria_matriculas_turma_status",
    contract_ref: "P0_3_MV_DASHBOARDS",
  },
]

// Features premium — exigem guard no backend E na UI
const PREMIUM_FEATURES = [
  {
    feature: "fin_recibo_pdf",
    backend_routes: ["api/financeiro/recibos/emitir"],
    ui_components: ["ReciboImprimivel"],
    contract_ref: "PLAN_GUARD",
  },
  {
    feature: "doc_qr_code",
    backend_routes: [
      "api/financeiro/extrato/aluno",
      "api/secretaria/turmas",
    ],
    ui_components: ["ExtratoActions", "TurmaDetailClient"],
    contract_ref: "PLAN_GUARD",
  },
]

// Tabelas críticas que exigem escola_id
const CRITICAL_TABLES = [
  "anos_letivos", "periodos_letivos", "cursos", "classes", "turmas",
  "matriculas", "turma_disciplinas", "curso_curriculos", "curriculo_itens",
  "avaliacoes", "notas", "frequencias",
  "financeiro_titulos", "financeiro_cobrancas", "pagamentos",
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readFiles(pattern) {
  const files = glob.sync(pattern, { cwd: ROOT, absolute: true })
  return files.map((f) => ({
    file: f.replace(ROOT + "/", ""),
    content: (() => { try { return readFileSync(f, "utf8") } catch { return "" } })(),
  }))
}

function readAllMigrations() {
  return readFiles(MIGRATIONS_GLOB)
    .map((f) => f.content)
    .join("\n")
}

function readAllApiRoutes() {
  return readFiles(API_ROUTES_GLOB)
}

function readAllComponents() {
  return readFiles(COMPONENTS_GLOB)
}

function bold(str) { return `**${str}**` }
function code(str) { return `\`${str}\`` }

// ─── Checkers ─────────────────────────────────────────────────────────────────

// CHECK 1: Service Role em endpoints humanos
function checkServiceRole(apiRoutes) {
  const findings = []
  const allowedPaths = ["jobs", "workers", "cron", "inngest", "provisioning"]

  for (const { file, content } of apiRoutes) {
    const isAllowed = allowedPaths.some((p) => file.includes(p))
    if (isAllowed) continue

    const hasServiceRole =
      /SUPABASE_SERVICE_ROLE_KEY/.test(content) ||
      /supabaseAdmin/.test(content) ||
      /service_role/.test(content)

    if (hasServiceRole) {
      findings.push({
        id: "SHARED-P0.3",
        severity: "HIGH",
        status: "FAIL",
        file,
        note: "Service Role detectada em endpoint humano — vulnerabilidade de cross-tenant",
        fix: "Substituir por cliente autenticado com RLS activo",
      })
    }
  }

  return {
    id: "SHARED-P0.3",
    title: "Service Role banida de endpoints humanos",
    contract_ref: "agents/specs/FEATURES_PRIORITY.json → SHARED-P0.3",
    status: findings.length === 0 ? "PASS" : "FAIL",
    findings,
  }
}

// CHECK 2: count: "exact" em rotas de dashboard/lista
function checkExactCount(apiRoutes) {
  const findings = []

  for (const { file, content } of apiRoutes) {
    if (/count:\s*["']exact["']/.test(content)) {
      findings.push({
        id: "PILAR-A",
        severity: "HIGH",
        status: "FAIL",
        file,
        note: "count: 'exact' detectado — proibido em produção (usar MV de contagem)",
        fix: "Substituir por SELECT COUNT(*) na MV correspondente ou remover contagem",
      })
    }
  }

  return {
    id: "PILAR-A-EXACT-COUNT",
    title: "Pilar A — zero count: 'exact' em produção",
    contract_ref: "agents/specs/performance.md → Pilar A",
    status: findings.length === 0 ? "PASS" : "FAIL",
    findings,
  }
}

// CHECK 3: force-cache em rotas operacionais
function checkForceCache(apiRoutes) {
  const findings = []

  for (const { file, content } of apiRoutes) {
    if (/force-cache/.test(content)) {
      findings.push({
        id: "PILAR-C",
        severity: "HIGH",
        status: "FAIL",
        file,
        note: "force-cache detectado em rota operacional — nunca permitido em dados de trabalho",
        fix: "Substituir por cache: 'no-store' (dados financeiros/académicos) ou revalidate (configs)",
      })
    }
  }

  return {
    id: "PILAR-C-FORCE-CACHE",
    title: "Pilar C — force-cache ausente em rotas operacionais",
    contract_ref: "agents/specs/performance.md → Pilar C",
    status: findings.length === 0 ? "PASS" : "FAIL",
    findings,
  }
}

// CHECK 4: no-store em layouts/configs (deviam ter revalidate)
function checkNoStoreInLayouts(components) {
  const findings = []

  for (const { file, content } of components) {
    const shouldUseRevalidate = REVALIDATE_PREFERRED_PATTERNS.some((p) => p.test(file))
    if (!shouldUseRevalidate) continue

    if (/cache:\s*["']no-store["']/.test(content)) {
      findings.push({
        id: "NO_STORE_AUDIT",
        severity: "INFO",
        status: "WARN",
        file,
        note: "no-store em componente de configuração/layout — revalidate seria mais eficiente",
        fix: "Substituir por revalidate: 300 (layout/branding) ou revalidate: 60 (status)",
      })
    }
  }

  return {
    id: "NO_STORE_AUDIT",
    title: "Cache — auditoria de no-store em layouts e configs",
    contract_ref: "agents/specs/performance.md → Pilar C (tabela de cache por tipo de dado)",
    status: findings.length === 0 ? "PASS" : findings.length <= 3 ? "WARN" : "NEEDS_AUDIT",
    findings,
  }
}

// CHECK 5: MVs com todos os artefactos obrigatórios
function checkMaterializedViews(allMigrations) {
  const results = []

  for (const mv of REQUIRED_MVS) {
    const hasMV = allMigrations.includes(mv.id)
    const hasIndex = allMigrations.includes(mv.index)
    const hasRefreshFn = allMigrations.includes(mv.refresh_fn)
    const hasWrapper = allMigrations.includes(mv.wrapper)
    const hasCron = allMigrations.includes("cron.schedule") &&
      allMigrations.includes(mv.cron_contains)

    const missing = []
    if (!hasMV) missing.push("MV não encontrada")
    if (!hasIndex) missing.push(`UNIQUE INDEX ${mv.index} não encontrado`)
    if (!hasRefreshFn) missing.push(`função ${mv.refresh_fn} não encontrada`)
    if (!hasWrapper) missing.push(`wrapper ${mv.wrapper} não encontrado`)
    if (!hasCron) missing.push(`cron.schedule para ${mv.cron_contains} não encontrado`)

    results.push({
      mv: mv.id,
      contract_ref: mv.contract_ref,
      status: missing.length === 0 ? "PASS" : missing.length <= 2 ? "PARTIAL" : "FAIL",
      missing,
      fix: missing.length > 0
        ? `Criar migration com: ${missing.join("; ")}`
        : null,
    })
  }

  const allPass = results.every((r) => r.status === "PASS")
  const anyFail = results.some((r) => r.status === "FAIL")

  return {
    id: "MV_CHECK",
    title: "Materialized Views — artefactos obrigatórios (MV + INDEX + refresh + wrapper + cron)",
    contract_ref: "agents/specs/performance.md → Pilar A + Regras operacionais para MVs",
    status: allPass ? "PASS" : anyFail ? "FAIL" : "PARTIAL",
    results,
  }
}

// CHECK 6: Plan guards (backend + UI em simultâneo)
function checkPlanGuards(apiRoutes, components) {
  const findings = []

  for (const feature of PREMIUM_FEATURES) {
    for (const routePattern of feature.backend_routes) {
      const matchingRoutes = apiRoutes.filter(({ file }) => file.includes(routePattern))

      for (const { file, content } of matchingRoutes) {
        const hasBackendGuard =
          /requireFeature/.test(content) ||
          /checkPlan/.test(content) ||
          /planGuard/.test(content)

        if (!hasBackendGuard) {
          findings.push({
            id: "PLAN_GUARD",
            severity: "HIGH",
            status: "FAIL",
            file,
            feature: feature.feature,
            note: `Backend guard ausente para feature '${feature.feature}' — bypassável via HTTP directo`,
            fix: `Adicionar: const planCheck = await requireFeature(supabase, escolaId, '${feature.feature}')\nif (!planCheck.allowed) return NextResponse.json({ ok: false, error: 'Plano não inclui esta funcionalidade' }, { status: 403 })`,
          })
        }
      }
    }

    for (const componentPattern of feature.ui_components) {
      const matchingComponents = components.filter(({ file }) => file.includes(componentPattern))

      for (const { file, content } of matchingComponents) {
        const hasUIGuard =
          /usePlanFeature/.test(content) ||
          /planFeature/.test(content) ||
          /requireFeature/.test(content) ||
          /feature.*guard/i.test(content)

        if (!hasUIGuard) {
          findings.push({
            id: "PLAN_GUARD",
            severity: "MEDIUM",
            status: "WARN",
            file,
            feature: feature.feature,
            note: `UI guard ausente para feature '${feature.feature}' — utilizador pode ver UI de feature que não tem`,
            fix: `Adicionar usePlanFeature('${feature.feature}') e condicionar renderização`,
          })
        }
      }
    }
  }

  return {
    id: "PLAN_GUARD",
    title: "Controlo de planos — backend guard + UI guard obrigatórios em simultâneo",
    contract_ref: "agents/specs/FEATURES_PRIORITY.json → SHARED-P0.2 + SEC-P0.2",
    status: findings.filter((f) => f.status === "FAIL").length > 0
      ? "FAIL"
      : findings.length > 0 ? "WARN" : "PASS",
    findings,
  }
}

// CHECK 7: Audit Trail cobertura mínima
function checkAuditTrail(allMigrations, apiRoutes) {
  const requiredTables = ["matriculas", "notas", "pagamentos", "frequencias", "fecho_caixa", "curriculo"]
  const coverage = {}

  for (const table of requiredTables) {
    coverage[table] = allMigrations.includes(`audit_log`) &&
      allMigrations.includes(table)
  }

  const auditLogExists = allMigrations.includes("audit_logs")
  const requiredFields = ["actor", "action", "entity", "before", "after", "ip", "created_at"]
  const missingFields = requiredFields.filter((f) => !allMigrations.includes(f))

  const uncoveredTables = Object.entries(coverage)
    .filter(([, covered]) => !covered)
    .map(([table]) => table)

  return {
    id: "GF4",
    title: "GF4 — Audit Trail (cobertura + schema padronizado)",
    contract_ref: "agents/specs/FEATURES_PRIORITY.json → SHARED-P0.4",
    status: !auditLogExists ? "FAIL" : missingFields.length > 0 || uncoveredTables.length > 0 ? "PARTIAL" : "PASS",
    audit_log_exists: auditLogExists,
    schema_fields_missing: missingFields,
    tables_coverage: coverage,
    note: missingFields.length > 0
      ? `Schema incompleto — campos em falta: ${missingFields.join(", ")}`
      : "Schema OK",
  }
}

// CHECK 8: Global Search invariants (KF2)
function checkGlobalSearch(components) {
  const searchHook = components.find(({ file }) => file.includes("useGlobalSearch"))
  const searchComponent = components.find(({ file }) => file.includes("GlobalSearch"))

  if (!searchHook) {
    return {
      id: "KF2",
      title: "KF2 — Pesquisa Global",
      status: "FAIL",
      note: "useGlobalSearch não encontrado",
    }
  }

  const content = searchHook.content
  const hasDebounce = /debounce/i.test(content)
  const hasLimit = /limit.*[<=>].*50|50.*limit/i.test(content) || /\.limit\(\s*[1-4]?\d\s*\)/.test(content)
  const hasMinChars = /\.length\s*[<>]=?\s*[23]|minLength|min_length/i.test(content)

  const componentContent = searchComponent?.content || ""
  const hasDebounceInComponent = /debounce/i.test(componentContent)

  const issues = []
  if (!hasDebounce && !hasDebounceInComponent) issues.push("debounce não detectado (recomendado 250–400ms)")
  if (!hasLimit) issues.push("limit > 50 possível — verificar clamp")
  if (!hasMinChars) issues.push("mínimo de caracteres não detectado — pode disparar query com 1 char")

  return {
    id: "KF2",
    title: "KF2 — Pesquisa Global (Command Palette)",
    contract_ref: "ROADMAP.md → Busca global p95 ≤ 300ms",
    status: issues.length === 0 ? "PASS" : "WARN",
    issues,
    files_found: {
      hook: searchHook?.file,
      component: searchComponent?.file,
    },
  }
}

// CHECK 9: Spinner global em páginas de trabalho
function checkGlobalSpinner(components) {
  const findings = []
  const pageFiles = components.filter(({ file }) =>
    file.includes("/page.tsx") || file.includes("Client.tsx") || file.includes("Page.tsx")
  )

  for (const { file, content } of pageFiles) {
    const hasGlobalSpinner =
      /if\s*\(loading\).*return.*Loader2|return.*loading.*Loader2/s.test(content) &&
      !/inline|h-3|h-4|w-3|w-4/.test(content.match(/Loader2[^)]{0,200}/)?.[0] || "")

    if (hasGlobalSpinner) {
      findings.push({
        file,
        severity: "MEDIUM",
        note: "Possível spinner global detectado — deve ser substituído por skeleton idêntico ao conteúdo",
        fix: "Usar <Skeleton /> idêntico à tabela/lista. Loader2 apenas inline em botões.",
      })
    }
  }

  return {
    id: "PILAR-C-SPINNER",
    title: "Pilar C — sem spinner global em páginas de trabalho",
    contract_ref: "agents/specs/performance.md → Pilar C",
    status: findings.length === 0 ? "PASS" : "WARN",
    findings,
  }
}

// CHECK 10: Idempotency keys em mutations críticas
function checkIdempotencyKeys(apiRoutes) {
  const criticalMutationPatterns = [
    "notas", "frequencias", "pagamentos", "recibos/emitir",
    "fecho", "matriculas/create", "mensalidades",
  ]

  const findings = []

  for (const pattern of criticalMutationPatterns) {
    const matchingRoutes = apiRoutes.filter(({ file }) =>
      file.includes(pattern) && file.endsWith("route.ts")
    )

    for (const { file, content } of matchingRoutes) {
      const isPostRoute = /export async function POST/.test(content)
      if (!isPostRoute) continue

      const hasIdempotency =
        /Idempotency-Key/i.test(content) ||
        /idempotency_key/i.test(content) ||
        /idempotencyKey/i.test(content)

      if (!hasIdempotency) {
        findings.push({
          file,
          severity: "MEDIUM",
          status: "WARN",
          note: `Mutation crítica sem Idempotency-Key — retry pode criar duplicados`,
          fix: `Adicionar: const idempotencyKey = req.headers.get('Idempotency-Key')\nVerificar duplicado antes de processar.`,
        })
      }
    }
  }

  return {
    id: "PILAR-B-IDEMPOTENCY",
    title: "Pilar B — Idempotency-Key em mutations críticas",
    contract_ref: "agents/specs/performance.md → Pilar B",
    status: findings.length === 0 ? "PASS" : findings.length <= 2 ? "WARN" : "PARTIAL",
    findings,
  }
}

// ─── Runner ───────────────────────────────────────────────────────────────────

async function run() {
  console.log("🔍 KLASSE — Validador de Contratos v1.1")
  console.log("========================================")
  console.log(`�� Root: ${ROOT}`)
  console.log("")

  console.log("📖 A ler ficheiros...")
  const apiRoutes = readAllApiRoutes()
  const components = readAllComponents()
  const allMigrations = readAllMigrations()
  const layouts = readFiles(LAYOUTS_GLOB)

  console.log(`   ${apiRoutes.length} rotas de API`)
  console.log(`   ${components.length} componentes/hooks`)
  console.log(`   ${glob.sync(MIGRATIONS_GLOB, { cwd: ROOT }).length} migrations`)
  console.log("")

  console.log("🔎 A executar checks...")

  const checks = [
    checkServiceRole(apiRoutes),
    checkExactCount(apiRoutes),
    checkForceCache(apiRoutes),
    checkNoStoreInLayouts([...components, ...layouts]),
    checkMaterializedViews(allMigrations),
    checkPlanGuards(apiRoutes, components),
    checkAuditTrail(allMigrations, apiRoutes),
    checkGlobalSearch(components),
    checkGlobalSpinner(components),
    checkIdempotencyKeys(apiRoutes),
  ]

  // ─── Sumário ────────────────────────────────────────────────────────────────

  let critical = 0, high = 0, medium = 0, low = 0, warn = 0, pass = 0

  for (const check of checks) {
    const status = check.status?.toUpperCase()
    if (status === "FAIL") {
      const hasCritical = check.findings?.some((f) => f.severity === "CRITICAL")
      if (hasCritical) critical++
      else high++
    } else if (status === "PARTIAL") medium++
    else if (status === "WARN" || status === "NEEDS_AUDIT") warn++
    else if (status === "PASS") pass++
  }

  const blockerForPilot = checks.filter((c) =>
    ["SHARED-P0.3", "PLAN_GUARD", "MV_CHECK", "PILAR-A-EXACT-COUNT"].includes(c.id) &&
    ["FAIL", "PARTIAL"].includes(c.status?.toUpperCase())
  )

  const pilotGo = blockerForPilot.length === 0

  // ─── Consola ────────────────────────────────────────────────────────────────

  console.log("")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log(`PILOT READINESS: ${pilotGo ? "✅ GO" : "🔴 NO-GO"}`)
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log(`PASS:     ${pass}`)
  console.log(`WARN:     ${warn}`)
  console.log(`PARTIAL:  ${medium}`)
  console.log(`FAIL:     ${high}`)
  console.log(`CRITICAL: ${critical}`)

  if (blockerForPilot.length > 0) {
    console.log("")
    console.log("🔴 BLOCKERS ACTIVOS:")
    for (const b of blockerForPilot) {
      console.log(`   - [${b.id}] ${b.title}`)
    }
  }

  console.log("")

  // ─── Relatório Markdown ─────────────────────────────────────────────────────

  const lines = []
  lines.push("# KLASSE — Relatório de Validação de Contratos")
  lines.push(`> Gerado em: ${new Date().toISOString()}  `)
  lines.push(`> Contratos: agents/specs/performance.md v1.1 · agents/ops/PILOT_CHECKLIST.md v1.2 · agents/specs/FEATURES_PRIORITY.json v1.2`)
  lines.push("")
  lines.push("## Sumário")
  lines.push("")
  lines.push(`| Status | Count |`)
  lines.push(`|--------|-------|`)
  lines.push(`| ✅ PASS | ${pass} |`)
  lines.push(`| ⚠️ WARN | ${warn} |`)
  lines.push(`| 🟡 PARTIAL | ${medium} |`)
  lines.push(`| 🔴 FAIL | ${high} |`)
  lines.push(`| 🚨 CRITICAL | ${critical} |`)
  lines.push("")
  lines.push(`## Pilot Readiness: ${pilotGo ? "✅ GO" : "🔴 NO-GO"}`)
  lines.push("")

  if (blockerForPilot.length > 0) {
    lines.push("### Blockers activos")
    for (const b of blockerForPilot) {
      lines.push(`- **[${b.id}]** ${b.title} — Status: \`${b.status}\``)
    }
    lines.push("")
  }

  lines.push("---")
  lines.push("")
  lines.push("## Checks Detalhados")
  lines.push("")

  for (const check of checks) {
    const icon = check.status === "PASS" ? "✅"
      : check.status === "FAIL" ? "🔴"
      : check.status === "PARTIAL" ? "🟡"
      : check.status === "WARN" ? "⚠️"
      : "ℹ️"

    lines.push(`### ${icon} [${check.id}] ${check.title}`)
    lines.push(`**Status:** \`${check.status}\`  `)
    lines.push(`**Contrato:** ${check.contract_ref || "—"}`)
    lines.push("")

    if (check.id === "MV_CHECK" && check.results) {
      lines.push("| MV | INDEX | Refresh Fn | Wrapper | Cron | Status |")
      lines.push("|---|---|---|---|---|---|")
      for (const r of check.results) {
        lines.push(`| \`${r.mv}\` | ${r.missing.includes("INDEX") ? "❌" : "✅"} | ${r.missing.some(m => m.includes("função")) ? "❌" : "✅"} | ${r.missing.some(m => m.includes("wrapper")) ? "❌" : "✅"} | ${r.missing.some(m => m.includes("cron")) ? "❌" : "✅"} | \`${r.status}\` |`)
        if (r.fix) lines.push(`> Fix: ${r.fix}`)
      }
      lines.push("")
      continue
    }

    if (check.id === "GF4") {
      lines.push(`- Audit log existe: ${check.audit_log_exists ? "✅" : "❌"}`)
      if (check.schema_fields_missing?.length > 0) {
        lines.push(`- Campos em falta no schema: \`${check.schema_fields_missing.join("\`, \`")}\``)
      }
      lines.push("")
      continue
    }

    if (check.id === "KF2") {
      if (check.files_found) {
        lines.push(`- Hook: \`${check.files_found.hook || "não encontrado"}\``)
        lines.push(`- Componente: \`${check.files_found.component || "não encontrado"}\``)
      }
      if (check.issues?.length > 0) {
        for (const issue of check.issues) lines.push(`- ⚠️ ${issue}`)
      }
      lines.push("")
      continue
    }

    if (check.id === "NO_STORE_AUDIT") {
      if (check.findings?.length > 0) {
        lines.push("| Ficheiro | Recomendação |")
        lines.push("|----------|-------------|")
        for (const f of check.findings) {
          lines.push(`| \`${f.file}\` | ${f.fix} |`)
        }
      } else {
        lines.push("Nenhum ficheiro de layout/config com no-store detectado. ✅")
      }
      lines.push("")
      continue
    }

    const findings = check.findings || []
    if (findings.length === 0) {
      lines.push("Nenhum problema detectado. ✅")
    } else {
      for (const f of findings) {
        const fIcon = f.status === "FAIL" ? "🔴" : f.status === "WARN" ? "⚠️" : "ℹ️"
        lines.push(`${fIcon} \`${f.file}\``)
        lines.push(`> ${f.note}`)
        if (f.fix) lines.push(`> **Fix:** ${f.fix}`)
        lines.push("")
      }
    }
    lines.push("")
  }

  lines.push("---")
  lines.push("")
  lines.push("## Plano de Acção")
  lines.push("")
  lines.push("### Antes do Piloto (blockers)")

  const beforePilot = checks
    .filter((c) => ["SHARED-P0.3", "PLAN_GUARD", "MV_CHECK", "PILAR-A-EXACT-COUNT", "PILAR-C-FORCE-CACHE"].includes(c.id))
    .filter((c) => c.status !== "PASS")

  if (beforePilot.length === 0) {
    lines.push("Nenhum blocker activo. Sistema pronto para piloto. ✅")
  } else {
    for (const c of beforePilot) {
      lines.push(`- **[${c.id}]** ${c.title}`)
    }
  }

  lines.push("")
  lines.push("### Após o Piloto (melhorias)")

  const afterPilot = checks
    .filter((c) => ["NO_STORE_AUDIT", "GF4", "PILAR-B-IDEMPOTENCY", "PILAR-C-SPINNER"].includes(c.id))
    .filter((c) => c.status !== "PASS")

  if (afterPilot.length === 0) {
    lines.push("Nenhuma melhoria pendente. ✅")
  } else {
    for (const c of afterPilot) {
      lines.push(`- **[${c.id}]** ${c.title} — \`${c.status}\``)
    }
  }

  // ─── Escrever ficheiros ──────────────────────────────────────────────────────

  writeFileSync(REPORT_PATH, lines.join("\n"), "utf8")
  console.log(`📄 Relatório Markdown: ${REPORT_PATH}`)

  const jsonReport = {
    timestamp: new Date().toISOString(),
    version: "1.1",
    repoRoot: ROOT,
    summary: { critical, high, medium, warn, pass, total: checks.length },
    pilot_readiness: pilotGo ? "GO" : "NO-GO",
    blockers: blockerForPilot.map((b) => ({ id: b.id, title: b.title, status: b.status })),
    checks,
  }
  writeFileSync(JSON_REPORT_PATH, JSON.stringify(jsonReport, null, 2), "utf8")
  console.log(`📊 Relatório JSON: ${JSON_REPORT_PATH}`)
  console.log("")
  console.log("✅ Validação concluída.")
}

run().catch((e) => {
  console.error("❌ Erro no validador:", e.message)
  process.exit(1)
})
