import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";

const Body = z.object({
  matricula_id: z.string().uuid(),
  ano_letivo_id: z.string().uuid(),
  motivo: z.string().trim().min(12).max(500),
});

/** A short-lived, student-specific permission. It never reopens the global
 * window, creates a payment, or waives RAA/finance checks.
 */
export async function POST(request: Request) {
  try {
    const supabase = await supabaseServerTyped<Database>();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não identificada." }, { status: 403 });
    const body = Body.safeParse(await request.json().catch(() => null));
    if (!body.success) {
      return NextResponse.json({ ok: false, error: "Matrícula, ano destino e motivo são obrigatórios." }, { status: 400 });
    }
    const { data, error } = await supabase.rpc("autorizar_rematricula_fora_prazo" as any, {
      p_escola_id: escolaId,
      p_matricula_origem_id: body.data.matricula_id,
      p_ano_destino_id: body.data.ano_letivo_id,
      p_motivo: body.data.motivo,
    } as any);
    if (error || (data as any)?.ok !== true) {
      return NextResponse.json({ ok: false, code: error?.code ?? "LATE_ENROLLMENT_AUTH_FAILED",
        error: error?.message ?? "Não foi possível autorizar a operação." },
        { status: error?.code === "42501" ? 403 : 409 });
    }
    return NextResponse.json({ ok: true, data }, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    console.error("[balcao/fora-prazo]", cause);
    return NextResponse.json({ ok: false, error: "Erro ao autorizar a rematrícula excecional." }, { status: 500 });
  }
}
