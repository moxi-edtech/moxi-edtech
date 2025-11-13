"use client";
import { useState, useEffect } from "react";
import SidebarServer from "./SidebarServer";

export default function SidebarClient({ escolaId, escolaNome }: { escolaId: string; escolaNome?: string }) {
  const [collapsed, setCollapsed] = useState(false);

  // 1) Restaurar estado
  useEffect(() => {
    const saved = localStorage.getItem("escola-admin:sidebar:collapsed");
    const init = saved === "1";
    setCollapsed(init);
    // 2) Publicar a largura logo no mount
    document.documentElement.style.setProperty(
      "--escola-admin-sidebar-w",
      init ? "80px" : "256px"
    );
  }, []);

  // 3) Toggle que também publica a nova largura
  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("escola-admin:sidebar:collapsed", next ? "1" : "0");
    document.documentElement.style.setProperty(
      "--escola-admin-sidebar-w",
      next ? "80px" : "256px"
    );
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
      <SidebarServer collapsed={collapsed} escolaId={escolaId} escolaNome={escolaNome} />
    </div>
  );
}
