import test from "node:test";
import assert from "node:assert/strict";

import { resolveDocumentoTipoForLote } from "../../src/inngest/functions/pautas-lote";

test("resolveDocumentoTipoForLote cobre os fluxos consolidados suportados", () => {
  assert.equal(resolveDocumentoTipoForLote("lista_nominal"), "lista_nominal");
  assert.equal(resolveDocumentoTipoForLote("trimestral"), "pauta_trimestral");
  assert.equal(resolveDocumentoTipoForLote("anual"), "pauta_anual");
});
