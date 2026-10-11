"use client";

import { BalcaoWorkspace } from "@/components/secretaria/BalcaoWorkspace";
import type { MinimalSearchResult, SearchAction } from "@/hooks/useGlobalSearch";

type ActiveSearchAction = {
  action: SearchAction;
  result: MinimalSearchResult;
} | null;

type Props = {
  active: ActiveSearchAction;
  escolaId: string;
  onClose: () => void;
  onSuccess?: () => void;
};

export function prefetchGlobalSearchAction(_action: SearchAction, _result: MinimalSearchResult) {
  return;
}

export function GlobalSearchActionSheet({ active, escolaId, onClose, onSuccess }: Props) {
  if (!active) return null;

  return (
    <BalcaoWorkspace
      open
      escolaId={escolaId}
      aluno={{ id: active.result.id, label: active.result.label }}
      actionId={active.action.kind}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  );
}
