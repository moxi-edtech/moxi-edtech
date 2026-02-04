import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const payloadSchema = z.object({
  day_key: z.string().min(10),
  declared: z.object({
    cash: z.number().nonnegative(),
    tpa: z.number().nonnegative(),
    transfer: z.number().nonnegative(),
    mcx: z.number().nonnegative(),
  }),
});

export async function POST(request: Request) {
  try {
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

    const { day_key, declared } = parsed.data;
    const { data, error } = await supabase.rpc("financeiro_fecho_declarar_e_snapshot", {
      p_escola_id: escolaId,
      p_day_key: day_key,
      p_cash: declared.cash,
      p_tpa: declared.tpa,
      p_transfer: declared.transfer,
      p_mcx: declared.mcx,
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
