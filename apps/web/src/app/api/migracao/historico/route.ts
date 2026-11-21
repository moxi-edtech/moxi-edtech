import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/route-client";
import { applyKf2ListInvariants } from "@/lib/kf2";
import {
  parseImportHistoryCursor,
  parseImportHistoryLimit,
  resolveAuthorizedImportSchool,
} from "../import-school-context";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const supabase = await createRouteClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const scope = await resolveAuthorizedImportSchool(supabase as any, req, auth.user.id);
  if (scope.error) return scope.error;
  const escolaId = scope.escolaId;

  const params = new URL(req.url).searchParams;
  const limit = parseImportHistoryLimit(params.get("limit"));
  const cursor = parseImportHistoryCursor(params.get("cursor"));
  if (limit === null || cursor === "invalid") {
    return NextResponse.json({ error: "Paginação inválida." }, { status: 400 });
  }

  // Never use .in("escola_id", membershipIds): an authorized user can belong to
  // several schools, but this operational screen is scoped to exactly one.
  let query = supabase
    .from("import_migrations")
    .select("id,escola_id,file_name,status,total_rows,imported_rows,error_rows,processed_at,created_at")
    .eq("escola_id", escolaId);

  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`
    );
  }

  // Fetch one sentinel row for an accurate has-more decision. Kf2 retains
  // stable ordering and bounds the request (maximum 51 rows).
  query = applyKf2ListInvariants(query, {
    limit: limit + 1,
    maxLimit: 51,
    order: [
      { column: "created_at", ascending: false },
      { column: "id", ascending: false },
    ],
  });

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Não foi possível carregar importações." }, { status: 500 });

  const fetched = data ?? [];
  const items = fetched.slice(0, limit);
  const last = items[items.length - 1];
  return NextResponse.json({
    items,
    next_cursor: fetched.length > limit && last ? `${last.created_at},${last.id}` : null,
  });
}
