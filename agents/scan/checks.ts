import path from "node:path";
import { readFileSync } from "node:fs";
import type { Finding, PatchPlanItem } from "./types";

function fileText(repoRoot: string, rel: string): string | null {
  try {
    return readFileSync(path.join(repoRoot, rel), "utf8");
  } catch {
    return null;
  }
}

function anyFileMatches(files: string[], re: RegExp) {
  return files.some((f) => re.test(f));
}

function findFilesByName(files: string[], name: string) {
  return files.filter((f) => f.endsWith(`/${name}`) || f === name);
}

function containsPatternInAnyFile(repoRoot: string, files: string[], re: RegExp) {
  const hits: Array<{ file: string; note: string }> = [];
  for (const file of files) {
    if (!/\.(ts|tsx|js|jsx|sql|md|json)$/.test(file)) continue;
    const text = fileText(repoRoot, file);
    if (!text) continue;
    if (re.test(text)) hits.push({ file, note: `match: ${re}` });
  }
  return hits;
}

function buildDocPlan(id: string, title: string, body: string): PatchPlanItem {
  return {
    id,
    priority: 2,
    type: "DOC",
    title,
    rationale: "Planejar ajustes com revisão manual.",
    files: [
      {
        path: `agents/outputs/${id}.md`,
        action: "CREATE",
        content: body,
      },
    ],
    safety: { destructive: false, requires_manual_review: true },
  };
}

