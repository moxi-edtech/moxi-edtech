import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read = path => readFileSync(new URL("../../src/" + path, import.meta.url), "utf8");
const host = read("components/super-admin/CommandCenterWorkspace.tsx");
const navigation = read("components/super-admin/workspace-navigation.tsx");

test("dashboard actions open the shared centered modal, not route links", () => {
  assert.match(host, /<ModalShell open=\{Boolean\(current\)\}/);
  assert.match(host, /size="wide" mobileFullscreen keyboardAware/);
  assert.match(host, /onClick=\{\(\) => open\(href\)\} dialogOpen=/);
  for (const path of ["escolas", "escolas/nova", "onboarding", "cobrancas", "usuarios", "health"]) {
    assert.ok(host.includes('case "/super-admin/' + path + '"'), path);
  }
  assert.match(host, /onRestoreFocus=/);
  assert.match(host, /hidden=\{i !== stack.length - 1\}/);
  assert.match(host, /if \(changed.current\)/);
  assert.match(navigation, /if \(!workspace\?\.open\(href\)\) router.push\(href\)/);
});

test("internal school list pagination does not change the dashboard URL", () => {
  const list = read("components/super-admin/escolas/SchoolsTableClient.tsx");
  assert.match(list, /if \(embedded\) return;/);
  assert.match(list, /navigate\(\x60\/super-admin\/escolas\//);
  assert.match(list, /hidden=\{embedded && \(billingOpen \|\| confirm.open\)\}/);
});

test("billing details and onboarding provision forms render inline inside the workspace", () => {
  const billing = read("components/super-admin/cobrancas/CobrancasListClient.tsx");
  assert.match(billing, /if \(workspace && selectedId\) return <AssinaturaDetailsSlideover/);
  assert.match(read("app/super-admin/onboarding/page.tsx"), /<ProvisionSurface embedded=\{Boolean\(workspace\)\}/);
  for (const path of ["ConfirmActionModal.tsx", "SchoolBillingModal.tsx"]) {
    assert.match(read("components/super-admin/" + path), /role=\{workspace \? "region" : "dialog"\}/);
  }
});

test("creation forms and critical edits register guards before closing", () => {
  for (const path of ["app/super-admin/escolas/nova/page.tsx", "app/super-admin/usuarios/novo/page.tsx", "app/super-admin/onboarding/page.tsx", "components/super-admin/cobrancas/AssinaturaDetailsSlideover.tsx"]) {
    assert.match(read(path), /useWorkspaceGuard\(/, path);
  }
  assert.match(host, /states.includes\("busy"\)/);
  assert.match(host, /states.includes\("dirty"\)/);
});
