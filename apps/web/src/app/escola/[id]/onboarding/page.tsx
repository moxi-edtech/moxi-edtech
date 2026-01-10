import { redirect } from "next/navigation"
import { supabaseServer } from "@/lib/supabaseServer"

export default async function OnboardingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Se o onboarding já foi concluído, envia para o dashboard
  try {
    const s = await supabaseServer()
    const { data } = await s
      .from('escolas')
      .select('onboarding_finalizado')
      .eq('id', id)
      .limit(1)
    const e0 = (data?.[0] as any) || {}
    const done = Boolean(e0.onboarding_finalizado)
    if (done) {
      redirect(`/escola/${id}/admin`)
    }
  } catch {}

  // Caso contrário, vai para a página de configurações acadêmicas (wizard)
  redirect(`/escola/${id}/configuracoes/onboarding`)
}
