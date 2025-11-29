import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";
import ConfiguracoesClient from "./ConfiguracoesClient";

export const dynamic = 'force-dynamic'

type Props = {
  params: { id: string };
};

export default async function ConfiguracoesPageGuard({ params }: Props) {
  const { id: escolaId } = params;

  try {
    const s = await supabaseServer();
    const { data } = await s
      .from("escolas")
      .select("onboarding_finalizado")
      .eq("id", escolaId)
      .maybeSingle();

    // Se o onboarding não estiver finalizado, redireciona para o wizard
    if (!(data as any)?.onboarding_finalizado) {
      redirect(`/escola/${escolaId}/configuracoes/onboarding`);
    }
  } catch (error) {
    // Em caso de erro ao verificar, assume que o onboarding não foi feito e redireciona
    console.error("Falha ao verificar status de onboarding:", error);
    redirect(`/escola/${escolaId}/configuracoes/onboarding`);
  }

  // Se o onboarding estiver completo, renderiza a página de configurações completa
  return <ConfiguracoesClient />;
}
