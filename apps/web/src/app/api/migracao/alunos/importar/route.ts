import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

import type { Database } from "~types/supabase";
import type { ImportResult } from "~types/migracao";

export const dynamic = "force-dynamic";

interface ImportBody {
  importId: string;
  escolaId: string;
}

export async function POST(request: Request) {
  const adminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!adminUrl || !serviceKey) {
    return NextResponse.json({ error: "SUPABASE configuration missing" }, { status: 500 });
  }

  let body: ImportBody;
  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { importId, escolaId } = body;
  if (!importId || !escolaId) {
    return NextResponse.json({ error: "importId e escolaId são obrigatórios" }, { status: 400 });
  }

  const supabase = createAdminClient<Database>(adminUrl, serviceKey);

  const { data, error } = await supabase.rpc("importar_alunos", {
    p_import_id: importId,
    p_escola_id: escolaId,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = (Array.isArray(data) && data.length ? data[0] : data) as ImportResult;

  await supabase
    .from("import_migrations")
    .update({ status: "imported", processed_at: new Date().toISOString() })
    .eq("id", importId);

  return NextResponse.json({ result });
}
