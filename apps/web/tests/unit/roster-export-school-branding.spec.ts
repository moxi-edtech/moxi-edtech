import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { PDFDocument, PDFDict, PDFName } from "pdf-lib";
import {
  loadSchoolLogoBytes,
  schoolBrandingObjectPath,
  SchoolLogoUnavailableError,
} from "../../src/lib/documentos/schoolLogo";
import { renderNominalA4 } from "../../src/lib/documentos/nominalA4";

const escolaId = "3744879f-2e19-4671-8995-78604302d8c5";
const anotherEscolaId = "00000000-0000-4000-8000-000000000000";
const path = `escolas/${escolaId}/logo/brand.png`;
const url = `https://project.supabase.co/storage/v1/object/public/school-branding/${path}`;
// Imagem PNG sintética de 1 px, sem dados de cliente.
const logo = Uint8Array.from(Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
));

test("o caminho do Storage pertence sempre à escola do documento", () => {
  assert.equal(schoolBrandingObjectPath(url, escolaId), path);
  assert.equal(schoolBrandingObjectPath(url, anotherEscolaId), null);
  assert.equal(schoolBrandingObjectPath(url.replace("brand.png", "../secrets.png"), escolaId), null);
  assert.equal(schoolBrandingObjectPath("https://example.com/logo.png", escolaId), null);
});

test("o PDF usa o logótipo carregado do Storage da própria escola", async () => {
  let objectPath: string | null = null;
  let bucketId: string | null = null;
  const client = {
    storage: { from: (name: string) => {
      bucketId = name;
      return { download: async (value: string) => {
        objectPath = value;
        return { data: new Blob([logo.slice()], { type: "image/png" }), error: null };
      }};
    }},
  } as any;

  const bytes = await loadSchoolLogoBytes({ supabase: client, escolaId, logoUrl: url });
  assert.deepEqual(bytes, logo);
  assert.equal(bucketId, "school-branding");
  assert.equal(objectPath, path);

  const pdf = await renderNominalA4({
    escola: "ESCOLA DE TESTE",
    turma: "6ª Classe A",
    anoLetivo: "2026/2027",
    modo: "Lista operacional",
    alunos: [{ numero: "67", processo: "000761", nome: "ALUNA SINTÉTICA", turma: "6ª A", estado: "Activa" }],
    excluidos: "0 (nenhuma)",
    emissor: "operador",
    logoBytes: bytes,
  });
  const document = await PDFDocument.load(pdf);
  const resources = document.getPage(0).node.Resources();
  const xObjects = resources?.lookup(PDFName.of("XObject"), PDFDict);
  assert.ok(xObjects);
  assert.ok(xObjects.keys().length >= 1, "o logótipo escolar deve ser embutido no PDF");
});

test("sem logótipo configurado não se consulta Storage nem se injeta insígnia", async () => {
  const client = { storage: { from: () => { throw new Error("Não consultar"); } } } as any;
  assert.equal(await loadSchoolLogoBytes({ supabase: client, escolaId, logoUrl: null }), undefined);
  assert.equal(await loadSchoolLogoBytes({
    supabase: client, escolaId, logoUrl: "https://app.klasse.ao/insignia_med.png",
  }), undefined);
});

test("logótipo externo não autorizado falha sem substituição silenciosa", async () => {
  const client = { storage: { from: () => { throw new Error("Não consultar"); } } } as any;
  await assert.rejects(
    loadSchoolLogoBytes({ supabase: client, escolaId, logoUrl: "https://127.0.0.1/internal.png" }),
    (e: unknown) => e instanceof SchoolLogoUnavailableError && e.status === 503,
  );
});

test("as três rotas PDF nunca passam insignia_med como marca alternativa", () => {
  const source = (name: string) => readFileSync(new URL("../../src/" + name, import.meta.url), "utf8");
  for (const name of [
    "app/api/secretaria/turmas/[id]/alunos/lista/route.ts",
    "app/api/secretaria/turmas/[id]/alunos/pdf/route.ts",
    "app/api/secretaria/classes/[id]/alunos/pdf/route.ts",
  ]) {
    const code = source(name);
    assert.match(code, /logoBaseUrl/);
    assert.doesNotMatch(code, /fallbackLogoUrl/);
    assert.doesNotMatch(code, /insignia_med\.png/);
  }
  const pdf = source("lib/documentos/listaNominalPdf.ts");
  const institution = source("lib/pdf/documentTemplate.ts");
  assert.match(pdf, /loadSchoolLogoBytes\(/);
  assert.match(pdf, /logoBytes/);
  assert.match(pdf, /fallbackLogoUrl: null/);
  assert.match(institution, /school\.logoBytes\?\.length/);
});
