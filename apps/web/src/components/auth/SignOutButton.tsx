'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabaseClient'
import { clsx } from 'clsx'
import { useState } from 'react'

type Props = {
  label?: string
  className?: string
  title?: string
  /** novo: rota para redirect pós-logout */
  redirectTo?: string
  /** novo: apenas para estilos básicos */
  variant?: 'ghost' | 'solid'
  size?: 'sm' | 'md' | 'lg'
}

export default function SignOutButton({
  label = 'Sair',
  className,
  title,
  redirectTo = '/login',
  variant = 'ghost',
  size = 'sm',
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  const base = 'inline-flex items-center justify-center rounded-md transition'
  const variants = {
    ghost: 'bg-transparent text-slate-600 hover:text-slate-900',
    solid: 'bg-slate-800 text-white hover:bg-slate-900',
  }
  const sizes = {
    sm: 'px-2 py-1 text-sm',
    md: 'px-3 py-2 text-base',
    lg: 'px-4 py-2 text-lg',
  }

  async function handleLogout() {
    try {
      setLoading(true)
      await supabase.auth.signOut()
      router.replace(redirectTo)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      title={title}
      onClick={handleLogout}
      disabled={loading}
      className={clsx(base, variants[variant], sizes[size], className)}
    >
      {label}
    </button>
  )
}