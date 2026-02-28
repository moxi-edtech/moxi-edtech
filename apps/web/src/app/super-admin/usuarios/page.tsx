import UsuariosListClient from "@/components/super-admin/UsuariosListClient";
import AuditPageView from "@/components/audit/AuditPageView";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";

export const dynamic = 'force-dynamic'

export default async function Page() {
  return (
    <>
      <AuditPageView portal="super_admin" acao="PAGE_VIEW" entity="usuarios_list" />
      <DashboardHeader
        title="Usuários"
        description="Gestão global de acessos e perfis do sistema."
      />
      <UsuariosListClient />
    </>
  );
}
