import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyRematriculaResponse,
  isDocumentPendingResult,
} from "../../src/lib/secretaria/rematricula-result";

test("200 com ok=true é conclusão real", () => {
  assert.equal(classifyRematriculaResponse(200, { ok: true }), "completed");
});

test("DOCUMENT_PENDING é estado parcial, não sucesso completo", () => {
  const payload = { ok: false, code: "DOCUMENT_PENDING", pedido_id: "p1" };
  assert.equal(classifyRematriculaResponse(202, payload), "document_pending");
  assert.equal(isDocumentPendingResult(payload), true);
});

test("compatibilidade: DOCUMENT_PENDING continua parcial mesmo se backend legado usar 409", () => {
  assert.equal(
    classifyRematriculaResponse(409, { ok: false, code: "DOCUMENT_PENDING" }),
    "document_pending",
  );
});

test("202 desconhecido não é promovido silenciosamente a sucesso", () => {
  assert.equal(
    classifyRematriculaResponse(202, { ok: false, code: "SOMETHING_ELSE" }),
    "error",
  );
});

test("409 de reconciliação continua erro", () => {
  assert.equal(
    classifyRematriculaResponse(409, { ok: false, code: "REMATRICULA_RECONCILIATION_REQUIRED" }),
    "error",
  );
});
