import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  buildEmpresaStatusProfile,
  classifyMatchInsertError,
  parseCandidatesQuery,
} from "../../lib/talent-pool/routes-contract";

const repoRoot = path.resolve(__dirname, "..", "..");

test("empresa-status contract: fallback de profile quando não existe registo", () => {
  const profile = buildEmpresaStatusProfile(null, "user-123");
  assert.deepEqual(profile, {
    id: "user-123",
    nif: null,
    dominio_email: null,
    is_verified: false,
    created_at: null,
    updated_at: null,
  });
});

test("candidates contract: parsing e clamp de query string", () => {
  const parsedA = parseCandidatesQuery("https://klasse.ao/api/formacao/talent-pool/candidates?limit=999&q=  Luanda ");
  assert.equal(parsedA.limit, 20);
  assert.equal(parsedA.search, "luanda");

  const parsedB = parseCandidatesQuery("https://klasse.ao/api/formacao/talent-pool/candidates?limit=-2");
  assert.equal(parsedB.limit, 1);
});

test("matches contract: mapear erro para MATCH_DUPLICADO", () => {
  const contract = classifyMatchInsertError({ code: "23505", message: "duplicate key value violates unique constraint" });
  assert.equal(contract.status, 409);
  assert.equal(contract.body.code, "MATCH_DUPLICADO");
});

test("matches contract: mapear erro para CONTA_NAO_VERIFICADA (RLS)", () => {
  const contract = classifyMatchInsertError({
    code: "42501",
    message: "new row violates row-level security policy for table",
  });
  assert.equal(contract.status, 403);
  assert.equal(contract.body.code, "CONTA_NAO_VERIFICADA");
});

test("matches contract: fallback para erro genérico", () => {
  const contract = classifyMatchInsertError({
    code: "XX000",
    message: "internal failure",
  });
  assert.equal(contract.status, 400);
  assert.equal(contract.body.code, undefined);
  assert.equal(contract.body.error, "internal failure");
});

test("Guardrail routes: contratos importados nas rotas corretas", () => {
  const matchesRoute = fs.readFileSync(
    path.join(repoRoot, "app", "api", "formacao", "talent-pool", "matches", "route.ts"),
    "utf8"
  );
  const candidatesRoute = fs.readFileSync(
    path.join(repoRoot, "app", "api", "formacao", "talent-pool", "candidates", "route.ts"),
    "utf8"
  );
  const statusRoute = fs.readFileSync(
    path.join(repoRoot, "app", "api", "formacao", "talent-pool", "empresa-status", "route.ts"),
    "utf8"
  );

  // Endpoints descontinuados no Formação Centro
  assert.match(matchesRoute, /ENDPOINT_DESCONTINUADO_FORMACAO_CENTRO/);
  assert.match(candidatesRoute, /ENDPOINT_DESCONTINUADO_FORMACAO_CENTRO/);
  assert.match(statusRoute, /ENDPOINT_DESCONTINUADO_FORMACAO_CENTRO/);
});
