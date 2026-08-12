import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRoleInSchool } from "@/lib/authz";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const Body = z.object({ aluno_id: z.string().uuid(), tipo: z.enum(["elogio", "observacao", "atividade"]), titulo: z.string().trim().min(2).max(160), conteudo: z.string().trim().min(2).max(5000) });

export async function POST(request: Request) {
  const supabase = await supabaseServerTyped<any>();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  const escolaId = await resolveEscolaIdForUser(supabase, user.id);
  if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 403 });
  const authz = await requireRoleInSchool({ supabase, escolaId, roles: ["professor", "admin", "admin_escola", "diretor"] });
  if (authz.error) return authz.error;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Entrada do diário inválida" }, { status: 400 });

  const { data: membership } = await supabase
    .from("escola_users")
    .select("papel")
    .eq("escola_id", escolaId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membership?.papel === "professor") {
    const { data: professor } = await supabase
      .from("professores")
      .select("id")
      .eq("escola_id", escolaId)
      .eq("profile_id", user.id)
      .maybeSingle();
    if (!professor?.id) {
      return NextResponse.json({ ok: false, error: "Professor sem perfil pedagógico", next_action: { type: "contact_admin", label: "Contactar a secretaria", href: "/professor/avisos" } }, { status: 403 });
    }

    const { data: assignments } = await supabase
      .from("turma_disciplinas_professores")
      .select("turma_id")
      .eq("escola_id", escolaId)
      .eq("professor_id", professor.id)
      .limit(100);
    const turmaIds = Array.from(new Set((assignments ?? []).map((row) => row.turma_id).filter(Boolean)));
    if (turmaIds.length === 0) {
      return NextResponse.json({ ok: false, error: "Não possui turmas atribuídas", next_action: { type: "contact_admin", label: "Contactar a secretaria", href: "/professor/avisos" } }, { status: 403 });
    }

    const { data: studentRelation } = await supabase
      .from("matriculas")
      .select("id")
      .eq("escola_id", escolaId)
      .eq("aluno_id", parsed.data.aluno_id)
      .in("turma_id", turmaIds)
      .in("status", ["ativa", "ativo"])
      .limit(1)
      .maybeSingle();
    if (!studentRelation) {
      return NextResponse.json({ ok: false, error: "O aluno não pertence às suas turmas", next_action: { type: "select_assigned_student", label: "Escolher aluno atribuído", href: "/professor/intervencoes" } }, { status: 403 });
    }
  }

  const { data: entry, error } = await supabase.from("diario_familiar_entries").insert({ escola_id: escolaId, author_id: user.id, visibilidade: "familia", ...parsed.data }).select("id, aluno_id, tipo, titulo, conteudo, created_at").single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, item: entry }, { status: 201 });
}
