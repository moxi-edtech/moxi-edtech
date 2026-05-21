import { NextResponse } from "next/server";

import { createRouteClient } from "@/lib/supabase/route-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type MaintenanceRow = {
  id: string;
  title: string;
  message: string;
  starts_at: string;
  ends_at: string;
  maintenance_type: "infra" | "vacuum_full";
  banner_severity: "warning" | "critical";
  enforce_heavy_ops: boolean;
  phase: "active" | "scheduled";
};

function isMissingRelationError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("system_maintenance_windows") ||
    normalized.includes("relation") ||
    normalized.includes("does not exist") ||
    normalized.includes("could not find the table")
  );
}

export async function GET() {
  try {
    const supabase = await createRouteClient();
    const { data: auth } = await supabase.auth.getUser();

    if (!auth?.user) {
      return NextResponse.json({ ok: true, window: null });
    }

    const { data, error } = await (supabase as any)
      .from("system_maintenance_windows")
      .select(`
        id,
        title,
        message,
        starts_at,
        ends_at,
        maintenance_type,
        banner_severity,
        enforce_heavy_ops
      `)
      .eq("status", "scheduled")
      .gt("ends_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(10);

    if (error) {
      if (isMissingRelationError(error.message)) {
        return NextResponse.json({ ok: true, window: null });
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const now = Date.now();
    const rows = Array.isArray(data) ? (data as Array<Omit<MaintenanceRow, "phase">>) : [];
    const visible = rows
      .map((row) => {
        const startsAtMs = new Date(row.starts_at).getTime();
        const endsAtMs = new Date(row.ends_at).getTime();
        const isActive = now >= startsAtMs && now <= endsAtMs;
        const isUpcomingWithin24h = startsAtMs > now && startsAtMs - now <= 24 * 60 * 60 * 1000;
        if (!isActive && !isUpcomingWithin24h) return null;
        return {
          ...row,
          phase: (isActive ? "active" : "scheduled") as MaintenanceRow["phase"],
        };
      })
      .filter(Boolean) as MaintenanceRow[];

    const prioritized = visible.sort((a, b) => {
      if (a.phase === b.phase) {
        return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
      }
      return a.phase === "active" ? -1 : 1;
    });

    return NextResponse.json({
      ok: true,
      window: prioritized[0] ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    if (isMissingRelationError(message)) {
      return NextResponse.json({ ok: true, window: null });
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
