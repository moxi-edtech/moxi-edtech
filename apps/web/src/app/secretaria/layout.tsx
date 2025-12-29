"use client";
import AppShell from "@/components/layout/klasse/AppShell";
import React from "react";
import RequireSecretaria from "@/app/(guards)/RequireSecretaria";

export default function SecretariaLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireSecretaria>
      <AppShell>
        {children}
      </AppShell>
    </RequireSecretaria>
  );
}


