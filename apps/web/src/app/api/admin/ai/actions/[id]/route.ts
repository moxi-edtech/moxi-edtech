import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import {
  canAccessAiActions,
  getUserAiRole,
  transitionAiAction,
} from "@/lib/server/ai/ai-actions";
import type { DBWithRPC } from "@/types/supabase-augment";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const patchSchema = z.object({
  schoolId: z.string().uuid(),
  transition: z.enum(["approve", "reject", "cancel", "retry"]),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Payload inválido." }, { status: 400 });
  }

  const supabase = await supabaseServerTyped<DBWithRPC>();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user ?? null;
  if (!user) {
    return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
  }

  const metaEscolaId = (user.app_metadata as { escola_id?: string | null } | null)?.escola_id ?? null;
  const schoolId = await resolveEscolaIdForUser(
    supabase,
    user.id,
    parsed.data.schoolId,
    metaEscolaId ? String(metaEscolaId) : null
  );
  if (!schoolId || schoolId !== parsed.data.schoolId) {
    return NextResponse.json({ ok: false, error: "Sem permissão para esta escola." }, { status: 403 });
  }

  const role = await getUserAiRole(supabase, schoolId, user.id);
  if (!canAccessAiActions(role)) {
    return NextResponse.json({ ok: false, error: "Sem permissão para a Central de Ações IA." }, { status: 403 });
  }

  const { data: action, error: actionError } = await (supabase)
    .from("ai_actions")
    .select("*")
    .eq("id", id)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (actionError) {
    return NextResponse.json({ ok: false, error: actionError.message }, { status: 500 });
  }
  if (!action) {
    return NextResponse.json({ ok: false, error: "Ação IA não encontrada." }, { status: 404 });
  }

  try {
    const updated = await transitionAiAction(supabase, {
      action,
      userId: user.id,
      userRole: role,
      transition: parsed.data.transition,
    });
    return NextResponse.json({ ok: true, action: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao atualizar ação IA.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
