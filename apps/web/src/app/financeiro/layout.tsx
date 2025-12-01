import type { ReactNode } from "react";
import FinanceiroSidebar from "@/components/financeiro/FinanceiroSidebar";
import AppHeader from "@/components/layout/shared/AppHeader";

export default function FinanceiroLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <FinanceiroSidebar />
      <div className="flex-1 transition-[padding] duration-300 ease-in-out" style={{ paddingLeft: "var(--sidebar-w, 256px)" }}>
        <AppHeader title="Financeiro" />
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
