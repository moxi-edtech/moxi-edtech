import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { slotsOverlap, resourceConflicts, type LessonSlot } from "../../src/lib/horarios/temporal-conflicts";
import { mapSlots } from "../../src/hooks/useHorarioData";
import { buildTurnoTemplate } from "../../src/lib/horarios/turno-template";
import { buildImportTemplate, parseTimetableMatrix } from "../../src/lib/horarios/import-matrix";

const slot = (id: string, dia_semana: number, inicio: string, fim: string): LessonSlot => ({ id, dia_semana, inicio, fim });
const slots = [
  slot("a", 1, "13:00:00", "13:45:00"),
  slot("b", 1, "13:30:00", "14:15:00"),
  slot("c", 1, "13:45:00", "14:30:00"),
  slot("d", 2, "13:00:00", "13:45:00"),
];
const byId = new Map(slots.map((s) => [s.id, s]));

test("horários: different slot IDs overlapping on the same day collide", () => {
  assert.equal(slotsOverlap(slots[0]!, slots[1]!), true);
  assert.equal(slotsOverlap(slots[0]!, slots[2]!), false);
  assert.equal(slotsOverlap(slots[0]!, slots[3]!), false);
  assert.deepEqual(resourceConflicts(
    [{ slot_id: "a", professor_id: "p", sala_id: "s" }],
    [{ slot_id: "b", professor_id: "p", sala_id: "s" }],
    byId,
  ), [
    { slot_id: "a", professor_id: "p", kind: "professor" },
    { slot_id: "a", sala_id: "s", kind: "sala" },
  ]);
});

test("horários: consecutive lessons and optional assignments do not create false conflicts", () => {
  assert.deepEqual(resourceConflicts(
    [{ slot_id: "a", professor_id: "p", sala_id: "s" }],
    [{ slot_id: "c", professor_id: "p", sala_id: "s" }, { slot_id: "b", professor_id: "other", sala_id: null }],
    byId,
  ), []);
  assert.deepEqual(resourceConflicts([{ slot_id: "a" }], [{ slot_id: "b" }], byId), []);
});

test("horários: conflict reports deduplicate same resource at the same time", () => {
  const other = { slot_id: "b", professor_id: "p" };
  assert.deepEqual(resourceConflicts([{ slot_id: "a", professor_id: "p" }], [other, other], byId),
    [{ slot_id: "a", professor_id: "p", kind: "professor" }]);
});

test("horários: interval never becomes an editable lesson slot", () => {
  const result = mapSlots([
    { ...slots[0]!, turno_id: "tarde", ordem: 1, is_intervalo: false },
    { ...slots[1]!, turno_id: "tarde", ordem: 2, is_intervalo: true },
  ]);
  assert.equal(result.slotLookup["Segunda-1"], "a");
  assert.equal(result.slotLookup["Segunda-2"], undefined);
  assert.equal(result.slots[1]?.tipo, "intervalo");
});

