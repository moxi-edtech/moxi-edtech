import { NextResponse } from "next/server";

import { createRouteClient } from "@/lib/supabase/route-client";

export async function GET() {
  const supabase = await createRouteClient();

  const { data, error } = await supabase
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
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}
