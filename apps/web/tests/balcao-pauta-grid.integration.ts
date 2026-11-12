import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

test("inline pupil pauta preserves existing zero, validates scale and retries only failed cells", async () => {
  const modulePath = process.env.TEST_JSDOM_MODULE;
  assert.ok(modulePath, "Use the existing pinned temporary DOM fixture");
  const { JSDOM } = await import(pathToFileURL(modulePath).href);
  const dom = new JSDOM("<div id='root'></div>", { url: "https://fixture.invalid" });
  for (const key of ["window", "document", "HTMLElement", "HTMLInputElement", "Event", "MouseEvent", "MutationObserver"])
    Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true, writable: true });
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const React = await import("react"); (globalThis as any).React = React;
  const { createRoot } = await import("react-dom/client");
  const { BalcaoPautaGrid, parsePautaValue } = await import("../src/components/secretaria/BalcaoPautaGrid");
  assert.equal(parsePautaValue("0", 10), 0);
  assert.equal(parsePautaValue("5,5", 10), 5.5);
  for (const value of ["", "11", "-1", "texto"]) assert.throws(() => parsePautaValue(value, 10));
  const originalFetch = globalThis.fetch;
  const posts: any[] = [];
  let fail = true, updates = 0, failHistorical = false;
  let gridReads = 0;
  let periodState = "past", active = true, maximum: number | null = 10;
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    if (init?.method === "POST") {
      const body = JSON.parse(String(init.body)); posts.push(body);
      assert.ok(["/api/secretaria/notas", "/api/secretaria/notas/historicas"].includes(url));
      assert.ok(new Headers(init.headers).get("Idempotency-Key"));
      if (url.endsWith("/historicas")) {
        if (failHistorical) { failHistorical = false; return Response.json({ ok: false, error: "Lote não guardado" }, { status: 409 }); }
        assert.equal(body.matricula_id, "source");
        assert.equal(body.motivo, "Transcrição de nota conforme pauta física escolar");
      } else assert.equal(body.notas[0].aluno_id, "pupil");
      if (body.turma_disciplina_id === "td2" && fail) { fail = false; return Response.json({ ok: false, error: "Falha sintética" }, { status: 409 }); }
      return Response.json({ ok: true });
    }
    assert.equal(init?.cache, "no-store");
    if (url.includes("/disciplinas?")) return Response.json({ ok: true, items: [
      { id: "td1", disciplina: { id: "d1", nome: "Português" } },
      { id: "td2", disciplina: { id: "d2", nome: "Matemática" } },
    ] });
    if (url.includes("/periodos?")) return Response.json({ ok: true, read_only: false,
      items: [1, 2, 3].map(numero => ({ numero, disciplina_ativa: active, estado: periodState })) });
    gridReads++;
    assert.ok(url.includes("/pauta-grid?") && url.includes("alunoId=pupil") && url.includes("anoLetivoId=year"));
    return Response.json({ ok: true, items: [{ aluno_id: "pupil", componentes: url.includes("td1") ? { MAC: 0, NPT: 7 } : {} }],
      meta: { nota_maxima: maximum, entrada_numerica_permitida: maximum !== null, componentes_ativos: ["MAC", "NPP", "NPT"] } });
  }) as typeof fetch;
  const root = createRoot(document.getElementById("root")!);
  const tick = async () => { await new Promise(resolve => setTimeout(resolve, 10)); };
  const button = (text: string) => [...document.querySelectorAll("button")].find(b => b.textContent === text)!;
  const input = (name: string) => document.querySelector<HTMLInputElement>(`input[aria-label='${name}']`)!;
  const edit = async (name: string, value: string) => { await React.act(async () => {
    const field = input(name);
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(field, value);
    field.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  }); };
  try {
    await React.act(async () => { root.render(React.createElement(BalcaoPautaGrid, {
      escolaId: "school", alunoId: "pupil", matriculaId: "source", turmaId: "class", anoLetivoId: "year",
      ano: 2025, historical: false, onSaved: async () => { updates++; },
    })); await tick(); });
    await React.act(tick);
    assert.equal(document.querySelectorAll("input").length, 6, "editable grid is mounted without a launch-note click");
    assert.equal(input("Português · MAC · 1.º trimestre").value, "0");
    assert.equal(input("Matemática · MAC · 1.º trimestre").value, "");
    await edit("Português · MAC · 1.º trimestre", "3");
    await edit("Matemática · NPT · 1.º trimestre", "11");
    await React.act(async () => { button("Guardar notas").click(); await tick(); });
    assert.equal(posts.length, 0, "invalid scale must prevent writes");
    assert.ok(document.querySelector('[aria-invalid="true"]'));
    await edit("Matemática · NPT · 1.º trimestre", "6");
    await React.act(async () => { button("Guardar notas").click(); await tick(); });
    assert.equal(posts.length, 2); assert.equal(updates, 0, "retain failed drafts before refreshing the parent");
    assert.match(document.body.textContent!, /Falha sintética/);
    assert.equal(input("Português · MAC · 1.º trimestre").value, "3");
    assert.equal(input("Matemática · NPT · 1.º trimestre").value, "6");
    await React.act(async () => { button("Guardar notas").click(); await tick(); });
    assert.equal(posts.length, 3, "retry must not resend the already committed Portuguese mark");
    assert.equal(posts[2].turma_disciplina_id, "td2");
    assert.equal(updates, 1);
    assert.equal(button("Guardar notas").disabled, true);
    await edit("Português · MAC · 1.º trimestre", "3.0");
    await React.act(async () => { button("Guardar notas").click(); await tick(); });
    assert.equal(posts.length, 3, "formatting alone must not write a grade");
    assert.equal(button("Guardar notas").disabled, true);
    await edit("Português · MAC · 1.º trimestre", "");
    await React.act(async () => { button("Guardar notas").click(); await tick(); });
    assert.equal(posts.length, 3, "clearing must never fabricate a zero or silently delete a grade");
    assert.equal(input("Português · MAC · 1.º trimestre").getAttribute("aria-invalid"), "true");
    let confirmations = 0;
    dom.window.confirm = () => { confirmations++; return true; };
    periodState = "future";
    await React.act(async () => { button("2.º").click(); await tick(); });
    await React.act(tick);
    assert.equal(confirmations, 0, "switching trimester never discards the yearly draft");
    assert.equal(button("2.º").getAttribute("aria-pressed"), "true");
    assert.equal(document.querySelectorAll("input:not(:disabled)").length, 0, "future periods remain blocked");
    await React.act(async () => { button("1.º").click(); await tick(); });
    assert.equal(input("Português · MAC · 1.º trimestre").value, "", "draft is retained on returning to cached trimester");
    periodState = "past"; active = false;
    await React.act(async () => { button("Atualizar pauta").click(); await tick(); });
    await React.act(tick);
    assert.equal(document.querySelectorAll("input:not(:disabled)").length, 0, "inactive discipline periods remain blocked");
    active = true; maximum = null;
    await React.act(async () => { button("Atualizar pauta").click(); await tick(); });
    await React.act(tick);
    assert.equal(document.querySelectorAll("input").length, 0, "qualitative evaluation must never offer numeric input");
    assert.match(document.body.textContent!, /Avaliação não numérica/);
    assert.equal(posts.length, 3);

    maximum = 10; active = true;
    await React.act(async () => { root.render(React.createElement(BalcaoPautaGrid, {
      escolaId: "school", alunoId: "pupil", matriculaId: "source", turmaId: "class", anoLetivoId: "year",
      ano: 2025, historical: true, onSaved: async () => { updates++; },
    })); await tick(); });
    await React.act(tick);
    const beforeAnnual = posts.length;
    await edit("Português · NPP · 1.º trimestre", "5");
    await React.act(async () => { button("2.º").click(); await tick(); }); await React.act(tick);
    await edit("Português · NPP · 2.º trimestre", "6");
    await React.act(async () => { button("3.º").click(); await tick(); }); await React.act(tick);
    await edit("Matemática · MAC · 3.º trimestre", "0");
    const loadedReads = gridReads;
    await React.act(async () => { button("1.º").click(); await tick(); });
    assert.equal(input("Português · NPP · 1.º trimestre").value, "5");
    assert.equal(gridReads, loadedReads, "cached trimester opens immediately without reloading");
    assert.equal(posts.length, beforeAnnual, "three trimester drafts require no intermediate save");
    failHistorical = true;
    await React.act(async () => { button("Guardar notas").click(); await tick(); });
    assert.equal(button("Guardar notas").disabled, false, "failed transaction retains every trimester draft");
    assert.match(document.body.textContent!, /Lote não guardado/);
    await React.act(async () => { button("Guardar notas").click(); await tick(); });
    assert.equal(posts.length, beforeAnnual+2, "one request per save, including retry");
    assert.equal(posts.at(-1).notas.length, 3);
    assert.deepEqual(posts.at(-1).notas.map((x: any) => x.trimestre), [1,2,3]);
    assert.equal(posts.at(-1).notas[2].valor, 0);
    assert.equal(button("Guardar notas").disabled, true);
    assert.equal(button("1.º").getAttribute("aria-pressed"), "true", "successful save preserves the selected trimester");
    const beforeParent = posts.length;

    // Exercise the real parent: entry is immediate, unsaved marks block the
    // verified continuation CTA, and successful writes refresh eligibility.
    maximum = 10; active = true;
    const { BalcaoSituacaoAcademica } = await import("../src/components/secretaria/BalcaoSituacaoAcademica");
    let continued = 0, refreshed = 0, legacyOpened = 0;
    const snapshot = {
      ok: true as const, aluno_id: "pupil",
      ano: { id: "year-next", ano: 2026, label: "2026/2027", ativo: true, arquivado_com_pendencias: false },
      current: null, previous: {
        matricula_id: "source", escola_id: "school", aluno_id: "pupil", ano_letivo: 2025,
        ano_letivo_id: "year", turma_id: "class", status_persistido: "pendente",
        situacao_contextual: "regularizacao_historica" as const,
        situacao_resultado: "sem_resultado_oficial" as const,
        acao_contextual: "conciliar_historico", resultado_oficial: null,
      },
      can_write_current_grades: false, editable_historical_matricula_id: "source",
      historical_evaluation_scale: "quantitativa_primario",
    };
    const renderSituation = async (ready: boolean) => {
      await React.act(async () => { root.render(React.createElement(BalcaoSituacaoAcademica, {
        snapshot, loading: false, error: null,
        refresh: async () => { refreshed++; },
        onAcademicUpdated: async () => { updates++; },
        onCurrentGrade: () => { legacyOpened++; }, onHistoricalGrade: () => { legacyOpened++; },
        canContinueEnrollment: ready, onContinueEnrollment: () => { continued++; },
      })); await tick(); });
      await React.act(tick);
    };
    await renderSituation(false);
    assert.equal(document.querySelectorAll("input").length, 6);
    assert.equal(legacyOpened, 0, "the parent must not depend on opening a modal");
    assert.equal(button("Concluir rematrícula de 2026"), undefined, "only verified READY may offer completion");
    assert.ok(button("Validar resultado de 2025"), "historical decision remains reachable after grade entry");
    await renderSituation(true);
    await edit("Português · NPP · 1.º trimestre", "6");
    assert.equal(button("Concluir rematrícula de 2026").disabled, true);
    assert.equal(button("Atualizar").disabled, true);
    await React.act(async () => { button("Guardar notas").click(); await tick(); });
    assert.equal(posts.length, beforeParent+1);
    assert.equal(refreshed, 1);
    assert.equal(button("Concluir rematrícula de 2026").disabled, false);
    await React.act(async () => { button("Concluir rematrícula de 2026").click(); });
    assert.equal(continued, 1);
    assert.equal(legacyOpened, 0);
    snapshot.editable_historical_matricula_id = null as any;
    await renderSituation(false);
    assert.equal(document.querySelectorAll("input").length, 0, "revoked grade permission removes the editor and its drafts");
  } finally { await React.act(async () => root.unmount()); globalThis.fetch = originalFetch; dom.window.close(); }
});
