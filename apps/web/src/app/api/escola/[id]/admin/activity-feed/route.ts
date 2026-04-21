import { NextRequest, NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/route-client";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { requireRoleInSchool } from "@/lib/authz";
import type { ActivityFeedItem } from "@/lib/admin/activityFeed";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function parseLimit(raw: string | null): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

function decodeCursor(cursor: string | null): { occurredAt: string; id: string } | null {
  if (!cursor) return null;

  try {
    const plain = Buffer.from(cursor, "base64").toString("utf8");
    const [occurredAt, id] = plain.split("|");
    if (!occurredAt || !id) return null;
    return { occurredAt, id };
  } catch {
    return null;
  }
}

function encodeCursor(item: Pick<ActivityFeedItem, "occurred_at" | "id">): string {
  return Buffer.from(`${item.occurred_at}|${item.id}`).toString("base64");
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: requestedEscolaId } = await context.params;

  try {
    const supabase = await createRouteClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;

    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const resolvedEscolaId = await resolveEscolaIdForUser(supabase as any, user.id, requestedEscolaId);
    // `requestedEscolaId` may be a slug (e.g. "escola-klasse") while `escolaId` is normalized UUID.
    // Permission is already enforced by resolveEscolaIdForUser, so only null should be denied.
    if (!resolvedEscolaId) {
      return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });
    }

    const roleCheck = await requireRoleInSchool({
      supabase: supabase as any,
      escolaId: resolvedEscolaId,
      roles: ["admin_escola", "admin", "staff_admin", "secretaria"],
    });

    if (roleCheck.error) return roleCheck.error;

    const { searchParams } = request.nextUrl;
    const limit = parseLimit(searchParams.get("limit"));
    const familiesRaw = searchParams.get("families");
    const families = familiesRaw
      ? familiesRaw
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean)
      : [];
    const cursor = decodeCursor(searchParams.get("cursor"));

    let query = (supabase as any)
      .from("vw_admin_activity_feed_enriched")
      .select(
        "id, escola_id, occurred_at, event_family, event_type, actor_name, headline, subline, amount_kz, turma_nome, aluno_nome, payload"
      )
      .eq("escola_id", resolvedEscolaId)
      .order("occurred_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit + 1);

    if (families.length > 0) {
      query = query.in("event_family", families);
    }

    if (cursor) {
      query = query.or(
        `occurred_at.lt.${cursor.occurredAt},and(occurred_at.eq.${cursor.occurredAt},id.lt.${cursor.id})`
      );
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const rows = (data ?? []) as ActivityFeedItem[];
    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    const nextCursor = hasNextPage ? encodeCursor(items[items.length - 1]) : null;

    return NextResponse.json({
      ok: true,
      items,
      nextCursor,
      serverNow: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
