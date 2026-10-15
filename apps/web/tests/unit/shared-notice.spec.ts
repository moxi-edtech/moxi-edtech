import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
const read=(p:string)=>readFileSync(new URL(p,import.meta.url),"utf8");
test("single shared Notice used by rematriculation and recent notices",()=>{
 const base=read("../../src/components/ui/notice.tsx");
 const rem=read("../../src/components/aluno/home/RematriculaBanner.tsx");
 const recent=read("../../src/components/aluno/dashboard/AvisosRecentesCard.tsx");
 assert.match(base,/export function Notice/);
 assert.match(rem,/<Notice tone=/);
 assert.match(recent,/<Notice title=/);
 assert.doesNotMatch(rem,/<motion\.div/);
});
test("financial API and evidence id remain in existing domain component",()=>{
 const rem=read("../../src/components/aluno/home/RematriculaBanner.tsx");
 assert.match(rem,/\/api\/aluno\/rematricula\/status/);
 assert.match(rem,/\/api\/aluno\/rematricula\/iniciar/);
 assert.match(rem,/\/api\/aluno\/documentos\/comprovativo/);
 assert.match(rem,/formData\.append\('intentId', intentId\)/);
 assert.match(rem,/paymentIntent\.status === 'settled'/);
 assert.match(rem,/paymentIntent\.has_evidence/);
});
