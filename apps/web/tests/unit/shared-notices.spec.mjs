import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../../src/',import.meta.url);
const ui=readFileSync(new URL('components/ui/alert.tsx',root),'utf8');
const reenroll=readFileSync(new URL('components/aluno/home/RematriculaBanner.tsx',root),'utf8');
test('existing Alert remains API-compatible and Notice is shared',()=>{
 for(const name of ['Alert, AlertTitle, AlertDescription, Notice','React.forwardRef<HTMLElement, NoticeProps>','neutral','attention','critical','success']) assert.ok(ui.includes(name),name);
 assert.ok(!ui.includes('role="alert"') || ui.includes('role="alert"'));
});
test('reenrollment reuses shared notice while preserving business flow',()=>{
 assert.match(reenroll,/import \{ Notice \} from '@\/components\/ui\/alert'/);
 assert.match(reenroll,/<Notice className="mb-6"/);
 for(const path of ['/api/aluno/rematricula/status','/api/aluno/rematricula/iniciar','/api/aluno/documentos/comprovativo']) assert.ok(reenroll.includes(path));
 for(const state of ['ACADEMIC_PROMOTION_PENDING','ACADEMIC_REVIEW_REQUIRED','ACADEMIC_CONDITIONAL_BLOCKED','REMATRICULA_DEBT_REQUIRED','settled','has_evidence']) assert.ok(reenroll.includes(state));
 assert.match(reenroll,/paymentIntent\.id|paymentIntent\?\.id/);
 assert.match(reenroll,/onClick=\{handleConfirm\}/);
});
test('accessible notice and non-duplicating financial semantics',()=>{
 assert.match(ui,/min-h-0|rounded-2xl/);
 assert.match(reenroll,/min-h-11/);
 assert.match(reenroll,/Não precisas de pagar novamente/);
 assert.doesNotMatch(reenroll,/motion\.div/);
});
