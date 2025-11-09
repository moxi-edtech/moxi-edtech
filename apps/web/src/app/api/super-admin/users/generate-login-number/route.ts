import { NextResponse } from "next/server";
import { generateNumeroLogin } from "@/lib/generateNumeroLogin";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

// Creates a supabase client with service role for admin operations (server-only)
const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const escolaId = searchParams.get("escolaId");
    const role = searchParams.get("role");

    if (!escolaId || !role) {
      return NextResponse.json(
        { ok: false, error: "Missing escolaId or role" },
        { status: 400 }
      );
    }

    // Cast role to the correct type, assuming it's a valid user_role enum value
    const userRole = role as Database["public"]["Enums"]["user_role"];

    const numeroLogin = await generateNumeroLogin(escolaId, userRole, admin);

    return NextResponse.json({ ok: true, numeroLogin });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
