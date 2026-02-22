import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createRouteClient } from "@/lib/supabase/route-client";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  titulo: z.string().trim().min(3).max(160).optional(),
  descricao: z.string().trim().max(2000).optional().nullable(),
  inicio_at: z.string().trim().optional(),
  fim_at: z.string().trim().optional().nullable(),
  publico_alvo: z.enum(["todos", "professores", "alunos", "responsaveis"]).optional(),
});

async function assertAccess(supabase: any, userId: string, escolaId: string) {
  const { data: hasRole, error: roleError } = await supabase.rpc("user_has_role_in_school", {
    p_escola_id: escolaId,
    p_roles: ["admin_escola", "secretaria", "admin"],
  });
  if (roleError) {
    return NextResponse.json({ ok: false, error: "Erro ao verificar permissões" }, { status: 500 });
  }
  if (!hasRole) {
    return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });
  }
  return null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; eventId: string }> }
) {
  try {
    const { id: escolaId, eventId } = await params;
    const supabase = await createRouteClient();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const userEscolaId = await resolveEscolaIdForUser(supabase as any, user.id, escolaId);
    if (!userEscolaId || userEscolaId !== escolaId) {
      return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });
    }

    const roleGuard = await assertAccess(supabase, user.id, userEscolaId);
    if (roleGuard) return roleGuard;

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Dados inválidos", issues: parsed.error.issues }, { status: 400 });
    }

    const { error } = await (supabase as any)
      .from("events")
      .update(parsed.data)
      .eq("id", eventId)
      .eq("escola_id", userEscolaId);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; eventId: string }> }
) {
  try {
    const { id: escolaId, eventId } = await params;
    const supabase = await createRouteClient();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const userEscolaId = await resolveEscolaIdForUser(supabase as any, user.id, escolaId);
    if (!userEscolaId || userEscolaId !== escolaId) {
      return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });
    }

    const roleGuard = await assertAccess(supabase, user.id, userEscolaId);
    if (roleGuard) return roleGuard;

    const { error } = await (supabase as any)
      .from("events")
      .delete()
      .eq("id", eventId)
      .eq("escola_id", userEscolaId);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
