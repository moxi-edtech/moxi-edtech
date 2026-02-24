import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/route-client";
import { applyKf2ListInvariants } from "@/lib/kf2";

export async function GET(req: Request) {
  const supa = await createRouteClient();
  const { data: userRes } = await supa.auth.getUser();
  const authUser = userRes?.user;
  if (!authUser) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  // Lista escolas às quais o usuário pertence
  const escolaIds: string[] = [];
  try {
    const { data: vincs } = await supa
      .from("escola_users")
      .select("escola_id")
      .eq("user_id", authUser.id);
    for (const v of vincs || []) {
      if (v && (v as any).escola_id) escolaIds.push(String((v as any).escola_id));
    }
  } catch {}
  if (escolaIds.length === 0) {
    // Fallback: tenta escola do perfil
    try {
      const { data: prof } = await supa
        .from("profiles")
        .select("current_escola_id, escola_id")
        .eq("user_id", authUser.id)
        .limit(1);
      const e = (prof?.[0] as any)?.current_escola_id || (prof?.[0] as any)?.escola_id || null;
      if (e) escolaIds.push(String(e));
    } catch {}
  }

  if (escolaIds.length === 0) return NextResponse.json({ items: [] });

  const url = new URL(req.url)
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 30), 1), 50)
  const cursor = url.searchParams.get('cursor')

  let query = supa
    .from("import_migrations")
    .select(
      `
        id,
        escola_id,
        file_name,
        status,
        total_rows,
        imported_rows,
        error_rows,
        processed_at,
        created_at
      `,
    )
    .in("escola_id", escolaIds);

  if (cursor) {
    const [cursorCreatedAt, cursorId] = cursor.split(',')
    if (cursorCreatedAt && cursorId) {
      query = query.or(
        `created_at.lt.${cursorCreatedAt},and(created_at.eq.${cursorCreatedAt},id.lt.${cursorId})`
      )
    }
  }

  query = applyKf2ListInvariants(query, {
    limit,
    order: [
      { column: 'created_at', ascending: false },
      { column: 'id', ascending: false },
    ],
  });

  const { data, error } = await query;


  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const items = data ?? [];
  const last = items[items.length - 1];
  const nextCursor = items.length === limit && last ? `${last.created_at},${last.id}` : null;
  return NextResponse.json({ items, next_cursor: nextCursor });
}
