import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";

const src = new URL("../../src/", import.meta.url);
const load = (path) => readFileSync(new URL(path, src), "utf8");

test("Super Admin shares the reference portal inset once, at the layout boundary", () => {
  const layout = load("app/super-admin/layout.tsx");
  assert.match(layout, /import \{ PORTAL_PAGE_INSET \} from "@\/lib\/layout\/portal-page"/);
  assert.equal((layout.match(/\$\{PORTAL_PAGE_INSET\}/g) ?? []).length, 1);
  assert.match(layout, /<AppShell>[\s\S]*data-testid="super-admin-page-frame"[\s\S]*<RequireSuperAdmin>\{children\}<\/RequireSuperAdmin>/);
  for (const path of ["app/secretaria/(portal-secretaria)/Dashboard.tsx", "components/layout/operacoes/OperacoesDashboard.tsx", "components/layout/escola-admin/EscolaAdminDashboard.tsx"]) {
    assert.match(load(path), /PORTAL_PAGE_INSET/, path);
  }
});

test("Super Admin route pages do not duplicate the shared page inset", () => {
  const root = new URL("app/super-admin/", src);
  const pages = readdirSync(root, { recursive: true }).filter(path => /(?:^|\/)page\.tsx$/.test(path));
  assert.ok(pages.length >= 25);
  for (const page of pages) {
    const content = readFileSync(new URL(page, root), "utf8");
    assert.doesNotMatch(content, /\bPORTAL_PAGE_(?:WIDE_|HORIZONTAL_)?INSET\b/, page);
    assert.doesNotMatch(content, /className="[^"]*min-h-screen[^"]*\bp-[468]\b/, page);
  }
});

test("Former competing page widths are removed without stripping card or dialog padding", () => {
  const cases = [
    ["app/super-admin/health/page.tsx", /max-w-7xl mx-auto/],
    ["app/super-admin/onboarding/page.tsx", /max-w-7xl mx-auto space-y-6/],
    ["app/super-admin/parceiros/page.tsx", /max-w-6xl mx-auto space-y-6/],
    ["app/super-admin/marketing/page.tsx", /max-w-6xl mx-auto space-y-6/],
    ["app/super-admin/comunicacao/page.tsx", /mx-auto max-w-4xl space-y-6/],
    ["app/super-admin/escolas/\u005bid\u005d/page.tsx", /max-w-7xl mx-auto/],
    ["app/super-admin/escolas/nova/page.tsx", /max-w-3xl mx-auto space-y-8/],
    ["app/super-admin/centros-formacao/novo/page.tsx", /mx-auto max-w-5xl space-y-6/],
    ["app/super-admin/usuarios/novo/page.tsx", /max-w-2xl mx-auto px-4/],
    ["app/super-admin/debug/page.tsx", /max-w-4xl mx-auto p-6/],
    ["app/super-admin/debug/email-preview/page.tsx", /max-w-5xl mx-auto p-6/],
    ["components/super-admin/escolas/SchoolsTableClient.tsx", /mx-auto w-full max-w-7xl px-4/],
    ["components/super-admin/UsuariosListClient.tsx", /max-w-7xl mx-auto px-6/],
    ["components/super-admin/escola-monitor/EscolaMonitor.tsx", /max-w-6xl mx-auto/],
  ];
  for (const [path, pattern] of cases) assert.doesNotMatch(load(path), pattern, path);
});
