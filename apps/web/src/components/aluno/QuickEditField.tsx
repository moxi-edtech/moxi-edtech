"use client";

import React, { useState, useRef, useEffect } from "react";
import { Check, X, Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";

type QuickEditFieldProps = {
  label: string;
  value: string | null;
  fieldName: string;
  alunoId: string;
  type?: "text" | "tel" | "email";
  onSuccess?: (newValue: string) => void;
};

export function QuickEditField({
  label,
  value,
  fieldName,
  alunoId,
  type = "text",
  onSuccess,
}: QuickEditFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [currentValue, setCurrentValue] = useState(value || "");
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleSave = async () => {
    if (currentValue === (value || "")) {
      setIsEditing(false);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/secretaria/alunos/${encodeURIComponent(alunoId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [fieldName]: currentValue || null }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Falha ao salvar");

      toast.success(`${label} atualizado com sucesso!`);
      setIsEditing(false);
      onSuccess?.(currentValue);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setCurrentValue(value || "");
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") handleCancel();
  };

  if (isEditing) {
    return (
      <div className="flex flex-col gap-1 w-full animate-in fade-in duration-200">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type={type}
            value={currentValue}
            onChange={(e) => setCurrentValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            className="flex-1 text-sm font-medium text-slate-700 bg-white border border-moxinexa-teal/50 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-moxinexa-teal/20"
          />
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="p-1 hover:bg-emerald-50 text-emerald-600 rounded-lg transition-colors"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          </button>
          <button
            onClick={handleCancel}
            disabled={isLoading}
            className="p-1 hover:bg-rose-50 text-rose-600 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-center justify-between gap-2 min-h-[24px]">
      {value ? (
        <span className="text-sm font-medium text-slate-700 truncate">{value}</span>
      ) : (
        <span className="text-xs text-slate-400 italic">Não preenchido</span>
      )}
      <button
        onClick={() => setIsEditing(true)}
        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-100 text-slate-400 rounded-lg transition-all"
        title={`Editar ${label}`}
      >
        <Pencil className="w-3 h-3" />
      </button>
    </div>
  );
}
