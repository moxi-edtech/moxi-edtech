"use client";

import { useEffect, useState, type ReactNode } from "react";

type WorkspaceTab = {
  id: string;
  label: string;
  icon?: ReactNode;
  content: ReactNode;
};

type InstantWorkspaceTabsProps = {
  tabs: WorkspaceTab[];
  initialTab: string;
  ariaLabel: string;
  actions?: ReactNode;
  header?: ReactNode;
};

export function InstantWorkspaceTabs({
  tabs,
  initialTab,
  ariaLabel,
  actions,
  header,
}: InstantWorkspaceTabsProps) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [mountedTabs, setMountedTabs] = useState(() => new Set([initialTab]));

  useEffect(() => {
    const preloadTimer = window.setTimeout(() => {
      setMountedTabs(new Set(tabs.map((tab) => tab.id)));
    }, 800);
    return () => window.clearTimeout(preloadTimer);
  }, [tabs]);

  useEffect(() => {
    const syncFromUrl = () => {
      const requestedTab = new URL(window.location.href).searchParams.get("vista");
      setActiveTab(tabs.some((tab) => tab.id === requestedTab) ? requestedTab! : initialTab);
    };
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, [initialTab, tabs]);

  const selectTab = (tabId: string) => {
    if (tabId === activeTab) return;
    setMountedTabs((current) => {
      if (current.has(tabId)) return current;
      return new Set([...current, tabId]);
    });
    setActiveTab(tabId);
    const url = new URL(window.location.href);
    url.searchParams.set("vista", tabId);
    window.history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        {header ? <div className="mb-3 px-1">{header}</div> : null}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label={ariaLabel}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                id={`workspace-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`workspace-panel-${tab.id}`}
                onClick={() => selectTab(tab.id)}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  activeTab === tab.id
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
          {actions}
        </div>
      </section>

      {tabs.map((tab) =>
        mountedTabs.has(tab.id) ? (
          <div
            key={tab.id}
            id={`workspace-panel-${tab.id}`}
            role="tabpanel"
            aria-labelledby={`workspace-tab-${tab.id}`}
            hidden={activeTab !== tab.id}
          >
            {tab.content}
          </div>
        ) : null
      )}
    </div>
  );
}
