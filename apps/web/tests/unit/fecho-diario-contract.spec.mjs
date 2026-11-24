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
