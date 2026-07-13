import { NextRequest, NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/route-client";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { requireRoleInSchool } from "@/lib/authz";
import { ACTIVITY_FEED_ALLOWED_FAMILIES, parseActivityFeedFamilies, type ActivityFeedItem } from "@/lib/admin/activityFeed";
import { K12_OPERACOES_ROLE_GROUP } from "@/lib/roles";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const DEFAULT_FAMILIES = ACTIVITY_FEED_ALLOWED_FAMILIES;

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}

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
      return jsonNoStore({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const resolvedEscolaId = await resolveEscolaIdForUser(supabase as any, user.id, requestedEscolaId);
    if (!resolvedEscolaId) {
      return jsonNoStore({ ok: false, error: "Sem permissão" }, { status: 403 });
    }

    const roleCheck = await requireRoleInSchool({
      supabase: supabase as any,
      escolaId: resolvedEscolaId,
      roles: [...K12_OPERACOES_ROLE_GROUP],
    });

    if (roleCheck.error) return roleCheck.error;

    const { searchParams } = request.nextUrl;
    const limit = parseLimit(searchParams.get("limit"));
    const familiesResult = parseActivityFeedFamilies(searchParams.get("families"), DEFAULT_FAMILIES);
    if (familiesResult.error) {
      return jsonNoStore({ ok: false, error: familiesResult.error }, { status: 400 });
    }
    const families = familiesResult.families;
    const cursor = decodeCursor(searchParams.get("cursor"));

    let query = (supabase as any)
      .from("vw_admin_activity_feed_enriched")
      .select(
        "id, escola_id, occurred_at, event_family, event_type, actor_name, headline, subline, amount_kz, turma_nome, aluno_nome, payload"
      )
      .eq("escola_id", resolvedEscolaId)
      .in("event_family", families)
      .order("occurred_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit + 1);

    if (cursor) {
      query = query.or(
        `occurred_at.lt.${cursor.occurredAt},and(occurred_at.eq.${cursor.occurredAt},id.lt.${cursor.id})`
      );
    }

    const { data, error } = await query;
    if (error) {
      console.error("[operacoes/activity-feed] query failed", error);
      return jsonNoStore({ ok: false, error: "Falha ao carregar feed operacional" }, { status: 500 });
    }

    const rows = (data ?? []) as ActivityFeedItem[];
    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    const nextCursor = hasNextPage ? encodeCursor(items[items.length - 1]) : null;

    return jsonNoStore({
      ok: true,
      items,
      nextCursor,
      serverNow: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[operacoes/activity-feed] unexpected failure", error);
    return jsonNoStore({ ok: false, error: "Erro inesperado" }, { status: 500 });
  }
}
