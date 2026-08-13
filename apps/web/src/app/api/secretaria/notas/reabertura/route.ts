import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { requireRoleInSchool } from "@/lib/authz";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const ROLES = ["secretaria", "admin_secretaria", "admin_escola", "admin", "staff_admin", "admin_financeiro"] as const;
  const Body = z.object({ id: z.string().uuid(), status: z.enum(["APROVADO", "REJEITADO"]), motivo_decisao: z.string().trim().max(1000).nullable().optional() });

export async function GET() {
  const supabase = await supabaseServerTyped<any>();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  const escolaId = await resolveEscolaIdForUser(supabase, auth.user.id);
  if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 403 });
  const authz = await requireRoleInSchool({ supabase, escolaId, roles: [...ROLES] });
  if (authz.error) return authz.error;
  const { data, error } = await supabase.from("excecoes_pauta").select("id, turma_id, disciplina_id, trimestre, status, motivo, expira_em, created_at, solicitado_por").eq("escola_id", escolaId).eq("status", "PENDENTE").order("created_at", { ascending: true }).limit(100);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const rows = data ?? [];
  const turmaIds = [...new Set(rows.map((item: any) => item.turma_id))];
  const disciplinaIds = [...new Set(rows.map((item: any) => item.disciplina_id))];
  const userIds = [...new Set(rows.map((item: any) => item.solicitado_por).filter(Boolean))];
  const [{ data: turmas }, { data: disciplinas }, { data: profiles }] = await Promise.all([
    turmaIds.length ? supabase.from("turmas").select("id, nome").eq("escola_id", escolaId).in("id", turmaIds) : Promise.resolve({ data: [] }),
    disciplinaIds.length ? supabase.from("disciplinas_catalogo").select("id, nome").eq("escola_id", escolaId).in("id", disciplinaIds) : Promise.resolve({ data: [] }),
    userIds.length ? supabase.from("profiles").select("user_id, nome").in("user_id", userIds) : Promise.resolve({ data: [] }),
  ]);
  const turmaNames = new Map((turmas ?? []).map((row: any) => [row.id, row.nome]));
  const disciplinaNames = new Map((disciplinas ?? []).map((row: any) => [row.id, row.nome]));
  const profileNames = new Map((profiles ?? []).map((row: any) => [row.user_id, row.nome]));
  return NextResponse.json({ ok: true, items: rows.map((item: any) => ({ ...item, turma_nome: turmaNames.get(item.turma_id) ?? "Turma não identificada", disciplina_nome: disciplinaNames.get(item.disciplina_id) ?? "Disciplina não identificada", professor_nome: profileNames.get(item.solicitado_por) ?? "Professor não identificado" })) });
}

export async function PATCH(req: Request) {
  const supabase = await supabaseServerTyped<any>();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  const escolaId = await resolveEscolaIdForUser(supabase, auth.user.id);
  if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 403 });
  const authz = await requireRoleInSchool({ supabase, escolaId, roles: [...ROLES] });
  if (authz.error) return authz.error;
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Dados inválidos" }, { status: 400 });
  if (parsed.data.status === "REJEITADO" && !parsed.data.motivo_decisao) return NextResponse.json({ ok: false, error: "Informe o motivo da rejeição." }, { status: 400 });
  const { data, error } = await supabase.from("excecoes_pauta").update({ status: parsed.data.status, aprovado_por: auth.user.id, decidido_em: new Date().toISOString(), decisao_motivo: parsed.data.motivo_decisao || null, expira_em: parsed.data.status === "APROVADO" ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : new Date().toISOString() }).eq("id", parsed.data.id).eq("escola_id", escolaId).eq("status", "PENDENTE").select("id, status, expira_em, decidido_em, decisao_motivo").maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ ok: false, error: "Solicitação não encontrada ou já decidida." }, { status: 409 });
  return NextResponse.json({ ok: true, item: data });
}
