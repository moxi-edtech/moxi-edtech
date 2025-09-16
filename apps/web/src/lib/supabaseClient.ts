"use client";

// lib/supabaseClient.ts
import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "~types/supabase"

// usado no LoginPage ou qualquer coisa client-side
export const createClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error("Supabase URL/Anon key ausentes. Verifique variáveis de ambiente NEXT_PUBLIC_*.")
  }
  return createBrowserClient<Database>(url, key)
}
