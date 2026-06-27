import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { authorizeWhatsappUser, withNoStore } from "@/lib/server/whatsappUtility";
import type { DBWithRPC } from "@/types/supabase-augment";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await supabaseServerTyped<DBWithRPC>();
    const auth = await authorizeWhatsappUser(supabase, id);
    if (!auth.ok) {
      return withNoStore(NextResponse.json({ ok: false, error: auth.error }, { status: auth.status }));
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "all";
    const limit = Math.max(1, Math.min(Number(searchParams.get("limit") || 50), 100));

    let query = supabase
      .from("communication_threads")
      .select(`
        id,
        school_id,
        channel,
        provider,
        contact_phone_masked,
        contact_name,
        contact_role,
        linked_entity_type,
        linked_entity_id,
        status,
        assigned_to,
        last_message_preview,
        last_message_at,
        unread_count,
        created_at,
        updated_at
      `)
      .eq("school_id", auth.auth.escolaId)
      .order("last_message_at", { ascending: false })
      .limit(limit);

    const validStatuses = ["open", "pending", "resolved", "archived", "blocked"] as const;
    type ThreadStatus = (typeof validStatuses)[number];

    if (status !== "all" && validStatuses.includes(status as ThreadStatus)) {
      query = query.eq("status", status as ThreadStatus);
    }

    const { data: threads, error } = await query;
    if (error) throw error;

    return withNoStore(NextResponse.json({ ok: true, data: threads || [] }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return withNoStore(NextResponse.json({ ok: false, error: message }, { status: 500 }));
  }
}
