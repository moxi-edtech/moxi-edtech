import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  formatPublishedGrade, isSubjectOffered, subjectsInTrimester, trimesterClassification,
  trimesterStatus, periodAssessments, type GradeSubject,
} from "../../src/lib/aluno/gradesPresentation";
import { normalizeClassificacoesRows } from "../../src/lib/aluno/boletimNotas";

const source = (path: string) => readFile(new URL(`../../src/${path}`, import.meta.url), "utf8");

const subject = (id: string, periodosAtivos: number[] | null): GradeSubject => ({
  id, nome: id, periodosAtivos, avaliacoes: [],
});
const withGrade: GradeSubject = {
  ...subject("Matemática", [1,3]),
  avaliacoes: [{ nome: "Prova trimestral", tipo: "NPT", trimestre: 1, nota: 16 }],
  classificacoes: [{ trimestre: 1, nota: 15, status: "disponivel" },
    { trimestre: 3, nota: null, status: "pendente" }],
};

test("disciplinas trimestrais não desaparecem do ano, mas só aparecem nos trimestres configurados", () => {
  const one = subject("Biologia", [1]);
  const two = subject("História", [2,3]);
  const unknown = subject("Configuração por confirmar", null);
  const all = [one, two, unknown, withGrade];
  assert.deepEqual(subjectsInTrimester(all, 1).map(s => s.id),
    ["Biologia", "Configuração por confirmar", "Matemática"]);
  assert.deepEqual(subjectsInTrimester(all, 2).map(s => s.id),
    ["História", "Configuração por confirmar"]);
  assert.equal(isSubjectOffered(two, 1), false);
  assert.equal(isSubjectOffered(one, 1), true);
  assert.equal(isSubjectOffered(unknown, 1), null);
  assert.equal(trimesterStatus(one, 2), "nao_lecionada");
  assert.equal(trimesterStatus(unknown, 2), "desconhecida");
});
test("célula do trimestre usa uma classificação apurada, nunca a prova isolada", () => {
  assert.equal(trimesterClassification(withGrade, 1)?.nota, 15);
  assert.equal(periodAssessments(withGrade, 1)[0].nota, 16);
  assert.equal(trimesterStatus(withGrade, 1), "disponivel");
  assert.equal(trimesterClassification(withGrade, 3), null);
  assert.equal(trimesterStatus(withGrade, 3), "pendente");
  assert.equal(trimesterStatus(withGrade, 2), "nao_lecionada");
  assert.equal(formatPublishedGrade(15.25), new Intl.NumberFormat("pt-AO", { maximumFractionDigits: 12, useGrouping: false }).format(15.25));
});
test("classificação do banco só aparece completa; nota parcial, configuração e duplicados não viram 'final'", () => {
  const records = [
    { disciplina_id:"disc-1", trimestre:1, nota_final:15, status:null, has_missing:false, needs_config:false, total_notas:2 },
    { disciplina_id:"disc-1", trimestre:2, nota_final:14, status:null, has_missing:true, needs_config:false, total_notas:1 },
    { disciplina_id:"disc-2", trimestre:1, nota_final:16, status:"PENDENTE_CONFIG", has_missing:false, needs_config:true, total_notas:2 },
    { disciplina_id:"disc-3", trimestre:1, nota_final:0, status:null, has_missing:false, needs_config:false, total_notas:2 },
    { disciplina_id:"disc-4", trimestre:1, nota_final:20, status:null, has_missing:false, needs_config:false, total_notas:1 },
    { disciplina_id:"disc-4", trimestre:1, nota_final:19, status:null, has_missing:false, needs_config:false, total_notas:1 },
  ];
  const result=normalizeClassificacoesRows(records);
  const get=(id:string,t:number)=>result.find(x=>x.id===id)?.classificacoes.find(x=>x.trimestre===t);
  assert.deepEqual(get("disc-1",1),{trimestre:1,nota:15,status:"disponivel"});
  assert.deepEqual(get("disc-1",2),{trimestre:2,nota:null,status:"pendente"});
  assert.deepEqual(get("disc-2",1),{trimestre:1,nota:null,status:"pendente"});
  assert.deepEqual(get("disc-3",1),{trimestre:1,nota:0,status:"disponivel"});
  assert.deepEqual(get("disc-4",1),{trimestre:1,nota:null,status:"pendente"});
});
test("pré-visualização recebe exclusivamente atribuições; notas protegidas não atravessam a API",async () => {
  const [ui,grid,curriculum,grades] = await Promise.all([
    source("components/aluno/tabs/TabNotas.tsx"),
    source("components/aluno/academico/BoletimGradeGrid.tsx"),
    source("app/api/aluno/disciplinas/route.ts"),
    source("app/api/aluno/boletim/route.ts"),
  ]);
  assert.match(ui,/fetch\(`\/api\/aluno\/disciplinas\$\{bulletinQuery\}`/);
  assert.match(ui,/curriculumScope === bulletinQuery \? curriculum : \[\]/);
  assert.match(ui,/const gridSubjects = safeIsLiberado/);
  assert.match(ui,/periodosAtivos: disc\.periodosAtivos/);
  assert.match(ui,/periodosAtivos: Array\.isArray\(d\.periodos_ativos\)/);
  assert.match(grid,/avaliacoes: locked \? \[\] : subject\.avaliacoes/);
  assert.match(grid,/classificacoes: locked \? \[\] :/);
  assert.match(grid,/const valuesVisible = !locked && showGrades/);
  assert.match(grid,/disabled=\{locked\}/);
  assert.match(grid,/disabled=\{locked \|\| downloading\}/);
  assert.match(grid,/Por trimestre/);
  assert.match(grid,/Por disciplina/);
  assert.match(grid,/subjectsInTrimester\(safeSubjects, term\)/);
  assert.match(grid,/trimesterClassification\(subject, term\)/);
  assert.match(grid,/periodAssessments\(subject, selectedTerm\)/);
  assert.match(curriculum,/\.select\("periodos_ativos, curso_matriz:curso_matriz_id\(periodos_ativos,/);
  assert.match(curriculum,/resolveBoletimMatricula\(/);
  assert.doesNotMatch(curriculum,/\.from\("notas"\)/);
  assert.match(grades,/checkBoletimAccess\(/);
  assert.match(grades,/if \(!access\.granted\)/);
  assert.match(grades,/is_liberado: false[^\n]*disciplinas: \[\]/);
  assert.match(grades,/loadClassificacoesTrimestrais\(/);
});
test("PDF e histórico continuam com as mesmas barreiras", async () => {
  const [ui, grid, pdf] = await Promise.all([
    source("components/aluno/tabs/TabNotas.tsx"),
    source("components/aluno/academico/BoletimGradeGrid.tsx"),
    source("app/api/aluno/boletim/pdf/route.ts"),
  ]);
  assert.match(ui,/onDownload=\{\(\) => void descarregarBoletim\(\)\}/);
  assert.match(ui,/fetch\(`\/api\/aluno\/boletim\/pdf\$\{bulletinQuery\}`/);
  assert.match(grid,/onClick=\{onDownload\}/);
  assert.match(pdf,/checkBoletimAccess\(/);
  assert.match(pdf,/!access\.granted\)[^\n]*403/);
  assert.match(ui,/onReapreciacao=\{!historicalRead \?/);
  assert.match(ui,/onMelhoria=\{!historicalRead \?/);
  assert.match(grid,/!historicalRead &&/);
  assert.match(ui,/safeIsLiberado && !historicalRead && reapreciacaoDisc/);
  assert.match(ui,/safeIsLiberado && !historicalRead && melhoriaDisc/);
});
