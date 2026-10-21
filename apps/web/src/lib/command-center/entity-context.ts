import type { MinimalSearchResult } from "@/hooks/useGlobalSearch";

/** The contextual explorer is a read-only layer over the existing global search. */
export const CONTEXTUAL_ENTITY_TYPES = ["curso", "classe", "turma", "professor"] as const;
export type ContextualEntityType = (typeof CONTEXTUAL_ENTITY_TYPES)[number];

export type EntityContext = Readonly<{
  type: ContextualEntityType;
  id: string;
  escolaId: string;
  label: string;
  academicYearId: string | null;
}>;

export function isContextualEntityType(value: string): value is ContextualEntityType {
  return (CONTEXTUAL_ENTITY_TYPES as readonly string[]).includes(value);
}

/** Never trust search result URLs for entity authorization. The detail API must reauthorize. */
export function createEntityContext(
  result: MinimalSearchResult,
  escolaId: string | null | undefined,
  academicYearId: string | null,
): EntityContext | null {
  if (!escolaId || !result.id || !isContextualEntityType(result.type)) return null;
  return {
    type: result.type,
    id: result.id,
    escolaId,
    label: result.label?.trim() || "Sem identificação",
    academicYearId,
  };
}
