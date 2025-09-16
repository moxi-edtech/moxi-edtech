import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { Database } from "~types/supabase";

export async function POST(req: Request) {
  // Response container to accumulate Set-Cookie from Supabase
  const res = new NextResponse(null);
  const { email, password } = await req.json();

  const cookieStore = await cookies();
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Read specific cookie values using Next's cookies() helper
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          res.cookies.set(name, value, options);
        },
        remove(name: string, options: CookieOptions) {
          res.cookies.set(name, "", { ...options, maxAge: 0 });
        },
      },
    }
  );

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
  }

  // Important: propagate Set-Cookie headers set on `res` into the JSON response
  const json = NextResponse.json({ ok: true, user: data.user });
  res.headers.forEach((value, key) => {
    json.headers.set(key, value);
  });
  return json;
}
