import React from "react";
import TransferForm from "../src/components/secretaria/TransferForm";
import { createRoot } from "react-dom/client";
import { BalcaoWorkspace } from "../src/components/secretaria/BalcaoWorkspace";
import { RetainedActionPanels } from "../src/components/secretaria/command-center/RetainedActionPanels";
import { useBalcaoDraftForm } from "../src/components/secretaria/command-center/BalcaoDraftState";
import type { BalcaoActionId } from "../src/lib/balcao/action-registry";
import { readBalcaoStudentId, setBalcaoLocationContext } from "../src/lib/balcao/return-context";
import { FeedbackProvider } from "../src/components/feedback/FeedbackSystem";
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
// Test the *same* draft-state contract as the real forms. No private values are
// ever written to global state, navigation history or telemetry.
function SyntheticDraftFields({ action, student }: { action: BalcaoActionId; student: string }) {
  const [value, setValue] = React.useState("");
  const [attached, setAttached] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState({ value: "", attached: null as string | null });
  const [submitting, setSubmitting] = React.useState(false);
  useBalcaoDraftForm(action, { value, attached }, saved, { submitting });
  return <div className="min-w-0 max-w-full rounded-xl border p-3">
    <p data-testid={`target-${action}`}>{action === "enrollment" ? "Nova matrícula: aluno-alvo não selecionado" : "Aluno atual: "+student}</p>
    <label>Rascunho <input value={value} onChange={e=>setValue(e.target.value)} data-testid={`draft-${action}`} /></label>
    <label className="block min-w-0 max-w-full">Comprovativo <input className="block w-full min-w-0 max-w-full" type="file" data-testid={`file-${action}`} onChange={e=>setAttached(e.target.files?.[0]?.name ?? null)} /></label>
    <button type="button" data-testid={`programmatic-${action}`} onClick={()=>setValue("Gerado via React state")}>Programático</button>
    <button type="button" data-testid={`clear-${action}`} onClick={()=>{setValue("");setAttached(null)}}>Reverter</button>
    <button type="button" data-testid={`save-${action}`} onClick={()=>setSaved({value,attached})}>Guardar confirmado</button>
    <button type="button" data-testid={`submitting-${action}`} onClick={()=>setSubmitting(true)}>Iniciar submissão</button>
    <button type="button" data-testid={`failure-${action}`} onClick={()=>setSubmitting(false)}>Falha de submissão</button>
    <button type="button" data-testid={`finish-${action}`} onClick={()=>{setSaved({value,attached});setSubmitting(false)}}>Submissão confirmada</button>
  </div>;
}

function BalcaoRetentionFixture() {
  const [action, setAction] = React.useState<BalcaoActionId>("payment");
  const [actor, setActor] = React.useState("user-a");
  const [school, setSchool] = React.useState("school-a");
  const [polo, setPolo] = React.useState("polo-a");
  const [student, setStudent] = React.useState("student-a");
  const [revision, setRevision] = React.useState(0);
  const [unsaved, setUnsaved] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const scope = [actor, school, polo, student].join(":");
  const switchContext = (update: () => void) => {
    if (submitting) return;
    if (unsaved && !window.confirm("Descartar rascunhos pendentes?")) return;
    update(); setAction("payment");
  };
  return <main className="mx-auto max-w-2xl space-y-4 p-6">
    <h1>Balcão · contratos sintéticos</h1>
    <p data-testid="actor-context">{scope}</p>
    <p data-testid="has-unsaved">{String(unsaved)}</p>
    <p data-testid="is-submitting">{String(submitting)}</p>
    <div className="flex flex-wrap gap-2">
      {(["payment", "document", "enrollment", "profile", "grade"] as const).map(tab => (
        <button type="button" key={tab} data-testid={`go-${tab}`} onClick={() => setAction(tab)}>{tab}</button>
      ))}
    </div>
    <div className="flex flex-wrap gap-2">
      <button type="button" data-testid="switch-user" onClick={() => switchContext(()=>setActor("user-b"))}>Novo utilizador</button>
      <button type="button" data-testid="switch-school" onClick={() => switchContext(()=>setSchool("school-b"))}>Outra escola</button>
      <button type="button" data-testid="switch-polo" onClick={() => switchContext(()=>setPolo("polo-b"))}>Outro polo</button>
      <button type="button" data-testid="switch-student" onClick={() => switchContext(()=>setStudent("student-b"))}>Outro aluno</button>
      <button type="button" data-testid="server-confirmed-save" onClick={() => document.querySelector<HTMLButtonElement>(`[data-testid="save-${action}"]`)?.click()}>Guardar no servidor</button>
      <button type="button" data-testid="server-confirmed-mutation" onClick={() => setRevision(v=>v+1)}>Revalidar sem guardar</button>
    </div>
    <RetainedActionPanels key={scope} activeAction={action} contextSignature={scope+":"+revision}
      onUnsavedChange={setUnsaved} onSubmittingChange={setSubmitting}
      renderAction={panel => <SyntheticDraftFields action={panel} student={student} />}
    />
  </main>;
}

