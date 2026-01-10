import { supabaseServer } from "@/lib/supabaseServer";

export default async function CredenciaisPage() {
  const s = await supabaseServer();
  const { data: userRes } = await s.auth.getUser();
  const user = userRes?.user;
  if (!user) {
    return (
      <main className="max-w-xl mx-auto p-6">
        <div className="p-4 bg-amber-50 border border-amber-200 rounded text-amber-800 text-sm">Faça login para ver suas credenciais.</div>
      </main>
    );
  }

  const { data: profile } = await s
    .from('profiles')
    .select('email, nome, numero_login, escola_id')
    .eq('user_id', user.id)
    .maybeSingle();
  const email = (profile as any)?.email ?? user.email ?? null;
  const nome = (profile as any)?.nome ?? null;
  const numero = (profile as any)?.numero_login ?? null;
  const escolaId = (profile as any)?.escola_id ?? null;
  let escolaNome: string | null = null;
  if (escolaId) {
    try {
      const res = await fetch(`/api/escolas/${escolaId}/nome`, { cache: 'force-cache' })
      const json = await res.json().catch(() => null)
      escolaNome = res.ok && json?.ok ? (json?.nome ?? null) : null
    } catch {
      escolaNome = null
    }
  }

  return (
    <main className="max-w-xl mx-auto p-6">
      <h1 className="text-xl font-semibold mb-4">Minhas credenciais</h1>
      <div className="bg-white rounded-xl shadow border p-5 space-y-3">
        <div className="text-sm text-gray-600">Nome</div>
        <div className="text-gray-800">{nome ?? '—'}</div>
        <div className="h-px bg-gray-100 my-2" />
        <div className="text-sm text-gray-600">E-mail</div>
        <div className="text-gray-800">{email ?? '—'}</div>
        <div className="h-px bg-gray-100 my-2" />
        <div className="text-sm text-gray-600">Número de login</div>
        <div className="flex items-center justify-between">
          <div className="text-gray-800">{numero ?? '—'}</div>
          {numero && (
            <form action="#" onSubmit={(e)=>e.preventDefault()}>
              <button className="px-2 py-1 border rounded text-xs" onClick={() => navigator.clipboard.writeText(String(numero))}>Copiar</button>
            </form>
          )}
        </div>
        <div className="h-px bg-gray-100 my-2" />
        <div className="text-sm text-gray-600">Escola</div>
        <div className="text-gray-800">{escolaNome ?? escolaId ?? '—'}</div>
      </div>
      <p className="text-xs text-gray-500 mt-3">Use seu e-mail ou número de login na tela de acesso.</p>
    </main>
  );
}
