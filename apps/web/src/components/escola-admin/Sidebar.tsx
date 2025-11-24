import SidebarContainer from "@/components/layout/shared/SidebarContainer";
import { SidebarHeader } from "@/components/layout/shared/SidebarHeader";
import { SidebarNav, type NavItem } from "@/components/layout/shared/SidebarNav";
import { SidebarFooter } from "@/components/layout/shared/SidebarFooter";
// Icon components are selected client-side in SidebarNav by name.
import { supabaseServer } from "@/lib/supabaseServer";

export default async function EscolaAdminSidebar({ escolaId }: { escolaId: string }) {
  const s = await supabaseServer();
  const setup = await s
    .from("escolas")
    .select("onboarding_finalizado")
    .eq("id", escolaId)
    .maybeSingle();
  const needsSetup = !setup.data?.onboarding_finalizado;

  const items: NavItem[] = [
    { label: "Dashboard", href: `/escola/${escolaId}/admin`, icon: "AcademicCapIcon" },
    { label: "Alunos", href: `/escola/${escolaId}/admin/alunos`, icon: "UsersIcon" },
    { label: "Professores", href: `/escola/${escolaId}/admin/professores`, icon: "UsersIcon" },
    { label: "Turmas", href: `/escola/${escolaId}/admin/turmas`, icon: "UserGroupIcon" },
    { label: "Avisos", href: `/escola/${escolaId}/admin/avisos`, icon: "MegaphoneIcon" },
    {
      label: "Configurações",
      href: `/escola/${escolaId}/admin/configuracoes`,
      icon: "Cog6ToothIcon",
      badge: needsSetup ? "Pendente" : undefined,
    },
  ];

  return (
    <SidebarContainer storageKey={`escola-admin:sidebar:${escolaId}`} cssVar="--sidebar-w">
      <div data-slot="header">
        <SidebarHeader title="Admin Escola" subtitle={needsSetup ? "Sessão não configurada" : "Sessão ativa"} />
      </div>
      <div className="px-2">
        <SidebarNav items={items} />
      </div>
      <SidebarFooter>
        <div className="text-xs text-white/80">v2.1 · Admin Escola</div>
      </SidebarFooter>
    </SidebarContainer>
  );
}
