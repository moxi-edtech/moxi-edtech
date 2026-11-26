import assert from "node:assert/strict";
import test from "node:test";
import { sidebarConfig } from "../../src/lib/sidebarNav";
import { SIDEBAR_WIDTH, SIDEBAR_LABEL, SIDEBAR_NAV, sidebarLabel } from "../../src/lib/sidebarPresentation";

test("sidebar geometry has one desktop expanded and collapsed width", () => {
  assert.deepEqual(SIDEBAR_WIDTH, { expanded: "256px", collapsed: "80px" });
  assert.match(SIDEBAR_LABEL, /min-w-0.*truncate/);
  assert.match(SIDEBAR_NAV, /overflow-y-auto overflow-x-hidden/);
});

test("menu labels are shortened for display without changing the route contract", () => {
  assert.equal(sidebarLabel("Operações Académicas"), "Académico");
  assert.equal(sidebarLabel("Operações Acadêmicas"), "Académico");
  assert.equal(sidebarLabel("Reconciliação Histórica"), "Reconciliação");
  assert.equal(sidebarLabel("Dashboard"), "Dashboard");
  assert.equal(sidebarLabel("toString"), "toString");
  for (const items of Object.values(sidebarConfig)) {
    for (const item of items ?? []) {
      for (const entry of [item, ...(item.children ?? [])]) {
        assert.ok(sidebarLabel(entry.label).length <= 24, entry.label);
        assert.ok(sidebarLabel(entry.label).trim());
      }
    }
  }
});
