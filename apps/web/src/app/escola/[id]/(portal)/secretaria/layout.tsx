import RequireSecretaria from "@/app/(guards)/RequireSecretaria";
import React from "react";

export default async function SecretariaEscolaLayout({ children, params }: { children: React.ReactNode, params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <RequireSecretaria escolaId={id}>
      {children}
    </RequireSecretaria>
  );
}
