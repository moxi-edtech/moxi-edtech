// apps/web/src/lib/supabaseServer.ts
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { Database } from "~types/supabase";

// Função que devolve uma instância do supabase configurada para o lado servidor
export async function supabaseServer() {
  const cookieStore = await cookies(); // ✅ agora é ReadonlyRequestCookies

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          void name; void value; void options;
        },
        remove(name: string, options: CookieOptions) {
          void name; void options;
        },
      },
    }
  );
}

// Versão genérica para permitir augments temporários do Database (ex.: RPCs novos)
export async function supabaseServerTyped<TDatabase = Database>() {
  const cookieStore = await cookies();

  return createServerClient<TDatabase>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          void name; void value; void options;
        },
        remove(name: string, options: CookieOptions) {
          void name; void options;
        },
      },
    }
  );
}
