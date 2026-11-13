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
  alwaysVisible?: boolean;
};

export function QuickEditField({
  label,
  value,
  fieldName,
  alunoId,
  type = "text",
  onSuccess,
  alwaysVisible = false,
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
    const nextValue = fieldName === "nome" ? currentValue.trim().replace(/\s+/g, " ") : currentValue;
    if (fieldName === "nome" && (nextValue.length < 2 || nextValue.length > 160)) {
      toast.error("Informe um nome entre 2 e 160 caracteres.");
      return;
    }
    if (nextValue === (value || "")) {
      setIsEditing(false);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/secretaria/alunos/${encodeURIComponent(alunoId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fieldName === "nome"
          ? { nome: nextValue, nome_anterior: value }
          : { [fieldName]: nextValue || null }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Falha ao salvar");

      toast.success(`${label} atualizado com sucesso!`);
      setIsEditing(false);
      onSuccess?.(nextValue);
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
            aria-label={label}
            maxLength={fieldName === "nome" ? 160 : undefined}
            onChange={(e) => setCurrentValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            className="min-w-0 flex-1 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium text-foreground focus:border-ring focus:outline-none focus:ring-4 focus:ring-ring/20"
          />
          <button
            type="button"
            aria-label={`Guardar ${label}`}
            onClick={handleSave}
            disabled={isLoading}
            className="p-1 hover:bg-emerald-50 text-emerald-600 rounded-lg transition-colors"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          </button>
          <button
            type="button"
            aria-label={`Cancelar edição de ${label}`}
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
        type="button"
        onClick={() => setIsEditing(true)}
        className={`inline-flex items-center gap-1 rounded-xl p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring ${alwaysVisible ? "" : "md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"}`}
        title={`Editar ${label}`}
        aria-label={`Editar ${label}`}
      >
        <Pencil className="h-4 w-4" />
        {alwaysVisible ? <span className="text-xs font-semibold">Editar nome</span> : null}
      </button>
    </div>
  );
}
