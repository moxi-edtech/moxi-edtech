import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const verbose = url.searchParams.get("verbose") === "1";

  const cookieStore = await cookies();
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          void name; void value; void options; // no-op for GET debug
        },
        remove(name: string, options: CookieOptions) {
          void name; void options; // no-op for GET debug
        },
      },
    }
  );

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  let profile: { role?: string | null; escola_id?: string | null } | null = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("role, escola_id")
      .eq("user_id", user.id)
      .maybeSingle();
    profile = data ?? null;
  }

  const cookieNames = cookieStore.getAll().map((c) => c.name);

  return NextResponse.json({
    ok: true,
    env: {
      hasUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      hasAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    },
    cookies: {
      names: cookieNames,
    },
    session: session
      ? {
          expires_at: session.expires_at,
          expires_in: session.expires_in,
        }
      : null,
    user: user
      ? {
          id: user.id,
          email: user.email,
          role: profile?.role ?? null,
          escola_id: profile?.escola_id ?? null,
        }
      : null,
    errors: {
      sessionError: sessionError?.message ?? null,
      userError: userError?.message ?? null,
    },
    ...(verbose
      ? {
          note: "Verbose mode enabled. Tokens are never returned by this endpoint.",
        }
      : {}),
  });
}

