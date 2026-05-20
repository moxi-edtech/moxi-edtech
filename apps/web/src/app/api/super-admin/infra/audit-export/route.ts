import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabaseServer";
import { isSuperAdminRole } from "@/lib/auth/requireSuperAdminAccess";
import { applyKf2ListInvariants } from "@/lib/kf2";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(req: Request) {
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

    const url = new URL(req.url);
    const format = (url.searchParams.get("format") || "csv").toLowerCase();
    const days = Number(url.searchParams.get("days") || 90);
    const portal = (url.searchParams.get("portal") || "").trim();

    const since = Number.isFinite(days) && days > 0
      ? new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
      : "1970-01-01T00:00:00.000Z";

    let query = s
      .from("audit_logs")
      .select("created_at, escola_id, portal, action, entity, entity_id, details")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5000);

    if (portal) {
      query = query.eq("portal", portal);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const logs = data ?? [];
    const ts = new Date().toISOString().replace(/[:.]/g, "-");

    if (format === "json") {
      const res = NextResponse.json(logs);
      res.headers.set("Content-Disposition", `attachment; filename=\"super_admin_audit_${ts}.json\"`);
      return res;
    }

    const csvEscape = (val: unknown) => {
      const s = typeof val === "string" ? val : JSON.stringify(val);
      if (s == null) return "";
      return `"${s.replace(/"/g, '""')}"`;
    };

    const header = ["created_at", "escola_id", "portal", "action", "entity", "entity_id", "details"];
    const csv = [
      header.map(csvEscape).join(","),
      ...logs.map((log: any) =>
        [
          log.created_at,
          log.escola_id,
          log.portal,
          log.action,
          log.entity,
          log.entity_id ?? "",
          JSON.stringify(log.details ?? {}),
        ].map(csvEscape).join(",")
      ),
    ].join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="super_admin_audit_${ts}.csv"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
