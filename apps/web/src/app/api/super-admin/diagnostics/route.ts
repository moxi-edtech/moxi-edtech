import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

function getAdminClient() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET() {
  try {
    const admin = getAdminClient();
    if (!admin) {
      return NextResponse.json({ ok: false, error: "Server misconfigured" }, { status: 500 });
    }

    const [outboxSummary, cronRuns] = await Promise.all([
      admin.rpc("get_outbox_status_summary"),
      admin.rpc("get_recent_cron_runs", { p_limit: 30 }),
    ]);

    if (outboxSummary.error) {
      return NextResponse.json({ ok: false, error: outboxSummary.error.message }, { status: 500 });
    }

    const now = Date.now();
    const summary = (outboxSummary.data ?? []).reduce(
      (acc: Record<string, { total: number; oldest_age_minutes: number | null }>, row: any) => {
        const createdAt = row.oldest ? new Date(row.oldest).getTime() : null;
        acc[row.status] = {
          total: Number(row.total ?? 0),
          oldest_age_minutes: createdAt ? Math.floor((now - createdAt) / 60000) : null,
        };
        return acc;
      },
      {}
    );

    return NextResponse.json({
      ok: true,
      outbox: summary,
      cronRuns: cronRuns.data ?? [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
