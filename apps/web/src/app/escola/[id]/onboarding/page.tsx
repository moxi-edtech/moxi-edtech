import { redirect } from "next/navigation"
import { supabaseServer } from "@/lib/supabaseServer"

export default async function OnboardingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let escolaParam = id

  // Se o onboarding já foi concluído, envia para o dashboard
  try {
    const s = await supabaseServer()
    const { data } = await s
      .from('escolas')
      .select('onboarding_finalizado, slug')
      .eq('id', id)
      .limit(1)
    const e0 = (data?.[0] as any) || {}
    const done = Boolean(e0.onboarding_finalizado)
    escolaParam = e0.slug ? String(e0.slug) : id
    if (done) {
      redirect(`/escola/${escolaParam}/admin`)
    }
  } catch {}

  // Caso contrário, vai para a página de configurações acadêmicas (wizard)
  redirect(`/escola/${escolaParam}/configuracoes/onboarding`)
}
