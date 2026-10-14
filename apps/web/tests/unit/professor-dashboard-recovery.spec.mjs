import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../../src/app/professor/page.tsx', import.meta.url), 'utf8');
test('dashboard retries without full reload or loss of local selection', () => {
  assert.doesNotMatch(source, /window\.location\.reload\s*\(/);
  assert.match(source, /setRetryVersion\(\(current\) => current \+ 1\)/);
  assert.match(source, /\[retryVersion\]/);
});
test('dashboard polling skips hidden tabs and overlapping requests and backs off', () => {
  assert.match(source, /document\.hidden \|\| pollingInFlight\.current/);
  assert.match(source, /pollingInFlight\.current = true/);
  assert.match(source, /pollingInFlight\.current = false/);
  assert.match(source, /Math\.min\(30_000 \* 2 \*\* pollingFailures\.current, 300_000\)/);
  assert.match(source, /removeEventListener\("visibilitychange", onVisible\)/);
});

test('dashboard does not conflate failed protected queries and empty data', () => {
  assert.match(source, /every\(\(response\) => response\.ok\)/);
  assert.match(source, /Dados académicos indisponíveis/);
  assert.match(source, /turmaMap\.length === 0/);
  assert.match(source, /role="alert"/);
});
test('dashboard pauses scheduled requests in hidden tabs', () => {
  assert.match(source, /if \(disposed \|\| document\.hidden\) return;/);
  assert.match(source, /if \(timeout !== undefined\) clearTimeout\(timeout\)/);
});
