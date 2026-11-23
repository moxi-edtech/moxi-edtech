import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const src = (path) => readFileSync(resolve(process.cwd(), "src", path), "utf8");

test("balcão documental seleciona o ano exato por UUID", () => {
  const hub = src("components/secretaria/DocumentosEmissaoHubClient.tsx");
  assert.match(hub, /\{tipo && \(/);
  assert.match(hub, /value=\{item.id\}/);
  assert.match(hub, /anoLetivoId: selectedAnoLetivoId/);
});

test("documentos históricos são leitura académica, não reabertura de pautas", () => {
  const individual = src("app/api/secretaria/documentos/emitir/route.ts");
  const lotes = src("app/api/secretaria/documentos-oficiais/lote/route.ts");
  const certificado = src("app/api/secretaria/documentos/certificado/batch/route.ts");
  assert.match(individual, /tipoDocumento === "boletim_trimestral" \? "WRITE" : "READ"/);
  assert.match(lotes, /\["lista_nominal", "certificado"\]\.includes\(parsed.data.tipo\)/);
  assert.match(certificado, /operation: "READ"/);
});

test("certificado exclui notas de anos posteriores", () => {
  const builder = src("lib/documentos/certificadoSnapshot.ts");
  assert.match(builder, /targetYear = toNumber\(baseSnapshot.ano_letivo\)/);
  assert.match(builder, /row\.year > targetYear/);
  assert.match(builder, /row\.year == null/);
});

test("portal do aluno escolhe a matrícula do ano solicitado", () => {
  const portal = src("app/api/aluno/documentos/emitir/route.ts");
  assert.match(portal, /resolveBoletimMatricula\(supabase/);
  assert.match(portal, /\.eq\('ano_letivo', anoLetivo\)/);
  assert.doesNotMatch(portal, /order\('ano_letivo', \{ ascending: false \}\)/);
  assert.match(portal, /Tipo e serviço documental incompatíveis/);
});

test("RPC do aluno não faz fallback para ano diferente", () => {
  const migration = readFileSync(resolve(process.cwd(), "../../supabase/migrations/20271203001000_exact_year_aluno_documento_final.sql"), "utf8");
  assert.match(migration, /CREATE OR REPLACE FUNCTION public.aluno_emitir_documento_final/);
  assert.doesNotMatch(migration, /ORDER BY ano_letivo DESC, id DESC LIMIT 1/);
  assert.match(migration, /AND ano_letivo = p_ano_letivo/);
});
