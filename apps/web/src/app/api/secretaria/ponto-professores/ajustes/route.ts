import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { requireRoleInSchool } from "@/lib/authz";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ROLES = ["secretaria", "secretaria_financeiro", "admin_financeiro", "admin_secretaria", "admin", "admin_escola", "staff_admin", "diretor"] as const;
const Body = z.object({ aula_id: z.string().uuid(), inicio_real: z.string().datetime({ offset: true }).nullable(), fim_real: z.string().datetime({ offset: true }).nullable(), motivo: z.string().trim().min(10).max(1000) });

export async function POST(req: Request) {
  const supabase = await supabaseServerTyped<any>();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Informe início, fim e um motivo com pelo menos 10 caracteres." }, { status: 400 });
  if (parsed.data.inicio_real && parsed.data.fim_real && new Date(parsed.data.fim_real) <= new Date(parsed.data.inicio_real)) return NextResponse.json({ ok: false, error: "O fim deve ser posterior ao início." }, { status: 400 });
  const escolaId = await resolveEscolaIdForUser(supabase, auth.user.id);
  if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 403 });
  const authz = await requireRoleInSchool({ supabase, escolaId, roles: [...ROLES] });
  if (authz.error) return authz.error;
  const { data: aula } = await supabase.from("aulas").select("id, data, professor_id, status, inicio_real, fim_real").eq("id", parsed.data.aula_id).eq("escola_id", escolaId).maybeSingle();
  if (!aula) return NextResponse.json({ ok: false, error: "Aula não encontrada." }, { status: 404 });
  if (!aula.professor_id) return NextResponse.json({ ok: false, error: "A aula não tem professor associado." }, { status: 400 });
  const before = { inicio_real: aula.inicio_real, fim_real: aula.fim_real, status: aula.status };
  const after = { inicio_real: parsed.data.inicio_real, fim_real: parsed.data.fim_real, status: parsed.data.fim_real ? "finalizada" : parsed.data.inicio_real ? "em_andamento" : "agendada" };
  const { data: updated, error } = await supabase.from("aulas").update({ inicio_real: after.inicio_real, fim_real: after.fim_real, status: after.status, finalizado_por: after.fim_real ? auth.user.id : null }).eq("id", aula.id).eq("escola_id", escolaId).select("id, data, inicio_real, fim_real, status").single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  const { error: auditError } = await supabase.from("audit_logs").insert({ escola_id: escolaId, actor_id: auth.user.id, action: "PONTO_PROFESSOR_AJUSTADO", entity: "aulas", entity_id: aula.id, portal: "secretaria", details: { motivo: parsed.data.motivo }, before, after });
  if (auditError) return NextResponse.json({ ok: false, error: `Ajuste aplicado, mas a auditoria falhou: ${auditError.message}` }, { status: 500 });
  return NextResponse.json({ ok: true, aula: updated });
}
