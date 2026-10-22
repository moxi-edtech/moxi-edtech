import React, { useState } from "react";
import { emitFixtureAuth } from "./auth-fixture";
import { canUseOperationalCopilot } from "../src/lib/roles/ai-roles";
import TransferForm from "../src/components/secretaria/TransferForm";
import AiChatWidget from "../src/components/ai/AiChatWidget";
import { createRoot } from "react-dom/client";
import "./fixture.css";
import OperationsDensityFixture from "./operations-density-fixture";
import "./operations-density-fixture.css";
import "../src/app/globals.css";
import {
  DocumentosPendentes, DocumentosRejeitados, NotasPagas, ProfessorComTurmas, DashboardClean, DashboardPending, DashboardRejected, DashboardRematricula, DashboardOverdue, DashboardEmpty, DashboardApproved, GradePaid, GradeUnpaid, GradePending, GradeRejected, GradeEmpty, NoticeInformativo, NoticeAtencao, NoticeCritico, NoticeSucesso, NoticeRematricula, NoticeFinanceiro,
} from "../src/components/aluno/PortalVisualFixtures.stories";

const stories: Record<string, { render?: (...args: unknown[]) => React.ReactNode }> = {
  "documentos-pendentes": DocumentosPendentes,
  "documentos-rejeitados": DocumentosRejeitados,
  "notas-pagas": NotasPagas,
  "professor-com-turmas": ProfessorComTurmas,
  "dashboard-clean": DashboardClean,
  "dashboard-pending": DashboardPending,
  "dashboard-rejected": DashboardRejected,
  "dashboard-rematricula": DashboardRematricula,
  "dashboard-overdue": DashboardOverdue,
  "dashboard-empty": DashboardEmpty,
  "dashboard-approved": DashboardApproved,
  "grade-paid": GradePaid,
  "grade-unpaid": GradeUnpaid,
  "grade-pending": GradePending,
  "grade-rejected": GradeRejected,
  "grade-empty": GradeEmpty,
  "notice-info": NoticeInformativo,
  "notice-attention": NoticeAtencao,
  "notice-critical": NoticeCritico,
  "notice-success": NoticeSucesso,
  "notice-rematricula": NoticeRematricula,
  "notice-finance": NoticeFinanceiro,
};
const name = new URLSearchParams(window.location.search).get("story") || "documentos-pendentes";
// Fixture identity and mode are set before React mounts. No global mutation during render.
const fixtureModes: Record<string, NonNullable<Window["__klasseVisualFixture"]>> = {
  "documentos-pendentes": "pending", "documentos-rejeitados": "rejected",
  "notas-pagas": "paid", "professor-com-turmas": "professor",
  "dashboard-clean": "dashboard-clean", "dashboard-pending": "dashboard-pending",
  "dashboard-rejected": "dashboard-rejected", "dashboard-rematricula": "dashboard-rematricula",
  "dashboard-overdue": "dashboard-overdue", "dashboard-empty": "dashboard-empty",
  "dashboard-approved": "dashboard-approved",
  "grade-paid": "grade-paid",
  "grade-unpaid": "grade-unpaid",
  "grade-pending": "grade-pending",
  "grade-rejected": "grade-rejected",
  "grade-empty": "grade-empty",
  "notice-info": "notice-info",
  "notice-attention": "notice-attention",
  "notice-critical": "notice-critical",
  "notice-success": "notice-success",
  "notice-rematricula": "notice-rematricula",
  "notice-finance": "notice-finance",
};
window.__klasseVisualFixture = fixtureModes[name] ?? "pending";
if (name === "class-transfer") {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("/api/secretaria/turmas-simples")) return new Response(JSON.stringify({ok:true,items:[
      {id:"00000000-0000-4000-8000-000000000011",nome:"Turma A",ano_letivo:2026,classe_id:"c",curso_id:"x"},
      {id:"00000000-0000-4000-8000-000000000012",nome:"Turma B",ano_letivo:2026,classe_id:"c",curso_id:"x"}
    ]}),{status:200,headers:{"Content-Type":"application/json"}});
    if (url.includes("/check-transfer")) return new Response(JSON.stringify({allow:true,lotada:false,vagas_restantes:4,mudanca_turno:false,financeiro:{altera_valor:false,valor_antigo:0,valor_novo:0,diferenca:0,mensagem:"Sem alteração financeira"}}),{status:200,headers:{"Content-Type":"application/json"}});
    if (url.includes("/transfer") && init?.method==="PUT") return new Response(JSON.stringify({ok:true,matricula_id:"00000000-0000-4000-8000-000000000021"}),{status:200,headers:{"Content-Type":"application/json"}});
    return originalFetch(input,init);
  };
}
// Fully synthetic and offline: browser contract for the REAL KLASSE IA widget.
// Never captures or requests information from the school database.
const fixtureScope = new URLSearchParams(window.location.search);
const fixtureRole = fixtureScope.get("role") || "admin";
const fixtureSchool = fixtureScope.get("school") === "B"
  ? "00000000-0000-4000-8000-0000000000b2"
  : "00000000-0000-4000-8000-0000000000a1";
