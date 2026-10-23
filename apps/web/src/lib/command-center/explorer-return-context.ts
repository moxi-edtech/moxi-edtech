import type { EntityContext } from "@/lib/command-center/entity-context";

/** Apenas estado de apresentação; nunca concede permissão ou contém dados pessoais. */
export type ExplorerViewState = {
  page: number;
  scrollTop: number;
  selectedStudentId: string | null;
  search?: string;
  filter?: string;
  sort?: string;
};

export type ExplorerScope = {
  userId: string;
  escolaId: string;
  poloId: string | null;
  academicYearId: string | null;
  portal: string;
};

export type ExplorerReturnSnapshot = {
  scope: ExplorerScope;
  escolaId: string;
  entityContext: EntityContext;
  contextTrail: EntityContext[];
  courseClassId: string | null;
  courseTurmaId: string | null;
  viewState: Record<string, ExplorerViewState>;
  savedAt: number;
};

const MAX_AGE_MS = 10 * 60_000;
export const MAX_EXPLORER_VIEWS = 40;
const MAX_CONTEXT_TRAIL = 24;

/** Recent per-entity UI state only; bounded even when a secretary changes views all day. */
export function retainExplorerViewState(
  previous: Record<string, ExplorerViewState>,
  key: string,
  next: ExplorerViewState,
): Record<string, ExplorerViewState> {
  const old = previous[key];
  if (old && old.page === next.page && old.scrollTop === next.scrollTop &&
      old.selectedStudentId === next.selectedStudentId && old.search === next.search &&
      old.filter === next.filter && old.sort === next.sort) {
    return previous;
  }
  const updated = { ...previous };
  delete updated[key];
  updated[key] = { ...next };
  while (Object.keys(updated).length > MAX_EXPLORER_VIEWS) {
    const oldest = Object.keys(updated)[0];
    if (!oldest) break;
    delete updated[oldest];
  }
  return updated;
}

let snapshot: ExplorerReturnSnapshot | null = null;

export function sameExplorerScope(a: ExplorerScope, b: ExplorerScope): boolean {
  return Boolean(a.userId && b.userId &&
    a.userId === b.userId && a.escolaId === b.escolaId &&
    a.poloId === b.poloId && a.academicYearId === b.academicYearId &&
    a.portal === b.portal);
}

export function saveExplorerReturnContext(next: Omit<ExplorerReturnSnapshot, "savedAt">) {
  if (!next.scope.userId || next.scope.escolaId !== next.escolaId ||
      next.entityContext.escolaId !== next.escolaId) {
    snapshot = null;
    return;
  }
  snapshot = {
    ...next,
    scope: { ...next.scope },
    contextTrail: next.contextTrail.slice(-MAX_CONTEXT_TRAIL),
    viewState: Object.fromEntries(Object.entries(next.viewState).slice(-MAX_EXPLORER_VIEWS).map(([key, state]) => [key, { ...state }])),
    savedAt: Date.now(),
  };
}

/** A incompatibilidade invalida o contexto; nunca regressar a outra sessão/polo/ano. */
export function peekExplorerReturnContext(scope: ExplorerScope): ExplorerReturnSnapshot | null {
  if (!snapshot) return null;
  if (Date.now() - snapshot.savedAt > MAX_AGE_MS || !sameExplorerScope(snapshot.scope, scope)) {
    snapshot = null;
    return null;
  }
  return snapshot;
}

export function consumeExplorerReturnContext(scope: ExplorerScope): ExplorerReturnSnapshot | null {
  const current = peekExplorerReturnContext(scope);
  snapshot = null;
  return current;
}

export function clearExplorerReturnContext(escolaId?: string | null) {
  if (!escolaId || snapshot?.escolaId === escolaId) snapshot = null;
}
