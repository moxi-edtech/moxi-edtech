import { NextResponse } from "next/server";

import { createRouteClient } from "@/lib/supabase/route-client";

export async function GET(_req: Request, { params }: { params: { importId: string } }) {
  const supabase = await createRouteClient();

  const { data, error } = await supabase
    .from("import_errors")
    .select("row_number, column_name, message, raw_value")
    .eq("import_id", params.importId)
    .order("row_number", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ errors: data ?? [] });
}
