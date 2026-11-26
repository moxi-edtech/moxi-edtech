"use client";

import { createContext, useCallback, useContext, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { PortalSheet } from "@/components/portal/ui/PortalSheet";

export type PortalDrawerFrame = {
  id: string;
  title: string;
  description: string;
  content: ReactNode;
  size?: "compact" | "medium" | "expanded";
};

type Entry = { frame: PortalDrawerFrame; previousScroll: number; opener: HTMLElement | null };
type Guard = { dirty: boolean; busy: boolean };
type Navigation = { push: (frame: PortalDrawerFrame) => void; registerGuard: (frameId: string, sourceId: string, guard: Guard | null) => void; notifyChanged: () => void };
const FrameContext = createContext<string | null>(null);
const Context = createContext<Navigation | null>(null);

export function usePortalDrawerNavigation() {
  return useContext(Context);
}

/** Registers an explicit mutation/unsaved-state guard in an embedded workspace. */
export function usePortalDrawerGuard(dirty: boolean, busy: boolean) {
  const register = usePortalDrawerNavigation()?.registerGuard;
  const id = useContext(FrameContext);
  const sourceId = useId();
  useLayoutEffect(() => {
    if (!register || !id) return;
    register(id, sourceId, { dirty, busy });
    return () => register(id, sourceId, null);
  }, [register, id, sourceId, dirty, busy]);
}

/** One Radix dialog, one active frame. Parents stay mounted to retain their state. */
export function PortalDrawerNavigator({ root, open, onClose, onChanged }: {
  root: PortalDrawerFrame;
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
}) {
  // A root identifier must include the school/student/turma scope.
  const [stack, setStack] = useState<{ rootId: string; entries: Entry[] }>({ rootId: root.id, entries: [] });
  const entries = open && stack.rootId === root.id ? stack.entries : [];
  const active = entries[entries.length - 1]?.frame ?? root;
  const [guards, setGuards] = useState<Record<string, Record<string, Guard>>>({});
  const changed = useRef(false);
  const notifyChanged = useCallback(() => { changed.current = true; }, []);
  const registerGuard = useCallback((frameId: string, sourceId: string, guard: Guard | null) => {
    setGuards(current => {
      const prior = current[frameId] ?? {};
      if (guard && prior[sourceId]?.dirty === guard.dirty && prior[sourceId]?.busy === guard.busy) return current;
      if (!guard && !prior[sourceId]) return current;
      const next = { ...prior };
      if (guard) next[sourceId] = guard;
      else delete next[sourceId];
      return { ...current, [frameId]: next };
    });
  }, []);
  const activeIds = [root.id, ...entries.map(entry => entry.frame.id)];
  const hasGuard = (ids: string[], kind: keyof Guard) => ids.some(id => Object.values(guards[id] ?? {}).some(guard => guard[kind]));
  const busy = hasGuard(activeIds, "busy");
  const canLeave = (ids: string[]) => {
    if (hasGuard(ids, "busy")) return false;
    return !hasGuard(ids, "dirty") || window.confirm("Existem alterações não guardadas. Pretende descartá-las?");
  };
  const body = useRef<HTMLDivElement>(null);
  const restore = useRef<{ top: number; opener: HTMLElement | null } | null>(null);
  const push = useCallback((frame: PortalDrawerFrame) => {
    if (!open || frame.id === root.id) return;
    const previousScroll = body.current?.scrollTop ?? 0;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setStack(current => {
      const prior = current.rootId === root.id ? current.entries : [];
      if (prior.some(entry => entry.frame.id === frame.id)) return current;
      return { rootId: root.id, entries: [...prior, { frame, previousScroll, opener }] };
    });
  }, [open, root.id]);

  const back = () => {
    const last = entries[entries.length - 1];
    if (!last || !canLeave([last.frame.id])) return;
    restore.current = { top: last.previousScroll, opener: last.opener };
    setStack({ rootId: root.id, entries: entries.slice(0, -1) });
  };
  const close = () => {
    if (!canLeave(activeIds)) return;
    restore.current = null;
    setStack({ rootId: root.id, entries: [] });
    onClose();
    if (changed.current) { changed.current = false; onChanged?.(); }
  };
  useLayoutEffect(() => {
    if (!open) {
      restore.current = null;
      setStack(current => current.entries.length || current.rootId !== root.id ? { rootId: root.id, entries: [] } : current);
    }
  }, [open, root.id]);
  useLayoutEffect(() => {
    if (!open) return;
    const target = restore.current;
    restore.current = null;
    if (body.current) body.current.scrollTop = target?.top ?? 0;
    if (target?.opener?.isConnected) target.opener.focus({ preventScroll: true });
  }, [active.id, open]);

  return (
    <PortalSheet open={open} onClose={close} title={active.title} description={active.description}
      size={active.size ?? "expanded"} busy={busy} onBack={entries.length ? back : undefined} navigationKey={active.id} bodyRef={body}>
      <Context.Provider value={{ push, registerGuard, notifyChanged }}>
        <div key={root.id} hidden={entries.length > 0} className={entries.length ? "hidden" : "space-y-4"}>
          <FrameContext.Provider value={root.id}>{root.content}</FrameContext.Provider>
        </div>
        {entries.map(({ frame }, index) => (
          <div key={frame.id} hidden={index !== entries.length - 1} className={index !== entries.length - 1 ? "hidden" : "space-y-4"}>
            <FrameContext.Provider value={frame.id}>{frame.content}</FrameContext.Provider>
          </div>
        ))}
      </Context.Provider>
    </PortalSheet>
  );
}

export function PortalDrawerPushButton({ frame, className, children }: {
  frame: PortalDrawerFrame; className?: string; children: ReactNode;
}) {
  const navigation = usePortalDrawerNavigation();
  if (!navigation) return null;
  return <button type="button" className={className} onClick={() => navigation.push(frame)}>{children}</button>;
}
