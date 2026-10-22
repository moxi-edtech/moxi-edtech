import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createRouteClient } from "@/lib/supabase/route-client";
import { requireRoleInSchool } from "@/lib/authz";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { resolveExplorerStudentCapabilities } from "@/lib/command-center/student-capabilities";
import { withExplorerObservability } from "@/lib/command-center/observability";

export const dynamic = "force-dynamic";
const inputs = z.object({
  escolaId: z.string().uuid(),
  alunoId: z.string().uuid(),
});

async function readCapabilities(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = new URL(req.url);
  // O vínculo canónico polo↔operador/turma ainda não existe no catálogo instalado.
  // Pedidos de um polo específico falham fechados, sem expor capacidades globais.
  if (u.searchParams.has("poloId") || u.searchParams.has("polo_id")) {
    return NextResponse.json({ ok: false, error: "O acesso por polo está indisponível. Solicite a configuração à administração." }, { status: 403 });
  }
  const parsed = inputs.safeParse({ escolaId: id, alunoId: u.searchParams.get("alunoId") });
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Parâmetros inválidos." }, { status: 400 });
  const supabase = await createRouteClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sessão terminada." }, { status: 401 });
  const escolaId = await resolveEscolaIdForUser(supabase, user.id, parsed.data.escolaId);
  if (!escolaId) return NextResponse.json({ ok: false, error: "Sem acesso." }, { status: 403 });

  const roleGate = await requireRoleInSchool({
    supabase, escolaId, productContext: "k12",
    roles: ["admin", "admin_escola", "staff_admin", "diretor",
      "secretaria", "admin_secretaria", "secretaria_financeiro", "admin_financeiro"],
  });
  if (roleGate.error) return roleGate.error;
  const { data: student, error: studentError } = await supabase.from("alunos")
    .select("id").eq("escola_id", escolaId).eq("id", parsed.data.alunoId)
    .is("deleted_at", null).maybeSingle();
  if (studentError) throw studentError;
  if (!student) return NextResponse.json({ ok: false, error: "Aluno indisponível nesta escola." }, { status: 404 });

  const [{ data: member, error: memberError }, { data: superAdmin, error: superError }] = await Promise.all([
    supabase.from("escola_users").select("papel,role").eq("escola_id", escolaId)
      .eq("user_id", user.id).maybeSingle(),
    supabase.rpc("check_super_admin_role"),
  ]);
  if (superError) throw superError;
  if (memberError && superAdmin !== true) throw memberError;
  const role = member?.papel ?? member?.role ?? null;
  if (!role && superAdmin !== true) {
    return NextResponse.json({ ok: false, error: "Sem acesso à escola." }, { status: 403 });
  }
  return NextResponse.json({
    ok: true,
    actions: resolveExplorerStudentCapabilities(role, superAdmin === true),
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withExplorerObservability("student-capabilities", () => readCapabilities(req, context));
}
