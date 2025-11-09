import { createClient, SupabaseClient } from "@supabase/supabase-js"
// import { Database } from "~types/supabase" // descomente se usar tipagem

export function getSupabaseServerClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY
  if (!url || !key) return null
  // return createClient<Database>(url, key) // use genérica se tiver Database
  return createClient(url, key)
}