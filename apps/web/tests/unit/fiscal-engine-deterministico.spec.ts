import test from "node:test";
import assert from "node:assert/strict";

import {
  assertZeroDivergence,
  calcularDocumentoDeterministico,
  validarEncadeamentoOrderReferences,
} from "@/lib/fiscal/engineDeterministico";

test("calcula cenário AGT com 14% + isento Mxx e precisão 4 casas", () => {
  const result = calcularDocumentoDeterministico({
    escolaId: "11111111-1111-1111-1111-111111111111",
    tenantEmpresaId: "22222222-2222-2222-2222-222222222222",
    moeda: "AOA",
    globalDiscountPct: "1.5000",
    lines: [
      {
        lineNo: 1,
        productCode: "SERV-A",
        description: "Serviço tributado",
        quantity: "1.0000",
        unitPrice: "100.0000",
        tax: { kind: "NORMAL_14", ratePct: "14.0000" },
      },
      {
        lineNo: 2,
        productCode: "SERV-B",
        description: "Serviço isento",
        quantity: "1.0000",
        unitPrice: "50.0000",
        tax: { kind: "ISENTO", ratePct: "0.0000", exemptionCode: "M01", exemptionReason: "Isento" },
      },
    ],
  });

  assert.equal(result.subtotalBeforeGlobal, "150.0000");
  assert.equal(result.globalDiscountAmount, "2.2500");
  assert.equal(result.grandTotal, "161.5400");
  assert.equal(result.lines[1]?.exemptionCode, "M01");
});

test("cenário AGT 100 x 0.55 com desconto mantém 4 casas", () => {
  const result = calcularDocumentoDeterministico({
    escolaId: "11111111-1111-1111-1111-111111111111",
    tenantEmpresaId: "22222222-2222-2222-2222-222222222222",
    moeda: "AOA",
    lines: [
      {
        lineNo: 1,
        productCode: "P100",
        description: "Quantidade com desconto",
        quantity: "100.0000",
        unitPrice: "0.5500",
        lineDiscountPct: "8.8000",
        tax: { kind: "NORMAL_14", ratePct: "14.0000" },
      },
    ],
  });

  assert.equal(result.lines[0]?.lineGross, "55.0000");
  assert.equal(result.lines[0]?.lineDiscount, "4.8400");
  assert.equal(result.lines[0]?.lineNet, "50.1600");
  assert.equal(result.lines[0]?.taxAmount, "7.0224");
  assert.equal(result.grandTotal, "57.1824");
});

test("valida encadeamento PP -> FT -> NC e bloqueia cross-tenant", () => {
  const pp = { id: "pp-1", escolaId: "e1", tipoDocumento: "PP" as const };
  const ft = { id: "ft-1", escolaId: "e1", tipoDocumento: "FT" as const, documentoOrigemId: "pp-1" };
  const nc = { id: "nc-1", escolaId: "e1", tipoDocumento: "NC" as const, rectificaDocumentoId: "ft-1" };
  const deps = new Map([
    [pp.id, pp],
    [ft.id, ft],
  ]);

  assert.doesNotThrow(() => validarEncadeamentoOrderReferences(ft, deps));
  assert.doesNotThrow(() => validarEncadeamentoOrderReferences(nc, deps));

  const ftCross = { ...ft, escolaId: "e2" };
  assert.throws(() => validarEncadeamentoOrderReferences(ftCross, deps), /ORDER_REF_CROSS_TENANT/);
});

test("divergência deve falhar hard", () => {
  assert.doesNotThrow(() => assertZeroDivergence("100.0000", "100.0000"));
  assert.throws(() => assertZeroDivergence("100.0001", "100.0000"), /FISCAL_DIVERGENCE/);
});
