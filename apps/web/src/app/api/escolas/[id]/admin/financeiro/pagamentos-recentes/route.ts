import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const querySchema = z.object({
  limit: z.string().optional(),
  day_key: z.string().optional(),
});

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: escolaId } = await context.params;
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const metaEscolaId = (user.app_metadata as { escola_id?: string | null } | null)?.escola_id ?? null;
    const resolvedEscolaId = await resolveEscolaIdForUser(
      supabase as any,
      user.id,
      escolaId,
      metaEscolaId ? String(metaEscolaId) : null
    );

    if (!resolvedEscolaId) {
      return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      limit: searchParams.get("limit") || undefined,
      day_key: searchParams.get("day_key") || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Parâmetros inválidos" }, { status: 400 });
    }

    const limit = Math.min(Math.max(Number(parsed.data.limit ?? 10), 1), 50);
    const dayKey = parsed.data.day_key ?? new Date().toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from("pagamentos")
      .select("id, aluno_id, valor_pago, metodo, status, created_at")
      .eq("escola_id", resolvedEscolaId)
      .eq("day_key", dayKey)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data: data ?? [] });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
