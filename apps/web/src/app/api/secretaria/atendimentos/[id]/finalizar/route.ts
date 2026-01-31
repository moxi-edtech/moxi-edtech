import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { requireRoleInSchool } from "@/lib/authz";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ALLOWED_ROLES = ["secretaria", "admin", "admin_escola", "staff_admin"] as const;

const FinalizarSchema = z.object({
  resolucao: z.string().trim().min(3),
  status: z.enum(["fechado", "cancelado"]).default("fechado"),
});

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const payload = await request.json().catch(() => ({}));
    const parsed = FinalizarSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues?.[0]?.message || "Payload inválido" }, { status: 400 });
    }

    const supabase = await supabaseServerTyped<any>();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const { data: atendimento, error: atendimentoError } = await supabase
      .from("atendimentos_balcao")
      .select("id, escola_id")
      .eq("id", id)
      .maybeSingle();

    if (atendimentoError || !atendimento) {
      return NextResponse.json({ ok: false, error: "Atendimento não encontrado" }, { status: 404 });
    }

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id, atendimento.escola_id);
    if (!escolaId || escolaId !== atendimento.escola_id) {
      return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });
    }

    const { error: authError } = await requireRoleInSchool({
      supabase,
      escolaId,
      roles: [...ALLOWED_ROLES],
    });
    if (authError) return authError;

    const { error } = await supabase
      .from("atendimentos_balcao")
      .update({
        resolucao: parsed.data.resolucao,
        status: parsed.data.status,
        finalizado_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
