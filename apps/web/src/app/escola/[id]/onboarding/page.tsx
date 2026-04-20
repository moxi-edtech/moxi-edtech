import { redirect } from "next/navigation"
import { supabaseServer } from "@/lib/supabaseServer"
import { resolveEscolaParam } from "@/lib/tenant/resolveEscolaParam"

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
    const [{ data: escolaData }, { data: anoAtivoRows }] = await Promise.all([
      s
        .from('escolas')
        .select('onboarding_finalizado, slug')
        .eq('id', escolaId)
        .maybeSingle(),
      s
        .from('anos_letivos')
        .select('id')
        .eq('escola_id', escolaId)
        .eq('ativo', true)
        .limit(1),
    ])
    const done = Boolean(escolaData?.onboarding_finalizado)
    const hasAnoLetivoAtivo = Array.isArray(anoAtivoRows) && anoAtivoRows.length > 0
    escolaParam = escolaData?.slug ? String(escolaData.slug) : escolaParam
    if (done || hasAnoLetivoAtivo) {
      redirect(`/escola/${escolaParam}/admin`)
    }
  } catch {}

  // Caso contrário, vai para a página de configurações acadêmicas (wizard)
  redirect(`/escola/${escolaParam}/configuracoes/onboarding`)
}
