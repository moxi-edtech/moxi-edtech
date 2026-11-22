#!/usr/bin/env node
/**
 * Scoped source-code color contract for the authenticated Escola / Secretaria UI.
 * Neutral surfaces are theme-aware. Explicit light alpha on permanent dark brand
 * panels, print output and official WhatsApp identity are deliberate exceptions.
 * No access to databases, credentials or live schools.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const componentRoots = [
  "secretaria", "financeiro", "escola", "academic", "academico",
  "escola-admin", "onboarding", "migracao", "ui", "shared",
  "layout/escola-admin", "layout/operacoes", "layout/shared",
  "auth", "feedback",
];
const individualFiles = new Set(["apps/web/src/components/ai/AiChatWidget.tsx"]);
const excludedFragments = [
  "/print/", "/_print/", "/fiscal/", "/onboarding.bak/", "/pdf/",
  "/ReciboImprimivel", "/ReciboPagamento", "/FichaInscricaoPDF",
  "/PrintTrigger", "/PrintLetterhead", "/ReciboPrintDocument",
  "/FiscalOperationsClient", "/FiscalLedger",
];
const darkPanelFiles = new Set([
  "apps/web/src/app/escola/[id]/(portal)/admin/configuracoes/fluxos/page.tsx",
  "apps/web/src/app/escola/[id]/(portal)/professores/page.tsx",
  "apps/web/src/app/escola/[id]/(portal)/admin/configuracoes/mensalidades/page.tsx",
  "apps/web/src/components/secretaria/QuickViewTimeline.tsx",
  "apps/web/src/components/secretaria/TurmasListClient.tsx",
  "apps/web/src/components/secretaria/AdmissoesRadarClient.tsx",
  "apps/web/src/components/secretaria/FechoCaixaCego.tsx",
  "apps/web/src/components/secretaria/AcessoPortalManager.tsx",
  "apps/web/src/components/escola/settings/_components/DisciplinaModal.tsx",
  "apps/web/src/components/escola/settings/CourseManager.tsx",
  "apps/web/src/components/feedback/FeedbackSystem.tsx",
  "apps/web/src/components/escola-admin/AlunosListClient.tsx",
]);
const sidebarExempt = new Map([
  ["apps/web/src/components/layout/shared/SidebarNav.tsx", new Set(["text-slate-400", "hover:bg-white/5"])],
  ["apps/web/src/components/layout/shared/SidebarHeader.tsx", new Set(["text-slate-400"])],
  ["apps/web/src/components/layout/shared/SidebarContainer.tsx", new Set(["bg-slate-900", "border-slate-800"])],
]);
const whatsappPaths = new Set([
  "apps/web/src/app/secretaria/(portal-secretaria)/fechamento-academico/cockpit/page.tsx",
  "apps/web/src/components/secretaria/AdmissaoConversionSheet.tsx",
  "apps/web/src/components/secretaria/AdmissoesInboxClient.tsx",
]);

// Exclude semantic red/amber/green status palettes, which represent real state.
// We reject hardcoded neutral/brand classes on operational chrome instead.
const frozenNeutral = /(?<![\w/-])(?:[a-z-]+:)*(?:bg-(?:white(?:\/\d+)?|(?:slate|gray|zinc)-(?:50|100|200|300|400|500|600|700|800|900|950)(?:\/\d+)?)|(?:text|border|divide|ring|placeholder:text)-(?:slate|gray|zinc)-(?:50|100|200|300|400|500|600|700|800|900|950)(?:\/\d+)?)(?=[\s"'\x60}]|$)/g;
const inlineColors = /(?<![\w/-])(?:[a-z-]+:)*(?:bg|text|border|fill|stroke|ring|from|to)-\[#([0-9a-fA-F]{3,8})\](?=[\s"'\x60}]|$)/g;

export function inScope(relativePath) {
  if (!relativePath.endsWith(".tsx")) return false;
  if (excludedFragments.some((part) => relativePath.includes(part))) return false;
  if (relativePath.startsWith("apps/web/src/app/escola/")) return true;
  if (relativePath.startsWith("apps/web/src/app/secretaria/")) return true;
  if (individualFiles.has(relativePath)) return true;
  return componentRoots.some((dir) =>
    relativePath.startsWith("apps/web/src/components/" + dir + "/"));
}

function allowed(relativePath, token, lineSource) {
  if (token.startsWith("print:")) return true;
  if (
    relativePath === "apps/web/src/app/escola/[id]/(portal)/financeiro/turmas-alunos/page.tsx"
    && token === "border-slate-900" && lineSource.includes("print:block")
  ) return true;
  if (/^(?:hover:)?bg-white\/(?:5|10|15|20)$/.test(token) && darkPanelFiles.has(relativePath)) {
    return true;
  }
  if (sidebarExempt.get(relativePath)?.has(token)) return true;
  const whatsapp = /^(?:(?:hover:)?bg|text|fill)-\[#(?:25D366|20ba56)\]$/i.test(token);
  if (whatsapp && whatsappPaths.has(relativePath)) return true;
  return false;
}

export function violationsForContent(relativePath, source) {
  const problems = [];
  const lines = source.split("\n");
  const seen = new Set();
  for (const re of [frozenNeutral, inlineColors]) {
    re.lastIndex = 0;
    for (const match of source.matchAll(re)) {
      const token = match[0];
      const lineNumber = source.slice(0, match.index).split("\n").length;
      const key = String(match.index) + token;
      if (seen.has(key) || allowed(relativePath, token, lines[lineNumber - 1] || "")) continue;
      seen.add(key);
      problems.push({ path: relativePath, line: lineNumber, token });
    }
  }
  return problems;
}

export function scanRepository() {
  const names = execFileSync("git", [
    "ls-files", "-z", "apps/web/src/app/escola", "apps/web/src/app/secretaria",
    "apps/web/src/components",
  ], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);
  const scoped = names.filter(inScope);
  const problems = [];
  for (const name of scoped) {
    const source = readFileSync(path.join(root, name), "utf8");
    problems.push(...violationsForContent(name, source));
  }
  return { scanned: scoped.length, failures: problems };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = scanRepository();
  console.log("Operational theme scope:", result.scanned, "TSX files checked");
  if (result.failures.length) {
    for (const failure of result.failures) {
      console.error(failure.path + ":" + failure.line + " fixed color " + failure.token);
    }
    console.error(result.failures.length + " unapproved neutral/brand classes remain");
    process.exitCode = 1;
  } else {
    console.log("PASS: 0 unapproved hardcoded neutral/brand classes");
  }
}
