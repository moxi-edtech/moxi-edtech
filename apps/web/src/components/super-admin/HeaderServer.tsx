import LogoutButton from "@/components/auth/LogoutButton"
import BackButton from "@/components/navigation/BackButton"
import { supabaseServer } from "@/lib/supabaseServer"

type Props = {
  ctxEscolaId?: string | null
}

export default async function HeaderServer({ ctxEscolaId }: Props) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  let ctxEscola: { id: string; nome: string | null; plano: 'basico'|'standard'|'premium'|null } | null = null
  if (ctxEscolaId) {
    const { data } = await supabase
      .from('escolas')
      .select('nome, plano')
      .eq('id', ctxEscolaId)
      .maybeSingle()
    const plano = ((data as any)?.plano || null) as any
    ctxEscola = {
      id: ctxEscolaId,
      nome: (data as any)?.nome ?? null,
      plano: plano && ['basico','standard','premium'].includes(plano) ? plano : null
    }
  }

  return (
    <header className="h-14 bg-white shadow flex items-center justify-between px-6 sticky top-0 z-40">
      <div className="flex items-center space-x-4">
        <div className="hidden sm:block">
          <BackButton />
        </div>
        <h1 className="text-lg font-semibold text-gray-700">
          Portal do Super Admin
        </h1>
        {ctxEscola && (
          <>
            <span className="text-[10px] uppercase px-2 py-1 rounded-full bg-gray-100 border border-gray-200 text-gray-600">
              {ctxEscola.nome ? ctxEscola.nome : `Escola ${ctxEscola.id}`}
            </span>
            {ctxEscola.plano && (
              <span className="text-[10px] uppercase px-2 py-1 rounded-full bg-gray-100 border border-gray-200 text-gray-600">
                Plano: {ctxEscola.plano}
              </span>
            )}
            <a
              href={`/super-admin/escolas/${ctxEscola.id}/edit`}
              className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
              title="Editar escola"
            >
              Editar Escola
            </a>
          </>
        )}
        {process.env.NODE_ENV !== "production" && (
          <a
            href="/super-admin/debug"
            className="text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-200"
            title="Página de debug (apenas desenvolvimento)"
          >
            Debug
          </a>
        )}
        {user?.email && (
          <span className="text-sm text-gray-500 hidden md:block">
            ({user.email})
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <LogoutButton />
      </div>
    </header>
  )
}
