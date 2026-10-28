import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve('tsx'))('esbuild');
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

test('HTTP authentication, financial permission, tenant scope, input boundary and callback limits', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'appypay-http-'));
  const saved = { enabled: process.env.APPYPAY_ENABLED, config: process.env.APPYPAY_CONFIG };
  const state = { user: null as unknown, school: 'schoolA', allowed: false, dbCalls: 0 };
  (globalThis as any).__appyHttp = state;
  const bundle = async (file: string, name: string) => {
    const outfile = join(folder, name + '.mjs');
    await build({ entryPoints: [resolve(file)], outfile, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent', plugins: [{ name: 'http-boundaries', setup(b) {
      b.onResolve({ filter: /^(next\/server|@\/lib\/supabase\/server|@\/lib\/tenant\/resolveEscolaIdForUser|@supabase\/supabase-js)$/ }, args => ({ path: args.path, namespace: 'mock' }));
      b.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: args.path === 'next/server'
        ? 'export const NextResponse = { json: (body, init) => Response.json(body, init) };'
        : args.path.includes('resolveEscola')
        ? 'export async function resolveEscolaIdForUser() { return globalThis.__appyHttp.school; }'
        : 'export async function createClient() { const s = globalThis.__appyHttp; return { auth: { getUser: async () => ({ data: { user: s.user } }) }, rpc: async () => ({ data: s.allowed }), from: () => { s.dbCalls++; throw Error("unexpected DB call"); } }; }' }));
      b.onResolve({ filter: /^@\// }, args => ({ path: resolve('apps/web/src', args.path.slice(2) + '.ts') }));
    } }] });
    return import(pathToFileURL(outfile).href);
  };
  try {
    const human = await bundle('apps/web/src/app/api/financeiro/appypay/references/route.ts', 'human');
    const reconcile = await bundle('apps/web/src/app/api/financeiro/appypay/reconcile/route.ts', 'reconcile');
    const webhook = await bundle('apps/web/src/app/api/webhooks/appypay/route.ts', 'webhook');
    const request = (body: any, headers = {}) => new Request('https://app.klasse.ao/api/financeiro/appypay/references', { method: 'POST', body: JSON.stringify(body), headers });
    process.env.APPYPAY_ENABLED = 'false';
    assert.equal((await human.POST(request({}))).status, 503);
    process.env.APPYPAY_ENABLED = 'true';
    assert.equal((await reconcile.POST(request({}))).status, 401);
    let r = await human.POST(request({})); assert.equal(r.status, 401); assert.equal(r.headers.get('cache-control'), 'no-store');
    state.user = { id: 'user' };
    assert.equal((await human.POST(request({}))).status, 403);
    assert.equal((await reconcile.POST(request({}))).status, 403);
    state.allowed = true;
    process.env.APPYPAY_CONFIG = JSON.stringify({ schoolId: 'other', environment: 'production', clientId: 'id', clientSecret: 'fixture', paymentMethod: 'REF_00000000-0000-0000-0000-000000000000' });
    assert.equal((await human.POST(request({}))).status, 403);
    assert.equal((await human.POST(request({}, { origin: 'https://evil.example' }))).status, 403);
    assert.equal(state.dbCalls, 0);
    assert.equal((await webhook.POST(new Request('https://app.klasse.ao/api/webhooks/appypay', { method: 'POST', body: '{' }))).status, 400);
    assert.equal((await webhook.POST(new Request('https://app.klasse.ao/api/webhooks/appypay', { method: 'POST', body: JSON.stringify({ id: 'forged' }) }))).status, 400);
    // No Content-Length is needed for enforcement: streamed bytes are bounded.
    r = await webhook.POST(new Request('https://app.klasse.ao/api/webhooks/appypay', { method: 'POST', body: 'x'.repeat(16385) }));
    assert.equal(r.status, 413); assert.equal(state.dbCalls, 0);
  } finally {
    if (saved.enabled === undefined) delete process.env.APPYPAY_ENABLED; else process.env.APPYPAY_ENABLED = saved.enabled;
    if (saved.config === undefined) delete process.env.APPYPAY_CONFIG; else process.env.APPYPAY_CONFIG = saved.config;
    delete (globalThis as any).__appyHttp;
    await rm(folder, { recursive: true, force: true });
  }
});
