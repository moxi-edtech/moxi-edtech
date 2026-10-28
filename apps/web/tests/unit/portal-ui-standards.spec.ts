import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const source = (path: string) => readFile(new URL(`../../src/${path}`, import.meta.url), "utf8");

test("partilhados: elementos compactos usam tokens, estado acessível e action apropriada", async () => {
  const [surface, section, empty, action, status, stat, loading] = await Promise.all([
    "PortalSurface", "PortalSection", "PortalEmptyState", "PortalAction",
    "PortalStatus", "PortalStatCard", "PortalLoadingState",
  ].map((name) => source(`components/portal/ui/${name}.tsx`)));

  for (const component of [surface, section, empty, action, stat]) {
    assert.match(component, /border-border|focus-visible:ring-ring/);
  }
  assert.match(section, /aria-labelledby=\{id\}/);
  assert.match(action, /<Link href=\{props.href\}/);
  assert.match(action, /<button type=\{props.type \?\? "button"\}/);
  assert.match(action, /min-h-11/);
  assert.match(status, /tone: "neutral" \| "pending" \| "success" \| "danger"/);
  assert.match(stat, /value === null/);
  assert.match(stat, /Sem dados/);
  assert.match(empty, /description &&/);
  assert.match(loading, /role="status" aria-live="polite"/);
  assert.match(loading, /aria-hidden="true"/);
});

test("resumo não inventa média nem transforma mensalidades futuras em atraso", async () => {
  const dashboard = await source("components/aluno/dashboard/DashboardLoader.tsx");
  assert.match(dashboard, /data-testid="aluno-summary-cards"/);
  assert.match(dashboard, /<PortalStatCard label="Avisos"/);
  assert.match(dashboard, /<PortalStatCard label="Notas"/);
  assert.match(dashboard, /<PortalStatCard label="Vencidas"/);
  assert.match(dashboard, /typeof screen.boletim\?\.is_liberado === "boolean"/);
  assert.match(dashboard, /screen.dashboard.status_financeiro && !screen.dashboard.status_financeiro.error/);
  assert.match(dashboard, /href=\{go\("\/aluno\/academico"\)\}/);
  assert.match(dashboard, /href=\{go\("\/aluno\/financeiro"\)\}/);
  assert.doesNotMatch(dashboard, /ultima_nota|notasRecentes|\bmediaFinal\b/);
});

test("documentos reutilizam ações/status/estados e preservam tenant, aluno e ano em navegação", async () => {
  const doc = await source("components/aluno/tabs/TabDocumentos.tsx");
  for (const name of ["PortalSurface", "PortalEmptyState", "PortalLoadingState", "PortalStatus", "PortalAction"]) {
    assert.match(doc, new RegExp(name));
  }
  assert.match(doc, /router\.push\(buildPortalHref\(escolaSlug/);
  assert.match(doc, /nav\.set\("aluno", studentId\)/);
  assert.match(doc, /nav\.set\("ano_letivo_id", academicYearId\)/);
  assert.doesNotMatch(doc, /window\.location\.assign\(/);
  assert.match(doc, /onClick=\{\(\) => void handleAction\(doc\)\}/);
  assert.match(doc, /doc.pagamento_configurado === false/);
  assert.match(doc, /<ServicePaymentDrawer/);
  assert.doesNotMatch(doc, /p-10 text-center bg-white/);
});

test("abas partilhadas mantêm histórico da página e teclado completo", async () => {
  const workspace = await source("components/aluno/academico/AcademicoWorkspace.tsx");
  const tabs = await source("components/portal/ui/PortalTabs.tsx");
  assert.match(workspace, /<PortalTabs items=\{sections\}/);
  assert.match(workspace, /window\.history\.pushState/);
  assert.match(workspace, /popstate/);
  assert.match(tabs, /role="tablist"/);
  assert.match(tabs, /role="tab"/);
  assert.match(tabs, /event\.key === "ArrowRight"/);
  assert.match(tabs, /event\.key === "ArrowLeft"/);
  assert.match(tabs, /event\.key === "Home"/);
  assert.match(tabs, /event\.key === "End"/);
  assert.match(tabs, /tabIndex=\{value === tab.id \? 0 : -1\}/);
  assert.doesNotMatch(tabs, /router\.refresh|router\.replace|router\.push/);
});

test("cards legados usam as mesmas superfícies e acessibilidade de teclado", async () => {
  const [card, heading] = await Promise.all([
    source("components/aluno/shared/AlunoCard.tsx"),
    source("components/aluno/shared/SectionTitle.tsx"),
  ]);
  assert.match(card, /border-border bg-card text-foreground/);
  assert.match(card, /event.key === "Enter" \|\| event.key === " "/);
  assert.match(card, /tabIndex=\{onClick \? 0 : undefined\}/);
  assert.match(heading, /min-h-11/);
  assert.match(heading, /focus-visible:ring-ring/);
  assert.doesNotMatch(heading, /uppercase tracking-\[/);
});
