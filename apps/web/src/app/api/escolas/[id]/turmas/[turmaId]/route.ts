import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createRouteClient } from "@/lib/supabase/route-client";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { canManageEscolaResources } from "../../permissions";

const PatchSchema = z.object({
  sala: z.string().trim().nullable().optional(),
  capacidade_maxima: z.number().int().min(1).max(200).nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; turmaId: string }> }
) {
  const { id: escolaId, turmaId } = await params;
  const supabase = await createRouteClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

  const userEscolaId = await resolveEscolaIdForUser(supabase as any, user.id, escolaId);
  if (!userEscolaId) {
    return NextResponse.json({ ok: false, error: "Permissão negada" }, { status: 403 });
  }

  const allowed = await canManageEscolaResources(supabase as any, userEscolaId, user.id);
  if (!allowed) return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues?.[0]?.message || "Dados inválidos" },
      { status: 400 }
    );
  }

  const updateData: any = {};
  if (parsed.data.sala !== undefined) updateData.sala = parsed.data.sala;
  if (parsed.data.capacidade_maxima !== undefined) updateData.capacidade_maxima = parsed.data.capacidade_maxima;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ ok: true, message: "Nada para atualizar" });
  }

  const { error } = await (supabase as any)
    .from("turmas")
    .update(updateData)
    .eq("escola_id", userEscolaId)
    .eq("id", turmaId);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
