import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const src = file => readFileSync(new URL("../../src/"+file,import.meta.url),"utf8");
const sql = readFileSync(new URL("../../../../supabase/migrations/20271203005100_fecho_diario_secretaria.sql",import.meta.url),"utf8");
test("cash and operational closes have one serialized canonical write per tenant/day",()=>{
 assert.match(sql,/pg_advisory_xact_lock\(hashtextextended\('cash-close:'/);
 assert.match(sql,/pg_advisory_xact_lock\(hashtextextended\('secretaria-close:'/);
 assert.match(sql,/pg_advisory_xact_lock_shared/);
 assert.match(sql,/UNIQUE\(escola_id,day_key\)/);
 assert.match(sql,/IF v_row.status<>'declared'/);
 assert.match(sql,/self_approval_not_allowed/);
 assert.match(sql,/REVOKE ALL ON public.fecho_caixa FROM PUBLIC,anon,authenticated/);
});
test("operational log and notification originate in the database transaction",()=>{
 assert.match(sql,/AFTER INSERT OR UPDATE OR DELETE/);
 assert.match(sql,/v_actor uuid:=auth.uid\(\)/);
 assert.match(sql,/INSERT INTO public.secretaria_expediente_operacoes/);
 assert.match(sql,/INSERT INTO public.secretaria_expedientes/);
 assert.match(sql,/secretaria.expediente.fechado/);
 assert.match(sql,/ON CONFLICT\(evento_id,destinatario_id\) DO NOTHING/);
 assert.match(sql,/secretaria_expediente_reminders/);
 assert.match(sql,/NOT is_after_close/);
});
test("API and PDF require authorized school and paginate historical rows",()=>{
 const api=src("app/api/escola/[id]/expediente/route.ts");
 const pdf=src("app/api/escola/[id]/expediente/pdf/route.ts");
 const access=src("lib/secretaria/expediente.ts");
 assert.match(api,/expedienteAccess\(id\)/);
 assert.match(pdf,/expedienteAccess\(/);
 assert.match(access,/resolveEscolaIdForUser\(supabase, user.id, requestedSchool\)/);
 assert.match(access,/\.eq\("tenant_type", "k12"\)/);
 assert.match(pdf,/while \(cursor < maxId\)/);
 assert.match(pdf,/rows.length > MAX_ROWS/);
 assert.match(pdf,/Adendos posteriores ao fecho/);
 assert.doesNotMatch(api+pdf+access,/SUPABASE_SERVICE_ROLE_KEY|createAdminClient/);
});
test("workspace accessible from three dashboards and exports without opening a tab",()=>{
 const dashboard=src("components/layout/escola-admin/QuickActionsSection.tsx");
 const secretaria=src("app/secretaria/(portal-secretaria)/Dashboard.tsx");
 const ui=src("components/secretaria/ExpedienteWorkspace.tsx");
 assert.match(dashboard,/ExpedienteDashboardCard/);
 assert.match(secretaria,/ExpedienteDashboardCard/);
 assert.match(ui,/FechoCaixaCego/);
 assert.match(ui,/URL.createObjectURL/);
 assert.doesNotMatch(ui,/window.open/);
});

test("SQL dollar quoting, automatic origin and cash completeness",()=>{
 assert.doesNotMatch(sql,/AS \$[^$]|END; \$;/);
 assert.equal((sql.match(/\$\$/g)||[]).length%2,0);
 assert.match(sql,/origin IN \('human','service_role'\)/);
 assert.match(sql,/origin='service_role' AND actor_id IS NULL/);
 assert.match(sql,/auth.jwt\(\)->>'role',''\) <> 'service_role'/);
 assert.match(sql,/operation_count=human_count\+system_count/);
 assert.match(sql,/system_other_count/);
 assert.match(sql,/declaration_conflict/);
 assert.match(sql,/variance_requires_justification/);
 assert.match(sql,/approval_variation=v_variation/);
 assert.match(sql,/zz_fecho_caixa_lock_payment_day/);
 assert.match(sql,/'financeiro_pagamento_reversoes'/);
 assert.match(sql,/'matricula_desistencia_reativacoes'/);
 assert.match(sql,/'aluno_encarregados'/);
 const route=src("app/api/financeiro/fecho/declarar/route.ts");
 assert.doesNotMatch(route,/if \(existing\)/);
 const pdf=src("app/api/escola/[id]/expediente/pdf/route.ts");
 assert.match(pdf,/Sistema \(automático\)/);
 assert.match(pdf,/Meio não classificado/);
});


test("contextual history, supervision and cash experience",()=>{
 const ui=src("components/secretaria/ExpedienteWorkspace.tsx");
 const history=src("components/secretaria/ExpedienteHistory.tsx");
 const cash=src("components/secretaria/FechoCaixaCego.tsx");
 const access=src("lib/secretaria/expediente.ts");
 const api=src("app/api/escola/[id]/expediente/route.ts");
 assert.match(ui,/Expediente de hoje/);
 assert.match(ui,/Encerrar sem declaração de caixa/);
 assert.match(ui,/Detalhes técnicos/);
 assert.match(ui,/student_name/);
 assert.match(history,/Caixas por validar/);
 assert.match(history,/loadQueue\("declared"\)/);
 assert.match(history,/loadQueue\("rejected"\)/);
 assert.match(access,/\.gt\("day_key",after\)/);
 assert.match(cash,/Contar notas e moedas/);
 assert.match(cash,/Numerário contado/);
 assert.match(access,/day>captureDay/);
 assert.match(access,/operationQuery.eq\("actor_id",filters.actor\)/);
 assert.match(access,/secretaria_expediente_responsaveis/);
 assert.match(api,/view==="supervision"&&!access.canSupervise/);
 assert.match(api,/30\*86400000/);
});


test("activity filters do not refresh detail state and report types are explicit",()=>{
 const ui=src("components/secretaria/ExpedienteWorkspace.tsx");
 const api=src("app/api/escola/[id]/expediente/route.ts");
 const pdf=src("app/api/escola/[id]/expediente/pdf/route.ts");
 const cash=src("components/secretaria/FechoCaixaCego.tsx");
 const history=src("components/secretaria/ExpedienteHistory.tsx");
 assert.match(ui,/view=detail&date=/);
 assert.match(ui,/\},\[endpoint,date,revision\]\);/);
 assert.match(ui,/view=activity&date=/);
 assert.match(ui,/activityRetry\]\);/);
 assert.match(ui,/declared_by_name/);
 assert.match(ui,/approved_by_name/);
 assert.match(ui,/ModalShell open=\{exportOpen\}/);
 assert.match(ui,/ModalShell open=\{settings\}/);
 assert.match(cash,/values.every\(value=>value===0\)&&!zeroConfirmed/);
 assert.match(history,/onSelect\(item.date,"cash"\)/);
 assert.match(api,/state.data==="declared"&&!access.canSupervise/);
 assert.match(pdf,/const detailed=format==="detail"/);
 assert.match(pdf,/if\(!detailed\)\{line\("Adendos posteriores ao fecho/);
});


test("dashboard opens a shared, lazy-loaded, draft-aware daily-close modal",()=>{
 const card=src("components/secretaria/ExpedienteDashboardCard.tsx");
 const workspace=src("components/secretaria/ExpedienteWorkspace.tsx");
 assert.match(card,/dynamic\(\(\)=>import\("@\/components\/secretaria\/ExpedienteWorkspace"\)/);
 assert.match(card,/dialogOpen=\{open\}/);
 assert.match(src("components/shared/AcaoRapidaCard.tsx"),/aria-haspopup=\{dialogOpen !== undefined \? "dialog"/);
 assert.match(card,/<ModalShell open=\{open\} size="wide"/);
 assert.match(card,/\{open&&<Workspace/);
 assert.match(card,/embedded closeGuardRef=\{closeGuardRef\}/);
 assert.match(card,/if\(state==="busy"\)/);
 assert.match(card,/if\(state==="draft"&&!discard\)/);
 assert.match(card,/setRefreshVersion\(v=>v\+1\)/);
 assert.match(card,/triggerRef.current\?\.focus\(\{preventScroll:true\}\)/);
 assert.doesNotMatch(card,/href=|router\.push/);
 assert.match(workspace,/closeGuardRef.current=\(\)=>lock.current\?"busy"/);
 assert.match(workspace,/!embedded&&<DashboardHeader/);
});

test("daily-close shortcut is inside quick actions and modal uses a non-translated viewport",()=>{
 const dialog=src("components/ui/dialog.tsx");
 const shell=src("components/ui/ModalShell.tsx");
 const quick=src("components/layout/escola-admin/QuickActionsSection.tsx");
 const secretaria=src("app/secretaria/(portal-secretaria)/Dashboard.tsx");
 assert.match(dialog,/layout === "viewport" \? "fixed inset-0 z-50 flex h-\[100dvh\] w-full items-center justify-center overflow-hidden" : "fixed left-\[50%\]/);
 assert.match(shell,/layout="viewport"/);
 assert.match(shell,/max-h-full/);
 assert.match(shell,/overflow-y-auto overscroll-contain/);
 assert.match(quick,/<ExpedienteDashboardCard escolaId=\{escolaId\} portal=\{portalBase\} \/>/);
 assert.match(secretaria,/<h2[^>]*>\s*Ações rápidas\s*<\/h2>[\s\S]*?<ExpedienteDashboardCard\s+escolaId=\{escolaId\}\s+portal="secretaria"/);
 assert.doesNotMatch(src("components/layout/escola-admin/EscolaAdminDashboardContent.tsx"),/ExpedienteDashboardCard/);
 assert.doesNotMatch(src("app/secretaria/(portal-secretaria)/page.tsx"),/ExpedienteDashboardCard/);
});


test("operations quick actions mount canonical receipts and timetable workspaces only in wide modals",()=>{
 const quick=src("components/layout/escola-admin/QuickActionsSection.tsx");
 const timetable=src("components/escola/horarios/HorarioEditor.tsx");
 const receipts=src("components/financeiro/FilaValidacaoPagamentos.tsx");
 assert.match(quick,/key: "recebimentos",\s*label: "Recebimentos",\s*opensModal: true/);
 assert.match(quick,/key: "horarios",\s*label: "Quadro de Horários",\s*opensModal: true/);
 assert.match(quick,/onClick=\{action.opensModal \? \(\) => launchAction\(action\) : undefined\}/);
 assert.match(quick,/<ModalShell open=\{Boolean\(operationalModal\)\} size="wide"/);
 assert.match(quick,/<RecebimentosWorkspace key=\{escolaId\} escolaId=\{escolaId\} closeGuardRef=\{closeGuardRef\}/);
 assert.match(quick,/<HorarioDataProvider key=\{escolaId\} escolaId=\{escolaId\}><HorarioWorkspace escolaId=\{escolaId\} dashboardModal closeGuardRef=\{closeGuardRef\}/);
 assert.match(quick,/if \(closeGuardRef.current\?\.\(\)\)/);
 assert.match(timetable,/if \(embedded \|\| dashboardModal\) return;/);
 assert.match(timetable,/if \(embedded && nextTurmaId === null\) \{ onClose\?\.\(\); return; \}/);
 assert.match(timetable,/closeGuardRef.current = \(\) => Boolean\(turmaId \|\| showWizard/);
 assert.match(receipts,/closeGuardRef.current = \(\) => decisionLock.current \|\| Boolean\(approvalTarget\)/);
 assert.match(receipts,/if \(!pagamento \|\| decisionLock.current\) return;/);
 assert.match(receipts,/finally \{\s*decisionLock.current = false;/);
});

test("financial close has one workspace, legacy navigation and server-side report restriction",()=>{
 const legacy=src("app/escola/[id]/(portal)/financeiro/fecho/page.tsx");
 const control=src("app/escola/[id]/(portal)/financeiro/controle-caixa/page.tsx");
 const ui=src("components/secretaria/ExpedienteWorkspace.tsx");
 const report=src("components/financeiro/FechoMovimentacoes.tsx");
 const access=src("lib/secretaria/expediente.ts");
 const financial=src("lib/financeiro/fecho.ts");
 assert.match(legacy,/redirect\(/);
 assert.match(legacy,/financeiro\/fecho-diario/);
 assert.doesNotMatch(legacy,/fetch\(|useState/);
 assert.match(control,/query.vista === "fecho"/);
 assert.match(control,/conciliacao/);
 assert.match(ui,/FechoMovimentacoes/);
 for(const name of ["Fecho de caixa","Expediente","Histórico"])assert.ok(ui.includes(name));
 assert.match(ui,/visibleData\?\.canViewMovements/);
 assert.match(report,/if \(!enabled\) return;/);
 assert.match(report,/AbortController/);
 assert.match(report,/operador_scope: scope/);
 assert.match(financial,/expedienteAccess\(escolaIdParam\)/);
 assert.match(financial,/!access.canSupervise/);
 assert.match(financial,/canReadCashMovements\(access, snapshot.data\?\.status\)/);
 assert.ok(financial.indexOf("canReadCashMovements(access, snapshot.data?.status)") < financial.indexOf('from("pagamentos")'));
 assert.match(access,/status === "declared" \|\| status === "approved"/);
 assert.match(access,/canViewMovements:access.canSupervise&&canReadCashMovements/);
});

test("secretaria presents a short guided close and loads activity only on demand",()=>{
 const ui=src("components/secretaria/ExpedienteWorkspace.tsx");
 const cash=src("components/secretaria/FechoCaixaCego.tsx");
 const alias=src("app/escola/[id]/(portal)/secretaria/(portal-secretaria)/fecho/page.tsx");
 const globalAlias=src("app/secretaria/(portal-secretaria)/fecho/page.tsx");
 const route=src("app/escola/[id]/(portal)/secretaria/(portal-secretaria)/fecho-diario/page.tsx");
 assert.match(ui,/const simple=portal==="secretaria"/);
 assert.match(ui,/1\. Conferir caixa/);
 assert.match(ui,/2\. Encerrar expediente/);
 assert.match(ui,/\(simple&&!activityOpen\)/);
 assert.match(ui,/Ver atividade do dia/);
 assert.match(ui,/enabled=\{!simple&&canViewMovements\}/);
 assert.match(ui,/compact=\{simple\}/);
 assert.match(ui,/onCompleted=\{\(\)=>\{if\(simple\)setTab\("detail"\);\}\}/);
 assert.match(cash,/open=\{!compact\|\|result.status==="DIVERGENT"\}/);
 assert.match(cash,/values.every\(value=>value===0\)&&!zeroConfirmed/);
 for(const old of [alias,globalAlias]){
   assert.match(old,/secretaria\/fecho-diario\?view=cash/);
   assert.doesNotMatch(old,/FechoCaixaCego|fetch\(/);
 }
 assert.match(route,/initialCash=\{queryParams.view==="cash"\}/);
});
