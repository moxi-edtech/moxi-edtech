import AppShell from "@/components/layout/klasse/AppShell";
import RequireSecretaria from "@/app/(guards)/RequireSecretaria";
import React from "react";
import { requireSchoolActive } from "@/lib/auth/requireSchoolActive";

export default async function SecretariaEscolaLayout({ children, params }: { children: React.ReactNode, params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireSchoolActive(id);

  return (
    <RequireSecretaria escolaId={id}>
      <AppShell>
        {children}
      </AppShell>
    </RequireSecretaria>
  );
}
