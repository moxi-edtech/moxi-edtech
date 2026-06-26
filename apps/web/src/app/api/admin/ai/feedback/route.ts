import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { AI_WIDGET_ROLES } from "@/lib/roles/ai-roles";
import type { DBWithRPC } from "@/types/supabase-augment";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const feedbackSchema = z.object({
  schoolId: z.string().uuid(),
  actionId: z.string().uuid().optional().nullable(),
  rating: z.enum(["useful", "not_useful"]),
  adjustment: z.enum(["shorter", "more_formal", "clearer", "redo"]).optional().nullable(),
  context: z.record(z.string(), z.unknown()).optional().default({}),
});

export async function POST(request: Request) {
  const parsed = feedbackSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Payload inválido." }, { status: 400 });

  const supabase = await supabaseServerTyped<DBWithRPC>();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user ?? null;
  if (!user) return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });

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

  const { data: allowed, error: roleError } = await supabase.rpc("user_has_role_in_school", {
    p_escola_id: schoolId,
    p_roles: AI_WIDGET_ROLES,
  });
  if (roleError) return NextResponse.json({ ok: false, error: roleError.message }, { status: 500 });
  if (!allowed) return NextResponse.json({ ok: false, error: "Sem permissão para feedback IA." }, { status: 403 });

  const { data, error } = await (supabase as any)
    .from("ai_feedback")
    .insert({
      school_id: schoolId,
      user_id: user.id,
      action_id: parsed.data.actionId ?? null,
      rating: parsed.data.rating,
      adjustment: parsed.data.adjustment ?? null,
      context: parsed.data.context,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}
