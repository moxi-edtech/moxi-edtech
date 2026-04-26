import { NextResponse } from "next/server";
import { logFunnelEvent, type FunnelEventPayload } from "@/lib/funnel-log";
import { supabaseServer } from "@/lib/supabaseServer";
import { getFormacaoAuthContext } from "@/lib/auth-context";
import type { FormacaoSupabaseClient } from "@/lib/db-types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as FunnelEventPayload | null;
    if (!body?.event || !body?.stage) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const auth = await getFormacaoAuthContext();
    const supabase = (await supabaseServer()) as FormacaoSupabaseClient;
    const { error } = await supabase.from("formacao_funnel_eventos").insert({
      app: "formacao",
      event: body.event,
      stage: body.stage,
      path: body.path ?? new URL(request.url).pathname,
      source: body.source ?? null,
      tenant_slug: auth?.tenantSlug ?? body.tenant_slug ?? null,
      tenant_id: auth?.tenantId ?? body.tenant_id ?? null,
      user_id: auth?.userId ?? body.user_id ?? null,
      details: body.details ?? {},
    });

    logFunnelEvent({
      ...body,
      path: body.path ?? new URL(request.url).pathname,
      tenant_id: auth?.tenantId ?? body.tenant_id ?? null,
      tenant_slug: auth?.tenantSlug ?? body.tenant_slug ?? null,
      user_id: auth?.userId ?? body.user_id ?? null,
      details: {
        ...(body.details ?? {}),
        persisted: !error,
        persist_error: error?.message ?? null,
      },
    });
    return NextResponse.json({ ok: true, persisted: !error });
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
}
