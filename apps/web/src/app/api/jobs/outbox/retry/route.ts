import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const eventId = (body?.event_id as string | undefined)?.trim();
    if (!eventId) {
      return NextResponse.json({ ok: false, error: "event_id obrigatório" }, { status: 400 });
    }

    const supabase = await supabaseServerTyped();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const { error } = await (supabase as any).rpc("retry_outbox_event", {
      p_event_id: eventId,
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 });
  }
}
