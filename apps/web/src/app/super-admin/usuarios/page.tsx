import SidebarServer from "@/components/super-admin/SidebarServer";
import HeaderServer from "@/components/super-admin/HeaderServer";
import UsuariosListClient from "@/components/super-admin/UsuariosListClient";

export const dynamic = 'force-dynamic'

export default async function Page() {
  return (
    <div className="flex h-screen bg-gray-100">
      <SidebarServer collapsed={false} />
      <div className="flex-1 flex flex-col">
        <HeaderServer />
        <main className="p-6 overflow-y-auto">
          <UsuariosListClient />
        </main>
      </div>
    </div>
  );
}
