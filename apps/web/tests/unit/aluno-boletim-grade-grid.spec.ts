import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { availablePeriods, periodAssessments, formatPublishedGrade } from "../../src/lib/aluno/gradesPresentation";

const source = (path: string) => readFile(new URL(`../../src/${path}`, import.meta.url), "utf8");

test("a grelha mostra disciplinas autorizadas mesmo quando o boletim está bloqueado, sem carregar notas", async () => {
  const [ui, grid, curriculumApi, gradeApi] = await Promise.all([
    source("components/aluno/tabs/TabNotas.tsx"),
    source("components/aluno/academico/BoletimGradeGrid.tsx"),
    source("app/api/aluno/disciplinas/route.ts"),
    source("app/api/aluno/boletim/route.ts"),
  ]);
  assert.match(ui, /fetch\(`\/api\/aluno\/disciplinas\$\{bulletinQuery\}`/);
  assert.match(ui, /setCurriculumScope\(bulletinQuery\)/);
  assert.match(ui, /curriculumScope === bulletinQuery \? curriculum : \[\]/);
  assert.match(ui, /const gridSubjects = safeIsLiberado \? safeDisciplinas : safeCurriculum/);
  assert.match(ui, /\.map\(\(d\) => \(\{ id: d\.id, nome: d\.nome, avaliacoes: \[\] \}\)\)/);
  assert.match(grid, /avaliacoes: locked \? \[\] : subject\.avaliacoes/);
  assert.match(grid, /locked \? \(/);
  assert.match(grid, /Notas protegidas/);
  assert.doesNotMatch(grid, /blur\(|blur-\d|filter: blur|nota: 1[0-9]/);
  assert.match(curriculumApi, /getAlunoContext\(\)/);
  assert.match(curriculumApi, /ctx\.alunoIds\.includes\(requestedId\)/);
  assert.match(curriculumApi, /resolveBoletimMatricula\(/);
  assert.doesNotMatch(curriculumApi, /\.from\("notas"\)|checkBoletimAccess\(/);
  assert.match(gradeApi, /if \(!access\.granted\)/);
  assert.match(gradeApi, /is_liberado: false[^\n]*disciplinas: \[\]/);
});

test("as avaliações aparecem por trimestre, sem inventar médias ou notas ausentes", async () => {
  const grid = await source("components/aluno/academico/BoletimGradeGrid.tsx");
  const subject = { id: "test-math", nome: "Matemática", avaliacoes: [
    { nome: "Teste", tipo: "teste", trimestre: 1, nota: 12.5 },
    { nome: "Prova", tipo: "prova", trimestre: 1, nota: 17 },
    { nome: "Exame", tipo: "exame", trimestre: 3, nota: 14 },
  ] };
  assert.deepEqual(availablePeriods([subject]), [1, 3]);
  assert.deepEqual(periodAssessments(subject, 2), []);
  assert.deepEqual(periodAssessments(subject, 1).map(a => formatPublishedGrade(a.nota)), [
    formatPublishedGrade(12.5), formatPublishedGrade(17),
  ]);
  assert.match(grid, /periodAssessments\(disc, p\)/);
  assert.match(grid, /grades\.slice\(0, 2\)/);
  assert.match(grid, /grade\.nota/);
  assert.match(grid, /avaliacao\.nome/);
  assert.match(grid, /grades\.length === 0/);
  assert.match(grid, /Sem avaliações publicadas/);
  assert.doesNotMatch(grid, /Math\.round|\.reduce\(|toFixed\(|mediaFinal|Nota Final/);
});

test("mostrar/ocultar não depende da permissão local, só da autorização vinda do servidor", async () => {
  const [ui, grid] = await Promise.all([
    source("components/aluno/tabs/TabNotas.tsx"),
    source("components/aluno/academico/BoletimGradeGrid.tsx"),
  ]);
  assert.match(ui, /const safeIsLiberado = loadedScope === bulletinQuery && isLiberado/);
  assert.match(ui, /locked=\{!safeIsLiberado\}/);
  assert.match(grid, /const valuesVisible = !locked && showGrades/);
  assert.match(grid, /disabled=\{locked\}/);
  assert.match(grid, /!showGrades \? \(/);
  assert.match(grid, /role="status"/);
  assert.match(grid, /setShowGrades\(\(visible\) => !visible\)/);
  assert.match(grid, /setExpandedId\(null\)/);
  assert.doesNotMatch(grid, /localStorage|sessionStorage|window\.location\.assign/);
});

test("PDF só pode ser solicitado quando o servidor já liberou o boletim", async () => {
  const [ui, grid, pdf] = await Promise.all([
    source("components/aluno/tabs/TabNotas.tsx"),
    source("components/aluno/academico/BoletimGradeGrid.tsx"),
    source("app/api/aluno/boletim/pdf/route.ts"),
  ]);
  assert.match(grid, /disabled=\{locked \|\| downloading\}/);
  assert.match(grid, /onClick=\{onDownload\}/);
  assert.match(ui, /onDownload=\{\(\) => void descarregarBoletim\(\)\}/);
  assert.match(ui, /fetch\(`\/api\/aluno\/boletim\/pdf\$\{bulletinQuery\}`/);
  assert.match(pdf, /checkBoletimAccess\(/);
  assert.match(pdf, /resolveBoletimMatricula\(/);
  assert.match(pdf, /!access\.granted\)[^\n]*403/);
});

test("ações académicas preservadas por disciplina; histórico é estritamente de leitura", async () => {
  const [ui, grid] = await Promise.all([
    source("components/aluno/tabs/TabNotas.tsx"),
    source("components/aluno/academico/BoletimGradeGrid.tsx"),
  ]);
  assert.match(ui, /onReapreciacao=\{!historicalRead \?/);
  assert.match(ui, /onMelhoria=\{!historicalRead \?/);
  assert.match(grid, /!historicalRead &&/);
  assert.match(grid, /onReapreciacao\(disc\)/);
  assert.match(grid, /onMelhoria\(disc\)/);
  assert.match(ui, /safeIsLiberado && !historicalRead && reapreciacaoDisc/);
  assert.match(ui, /safeIsLiberado && !historicalRead && melhoriaDisc/);
});
