import AppShell from "@/components/layout/klasse/AppShell";
import React from "react";
import RequireSuperAdmin from "@/app/(guards)/RequireSuperAdmin";

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <RequireSuperAdmin>{children}</RequireSuperAdmin>
    </AppShell>
  );
}
