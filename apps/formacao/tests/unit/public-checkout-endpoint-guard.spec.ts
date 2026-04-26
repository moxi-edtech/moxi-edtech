import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(__dirname, "..", "..");
const scanRoots = [path.join(repoRoot, "app"), path.join(repoRoot, "components")];
const allowedExtensions = new Set([".ts", ".tsx", ".js", ".jsx"]);
const forbiddenLegacyEndpoint = /\/api\/formacao\/publico\/inscrever(?!-corporativo)\b/;

function walkFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
      continue;
    }

    if (!allowedExtensions.has(path.extname(entry.name))) continue;
    files.push(fullPath);
  }

  return files;
}

test("Guardrail: frontend público não pode usar endpoint legado /inscrever", () => {
  const offenders: string[] = [];
  const scannedFiles = scanRoots.flatMap((root) => walkFiles(root));

  for (const filePath of scannedFiles) {
    const content = fs.readFileSync(filePath, "utf8");

    if (!forbiddenLegacyEndpoint.test(content)) continue;
    offenders.push(path.relative(repoRoot, filePath));
  }

  assert.deepEqual(
    offenders,
    [],
    [
      "Encontrada referência ao endpoint legado '/api/formacao/publico/inscrever' no frontend.",
      "Substitua pelo fluxo atual (Server Action + resolve target por slug/ref).",
      ...offenders.map((file) => ` - ${file}`),
    ].join("\n")
  );
});
