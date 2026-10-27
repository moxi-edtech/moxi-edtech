"use client";

import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";

export type PortalTabItem<T extends string> = {
  id: T;
  label: string;
  icon?: ReactNode;
};

/** Shared WAI-ARIA tabs: roving focus, wraparound arrows and Home/End.
 * Navigation/URL state belongs to the calling portal, so no router refresh.
 */
export function PortalTabs<T extends string>({
  items, value, onChange, label, idPrefix, className = "", testId,
}: {
  items: readonly PortalTabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  idPrefix: string;
  className?: string;
  testId?: string;
}) {
  const refs = useRef<Partial<Record<T, HTMLButtonElement | null>>>({});
  const previous = useRef(value);
  useEffect(() => {
    if (previous.current !== value) {
      refs.current[value]?.focus();
      previous.current = value;
    }
  }, [value]);

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, current: T) => {
    const index = items.findIndex((tab) => tab.id === current);
    let next: T | undefined;
    if (event.key === "ArrowRight") next = items[(index + 1) % items.length]?.id;
    else if (event.key === "ArrowLeft") next = items[(index + items.length - 1) % items.length]?.id;
    else if (event.key === "Home") next = items[0]?.id;
    else if (event.key === "End") next = items[items.length - 1]?.id;
    if (!next) return;
    event.preventDefault();
    onChange(next);
  };

  return (
    <div role="tablist" aria-label={label} data-testid={testId}
      className={`flex min-w-0 gap-1 overflow-x-auto border-b border-border ${className}`}>
      {items.map((tab) => (
        <button
          key={tab.id}
          ref={(element) => { refs.current[tab.id] = element; }}
          id={`${idPrefix}-tab-${tab.id}`}
          aria-controls={`${idPrefix}-panel-${tab.id}`}
          aria-selected={value === tab.id}
          tabIndex={value === tab.id ? 0 : -1}
          role="tab"
          type="button"
          onClick={() => onChange(tab.id)}
          onKeyDown={(event) => onTabKeyDown(event, tab.id)}
          className={`inline-flex min-h-12 flex-1 items-center justify-center gap-1.5 whitespace-nowrap border-b-2 px-2 text-sm font-semibold transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:gap-2 sm:px-4 ${value === tab.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          {tab.icon && <span aria-hidden="true" className="shrink-0">{tab.icon}</span>}
          {tab.label}
        </button>
      ))}
    </div>
  );
}
