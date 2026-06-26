import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import {
  authorizeWhatsappUser,
  isWahaEnabled,
  withNoStore,
} from "@/lib/server/whatsappUtility";
import type { DBWithRPC } from "@/types/supabase-augment";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const actionSchema = z.object({
  action: z.enum(["approve", "cancel", "retry", "reject"]),
});

async function providerIsConnected(supabase: any, escolaId: string) {
  const { data, error } = await supabase
    .from("school_notification_providers")
    .select("status")
    .eq("school_id", escolaId)
    .eq("provider_type", "whatsapp_waha")
    .maybeSingle();
  if (error) throw error;
  return data?.status === "connected";
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; outboxId: string }> }
) {
  try {
    const { id, outboxId } = await params;
    const supabase = await supabaseServerTyped<DBWithRPC>();
    const auth = await authorizeWhatsappUser(supabase, id);
    if (!auth.ok) return withNoStore(NextResponse.json({ ok: false, error: auth.error }, { status: auth.status }));

    const parsed = actionSchema.safeParse(await request.json());
    if (!parsed.success) return withNoStore(NextResponse.json({ ok: false, error: "Ação inválida." }, { status: 400 }));

    const { data: item, error: itemError } = await (supabase as any)
      .from("communication_outbox")
      .select("id,school_id,status")
      .eq("id", outboxId)
      .eq("school_id", auth.auth.escolaId)
      .maybeSingle();

    if (itemError) throw itemError;
    if (!item) return withNoStore(NextResponse.json({ ok: false, error: "Mensagem não encontrada." }, { status: 404 }));

    if (parsed.data.action === "approve") {
      if (!isWahaEnabled()) return withNoStore(NextResponse.json({ ok: false, error: "WhatsApp KLASSE está desativado neste ambiente." }, { status: 403 }));
      if (!(await providerIsConnected(supabase as any, auth.auth.escolaId))) {
        return withNoStore(NextResponse.json({ ok: false, error: "WhatsApp da escola está desconectado." }, { status: 409 }));
      }
      if (!["draft", "review_required", "approved", "failed"].includes(item.status)) {
        return withNoStore(NextResponse.json({ ok: false, error: "Status não permite aprovação." }, { status: 409 }));
      }
    } else if (parsed.data.action === "retry") {
      if (!isWahaEnabled()) return withNoStore(NextResponse.json({ ok: false, error: "WhatsApp KLASSE está desativado neste ambiente." }, { status: 403 }));
      if (!(await providerIsConnected(supabase as any, auth.auth.escolaId))) {
        return withNoStore(NextResponse.json({ ok: false, error: "WhatsApp da escola está desconectado." }, { status: 409 }));
      }
      if (item.status !== "failed") {
        return withNoStore(NextResponse.json({ ok: false, error: "Apenas falhas podem ser reenviadas." }, { status: 409 }));
      }
    } else if (parsed.data.action === "reject") {
      if (!["draft", "review_required"].includes(item.status)) {
        return withNoStore(NextResponse.json({ ok: false, error: "Status não permite rejeição." }, { status: 409 }));
      }
    } else {
      if (["sent", "delivered", "read"].includes(item.status)) {
        return withNoStore(NextResponse.json({ ok: false, error: "Mensagem já enviada não pode ser cancelada." }, { status: 409 }));
      }
    }

    const { data, error } = await (supabase as any).rpc("set_communication_outbox_action", {
      p_outbox_id: outboxId,
      p_action: parsed.data.action,
    });

    if (error) throw error;

    await (supabase as any).from("communication_logs").insert({
      outbox_id: outboxId,
      school_id: auth.auth.escolaId,
      event_type: `outbox.${parsed.data.action}`,
      provider: "waha",
      payload_sanitized: { status: data.status },
    });

    return withNoStore(NextResponse.json({ ok: true, data }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return withNoStore(NextResponse.json({ ok: false, error: message }, { status: 500 }));
  }
}
