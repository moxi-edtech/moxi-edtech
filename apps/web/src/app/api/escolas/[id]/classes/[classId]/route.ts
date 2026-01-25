import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeEscolaAction } from "@/lib/escola/disciplinas";
import { createRouteClient } from "@/lib/supabase/route-client";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

async function authorize(escolaId: string) {
  const supabase = await createRouteClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user)
    return { ok: false as const, status: 401, error: "Não autenticado" };

  const userEscolaId = await resolveEscolaIdForUser(supabase as any, user.id, escolaId);
  if (!userEscolaId || userEscolaId !== escolaId) {
    return { ok: false as const, status: 403, error: "Sem permissão" };
  }

  const authz = await authorizeEscolaAction(
    supabase as any,
    escolaId,
    user.id,
    ['configurar_escola', 'gerenciar_disciplinas']
  );
  if (!authz.allowed)
    return { ok: false as const, status: 403, error: authz.reason || "Sem permissão" };

  // Hard check: perfil deve pertencer à escola
  try {
    const { data: profCheck } = await supabase
      .from("profiles" as any)
      .select("escola_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profCheck || (profCheck as any).escola_id !== escolaId) {
      return {
        ok: false as const,
        status: 403,
        error: "Perfil não vinculado à escola",
      };
    }
  } catch {}
  return { ok: true as const, supabase };
}

// PUT /api/escolas/[id]/classes/[classId]
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string; classId: string }> }
) {
  const { id: escolaId, classId } = await context.params;

  const authz = await authorize(escolaId);
  if (!authz.ok)
    return NextResponse.json(
      { ok: false, error: authz.error },
      { status: authz.status }
    );
  const { supabase } = authz;

  try {
    const raw = await req.json();
    const schema = z.object({
      nome: z.string().trim().min(1).optional(),
      descricao: z.string().nullable().optional(),
      ordem: z.number().int().positive().nullable().optional(),
      nivel: z.string().nullable().optional(),
    });
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message || "Dados inválidos";
      return NextResponse.json({ ok: false, error: msg }, { status: 400 });
    }

    const updates = parsed.data as any;
    const { data, error } = await (supabase as any)
      .from("classes")
      .update(updates)
      .eq("id", classId)
      .eq("escola_id", escolaId)
      .select("id, nome, descricao, ordem, nivel")
      .single();
    if (error)
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// DELETE /api/escolas/[id]/classes/[classId]
export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string; classId: string }> }
) {
  const { id: escolaId, classId } = await context.params;

  const authz = await authorize(escolaId);
  if (!authz.ok)
    return NextResponse.json(
      { ok: false, error: authz.error },
      { status: authz.status }
    );
  const { supabase } = authz;

  try {
    const { error } = await (supabase as any)
      .from("classes")
      .delete()
      .eq("id", classId)
      .eq("escola_id", escolaId);
    if (error)
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
