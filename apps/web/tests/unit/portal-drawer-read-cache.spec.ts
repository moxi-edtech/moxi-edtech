import assert from "node:assert/strict";
import test from "node:test";
import { createDrawerReadCache } from "../../src/components/portal/ui/drawerReadCache";

test("drawer GETs coalesce, normalize query order and return independent response bodies", async () => {
  let calls = 0;
  const cache = createDrawerReadCache({ fetcher: async () => Response.json({ ok: true, calls: ++calls }) });
  const [a, b] = await Promise.all([cache.read("/api/fixture?b=2&a=1"), cache.read("/api/fixture?a=1&b=2")]);
  assert.deepEqual(await a.json(), { ok: true, calls: 1 });
  assert.deepEqual(await b.json(), { ok: true, calls: 1 });
  assert.equal(calls, 1);
  assert.equal((await (await cache.read("/api/fixture?a=2&b=2")).json()).calls, 2);
});

test("drawer GETs are isolated by instance and expire, invalidate and retry explicitly", async () => {
  let now = 0, calls = 0;
  const fetcher = async () => Response.json({ ok: true, calls: ++calls });
  const a = createDrawerReadCache({ fetcher, now: () => now, ttlMs: 30 });
  const b = createDrawerReadCache({ fetcher, now: () => now, ttlMs: 30 });
  await a.read("/api/fixture"); await a.read("/api/fixture");
  assert.equal(calls, 1);
  await b.read("/api/fixture"); assert.equal(calls, 2);
  now = 30; await a.read("/api/fixture"); assert.equal(calls, 3);
  a.invalidate(); await a.read("/api/fixture"); assert.equal(calls, 4);
  await a.read("/api/fixture", { fresh: true }); assert.equal(calls, 5);
});

test("authorization and application errors are never reusable", async () => {
  let calls = 0;
  const cache = createDrawerReadCache({ fetcher: async () => {
    calls++;
    if (calls === 1) return Response.json({ ok: false }, { status: 403 });
    if (calls === 2) return Response.json({ ok: false });
    return Response.json({ ok: true });
  } });
  assert.equal((await cache.read("/api/fixture")).status, 403);
  assert.equal((await (await cache.read("/api/fixture")).json()).ok, false);
  await cache.read("/api/fixture"); await cache.read("/api/fixture");
  assert.equal(calls, 3);
  await assert.rejects(cache.read("https://example.com/api/fixture"));
});

test("aborting one consumer does not cancel another; invalidation cannot republish a stale request", async () => {
  let calls = 0;
  let release!: (response: Response) => void;
  const cache = createDrawerReadCache({ fetcher: async () => {
    calls++;
    if (calls === 1) return new Promise<Response>(resolve => { release = resolve; });
    return Response.json({ ok: true, version: 2 });
  } });
  const abort = new AbortController();
  const abandoned = cache.read("/api/fixture", { signal: abort.signal });
  const remaining = cache.read("/api/fixture");
  abort.abort();
  await assert.rejects(abandoned);
  cache.invalidate();
  const latest = await cache.read("/api/fixture");
  release(Response.json({ ok: true, version: 1 }));
  assert.equal((await remaining.json()).version, 1);
  assert.equal((await latest.json()).version, 2);
  assert.equal((await (await cache.read("/api/fixture")).json()).version, 2);
  assert.equal(calls, 2);
});
