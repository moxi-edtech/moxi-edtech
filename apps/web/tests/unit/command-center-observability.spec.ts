import assert from "node:assert/strict";
import test from "node:test";
import { withExplorerObservability } from "../../src/lib/command-center/observability";

test("successful contextual response includes one correlation ID and no-store", async () => {
  const result = await withExplorerObservability("turma", async () =>
    Response.json({ ok: true, data: { fixture: true } }));
  assert.equal(result.status, 200);
  assert.match(result.headers.get("X-Correlation-ID") ?? "", /^[0-9a-f-]{36}$/i);
  assert.equal(result.headers.get("Cache-Control"), "private, no-store");
  assert.match(result.headers.get("Server-Timing") ?? "", /^cc;dur=\d+(?:\.\d+)?$/);
  assert.deepEqual(await result.json(), { ok: true, data: { fixture: true } });
});

test("failed response strips untrusted private error details and supplies code/requestId", async () => {
  const result = await withExplorerObservability("classe", async () =>
    Response.json({ ok: false, error: "Private student identity from SQL" }, { status: 500 }));
  assert.equal(result.status, 500);
  const payload = await result.json();
  assert.equal(payload.ok, false);
  assert.equal(payload.code, "INTERNAL_ERROR");
  assert.equal(payload.requestId, result.headers.get("X-Correlation-ID"));
  assert.doesNotMatch(JSON.stringify(payload), /Private student identity/);
});

test("expired session cannot masquerade as empty list", async () => {
  const result = await withExplorerObservability("professor", async () =>
    Response.json({ ok: false }, { status: 401 }));
  const payload = await result.json();
  assert.equal(result.status, 401);
  assert.equal(payload.code, "SESSION_EXPIRED");
  assert.match(payload.error, /sessão/i);
});

test("unhandled failure returns safe 500 with correlation ID", async () => {
  const result = await withExplorerObservability("disciplina", async () => {
    throw new Error("unsafe internal name");
  });
  assert.equal(result.status, 500);
  const payload = await result.json();
  assert.equal(payload.requestId, result.headers.get("X-Correlation-ID"));
  assert.doesNotMatch(JSON.stringify(payload), /unsafe internal name/);
});

test("failure timing is available without exposing SQL or student identifiers", async () => {
  const result = await withExplorerObservability("roster-search", async () => {
    throw new Error("sensitive student record");
  });
  assert.equal(result.status, 500);
  assert.match(result.headers.get("Server-Timing") ?? "", /^cc;dur=\d+(?:\.\d+)?$/);
  const body = await result.json();
  assert.doesNotMatch(JSON.stringify(body), /sensitive student record/);
});
