// @kf2 allow-scan
import { kf2Range } from "@/lib/db/kf2";
import { createRouteClient } from "@/lib/supabase/route-client";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// Lista alunos (portal secretaria)
// Agora trazendo numero_login via relacionamento alunos -> profiles
export async function GET(req: Request) {
  try {
    const supabase = await createRouteClient();
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes.user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }
    const user = userRes.user;

    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Usuário não vinculado a nenhuma escola" }, { status: 403 });
    }

    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim() || null;
    const status = (url.searchParams.get("status") || "ativo").toLowerCase();
    const anoParamRaw = url.searchParams.get("ano") || url.searchParams.get("ano_letivo");
    const anoParam = anoParamRaw ? Number(anoParamRaw) : null;
    const targetAno = Number.isFinite(anoParam) ? (anoParam as number) : null;

    const limitParam = url.searchParams.get("limit") ?? url.searchParams.get("pageSize");
    const pageParam = url.searchParams.get("page");
    const offsetParam = url.searchParams.get("offset");
    const cursorCreatedAt = url.searchParams.get("cursor_created_at");
    const cursorId = url.searchParams.get("cursor_id");
    const hasCursor = Boolean(cursorCreatedAt && cursorId);
    const derivedOffset = pageParam && limitParam ? (Number(pageParam) - 1) * Number(limitParam) : undefined;
    const { limit, from } = kf2Range(
      limitParam ? Number(limitParam) : undefined,
      hasCursor ? 0 : offsetParam ? Number(offsetParam) : derivedOffset
    );

    const { data, error } = await supabase.rpc("secretaria_list_alunos_kf2", {
      p_escola_id: escolaId,
      p_status: status,
      p_q: q ?? undefined,
      p_ano_letivo: targetAno ?? undefined,
      p_limit: limit,
      p_offset: from,
      p_cursor_created_at: cursorCreatedAt ?? undefined,
      p_cursor_id: cursorId ?? undefined,
    });

    if (error) throw error;

    const items = (data ?? []).map((row: any) => ({
      ...row,
      bilhete: row?.bi_numero ?? null,
    }));

    const hasMore = items.length === limit;
    const lastItem = hasMore ? items[items.length - 1] : null;
    const nextCursor = lastItem
      ? { created_at: lastItem.created_at, id: lastItem.id }
      : null;
    const nextOffset = hasMore ? from + items.length : null;

    return NextResponse.json({
      ok: true,
      data: items,
      items,
      total: items.length,
      page: {
        limit,
        offset: from,
        nextOffset,
        hasMore,
        total: items.length,
        nextCursor,
      },
    });
  } catch (e: any) {
    console.error("[alunos list error]", e);
    return NextResponse.json({ ok: false, error: e.message || "Erro desconhecido" }, { status: 500 });
  }
}
