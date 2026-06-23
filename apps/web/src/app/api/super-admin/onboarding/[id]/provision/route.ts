import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseRouteClient } from "@/lib/supabaseServer";
import { isSuperAdminRole } from "@/lib/auth/requireSuperAdminAccess";

export const dynamic = "force-dynamic";

const ProvisionSchema = z.object({
  escola_id: z.string().uuid("ID de escola inválido"),
});

async function requireSuperAdmin() {
  const supabase = await supabaseRouteClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user = session?.user ?? null;
  if (!user) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 }) };
  }

  const role = user.app_metadata?.role ?? user.user_metadata?.role ?? null;

  if (!isSuperAdminRole(typeof role === "string" ? role : null)) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 }) };
  }

  return { ok: true as const, supabase, user };
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ ok: false, error: "ID de onboarding inválido" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const parsed = ProvisionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Dados inválidos: " + parsed.error.issues[0]?.message }, { status: 400 });
    }

    const { escola_id } = parsed.data;

    const { data, error: rpcError } = await auth.supabase.rpc("provisionar_escola_from_onboarding", {
      p_request_id: id,
      p_escola_id: escola_id,
      p_actor_id: auth.user.id,
    });

    if (rpcError) {
      return NextResponse.json({ ok: false, error: "Erro no banco de dados: " + rpcError.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      data,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || "Erro interno" }, { status: 500 });
  }
}