test("horários: editor and API guard the selected shift and incomplete reads", () => {
  const page = readFileSync("src/components/escola/horarios/HorarioEditor.tsx", "utf8");
  const route = readFileSync("src/app/api/escolas/[id]/horarios/quadro/route.ts", "utf8");
  assert.match(page, /rawSlots\.filter\(\(slot\) => slot\.turno_id === turnoId\)/);
  assert.match(route, /\.eq\('turno_id', expectedShift\)/);
  assert.match(route, /count !== \(data \|\| \[\]\)\.length/);
  assert.match(route, /resourceConflicts\(payload/);
});

test("horários: published version is not a draft save target and saved version is reused", () => {
  const route = readFileSync("src/app/api/escolas/[id]/horarios/quadro/route.ts", "utf8");
  const page = readFileSync("src/components/escola/horarios/HorarioEditor.tsx", "utf8");
  const version = readFileSync("src/app/api/secretaria/turmas/[id]/horario/versao/route.ts", "utf8");
  assert.match(route, /p_versao_id: sourceStatus === 'draft' \? sourceVersionId : null/);
  assert.match(page, /setVersaoId\(persistedVersion\)/);
  assert.match(version, /savedDraft\?\.id \?\? publicada\?\.id/);
});

test("horários: configura a semana do Curtume com seis tempos e intervalo sem duplicar aulas", () => {
  const template = buildTurnoTemplate({inicio:"13:00",aulas:6,minutos:45,pausaApos:3,pausaMinutos:15,intervaloEntre:5,dias:[1,2,3,4,5],turno:"tarde"});
  assert.equal(template.items.length,35);
  assert.equal(template.items.filter(i=>!i.is_intervalo).length,30);
  assert.deepEqual(template.preview.map(i=>[i.inicio,i.fim,i.is_intervalo]),[
    ["13:00","13:45",false],["13:50","14:35",false],["14:40","15:25",false],
    ["15:25","15:40",true],["15:40","16:25",false],["16:30","17:15",false],["17:20","18:05",false],
  ]);
});

test("horários: template rejeita dias repetidos e fim depois da meia-noite",()=>{
  const config={inicio:"23:30",aulas:2,minutos:45,pausaApos:1,pausaMinutos:0,intervaloEntre:5,dias:[1],turno:"noite"};
  assert.throws(()=>buildTurnoTemplate(config),/meia-noite/);
  assert.throws(()=>buildTurnoTemplate({...config,inicio:"18:00",dias:[1,1]}),/Verifique/);
});

const excelSlots=[{id:"a",dia_semana:1,ordem:1,inicio:"13:00:00",fim:"13:45:00"},{id:"b",dia_semana:2,ordem:1,inicio:"13:00:00",fim:"13:45:00"},{id:"break",dia_semana:1,ordem:2,inicio:"13:45:00",fim:"14:00:00",is_intervalo:true}];
const subjects=[{id:"mat",disciplina:"Matemática"},{id:"lp",disciplina:"Língua Portuguesa"}];

test("horários: Excel importa apenas correspondências exactas e aceita acentos equivalentes",()=>{
  const rows=buildImportTemplate(excelSlots);
  rows[1]![1]="MATEMATICA";rows[1]![2]="Língua Portuguesa";
  const result=parseTimetableMatrix(rows,excelSlots,subjects);
  assert.deepEqual(result.errors,[]);
  assert.deepEqual(result.grid,{"Segunda-1":"mat","Terça-1":"lp"});
});

test("horários: Excel rejeita disciplina desconhecida, intervalo e células duplicadas",()=>{
  const rows=[["Horário","Segunda","Terça","Quarta","Quinta","Sexta"],["13:00-13:45","Matemática","???","","",""],["13:00-13:45","Matemática","","","",""],["13:45-14:00","Matemática","","","",""]];
  const result=parseTimetableMatrix(rows,excelSlots,subjects);
  assert.equal(result.errors.length,3);
  assert.equal(result.count,1);
});

test("horários: validação é anterior à criação da versão e nunca chama a RPC de escrita",()=>{
  const route=readFileSync("src/app/api/escolas/[id]/horarios/quadro/route.ts","utf8");
  const validation=route.indexOf("if (mode === 'validate') {");
  const create=route.indexOf("supabase.rpc('ensure_horario_versao'");
  const write=route.indexOf("supabase.rpc('upsert_quadro_horarios_versao_atomic'");
  assert.ok(validation>=0&&create>validation&&write>create);
  assert.match(route.slice(validation,create),/return NextResponse\.json\(\{ ok: true, validated: true/);
});

test("horários: entrada consolidada não cria rascunhos; sugestões mantêm aulas locais",()=>{
  const overview=readFileSync("src/app/api/escolas/[id]/horarios/overview/route.ts","utf8");
  const page=readFileSync("src/components/escola/horarios/HorarioEditor.tsx","utf8");
  const auto=readFileSync("src/app/api/escolas/[id]/horarios/auto/route.ts","utf8");
  assert.match(overview,/\.eq\("ano_letivo_id", year\.id\)/);
  assert.doesNotMatch(overview,/\.insert\(|\.update\(|\.delete\(|\.rpc\(/);
  assert.match(page,/overwrite_unlocked: false/);
  assert.match(page,/current_items: currentItems/);
  assert.match(page,/if \(!slotKey \|\| nextGrid\[slotKey\]/);
  assert.match(auto,/\.eq\("status","publicada"\)/);
  assert.match(page,/if \(ok\) editGrid\(\{\}\)/);
  assert.match(page,/horario\/pdf\?inline=1/);
});

test("horários: workspace remains mounted behind the editor and setup dialogs",()=>{
  const page=readFileSync("src/components/escola/horarios/HorarioEditor.tsx","utf8");
  const roster=page.indexOf("<HorariosWorkspace turmas=");
  const editor=page.indexOf("<Dialog open={Boolean(turmaId)}");
  const setup=page.indexOf("<Dialog open={showWizard}");
  assert.ok(roster>=0&&editor>roster&&setup>editor);
  assert.doesNotMatch(page,/if \(showWizard\) \{\s*return/);
  assert.doesNotMatch(page,/href=\{slotsHref\}/);
  assert.match(page,/if \(autoDraftDirty\) \{\s*warning\("Guarde o rascunho primeiro"/);
  assert.match(page,/if \(setupBusyRef\.current\) return;/);
  assert.match(page,/onCloseAutoFocus=\{event=>\{event\.preventDefault\(\);editorTriggerRef\.current\?\.focus\(\{preventScroll:true\}\)\}\}/);
});
test("horários: resource and advanced time operations use guarded dialogs",()=>{
  const board=readFileSync("src/components/escola/horarios/SchedulerBoard.tsx","utf8");
  const slots=readFileSync("src/components/escola/horarios/wizard/StepSlots.tsx","utf8");
  assert.match(board,/<Dialog open onOpenChange=\{open=>\{if\(!open&&!saving\)onClose\(\)\}\}/);
  assert.match(board,/await onAssignProfessor\(assigningProfessor, professorId\) !== false/);
  assert.match(slots,/<Dialog open=\{advancedOpen\}/);
  assert.match(slots,/setAdvancedSlots\(slots\.map/);
  assert.match(slots,/slots\.some\(s=>!updatedIds\.has\(s\.id\)\)/);
  assert.match(slots,/onBusyChange\?\.\(true\)/);
});

test("horários: workspace and secretaria share one editor and no independent writer",()=>{
  const page=readFileSync("src/app/escola/[id]/(portal)/horarios/quadro/page.tsx","utf8");
  const modal=readFileSync("src/components/secretaria/TurmaHorarioModal.tsx","utf8");
  const editor=readFileSync("src/components/escola/horarios/HorarioEditor.tsx","utf8");
  assert.match(page,/<HorarioEditor\/>/);
  assert.match(modal,/<HorarioEditor key=\{turma.id\} escolaId=\{escolaId\} initialTurmaId=\{turma.id\}/);
  assert.doesNotMatch(modal,/fetch\(|handleSave|handleAutoComplete/);
  assert.match(editor,/if \(embedded && nextTurmaId === null\) \{ onClose\?\.\(\); return; \}/);
  assert.match(editor,/onUpdated\?\.\(\)/);
});


test("horários: compact viewport uses a day editor with shared grid and persistent actions",()=>{
 const editor=readFileSync("src/components/escola/horarios/HorarioEditor.tsx","utf8");
 const board=readFileSync("src/components/escola/horarios/SchedulerBoard.tsx","utf8");
 assert.match(board,/new ResizeObserver\(measure\)/);
 assert.match(board,/node.clientWidth < 1100/);
 assert.match(board,/layout === "day" \|\| \(layout === "auto" && compact\)/);
 assert.match(board,/aria-label="Dia da semana"/);
 assert.match(board,/aria-pressed=\{activeDay===dia\}/);
 assert.match(board,/const key=activeDay\+"-"\+tempo.id/);
 assert.match(board,/if\(tempo.tipo==="intervalo"\)return/);
 assert.match(board,/slotLookup\?\.\[key\]\?/);
 assert.match(board,/onChange=\{event=>handleSelectSlot\(key,event.target.value\|\|null\)\}/);
 assert.match(board,/min-h-11 w-full min-w-0/);
 assert.match(board,/\(conflictReasons\[key\] \?\? \[\]\).join/);
 assert.match(editor,/h-\[100dvh\] w-screen/);
 assert.match(editor,/<SchedulerBoard\s+externalActions/);
 assert.match(editor,/<footer className="shrink-0[\s\S]*?onClick=\{\(\)=>void handleSalvar\(grid\)\}[\s\S]*?onClick=\{\(\)=>void handlePublicar\(grid\)\}/);
 assert.match(editor,/aria-label="Selecionar turma"/);
 const workspace=readFileSync("src/components/escola/horarios/HorariosWorkspace.tsx","utf8");
 assert.match(workspace,/space-y-2 p-2 md:hidden/);
 assert.match(workspace,/hidden overflow-x-auto md:block/);
});
