import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const payloadSchema = z.object({
  fecho_id: z.string().uuid(),
  aprovacao: z.enum(["approved", "rejected"]),
  justificativa: z.string().trim().min(1).max(255).optional(),
  meta: z.record(z.any()).optional(),
});

export async function POST(request: Request) {
  try {
    const idempotencyKey =
      request.headers.get("Idempotency-Key") ?? request.headers.get("idempotency-key");
    if (!idempotencyKey) {
      return NextResponse.json(
        { ok: false, error: "Idempotency-Key header é obrigatório" },
        { status: 400 }
      );
    }

    const supabase = await supabaseServerTyped<any>();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Escola não identificada" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const parsed = payloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues?.[0]?.message || "Payload inválido" },
        { status: 400 }
      );
    }

    const desiredStatus = parsed.data.aprovacao === "approved" ? "approved" : "rejected";
    const { data: existing } = await supabase
      .from("fecho_caixa")
      .select("id, status, escola_id, approved_by, approved_at")
      .eq("escola_id", escolaId)
      .eq("id", parsed.data.fecho_id)
      .maybeSingle();
    if (existing?.status === desiredStatus) {
      return NextResponse.json({ ok: true, data: existing, idempotent: true });
    }
    if (existing?.status && existing.status !== "declared") {
      return NextResponse.json(
        { ok: false, error: "Fecho já foi processado" },
        { status: 409 }
      );
    }

    const { data, error } = await supabase.rpc("financeiro_fecho_aprovar", {
      p_escola_id: escolaId,
      p_fecho_id: parsed.data.fecho_id,
      p_aprovacao: parsed.data.aprovacao,
      p_justificativa: parsed.data.justificativa ?? null,
      p_aprovacao_meta: parsed.data.meta ?? {},
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
