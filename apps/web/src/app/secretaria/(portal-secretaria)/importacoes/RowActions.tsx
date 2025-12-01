"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";

export default function RowActions({ id, currentName }: { id: string; currentName: string | null }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const onRename = async () => {
    const next = window.prompt("Novo nome do arquivo:", currentName ?? "");
    if (next == null) return;
    const file_name = next.trim();
    if (!file_name) return;
    setLoading("rename");
    try {
      const res = await fetch(`/api/migracao/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_name }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Falha ao renomear" }));
        alert(error || "Falha ao renomear");
        return;
      }
      router.refresh();
    } finally {
      setLoading(null);
    }
  };

  const onDelete = async () => {
    if (!window.confirm("Excluir esta importação? Esta ação não pode ser desfeita.")) return;
    setLoading("delete");
    try {
      const res = await fetch(`/api/migracao/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Falha ao excluir" }));
        alert(error || "Falha ao excluir");
        return;
      }
      router.refresh();
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="inline-flex items-center gap-2">
      <button
        onClick={onRename}
        disabled={loading !== null}
        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
        title="Renomear"
      >
        <Pencil size={14} /> Renomear
      </button>
      <button
        onClick={onDelete}
        disabled={loading !== null}
        className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-2 py-1 text-xs text-red-700 hover:bg-red-50"
        title="Excluir"
      >
        <Trash2 size={14} /> Excluir
      </button>
    </div>
  );
}

