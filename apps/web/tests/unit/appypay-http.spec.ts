import test from 'node:test';
import { brokerSignature } from '../../src/lib/server/payments/providers/appypay/portal-broker';
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
  const saved = { enabled: process.env.APPYPAY_ENABLED, config: process.env.APPYPAY_CONFIG, url: process.env.NEXT_PUBLIC_SUPABASE_URL, role: process.env.SUPABASE_SERVICE_ROLE_KEY };
  const originalFetch = globalThis.fetch;
  const state = { user: null as unknown, school: 'f406f5a7-a077-431c-b118-297224925726', allowed: false, dbCalls: 0, requested: null as string | null, ctx: null as any, tables: {} as Record<string, any[]> };
  (globalThis as any).__appyHttp = state;
  const bundle = async (file: string, name: string) => {
    const outfile = join(folder, name + '.mjs');
    await build({ entryPoints: [resolve(file)], outfile, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent', plugins: [{ name: 'http-boundaries', setup(b) {
      b.onResolve({ filter: /^(next\/server|@\/lib\/alunoContext|@\/lib\/supabase\/server|@\/lib\/tenant\/resolveEscolaIdForUser|@supabase\/supabase-js)$/ }, args => ({ path: args.path, namespace: 'mock' }));
      b.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: args.path === 'next/server'
        ? 'export const NextResponse = { json: (body, init) => Response.json(body, init) };'
        : args.path.includes('alunoContext')
        ? `import {createClient} from '@/lib/supabase/server'; export async function getAlunoContext(){return {supabase:createClient(),ctx:globalThis.__appyHttp.ctx};}`
        : args.path.includes('resolveEscola')
        ? 'export async function resolveEscolaIdForUser(db, uid, requested) { const s=globalThis.__appyHttp; s.requested=requested; return requested && requested !== s.school ? null : s.school; }'
        : `export function createClient() { const s = globalThis.__appyHttp; return { auth: { getUser: async () => ({ data: { user: s.user } }) }, rpc: async () => ({ data: s.allowed }), from: table => { s.dbCalls++; const filters=[]; const q={select:()=>q,eq:(k,v)=>{filters.push(r=>r[k]===v);return q;},in:(k,v)=>{filters.push(r=>v.includes(r[k]));return q;},order:()=>q,limit:()=>q,then:(yes,no)=>Promise.resolve({data:(s.tables[table]||[]).filter(r=>filters.every(f=>f(r))),error:null}).then(yes,no),maybeSingle:async()=>({data:(s.tables[table]||[]).find(r=>filters.every(f=>f(r)))??null,error:null})};return q;} }; }` }));
      b.onResolve({ filter: /^@\// }, args => ({ path: resolve('apps/web/src', args.path.slice(2) + '.ts') }));
    } }] });
    return import(pathToFileURL(outfile).href);
  };
  try {
    const status = await bundle('apps/web/src/app/api/financeiro/appypay/status/route.ts', 'status');
    const human = await bundle('apps/web/src/app/api/financeiro/appypay/references/route.ts', 'human');
    const reconcile = await bundle('apps/web/src/app/api/financeiro/appypay/reconcile/route.ts', 'reconcile');
    const webhook = await bundle('apps/web/src/app/api/webhooks/appypay/route.ts', 'webhook');
    const studentRoute = await bundle('apps/web/src/app/api/aluno/financeiro/appypay/route.ts', 'student');
    const brokerRoute = await bundle('apps/web/src/app/api/jobs/appypay/portal/route.ts', 'broker');
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

    // Enabling this provider never lets a requested school bypass membership.
    process.env.APPYPAY_CONFIG = JSON.stringify({ schoolId: state.school, environment: 'sandbox', clientId: 'id', clientSecret: 'fixture', paymentMethod: 'REF_00000000-0000-0000-0000-000000000000' });
    assert.equal((await status.GET(new Request('https://app.klasse.ao/api/financeiro/appypay/status', { headers: { 'x-escola-id': 'foreign' } }))).status, 403);
    assert.equal(state.dbCalls, 0);
    const obligationId='11111111-1111-4111-8111-111111111111';
    state.tables.school_payment_providers=[{ id: 'provider1', school_id:state.school, provider_type:'appypay',status:'active',environment:'sandbox' }];
    state.tables.mensalidades=[{ id:obligationId,escola_id:state.school,valor:1500,valor_previsto:1500,valor_pago_total:500,status:'pendente' }];
    const capability=await status.GET(new Request('https://app.klasse.ao/api/financeiro/appypay/status',{headers:{'x-escola-id':state.school}}));
    assert.equal((await capability.json()).enabled,true);
    const previewRequest=()=>new Request(`https://app.klasse.ao/api/financeiro/appypay/references?obligationId=${obligationId}`,{headers:{'x-escola-id':state.school}});
    const issue=(body:any)=>human.POST(new Request('https://app.klasse.ao/api/financeiro/appypay/references',{method:'POST',headers:{'x-escola-id':state.school},body:JSON.stringify(body)}));
    assert.equal((await issue({obligationId})).status,400);
    assert.equal((await issue({obligationId,expectedAmount:999,amount:999})).status,400);
    assert.equal((await issue({obligationId,expectedAmount:999})).status,409);

    let preview=await human.GET(previewRequest()); assert.equal(preview.status,200);
    let value=await preview.json();assert.equal(value.amount,1000);assert.equal(value.canIssue,true);assert.equal(preview.headers.get('cache-control'),'no-store');
    state.tables.payment_references=[{id:'ref1',school_id:state.school,obligation_id:obligationId,provider_id:'provider1',entity:'00123',reference:'123456789',amount:1000,status:'active',currency:'AOA',expires_at:'2030-12-31',provider_payload:{merchant_id:'private-merchant'}}];
    preview=await human.GET(previewRequest());value=await preview.json();assert.equal(value.canIssue,false);assert.equal(value.reference.entity,'00123');assert.ok(!JSON.stringify(value).includes('private-merchant'));assert.ok(!JSON.stringify(value).includes('fixture'));
    state.tables.mensalidades[0].valor_pago_total=1000;
    const changedPreview=await human.GET(previewRequest());const changed=await changedPreview.json();
    assert.equal(changed.amount,500);assert.equal(changed.reference,null);assert.equal(changed.canIssue,false);
    const foreign=await human.GET(new Request(`https://app.klasse.ao/api/financeiro/appypay/references?obligationId=${obligationId}`,{headers:{'x-escola-id':'foreign'}}));
    assert.equal(foreign.status,403);
    // A forged Success callback must not settle when the authoritative GET is only accepted (101).
    const remoteId='33333333-3333-4333-8333-333333333333';
    state.tables.payment_references[0].provider_reference_id=remoteId;
    process.env.NEXT_PUBLIC_SUPABASE_URL='https://fixture.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='fixture-only';
    let providerReads=0;
    globalThis.fetch=(async(url:any)=>{
      providerReads++;
      return new Response(JSON.stringify(String(url).includes('oauth2')?{access_token:'fixture-token',expires_in:3600}:{id:remoteId,merchantTransactionId:'private-merchant',amount:1000,currency:'AOA',responseStatus:{successful:true,status:'Success',code:101,source:'REF'}}));
    }) as typeof fetch;
    const callback=await webhook.POST(new Request('https://app.klasse.ao/api/webhooks/appypay',{method:'POST',body:JSON.stringify({id:remoteId,amount:999999,responseStatus:{successful:true,status:'Success',code:100}})}));
    assert.equal(callback.status,200);assert.equal((await callback.json()).status,'pending');assert.equal(providerReads,2);
    assert.equal(state.tables.payment_references[0].status,'active');assert.equal(state.tables.payment_provider_events?.length??0,0);

    // Real student route -> signed broker -> real portal operation, with only session/DB/HTTP boundaries simulated.
    const studentId='44444444-4444-4444-8444-444444444444', actorId='55555555-5555-4555-8555-555555555555';
    const studentRequest=(query:string)=>new Request(`https://app.klasse.ao/api/aluno/financeiro/appypay?${query}`);
    state.ctx=null;
    assert.equal((await studentRoute.GET(studentRequest('action=status'))).status,401);
    state.ctx={userId:actorId,escolaId:state.school,alunoId:studentId,alunoIds:[studentId]};
    state.tables.alunos=[{id:studentId,escola_id:state.school}];
    state.tables.mensalidades[0].aluno_id=studentId; state.tables.payment_references=[];
    globalThis.fetch=(async(url:any,init:any)=>brokerRoute.POST(new Request(String(url),init))) as typeof fetch;
    const beforeUnsigned=state.dbCalls;
    assert.equal((await brokerRoute.POST(new Request('https://app.klasse.ao/api/jobs/appypay/portal',{method:'POST',body:'{}'}))).status,401);
    assert.equal(state.dbCalls,beforeUnsigned);
    const capabilityStudent=await studentRoute.GET(studentRequest('action=status'));
    assert.equal(capabilityStudent.status,200);assert.equal((await capabilityStudent.json()).enabled,true);
    assert.equal((await studentRoute.GET(studentRequest(`action=status&studentId=${actorId}`))).status,403);
    const previewStudent=await studentRoute.GET(studentRequest(`action=preview&kind=monthly&targetId=${obligationId}`));
    assert.equal(previewStudent.status,200);const studentValue=await previewStudent.json();
    assert.equal(studentValue.amount,500);assert.equal(studentValue.canIssue,true);
    assert.ok(!JSON.stringify(studentValue).includes('fixture'));
    state.tables.mensalidades[0].aluno_id=actorId;
    assert.equal((await studentRoute.GET(studentRequest(`action=preview&kind=monthly&targetId=${obligationId}`))).status,404);
    const postStudent=(body:any,headers={})=>studentRoute.POST(new Request('https://app.klasse.ao/api/aluno/financeiro/appypay',{method:'POST',body:JSON.stringify(body),headers}));
    assert.equal((await postStudent({action:'issue',targetId:obligationId,kind:'monthly',expectedAmount:500,amount:1})).status,400);
    assert.equal((await postStudent({action:'issue',targetId:obligationId,kind:'monthly',expectedAmount:500},{origin:'https://evil.invalid'})).status,403);
    state.allowed=false;
    assert.equal((await studentRoute.GET(studentRequest('action=status'))).status,403);
    state.allowed=true;
    const stale=String(Date.now()-120000),raw=JSON.stringify({action:'status',schoolId:state.school,studentId,actorId});
    assert.equal((await brokerRoute.POST(new Request('https://app.klasse.ao/api/jobs/appypay/portal',{method:'POST',body:raw,headers:{'x-appypay-time':stale,'x-appypay-signature':brokerSignature(raw,stale,'fixture')}}))).status,401);
  } finally {
    globalThis.fetch=originalFetch;
    if(saved.url===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=saved.url;
    if(saved.role===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=saved.role;
    if (saved.enabled === undefined) delete process.env.APPYPAY_ENABLED; else process.env.APPYPAY_ENABLED = saved.enabled;
    if (saved.config === undefined) delete process.env.APPYPAY_CONFIG; else process.env.APPYPAY_CONFIG = saved.config;
    delete (globalThis as any).__appyHttp;
    await rm(folder, { recursive: true, force: true });
  }
});
