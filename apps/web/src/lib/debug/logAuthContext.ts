import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "~types/supabase";

export async function logAuthContext(tag: string) {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.warn("[AUTH_CTX] missing Supabase env vars", { tag });
    return;
  }

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set() {},
      remove() {},
    },
  });

  const { data, error } = await supabase.auth.getUser();

  console.log("[AUTH_CTX]", tag, {
    user_id: data.user?.id ?? null,
    error: error?.message ?? null,
  });
}
