import { supabaseServer } from "./supabaseServer"
import type { User } from "@supabase/supabase-js"
import type { Database } from "~types/supabase" 

export interface SessionUser {
  id: string
  email: string
  role: Database["public"]["Enums"]["user_role"] | "guest"
  escola_id: string | null
}

export async function getSession(): Promise<{ user: SessionUser } | null> {
  const supabase = await supabaseServer()
  const { data, error } = await supabase.auth.getSession()

  if (error) {
    console.error("Erro ao buscar sessão:", error.message)
    return null
  }

  const session = data.session
  if (!session) return null

  const user = session.user as User

  return {
    user: {
      id: user.id,
      email: user.email ?? "",
      role: (user.app_metadata as { role?: Database["public"]["Enums"]["user_role"] } | undefined)?.role ?? "guest",
      escola_id: (user.app_metadata as { escola_id?: string } | undefined)?.escola_id ?? null,
    },
  }
}
