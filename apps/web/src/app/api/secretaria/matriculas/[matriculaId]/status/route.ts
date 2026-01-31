import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { requireRoleInSchool } from "@/lib/authz";
import { recordAuditServer } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const StatusSchema = z.object({
  status: z.enum(["ativo", "trancado", "concluido", "transferido", "desistente"]),
});

const ALLOWED_ROLES = ["secretaria", "admin", "admin_escola", "staff_admin"] as const;

export async function PUT(request: Request, { params }: { params: Promise<{ matriculaId: string }> }) {
  try {
    const { matriculaId } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = StatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues?.[0]?.message || "Payload inválido" },
        { status: 400 }
      );
    }

    const supabase = await supabaseServerTyped<any>();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const { data: matricula, error: matriculaError } = await supabase
      .from("matriculas")
      .select("id, escola_id, status")
      .eq("id", matriculaId)
      .maybeSingle();

    if (matriculaError || !matricula) {
      return NextResponse.json({ ok: false, error: "Matrícula não encontrada" }, { status: 404 });
    }

    const resolvedEscolaId = await resolveEscolaIdForUser(
      supabase as any,
      user.id,
      matricula.escola_id
    );
    if (!resolvedEscolaId || resolvedEscolaId !== matricula.escola_id) {
      return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });
    }

    const { error: authError } = await requireRoleInSchool({
      supabase,
      escolaId: resolvedEscolaId,
      roles: [...ALLOWED_ROLES],
    });
    if (authError) return authError;

    if (matricula.status === parsed.data.status) {
      return NextResponse.json({ ok: true, status: parsed.data.status });
    }

    const { error: updateError } = await supabase
      .from("matriculas")
      .update({ status: parsed.data.status, updated_at: new Date().toISOString() })
      .eq("id", matriculaId);

    if (updateError) {
      return NextResponse.json({ ok: false, error: updateError.message }, { status: 400 });
    }

    recordAuditServer({
      escolaId: resolvedEscolaId,
      portal: "secretaria",
      acao: "MATRICULA_STATUS_ATUALIZADO",
      entity: "matriculas",
      entityId: matriculaId,
      details: {
        status_anterior: matricula.status,
        status_novo: parsed.data.status,
      },
    }).catch(() => null);

    return NextResponse.json({ ok: true, status: parsed.data.status });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
