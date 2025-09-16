"use client";

// lib/supabaseClient.ts
import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "@/types/supabase"

// usado no LoginPage ou qualquer coisa client-side
export const createClient = () =>
  createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
