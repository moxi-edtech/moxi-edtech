import AppShell from "@/components/layout/klasse/AppShell";
import React, { Suspense } from "react";
import { PORTAL_PAGE_INSET } from "@/lib/layout/portal-page";
import RequireSuperAdmin from "@/app/(guards)/RequireSuperAdmin";

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 p-6 text-slate-500 font-medium text-sm">A carregar...</div>}>
      <AppShell>
        <div data-testid="super-admin-page-frame" className={`${PORTAL_PAGE_INSET} space-y-6`}>
          <RequireSuperAdmin>{children}</RequireSuperAdmin>
        </div>
      </AppShell>
    </Suspense>
  );
}

