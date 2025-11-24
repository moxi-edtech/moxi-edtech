import SecretariaShell from "@/components/secretaria/SecretariaShell";
import React from "react";

export default function SecretariaPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <SecretariaShell>
      {children}
    </SecretariaShell>
  );
}

