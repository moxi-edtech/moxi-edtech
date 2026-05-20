import { NextResponse } from "next/server";
import postgres from "postgres";

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

export async function GET() {
  let sql: postgres.Sql | null = null;

  try {
    sql = postgres(resolveDbUrl(), { max: 1, prepare: false });
    const rows = await sql<MaintenanceRow[]>`
      select
        id,
        title,
        message,
        starts_at,
        ends_at,
        maintenance_type,
        banner_severity,
        enforce_heavy_ops,
        case
          when timezone('utc', now()) between starts_at and ends_at then 'active'
          else 'scheduled'
        end as phase
      from public.system_maintenance_windows
      where status = 'scheduled'
        and ends_at > timezone('utc', now())
        and (
          starts_at <= timezone('utc', now())
          or starts_at <= timezone('utc', now()) + interval '24 hours'
        )
      order by
        case when timezone('utc', now()) between starts_at and ends_at then 0 else 1 end,
        starts_at asc
      limit 1
    `;

    return NextResponse.json({
      ok: true,
      window: rows[0] ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  } finally {
    await sql?.end({ timeout: 1 }).catch(() => null);
  }
}
