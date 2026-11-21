import { NextResponse } from "next/server";
import { supabaseRouteClient } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { isTrustedWebPushEndpoint } from "@/lib/notificacoes/webPushEndpointPolicy";

export async function POST(request: Request) {
  try {
    const supabase = await supabaseRouteClient();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const { subscription, escola_id } = body;

    if (!subscription || typeof subscription.endpoint !== "string" ||
        typeof escola_id !== "string" || !escola_id.trim()) {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
    }

    // Escola deve ser validada pelo servidor; não confiar no corpo do pedido.
    const authorizedEscolaId = await resolveEscolaIdForUser(supabase, user.id, escola_id);
    if (!authorizedEscolaId) {
      return NextResponse.json({ error: "Sem acesso à escola" }, { status: 403 });
    }

    // Only a browser push service may receive Web Push POSTs from the server.
    if (!isTrustedWebPushEndpoint(subscription.endpoint)) {
      return NextResponse.json({ error: "Endpoint de push inválido" }, { status: 400 });
    }

    // Extraction of keys for our schema
    const p256dh = subscription.keys?.p256dh;
    const auth_key = subscription.keys?.auth;

    if (!p256dh || !auth_key) {
      return NextResponse.json({ error: "Chaves de subscrição ausentes" }, { status: 400 });
    }

    const userAgent = request.headers.get("user-agent");

    const { error } = await supabase
      .from("aluno_push_subscriptions")
      .upsert({
        user_id: user.id,
        escola_id: authorizedEscolaId,
        endpoint: subscription.endpoint,
        p256dh: p256dh,
        auth: auth_key,
        user_agent: userAgent,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "user_id, endpoint"
      });

    if (error) {
      console.error("[PushSubscribe] DB Error:", error);
      return NextResponse.json({ error: "Falha ao salvar subscrição" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PushSubscribe] Server Error:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await supabaseRouteClient();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { endpoint } = await request.json();

    if (!endpoint) {
      return NextResponse.json({ error: "Endpoint ausente" }, { status: 400 });
    }

    const { error } = await supabase
      .from("aluno_push_subscriptions")
      .delete()
      .eq("user_id", user.id)
      .eq("endpoint", endpoint);

    if (error) {
      console.error("[PushUnsubscribe] DB Error:", error);
      return NextResponse.json({ error: "Falha ao remover subscrição" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PushUnsubscribe] Server Error:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
