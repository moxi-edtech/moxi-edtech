import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";

const PayloadSchema = z.object({
  mensalidadeId: z.string().uuid(),
  motivo: z.string().trim().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const parsed = PayloadSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues?.[0]?.message || "Payload inválido" },
        { status: 400 }
      );
    }

    const { mensalidadeId, motivo } = parsed.data;

    const { data, error } = await supabase.rpc("estornar_mensalidade", {
      p_mensalidade_id: mensalidadeId,
      p_motivo: motivo ?? null,
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    if (!data || (data as any)?.ok === false) {
      return NextResponse.json(
        { ok: false, error: (data as any)?.erro || "Falha ao estornar mensalidade" },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
