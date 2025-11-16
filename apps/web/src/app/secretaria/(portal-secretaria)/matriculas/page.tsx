import { supabaseServer } from "@/lib/supabaseServer";
import AuditPageView from "@/components/audit/AuditPageView";
import MatriculasListClient from "@/components/secretaria/MatriculasListClient";

export const dynamic = 'force-dynamic'

type SearchParams = { q?: string; days?: string }

export default async function Page(props: { searchParams?: Promise<SearchParams> }) {
  const searchParams = (await props.searchParams) ?? ({} as SearchParams)
  const s = await supabaseServer()
  const { data: sess } = await s.auth.getUser()
  const user = sess?.user
  let escolaId: string | null = null
  if (user) {
    const { data: prof } = await s
      .from('profiles')
      .select('escola_id')
      .eq('user_id', user.id)
      .maybeSingle()
    escolaId = (prof as any)?.escola_id ?? null
  }

  if (!escolaId) {
    return (
      <>
        <AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="matriculas_list" />
          Vincule seu perfil a uma escola para ver matrículas.
      </>
    )
  }

  return (
    <>
      <AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="matriculas_list" />
      <MatriculasListClient />
    </>
  )
}
