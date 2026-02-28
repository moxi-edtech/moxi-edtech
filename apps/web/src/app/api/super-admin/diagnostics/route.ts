import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { isSuperAdminRole } from "@/lib/auth/requireSuperAdminAccess";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET() {
  try {
    const s = await supabaseServer();
    const { data: sess } = await s.auth.getUser();
    const user = sess?.user;
    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }
    const { data: rows } = await s
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1);
    const role = (rows?.[0] as any)?.role as string | undefined;
    if (!isSuperAdminRole(role)) {
      return NextResponse.json({ ok: false, error: 'Somente Super Admin' }, { status: 403 });
    }

    const [outboxSummary, cronRuns] = await Promise.all([
      (s as any).rpc("get_outbox_status_summary"),
      (s as any).rpc("get_recent_cron_runs", { p_limit: 30 }),
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
