"use client"

import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabaseClient"
import { clearOfflineData } from "@/lib/offline/store"

export default function LogoutButton() {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    try {
      // Clear Service Worker Data Cache
      if (typeof window !== 'undefined' && 'serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_DATA_CACHE' })
      }

      // Clear IndexedDB Offline Data with a 1s timeout to prevent database locks from blocking logout
      try {
        await Promise.race([
          clearOfflineData(),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout clearing IndexedDB")), 1000))
        ])
      } catch (err) {
        console.error('Non-blocking clearOfflineData finished or failed:', err)
      }

      await supabase.auth.signOut()
      router.push("/redirect")
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

