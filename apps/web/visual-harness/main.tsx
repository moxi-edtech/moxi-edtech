import React from "react";
import TransferForm from "../src/components/secretaria/TransferForm";
import { createRoot } from "react-dom/client";
import "./fixture.css";
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
const Scene = stories[name]?.render;
const target = document.getElementById("root");
if (target && name === "class-transfer") createRoot(target).render(<main style={{maxWidth:720,margin:"24px auto",padding:16}}><h1>Correção de turma · Matrícula sintética</h1><TransferForm matriculaId="00000000-0000-4000-8000-000000000021" currentTurmaId="00000000-0000-4000-8000-000000000011" anoLetivo={2026} anoLetivoId="00000000-0000-4000-8000-000000000006" onSuccess={()=>{}} /></main>);
else if (target && Scene) createRoot(target).render(<>{Scene()}</>);
else if (target) target.textContent = "Visual fixture not found";
