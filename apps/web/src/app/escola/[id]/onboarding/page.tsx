import { redirect } from "next/navigation"
import { supabaseServer } from "@/lib/supabaseServer"
import { resolveEscolaParam } from "@/lib/tenant/resolveEscolaParam"
import { shouldRouteToEscolaAdmin } from "@/lib/escola/onboardingGate"

export default async function OnboardingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const s = await supabaseServer()
  const resolved = await resolveEscolaParam(s as any, id)
  if (!resolved.escolaId) {
    redirect('/dashboard')
  }
  const escolaId = resolved.escolaId
  let escolaParam = resolved.slug ?? id

  // Se o onboarding já foi concluído, ou já existe ano letivo ativo, envia para o dashboard
  try {
    const [{ data: escolaRows }, shouldGoAdmin] = await Promise.all([
      s
        .from('escolas')
        .select('slug')
        .eq('id', escolaId)
        .limit(1),
      shouldRouteToEscolaAdmin(s as any, escolaId),
    ])
    escolaParam = escolaRows && escolaRows.length > 0 && escolaRows[0]?.slug
      ? String(escolaRows[0].slug)
      : escolaParam
    if (shouldGoAdmin) {
      redirect(`/escola/${escolaParam}/admin`)
    }
  } catch {}

  // Caso contrário, vai para a página de configurações acadêmicas (wizard)
  redirect(`/escola/${escolaParam}/configuracoes/onboarding`)
}
