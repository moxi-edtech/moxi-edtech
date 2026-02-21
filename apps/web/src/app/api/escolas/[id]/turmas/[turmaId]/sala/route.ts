import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createRouteClient } from "@/lib/supabase/route-client";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { canManageEscolaResources } from "../../../permissions";

const BodySchema = z.object({
  sala: z.string().trim().min(1).nullable(),
});

// POST /api/escolas/[id]/turmas/[turmaId]/sala
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; turmaId: string }> }
) {
  const { id: escolaId, turmaId } = await params;
  const supabase = await createRouteClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

  const userEscolaId = await resolveEscolaIdForUser(supabase as any, user.id, escolaId);
  if (!userEscolaId || userEscolaId !== escolaId) {
    return NextResponse.json({ ok: false, error: "Permissão negada" }, { status: 403 });
  }

  const allowed = await canManageEscolaResources(supabase as any, escolaId, user.id);
  if (!allowed) return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues?.[0]?.message || "Dados inválidos" },
      { status: 400 }
    );
  }

  const { error } = await (supabase as any)
    .from("turmas")
    .update({ sala: parsed.data.sala })
    .eq("escola_id", escolaId)
    .eq("id", turmaId);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
