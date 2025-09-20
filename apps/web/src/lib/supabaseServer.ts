// apps/web/src/lib/supabaseServer.ts
import 'server-only'
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { Database } from "~types/supabase";

// Função que devolve uma instância do supabase configurada para o lado servidor
export async function supabaseServer() {
  const cookieStore = await cookies(); // Next 15: async cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          const secure = process.env.NODE_ENV === 'production';
          cookieStore.set(name, value, { ...options, secure });
        },
        remove(name: string, options: CookieOptions) {
          const secure = process.env.NODE_ENV === 'production';
          cookieStore.set(name, "", { ...options, maxAge: 0, secure });
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
          cookieStore.set(name, value, options);
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set(name, "", { ...options, maxAge: 0 });
        },
      },
    }
  );
}
