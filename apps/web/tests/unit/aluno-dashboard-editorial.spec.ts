import assert from "node:assert/strict";
import test from "node:test";
import { buildStudentAttention, nextLessonLabel } from "../../src/lib/aluno/dashboardPresentation";

test("sem pendências não desenha dívida nem alertas", () => {
  assert.deepEqual(buildStudentAttention({pendentes:0,documentos:[],rematricula:{eligible:false}}),[]);
});
test("comprovativo pendente informa que não está liquidado e não pede novo pagamento", () => {
  const a=buildStudentAttention({pendentes:0,documentos:[{codigo:"DOC_BOLETIM_TRIMESTRAL",status:"pending"}]});
  assert.match(a[0].description,/não é um pagamento liquidado/i);
  assert.equal(a[0].action,"Acompanhar pedido");
});
test("comprovativo rejeitado mostra motivo e reenvia no mesmo pedido", () => {
  const a=buildStudentAttention({pendentes:0,documentos:[{codigo:"DOC_BOLETIM_TRIMESTRAL",status:"rejected",reject_reason:"Ficheiro ilegível"}]});
  assert.equal(a[0].kind,"rejected");
  assert.equal(a[0].description,"Ficheiro ilegível");
  assert.equal(a[0].action,"Reenviar no mesmo pedido");
});
test("rematrícula elegível tem prioridade antes de mensalidade e atalhos", () => {
  const a=buildStudentAttention({pendentes:2,rematricula:{eligible:true,alreadyDone:false,nextAno:2027}});
  assert.equal(a[0].kind,"rematricula");
  assert.equal(a[1].kind,"mensalidade");
});
test("mensalidade em atraso aparece uma vez e sem inventar valor", () => {
  const a=buildStudentAttention({pendentes:1});
  assert.equal(a.length,1);
  assert.match(a[0].title,/uma mensalidade/);
  assert.doesNotMatch(JSON.stringify(a),/Kz|AOA/);
});
test("sem aula publicada a UI recebe estado vazio, não horários inventados", () => {
  assert.equal(nextLessonLabel(null),null);
  assert.equal(nextLessonLabel({weekday:2,inicio:null}),null);
  assert.equal(nextLessonLabel({weekday:2,inicio:"99:00"}),null);
});
test("aula real omite disciplina, professor e sala quando ausentes", () => {
  const lesson=nextLessonLabel({weekday:3,inicio:"08:00",sala:null,professor:null});
  assert.equal(lesson?.subject,"Aula programada");
  assert.deepEqual(lesson?.details,[]);
});
test("a tela não cria notas locais: autorização pertence às APIs existentes",async()=>{
  const fs=await import("node:fs/promises");
  const ui=await fs.readFile("apps/web/src/components/aluno/dashboard/DashboardLoader.tsx","utf8");
  assert.doesNotMatch(ui,/ultima_nota|notasRecentes|NotaBar|\.disciplinas\s*\.map/);
  assert.match(ui,/\/api\/aluno\/boletim/);
  assert.match(ui,/\/api\/aluno\/documentos\/catalogo/);
});
test("isolamento: o endpoint continua a resolver escola, matrícula e aluno da sessão; não aceita studentId arbitrário",async()=>{
  const fs=await import("node:fs/promises");
  const route=await fs.readFile("apps/web/src/app/api/aluno/dashboard/route.ts","utf8");
  assert.match(route,/getAlunoContext\(\)/);
  assert.match(route,/checkBoletimAccess\(/);
  assert.match(route,/\.eq\('escola_id', escolaId\)/);
  assert.match(route,/\.eq\('matricula_id', matriculaId\)/);
  assert.doesNotMatch(route,/searchParams\.get\(['"]studentId['"]\)/);
});

test("A e B: identidades sintéticas isoladas por escola no resolvedor de autorização real", async () => {
  const { resolveAuthorizedStudentIds, resolveSelectedStudentId } = await import("../../src/lib/portalAlunoAuth");
  // Não existe ligação com o Supabase de produção; a base é construída dentro do próprio teste.
  const alunos = [
    { id: "aluno-fixture-A", profile_id: "user-fixture-A", escola_id: "school-fixture-A" },
    { id: "aluno-fixture-B", profile_id: "user-fixture-B", escola_id: "school-fixture-B" },
  ];
  const responsaveis = [
    { id: "enc-fixture-A", escola_id: "school-fixture-A", email: "a@example.invalid" },
    { id: "enc-fixture-B", escola_id: "school-fixture-B", email: "b@example.invalid" },
  ];
  const vinculos = [
    { aluno_id: "aluno-fixture-A", encarregado_id: "enc-fixture-A", escola_id: "school-fixture-A" },
    { aluno_id: "aluno-fixture-B", encarregado_id: "enc-fixture-B", escola_id: "school-fixture-B" },
  ];
  const tables: Record<string, Record<string, string>[]> = {
    alunos, encarregados: responsaveis, aluno_encarregados: vinculos,
  };
  function client() {
    return {
      from(table: string) {
        const filters: Record<string, string> = {};
        const matching = () => (tables[table] ?? []).filter(row => Object.entries(filters).every(([key, val]) => row[key] === val));
        const query = {
          select(_columns: string) { return query; },
          eq(field: string, val: string) { filters[field] = val; return query; },
          limit(_n: number) { return query; },
          async maybeSingle() { return { data: matching()[0] ?? null }; },
          then(onfulfilled: (value: { data: Record<string, string>[] }) => unknown) { return Promise.resolve({ data: matching() }).then(onfulfilled); },
        };
        return query;
      },
    };
  }
  const fake = client() as unknown as Parameters<typeof resolveAuthorizedStudentIds>[0]["supabase"];
  const idsA = await resolveAuthorizedStudentIds({supabase:fake,userId:"user-fixture-A",escolaId:"school-fixture-A",userEmail:"a@example.invalid"});
  const idsB = await resolveAuthorizedStudentIds({supabase:fake,userId:"user-fixture-B",escolaId:"school-fixture-B",userEmail:"b@example.invalid"});
  assert.deepEqual(idsA,["aluno-fixture-A"]);
  assert.deepEqual(idsB,["aluno-fixture-B"]);
  assert.equal(resolveSelectedStudentId({selectedId:"aluno-fixture-B",authorizedIds:idsA,fallbackId:"aluno-fixture-A"}),"aluno-fixture-A");
  assert.equal(resolveSelectedStudentId({selectedId:"aluno-fixture-A",authorizedIds:idsB,fallbackId:"aluno-fixture-B"}),"aluno-fixture-B");
  assert.deepEqual(await resolveAuthorizedStudentIds({supabase:fake,userId:"user-fixture-A",escolaId:"school-fixture-B",userEmail:"a@example.invalid"}),[]);
});
