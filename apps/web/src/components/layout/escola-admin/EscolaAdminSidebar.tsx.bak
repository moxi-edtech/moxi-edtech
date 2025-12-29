// src/components/escola-admin/Sidebar.tsx

import SidebarContainer from "@/components/layout/shared/SidebarContainer";
import { SidebarHeader } from "@/components/layout/shared/SidebarHeader";
import { SidebarNav, type NavItem } from "@/components/layout/shared/SidebarNav";
import { SidebarFooter } from "@/components/layout/shared/SidebarFooter";
import { supabaseServer } from "@/lib/supabaseServer";

export default async function EscolaAdminSidebar({ escolaId }: { escolaId: string }) {
  if (!escolaId) return null;

  const s = await supabaseServer();
  const { data } = await s
    .from("escolas")
    .select("onboarding_finalizado")
    .eq("id", escolaId)
    .maybeSingle();
    
  const needsSetup = !data?.onboarding_finalizado;

  // Nota: Os nomes dos ícones devem bater com o Lucide React agora
  const items: NavItem[] = [
    { label: "Dashboard", href: `/escola/${escolaId}/admin/dashboard`, icon: "LayoutDashboard" },
    { label: "Alunos", href: `/escola/${escolaId}/admin/alunos`, icon: "Users" },
    { label: "Professores", href: `/escola/${escolaId}/admin/professores`, icon: "GraduationCap" },
    { label: "Turmas", href: `/escola/${escolaId}/admin/turmas`, icon: "Layers" },
    { label: "Avisos", href: `/escola/${escolaId}/admin/avisos`, icon: "Megaphone" },
    {
      label: "Configurações",
      href: `/escola/${escolaId}/admin/configuracoes`,
      icon: "Settings",
      badge: needsSetup ? "Alert" : undefined,
    },
  ];

  return (
    <SidebarContainer storageKey={`escola-admin:${escolaId}`}>
      <SidebarHeader 
        title="Admin Escola" 
        subtitle={needsSetup ? "Configuração Pendente" : "Sessão Ativa"} 
      />
      <SidebarNav items={items} />
      <SidebarFooter>
        {/* Footer content que se adapta ao contexto também se quiseres */}
      </SidebarFooter>
    </SidebarContainer>
  );
}