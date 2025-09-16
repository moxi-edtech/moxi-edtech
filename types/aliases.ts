// src/types/aliases.ts (ou direto no arquivo)
import type { Database } from "~types/supabase"
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"]
export type UserRole = Database["public"]["Enums"]["user_role"]
