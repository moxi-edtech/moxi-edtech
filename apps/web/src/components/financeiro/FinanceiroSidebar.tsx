import SidebarContainer from "@/components/layout/shared/SidebarContainer";
import { SidebarHeader } from "@/components/layout/shared/SidebarHeader";
import { SidebarNav, type NavItem } from "@/components/layout/shared/SidebarNav";
import { SidebarFooter } from "@/components/layout/shared/SidebarFooter";

// Icon components are selected client-side in SidebarNav by name.
// Assuming heroicons are used.
export default function FinanceiroSidebar() {
  const items: NavItem[] = [
    { href: "/financeiro", label: "Visão Geral", icon: "ChartPieIcon" },
    { href: "/financeiro/radar", label: "Radar", icon: "ShieldExclamationIcon" },
    { href: "/financeiro/cobrancas", label: "Cobranças", icon: "CreditCardIcon" },
    { href: "/financeiro/conciliacao", label: "Conciliação", icon: "ArrowsRightLeftIcon" },
    { href: "/financeiro/relatorios", label: "Relatórios", icon: "ChartBarIcon" },
    { href: "/financeiro/relatorios/propinas", label: "Rel. Propinas", icon: "ChartBarIcon" },
    { href: "/financeiro/relatorios/detalhados", label: "Relatórios Detalhados", icon: "ChartBarIcon" },
    { href: "/financeiro/tabelas-mensalidade", label: "Tabelas de Mensalidade", icon: "BanknotesIcon" },
  ];

  return (
    <SidebarContainer storageKey="financeiro:sidebar" cssVar="--sidebar-w">
      <div data-slot="header">
        <SidebarHeader title="Financeiro" subtitle="Painel" />
      </div>
      <div className="px-2">
        <SidebarNav items={items} />
      </div>
      <SidebarFooter>
        <div className="text-xs text-white/80">© {new Date().getFullYear()} Moxi EdTech</div>
      </SidebarFooter>
    </SidebarContainer>
  );
}
