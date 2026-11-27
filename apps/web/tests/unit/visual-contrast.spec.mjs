import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { contrastRatio } from "../../scripts/visual/color-contrast.mjs";

test("RGB black/white contrast is 21:1", () => {
  assert.ok(Math.abs(contrastRatio("rgb(0, 0, 0)", "rgb(255, 255, 255)") - 21) < 0.001);
});
test("OKLCH CSS tokens have WCAG AA contrast in light and dark", () => {
  assert.ok(contrastRatio("oklch(0.145 0 0)", "oklch(1 0 0)") > 4.5);
  assert.ok(contrastRatio("oklch(0.985 0 0)", "oklch(0.205 0 0)") > 4.5);
});
test("identical colors fail the contrast threshold", () => {
  assert.equal(contrastRatio("oklch(1 0 0)", "oklch(1 0 0)"), 1);
});
test("transparent or unsupported CSS values fail explicitly", () => {
  assert.throws(() => contrastRatio("rgba(0,0,0,0)", "rgb(255,255,255)"));
  assert.throws(() => contrastRatio("transparent", "rgb(255,255,255)"));
  assert.throws(() => contrastRatio("oklch(1 0 0 / 0.2)", "rgb(255,255,255)"));
});

test("theme controls switch semantic foreground and background without intermediate contrast loss", () => {
  for (const file of ["ThemeToggle.tsx", "ThemePreferences.tsx"]) {
    const source = readFileSync(new URL("../../src/components/" + file, import.meta.url), "utf8");
    assert.match(source, /text-foreground hover:bg-muted/);
    assert.doesNotMatch(source, /\btransition-(?:colors|all)\b/);
  }
});
