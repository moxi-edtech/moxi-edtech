import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Button } from "../../src/components/ui/Button";
import {
  getStatusLabel,
  getStatusTone,
  normalizeStatusKey,
} from "../../src/lib/ui/status-presentation";

const source = (path: string) =>
  readFileSync(new URL("../../src/" + path, import.meta.url), "utf8");

test("financeiro uses raw status for tone, never its human label", () => {
  for (const input of ["em_dia", "em dia", "EM_DIA", " em_dia ", "pago", "PAGO", "quitado"]) {
    assert.equal(getStatusTone(input, "financeiro"), "success", input);
  }
  for (const input of ["atrasado", "em_atraso", "inadimplente", "vencido"]) {
    assert.equal(getStatusTone(input, "financeiro"), "danger", input);
  }
  for (const input of ["pendente", "em_aberto", "aguardando_pagamento"]) {
    assert.equal(getStatusTone(input, "financeiro"), "pending", input);
  }
  for (const input of ["", "???", "isento", "cancelado", null, undefined]) {
    assert.equal(getStatusTone(input, "financeiro"), "neutral", String(input));
  }
  assert.equal(normalizeStatusKey(" EM DÍA "), "em_dia");
  assert.equal(getStatusLabel("em_dia"), "em dia");
  assert.equal(getStatusLabel(null), "—");
});

test("matricula statuses do not silently borrow financial semantics", () => {
  assert.equal(getStatusTone("ativo", "matricula"), "success");
  assert.equal(getStatusTone("pendente", "matricula"), "pending");
  assert.equal(getStatusTone("desistente", "matricula"), "neutral");
  assert.equal(getStatusTone("rejeitado", "matricula"), "danger");
  assert.equal(getStatusTone("pago", "matricula"), "neutral");
});

test("Button loading wins even if disabled=false was explicitly passed", () => {
  const busy = renderToStaticMarkup(
    React.createElement(Button, { loading: true, disabled: false, type: "button" }, "Confirmar"),
  );
  assert.match(busy, /\sdisabled=""/);
  assert.match(busy, /aria-busy="true"/);

  const available = renderToStaticMarkup(
    React.createElement(Button, { loading: false, disabled: false, type: "button" }, "Confirmar"),
  );
  assert.doesNotMatch(available, /\sdisabled=/);

  const disabled = renderToStaticMarkup(
    React.createElement(Button, { disabled: true, type: "button" }, "Confirmar"),
  );
  assert.match(disabled, /\sdisabled=""/);
});

test("Button asChild marks blocked links for assistive tech and pointer", () => {
  const html = renderToStaticMarkup(
    React.createElement(
      Button,
      { asChild: true, loading: true },
      React.createElement("a", { href: "/test" }, "Abrir"),
    ),
  );
  assert.match(html, /aria-disabled="true"/);
  assert.match(html, /pointer-events-none/);
});

test("ModalShell retains API and delegates focus, Escape, and scrolling to Radix", () => {
  const modal = source("components/ui/ModalShell.tsx");
  assert.match(modal, /<Dialog open=\{open\} onOpenChange=/);
  assert.match(modal, /<DialogContent/);
  assert.match(modal, /<DialogTitle/);
  assert.match(modal, /<DialogDescription/);
  assert.match(modal, /onPointerDownOutside=\{\(event\) => event.preventDefault\(\)\}/);
  assert.match(modal, /min-h-0 flex-1 overflow-y-auto/);
  assert.doesNotMatch(modal, /<div className="fixed inset-0 z-50/);

  const button = source("components/ui/Button.tsx");
  assert.match(button, /rounded-xl text-sm/);
  assert.match(button, /focus-visible:ring-klasse-gold\/20/);
  assert.match(source("components/ui/Badge.tsx"), /items-center rounded-full border/);
});

test("ModalShell keeps its Radix focus scope viewport-sized for fixed Balcão workspaces", () => {
  const modal = source("components/ui/ModalShell.tsx");
  const dashboard = source("app/secretaria/(portal-secretaria)/Dashboard.tsx");
  const search = source("components/secretaria/BuscaBalcaoRapido.tsx");
  const workspace = source("components/secretaria/command-center/CommandCenterShell.tsx");

  // The card may clip its own scrolling contents, but it must not be the
  // transformed containing block of a nested fixed full-screen workspace.
  assert.match(modal, /fixed inset-0 left-0 top-0 z-50 flex h-\[100dvh\]/);
  // A zero translate still creates a CSS containing block; Radix also animates transforms.
  assert.match(modal, /!transform-none !animate-none/);
  assert.doesNotMatch(modal, /className="[^"]*translate-x-0/);
  assert.match(modal, /onEscapeKeyDown=\{\(event\) => \{/);
  assert.match(modal, /data-balcao-workspace-modal/);
  assert.match(modal, /<section[\s\S]*?overflow-hidden rounded-2xl/);
  assert.match(workspace, /fixed inset-0 z-\[70\]/);
  assert.match(workspace, /data-balcao-workspace-modal=""/);
  // Escape must use the Balcão onClose guard, never close the parent Dialog directly.
  assert.match(workspace, /onKeyDown=\{\(event\) => \{/);
  assert.match(workspace, /event\.stopPropagation\(\)/);
  assert.match(workspace, /onClose\?\.\(\); \/\/ Balcão validates unsaved work/);
  assert.match(search, /<BalcaoWorkspace/);
  assert.match(dashboard, /initialAction="payment"/);
  assert.match(dashboard, /initialAction="document"/);
});
