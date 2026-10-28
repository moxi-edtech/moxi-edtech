import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path: string) => readFile(new URL(`../../src/${path}`, import.meta.url), "utf8");

test("documentos com preço zero e pagamento obrigatório não são vendidos como gratuitos", async () => {
  const catalogo = await read("app/api/aluno/documentos/catalogo/route.ts");
  const solicitar = await read("app/api/aluno/documentos/solicitar/route.ts");
  assert.match(catalogo, /!item\.exige_pagamento_antes_de_liberar/);
  assert.match(catalogo, /Number\(pedido\?\.valor_cobrado \?\? item\.valor_base\) > 0/);
  assert.match(solicitar, /configuredService\?\.exige_pagamento_antes_de_liberar/);
  assert.match(solicitar, /Number\(configuredService\.valor_base\) <= 0/);
});

test("cartões do aluno são curtos, exibem motivo só quando rejeitado e preservam ações", async () => {
  const docs = await read("components/aluno/tabs/TabDocumentos.tsx");
  const dashboard = await read("components/aluno/dashboard/DashboardLoader.tsx");
  assert.match(docs, /line-clamp-2 break-words/);
  assert.match(docs, /onClick=\{\(\) => void handleAction\(doc\)\}/);
  assert.doesNotMatch(docs, /TrackAndTraceStepper|Autenticidade & Segurança|Próximo passo:/);
  assert.match(dashboard, /testId="attention"/);
  assert.match(dashboard, /divide-y divide-border/);
  assert.doesNotMatch(dashboard, /Precisa da tua atenção/);
});
