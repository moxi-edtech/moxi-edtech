// types/aliases.ts
import type { Database } from "./supabase"

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"]
