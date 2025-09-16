// apps/web/src/lib/supabaseServer.ts
import { cookies } from "next/headers"
import { createServerClient, type CookieOptions } from "@supabase/ssr"
import type { Database } from "@/types/supabase"

// Função que devolve uma instância do supabase configurada para o lado servidor
export async function supabaseServer() {
  const cookieStore = await cookies() // 👈 desde Next 13.4 o cookies() é assíncrono

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(_name: string, _value: string, _options: CookieOptions) {
          // no server a gente não precisa setar cookies manualmente
        },
        remove(_name: string, _options: CookieOptions) {
          // idem
        },
      },
    }
  )
}
