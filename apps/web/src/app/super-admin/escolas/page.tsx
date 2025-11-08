import SchoolsTableClient from "@/components/super-admin/SchoolsTableClient";
import SidebarServer from "@/components/super-admin/SidebarServer";
import HeaderServer from "@/components/super-admin/HeaderServer";

export const dynamic = 'force-dynamic'

async function fetchInitial() {
  let initialSchools: any[] = []
  let initialProgress: Record<string, any> = {}
  let errorMsg: string | null = null
  let fallbackSource: string | null = null

  try {
    const res = await fetch('/api/super-admin/escolas/list', { cache: 'no-store' })
    const json = await res.json().catch(() => ({ ok: false }))
    if (json?.ok && Array.isArray(json.items)) {
      initialSchools = json.items
      fallbackSource = typeof json.fallback === 'string' ? String(json.fallback) : null
    } else {
      errorMsg = (json && typeof json === 'object' && 'error' in json) ? String((json as any).error) : 'Falha ao carregar a lista de escolas.'
    }
  } catch {
    errorMsg = 'Falha ao carregar a lista de escolas.'
  }

  try {
    const p = await fetch('/api/super-admin/escolas/onboarding/progress', { cache: 'no-store' })
      .then(r => r.json()).catch(() => ({ ok: false }))
    if (p?.ok && Array.isArray(p.items)) {
      const map: Record<string, any> = {}
      for (const it of p.items as any[]) map[it.escola_id] = it
      initialProgress = map
    }
  } catch {}

  // Normalize on the server to keep client payload small and stable
  type RawSchool = { id: string; nome: string | null; status: string | null; plano: string | null; last_access: string | null; total_alunos: number; total_professores: number; cidade: string | null; estado: string | null }
  const prettyPlan = (p?: string | null): string => {
    switch ((p || '').toLowerCase()) {
      case 'basico': return 'Básico'
      case 'standard': return 'Premium'
      case 'premium': return 'Enterprise'
      default: return (p as any) || 'Básico'
    }
  }
  const normalized = (initialSchools as RawSchool[]).map(d => ({
    id: String(d.id),
    name: d.nome ?? 'Sem nome',
    status: (d.status ?? 'ativa') as string,
    plan: prettyPlan(d.plano),
    lastAccess: d.last_access ?? null,
    students: Number(d.total_alunos ?? 0),
    teachers: Number(d.total_professores ?? 0),
    city: d.cidade ?? '',
    state: d.estado ?? '',
  }))

  return { normalized, initialProgress, errorMsg, fallbackSource }
}

export default async function Page() {
  const { normalized, initialProgress, errorMsg, fallbackSource } = await fetchInitial()
  return (
    <div className="flex h-screen bg-gray-100">
      <SidebarServer />
      <div className="flex-1 flex flex-col">
        <HeaderServer />
        <main className="p-6 overflow-y-auto">
          <SchoolsTableClient
            initialSchools={normalized as any}
            initialProgress={initialProgress}
            initialErrorMsg={errorMsg}
            fallbackSource={fallbackSource}
          />
        </main>
      </div>
    </div>
  );
}