// Synthetic role-scoped integration of the *real* URL return-context helpers,
// React retained panel and generation race guard. It does not claim to exercise
// a Supabase-authenticated Next.js route or RLS; that remains a separate M2/M3
// gate requiring an intact disposable full migration replay.
function BalcaoRouteFixture() {
  const read = () => new URLSearchParams(window.location.search);
  const [currentAction, setCurrentAction] = React.useState<BalcaoActionId>("desk");
  const [studentId, setStudentId] = React.useState<string | null>("student-a");
  const [studentLabel, setStudentLabel] = React.useState("Aluno A · fictício");
  const [dirty, setDirty] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const requestId = React.useRef(0);
  const actionFromLocation = () => {
    const params=read();
    const value=params.get("action");
    const action = (["desk","payment","profile","enrollment","document","grade","reenrollment"] as string[]).includes(value || "")
      ? value as BalcaoActionId : "desk";
    setCurrentAction(action);
    setStudentId(readBalcaoStudentId(params,action));
  };
  React.useEffect(() => {
    const params=read();
    if (!params.get("alunoId")) {
      const next=setBalcaoLocationContext(params,"student-a","desk");
      window.history.replaceState(window.history.state,"","?"+next);
    }
    actionFromLocation();
    window.addEventListener("popstate",actionFromLocation);
    return ()=>window.removeEventListener("popstate",actionFromLocation);
  },[]);
  const visit = (action: BalcaoActionId) => {
    const next=setBalcaoLocationContext(read(),studentId,action);
    window.history.pushState(window.history.state,"","?"+next);
    setCurrentAction(action);
  };
  const select = (id:string, delayMs:number) => {
    if (submitting || (dirty && !window.confirm("Alterações pendentes. Trocar de aluno?"))) return;
    const generation=++requestId.current;
    window.setTimeout(()=>{
      if(generation!==requestId.current)return;
      setStudentId(id);
      setStudentLabel(id==="student-b"?"Aluno B · fictício":"Aluno A · fictício");
      setCurrentAction("desk");
      const next=setBalcaoLocationContext(read(),id,"desk");
      window.history.replaceState(window.history.state,"","?"+next);
    },delayMs);
  };
  return <main className="mx-auto max-w-3xl space-y-4 p-5" data-testid="balcao-route-fixture">
    <h1>Balcão / navegação autenticada em fixture (sem backend real)</h1>
    <p data-testid="route-actor">secretaria-fixture-role</p>
    <p data-testid="route-student">{studentId ?? "sem aluno"}</p>
    <p data-testid="route-action">{currentAction}</p>
    <p data-testid="route-dirty">{String(dirty)}</p>
    <nav aria-label="Abas do atendimento" className="flex flex-wrap gap-2">
      {(["desk","payment","profile","enrollment","document","grade","reenrollment"] as const).map(tab=>
        <button type="button" data-testid={"route-go-"+tab} key={tab} onClick={()=>visit(tab)}>{tab}</button>
      )}
      <button type="button" data-testid="route-select-slow-a" onClick={()=>select("student-a",450)}>Selecionar A, atraso</button>
      <button type="button" data-testid="route-select-fast-b" onClick={()=>select("student-b",15)}>Selecionar B, rápido</button>
    </nav>
    <RetainedActionPanels key={"secretaria-fixture:escola-a:polo-a:"+studentId} activeAction={currentAction}
      contextSignature={"secretaria-fixture:escola-a:polo-a:"+studentId}
      onUnsavedChange={setDirty} onSubmittingChange={setSubmitting}
      renderAction={panel=> <SyntheticDraftFields action={panel} student={studentLabel}/>}
    />
  </main>;
}

const Scene = stories[name]?.render;
const target = document.getElementById("root");
if (target && name === "balcao-route") createRoot(target).render(<BalcaoRouteFixture />);
else if (target && name === "balcao-retention") createRoot(target).render(<BalcaoRetentionFixture />);
else if (target && name === "balcao-perf") {
  const metrics = { commits: 0, duration: 0 };
  Object.assign(window, { __balcaoPerf: metrics });
  const fixtureStudent = { id: "00000000-0000-4000-8000-000000000401", label: "Aluno sintético" };
  createRoot(target).render(
    <FeedbackProvider>
      <React.Profiler id="BalcaoWorkspace" onRender={(_id, _phase, duration) => {
        metrics.commits += 1;
        metrics.duration += duration;
      }}>
        <BalcaoWorkspace open userScope="fixture-actor-a" poloScope="fixture-polo-a" escolaId="00000000-0000-4000-8000-000000000401"
          aluno={fixtureStudent} onClose={() => {}} />
      </React.Profiler>
    </FeedbackProvider>
  );
} else if (target && name === "class-transfer") createRoot(target).render(<main style={{maxWidth:720,margin:"24px auto",padding:16}}><h1>Correção de turma · Matrícula sintética</h1><TransferForm matriculaId="00000000-0000-4000-8000-000000000021" currentTurmaId="00000000-0000-4000-8000-000000000011" anoLetivo={2026} anoLetivoId="00000000-0000-4000-8000-000000000006" onSuccess={()=>{}} /></main>);
else if (target && Scene) createRoot(target).render(<>{Scene()}</>);
else if (target) target.textContent = "Visual fixture not found";
