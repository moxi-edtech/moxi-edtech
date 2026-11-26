import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  publishedTrimestersFromOfficialSheets,
  selectPublishedStudentGrades,
} from "../../src/lib/aluno/published-notes";

const grades = [
  { id:"disc-1", nome:"Matemática", avaliacoes:[
    { nome:"Prova 1", tipo:"NPT", trimestre:1, nota:16 },
    { nome:"Prova 2", tipo:"NPT", trimestre:2, nota:17 },
  ] },
  { id:"disc-2", nome:"Biologia", avaliacoes:[
    { nome:"Prova 1", tipo:"NPT", trimestre:1, nota:14 },
  ] },
];
const classifications = [
  { id:"disc-1", classificacoes:[
    { trimestre:1, nota:15, status:"disponivel" as const },
    { trimestre:2, nota:17, status:"disponivel" as const },
  ] },
  { id:"disc-2", classificacoes:[
    { trimestre:1, nota:null, status:"pendente" as const },
  ] },
];
test("somente pauta trimestral oficialmente emitida autoriza a consulta", () => {
  const published = publishedTrimestersFromOfficialSheets([
    { numero:1, tipo:"trimestral", status:"SUCCESS", pdf_path:"sintetico/term1.pdf" },
    { numero:2, tipo:"trimestral", status:"PROCESSING", pdf_path:"sintetico/term2.pdf" },
    { numero:3, tipo:"trimestral", status:"FAILED", pdf_path:"sintetico/term3.pdf" },
    { numero:2, tipo:"anual", status:"SUCCESS", pdf_path:"sintetico/annual.pdf" },
    { numero:3, tipo:"trimestral", status:"SUCCESS", pdf_path:"" },
  ]);
  assert.deepEqual([...published],[1]);
  const items = selectPublishedStudentGrades(grades,classifications,published);
  assert.equal(items.length,2);
  assert.equal(items[0].avaliacoes.length,1);
  assert.equal(items[0].avaliacoes[0].nota,16);
  assert.deepEqual(items[0].classificacoes,[{ trimestre:1, nota:15, status:"disponivel" }]);
  assert.deepEqual(items[1].classificacoes,[{ trimestre:1, nota:null, status:"pendente" }]);
});
test("sem pauta publicada, nenhuma avaliação ou classificação definitiva é exposta", () => {
  assert.deepEqual(selectPublishedStudentGrades(grades,classifications,new Set()),[]);
});
test("consulta e documento exigem a mesma autorização financeira", () => {
  const src=(path:string)=>readFileSync(resolve(process.cwd(),"src",path),"utf8");
  const consultation=src("app/api/aluno/minhas-notas/route.ts");
  const paid=src("app/api/aluno/boletim/route.ts");
  const pdf=src("app/api/aluno/boletim/pdf/route.ts");
  const ui=src("components/aluno/tabs/TabNotas.tsx");
  const grid=src("components/aluno/academico/BoletimGradeGrid.tsx");
  for(const source of [consultation,paid,pdf]) {
    assert.match(source,/getAlunoContext\(\)/);
    assert.match(source,/resolveBoletimMatricula\(/);
    assert.match(source,/resolveSelectedStudentId\(/);
  }
  assert.match(consultation,/checkBoletimAccess\(/);
  assert.match(consultation,/if \(!access\.granted\)/);
  assert.ok(consultation.indexOf("if (!access.granted)") < consultation.indexOf('rpc("aluno_trimestres_publicados"'));
  assert.match(consultation,/is_liberado: false, matricula_encontrada: true, context,\s*disciplinas: \[\]/);
  assert.match(consultation,/aluno_trimestres_publicados/);
  assert.match(consultation,/ano_letivo_id", context\.anoLetivoId/);
  assert.match(paid,/checkBoletimAccess\(/);
  assert.match(pdf,/checkBoletimAccess\(/);
  assert.match(ui,/fetch\(`\/api\/aluno\/minhas-notas/);
  assert.match(ui,/canDownloadOfficial=\{boletimPago\}/);
  assert.match(grid,/disabled=\{locked \|\| downloading \|\| !canDownloadOfficial\}/);
});
