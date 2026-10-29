// Disposable UI fixture. Synthetic data only; never connects to AppyPay or Supabase.
import { createRequire } from 'node:module';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createServer } from 'node:http';
const root = resolve(new URL('../../../../', import.meta.url).pathname);
const require = createRequire(join(root, 'apps/web/package.json'));
const tools = createRequire(createRequire(join(root, 'package.json')).resolve('tsx'));
const { build } = tools('esbuild');
const dir = await mkdtemp(join(tmpdir(), 'appypay-preview-'));
const entry = `import React from 'react'; import { createRoot } from 'react-dom/client'; import { AppyPayReferenceButton, StudentAppyPayButton } from ${JSON.stringify(join(root,'apps/web/src/components/financeiro/AppyPayReferenceButton.tsx'))}; const mode=new URLSearchParams(location.search).get('mode'); createRoot(document.getElementById('app')).render(mode ? <StudentAppyPayButton targetId="11111111-1111-4111-8111-111111111111" studentId="44444444-4444-4444-8444-444444444444" kind={mode==='service'?'service':'monthly'} descricao={mode==='service'?'Certificado escolar':'Propina 10/2026'} /> : <AppyPayReferenceButton escolaId="00000000-0000-4000-8000-000000000001" mensalidadeId="11111111-1111-4111-8111-111111111111" alunoNome="Aluno de demonstração" descricao="Propina 10/2026" />);`;

await build({ stdin: { contents: entry, loader: 'tsx', resolveDir: join(root,'apps/web') }, outfile:join(dir,'app.js'), bundle:true, format:'esm', platform:'browser', jsx:'automatic', logLevel:'silent', define:{'process.env.NODE_ENV':'"production"'}, plugins:[{name:'local-navigation',setup(b){b.onResolve({filter:/^next\/navigation$/},()=>({path:'navigation',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const useRouter=()=>({refresh(){}});'}));}}] });
const tailwind = require('@tailwindcss/postcss');
const postcss = createRequire(require.resolve('@tailwindcss/postcss'))('postcss');
const css = await postcss([tailwind()]).process(`@import "tailwindcss" source(none); @source "${join(root,'apps/web/src/components/financeiro/AppyPayReferenceButton.tsx')}"; @source "${join(root,'apps/web/src/components/ui/dialog.tsx')}";`,{from:join(root,'apps/web/fixture.css')});
await writeFile(join(dir,'app.css'),css.css+'\nbody{font-family:system-ui,sans-serif;background:#f8fafc;margin:0;padding:48px;color:#0f172a}main{max-width:800px;margin:auto;background:white;border:1px solid #e2e8f0;border-radius:16px;padding:28px}h1{font-size:24px;font-weight:700;margin:12px 0}p{margin:12px 0}.fixture{font-size:13px;color:#92400e;background:#fffbeb;border-radius:8px;padding:12px}');
let state = { scenario:'normal',issued:false,paid:false,posts:0,checks:0 };
const reference=()=>({id:'22222222-2222-4222-8222-222222222222',entity:'00123',reference:'123456789',amount:1500,currency:'AOA',expires_at:'2030-10-31T23:59:59+01:00',status:state.scenario==='uncertain'?'pending':state.paid?'paid':'active'});
const json=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
const server=createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1');
 if(url.pathname==='/'){
  state={scenario:url.searchParams.get('scenario')||'normal',issued:false,paid:false,posts:0,checks:0};
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end('<!doctype html><html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>KLASSE — Teste local de referência</title><link rel="stylesheet" href="/app.css"></head><body><main><p class="fixture">Demonstração local · dados fictícios · sem cobranças reais</p><h1>Financeiro · Escola de demonstração</h1><p>Aluno de demonstração · Propina 10/2026 · 1 500 AOA</p><div id="app"></div></main><script type="module" src="/app.js"></script></body></html>');return;
 }
 if(url.pathname==='/app.js'||url.pathname==='/app.css'){res.writeHead(200,{'Content-Type':url.pathname.endsWith('js')?'text/javascript':'text/css'});res.end(await readFile(join(dir,url.pathname.slice(1))));return;}
 if(url.pathname==='/state'){json(res,200,state);return;}
 if(url.pathname==='/api/aluno/financeiro/appypay'){
  if(req.method==='GET'){
   if(url.searchParams.get('action')==='status'){json(res,200,{ok:true,enabled:state.scenario!=='disabled',environment:'production'});return;}
   json(res,200,{ok:true,amount:1500,currency:'AOA',environment:'production',canIssue:!state.issued,reference:state.issued?reference():null});return;
  }
  let raw='';for await(const part of req)raw+=part;let body;try{body=JSON.parse(raw);}catch{json(res,400,{error:'Payload inválido'});return;}
  if(body.action==='check'){state.checks++;state.paid=state.scenario==='paid';json(res,200,{ok:true,status:state.paid?'reconciled':'pending'});return;}
  if(body.action!=='issue'||body.expectedAmount!==1500||!['monthly','service'].includes(body.kind)||body.studentId!=='44444444-4444-4444-8444-444444444444'){json(res,400,{error:'Confirmação inválida'});return;}
  state.posts++;state.issued=true;if(state.scenario==='uncertain'){json(res,503,{error:'Emissão em processamento.'});return;}json(res,200,{ok:true,reference:reference()});return;
 }
 if(url.pathname==='/api/financeiro/appypay/status'){json(res,200,{enabled:state.scenario!=='disabled',environment:'production'});return;}
 if(url.pathname==='/api/financeiro/appypay/references'){
  if(req.method==='POST'){let raw='';for await(const part of req)raw+=part;let body;try{body=JSON.parse(raw);}catch{json(res,400,{error:'Payload inválido'});return;}if(body.expectedAmount!==1500){json(res,409,{error:'Saldo divergente na confirmação'});return;}state.posts++;state.issued=true;if(state.scenario==='uncertain'){json(res,503,{error:'Emissão em processamento.'});return;}json(res,200,{ok:true,reference:reference()});return;}
  json(res,200,{ok:true,amount:1500,currency:'AOA',environment:'production',canIssue:!state.issued,reference:state.issued?reference():null});return;
 }
 if(url.pathname==='/api/financeiro/appypay/reconcile'){state.checks++;state.paid=state.scenario==='paid';json(res,200,{ok:true,status:state.paid?'reconciled':'pending'});return;}
 res.writeHead(404);res.end();
});
server.listen(8782,'127.0.0.1',()=>console.log('Synthetic UI fixture ready: http://127.0.0.1:8782/ (normal, paid, uncertain, disabled scenarios)'));
