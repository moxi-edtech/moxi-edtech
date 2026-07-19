import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { canAccessAiActions, getUserAiRole } from "@/lib/server/ai/ai-actions";
import { transitionAiInsight } from "@/lib/server/ai/ai-insights";
import type { DBWithRPC } from "@/types/supabase-augment";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const patchSchema = z.object({
  schoolId: z.string().uuid(),
  status: z.enum(["seen", "in_progress", "resolved", "ignored"]),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Payload inválido." }, { status: 400 });
  }

  const supabase = await supabaseServerTyped<DBWithRPC>();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;
  if (!user) {
    return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
  }

  const metadataSchoolId = (user.app_metadata as { escola_id?: string | null } | null)?.escola_id;
  const schoolId = await resolveEscolaIdForUser(
    supabase,
    user.id,
    parsed.data.schoolId,
    metadataSchoolId ? String(metadataSchoolId) : null,
  );
  if (schoolId !== parsed.data.schoolId) {
    return NextResponse.json({ ok: false, error: "Sem permissão para esta escola." }, { status: 403 });
  }

  const role = await getUserAiRole(supabase, schoolId, user.id);
  if (!canAccessAiActions(role)) {
    return NextResponse.json({ ok: false, error: "Sem permissão para atualizar insights." }, { status: 403 });
  }

  try {
    const insight = await transitionAiInsight(supabase, {
      insightId: id,
      schoolId,
      status: parsed.data.status,
    });
    return NextResponse.json({ ok: true, insight });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao atualizar insight.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
