import assert from 'node:assert/strict';
import test from 'node:test';
import { createBalcaoTelemetry } from '../../src/lib/balcao/balcaoTelemetry';

test('N5 disabled telemetry generates no payload and never sends a request',async()=>{
 let sent=0;
 const telemetry=createBalcaoTelemetry({sender:()=>{sent++}});
 telemetry.count({action:'payment',durationMs:120,error:true});
 assert.equal(await telemetry.flush(900_000),false);
 assert.equal(sent,0);
 assert.deepEqual(telemetry.snapshot().actions,{});
});
test('N5 contains only numeric categories, even from hostile runtime input', async()=>{
 const messages:unknown[]=[];
 const telemetry=createBalcaoTelemetry({enabled:true,sender:message=>{messages.push(message)}});
 const malicious={action:'payment' as const,durationMs:156,error:true,
   alunoId:'00000000-0000-4000-8000-000000000013',
   escolaId:'00000000-0000-4000-8000-000000000014',
   userId:'secret',ip:'203.0.113.99',responsavel:'Fictional Guardian',
   amount:900,form:'SECRET_FORM_CONTENT',url:'/aluno/private/99',freeText:'PII'};
 telemetry.count(malicious);
 assert.equal(await telemetry.flush(30_000),false,'must rate limit to at least five minutes');
 assert.equal(await telemetry.flush(301_000),true);
 assert.equal(messages.length,1);
 assert.deepEqual(messages[0],{version:1,actions:{payment:1},latencyBuckets:{under100:0,under250:1,under500:0,over500:0},errors:1});
 const payload=JSON.stringify(messages[0]);
 for(const leaked of ['00000000','secret','203.0.113','Guardian','900','SECRET_FORM_CONTENT','private','PII'])
   assert.ok(!payload.includes(leaked),'forbidden payload value: '+leaked);
 assert.equal(await telemetry.flush(302_000),false,'empty/too fast flush cannot send');
});
test('N5 ignores arbitrary action categories and unbounded counters',()=>{
 const telemetry=createBalcaoTelemetry({enabled:true,maxEventsPerBatch:100});
 for(let i=0;i<500;i++)telemetry.count({action:'grade',durationMs:40});
 telemetry.count({action:'person-name' as 'payment'});
 assert.deepEqual(telemetry.snapshot().actions,{grade:100});
});
