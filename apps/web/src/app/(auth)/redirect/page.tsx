// apps/web/src/app/auth/redirect/page.tsx
import { redirect } from "next/navigation"
import { supabaseServer } from "@/lib/supabaseServer"
import type { Database } from "@/types/supabase"

export default async function RedirectPage() {
  const supabase = await supabaseServer()

  // 1) usuário autenticado (seguro)
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    redirect("/login")
  }

  // 2) perfil no banco — TIPADO
  const { data: profile } = await supabase
    .from("profiles") // nome da tabela
    .select("role, escola_id")
    .eq("user_id", user.id)
    .maybeSingle<Database["public"]["Tables"]["profiles"]["Row"]>()

  // 3) valores normalizados (sem vermelho)
  const role: Database["public"]["Enums"]["user_role"] | "guest" = profile?.role ?? "guest"
  const escola_id: string | null = profile?.escola_id ?? null

  // 4) redirect por role
  switch (role) {
    case "super_admin":
      console.log("➡️ Redirecionando super_admin para /super-admin")
      redirect("/super-admin")
      break

    case "admin":
      if (escola_id) {
        console.log(`➡️ Redirecionando admin para /admin/escolas/${escola_id}`)
        redirect(`/admin/escolas/${escola_id}`)
      } else {
        redirect("/admin")
      }
      break

    case "professor":
      redirect("/professor")
      break

    case "aluno":
      redirect("/aluno")
      break

    case "secretaria":
      redirect("/secretaria")
      break

    case "financeiro":
      redirect("/financeiro")
      break

    default:
      redirect("/")
  }
} // ← COLCHETE DE FECHAMENTO ADICIONADO AQUI
