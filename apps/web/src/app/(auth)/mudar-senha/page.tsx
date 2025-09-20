'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabaseClient'
import { recordAuditClient } from '@/lib/auditClient'

export default function Page() {
  const supabase = createClient()
  const router = useRouter()
  const [email, setEmail] = useState<string>('')
  const [current, setCurrent] = useState('')
  const [nextPwd, setNextPwd] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [ok, setOk] = useState<string>('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user
      if (!user) {
        router.replace('/login')
        return
      }
      setEmail(user.email || '')
    })
  }, [supabase, router])

  const passwordRules = (pwd: string) => ([
    { ok: pwd.length >= 8, msg: 'Pelo menos 8 caracteres' },
    { ok: /[A-Z]/.test(pwd), msg: '1 letra maiúscula' },
    { ok: /[a-z]/.test(pwd), msg: '1 letra minúscula' },
    { ok: /\d/.test(pwd), msg: '1 número' },
    { ok: /[^A-Za-z0-9]/.test(pwd), msg: '1 caractere especial' },
  ])

  const strengthInfo = (pwd: string) => {
    const rules = passwordRules(pwd)
    const score = rules.filter(r => r.ok).length // 0..5
    let label = 'Muito fraca'
    let color = 'bg-red-500'
    if (score === 2) { label = 'Fraca'; color = 'bg-amber-500' }
    if (score === 3) { label = 'Média'; color = 'bg-yellow-500' }
    if (score === 4) { label = 'Forte'; color = 'bg-green-600' }
    if (score >= 5) { label = 'Excelente'; color = 'bg-moxinexa-teal' }
    return { score, label, color, rules }
  }

  const validatePassword = (pwd: string) => {
    const fail = passwordRules(pwd).find(r => !r.ok)
    return fail?.msg || null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setOk('')

    const complexity = validatePassword(nextPwd)
    if (complexity) { setError(complexity); return }
    if (nextPwd !== confirm) {
      setError('Confirmação não confere.')
      return
    }

    try {
      setLoading(true)
      // Verifica senha atual reautenticando
      const { error: signinErr } = await supabase.auth.signInWithPassword({ email, password: current })
      if (signinErr) {
        setError('Senha atual incorreta.')
        return
      }

      const { error: updErr } = await supabase.auth.updateUser({ password: nextPwd, data: { must_change_password: false } })
      if (updErr) {
        setError(updErr.message)
        return
      }

      setOk('Senha alterada com sucesso.')
      // Auditoria (client): senha alterada
      recordAuditClient({ portal: 'outro', action: 'SENHA_ALTERADA', entity: 'usuario' }).catch(() => null)
      setTimeout(() => router.replace('/redirect'), 800)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-teal-500 to-sky-600 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-moxinexa-dark">Definir nova senha</h1>
          <p className="text-sm text-gray-600 mt-1">Por favor, altere sua senha temporária.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">E-mail</label>
            <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 bg-slate-50" value={email} disabled />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Senha atual</label>
            <input type="password" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" value={current} onChange={(e)=>setCurrent(e.target.value)} required />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Nova senha</label>
            <input type="password" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" value={nextPwd} onChange={(e)=>setNextPwd(e.target.value)} required />
            {/* Indicador de força da senha */}
            {nextPwd && (
              <PasswordStrength pwd={nextPwd} />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Confirmar nova senha</label>
            <input type="password" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" value={confirm} onChange={(e)=>setConfirm(e.target.value)} required />
          </div>

          {error && <p className="text-center text-sm text-red-500 font-medium">{error}</p>}
          {ok && <p className="text-center text-sm text-green-600 font-medium">{ok}</p>}

          <button type="submit" disabled={loading} className="w-full bg-moxinexa-teal hover:bg-moxinexa-teal-dark text-white py-2 rounded-lg font-semibold disabled:opacity-50">
            {loading ? 'Salvando...' : 'Salvar nova senha'}
          </button>
        </form>
      </div>
    </main>
  )
}

function PasswordStrength({ pwd }: { pwd: string }) {
  const { score, label, color, rules } = useMemo(() => {
    const rules = ([
      { ok: pwd.length >= 8, msg: 'Pelo menos 8 caracteres' },
      { ok: /[A-Z]/.test(pwd), msg: '1 letra maiúscula' },
      { ok: /[a-z]/.test(pwd), msg: '1 letra minúscula' },
      { ok: /\d/.test(pwd), msg: '1 número' },
      { ok: /[^A-Za-z0-9]/.test(pwd), msg: '1 caractere especial' },
    ])
    const score = rules.filter(r => r.ok).length
    let label = 'Muito fraca'
    let color = 'bg-red-500'
    if (score === 2) { label = 'Fraca'; color = 'bg-amber-500' }
    if (score === 3) { label = 'Média'; color = 'bg-yellow-500' }
    if (score === 4) { label = 'Forte'; color = 'bg-green-600' }
    if (score >= 5) { label = 'Excelente'; color = 'bg-moxinexa-teal' }
    return { score, label, color, rules }
  }, [pwd])

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-gray-600">Força da senha:</span>
        <span className="font-medium text-gray-800">{label}</span>
      </div>
      <div className="flex gap-1" aria-hidden>
        {[0,1,2,3,4].map((i) => (
          <div key={i} className={`h-1.5 flex-1 rounded ${i < score ? color : 'bg-gray-200'}`}></div>
        ))}
      </div>
      <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
        {rules.map((r, idx) => (
          <li key={idx} className={r.ok ? 'text-green-600' : 'text-gray-500'}>
            {r.ok ? '✓' : '•'} {r.msg}
          </li>
        ))}
      </ul>
    </div>
  )
}