export async function runChecks(opts: { repoRoot: string; files: string[]; contractsDir: string }) {
  const { repoRoot, files } = opts;
  const findings: Finding[] = [];
  const plan: PatchPlanItem[] = [];
  const sqlFiles = files.filter((file) => file.endsWith('.sql'));

  const findSqlEvidence = (regex: RegExp) => {
    const hits: Array<{ file: string; note: string }> = [];
    for (const file of sqlFiles) {
      const text = fileText(repoRoot, file);
      if (!text) continue;
      if (regex.test(text)) {
        hits.push({ file, note: `match: ${regex}` });
        if (hits.length >= 5) break;
      }
    }
    return hits;
  };

  const hasManifest = anyFileMatches(files, /(^|\/)public\/manifest\.json$/);
  const hasSw = anyFileMatches(files, /(^|\/)public\/sw\.js$/) || anyFileMatches(files, /service-worker/i);
  const hasNextPwa = containsPatternInAnyFile(repoRoot, files, /next-pwa|withPWA/i);

  if (!hasManifest && !hasSw && !hasNextPwa.length) {
    findings.push({
      id: "GF1",
      title: "GF1 — PWA Offline-First ausente",
      severity: "HIGH",
      status: "MISSING",
      evidence: [{ file: "-", note: "Nenhuma evidência de manifest/SW/next-pwa" }],
      recommendation: "Implementar PWA mínimo: manifest + SW read-only + offline fallback (sem sync bidirecional).",
    });

    plan.push({
      id: "PATCH_GF1_PWA_MIN",
      priority: 0,
      type: "PWA_PUBLIC_FILES",
      title: "GF1 PWA mínimo (manifest + SW read-only + offline fallback)",
      rationale: "P0: melhora percepção de estabilidade e reduz impacto de internet ruim em Angola.",
      files: [
        {
          path: "apps/web/public/manifest.json",
          action: "CREATE",
          content: JSON.stringify(
            {
              name: "Klasse",
              short_name: "Klasse",
              start_url: "/",
              display: "standalone",
              background_color: "#020617",
              theme_color: "#1F6B3B",
              icons: [
                { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
                { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
              ],
            },
            null,
            2
          ),
        },
        {
          path: "apps/web/public/offline.html",
          action: "CREATE",
          content:
            "<!doctype html><html><head><meta charset=\"utf-8\"/><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"/><title>Klasse — Offline</title></head><body style=\"font-family:system-ui;background:#020617;color:#fff;padding:24px\"><h1>Você está offline</h1><p>Klasse precisa de conexão para algumas ações, mas você ainda pode navegar em telas cacheadas.</p></body></html>",
        },
        {
          path: "apps/web/public/sw.js",
          action: "CREATE",
          content:
            "const CACHE=\"klasse-static-v1\";const OFFLINE_URL=\"/offline.html\";self.addEventListener(\"install\",(event)=>{event.waitUntil((async()=>{const cache=await caches.open(CACHE);await cache.addAll([OFFLINE_URL,\"/manifest.json\"]);self.skipWaiting();})());});self.addEventListener(\"activate\",(event)=>{event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter((k)=>k!==CACHE).map((k)=>caches.delete(k)));self.clients.claim();})());});self.addEventListener(\"fetch\",(event)=>{const req=event.request;if(req.method!==\"GET\")return;event.respondWith((async()=>{try{const res=await fetch(req);if(new URL(req.url).origin===location.origin&&res.ok){const cache=await caches.open(CACHE);cache.put(req,res.clone());}return res;}catch{const cached=await caches.match(req);return cached||caches.match(OFFLINE_URL);}})());});",
        },
      ],
      safety: { destructive: false, requires_manual_review: true },
    });
  }

  const hasVirtualLib =
    containsPatternInAnyFile(repoRoot, files, /react-window|@tanstack\/react-virtual|react-virtual/i).length > 0;

  if (!hasVirtualLib) {
    findings.push({
      id: "VIRTUALIZATION",
      title: "PERF_BASE — Virtualização de listas ausente",
      severity: "HIGH",
      status: "MISSING",
      evidence: [{ file: "-", note: "Nenhuma lib/uso detectado" }],
      recommendation: "Escolher UMA lib (react-window ou tanstack-virtual) e aplicar em Alunos/Matrículas/Transações.",
    });

    plan.push({
      id: "PATCH_VIRTUALIZATION_DEP",
      priority: 1,
      type: "DEPENDENCY",
      title: "Adicionar lib única de virtualização",
      rationale: "P0: lista grande sem virtualização vira lag real em escola com 300+ alunos.",
      files: [
        {
          path: "apps/web/package.json",
          action: "UPDATE",
          patch: { find: "\"dependencies\": {", replace: "\"dependencies\": {\n    \"@tanstack/react-virtual\": \"^3.13.1\"," },
        },
      ],
      safety: { destructive: false, requires_manual_review: true },
    });
  }

  const noStoreHits = containsPatternInAnyFile(repoRoot, files, /cache:\s*['\"]no-store['\"]/i);
  const allowedNoStore = new Set([
    "AGENTS.md",
    "apps/web/src/app/api/auth/login/route.ts",
  ]);
  const disallowedNoStore = noStoreHits.filter((hit) => !allowedNoStore.has(hit.file));
  if (disallowedNoStore.length) {
    findings.push({
      id: "NO_STORE",
      title: "Anti-pattern — uso de cache: 'no-store' em páginas/relatórios",
      severity: "HIGH",
      status: "PARTIAL",
      evidence: disallowedNoStore.slice(0, 25),
      recommendation: "Remover no-store onde houver MV/camadas cacheáveis; manter só em rotas realmente sensíveis.",
    });

    const lines = [
      "# Plano — Remoção de cache no-store",
      "",
      "Arquivos com `cache: 'no-store'` detectados:",
      "",
      ...disallowedNoStore.map((hit) => `- ${hit.file}`),
      "",
      "Ação recomendada:",
      "- Revisar caso a caso e substituir por cache adequado (revalidate/force-cache) ou remover fetch desnecessário.",
    ];
    plan.push(buildDocPlan("PLAN_NO_STORE", "Plano de revisão de no-store", lines.join("\n")));
  }

  const globalSearchFiles = findFilesByName(files, "GlobalSearch.tsx");
  const hookFiles = [
    ...findFilesByName(files, "useGlobalSearch.ts"),
    ...findFilesByName(files, "useGlobalSearch.tsx"),
  ];
  if (globalSearchFiles.length) {
    const file = globalSearchFiles[0];
    const text = fileText(repoRoot, file) || "";
    const hookText = hookFiles.map((f) => fileText(repoRoot, f) || "").join("\n");
    const hasDebounce = /useDebounce\(/.test(text) || /useDebounce\(/.test(hookText) || /debounce/.test(hookText);
    const usesMinRpc = /search_alunos_global_min/.test(hookText);
    const hasLimitClamp = /Math\.min\([^\)]*50/.test(hookText);
    const hasOrderTieBreak = findSqlEvidence(/ORDER\s+BY[\s\S]*id\s+DESC/i).length > 0;
    const severity = hasDebounce && usesMinRpc && hasLimitClamp && hasOrderTieBreak ? "LOW" : "HIGH";
    const status = severity === "LOW" ? "VALIDATED" : "PARTIAL";
    const evidence = [
      { file, note: `debounce detectado (hook/client): ${hasDebounce ? "sim" : "não"}` },
      { file: hookFiles[0] ?? file, note: `rpc min: ${usesMinRpc ? "sim" : "não"}` },
      { file: hookFiles[0] ?? file, note: `limit clamp <= 50: ${hasLimitClamp ? "sim" : "não"}` },
      { file: "supabase/migrations", note: `ORDER BY id DESC: ${hasOrderTieBreak ? "sim" : "não"}` },
    ];
    if (hookFiles.length) {
      evidence.push({ file: hookFiles[0], note: "useGlobalSearch encontrado" });
    }
    findings.push({
      id: "KF2",
      title: "KF2 — Pesquisa Global (Command Palette) invariants",
      severity,
      status,
      evidence,
      recommendation: "KF2 deve ter debounce 250–400ms, limit<=50, orderBy estável e payload mínimo.",
    });

    if (!hasDebounce) {
      const lines = [
        "# Plano — KF2 debounce",
        "",
        `Arquivo alvo: ${file}`,
        "",
        "Ação recomendada:",
        "- Introduzir debounce 250–400ms na busca (ex.: useDebounce).",
      ];
      plan.push(buildDocPlan("PLAN_KF2_DEBOUNCE", "Plano para adicionar debounce KF2", lines.join("\n")));
    }
  } else {
    findings.push({
      id: "KF2",
      title: "KF2 — Pesquisa Global não localizada",
      severity: "HIGH",
      status: "PARTIAL",
      evidence: [{ file: "-", note: "GlobalSearch/CommandPalette não encontrado por nome" }],
      recommendation: "Ajustar detector: procurar por useGlobalSearch + Ctrl/Cmd+K handlers.",
    });
  }

  const auditHits = containsPatternInAnyFile(repoRoot, files, /audit_logs|auditLog|create_audit/i);
  if (auditHits.length) {
    const hasAuditTriggerFn = containsPatternInAnyFile(repoRoot, files, /audit_dml_trigger\s*\(/i).length > 0;
    const hasBeforeAfterUpdate =
      containsPatternInAnyFile(repoRoot, files, /before\s+jsonb|after\s+jsonb/i).length > 0;
    const hasActorRole = containsPatternInAnyFile(repoRoot, files, /actor_role/i).length > 0;
    const hasCreateAudit = containsPatternInAnyFile(repoRoot, files, /create_audit_event\s*\(/i).length > 0;
    const hasFinanceTriggers =
      containsPatternInAnyFile(repoRoot, files, /trg_audit_financeiro_(cobrancas|estornos|lancamentos|titulos)/i).length > 0;
    const hasCoreTriggers =
      containsPatternInAnyFile(repoRoot, files, /trg_audit_(matriculas|cursos|turmas|mensalidades)/i).length > 0;
    const severity =
      hasAuditTriggerFn && hasBeforeAfterUpdate && hasActorRole && hasCreateAudit && hasFinanceTriggers && hasCoreTriggers
        ? "LOW"
        : "HIGH";
    const status = severity === "LOW" ? "VALIDATED" : "PARTIAL";
    findings.push({
      id: "GF4",
      title: "GF4 — Audit Trail (parcial/validar cobertura before/after)",
      severity,
      status,
      evidence: auditHits.slice(0, 25),
      recommendation:
        "Padronizar schema: actor, action, entity, before, after, ip, created_at; garantir coverage financeiro/matrícula.",
    });

    const lines = [
      "# Plano — Audit Trail",
      "",
      "Ação recomendada:",
      "- Validar cobertura before/after nas mutações críticas (financeiro/matrículas).",
      "- Confirmar campos mínimos: actor, action, entity, before, after, ip, created_at.",
    ];
    plan.push(buildDocPlan("PLAN_AUDIT_TRAIL", "Plano de revisão do audit trail", lines.join("\n")));
  }

  const mvHitsF09 = findSqlEvidence(/CREATE\s+MATERIALIZED\s+VIEW\s+public\.mv_radar_inadimplencia/i);
  const mvHitsF18 = findSqlEvidence(/CREATE\s+MATERIALIZED\s+VIEW\s+public\.mv_pagamentos_status/i);
  const f09Index = findSqlEvidence(/CREATE\s+UNIQUE\s+INDEX\s+.*ux_mv_radar_inadimplencia/i);
  const f18Index = findSqlEvidence(/CREATE\s+UNIQUE\s+INDEX\s+.*ux_mv_pagamentos_status/i);
  const f09Refresh = findSqlEvidence(/refresh_mv_radar_inadimplencia\s*\(/i);
  const f18Refresh = findSqlEvidence(/refresh_mv_pagamentos_status\s*\(/i);
  const f09View = findSqlEvidence(/CREATE\s+OR\s+REPLACE\s+VIEW\s+public\.vw_radar_inadimplencia/i);
  const f18View = findSqlEvidence(/CREATE\s+OR\s+REPLACE\s+VIEW\s+public\.pagamentos_status/i);
  const f09Cron = findSqlEvidence(/cron\.schedule\(\'refresh_mv_radar_inadimplencia/i);
  const f18Cron = findSqlEvidence(/cron\.schedule\(\'refresh_mv_pagamentos_status/i);

  const f09Ok = mvHitsF09.length && f09Index.length && f09Refresh.length && f09View.length && f09Cron.length;
  findings.push({
    id: "F09_MV",
    title: "F09 — Radar de Inadimplência com MATERIALIZED VIEW",
    severity: f09Ok ? "LOW" : "HIGH",
    status: f09Ok ? "VALIDATED" : "PARTIAL",
    evidence: [...mvHitsF09, ...f09Index, ...f09Refresh, ...f09View, ...f09Cron].slice(0, 8),
    recommendation: "Garantir MV + UNIQUE INDEX + refresh function + cron job + view wrapper.",
  });

  const f18Ok = mvHitsF18.length && f18Index.length && f18Refresh.length && f18View.length && f18Cron.length;
  findings.push({
    id: "F18_MV",
    title: "F18 — Caixa/Propinas com MATERIALIZED VIEW",
    severity: f18Ok ? "LOW" : "HIGH",
    status: f18Ok ? "VALIDATED" : "PARTIAL",
    evidence: [...mvHitsF18, ...f18Index, ...f18Refresh, ...f18View, ...f18Cron].slice(0, 8),
    recommendation: "Garantir MV + UNIQUE INDEX + refresh function + cron job + view wrapper.",
  });

  const mvDashRules = [
    {
      id: "SECRETARIA_COUNTS",
      mv: /mv_secretaria_dashboard_counts/i,
      index: /ux_mv_secretaria_dashboard_counts/i,
      refresh: /refresh_mv_secretaria_dashboard_counts/i,
      view: /vw_secretaria_dashboard_counts/i,
      cronName: "refresh_mv_secretaria_dashboard_counts",
    },
    {
      id: "SECRETARIA_STATUS",
      mv: /mv_secretaria_matriculas_status/i,
      index: /ux_mv_secretaria_matriculas_status/i,
      refresh: /refresh_mv_secretaria_matriculas_status/i,
      view: /vw_secretaria_matriculas_status/i,
      cronName: "refresh_mv_secretaria_matriculas_status",
    },
    {
      id: "SECRETARIA_TURMA_STATUS",
      mv: /mv_secretaria_matriculas_turma_status/i,
      index: /ux_mv_secretaria_matriculas_turma_status/i,
      refresh: /refresh_mv_secretaria_matriculas_turma_status/i,
      view: /vw_secretaria_matriculas_turma_status/i,
      cronName: "refresh_mv_secretaria_matriculas_turma_status",
    },
    {
      id: "ADMIN_COUNTS",
      mv: /mv_admin_dashboard_counts/i,
      index: /ux_mv_admin_dashboard_counts/i,
      refresh: /refresh_mv_admin_dashboard_counts/i,
      view: /vw_admin_dashboard_counts/i,
      cronName: "refresh_mv_admin_dashboard_counts",
    },
    {
      id: "ADMIN_MATRICULAS",
      mv: /mv_admin_matriculas_por_mes/i,
      index: /ux_mv_admin_matriculas_por_mes/i,
      refresh: /refresh_mv_admin_matriculas_por_mes/i,
      view: /vw_admin_matriculas_por_mes/i,
      cronName: "refresh_mv_admin_matriculas_por_mes",
    },
    {
      id: "CURSOS_REAIS",
      mv: /mv_cursos_reais/i,
      index: /ux_mv_cursos_reais/i,
      refresh: /refresh_mv_cursos_reais/i,
      view: /vw_cursos_reais/i,
      cronName: "refresh_mv_cursos_reais",
    },
  ];

  const mvDashEvidence: Array<{ file: string; note: string }> = [];
  const mvDashMissing: string[] = [];
  for (const rule of mvDashRules) {
    const mv = findSqlEvidence(rule.mv);
    const index = findSqlEvidence(rule.index);
    const refresh = findSqlEvidence(rule.refresh);
    const view = findSqlEvidence(rule.view);
    const cron = findSqlEvidence(new RegExp(`cron\\.schedule\\(['\"]${rule.cronName}['\"]`, "i"));
    if (!mv.length || !index.length || !refresh.length || !view.length || !cron.length) {
      mvDashMissing.push(rule.id);
    }
    mvDashEvidence.push(...mv, ...index, ...refresh, ...view, ...cron);
  }

  findings.push({
    id: "P0_3_MV_DASHBOARDS",
    title: "P0.3 — Dashboards Secretaria/Admin em MATERIALIZED VIEW",
    severity: mvDashMissing.length ? "HIGH" : "LOW",
    status: mvDashMissing.length ? "PARTIAL" : "VALIDATED",
    evidence: mvDashEvidence.slice(0, 10),
    recommendation:
      "Garantir MV + UNIQUE INDEX + refresh function + cron job + view wrapper para secretária e admin (sem cálculo ao vivo).",
  });

  const premiumRouteChecks = [
    {
      path: "apps/web/src/app/api/financeiro/recibos/emitir/route.ts",
      feature: "fin_recibo_pdf",
    },
    {
      path: "apps/web/src/app/api/financeiro/extrato/aluno/[alunoId]/pdf/route.ts",
      feature: "doc_qr_code",
    },
    {
      path: "apps/web/src/app/api/secretaria/turmas/[id]/alunos/pdf/route.ts",
      feature: "doc_qr_code",
    },
    {
      path: "apps/web/src/app/api/secretaria/turmas/[id]/alunos/lista/route.ts",
      feature: "doc_qr_code",
    },
  ];

  const premiumUiChecks = [
    {
      path: "apps/web/src/components/financeiro/ReciboImprimivel.tsx",
      feature: "fin_recibo_pdf",
    },
    {
      path: "apps/web/src/components/financeiro/ExtratoActions.tsx",
      feature: "doc_qr_code",
    },
    {
      path: "apps/web/src/components/secretaria/TurmaDetailClient.tsx",
      feature: "doc_qr_code",
    },
  ];

  const premiumEvidence: Array<{ file: string; note: string }> = [];
  let premiumMissing = false;
  for (const check of premiumRouteChecks) {
    const text = fileText(repoRoot, check.path) || "";
    const hasGuard = text.includes("requireFeature") && text.includes(check.feature);
    premiumEvidence.push({
      file: check.path,
      note: `backend guard (${check.feature}): ${hasGuard ? "sim" : "não"}`,
    });
    if (!hasGuard) premiumMissing = true;
  }

  for (const check of premiumUiChecks) {
    const text = fileText(repoRoot, check.path) || "";
    const hasGuard = text.includes("usePlanFeature") && text.includes(check.feature);
    premiumEvidence.push({
      file: check.path,
      note: `ui guard (${check.feature}): ${hasGuard ? "sim" : "não"}`,
    });
    if (!hasGuard) premiumMissing = true;
  }

  findings.push({
    id: "PLAN_GUARD",
    title: "P0.3 — Controle de planos (backend + UI)",
    severity: premiumMissing ? "HIGH" : "LOW",
    status: premiumMissing ? "PARTIAL" : "VALIDATED",
    evidence: premiumEvidence.slice(0, 12),
    recommendation: "Garantir requireFeature em rotas premium e usePlanFeature em entrypoints UI.",
  });

  return { findings, plan };
}
