import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../../src/components/secretaria/AdmissaoWizardClient.tsx", import.meta.url), "utf8");

test("new enrollment always normalizes absent candidate to null before deduping hydration", () => {
  assert.match(source, /const lastCandidaturaIdRef = useRef<string \| null \| undefined>\(undefined\)/);
  assert.match(source, /const candId = \(modalContext[\s\S]*?searchParams\?\.get\("candidaturaId"\)\)\) \?\? null;/);
  assert.match(source, /if \(candId === lastCandidaturaIdRef\.current\) return;/);
  assert.match(source, /setHydrated\(true\);[\s\S]*?setHydratingLead\(false\);/);
});

test("undefined and null represent different initial states in enrollment hydration", () => {
  const sentinel: string | null | undefined = undefined;
  const initialCandidate = undefined;
  const queryCandidate = undefined;
  const candidate = (initialCandidate || queryCandidate) ?? null;
  assert.equal(candidate, null);
  assert.notEqual(candidate, sentinel, "the first render must initialize new enrollment");
});
