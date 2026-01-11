"use client";

import AppShell from "@/components/layout/klasse/AppShell";
import RequireSecretaria from "@/app/(guards)/RequireSecretaria";
import React from "react";
import { useParams } from "next/navigation";

export default function SecretariaEscolaLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const escolaId = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params?.id[0] : null;

  return (
    <RequireSecretaria escolaId={escolaId}>
      <AppShell>
        {children}
      </AppShell>
    </RequireSecretaria>
  );
}
