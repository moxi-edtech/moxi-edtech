import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

async function source(path: string) {
  return readFile(new URL(`../../src/${path}`, import.meta.url), "utf8");
}

test("separadores académicos são internos, com histórico e sem router.refresh ou redirect por clique", async () => {
  const workspace = await source("components/aluno/academico/AcademicoWorkspace.tsx");
  const page = await source("app/(portal-aluno)/aluno/academico/page.tsx");
  assert.match(page, /<AcademicoWorkspace\s*\/>/);
  assert.match(workspace, /<PortalTabs items=\{sections\}/);
  assert.match(workspace, /window\.history\.pushState/);
  assert.match(workspace, /popstate/);
  assert.match(workspace, /visited\.includes\("documentos"\)/);
  assert.match(workspace, /visited\.includes\("disciplinas"\)/);
  assert.match(workspace, /<TabNotas embedded onOpenDocuments=/);
  assert.match(workspace, /<TabDocumentos embedded focusServiceCode=/);
  assert.doesNotMatch(workspace, /router\.refresh|router\.push|router\.replace|window\.location\.assign/);
});

test("separadores e URLs legadas preservam aluno e ano letivo", async () => {
  const workspace = await source("components/aluno/academico/AcademicoWorkspace.tsx");
  const target = await source("app/escola/[id]/aluno/disciplinas/page.tsx");
  const canonical = await source("app/(portal-aluno)/aluno/disciplinas/page.tsx");
  assert.match(workspace, /url\.searchParams\.set\("aba", tab\)/);
  assert.match(workspace, /new URL\(window\.location\.href\)/);
  for (const page of [target, canonical]) {
    assert.match(page, /aba: "disciplinas"/);
    assert.match(page, /query\.set\("aluno", input\.aluno\)/);
    assert.match(page, /query\.set\("ano_letivo_id", input\.ano_letivo_id\)/);
  }
});

test("lista de disciplinas respeita autorização, escola, educando e sessão académica sem exigir pagamento de notas", async () => {
  const api = await source("app/api/aluno/disciplinas/route.ts");
  const ui = await source("components/aluno/disciplinas/DisciplinasList.tsx");
  assert.match(api, /getAlunoContext\(\)/);
  assert.match(api, /ctx\.alunoIds\.includes\(requestedId\)/);
  assert.match(api, /resolveSelectedStudentId\(/);
  assert.match(api, /resolveBoletimMatricula\(/);
  assert.match(api, /params\.get\("ano_letivo_id"\)/);
  assert.match(api, /\.eq\("escola_id", ctx\.escolaId\)/);
  assert.match(api, /\.eq\("turma_id", matricula\.turma_id\)/);
  assert.doesNotMatch(api, /\.from\("notas"\)|checkBoletimAccess\(/);
  assert.match(ui, /studentId/);
  assert.match(ui, /ano_letivo_id/);
  assert.match(ui, /controller\.abort\(\)/);
  assert.match(ui, /scope === query/);
});

test("pagamento do boletim só é oferecido quando existe taxa válida; nunca desbloqueia notas no cliente", async () => {
  const notes = await source("components/aluno/tabs/TabNotas.tsx");
  assert.match(notes, /boletimServico\?\.pagamento_configurado !== false/);
  assert.match(notes, /Number\(boletimServico\?\.valor\) > 0/);
  assert.match(notes, /serviceUnconfigured/);
  assert.match(notes, /A escola ainda não definiu a taxa deste serviço/);
  assert.match(notes, /onOpenDocuments/);
  assert.match(notes, /safeIsLiberado/);
  assert.match(notes, /json\.is_liberado \? json\.disciplinas \?\? \[\] : \[\]/);
});

test("documentos usam descrição na largura total e ação no rodapé, sem comprimir cartões em ecrãs estreitos", async () => {
  const catalog = await source("components/aluno/tabs/TabDocumentos.tsx");
  assert.match(catalog, /min-w-0 space-y-2 rounded-xl/);
  assert.match(catalog, /line-clamp-2 break-words text-sm leading-5/);
  assert.match(catalog, /border-t border-border pt-2 sm:justify-end/);
  assert.match(catalog, /<PortalAction onClick=\{\(\) => void handleAction\(doc\)\}/);
  assert.match(catalog, /onOpenNotas/);
  assert.match(catalog, /pagamento_configurado === false/);
  assert.doesNotMatch(catalog, /flex items-start justify-between gap-4 sm:gap-6/);
});
