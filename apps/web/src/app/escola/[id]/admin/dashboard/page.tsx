import EscolaAdminDashboard from "@/components/layout/escola-admin/EscolaAdminDashboard";
import { supabaseServer } from "@/lib/supabaseServer";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const s = await supabaseServer()
  let escolaNome: string | undefined = undefined
  try {
    const { data } = await s.from('escolas').select('nome').eq('id', id).maybeSingle()
    escolaNome = (data as any)?.nome || undefined
  } catch {}

  return <EscolaAdminDashboard escolaId={id} escolaNome={escolaNome} />;
}
