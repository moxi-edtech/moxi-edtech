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

async function assertSuperAdmin() {
  const s = await supabaseServer();
  const { data: sess } = await s.auth.getUser();
  const user = sess?.user;
  if (!user) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 }) };
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
    return { ok: false as const, response: NextResponse.json({ ok: false, error: "Somente Super Admin" }, { status: 403 }) };
  }

  return { ok: true as const };
}

async function collectCandidates(sql: postgres.Sql) {
  const [cronSucceededRows, cronFailedRows, auditRows] = await Promise.all([
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

  return {
    cron_succeeded: Number(cronSucceededRows[0]?.total ?? 0),
    cron_failed: Number(cronFailedRows[0]?.total ?? 0),
    audit_logs: Number(auditRows[0]?.total ?? 0),
  };
}

export async function POST(req: Request) {
  const auth = await assertSuperAdmin();
  if (!auth.ok) return auth.response;

  let sql: postgres.Sql | null = null;

  try {
    const body = (await req.json().catch(() => ({}))) as {
      execute?: boolean;
    };

    sql = postgres(resolveDbUrl(), { max: 1, prepare: false });

    const before = await collectCandidates(sql);

    if (!body.execute) {
      return NextResponse.json({
        ok: true,
        mode: "dry-run",
        retention_policy: {
          cron_succeeded_days: 14,
          cron_failed_days: 60,
          audit_logs_days: 90,
        },
        candidates: before,
      });
    }

    await sql.begin(async (tx) => {
      const sqlTx = tx as unknown as postgres.Sql;
      await sqlTx`
        delete from cron.job_run_details
        where status = 'succeeded'
          and start_time < now() - interval '14 days'
      `;
      await sqlTx`
        delete from cron.job_run_details
        where status = 'failed'
          and start_time < now() - interval '60 days'
      `;
      await sqlTx`
        delete from public.audit_logs
        where created_at < now() - interval '90 days'
      `;
    });

    const after = await collectCandidates(sql);

    return NextResponse.json({
      ok: true,
      mode: "execute",
      deleted: {
        cron_succeeded: Math.max(0, before.cron_succeeded - after.cron_succeeded),
        cron_failed: Math.max(0, before.cron_failed - after.cron_failed),
        audit_logs: Math.max(0, before.audit_logs - after.audit_logs),
      },
      remaining_candidates: after,
      maintenance_note: "Para recuperar espaço físico no PostgreSQL, pode ser necessário executar manutenção adicional fora do fluxo HTTP.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  } finally {
    await sql?.end({ timeout: 1 }).catch(() => null);
  }
}
