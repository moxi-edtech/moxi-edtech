import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { toOperationalReceiptHistoryItem } from "../../src/lib/financeiro/operational-receipt-history";

const row = (snapshot: unknown, monthly: string | null = null) => ({
  id: "00000000-0000-4000-8000-000000000111",
  created_at: "2026-10-26T11:23:45.950Z",
  mensalidade_id: monthly,
  numero_sequencial: 42,
  dados_snapshot: snapshot,
});

test("monthly receipt stays linked to original issued document", () => {
  const receipt = toOperationalReceiptHistoryItem(
    row({ origem: "sistema_automatico", valor_pago: 5000, referencia: "Outubro/2026" }, "monthly-uuid"),
  );
  assert.equal(receipt.kind, "mensalidade");
  assert.equal(receipt.label, "Mensalidade");
  assert.equal(receipt.amount, 5000);
  assert.equal(receipt.description, "Outubro/2026");
  assert.equal(receipt.id, "00000000-0000-4000-8000-000000000111");
  assert.equal(receipt.number, 42);
});

test("enrollment documents are recognized by explicit receipt origin", () => {
  const receipt = toOperationalReceiptHistoryItem(row({
    tipo_comprovativo: "matricula",
    itens_pagamento: [{ descricao: "Taxa de matrícula", valor: 8000 }],
    valor_pago: 8000,
  }));
  assert.equal(receipt.kind, "matricula");
  assert.equal(receipt.label, "Matrícula");
  assert.equal(receipt.description, "Taxa de matrícula");
});

test("portal rematrícula intent remains an operational confirmation receipt", () => {
  const receipt = toOperationalReceiptHistoryItem(row({
    origem: "portal_rematricula",
    pagamento_intent_id: "intent",
    itens_pagamento: [
      { descricao: "Confirmação de matrícula", valor: 750 },
      { descricao: "Serviço escolar", valor: 250 },
    ],
    valor_pago: 1000,
  }));
  assert.equal(receipt.kind, "rematricula");
  assert.equal(receipt.amount, 1000);
});

test("balcão rematrícula takes precedence over generic matrícula markers", () => {
  const receipt = toOperationalReceiptHistoryItem(
    row({ origem: "rematricula_balcao", tipo_comprovativo: "confirmacao", valor_pago: 4000 }),
  );
  assert.equal(receipt.kind, "rematricula");
});

test("service receipts without mensalidade are included, including automatic ones", () => {
  const receipt = toOperationalReceiptHistoryItem(row({
    origem: "pagamento_auto",
    pagamento_id: "settled-payment",
    itens_pagamento: [{ nome: "Declaração", preco: 1200 }],
  }));
  assert.equal(receipt.kind, "servico");
  assert.equal(receipt.amount, 1200);
  assert.equal(receipt.description, "Declaração");
});

test("consolidated receipts use amount of original lines, not an arbitrary final payment value", () => {
  const receipt = toOperationalReceiptHistoryItem(row({
    valor_pago: 2000,
    itens: [{ nome: "Matrícula", preco: 1500 }, { nome: "Taxa", preco: 500 }],
  }));
  assert.equal(receipt.amount, 2000);
});

test("invalid or incomplete historical metadata is handled without leaking snapshot fields", () => {
  const receipt = toOperationalReceiptHistoryItem(row({
    origem: "other",
    valor_pago: "not-numeric",
    aluno_bi: "PRIVATE",
    password: "PRIVATE",
  }));
  assert.equal(receipt.amount, null);
  assert.equal(receipt.description, "Recibo de serviço escolar");
  assert.equal(JSON.stringify(receipt).includes("PRIVATE"), false);
});

test("listing is read-only, scoped to school, student, authorized staff, and non-revoked issued receipts", () => {
  const route = readFileSync(
    "apps/web/src/app/api/secretaria/alunos/[alunoId]/recibos/route.ts", "utf8",
  );
  assert.match(route, /supabase\.auth\.getUser\(\)/);
  assert.match(route, /resolveEscolaIdForUser/);
  assert.match(route, /requireRoleInSchool/);
  assert.match(route, /\.from\("documentos_emitidos"\)/);
  assert.match(route, /\.eq\("escola_id", escolaId\)/);
  assert.match(route, /\.eq\("aluno_id", studentId\)/);
  assert.match(route, /\.eq\("tipo", "recibo"\)/);
  assert.match(route, /\.is\("revoked_at", null\)/);
  assert.match(route, /\.range\(offset, offset \+ PAGE_SIZE\)/);
  assert.doesNotMatch(route, /\.insert\(|\.upsert\(|\.update\(|\.delete\(|\.rpc\(/);
  assert.doesNotMatch(route, /fiscal_emitir_|emitir_recibo/);
});

test("same UI supports full profile and Command Center, using guarded reprint route", () => {
  const section = readFileSync("apps/web/src/components/aluno/DossierSeccoes.tsx", "utf8");
  const profile = readFileSync("apps/web/src/components/aluno/AlunoPerfilPage.tsx", "utf8");
  const command = readFileSync("apps/web/src/components/secretaria/command-center/CommandCenterStudentDossier.tsx", "utf8");
  const component = readFileSync("apps/web/src/components/aluno/StudentReceiptHistory.tsx", "utf8");
  assert.match(section, /<StudentReceiptHistory/);
  assert.match(profile, /DossierFinanceiroSection[^>]*escolaId=\{resolvedEscolaId\}/);
  assert.match(command, /DossierFinanceiroSection[^>]*escolaId=\{escolaId\}/);
  assert.match(component, /\/secretaria\/documentos\//);
  assert.match(component, /rel="noopener noreferrer"/);
  assert.doesNotMatch(component, /emitir_recibo|recuperar|pagamentos\/processar/);
});
