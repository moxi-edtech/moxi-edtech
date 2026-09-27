import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { MODULE_BY_DOC_FILE } from "../../src/lib/assistant/build-knowledge";

const here = dirname(fileURLToPath(import.meta.url));
const docsDir = resolve(here, "../../src/lib/assistant/docs");

const MODULOS_VALIDOS = new Set([
  "dashboard",
  "financeiro",
  "secretaria",
  "academico",
  "comunicacao",
  "whatsapp",
  "classe_ai",
  "operacoes",
  "any",
  "configuracao",
]);

function ficheirosDeDocs(): string[] {
  return readdirSync(docsDir).filter((file) => file.endsWith(".md"));
}

test("todo o documento em docs/ tem módulo declarado", () => {
  // A classificação por substring foi substituída por um mapa explícito. Sem
  // esta garantia, um documento novo cai silenciosamente em "any" e perde o
  // boost de +5 do seu módulo em knowledge-search.ts.
  const semEntrada = ficheirosDeDocs().filter((file) => !(file in MODULE_BY_DOC_FILE));
  assert.deepEqual(semEntrada, [], `documentos sem módulo declarado: ${semEntrada.join(", ")}`);
});

test("o mapa não declara documentos que já não existem", () => {
  const existentes = new Set(ficheirosDeDocs());
  const orfaos = Object.keys(MODULE_BY_DOC_FILE).filter((file) => !existentes.has(file));
  assert.deepEqual(orfaos, [], `entradas órfãs no mapa: ${orfaos.join(", ")}`);
});

test("os módulos declarados são todos valores válidos", () => {
  for (const [file, modulo] of Object.entries(MODULE_BY_DOC_FILE)) {
    assert.ok(MODULOS_VALIDOS.has(modulo), `${file} aponta para módulo inválido: ${modulo}`);
  }
});

test("regressão: os documentos que a inferência por substring classificava mal", () => {
  // "tutoriais-comunicados-documentos.md" era desviado para classe_ai pelo
  // `file.includes("ai")` — que não tem fronteira de palavra e era avaliado
  // antes do ramo `comunicados|documentos`. Era a razão pela qual não existia
  // um único chunk `comunicacao` na base de conhecimento.
  assert.equal(MODULE_BY_DOC_FILE["tutoriais-comunicados-documentos.md"], "comunicacao");

  // "tu-to-ri-ai-s" — o mesmo `includes("ai")`, que fez deste documento o
  // maior grupo do artefacto sob classe_ai.
  assert.equal(MODULE_BY_DOC_FILE["tutoriais-alunos-turmas.md"], "academico");
});

test("classe_ai só contém documentos que são mesmo sobre a KLASSE IA", () => {
  const emClasseAi = Object.entries(MODULE_BY_DOC_FILE)
    .filter(([, modulo]) => modulo === "classe_ai")
    .map(([file]) => file)
    .sort();

  assert.deepEqual(emClasseAi, ["manual-central-acoes-ai.md", "readme-klasse-ai.md"]);
});
