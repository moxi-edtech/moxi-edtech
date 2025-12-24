import AppShell from "@/components/layout/klasse/AppShell";
import React from "react";

export default function SecretariaPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      {children}
    </AppShell>
  );
}

