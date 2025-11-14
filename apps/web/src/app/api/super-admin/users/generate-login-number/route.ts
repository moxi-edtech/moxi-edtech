import { NextResponse } from "next/server";
import { generateNumeroLogin } from "@/lib/generateNumeroLogin";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

export async function GET(req: Request) {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Server misconfigured: missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY.",
      },
      { status: 500 }
    );
  }

  const admin = createClient<Database>(supabaseUrl, serviceRoleKey);

  const { searchParams } = new URL(req.url);
  const escolaId = searchParams.get("escolaId");
  const role = searchParams.get("role");

  if (!escolaId || !role) {
    return NextResponse.json(
      { ok: false, error: "Missing escolaId or role" },
      { status: 400 }
    );
  }

  const userRole = role as Database["public"]["Enums"]["user_role"];

  const numeroLogin = await generateNumeroLogin(escolaId, userRole, admin);

  return NextResponse.json({ ok: true, numeroLogin });
}
