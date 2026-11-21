"use client";

import { createContext, useContext } from "react";

/** Identidade e tenant já validados pelo layout servidor. Não substitui RLS. */
type AlunoPortalScope = { escolaId: string; userId: string };

export const AlunoPortalScopeContext = createContext<AlunoPortalScope | null>(null);

export function useAlunoPortalScope(): AlunoPortalScope | null {
  return useContext(AlunoPortalScopeContext);
}
