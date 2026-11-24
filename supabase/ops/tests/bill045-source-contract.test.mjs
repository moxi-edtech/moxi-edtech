import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('both full emission candidates delegate number allocation to the private SSOT',()=>{
 const sql=read('../fiscal/bill045-full-schema-candidate.sql');
 assert.match(sql,/fiscal_private\.reserve_number\(p_serie_id,p_empresa_id,p_tipo_documento,p_invoice_date\)/);
 assert.match(sql,/fiscal_private\.reserve_number\(v_serie\.id,v_empresa_id,'RC',v_invoice_date\)/);
 assert.doesNotMatch(sql,/UPDATE\s+public\.fiscal_series\s+SET\s+ultimo_numero/i);
 assert.match(sql,/b\.fiscal_enabled IS TRUE/);
 assert.match(sql,/v_status := 'pendente_assinatura'/);
 assert.match(sql,/REVOKE ALL ON FUNCTION[\s\S]+FROM PUBLIC,anon,authenticated,service_role/);
});
test('private allocator owns the only counter increment and remains inaccessible',()=>{
 const sql=read('../fiscal/bill045-numbering-core.sql');
 assert.equal((sql.match(/UPDATE public\.fiscal_series SET ultimo_numero=ultimo_numero\+1/g)||[]).length,1);
 assert.match(sql,/REVOKE ALL ON SCHEMA fiscal_private FROM PUBLIC,anon,authenticated,service_role/);
 assert.match(sql,/SECURITY INVOKER/);
});
test('obsolete local setup endpoint is closed without any database write',()=>{
 const route=read('../../../apps/web/src/app/api/fiscal/setup/series/route.ts');
 assert.match(route,/status: 410/);
 assert.doesNotMatch(route,/\.insert\(|\.rpc\(|supabaseRouteClient/);
});
