// apps/web/src/lib/supabase/client.ts
"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();

let browserClient: SupabaseClient<Database> | null = null;

export function createClient() {
  if (!url || !anonKey) {
    throw new Error(
      "[Supabase] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY ausentes no ambiente."
    );
  }

  if (browserClient) return browserClient;

  browserClient = createBrowserClient<Database>(url, anonKey);
  return browserClient;
}
