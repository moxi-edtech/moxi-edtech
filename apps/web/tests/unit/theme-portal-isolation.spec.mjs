import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = (path) => readFileSync(new URL("../../src/" + path, import.meta.url), "utf8");

test("pre-hydration theme bootstrap forces light on student/teacher URLs", () => {
  const root = source("app/layout.tsx");
  assert.match(root, /LIGHT_ONLY_PORTAL_PATH_PATTERN/);
  assert.match(root, /new RegExp\(\$\{JSON\.stringify\(LIGHT_ONLY_PORTAL_PATH_PATTERN\.source\)\}\)/);
  assert.match(root, /!lightOnlyPortal && \(saved === "dark"/);
});

test("client theme resolver resets the html root when navigating between portals", () => {
  const provider = source("components/providers/ThemeProvider.tsx");
  assert.match(provider, /usePathname\(\)/);
  assert.match(provider, /useLayoutEffect\(\(\) => \{/);
  assert.match(provider, /applyTheme\(preference, lightOnlyPortal\)/);
  assert.match(provider, /\[mounted, preference, lightOnlyPortal\]/);
  assert.match(provider, /!lightOnlyPortal && resolveDarkTheme/);
});

test("the teacher/student topbar does not offer unsupported theme controls", () => {
  const topbar = source("components/layout/klasse/Topbar.tsx");
  assert.match(topbar, /portal !== "aluno" && portal !== "professor"/);
  assert.match(topbar, /showThemeControls && <ThemeToggle/);
  assert.match(topbar, /showThemeControls && \(/);
});
