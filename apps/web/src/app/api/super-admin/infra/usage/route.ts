import { NextResponse } from "next/server";
import postgres from "postgres";

import { requireSuperAdminRoute } from "@/lib/auth/requireSuperAdminRoute";

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

type SizeRow = { bytes: number | string | null };
type TopTableRow = { table_name: string; bytes: number | string | null };
type PortalRow = { portal: string | null; total: number | string | null };
type CronStatusRow = { status: string | null; total: number | string | null };
type CountRow = {
  total: number | string | null;
  oldest: string | null;
  newest: string | null;
};

export async function GET() {
  let sql: postgres.Sql | null = null;
  const auth = await requireSuperAdminRoute();
  if (!auth.ok) return auth.response;

  try {
    const format = "json";
    sql = postgres(resolveDbUrl(), { max: 1, prepare: false });

    const [
      dbSizeRows,
      topTableRows,
      storageRows,
      cronSizeRows,
      cronCountRows,
      cronStatusRows,
      auditSizeRows,
      auditCountRows,
      auditPortalRows,
    ] = await Promise.all([
      sql<SizeRow[]>`select pg_database_size(current_database()) as bytes`,
      sql<TopTableRow[]>`
        select
          n.nspname || '.' || c.relname as table_name,
          pg_total_relation_size(c.oid) as bytes
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where c.relkind in ('r', 'm')
          and n.nspname not in ('pg_catalog', 'information_schema')
        order by pg_total_relation_size(c.oid) desc
        limit 8
      `,
      sql<SizeRow[]>`
        select coalesce(sum((metadata->>'size')::bigint), 0) as bytes
        from storage.objects
      `,
      sql<SizeRow[]>`
        select pg_total_relation_size('cron.job_run_details'::regclass) as bytes
      `,
      sql<CountRow[]>`
        select
          count(*) as total,
          min(start_time)::text as oldest,
          max(start_time)::text as newest
        from cron.job_run_details
      `,
      sql<CronStatusRow[]>`
        select status, count(*) as total
        from cron.job_run_details
        group by status
        order by count(*) desc
      `,
      sql<SizeRow[]>`
        select pg_total_relation_size('public.audit_logs'::regclass) as bytes
      `,
      sql<CountRow[]>`
        select
          count(*) as total,
          min(created_at)::text as oldest,
          max(created_at)::text as newest
        from public.audit_logs
      `,
      sql<PortalRow[]>`
        select coalesce(portal, 'sem_portal') as portal, count(*) as total
        from public.audit_logs
        group by coalesce(portal, 'sem_portal')
        order by count(*) desc
        limit 8
      `,
    ]);

    const dbLimitMb = 500;
    const storageLimitMb = 1024;

    const dbSizeBytes = Number(dbSizeRows[0]?.bytes ?? 0);
    const storageBytes = Number(storageRows[0]?.bytes ?? 0);
    const cronBytes = Number(cronSizeRows[0]?.bytes ?? 0);
    const auditBytes = Number(auditSizeRows[0]?.bytes ?? 0);

    const dbSizeMb = dbSizeBytes / (1024 * 1024);
    const storageMb = storageBytes / (1024 * 1024);
    const cronMb = cronBytes / (1024 * 1024);
    const auditMb = auditBytes / (1024 * 1024);

    const cronTotal = Number(cronCountRows[0]?.total ?? 0);
    const auditTotal = Number(auditCountRows[0]?.total ?? 0);
    const cronFailed =
      Number(cronStatusRows.find((row) => String(row.status ?? "") === "failed")?.total ?? 0);

    const recommendations: string[] = [];
    if (dbSizeMb >= dbLimitMb * 0.9) {
      recommendations.push("Aplicar retenção em cron.job_run_details e audit_logs imediatamente.");
    }
    if (cronMb >= 150) {
      recommendations.push("Reduzir retenção de cron.job_run_details para 7-14 dias em sucessos e 30-60 dias em falhas.");
    }
    if (auditMb >= 40) {
      recommendations.push("Criar política de retenção/arquivo para audit_logs e cortar ruído operacional.");
    }
    if (cronFailed >= 1000) {
      recommendations.push("Investigar jobs com alta taxa de falha para reduzir crescimento de job_run_details.");
    }

    const payload = {
      ok: true,
      metrics: {
        db_size_mb: dbSizeMb,
        db_size_limit_mb: dbLimitMb,
        storage_mb: storageMb,
        storage_limit_mb: storageLimitMb,
        api_calls_24h: null,
        api_calls_limit: null,
        bandwidth_mb: null,
        bandwidth_limit_mb: 5120,
        top_tables: topTableRows.map((row) => ({
          name: row.table_name,
          size_mb: Number(row.bytes ?? 0) / (1024 * 1024),
        })),
        cron_job_run_details_mb: cronMb,
        cron_runs_total: cronTotal,
        cron_failed_total: cronFailed,
        cron_oldest_at: cronCountRows[0]?.oldest ?? null,
        cron_newest_at: cronCountRows[0]?.newest ?? null,
        audit_logs_mb: auditMb,
        audit_logs_total: auditTotal,
        audit_oldest_at: auditCountRows[0]?.oldest ?? null,
        audit_newest_at: auditCountRows[0]?.newest ?? null,
        audit_by_portal: auditPortalRows.map((row) => ({
          portal: row.portal ?? "sem_portal",
          total: Number(row.total ?? 0),
        })),
        recommendations,
      },
    };

    if (format === "json") {
      const res = NextResponse.json(payload);
      res.headers.set(
        "Content-Disposition",
        `attachment; filename="super_admin_infra_snapshot_${new Date().toISOString().replace(/[:.]/g, "-")}.json"`
      );
      return res;
    }

    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  } finally {
    await sql?.end({ timeout: 1 }).catch(() => null);
  }
}
