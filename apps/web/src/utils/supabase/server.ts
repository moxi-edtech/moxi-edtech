import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
// import type { ReadonlyRequestCookies } from 'next/headers' // Removed

export async function createClient() { // Make function async
  const cookieStore = await cookies() // Await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // O 'setAll' foi chamado de um Server Component.
            // Isso pode ser ignorado se você tiver middleware.
          }
        },
      },
    }
  )
}
