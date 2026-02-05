import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const payloadSchema = z.object({
  aluno_id: z.string().uuid(),
  mensalidade_id: z.string().uuid().nullable().optional(),
  valor: z.number().positive(),
  metodo: z.enum(["cash", "tpa", "transfer", "mcx", "kiwk", "kwik"]),
  reference: z.string().trim().min(1).nullable().optional(),
  evidence_url: z.string().trim().min(1).nullable().optional(),
  gateway_ref: z.string().trim().min(1).nullable().optional(),
  meta: z.record(z.any()).optional(),
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

    const payload = parsed.data;
    const metodo = payload.metodo === "kwik" ? "kiwk" : payload.metodo;
    const { data, error } = await supabase.rpc("financeiro_registrar_pagamento_secretaria", {
      p_escola_id: escolaId,
      p_aluno_id: payload.aluno_id,
      p_mensalidade_id: payload.mensalidade_id ?? null,
      p_valor: payload.valor,
      p_metodo: metodo,
      p_reference: payload.reference ?? null,
      p_evidence_url: payload.evidence_url ?? null,
      p_gateway_ref: payload.gateway_ref ?? null,
      p_meta: payload.meta ?? {},
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
