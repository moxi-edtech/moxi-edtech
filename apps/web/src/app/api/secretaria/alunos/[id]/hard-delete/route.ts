import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";
import { recordAuditServer } from "@/lib/audit";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const alunoId = id;
    if (!alunoId) return NextResponse.json({ ok: false, error: "ID do aluno não fornecido" }, { status: 400 });

    const s = await supabaseServerTyped<any>();
    const { data: userRes } = await s.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    // Perfil e escopo da escola
    const { data: prof, error: profErr } = await s
      .from("profiles")
      .select("role, escola_id, current_escola_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (profErr) return NextResponse.json({ ok: false, error: profErr.message }, { status: 400 });

    const role = (prof as any)?.role as string | undefined;
    const escolaFromProfile = (prof as any)?.current_escola_id || (prof as any)?.escola_id || null;

    // Permissões: Admin da escola e superiores
    const allowedRoles = ["super_admin", "global_admin", "admin", "staff_admin"];
    if (!role || !allowedRoles.includes(role)) {
      return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });
    }
    if (!escolaFromProfile) return NextResponse.json({ ok: false, error: "Perfil não está vinculado a uma escola" }, { status: 403 });

    // Carrega aluno com cliente normal (RLS)
    const { data: aluno, error: alunoErr } = await s
      .from("alunos")
      .select("id, nome, escola_id, profile_id, created_at")
      .eq("id", alunoId)
      .maybeSingle();
    if (alunoErr) return NextResponse.json({ ok: false, error: alunoErr.message }, { status: 400 });
    if (!aluno) return NextResponse.json({ ok: false, error: "Aluno não encontrado" }, { status: 404 });
    if (String((aluno as any).escola_id) !== String(escolaFromProfile)) {
      return NextResponse.json({ ok: false, error: "Aluno não pertence à escola ativa do usuário" }, { status: 403 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !service) {
      return NextResponse.json({ ok: false, error: "Server misconfigured: falta SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
    }
    const admin = createAdminClient<Database>(url, service);

    // Hard delete
    const { error: delErr } = await admin.from("alunos").delete().eq("id", alunoId);
    if (delErr) {
      return NextResponse.json({ ok: false, error: delErr.message }, { status: 409 });
    }

    // Auditoria
    try {
      await recordAuditServer({
        escolaId: (aluno as any).escola_id!,
        portal: "secretaria",
        acao: "ALUNO_HARD_DELETADO",
        entity: "aluno",
        entityId: String(alunoId),
        details: { performed_by: user.id, role },
      });
    } catch {}

    return NextResponse.json({ ok: true, mode: "hard" });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[alunos.hard-delete] Erro inesperado:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  return POST(req, context);
}
