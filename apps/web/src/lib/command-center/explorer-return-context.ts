import type { EntityContext } from "@/lib/command-center/entity-context";

/**
 * UX-00: session-only handoff from contextual explorers → Balcão → back.
 * Never persisted to localStorage; cleared on escola change or consume.
 */
export type ExplorerReturnSnapshot = {
  escolaId: string;
  entityContext: EntityContext;
  contextTrail: EntityContext[];
  courseClassId: string | null;
  courseTurmaId: string | null;
  savedAt: number;
};

let snapshot: ExplorerReturnSnapshot | null = null;

export function saveExplorerReturnContext(next: Omit<ExplorerReturnSnapshot, "savedAt">) {
  snapshot = { ...next, savedAt: Date.now() };
}

export function peekExplorerReturnContext(escolaId: string | null | undefined): ExplorerReturnSnapshot | null {
  if (!snapshot || !escolaId || snapshot.escolaId !== escolaId) return null;
  return snapshot;
}

/** Read and clear. */
export function consumeExplorerReturnContext(escolaId: string | null | undefined): ExplorerReturnSnapshot | null {
  const current = peekExplorerReturnContext(escolaId);
  snapshot = null;
  return current;
}

export function clearExplorerReturnContext(escolaId?: string | null) {
  if (!escolaId || snapshot?.escolaId === escolaId) snapshot = null;
}
