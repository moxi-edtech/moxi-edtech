"use client";

import { memo, useEffect, useState, type ReactNode } from "react";
import type { BalcaoActionId } from "@/lib/balcao/action-registry";

/**
 * Each action is mounted on first visit and kept alive only for the lifetime
 * of the current school/student workspace. The parent MUST key this boundary
 * by student and tenant; it must never be a module-global cache.
 *
 * Hidden actions preserve native file inputs, payment selections and local
 * React form state without additional requests on every tab change.
 */
type ActionSlotProps = {
  action: BalcaoActionId;
  active: boolean;
  renderAction: (action: BalcaoActionId) => ReactNode;
  contextSignature: string;
  onDirty: (action: BalcaoActionId) => void;
};

const ActionSlot = memo(function ActionSlot({ action, active, renderAction, onDirty }: ActionSlotProps) {
  return (
    <section
      data-balcao-retained-action={action}
      hidden={!active}
      aria-hidden={!active}
      inert={!active}
      onInputCapture={() => onDirty(action)}
      onChangeCapture={() => onDirty(action)}
      onClickCapture={(event) => {
        const element = event.target;
        if (!(element instanceof Element)) return;
        const button = element.closest("button");
        if (!button) return;
        const label = button.textContent?.toLowerCase() || button.getAttribute("aria-label")?.toLowerCase() || "";
        if (/adicionar|selecionar|remover|guardar|gravar|confirmar|anexar|pagar|matricular|transferir|enviar/.test(label)) onDirty(action);
      }}
    >
      {renderAction(action)}
    </section>
  );
}, (previous, next) => previous.active === next.active && previous.contextSignature === next.contextSignature);

export function RetainedActionPanels({
  activeAction,
  renderAction,
  onUnsavedChange,
  contextSignature,
}: {
  activeAction: BalcaoActionId;
  contextSignature: string;
  renderAction: (action: BalcaoActionId) => ReactNode;
  onUnsavedChange?: (unsaved: boolean) => void;
}) {
  const [visited, setVisited] = useState<BalcaoActionId[]>([activeAction]);
  const [dirty, setDirty] = useState<ReadonlySet<BalcaoActionId>>(() => new Set());
  useEffect(() => {
    setVisited((current) =>
      current.includes(activeAction) ? current : [...current, activeAction],
    );
  }, [activeAction]);

  // Include the newly selected panel in the same render, not one effect later.
  const mounted = visited.includes(activeAction) ? visited : [...visited, activeAction];
  const markUnsaved = (action: BalcaoActionId) => {
    setDirty((current) => {
      if (current.has(action)) return current;
      const next = new Set(current);
      next.add(action);
      return next;
    });
  };

  useEffect(() => {
    onUnsavedChange?.(dirty.size > 0);
  }, [dirty, onUnsavedChange]);

  useEffect(() => {
    if (!dirty.size) return;
    const protect = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [dirty.size]);

  return (
    <>
      {mounted.map((action) => (
        <ActionSlot
          key={action}
          action={action}
          active={action === activeAction}
          contextSignature={contextSignature}
          renderAction={renderAction}
          onDirty={markUnsaved}
        />
      ))}
    </>
  );
}
