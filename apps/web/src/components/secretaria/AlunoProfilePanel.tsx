"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Calendar,
  Fingerprint,
  Loader2,
  Save,
  UserCircle,
} from "lucide-react";

import { useToast } from "@/components/feedback/FeedbackSystem";

type Props = {
  alunoId: string;
  onSuccess?: () => void;
  onDone?: () => void;
};

export function AlunoProfilePanel({ alunoId, onSuccess, onDone }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aluno, setAluno] = useState<any>(null);
  const { toast } = useToast();

  const [form, setForm] = useState({
    bi_numero: "",
    data_nascimento: "",
    pai_nome: "",
    mae_nome: "",
    responsavel: "",
    telefone_responsavel: "",
  });

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetch(`/api/secretaria/alunos/${alunoId}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        if (!active) return;
        if (!payload.ok) {
          setError(payload.error || "Falha ao carregar dados do aluno.");
          return;
        }

        setAluno(payload.item);
        setForm({
          bi_numero: payload.item.bi_numero || "",
          data_nascimento: payload.item.data_nascimento || "",
          pai_nome: payload.item.pai_nome || "",
          mae_nome: payload.item.mae_nome || "",
          responsavel: payload.item.responsavel || payload.item.responsavel_nome || "",
          telefone_responsavel: payload.item.telefone_responsavel || payload.item.responsavel_contato || "",
        });
      })
      .catch(() => {
        if (active) setError("Falha ao carregar dados do aluno.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [alunoId]);

  const handleSave = async () => {
    const hasData = Object.values(form).some((value) => value.trim() !== "");
    if (!hasData) {
      toast({
        title: "Nada para guardar",
        message: "Preencha pelo menos um campo.",
        variant: "warning",
      });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/secretaria/alunos/${alunoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload.ok) {
        toast({
          title: "Erro ao guardar",
          message: payload.error || "Não foi possível atualizar a ficha.",
          variant: "error",
        });
        return;
      }

      toast({
        title: "Ficha atualizada",
        message: "Os dados foram guardados com sucesso.",
        variant: "success",
      });
      onSuccess?.();
      onDone?.();
    } catch {
      toast({
        title: "Erro de conexão",
        message: "Não foi possível comunicar com o servidor.",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white">
        <Loader2 className="h-6 w-6 animate-spin text-emerald" />
        <p className="text-sm font-medium text-slate-500">A carregar perfil do aluno…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-2xl border border-rose-100 bg-rose-50 p-6 text-center">
        <AlertCircle className="h-8 w-8 text-rose-500" />
        <p className="text-sm font-bold text-rose-900">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-slate-50">
          <UserCircle className="h-5 w-5 text-slate-400" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Perfil</p>
          <h3 className="truncate text-lg font-black text-slate-900">{aluno?.nome || "Aluno"}</h3>
          <p className="text-xs text-slate-500">Dados essenciais para o atendimento.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Nº do BI / NIF" icon={<Fingerprint className="h-3 w-3" />}>
          <input
            type="text"
            value={form.bi_numero}
            onChange={(event) => setForm((current) => ({ ...current, bi_numero: event.target.value.toUpperCase() }))}
            placeholder="Ex: 001234567LA041"
            className={inputClass}
          />
        </Field>

        <Field label="Data de nascimento" icon={<Calendar className="h-3 w-3" />}>
          <input
            type="date"
            value={form.data_nascimento}
            onChange={(event) => setForm((current) => ({ ...current, data_nascimento: event.target.value }))}
            className={inputClass}
          />
        </Field>

        <Field label="Nome do pai">
          <input
            type="text"
            value={form.pai_nome}
            onChange={(event) => setForm((current) => ({ ...current, pai_nome: event.target.value }))}
            placeholder="Nome completo"
            className={inputClass}
          />
        </Field>

        <Field label="Nome da mãe">
          <input
            type="text"
            value={form.mae_nome}
            onChange={(event) => setForm((current) => ({ ...current, mae_nome: event.target.value }))}
            placeholder="Nome completo"
            className={inputClass}
          />
        </Field>

        <Field label="Encarregado">
          <input
            type="text"
            value={form.responsavel}
            onChange={(event) => setForm((current) => ({ ...current, responsavel: event.target.value }))}
            placeholder="Nome do encarregado"
            className={inputClass}
          />
        </Field>

        <Field label="Telefone do encarregado">
          <input
            type="text"
            value={form.telefone_responsavel}
            onChange={(event) => setForm((current) => ({ ...current, telefone_responsavel: event.target.value }))}
            placeholder="Ex: 923 000 000"
            className={inputClass}
          />
        </Field>
      </div>

      <div className="flex justify-end border-t border-slate-100 pt-5">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar alterações
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-1.5">
      <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald focus:ring-4 focus:ring-emerald/10";
