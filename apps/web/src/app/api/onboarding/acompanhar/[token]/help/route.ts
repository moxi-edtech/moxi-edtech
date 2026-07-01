import { NextResponse } from "next/server";
import { supabaseRouteClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    if (!token) {
      return NextResponse.json({ ok: false, error: "Token inválido" }, { status: 400 });
    }

    const supabase = await supabaseRouteClient();
    const { data: request, error: reqError } = await supabase
      .from("onboarding_requests")
      .select("id")
      .eq("tracking_token", token.toUpperCase().trim())
      .maybeSingle();

    if (reqError || !request) {
      return NextResponse.json({ ok: false, error: "Pedido não encontrado" }, { status: 404 });
    }

    const { data: doubts, error: doubtsError } = await (supabase as any)
      .from("onboarding_doubts")
      .select("*")
      .eq("onboarding_id", request.id)
      .order("created_at", { ascending: true });

    if (doubtsError) {
      return NextResponse.json({ ok: false, error: doubtsError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, messages: doubts || [] });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || "Erro interno" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    if (!token) {
      return NextResponse.json({ ok: false, error: "Token inválido" }, { status: 400 });
    }

    const body = await req.json();
    const { sender_name, message, step_code } = body;

    if (!sender_name?.trim() || !message?.trim()) {
      return NextResponse.json({ ok: false, error: "Nome e mensagem são obrigatórios" }, { status: 400 });
    }

    const supabase = await supabaseRouteClient();
    const { data: request, error: reqError } = await supabase
      .from("onboarding_requests")
      .select("id")
      .eq("tracking_token", token.toUpperCase().trim())
      .maybeSingle();

    if (reqError || !request) {
      return NextResponse.json({ ok: false, error: "Pedido não encontrado" }, { status: 404 });
    }

    const { data: doubt, error: insertError } = await (supabase as any)
      .from("onboarding_doubts")
      .insert({
        onboarding_id: request.id,
        sender_type: "escola",
        sender_name: sender_name.trim(),
        message: message.trim(),
        step_code: step_code || null,
      })
      .select("*")
      .single();

    if (insertError) {
      return NextResponse.json({ ok: false, error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, doubt });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || "Erro interno" }, { status: 500 });
  }
}
