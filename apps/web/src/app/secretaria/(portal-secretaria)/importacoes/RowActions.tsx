"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useToast, useConfirm } from "@/components/feedback/FeedbackSystem";

export default function RowActions({ id, escolaId, currentName, onChanged }: { id: string; escolaId: string; currentName: string | null; onChanged?: () => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const { success, error } = useToast();
  const confirm = useConfirm();

  const onRename = async () => {
    const file_name = await confirm({
      title: "Renomear arquivo",
      message: "Indique o novo nome para este ficheiro de importação.",
      inputType: "text",
      defaultValue: currentName ?? "",
      placeholder: "Ex: Alunos_2026_V2",
      confirmLabel: "Actualizar nome",
    });

    if (!file_name || !file_name.trim()) return;
    setLoading("rename");
    try {
      const res = await fetch(`/api/migracao/${id}?escola_id=${encodeURIComponent(escolaId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_name: file_name.trim() }),
      });
      if (!res.ok) {
        const { error: apiError } = await res.json().catch(() => ({ error: "Falha ao renomear" }));
        error("Erro ao renomear", "Não conseguimos renomear o ficheiro. Por favor, tente novamente.");
        return;
      }
      success("Nome actualizado", "O ficheiro foi renomeado com sucesso.");
      onChanged?.();
      router.refresh();
    } finally {
      setLoading(null);
    }
  };

  const onDelete = async () => {
    const ok = await confirm({
      title: "Excluir importação",
      message: "Tem certeza que deseja apagar este registo? Esta acção não pode ser desfeita e os dados associados poderão ser perdidos.",
      confirmLabel: "Excluir definitivamente",
      variant: "danger",
    });

    if (!ok) return;
    setLoading("delete");
    try {
      const res = await fetch(`/api/migracao/${id}?escola_id=${encodeURIComponent(escolaId)}`, { method: "DELETE" });
      if (!res.ok) {
        const { error: apiError } = await res.json().catch(() => ({ error: "Falha ao excluir" }));
        error("Erro ao excluir", "Não foi possível apagar esta importação. Por favor, tente novamente.");
        return;
      }
      success("Importação apagada", "O registo foi removido do sistema.");
      onChanged?.();
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
        className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground hover:bg-muted"
        title="Renomear"
      >
        <Pencil size={14} /> Renomear
      </button>
      <button
        onClick={onDelete}
        disabled={loading !== null}
        className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-card px-2 py-1 text-xs text-red-700 hover:bg-red-50"
        title="Excluir"
      >
        <Trash2 size={14} /> Excluir
      </button>
    </div>
  );
}

