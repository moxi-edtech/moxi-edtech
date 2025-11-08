"use client"

import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabaseClient"

export default function LogoutButton() {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      router.push("/login")
      router.refresh()
    } catch (error) {
      // no-op
    }
  }

  return (
    <button
      onClick={handleLogout}
      className="text-sm px-2 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
    >
      Sair
    </button>
  )
}

