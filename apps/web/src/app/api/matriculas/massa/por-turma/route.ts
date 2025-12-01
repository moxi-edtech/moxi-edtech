import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

export async function POST(request: NextRequest) {
  const adminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!adminUrl || !serviceKey) {
    return NextResponse.json({ error: "SUPABASE configuration missing" }, { status: 500 });
  }
  let body: { import_id?: string; escola_id?: string; turma_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const { import_id, escola_id, turma_id } = body || {};
  if (!import_id || !escola_id || !turma_id) {
    return NextResponse.json({ error: "import_id, escola_id e turma_id são obrigatórios" }, { status: 400 });
  }
  const supabase = createAdminClient<Database>(adminUrl, serviceKey);
  const { data, error } = await (supabase as any).rpc("matricular_em_massa_por_turma", {
    p_import_id: import_id,
    p_escola_id: escola_id,
    p_turma_id: turma_id,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const row = Array.isArray(data) && data.length ? data[0] : data;
  return NextResponse.json({
    ok: true,
    success_count: row?.success_count ?? 0,
    error_count: row?.error_count ?? 0,
    errors: row?.errors ?? [],
  });
}

