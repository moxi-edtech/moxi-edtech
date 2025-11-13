import SidebarClient from "@/components/super-admin/SidebarClient";
import HeaderServer from "@/components/super-admin/HeaderServer"; // Keep HeaderServer as it is a server component

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-100">
      <SidebarClient />
      <div className="flex-1 flex flex-col">
        <HeaderServer />
        <main className="p-6 overflow-y-auto space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
}
