import AppShell from "@/components/layout/klasse/AppShell";
import React from "react";

export default function FinanceiroLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      {children}
    </AppShell>
  );
}
