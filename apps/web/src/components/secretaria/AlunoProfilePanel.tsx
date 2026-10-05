"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertCircle,
  Calendar,
  Fingerprint,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Save,
  UserCheck,
  Users,
} from "lucide-react";

import { useToast } from "@/components/feedback/FeedbackSystem";

type ProfileForm = {
  bi_numero: string;
  data_nascimento: string;
  telefone: string;
  email: string;
  endereco: string;
  pai_nome: string;
  mae_nome: string;
  responsavel: string;
  encarregado_relacao: string;
  telefone_responsavel: string;
  encarregado_email: string;
};

type AlunoProfileItem = Partial<ProfileForm> & {
  responsavel_nome?: string | null;
  responsavel_contato?: string | null;
};

type Props = {
  alunoId: string;
  onSuccess?: () => void;
  onDone?: () => void;
};

const EMPTY_FORM: ProfileForm = {
  bi_numero: "",
  data_nascimento: "",
  telefone: "",
  email: "",
  endereco: "",
  pai_nome: "",
  mae_nome: "",
  responsavel: "",
  encarregado_relacao: "",
  telefone_responsavel: "",
  encarregado_email: "",
};

function toForm(item: AlunoProfileItem): ProfileForm {
  return {
    bi_numero: item.bi_numero || "",
    data_nascimento: item.data_nascimento || "",
    telefone: item.telefone || "",
    email: item.email || "",
    endereco: item.endereco || "",
    pai_nome: item.pai_nome || "",
    mae_nome: item.mae_nome || "",
    responsavel: item.responsavel || item.responsavel_nome || "",
    encarregado_relacao: item.encarregado_relacao || "",
    telefone_responsavel: item.telefone_responsavel || item.responsavel_contato || "",
    encarregado_email: item.encarregado_email || "",
  };
}

export function AlunoProfilePanel({ alunoId, onSuccess, onDone }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);
  const [savedForm, setSavedForm] = useState<ProfileForm>(EMPTY_FORM);
  const { toast } = useToast();

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    void fetch(`/api/secretaria/alunos/${alunoId}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => response.json().then((payload) => ({ response, payload })))
      .then(({ response, payload }) => {
        if (!response.ok || !payload?.ok || !payload?.item) {
          setError(payload?.error || "Falha ao carregar dados do aluno.");
          return;
        }

        const next = toForm(payload.item as AlunoProfileItem);
        setForm(next);
        setSavedForm(next);
      })
      .catch((fetchError) => {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") return;
        setError("Falha ao carregar dados do aluno.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [alunoId]);

  const changedEntries = useMemo(
    () =>
      (Object.keys(form) as Array<keyof ProfileForm>)
        .filter((key) => form[key] !== savedForm[key])
        .map((key) => [key, form[key]] as const),
    [form, savedForm],
  );
  const hasChanges = changedEntries.length > 0;

  const updateField = (field: keyof ProfileForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSave = async () => {
    if (!hasChanges || saving) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/secretaria/alunos/${alunoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(changedEntries)),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload?.ok) {
        toast({
          title: "Erro ao guardar",
          message: payload?.error || "Não foi possível atualizar a ficha.",
          variant: "error",
        });
        return;
      }

      setSavedForm(form);
      toast({
        title: "Ficha atualizada",
        message: "As alterações foram guardadas.",
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
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        <p className="text-sm font-medium text-slate-500">A carregar ficha do aluno…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-xl border border-red-100 bg-red-50 p-6 text-center">
        <AlertCircle className="h-8 w-8 text-red-500" />
        <p className="text-sm font-bold text-red-900">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50">
            <Fingerprint className="h-4 w-4 text-slate-400" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-900">Identificação e contacto</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Atualize somente os dados que mudaram.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Nº do BI / documento" icon={<Fingerprint className="h-3.5 w-3.5" />}>
            <input
              type="text"
              value={form.bi_numero}
              onChange={(event) => updateField("bi_numero", event.target.value.toUpperCase())}
              placeholder="Ex: 001234567LA041"
              className={inputClass}
            />
          </Field>

          <Field label="Data de nascimento" icon={<Calendar className="h-3.5 w-3.5" />}>
            <input
              type="date"
              value={form.data_nascimento}
              onChange={(event) => updateField("data_nascimento", event.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Telefone do aluno" icon={<Phone className="h-3.5 w-3.5" />}>
            <input
              type="tel"
              value={form.telefone}
              onChange={(event) => updateField("telefone", event.target.value)}
              placeholder="Ex: 923 000 000"
              className={inputClass}
            />
          </Field>

          <Field label="Email do aluno" icon={<Mail className="h-3.5 w-3.5" />}>
            <input
              type="email"
              value={form.email}
              onChange={(event) => updateField("email", event.target.value)}
              placeholder="aluno@exemplo.com"
              className={inputClass}
            />
          </Field>

          <div className="md:col-span-2">
            <Field label="Morada" icon={<MapPin className="h-3.5 w-3.5" />}>
              <input
                type="text"
                value={form.endereco}
                onChange={(event) => updateField("endereco", event.target.value)}
                placeholder="Morada atual"
                className={inputClass}
              />
            </Field>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50">
            <UserCheck className="h-4 w-4 text-slate-400" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-900">Encarregado e família</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Contactos usados pela escola durante o atendimento.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Encarregado" icon={<UserCheck className="h-3.5 w-3.5" />}>
            <input
              type="text"
              value={form.responsavel}
              onChange={(event) => updateField("responsavel", event.target.value)}
              placeholder="Nome do encarregado"
              className={inputClass}
            />
          </Field>

          <Field label="Relação com o aluno">
            <input
              type="text"
              value={form.encarregado_relacao}
              onChange={(event) => updateField("encarregado_relacao", event.target.value)}
              placeholder="Ex: Mãe, Pai, Tutor"
              className={inputClass}
            />
          </Field>

          <Field label="Telefone do encarregado" icon={<Phone className="h-3.5 w-3.5" />}>
            <input
              type="tel"
              value={form.telefone_responsavel}
              onChange={(event) => updateField("telefone_responsavel", event.target.value)}
              placeholder="Ex: 923 000 000"
              className={inputClass}
            />
          </Field>

          <Field label="Email do encarregado" icon={<Mail className="h-3.5 w-3.5" />}>
            <input
              type="email"
              value={form.encarregado_email}
              onChange={(event) => updateField("encarregado_email", event.target.value)}
              placeholder="encarregado@exemplo.com"
              className={inputClass}
            />
          </Field>

          <Field label="Nome do pai" icon={<Users className="h-3.5 w-3.5" />}>
            <input
              type="text"
              value={form.pai_nome}
              onChange={(event) => updateField("pai_nome", event.target.value)}
              placeholder="Nome completo"
              className={inputClass}
            />
          </Field>

          <Field label="Nome da mãe" icon={<Users className="h-3.5 w-3.5" />}>
            <input
              type="text"
              value={form.mae_nome}
              onChange={(event) => updateField("mae_nome", event.target.value)}
              placeholder="Nome completo"
              className={inputClass}
            />
          </Field>
        </div>
      </div>

      <div className="sticky bottom-3 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur">
        <p className="text-xs text-slate-500">
          {hasChanges ? `${changedEntries.length} alteração(ões) por guardar` : "Sem alterações pendentes"}
        </p>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || !hasChanges}
          className="inline-flex items-center gap-2 rounded-xl bg-klasse-gold px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "A guardar…" : "Guardar alterações"}
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
  icon?: ReactNode;
  children: ReactNode;
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
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20";
