import UsuariosListClient from "@/components/super-admin/UsuariosListClient";
import AuditPageView from "@/components/audit/AuditPageView";

export const dynamic = 'force-dynamic'

export default async function Page() {
  return (
    <>
      <AuditPageView portal="super_admin" acao="PAGE_VIEW" entity="usuarios_list" />
      <UsuariosListClient />
    </>
  );
}
