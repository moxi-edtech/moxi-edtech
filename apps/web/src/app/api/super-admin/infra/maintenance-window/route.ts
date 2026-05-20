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

  return { ok: true as const, userId: user.id };
}

type MaintenanceRow = {
  id: string;
  title: string;
  message: string;
  starts_at: string;
  ends_at: string;
  status: "scheduled" | "cancelled";
  maintenance_type: "infra" | "vacuum_full";
  banner_severity: "warning" | "critical";
  enforce_heavy_ops: boolean;
  phase: "active" | "scheduled";
};

function normalizeRow(row: MaintenanceRow | undefined | null) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    status: row.status,
    maintenance_type: row.maintenance_type,
    banner_severity: row.banner_severity,
    enforce_heavy_ops: row.enforce_heavy_ops,
    phase: row.phase,
  };
}

async function fetchCurrentWindow(sql: postgres.Sql) {
  const rows = await sql<MaintenanceRow[]>`
    select
      id,
      title,
      message,
      starts_at,
      ends_at,
      status,
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
    order by
      case when timezone('utc', now()) between starts_at and ends_at then 0 else 1 end,
      starts_at asc
    limit 1
  `;

  return rows[0] ?? null;
}

export async function GET() {
  const auth = await assertSuperAdmin();
  if (!auth.ok) return auth.response;

  let sql: postgres.Sql | null = null;

  try {
    sql = postgres(resolveDbUrl(), { max: 1, prepare: false });
    const current = await fetchCurrentWindow(sql);
    return NextResponse.json({ ok: true, window: normalizeRow(current) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  } finally {
    await sql?.end({ timeout: 1 }).catch(() => null);
  }
}

export async function POST(req: Request) {
  const auth = await assertSuperAdmin();
  if (!auth.ok) return auth.response;

  let sql: postgres.Sql | null = null;

  try {
    const body = (await req.json().catch(() => ({}))) as {
      title?: string;
      message?: string;
      startsAt?: string;
      endsAt?: string;
      maintenanceType?: "infra" | "vacuum_full";
      bannerSeverity?: "warning" | "critical";
      enforceHeavyOps?: boolean;
    };

    const title = String(body.title ?? "").trim();
    const message = String(body.message ?? "").trim();
    const startsAt = String(body.startsAt ?? "").trim();
    const endsAt = String(body.endsAt ?? "").trim();
    const maintenanceType = body.maintenanceType === "vacuum_full" ? "vacuum_full" : "infra";
    const bannerSeverity = body.bannerSeverity === "critical" ? "critical" : "warning";
    const enforceHeavyOps = body.enforceHeavyOps !== false;

    if (title.length < 3 || message.length < 8) {
      return NextResponse.json({ ok: false, error: "Título ou mensagem inválidos" }, { status: 400 });
    }

    const startDate = new Date(startsAt);
    const endDate = new Date(endsAt);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return NextResponse.json({ ok: false, error: "Datas inválidas" }, { status: 400 });
    }
    if (endDate <= startDate) {
      return NextResponse.json({ ok: false, error: "A janela precisa terminar depois do início" }, { status: 400 });
    }

    sql = postgres(resolveDbUrl(), { max: 1, prepare: false });

    const overlap = await sql<{ id: string }[]>`
      select id
      from public.system_maintenance_windows
      where status = 'scheduled'
        and tstzrange(starts_at, ends_at, '[)') && tstzrange(${startDate.toISOString()}, ${endDate.toISOString()}, '[)')
      limit 1
    `;

    if (overlap.length > 0) {
      return NextResponse.json({ ok: false, error: "Já existe uma janela de manutenção nesse intervalo" }, { status: 409 });
    }

    const inserted = await sql<MaintenanceRow[]>`
      insert into public.system_maintenance_windows (
        title,
        message,
        starts_at,
        ends_at,
        maintenance_type,
        banner_severity,
        enforce_heavy_ops,
        created_by
      )
      values (
        ${title},
        ${message},
        ${startDate.toISOString()},
        ${endDate.toISOString()},
        ${maintenanceType},
        ${bannerSeverity},
        ${enforceHeavyOps},
        ${auth.userId}
      )
      returning
        id,
        title,
        message,
        starts_at,
        ends_at,
        status,
        maintenance_type,
        banner_severity,
        enforce_heavy_ops,
        case
          when timezone('utc', now()) between starts_at and ends_at then 'active'
          else 'scheduled'
        end as phase
    `;

    return NextResponse.json({ ok: true, window: normalizeRow(inserted[0]) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  } finally {
    await sql?.end({ timeout: 1 }).catch(() => null);
  }
}

export async function DELETE(req: Request) {
  const auth = await assertSuperAdmin();
  if (!auth.ok) return auth.response;

  let sql: postgres.Sql | null = null;

  try {
    const body = (await req.json().catch(() => ({}))) as { id?: string };
    const id = String(body.id ?? "").trim();

    sql = postgres(resolveDbUrl(), { max: 1, prepare: false });

    const targetId = id || (await fetchCurrentWindow(sql))?.id || "";
    if (!targetId) {
      return NextResponse.json({ ok: false, error: "Nenhuma janela activa ou agendada para cancelar" }, { status: 404 });
    }

    const updated = await sql<MaintenanceRow[]>`
      update public.system_maintenance_windows
      set status = 'cancelled',
          updated_at = timezone('utc', now())
      where id = ${targetId}
      returning
        id,
        title,
        message,
        starts_at,
        ends_at,
        status,
        maintenance_type,
        banner_severity,
        enforce_heavy_ops,
        'scheduled'::text as phase
    `;

    if (updated.length === 0) {
      return NextResponse.json({ ok: false, error: "Janela não encontrada" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, cancelled: normalizeRow(updated[0]) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  } finally {
    await sql?.end({ timeout: 1 }).catch(() => null);
  }
}
