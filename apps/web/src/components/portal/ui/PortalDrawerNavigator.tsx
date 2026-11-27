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
type Navigation = { push: (frame: PortalDrawerFrame) => void; registerGuard: (frameId: string, sourceId: string, guard: Guard | null) => void; notifyChanged: () => void; busy: boolean; dirty: boolean };
const FrameContext = createContext<string | null>(null);
const Context = createContext<Navigation | null>(null);
// A page may mount separate turma, lesson and operation navigators. Only the
// latest root owns its history. Never reopen a previous root or scope by token.
let historyOwner: string | null = null;

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
export function PortalDrawerNavigator({ root, open, onClose, onReopen, onChanged }: {
  root: PortalDrawerFrame;
  open: boolean;
  onClose: () => void;
  onReopen: () => void;
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
  const dirty = hasGuard(activeIds, "dirty");
  const canLeave = (ids: string[]) => {
    if (hasGuard(ids, "busy")) return false;
    return !hasGuard(ids, "dirty") || window.confirm("Existem alterações não guardadas. Pretende descartá-las?");
  };
  const body = useRef<HTMLDivElement>(null);
  const restore = useRef<{ top: number; opener: HTMLElement | null } | null>(null);
  // Only opaque positions enter browser history. The scoped mount owns the trail.
  const session = useRef<{ token: string; rootId: string; trail: Entry[]; reopen: () => void; url: string } | null>(null);
  const travelling = useRef(false);
  const historyKey = "klassePortalDrawer";
  const invalidate = useCallback(() => {
    if (historyOwner === session.current?.token) historyOwner = null;
    session.current = null;
    travelling.current = false;
    approved.current = false;
  }, []);
  useLayoutEffect(() => () => invalidate(), [invalidate]);
  useLayoutEffect(() => {
    if (!open) return;
    const current = session.current;
    if (current?.rootId === root.id && historyOwner === current.token && history.state?.[historyKey]?.token === current.token) return;
    const token = crypto.randomUUID();
    historyOwner = token;
    session.current = { token, rootId: root.id, trail: [], reopen: onReopen, url: location.href };
    history.pushState({ ...history.state, [historyKey]: { token, depth: 0 } }, "");
  }, [open, root.id]);
  const push = useCallback((frame: PortalDrawerFrame) => {
    if (!open || busy || dirty || frame.id === root.id) return;
    const previousScroll = body.current?.scrollTop ?? 0;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const current = session.current;
    if (!current || historyOwner !== current.token || travelling.current || entries.some(entry => entry.frame.id === frame.id)) return;
    const next = [...entries, { frame, previousScroll, opener }];
    current.trail = next;
    history.pushState({ ...history.state, [historyKey]: { token: current.token, depth: next.length } }, "");
    setStack({ rootId: root.id, entries: next });
  }, [open, root.id, busy, dirty, entries]);

  const approved = useRef(false);
  const travel = (delta: number) => {
    if (travelling.current) return;
    const current = session.current;
    if (!current || historyOwner !== current.token || location.href !== current.url || history.state?.[historyKey]?.token !== current.token) {
      invalidate();
      onClose();
      if (changed.current) { changed.current = false; onChanged?.(); }
      return;
    }
    approved.current = true;
    travelling.current = true;
    history.go(delta);
  };
  const back = () => {
    const last = entries[entries.length - 1];
    if (last && canLeave([last.frame.id])) travel(-1);
  };
  const close = () => {
    if (canLeave(activeIds)) travel(-entries.length - 1);
  };
  useLayoutEffect(() => {
    const traverse = (event: PopStateEvent) => {
      const current = session.current;
      if (!current || historyOwner !== current.token) return;
      if (current.url !== location.href) {
        // A different route/scope is not a drawer entry. Never restore a
        // captured ReactNode from that route. Browser multi-entry jumps
        // cannot be reliably cancelled by popstate; normal Back is guarded below.
        invalidate();
        if (open) onClose();
        return;
      }
      const mark = event.state?.[historyKey];
      const depth = mark?.token === current.token && Number.isSafeInteger(mark.depth) && mark.depth >= 0 ? mark.depth : -1;
      if ((!open && depth < 0) || depth > current.trail.length) return;
      const position = open ? entries.length : -1;
      if (depth === position) { travelling.current = false; approved.current = false; return; }
      if (open && !approved.current && !canLeave(depth < 0 ? activeIds : depth < position ? entries.slice(depth).map(entry => entry.frame.id) : activeIds)) {
        travelling.current = true;
        history.go(position - depth);
        return;
      }
      approved.current = false;
      travelling.current = false;
      if (depth < 0) {
        onClose();
        if (changed.current) { changed.current = false; onChanged?.(); }
      } else {
        if (!open) current.reopen();
        const left = entries[depth];
        if (left) restore.current = { top: left.previousScroll, opener: left.opener };
        setStack({ rootId: current.rootId, entries: current.trail.slice(0, depth) });
      }
    };
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const guardLink = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!link || link.download || link.hasAttribute("download") || link.target === "_blank" || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      if (!canLeave(activeIds)) { event.preventDefault(); event.stopPropagation(); return; }
      // Invalidate on an approved same-tab navigation, but not on a download,
      // a new tab or an anchor to the current URL.
      if (link.href !== location.href) invalidate();
    };
    window.addEventListener("popstate", traverse);
    if (open) document.addEventListener("click", guardLink, true);
    if (open && (dirty || busy)) window.addEventListener("beforeunload", unload);
    return () => {
      window.removeEventListener("popstate", traverse);
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", guardLink, true);
    };
  });
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
      <Context.Provider value={{ push, registerGuard, notifyChanged, busy, dirty }}>
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
  return <button type="button" disabled={navigation.busy || navigation.dirty} className={className} onClick={() => navigation.push(frame)}>{children}</button>;
}
