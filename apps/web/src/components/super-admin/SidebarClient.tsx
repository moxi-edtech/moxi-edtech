"use client";
import { useState, useEffect } from "react";
import SidebarServer from "./SidebarServer";
import clsx from "clsx";

export default function SidebarClient() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("superadmin:sidebar:collapsed");
    if (saved) setCollapsed(saved === "1");
  }, []);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("superadmin:sidebar:collapsed", next ? "1" : "0");
  };

  return (
    <div className="relative">
      <button
        onClick={toggle}
        className="absolute right-2 top-2 z-50 rounded-md bg-slate-200 p-1 hover:bg-slate-300"
        title={collapsed ? "Expandir sidebar" : "Recolher sidebar"}
      >
        {collapsed ? "»" : "«"}
      </button>
      <SidebarServer collapsed={collapsed} />
    </div>
  );
}
