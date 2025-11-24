"use client";

import React from "react";
import RequireSecretaria from "@/app/(guards)/RequireSecretaria";

export default function SecretariaLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireSecretaria>
      {children}
    </RequireSecretaria>
  );
}

