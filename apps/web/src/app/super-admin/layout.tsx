import SuperAdminSidebar from "@/components/super-admin/Sidebar";
import AppHeader from "@/components/layout/shared/AppHeader";
import React from "react";

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-100">
      <SuperAdminSidebar />
      <div className="flex-1">
        <AppHeader title="Super Admin" />
        <main className="p-6 space-y-6">{children}</main>
      </div>
    </div>
  );
}
