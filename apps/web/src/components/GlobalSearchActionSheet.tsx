"use client";

import { ModalShell } from "@/components/ui/ModalShell";
import { BalcaoWorkspace } from "@/components/secretaria/BalcaoWorkspace";
import { FichaRapidaModal } from "@/components/secretaria/FichaRapidaModal";
import { PautaRapidaModal } from "@/components/secretaria/PautaRapidaModal";
import { getBalcaoAction } from "@/lib/balcao/action-registry";
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

// Mantém a assinatura usada pelo Command Palette. O antigo prefetch carregava um
// fluxo paralelo de pagamento rápido; as ações financeiras agora reutilizam o
// próprio Balcão, que é a fonte canónica do atendimento.
export function prefetchGlobalSearchAction(_action: SearchAction, _result: MinimalSearchResult) {
  return;
}

export function GlobalSearchActionSheet({ active, escolaId, onClose, onSuccess }: Props) {
  if (!active) return null;

  const definition = getBalcaoAction(active.action.kind);

  if (definition.surface === "balcao") {
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

  if (definition.surface === "profile") {
    return (
      <FichaRapidaModal
        alunoId={active.result.id}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    );
  }

  return (
    <ModalShell
      open
      title={definition.label}
      description={active.result.label}
      onClose={onClose}
    >
      <PautaRapidaModal hideNavigation />
    </ModalShell>
  );
}
