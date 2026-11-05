import test, { after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import postgres from "postgres";
import { balcaoAcademicOperation, canManageBalcaoAcademic } from "../src/lib/rematricula/balcao-academic-operation";
import { resolveRaaProgressionForMatricula } from "../src/lib/academico/raa-progression-server";
import { classifyRematriculaAcademicEligibility } from "../src/lib/rematricula/eligibility";
import { postgresSupabase } from "./fixtures/balcao-postgres-adapter";

const url = process.env.PGURL;
assert.ok(url, "PGURL must select a disposable database");
const parsed = new URL(url);
assert.ok(["localhost", "127.0.0.1"].includes(parsed.hostname) && parsed.pathname.startsWith("/balcao_"), "Never run this fixture against a remote/customer DB");
const sql = postgres(url, { max: 4 });
after(async () => { await sql.end({ timeout: 1 }); });
const school = "20000000-0000-4000-8000-000000000001", source = "60000000-0000-4000-8000-000000000001";
const secretary = "10000000-0000-4000-8000-000000000002", discipline = "70000000-0000-4000-8000-000000000001";
const turma = "40000000-0000-4000-8000-000000000001", student = "50000000-0000-4000-8000-000000000001";
const root = resolve(process.cwd(), "../..");

async function asSecretary<T>(run: (db: any, tx: any) => Promise<T>) {
  return sql.begin(async (tx) => {
    await tx.unsafe("SET LOCAL ROLE authenticated");
    await tx`select set_config('request.jwt.claim.sub', ${secretary}, true)`;
    return run(postgresSupabase(tx, secretary), tx);
  });
}
async function eligibility() {
  return asSecretary(async (db) => {
    const r = await resolveRaaProgressionForMatricula(db, school, { id: source, turma_id: turma, aluno_id: student });
    return classifyRematriculaAcademicEligibility({ decision: r.progression.decision, destino: r.progression.destino,
      efetivacaoMatriculaBloqueada: r.efetivacaoMatriculaBloqueada, disciplinaIdsPendentes: r.progression.disciplinaIdsPendentes });
  });
}

// This is an explicit API/auth/Storage fixture. The React component, schema,
// canonical TS adapter, SQL functions, RLS and audit triggers are real code.
// It does not claim an authenticated journey against the hosted Supabase API.
test("real button events -> secretaria SQL writes -> actual canonical rematricula eligibility", async () => {
  const seed = readFileSync(resolve(root, "supabase/ops/tests/balcao_academic_resolution/regression.sql"), "utf8").split("SET LOCAL ROLE authenticated;")[0];
  await sql.begin(async (tx) => { await tx.unsafe(seed.replace("BEGIN;", "")); });
  await sql`update public.turmas set regime=${sql.json({ nivel_ensino: "secundario", classe_num: 8, escala: "quantitativa_secundario", eh_classe_exame: false, exames_aplicaveis: ["extraordinario"] })}`;
  assert.equal((await eligibility()).eligible, false);
  const jsdomPath = process.env.TEST_JSDOM_MODULE;
  assert.ok(jsdomPath, "Install the pinned temporary JSDOM fixture as documented");
  const { JSDOM } = await import(pathToFileURL(jsdomPath).href);
  const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "https://fixture.invalid" });
  for (const key of ["window", "document", "HTMLElement", "HTMLInputElement", "HTMLSelectElement", "Event", "MouseEvent", "MutationObserver"]) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true, writable: true });
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const React = await import("react"); (globalThis as any).React = React;
  const { createRoot } = await import("react-dom/client");
  const { fireEvent, getByRole, getByLabelText, queryByRole } = await import("@testing-library/dom");
  const { BalcaoAcademicOperations } = await import("../src/components/secretaria/BalcaoAcademicOperations");
  const savedFetch = globalThis.fetch; let rechecks = 0; let latest: any; let mutation: any;
  const rendered = createRoot(document.getElementById("root")!);
  let noteTarget: unknown; let pdf: Uint8Array | undefined;

  async function getContext() {
    return asSecretary(async (_, tx) => {
      const [member] = await tx`select papel from public.escola_users where escola_id=${school} and user_id=${secretary}`;
      const [m] = await tx`select * from public.matriculas where id=${source} and escola_id=${school}`;
      const [t] = await tx`select regime from public.turmas where id=${turma}`;
      return { ok: true, can_manage: canManageBalcaoAcademic(member.papel), source: m, ano_ativo: true, regime: t.regime,
        disciplinas: await tx`select id,nome from public.disciplinas_catalogo where escola_id=${school}`,
        periodos: await tx`select id,numero,data_inicio::text,data_fim::text from public.periodos_letivos where escola_id=${school} order by numero`,
        resultados: await tx`select id,nota::float,estado,turma_disciplina_id from public.exame_resultados where escola_id=${school} and matricula_id=${source}`,
        sessoes: await tx`select id,tipo,estado,data_inicio::text from public.exame_sessoes where escola_id=${school} and estado in ('aberta','publicada')`,
        evidencias: await tx`select id,disciplina_id,suficiente from public.vw_raa_eja_avaliacoes_atuais where escola_id=${school} and matricula_id=${source}` };
    });
  }
  globalThis.fetch = (async (_url: any, init?: RequestInit) => {
    if (!String(_url).includes("/api/secretaria/balcao/raa/operacoes")) return savedFetch(_url, init);
    try {
      if (init?.method !== "POST") return Response.json(await getContext());
      const body = balcaoAcademicOperation.parse(JSON.parse(String(init.body)));
      const key = new Headers(init.headers).get("Idempotency-Key"); assert.ok(key);
      let data: any;
      if (body.acao === "publicar_pauta") {
        const claim = await asSecretary(async (db) => {
          const r = await db.rpc("balcao_resolver_academico", { p_escola_id: school, p_matricula_id: source, p_acao: "preparar_publicacao", p_chave: key, p_payload: { motivo: body.motivo, periodo_id: body.periodo_id, tipo: body.tipo } });
          if (r.error) throw r.error; return r.data;
        });
        // Real PDF renderer; explicit tiny payload/Storage provider fixture.
        const { renderPautaAnualBuffer } = await import("../src/lib/pedagogico/pauta-anual");
        pdf = await renderPautaAnualBuffer({ metadata: { provincia: "Fixture", escola: "Escola sintética", anoLectivo: "2026", turma: "A", curso: "Fixture", classe: "8", turno: "Manhã", emissao: "05/11/2026", diretorTurma: "Fixture", subDirector: "Fixture", diretorGeral: "Fixture", local: "Fixture" }, disciplinas: [{ id: discipline, nome: "Português" }], alunos: [{ aluno_id: student, numero: 1, nome: "Aluno sintético", idade: 14, sexo: "M", disciplinas: { [discipline]: { mt1: 12, mt2: 12, mt3: 12, mfd: 12 } }, resultado_final: "TRANSITOU" }] });
        assert.equal(Buffer.from(pdf).subarray(0, 4).toString(), "%PDF");
        await sql`insert into storage.objects(bucket_id,name,metadata) values('pautas_oficiais_fechadas',${claim.pdf_path},${sql.json({ size: pdf.length, mimetype: "application/pdf" })})`;
        data = await asSecretary(async (db) => { const r = await db.rpc("balcao_concluir_publicacao", { p_escola_id: school, p_matricula_id: source, p_chave: key, p_token: claim.token, p_sucesso: true }); if (r.error) throw r.error; return r.data; });
        data.download_url = "https://fixture.invalid/pauta.pdf";
      } else {
        data = await asSecretary(async (db) => {
          const { acao, matricula_id: _, ...payload } = body;
          const r = await db.rpc("balcao_resolver_academico", { p_escola_id: school, p_matricula_id: source, p_acao: acao, p_payload: payload, p_chave: key });
          if (r.error) throw r.error; return r.data;
        });
      }
      mutation = { acao: body.acao, ...data }; return Response.json(data);
    } catch (error) { return Response.json({ ok: false, error: String((error as Error).message) }, { status: 409 }); }
  }) as typeof fetch;

  const button = (name: RegExp) => getByRole(document.body, "button", { name });
  const select = (name: RegExp) => getByLabelText(document.body, name) as HTMLSelectElement;
  const change = async (element: Element, value: string) => React.act(async () => { fireEvent.change(element, { target: { value } }); });
  const click = async (element: Element) => React.act(async () => { fireEvent.click(element); });
  async function settle(predicate: () => boolean) {
    for (let n = 0; n < 300; n++) { await React.act(async () => { await new Promise((r) => setTimeout(r, 10)); }); if (predicate()) return; }
    throw new Error("UI did not finish: " + document.body.textContent);
  }
  async function commit() {
    await change(getByLabelText(document.body, /Fundamentação/), "Operação conferida e registada pela secretaria");
    await click(button(/^Rever e confirmar$/));
    const before = rechecks;
    await click(button(/^Confirmar e guardar$/));
    await settle(() => rechecks > before && !document.body.textContent?.includes("A guardar…"));
  }
  try {
    await React.act(async () => rendered.render(React.createElement(BalcaoAcademicOperations, { matriculaId: source,
      onLancarNota: (...args: unknown[]) => { noteTarget = args; },
      onRecheck: async () => { latest = await eligibility(); rechecks++; return { ok: true, academic: latest }; },
    })));
    await click(button(/Resolver operação académica aqui/)); await settle(() => !!queryByRole(document.body, "combobox", { name: /^Operação/ }));
    await change(select(/^Disciplina de origem/), discipline);
    await change(select(/^Período de origem/), "90000000-0000-4000-8000-000000000001");
    await commit(); assert.equal(mutation.acao, "reabrir_periodo"); assert.equal(latest.eligible, false);
    await click(button(/Corrigir notas agora/)); assert.deepEqual(noteTarget, [1, discipline]);

    await change(select(/^Operação/), "abrir_exame");
    await change(select(/^Tipo$/), "extraordinario");
    await change(getByLabelText(document.body, /^Início/), "2026-01-02");
    await change(getByLabelText(document.body, /^Fim/), "2026-01-03");
    await commit(); assert.equal(mutation.estado, "aberta"); assert.equal(latest.eligible, false);
    const session = mutation.id;
    await asSecretary(async (_, tx) => tx`insert into public.exame_resultados(escola_id,exame_sessao_id,exame_componente_id,matricula_id,aluno_id,turma_disciplina_id,nota,estado,lancado_por)
      select ${school},${session},id,${source},${student},'80000000-0000-4000-8000-000000000001',12,'submetido',${secretary} from public.exame_componentes where exame_sessao_id=${session}`);
    await click(button(/Resolver operação académica aqui/)); await click(button(/Resolver operação académica aqui/));
    await settle(() => !document.body.textContent?.includes("A confirmar permissões"));
    await change(select(/^Operação/), "validar_exame");
    const [result] = await sql`select id from public.exame_resultados where exame_sessao_id=${session}`;
    await change(select(/^Resultado submetido/), result.id); await commit();
    assert.equal(mutation.estado, "validado"); assert.equal(latest.eligible, false);

    await change(select(/^Operação/), "publicar_exame");
    await change(select(/^Sessão cujos resultados/), session); await commit();
    assert.equal(mutation.estado, "encerrada"); assert.equal(latest.eligible, true);
    assert.equal(latest.code, "ACADEMIC_READY");
    assert.match(document.body.textContent!, /Situação académica regularizada/);

    await change(select(/^Operação/), "publicar_pauta");
    await commit(); assert.equal(mutation.status, "SUCCESS"); assert.ok(pdf && pdf.length >= 800);
    assert.equal(latest.eligible, true); // PDF itself is not what released the academic block.
    assert.ok(getByRole(document.body, "link", { name: /Abrir pauta publicada/ }));

    await sql`update public.turmas set regime=${sql.json({ nivel_ensino: "eja", modulo_numero: 1, escala: "qualitativa", eh_classe_exame: false, exames_aplicaveis: [] })}`;
    await click(button(/Resolver operação académica aqui/)); await click(button(/Resolver operação académica aqui/));
    await settle(() => !document.body.textContent?.includes("A confirmar permissões"));
    await change(select(/^Operação/), "registar_eja");
    await change(select(/^Avaliação oficial/), "suficiente");
    await change(getByLabelText(document.body, /^Referência do documento/), "ATA-EJA-TESTE");
    await commit(); assert.equal(latest.eligible, false);
    await sql`insert into public.frequencia_status_periodo select ${school},${source},30,0,30,id from public.periodos_letivos`;
    await change(select(/^Avaliação oficial/), "suficiente");
    await change(getByLabelText(document.body, /^Referência do documento/), "ATA-EJA-CONFIRMADA");
    await commit(); assert.equal(latest.eligible, true);
    const [audit] = await sql`select count(*)::int as n from public.audit_logs where actor_id=${secretary} and action like 'BALCAO_ACADEMIC_%'`;
    assert.ok(audit.n >= 7, "Every successful button mutation must have its secretary audit");
  } finally { await React.act(async () => rendered.unmount()); globalThis.fetch = savedFetch; dom.window.close(); await sql.end(); }
});
