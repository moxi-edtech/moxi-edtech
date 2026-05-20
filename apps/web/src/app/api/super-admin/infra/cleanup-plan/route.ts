import { NextResponse } from "next/server";
import postgres from "postgres";

import { supabaseServer } from "@/lib/supabaseServer";
import { isSuperAdminRole } from "@/lib/auth/requireSuperAdminAccess";
import { applyKf2ListInvariants } from "@/lib/kf2";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

function resolveDbUrl() {
  const dbUrl =
    process.env.DB_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    process.env.SUPABASE_DB_URL?.trim() ||
    "";

  if (!dbUrl) {
    throw new Error("DB_URL/DATABASE_URL/SUPABASE_DB_URL não definido.");
  }

  return dbUrl;
}

type CountRow = { total: number | string | null };

export async function GET() {
  let sql: postgres.Sql | null = null;

  try {
    const s = await supabaseServer();
    const { data: sess } = await s.auth.getUser();
    const user = sess?.user;
    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    let roleQuery = s
      .from("profiles")
      .select("role")
      .eq("user_id", user.id);

    roleQuery = applyKf2ListInvariants(roleQuery, {
      defaultLimit: 1,
      order: [{ column: "created_at", ascending: false }],
    });

    const { data: rows } = await roleQuery;
    const role = (rows?.[0] as { role?: string } | undefined)?.role;
    if (!isSuperAdminRole(role)) {
      return NextResponse.json({ ok: false, error: "Somente Super Admin" }, { status: 403 });
    }

    sql = postgres(resolveDbUrl(), { max: 1, prepare: false });

    const [
      cronSucceededRows,
      cronFailedRows,
      auditRows,
    ] = await Promise.all([
      sql<CountRow[]>`
        select count(*) as total
        from cron.job_run_details
        where status = 'succeeded'
          and start_time < now() - interval '14 days'
      `,
      sql<CountRow[]>`
        select count(*) as total
        from cron.job_run_details
        where status = 'failed'
          and start_time < now() - interval '60 days'
      `,
      sql<CountRow[]>`
        select count(*) as total
        from public.audit_logs
        where created_at < now() - interval '90 days'
      `,
    ]);

    return NextResponse.json({
      ok: true,
      plan: {
        retention_policy: {
          cron_succeeded_days: 14,
          cron_failed_days: 60,
          audit_logs_days: 90,
        },
        candidates: {
          cron_succeeded: Number(cronSucceededRows[0]?.total ?? 0),
          cron_failed: Number(cronFailedRows[0]?.total ?? 0),
          audit_logs: Number(auditRows[0]?.total ?? 0),
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  } finally {
    await sql?.end({ timeout: 1 }).catch(() => null);
  }
}
