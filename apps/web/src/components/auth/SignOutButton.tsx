"use client"

import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabaseClient"

export default function SignOutButton({
  label = "Sair",
  className = "px-3 py-2 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors",
  title = "Sair",
}: {
  label?: string
  className?: string
  title?: string
}) {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      router.push("/login")
      router.refresh()
    } catch (err) {
      console.error("Erro ao fazer logout:", err)
    }
  }

  return (
    <button onClick={handleLogout} className={className} title={title}>
      {label}
    </button>
  )
}

