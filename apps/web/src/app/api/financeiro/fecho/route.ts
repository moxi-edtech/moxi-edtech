import { NextResponse } from "next/server";
import { getFechoCaixaData } from "@/lib/financeiro/fecho";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { z } from "zod";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const date = url.searchParams.get("date");
    const operadorId = url.searchParams.get("operador_id");
    const operadorScope = url.searchParams.get("operador_scope");

    const data = await getFechoCaixaData({
      date,
      operadorId,
      operadorScope: operadorScope === "all" ? "all" : "self",
    });

    if (!data.ok) {
      return NextResponse.json({ ok: false, error: data.error }, { status: 400 });
    }

    return NextResponse.json(data, { status: 200 });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

const BodySchema = z.object({
  valor_declarado_especie: z.number(),
  valor_declarado_tpa: z.number(),
  valor_declarado_transferencia: z.number(),
});

export async function POST(req: Request) {
  try {
    const supabase = await supabaseServerTyped<Database>();
    const supabaseAny = supabase as any;
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const idempotencyKey =
      req.headers.get("Idempotency-Key") ?? req.headers.get("idempotency-key");
    if (!idempotencyKey) {
      return NextResponse.json(
        { ok: false, error: "Idempotency-Key header é obrigatório" },
        { status: 400 }
      );
    }

    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Escola não identificada" }, { status: 403 });
    }
    
    const body = await req.json();
    const parsed = BodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Payload inválido", issues: parsed.error.issues }, { status: 400 });
    }

    const { data: existingIdempotency } = await supabaseAny
      .from("idempotency_keys")
      .select("result")
      .eq("escola_id", escolaId)
      .eq("scope", "financeiro_fecho_declarar")
      .eq("key", idempotencyKey)
      .maybeSingle();

    if (existingIdempotency?.result) {
      return NextResponse.json(existingIdempotency.result, { status: 200 });
    }

    const { error: rpcError, data: rpcData } = await supabase.rpc("declarar_fecho_caixa", {
      p_escola_id: escolaId,
      p_valor_declarado_especie: parsed.data.valor_declarado_especie,
      p_valor_declarado_tpa: parsed.data.valor_declarado_tpa,
      p_valor_declarado_transferencia: parsed.data.valor_declarado_transferencia,
    });

    if (rpcError) {
      return NextResponse.json({ ok: false, error: rpcError.message }, { status: 400 });
    }

    const responsePayload = { ok: true, data: rpcData };

    await supabaseAny.from("idempotency_keys").upsert(
      {
        escola_id: escolaId,
        scope: "financeiro_fecho_declarar",
        key: idempotencyKey,
        result: responsePayload,
      },
      { onConflict: "escola_id,scope,key" }
    );

    return NextResponse.json(responsePayload);

  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
