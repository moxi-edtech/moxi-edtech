/* eslint-disable @typescript-eslint/no-explicit-any -- HTTP boundary fixtures deliberately emulate the dynamic query builder. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve('tsx'))('esbuild');
const root = fileURLToPath(new URL('../../../../', import.meta.url));

test('legacy routes reject foreign school data and never delete academic records', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'klasse-legacy-'));
  const state = { user: null as any, school: 'A', allowed: true, queries: [] as string[], writes: [] as any[], tables: {
    profiles: [{ user_id: 'user', escola_id: 'A' }], turmas: [{ id: 'class', escola_id: 'A' }],
    anos_letivos: [{ id: 'a', ano: 2025, escola_id: 'A' }, { id: 'b', ano: 2026, escola_id: 'A' }, { id: 'foreign', ano: 2027, escola_id: 'B' }],
    calendario_eventos: [{ escola_id: 'A', ano_letivo_id: 'a', nome: 'Own', data_inicio: '2025-02-01', data_fim: '2025-02-02' }, { escola_id: 'B', ano_letivo_id: 'a', nome: 'Foreign', data_inicio: '2025-02-01', data_fim: '2025-02-02' }],
  } as Record<string, any[]> };
  (globalThis as any).__legacyHttp = state;
  const bundle = async (path: string, name: string) => {
    const out = join(dir, name + '.mjs');
    await build({ entryPoints: [resolve(root, path)], outfile: out, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent', plugins: [{ name: 'boundaries', setup(b: any) {
      b.onResolve({ filter: /^(next\/server|@\/lib\/)/ }, (args: any) => ({ path: args.path, namespace: 'fixture' }));
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, (args: any) => ({ contents: args.path === 'next/server'
        ? 'export const NextResponse={json:(body,init)=>Response.json(body,init)};'
        : args.path.includes('resolveEscola')
        ? 'export async function resolveEscolaIdForUser(db,user,requested){return requested===globalThis.__legacyHttp.school?requested:null;}'
        : args.path.includes('disciplinas')
        ? 'export async function authorizeTurmasManage(){return {allowed:globalThis.__legacyHttp.allowed};}'
        : `function client(){const s=globalThis.__legacyHttp;return {auth:{getUser:async()=>({data:{user:s.user}})},from:table=>{s.queries.push(table);const filters=[];const run=()=>({data:(s.tables[table]||[]).filter(r=>filters.every(f=>f(r))),error:null});const q={select:()=>q,eq:(k,v)=>{filters.push(r=>r[k]===v);return q;},in:(k,v)=>{filters.push(r=>v.includes(r[k]));return q;},maybeSingle:async()=>({...run(),data:run().data[0]??null}),then:(yes,no)=>Promise.resolve(run()).then(yes,no),upsert:async rows=>{s.writes.push(...rows);return {error:null};},delete:()=>{throw Error('Destructive operation forbidden');}};return q;}};} export const createRouteClient=client;export const supabaseServerTyped=client;` }));
    } }] });
    return import(pathToFileURL(out).href);
  };
  try {
    const retired = await bundle('apps/web/src/app/api/teste-rpc/route.ts', 'retired');
    const deletion = await bundle('apps/web/src/app/api/escolas/[id]/turmas/[turmaId]/delete/route.ts', 'deletion');
    const calendar = await bundle('apps/web/src/app/api/escola/[id]/admin/calendario/copiar-eventos/route.ts', 'calendar');
    assert.equal((await retired.GET()).status, 404); assert.deepEqual(state.queries, []);
    const del = (id = 'A') => deletion.DELETE(new Request('https://fixture.invalid', { method: 'DELETE' }), { params: Promise.resolve({ id, turmaId: 'class' }) });
    assert.equal((await del()).status, 401); assert.deepEqual(state.queries, []);
    state.user = { id: 'user' };
    assert.equal((await del('B')).status, 403); assert.deepEqual(state.queries, []);
    state.allowed = false; assert.equal((await del()).status, 403); state.allowed = true;
    const result = await del(); assert.equal(result.status, 409); assert.equal(result.headers.get('cache-control'), 'no-store');
    const copy = (from: string, to: string) => calendar.POST(new Request('https://fixture.invalid', { method: 'POST', body: JSON.stringify({ fromAnoId: from, toAnoId: to }) }), { params: { id: 'A' } });
    assert.equal((await copy('a', 'foreign')).status, 404); assert.deepEqual(state.writes, []);
    assert.equal((await copy('a', 'b')).status, 200); assert.equal(state.writes.length, 1);
    assert.equal(state.writes[0].nome, 'Own'); assert.equal(state.writes[0].escola_id, 'A'); assert.equal(state.writes[0].ano_letivo_id, 'b');
    assert.equal(state.writes[0].data_inicio, '2026-02-01');
  } finally { delete (globalThis as any).__legacyHttp; await rm(dir, { recursive: true, force: true }); }
});
