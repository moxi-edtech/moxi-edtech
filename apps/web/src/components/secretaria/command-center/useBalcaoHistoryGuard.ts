"use client";

import { useEffect, useRef } from "react";

/**
 * App Router doesn't provide a cancellable beforePopState. Add a same-URL
 * history fence only while there is pending work. The first Back reaches
 * this fence and is checked before traversing to the previous route.
 *
 * No form values/IDs go into history.state. Browser close/reload uses the
 * platform's native beforeunload confirmation. In-flight writes never navigate.
 */
export function useBalcaoHistoryGuard(dirty: boolean, submitting: boolean) {
  const current = useRef({ dirty, submitting });
  current.current = { dirty, submitting };
  const skipping = useRef(false);
  useEffect(() => {
    if (!dirty && !submitting) return;
    if (typeof window === "undefined") return;
    const marker = "__balcaoProtectedHistory";
    const history = window.history;
    const originalState = history.state;
    // Never store personal data in the extra entry.
    history.pushState({ ...(typeof originalState === "object" && originalState !== null ? originalState : {}), [marker]: true }, "", window.location.href);
    const onPop = () => {
      if (skipping.current) {
        skipping.current = false;
        return;
      }
      if (current.current.submitting) {
        history.forward();
        return;
      }
      if (current.current.dirty && !window.confirm("Existem alterações ainda não guardadas. Deseja sair e descartá-las?")) {
        history.forward();
        return;
      }
      skipping.current = true;
      history.back();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      // Do not call history.back() during cleanup: React rerenders/route
      // transitions must never trigger an implicit, unconfirmed navigation.
    };
  }, [dirty || submitting]);
}
