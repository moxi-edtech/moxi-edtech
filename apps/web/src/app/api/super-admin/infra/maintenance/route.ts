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

  return { ok: true as const };
}

export async function POST(req: Request) {
  const auth = await assertSuperAdmin();
  if (!auth.ok) return auth.response;

  let sql: postgres.Sql | null = null;

  try {
    const body = (await req.json().catch(() => ({}))) as {
      action?: "analyze" | "vacuum" | "vacuum_full";
      target?: "cron.job_run_details" | "public.audit_logs";
    };

    const action = body.action;
    if (action !== "analyze" && action !== "vacuum" && action !== "vacuum_full") {
      return NextResponse.json({ ok: false, error: "Ação inválida" }, { status: 400 });
    }

    sql = postgres(resolveDbUrl(), { max: 1, prepare: false });

    if (action === "analyze") {
      await sql.unsafe("ANALYZE cron.job_run_details");
      await sql.unsafe("ANALYZE public.audit_logs");
      return NextResponse.json({
        ok: true,
        action,
        message: "ANALYZE executado em cron.job_run_details e public.audit_logs.",
      });
    }

    if (action === "vacuum_full") {
      const target = body.target;
      if (target !== "cron.job_run_details" && target !== "public.audit_logs") {
        return NextResponse.json({ ok: false, error: "Tabela inválida para VACUUM FULL" }, { status: 400 });
      }

      const maintenanceWindow = await sql<{
        id: string;
        title: string;
        starts_at: string;
        ends_at: string;
      }[]>`
        select id, title, starts_at, ends_at
        from public.system_maintenance_windows
        where status = 'scheduled'
          and enforce_heavy_ops = true
          and starts_at <= timezone('utc', now())
          and ends_at >= timezone('utc', now())
        order by starts_at desc
        limit 1
      `;

      if (maintenanceWindow.length === 0) {
        const nextWindow = await sql<{
          id: string;
          title: string;
          starts_at: string;
          ends_at: string;
        }[]>`
          select id, title, starts_at, ends_at
          from public.system_maintenance_windows
          where status = 'scheduled'
            and enforce_heavy_ops = true
            and starts_at > timezone('utc', now())
          order by starts_at asc
          limit 1
        `;

        return NextResponse.json({
          ok: false,
          error: "VACUUM FULL só pode ser executado dentro de uma janela activa de manutenção.",
          next_window: nextWindow[0] ?? null,
        }, { status: 409 });
      }

      await sql.unsafe(`VACUUM FULL ${target}`);
      return NextResponse.json({
        ok: true,
        action,
        target,
        message: `VACUUM FULL executado em ${target}.`,
        note: "Operação intrusiva concluída. Reavalie a quota e valide o comportamento do sistema.",
        maintenance_window: maintenanceWindow[0],
      });
    }

    await sql.unsafe("VACUUM cron.job_run_details");
    await sql.unsafe("VACUUM public.audit_logs");
    return NextResponse.json({
      ok: true,
      action,
      message: "VACUUM executado em cron.job_run_details e public.audit_logs.",
      note: "VACUUM melhora saúde e reaproveitamento interno, mas pode não reduzir o tamanho físico imediatamente.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  } finally {
    await sql?.end({ timeout: 1 }).catch(() => null);
  }
}
