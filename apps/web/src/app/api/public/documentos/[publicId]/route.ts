import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

function badRequest(msg: string) {
  return NextResponse.json({ ok: false, error: msg }, { status: 400 });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { publicId: string } }
) {
  const publicId = (params.publicId ?? "").trim();
  const hash = (req.nextUrl.searchParams.get("hash") ?? "").trim();

  if (!publicId) return badRequest("missing publicId");
  if (!hash) return badRequest("missing hash");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json(
      { ok: false, error: "server misconfigured" },
      { status: 500 }
    );
  }

  const supabase = createClient<Database>(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.rpc("public_get_documento_by_token", {
    p_public_id: publicId,
    p_hash: hash,
  });

  if (error) {
    // não vazar detalhes
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }

  // rpc retorna array (table function)
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, documento: row }, { status: 200 });
}

