import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { createRouteClient } from "@/lib/supabase/route-client";

export async function POST(request: NextRequest) {
  try {
    const bodyText = await request.text();
    const params = new URLSearchParams(bodyText);
    const signature = request.headers.get("x-twilio-signature") || undefined;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (authToken) {
      const valid = twilio.validateRequest(authToken, signature || "", request.url, Object.fromEntries(params));
      if (!valid) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const messageSid = params.get("MessageSid");
    const messageStatus = params.get("MessageStatus");
    const errorCode = params.get("ErrorCode");

    if (messageSid && messageStatus) {
      const supabase = await createClient();
      await supabase
        .from("outbox_notificacoes")
        .update({ status: messageStatus, error_message: errorCode || null })
        .eq("mensagem_id", messageSid);
    }

    return new Response(null, { status: 200 });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
