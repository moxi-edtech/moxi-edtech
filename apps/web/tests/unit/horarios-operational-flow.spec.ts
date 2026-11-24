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
  const page = readFileSync("src/app/escola/[id]/(portal)/horarios/quadro/page.tsx", "utf8");
  const route = readFileSync("src/app/api/escolas/[id]/horarios/quadro/route.ts", "utf8");
  assert.match(page, /rawSlots\.filter\(\(slot\) => slot\.turno_id === turnoId\)/);
  assert.match(route, /\.eq\('turno_id', expectedShift\)/);
  assert.match(route, /count !== \(data \|\| \[\]\)\.length/);
  assert.match(route, /resourceConflicts\(payload/);
});

test("horários: published version is not a draft save target and saved version is reused", () => {
  const route = readFileSync("src/app/api/escolas/[id]/horarios/quadro/route.ts", "utf8");
  const page = readFileSync("src/app/escola/[id]/(portal)/horarios/quadro/page.tsx", "utf8");
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
  const page=readFileSync("src/app/escola/[id]/(portal)/horarios/quadro/page.tsx","utf8");
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
