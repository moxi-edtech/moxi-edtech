import test from "node:test";
import assert from "node:assert/strict";
import { PayloadLimitError, readJsonWithLimit } from "../../src/lib/http/readJsonWithLimit";

function makeRequest(body: string, contentLength?: string) {
  const headers = new Headers({ "content-type": "application/json" });
  if (contentLength !== undefined) headers.set("content-length", contentLength);
  return new Request("http://localhost/api/test", { method: "POST", headers, body });
}

test("readJsonWithLimit rejeita por content-length acima do máximo", async () => {
  const req = makeRequest('{"ok":true}', "99999");
  await assert.rejects(
    () => readJsonWithLimit(req, { maxBytes: 10 }),
    (err: unknown) => err instanceof PayloadLimitError && err.status === 413
  );
});

test("readJsonWithLimit rejeita JSON inválido com 400", async () => {
  const req = makeRequest("{invalid");
  await assert.rejects(
    () => readJsonWithLimit(req, { maxBytes: 1024 }),
    (err: unknown) => err instanceof PayloadLimitError && err.status === 400
  );
});

test("readJsonWithLimit aceita payload vazio e retorna objeto vazio", async () => {
  const req = makeRequest("");
  const data = await readJsonWithLimit(req, { maxBytes: 1024 });
  assert.deepEqual(data, {});
});

test("fuzz readJsonWithLimit aceita cargas pequenas válidas", async () => {
  for (let i = 0; i < 200; i++) {
    const payload = {
      i,
      name: `u_${i}`,
      arr: [i % 3, i % 5, i % 7],
      nested: { ok: true, s: String(i).padStart(4, "0") },
    };
    const raw = JSON.stringify(payload);
    const req = makeRequest(raw);
    const data = await readJsonWithLimit(req, { maxBytes: 2048 });
    assert.deepEqual(data, payload);
  }
});
