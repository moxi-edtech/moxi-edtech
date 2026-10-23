"use client";

import { memo, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { BalcaoActionId } from "@/lib/balcao/action-registry";
import { BalcaoDraftScope, type BalcaoDraftSummary } from "./BalcaoDraftState";
import { useBalcaoHistoryGuard } from "./useBalcaoHistoryGuard";

type ActionSlotProps = {
  action: BalcaoActionId;
  active: boolean;
  renderAction: (action: BalcaoActionId) => ReactNode;
  contextSignature: string;
  onStatus: (action: BalcaoActionId, summary: BalcaoDraftSummary) => void;
};

const ActionSlot = memo(function ActionSlot({ action, active, renderAction, onStatus }: ActionSlotProps) {
  const handleStatus = useCallback((summary: BalcaoDraftSummary) => onStatus(action, summary), [action, onStatus]);
  return (
    <section
      data-balcao-retained-action={action}
      hidden={!active}
      aria-hidden={!active}
      inert={!active}
    >
      <BalcaoDraftScope onChange={handleStatus}>{renderAction(action)}</BalcaoDraftScope>
    </section>
  );
}, (previous, next) =>
  previous.active === next.active &&
  previous.contextSignature === next.contextSignature &&
  previous.onStatus === next.onStatus
);

export function RetainedActionPanels({
  activeAction,
  renderAction,
  onUnsavedChange,
  onSubmittingChange,
  onActionStatusesChange,
  contextSignature,
}: {
  activeAction: BalcaoActionId;
  contextSignature: string;
  renderAction: (action: BalcaoActionId) => ReactNode;
  onUnsavedChange?: (unsaved: boolean) => void;
  onSubmittingChange?: (submitting: boolean) => void;
  onActionStatusesChange?: (statuses: Readonly<Partial<Record<BalcaoActionId, BalcaoDraftSummary>>>) => void;
}) {
  const [visited, setVisited] = useState<BalcaoActionId[]>([activeAction]);
  const [actionStatuses, setActionStatuses] = useState<Partial<Record<BalcaoActionId, BalcaoDraftSummary>>>({});
  useEffect(() => {
    setVisited(current => current.includes(activeAction) ? current : [...current, activeAction]);
  }, [activeAction]);

  const onStatus = useCallback((action: BalcaoActionId, summary: BalcaoDraftSummary) => {
    setActionStatuses(current => {
      const old = current[action];
      // Ignore identity-equal states to avoid new renders/effect loops.
      if (old === summary) return current;
      return { ...current, [action]: summary };
    });
  }, []);

  // Enrollment is a new application each time it is entered. Discard its
  // previous draft status when leaving, without touching student-bound tabs.
  useEffect(() => {
    if (activeAction === "enrollment") return;
    setActionStatuses(current => {
      if (!current.enrollment) return current;
      const next = { ...current };
      delete next.enrollment;
      return next;
    });
  }, [activeAction]);

  const summary = useMemo(() => {
    const reports = Object.entries(actionStatuses)
      .filter(([action]) => action !== "enrollment" || activeAction === "enrollment")
      .map(([, report]) => report);
    return {
      dirty: reports.some(report => report?.dirty),
      submitting: reports.some(report => report?.submitting),
    };
  }, [actionStatuses, activeAction]);

  useEffect(() => { onUnsavedChange?.(summary.dirty); }, [summary.dirty, onUnsavedChange]);
  useEffect(() => { onSubmittingChange?.(summary.submitting); }, [summary.submitting, onSubmittingChange]);
  useEffect(() => { onActionStatusesChange?.(actionStatuses); }, [actionStatuses, onActionStatusesChange]);

  useBalcaoHistoryGuard(summary.dirty, summary.submitting);

  useEffect(() => {
    if (!summary.dirty) return;
    const confirmUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", confirmUnload);
    return () => window.removeEventListener("beforeunload", confirmUnload);
  }, [summary.dirty]);

  const mounted = visited.includes(activeAction) ? visited : [...visited, activeAction];
  return (
    <>
      {mounted.filter(action => action !== "enrollment" || activeAction === "enrollment").map(action => (
        <ActionSlot key={action} action={action} active={action === activeAction}
          contextSignature={contextSignature} renderAction={renderAction} onStatus={onStatus} />
      ))}
    </>
  );
}