const fixtureUser = fixtureScope.get("user") === "B"
  ? "00000000-0000-4000-8000-0000000000d2"
  : "00000000-0000-4000-8000-0000000000d1";
let activeFixtureSchool = fixtureSchool;
let activeFixtureUser: string | null = fixtureUser;
const fixtureCounters = { access: 0, assistant: 0, failed: 0 };
Object.assign(window, { __klasseFixtureCounters: fixtureCounters });
if (name === "school-intelligence") {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("/api/admin/ai/access")) {
      fixtureCounters.access++;
      const allowed = Boolean(activeFixtureUser) && canUseOperationalCopilot(fixtureRole);
      return new Response(JSON.stringify({ ok: true, data: {
        allowed, role: fixtureRole, userId: activeFixtureUser, schoolId: activeFixtureSchool,
      } }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url.includes("/api/admin/ai/assistant")) {
      fixtureCounters.assistant++;
      const body = JSON.parse(String(init?.body ?? "{}"));
      const question = String(body.message ?? "");
      if (/demora de teste/i.test(question)) {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("Abortado", "AbortError")), { once: true });
        });
      }
      if (/erro de teste/i.test(question) && fixtureCounters.failed++ === 0) {
        return new Response(JSON.stringify({ ok:false, error:"Falha sintética" }), { status:503, headers:{"Content-Type":"application/json"} });
      }
      const list = /quais|lista|mostra/i.test(question);
      const table = /tabela de teste/i.test(question);
      const schoolAllowed = body.schoolId === activeFixtureSchool;
      const denied = !schoolAllowed || fixtureRole === "secretaria";
      const diagnosis = denied
        ? "Não posso determinar este resultado com segurança. O polo não tem vínculo canónico comprovado."
        : table ? "43 cobranças de 80 estão pendentes.\n\n| Turma | Cobranças pendentes |\n| --- | ---: |\n| Turma A | 23 cobranças |\n| Turma B | 20 cobranças |"
        : list ? "2 de 8 docentes têm lançamentos pendentes.\n\n1. Professor Sintético 01 — 10.ª A · Matemática\n2. Professor Sintético 02 — 10.ª B · Física"
          : "2 de 8 docentes têm lançamentos com prazo vencido.";
      const source = "academic-grade-gaps · vw_professor_pendencias + periodos_letivos";
      return new Response(JSON.stringify({ ok: true, mode: "data_query", operatingMode: "data",
        answer: `**Diagnóstico**\n${diagnosis}\n\n**Impacto**\n1 lançamento pendente; 1 lançamento incompleto.\n\n**Próximo passo**\nConferir pautas na área de Notas.`,
        insight: { severity: "info", diagnosis, impact: "1 lançamento pendente; 1 incompleto.", recommendation: "Conferir pautas na área de Notas.",
          evidence: [{ label: "Docentes em atraso", value: denied ? "Indisponível" : "2/8" },
            { label: "Trimestre", value: "1" }, { label: "Prazo", value: "2026-09-30" }], actions: [],
          provenance: { source, consultedAt: "2026-10-21T09:00:00Z", scope: `Escola sintética ${fixtureSchool.endsWith("a1") ? "A" : "B"} · ano 2026 · 1.º trimestre`,
            freshness: denied ? "unknown" : "partial", limitation: "Dados exclusivamente sintéticos" },
        },
        conversation: denied ? undefined : { userId: activeFixtureUser, schoolId: activeFixtureSchool,
          poloId: null, intent: list ? "teacher_pending_details" : "teacher_grade_deadlines",
          filters: { academicYearId: body.context?.academicYearId, trimester: 1, classNumber: 10, page: 0 }, consultedAt: Date.now() },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return originalFetch(input, init);
  };
}
const Scene = stories[name]?.render;
const target = document.getElementById("root");
if (target && name === "school-intelligence") {
  function ChatFixture() {
    const [school, setSchool] = useState(fixtureSchool);
    const [userId, setUserId] = useState<string | null>(fixtureUser);
    const [, forceRouteUpdate] = useState(0);
    const nextYear = () => {
      const params = new URLSearchParams(window.location.search);
      params.set("ano_letivo_id", "00000000-0000-4000-8000-000000000405");
      history.pushState(null, "", `${location.pathname}?${params.toString()}`);
      forceRouteUpdate((previous) => previous + 1);
    };
    const nextPolo = () => {
      const params = new URLSearchParams(window.location.search);
      params.set("polo_id", "00000000-0000-4000-8000-000000000406");
      history.pushState(null, "", `${location.pathname}?${params.toString()}`);
      forceRouteUpdate((previous) => previous + 1);
    };
    const changeUser = () => {
      const next = userId === "00000000-0000-4000-8000-0000000000d2"
        ? "00000000-0000-4000-8000-0000000000d1"
        : "00000000-0000-4000-8000-0000000000d2";
      activeFixtureUser = next;
      setUserId(next);
      emitFixtureAuth("SIGNED_IN", next);
    };
    return <main style={{ minHeight: "100vh", padding: 24, background: "#f1f5f9", color: "#1e293b" }}>
      <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, color: "#64748b" }}>AMBIENTE DE TESTE · SEM DADOS REAIS</p>
      <h1 style={{ fontSize: 25, fontWeight: 700 }}>KLASSE · Secretaria</h1>
      <p>Escola sintética {school.endsWith("a1") ? "A" : "B"} · Perfil: {fixtureRole} · Utilizador: {userId?.endsWith("d2") ? "B" : "A"}</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" onClick={() => { const next = school.endsWith("a1") ? "00000000-0000-4000-8000-0000000000b2" : "00000000-0000-4000-8000-0000000000a1"; activeFixtureSchool = next; setSchool(next); }}>Trocar escola sintética</button>
        <button type="button" onClick={nextYear}>Trocar ano sintético</button>
        <button type="button" onClick={nextPolo}>Trocar polo sintético</button>
        <button type="button" onClick={changeUser}>Trocar utilizador sintético</button>
        <button type="button" onClick={() => { activeFixtureUser = null; setUserId(null); emitFixtureAuth("SIGNED_OUT", null); }}>Logout sintético</button>
      </div>
      <output id="fixture-request-counts" data-access={fixtureCounters.access} data-assistant={fixtureCounters.assistant}>{fixtureCounters.access} / {fixtureCounters.assistant}</output>
      <AiChatWidget schoolId={school} schoolParam={school.endsWith("a1") ? "escola-sintetica-a" : "escola-sintetica-b"} context={{ module: "secretaria", page: "balcao" }} />
    </main>;
  }
  createRoot(target).render(<ChatFixture />);
} else if (target && name === "operations-density") createRoot(target).render(<OperationsDensityFixture state={(new URLSearchParams(window.location.search).get("state") || "pending") as "pending" | "clean" | "empty" | "loading" | "error"} baseline={new URLSearchParams(window.location.search).get("baseline") === "1"} />);
else if (target && name === "class-transfer") createRoot(target).render(<main style={{maxWidth:720,margin:"24px auto",padding:16}}><h1>Correção de turma · Matrícula sintética</h1><TransferForm matriculaId="00000000-0000-4000-8000-000000000021" currentTurmaId="00000000-0000-4000-8000-000000000011" anoLetivo={2026} anoLetivoId="00000000-0000-4000-8000-000000000006" onSuccess={()=>{}} /></main>);
else if (target && Scene) createRoot(target).render(<>{Scene()}</>);
else if (target) target.textContent = "Visual fixture not found";
