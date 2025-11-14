import { createClient, SupabaseClient } from "@supabase/supabase-js"

export function getSupabaseServerClient(): SupabaseClient | null {
  const url = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim()
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "").trim()
  if (!url || !key) return null
  return createClient(url, key)
}
