import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const wizardSource = readFileSync(
  resolve(testDir, "../../src/components/secretaria/virada-ano/ViradaWizard.tsx"),
  "utf8"
);
const configSource = readFileSync(
  resolve(testDir, "../../src/components/secretaria/virada-ano/ConfigStep.tsx"),
  "utf8"
);
const executeSource = readFileSync(
  resolve(testDir, "../../src/components/secretaria/virada-ano/ExecuteStep.tsx"),
  "utf8"
);

test("wizard K12 reduz a virada a preparar, exceções e confirmar", () => {
  assert.match(wizardSource, /title: "Preparar"/);
  assert.match(wizardSource, /title: "Exceções"/);
  assert.match(wizardSource, /title: "Confirmar"/);
  assert.match(wizardSource, /const WORKFLOW_VERSION = 2/);
});

test("fluxo é multi-escola e não contém configuração específica do Curtume", () => {
  assert.doesNotMatch(wizardSource, /curtume|3744879f/i);
  assert.doesNotMatch(configSource, /curtume|3744879f/i);
});

test("preços são validados automaticamente e ativação continua explícita", () => {
  assert.match(configSource, /window\.setTimeout/);
  assert.match(configSource, /precos\/preview/);
  assert.match(executeSource, /setConfirming\(true\)/);
  assert.match(executeSource, /Sim, Confirmar Agora/);
});
