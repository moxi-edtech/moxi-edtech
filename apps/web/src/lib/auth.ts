import { supabaseServer } from "./supabaseServer"
import type { Papel } from "@/lib/permissions"

export interface SessionUser {
  id: string
  email: string
  role: string
  escola_id: string | null
}

export async function getSession(): Promise<{ user: SessionUser } | null> {
  try {
    const supabase = await supabaseServer()
    
    // USA getUser() EM VEZ DE getSession() - MAIS SEGURO
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      console.error("Erro ao buscar usuário:", error?.message)
      return null
    }

    // BUSCA O ROLE DA TABELA PROFILES
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, escola_id')
      .eq('user_id', user.id)
      .single()

    if (profileError) {
      console.warn("Perfil não encontrado para user:", user.id)
      return {
        user: {
          id: user.id,
          email: user.email || "",
          role: "guest",
          escola_id: null,
        }
      }
    }

    // ✅ CORREÇÃO: Optional chaining e fallbacks
    return {
      user: {
        id: user.id,
        email: user.email || "",
        role: profile?.role || "guest", // ✅ Optional chaining
        escola_id: profile?.escola_id || null, // ✅ Optional chaining
      }
    }
  } catch (error) {
    console.error('Erro em getSession:', error)
    return null
  }
}

// Retorna o papel do usuário logado para uma escola específica
export async function getPapelForEscola(escolaId: string): Promise<Papel | null> {
  try {
    if (!escolaId) return null
    const s = await supabaseServer()

    const { data: { user }, error: userErr } = await s.auth.getUser()
    if (userErr || !user) return null

    const { data, error } = await s
      .from('escola_users')
      .select('papel')
      .eq('user_id', user.id)
      .eq('escola_id', escolaId)
      .limit(1)

    if (error) {
      console.error('Erro ao buscar papel na escola:', error.message)
      return null
    }

    const papel = (data?.[0] as any)?.papel as Papel | undefined
    return papel ?? null
  } catch (e) {
    console.error('getPapelForEscola failed:', e)
    return null
  }
}
