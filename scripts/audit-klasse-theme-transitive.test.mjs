import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { unexpectedOperationalCssColors, overBudgetFixedClasses } from "./audit-klasse-theme-transitive.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = p => readFileSync(path.join(repo,p),"utf8");
const tmp = mkdtempSync(path.join(os.tmpdir(),"klasse-theme-graph-"));
const target = path.join(tmp,"graph.json");
let report;
try {
  execFileSync(process.execPath, ["scripts/audit-klasse-theme-transitive.mjs","--check"], {
    cwd:repo,
    env:{...process.env,KLASSE_THEME_AUDIT_OUTPUT:target},
    stdio:"pipe",
    timeout:120000,
  });
  report=JSON.parse(readFileSync(target,"utf8"));
} finally {
  rmSync(tmp,{recursive:true,force:true});
}

test("graph includes authenticated operational routes and transitive UI dependencies", () => {
  assert.ok(report.operationalEntrypoints>=250);
  assert.ok(report.tsx>=500);
  const nodes=new Set(report.graph.map(x=>x.source));
  for(const file of [
    "apps/web/src/components/secretaria/command-center/CommandCenterStudentDossier.tsx",
    "apps/web/src/components/professor/GradeEntryGrid.tsx",
    "apps/web/src/components/aluno/DossierSeccoes.tsx",
    "apps/web/src/components/harmonia/FluxoPosAccao.tsx",
    "apps/web/src/components/layout/klasse/Sidebar.tsx",
    "apps/web/src/components/CommandPalette.tsx",
    "apps/web/src/components/ui/NotificacoesDropdown.tsx",
  ])assert.ok(nodes.has(file),file);
});

test("no unresolved or computed dynamic local imports hide theme-bearing components", () => {
  assert.deepEqual(report.missing,[]);
  assert.deepEqual(report.dynamic,[]);
});

test("no static inline colors remain in operational styles; printable reports are isolated", () => {
  const inline=report.inlineStyle.filter(x=>x.colorLiteral);
  assert.ok(inline.every(x=>x.source.includes("/templates/pdf/")||x.source.includes("/print/")),JSON.stringify(inline));
});

test("global and printing CSS are explicitly inventoried, portal overrides stay scoped",()=>{
  const css=report.css.map(x=>x.path);
  assert.ok(css.includes("apps/web/src/app/globals.css"));
  assert.ok(css.includes("apps/web/src/app/theme-print.css"));
  assert.ok(css.every(x=>x.includes("/print/")||x.includes("/_print/")||
    x==="apps/web/src/app/globals.css"||x==="apps/web/src/app/theme-print.css"),css.join(", "));
  const g=read("apps/web/src/app/globals.css");
  assert.match(g,/@custom-variant dark/);
  assert.match(g,/\.dark \{/);
  assert.match(g,/\.klasse-portal-theme \{/);
  assert.match(g,/\.klasse-portal-theme \.klasse-portal-cta/);
});

test("global shell, palette and notifications preserve scoped tokens and contextual actions",()=>{
  const shell=read("apps/web/src/components/layout/klasse/Sidebar.tsx");
  assert.match(shell,/bg-klasse-dark/);
  assert.match(shell,/ring-klasse-gold\/25/);
  assert.doesNotMatch(shell,/#(?:1F6B3B|E3B23C)\b/i);
  const palette=read("apps/web/src/components/CommandPalette.tsx");
  assert.match(palette,/bg-klasse-dark\/60/);
  assert.match(palette,/focus-visible:outline-klasse-gold/);
  const n=read("apps/web/src/components/ui/NotificacoesDropdown.tsx");
  assert.match(n,/bg-klasse-gold/);
  assert.match(n,/text-klasse-gold-900/);
});

test("chart neutrals follow theme variables; financial states keep stable meaning",()=>{
  const a=read("apps/web/src/components/layout/escola-admin/ChartsSection.tsx");
  const b=read("apps/web/src/components/dashboard/KpiCard.tsx");
  assert.match(a,/var\(--border\)/);
  assert.match(a,/var\(--muted-foreground\)/);
  assert.match(a,/stroke: "var\(--card\)"/);
  assert.match(b,/chart: "var\(--muted-foreground\)"/);
  assert.match(b,/chart: "var\(--chart-2\)"/);
  assert.match(b,/chart: klasseColors\.gold\.DEFAULT/);
});

test("Harmonia confirmation and post-action UI are tokenized, retaining actions",()=>{
  for(const file of ["ConfirmacaoContextual","EstadoVazio","FluxoPosAccao"]){
    const data=read("apps/web/src/components/harmonia/"+file+".tsx");
    assert.doesNotMatch(data,/#(?:[0-9a-fA-F]{3,8})\b/,file);
    assert.match(data,/bg-(?:card|klasse-green|klasse-gold|muted)/);
  }
  const pos=read("apps/web/src/components/harmonia/FluxoPosAccao.tsx");
  assert.match(pos,/onEscolher\(passo, contexto\)/);
  assert.match(pos,/onDismiss/);
});


test("new unscoped CSS colors fail; registered theme roots and portal rules are allowed", () => {
  const fixture = [
    ":root { --foreground: oklch(0.145 0 0); }",
    ".dark { --foreground: oklch(0.985 0 0); }",
    ".klasse-portal-theme .klasse-portal-cta { background-color: #e3b23c; }",
    ".operational-banner { background-color: #fff; }",
  ].join("\n");
  assert.deepEqual(unexpectedOperationalCssColors(fixture), ["#fff"]);
  assert.deepEqual(unexpectedOperationalCssColors(read("apps/web/src/app/globals.css")), []);
});


test("transitive fixed-class allowlist is bounded by token, file and occurrence count", () => {
  assert.equal(report.unexpectedTransitiveClasses.length,0);
  assert.ok(report.transitiveComponents > 100);
  assert.ok(report.approvedClassCount <= 50);
  const scoped="apps/web/src/components/aluno/DossierSeccoes.tsx";
  const visible="bg-card border-border text-foreground";
  assert.deepEqual(overBudgetFixedClasses(scoped,visible,{}),[]);
  assert.deepEqual(
    overBudgetFixedClasses(scoped,"bg-white",{}).map(x=>x.token),["bg-white"]
  );
  const whitelisted={"apps/web/src/components/harmonia/ConfirmacaoContextual.tsx":{
    reason:"Only over green confirmation",tokens:{"bg-white/15":2}
  }};
  const s="apps/web/src/components/harmonia/ConfirmacaoContextual.tsx";
  assert.deepEqual(overBudgetFixedClasses(s,"bg-white/15 bg-white/15",whitelisted),[]);
  assert.equal(overBudgetFixedClasses(s,"bg-white/15 bg-white/15 bg-white/15",whitelisted)[0].count,3);
});
