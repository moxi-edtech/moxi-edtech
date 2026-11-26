import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import "./p0-operational-theme-coverage.spec.mjs";
import "./internal-operational-theme-coverage.spec.mjs";
import "./super-admin-internal-theme-coverage.spec.mjs";

const repoFile = path => readFileSync(new URL("../../../../" + path, import.meta.url), "utf8");

const paths = [
  "apps/web/src/components/GlobalSearch.tsx",
  "apps/web/src/components/aluno/AlunoDossierRouteModal.tsx",
  "apps/web/src/components/fiscal/FiscalLedgerTable.tsx",
  "apps/web/src/components/fiscal/FiscalRowActions.tsx",
  "apps/web/src/components/ui/NotificacoesDropdown.tsx",
  "apps/web/src/components/ui/NotificacoesSurface.tsx",
  "apps/web/src/components/layout/klasse/PortalBottomNav.tsx",
  "apps/web/src/components/ui/alert.tsx",
  "apps/web/src/components/dashboard/TaskList.tsx",
  "apps/web/src/app/professor/perfil/page.tsx",
];

test("critical shared components and professor portal contain no fixed neutral surface tokens", () => {
  for (const path of paths) {
    const source = repoFile(path).replace(/\bbg-slate-950\/60\b/g, "bg-overlay"); // dialog scrim
    assert.doesNotMatch(source, /\bbg-white(?:\/\d+)?\b|\bbg-(?:slate|gray|zinc)-(?:50|100|200|300|400|500|600|700|800|900|950)\b/, path);
    assert.doesNotMatch(source, /\b(?:text|border)-(?:slate|gray|zinc)-(?:[1-9]00|950)\b/, path);
    assert.doesNotMatch(source, /#(?:1F6B3B|E3B23C|2B6044|C8902A)\b/i, path);
  }
});

test("fiscal document state is semantic while text stays legible on both themes", () => {
  const source = repoFile("apps/web/src/components/fiscal/FiscalLedgerTable.tsx");
  for (const tone of ["emerald", "amber", "destructive"]) {
    assert.match(source, new RegExp("border-" + tone + ".*bg-" + tone + "/10 text-foreground"));
  }
  assert.match(source, /bg-card/);
  assert.match(source, /hover:bg-muted/);
});

test("notices and notifications retain semantic warning, danger and success indicators", () => {
  const notice = repoFile("apps/web/src/components/ui/alert.tsx");
  const dropdown = repoFile("apps/web/src/components/ui/NotificacoesDropdown.tsx");
  const notifications = repoFile("apps/web/src/components/ui/NotificacoesSurface.tsx");
  const dialog = repoFile("apps/web/src/components/ui/dialog.tsx");
  assert.match(notice, /border-amber\/40 bg-card text-foreground/);
  assert.match(notice, /border-destructive\/40 bg-card text-foreground/);
  assert.match(notice, /border-emerald\/30 bg-card text-foreground/);
  assert.match(dropdown, /import \{ NotificacoesSurface \} from "@\/components\/ui\/NotificacoesSurface"/);
  assert.match(dropdown, /<NotificacoesSurface\b/);
  assert.match(notifications, /naoLidas > 0 && <span[^>]*className="[^"]*bg-destructive [^"]*text-background"/);
  assert.match(notifications, /aviso: \{[\s\S]*?dot: "bg-amber",\s*bg: "bg-amber\/10",\s*text: "text-foreground"/);
  assert.match(notifications, /urgente: \{[\s\S]*?dot: "bg-destructive",\s*bg: "bg-destructive\/10",\s*text: "text-foreground"/);
  assert.match(notifications, /aria-label=\{naoLidas > 0 \?/);
  assert.match(notifications, /aria-expanded=\{open\}/);
  assert.match(notifications, /<DialogContent[^>]*layout="bottom-sheet"/);
  assert.match(notifications, /max-w-\[calc\(100vw-2rem\)\]/);
  assert.match(notifications, /focus-visible:ring-4 focus-visible:ring-klasse-gold\/20/);
  assert.match(notifications, /onCloseAutoFocus=/);
  assert.match(dialog, /layout === "bottom-sheet" \? "fixed inset-x-0 bottom-0[^"]*max-h-\[85dvh\][^"]*bg-card/);
});

test("shared surface recipes honor app CSS theme tokens instead of a frozen light palette", () => {
  const source = repoFile("packages/design-tokens/src/index.ts");
  for (const recipe of ["card", "cardInteractive", "cardCompact", "cardMuted"]) {
    assert.match(source, new RegExp(recipe + ": .*(bg-card|bg-muted)"));
  }
  assert.doesNotMatch(source.split("export const klasseSurface =")[1], /\bbg-white\b|\bborder-slate-\d+\b/);
});
