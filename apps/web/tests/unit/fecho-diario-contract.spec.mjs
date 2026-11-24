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
 const dashboard=src("components/layout/escola-admin/EscolaAdminDashboardContent.tsx");
 const secretaria=src("app/secretaria/(portal-secretaria)/page.tsx");
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
 assert.match(card,/aria-haspopup="dialog"/);
 assert.match(card,/<ModalShell open=\{open\} size="wide"/);
 assert.match(card,/\{open&&<Workspace/);
 assert.match(card,/embedded closeGuardRef=\{closeGuardRef\}/);
 assert.match(card,/if\(state==="busy"\)/);
 assert.match(card,/if\(state==="draft"&&!discard\)/);
 assert.match(card,/setRefreshVersion\(v=>v\+1\)/);
 assert.match(card,/triggerRef.current\?\.focus\(\)/);
 assert.doesNotMatch(card,/href=|router\.push/);
 assert.match(workspace,/closeGuardRef.current=\(\)=>lock.current\?"busy"/);
 assert.match(workspace,/!embedded&&<DashboardHeader/);
});
