"use client";

import { useCallback, useEffect, useState } from "react";

/** No student identity or form value is stored. Only the boolean opt-out. */
const KEY = "klasse:balcao:keyboard-shortcuts-enabled";
const isEditing = (target: EventTarget | null) => {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('input,textarea,select,[contenteditable="true"],[role="textbox"]'));
};

export function useBalcaoKeyboardShortcuts({
  onSearch, onSwitch,
}: {
  onSearch: () => void;
  onSwitch: () => void;
}) {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    try { setEnabled(window.sessionStorage.getItem(KEY) !== "false"); }
    catch { setEnabled(true); }
  }, []);
  const updateEnabled = useCallback((value: boolean) => {
    setEnabled(value);
    try { window.sessionStorage.setItem(KEY, String(value)); }
    catch { /* privacy/private mode; no storage needed */ }
  }, []);
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      // Four-key chords avoid browser/common screen-reader default hotkeys.
      // Never intercept events inside form fields or IME composition.
      if (!event.ctrlKey || !event.altKey || !event.shiftKey || event.metaKey ||
        event.repeat || event.isComposing || event.defaultPrevented || isEditing(event.target)) return;
      if (event.code === "KeyF") {
        event.preventDefault();
        onSearch();
      } else if (event.code === "KeyT") {
        event.preventDefault();
        onSwitch();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [enabled, onSearch, onSwitch]);
  return { enabled, setEnabled: updateEnabled };
}
