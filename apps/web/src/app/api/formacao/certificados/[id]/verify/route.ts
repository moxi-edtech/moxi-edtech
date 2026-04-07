import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

function badRequest(msg: string) {
  return NextResponse.json({ ok: false, error: msg }, { status: 400 });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const publicId = (params.id ?? "").trim();
  const hash = (req.nextUrl.searchParams.get("hash") ?? "").trim();

  if (!publicId) return badRequest("missing certificado id");
  if (!hash) return badRequest("missing hash");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ ok: false, error: "server misconfigured" }, { status: 500 });
  }

  const supabase = createClient<Database>(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.rpc("public_get_documento_by_token", {
    p_public_id: publicId,
    p_hash: hash,
  });

  if (error) {
    return NextResponse.json({ ok: false, valid: false, error: "not found" }, { status: 404 });
  }

  const row = Array.isArray(data) ? data[0] : null;
  if (!row || row.tipo !== "certificado") {
    return NextResponse.json({ ok: false, valid: false, error: "not found" }, { status: 404 });
  }

  return NextResponse.json(
    {
      ok: true,
      valid: true,
      tipo: row.tipo,
      emitted_at: row.emitted_at ?? null,
      payload: row.payload ?? {},
    },
    { status: 200 }
  );
}
