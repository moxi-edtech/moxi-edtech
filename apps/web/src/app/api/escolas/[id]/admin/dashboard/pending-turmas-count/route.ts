import { NextResponse } from "next/server";
import { createClient } from "~/lib/supabase/server";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await context.params;

  if (!escolaId) {
    return NextResponse.json(
      { error: "O ID da escola é obrigatório." },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const metaEscolaId = (user.app_metadata as { escola_id?: string | null } | null)?.escola_id ?? null;
  const resolvedEscolaId = await resolveEscolaIdForUser(
    supabase,
    user.id,
    escolaId,
    metaEscolaId ? String(metaEscolaId) : null
  );

  if (!resolvedEscolaId) {
    return NextResponse.json({ error: "Sem acesso à escola." }, { status: 403 });
  }

  try {
    const { data, error } = await supabase
      .from("vw_admin_pending_turmas_count")
      .select("pendentes_total")
      .eq("escola_id", resolvedEscolaId)
      .maybeSingle();

    if (error) {
      console.error("[API pending-turmas-count] Erro ao buscar view:", error);
      throw new Error(
        `Falha ao buscar contagem de turmas pendentes: ${error.message}`
      );
    }

    return NextResponse.json({ ok: true, count: data?.pendentes_total || 0 });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: e.message || "Ocorreu um erro no servidor.",
      },
      { status: 500 }
    );
  }
}
