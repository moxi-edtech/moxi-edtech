"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Eye, Mail, MessageCircle, RefreshCw, Save, Settings2, FileText, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/components/feedback/FeedbackSystem";
import { Button } from "@/components/ui/Button";

type CentroItem = {
  id: string;
  escola_id: string;
  nome: string;
  abrev: string | null;
  status: string;
  plano: string;
  subscription_status: string;
  trial_ends_at: string | null;
  municipio: string | null;
  provincia: string | null;
  email: string | null;
  telefone: string | null;
  capacidade_max: number | null;
  updated_at: string | null;
  last_automated_reminder_at: string | null;
  last_manual_reminder_at: string | null;
  last_commercial_contact_at: string | null;
  commercial_notes: string | null;
  billing?: {
    id: string;
    status: string;
    data_renovacao: string;
    valor_kz: number;
    last_payment_status: string | null;
    last_payment_id: string | null;
    comprovativo_url: string | null;
  } | null;
};

type CommercialSettings = {
  banco: string;
  titular_conta: string;
  iban: string;
  numero_conta: string;
  kwik_chave: string;
  email_comercial: string;
  telefone_comercial: string;
  whatsapp_comercial: string;
  link_pagamento: string;
  lembrete_trial_template: string;
  lembrete_expirado_template: string;
  lembrete_onboarding_template: string;
  lembrete_inatividade_template: string;
  auto_reminders_enabled: boolean;
};

const emptySettings: CommercialSettings = {
  banco: "",
  titular_conta: "",
  iban: "",
  numero_conta: "",
  kwik_chave: "",
  email_comercial: "",
  telefone_comercial: "",
  whatsapp_comercial: "",
  link_pagamento: "",
  lembrete_trial_template: "",
  lembrete_expirado_template: "",
  lembrete_onboarding_template: "",
  lembrete_inatividade_template: "",
  auto_reminders_enabled: false,
};

function daysLeft(trialEndsAt: string | null) {
  if (!trialEndsAt) return null;
  return Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86_400_000);
}

function getStatus(item: CentroItem) {
  const days = daysLeft(item.trial_ends_at);
  if (item.subscription_status === "expired" || (item.subscription_status === "trial" && days !== null && days < 0)) return "expired";
  if (item.subscription_status === "trial") return "trial";
  if (item.subscription_status === "active") return "active";
  if (item.subscription_status === "past_due") return "past_due";
  return item.subscription_status;
}

function statusLabel(item: CentroItem) {
  const days = daysLeft(item.trial_ends_at);
  const status = getStatus(item);
  if (status === "expired") return "Expirado";
  if (status === "trial") return days == null ? "Trial" : `Trial · ${Math.max(0, days)} dia${days === 1 ? "" : "s"}`;
  if (status === "active") return "Activo";
  if (status === "past_due") return "Em atraso";
  return status;
}

export default function SubscricoesCockpitClient() {
  const { toast } = useToast();
  const [items, setItems] = useState<CentroItem[]>([]);
  const [settings, setSettings] = useState<CommercialSettings>(emptySettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [provinceFilter, setProvinceFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [notesEditingId, setNotesEditingId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState("");

  const notifySuccess = useCallback((title: string) => {
    toast({ variant: "success", title });
  }, [toast]);

  const notifyError = useCallback((title: string) => {
    toast({ variant: "error", title, duration: 6000 });
  }, [toast]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [centrosRes, configRes] = await Promise.all([
        fetch("/api/super-admin/centros-formacao/list", { cache: "no-store" }),
        fetch("/api/super-admin/subscricoes/config", { cache: "no-store" }),
      ]);
      const centrosJson = await centrosRes.json().catch(() => null);
      const configJson = await configRes.json().catch(() => null);
      if (!centrosRes.ok || !centrosJson?.ok) throw new Error(centrosJson?.error || "Falha ao carregar centros");
      if (!configRes.ok || !configJson?.ok) throw new Error(configJson?.error || "Falha ao carregar configuração comercial");
      setItems(Array.isArray(centrosJson.items) ? centrosJson.items : []);
      setSettings({ ...emptySettings, ...configJson.item });
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const trial = items.filter((item) => item.subscription_status === "trial").length;
    const expiring = items.filter((item) => {
      const days = daysLeft(item.trial_ends_at);
      return item.subscription_status === "trial" && days !== null && days >= 0 && days <= 2;
    }).length;
    const expired = items.filter((item) => {
      const days = daysLeft(item.trial_ends_at);
      return item.subscription_status === "expired" || (item.subscription_status === "trial" && days !== null && days < 0);
    }).length;
    return { trial, expiring, expired, active: items.filter((item) => item.subscription_status === "active").length };
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch = 
        item.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.email || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.abrev || "").toLowerCase().includes(searchTerm.toLowerCase());
      
      const status = getStatus(item);
      const matchesStatus = statusFilter === "all" || status === statusFilter;
      const matchesProvince = provinceFilter === "all" || (item.provincia || "") === provinceFilter;
      
      return matchesSearch && matchesStatus && matchesProvince;
    });
  }, [items, searchTerm, statusFilter, provinceFilter]);

  const provinces = useMemo(() => {
    return Array.from(new Set(items.map((item) => item.provincia).filter(Boolean) as string[])).sort();
  }, [items]);

  const previewMessage = useMemo(() => {
    const item = filteredItems[0] ?? items[0] ?? null;
    const days = item ? Math.max(0, daysLeft(item.trial_ends_at) ?? 0) : 3;
    const paymentData = [
      settings.banco ? `Banco: ${settings.banco}` : "",
      settings.titular_conta ? `Titular: ${settings.titular_conta}` : "",
      settings.iban ? `IBAN: ${settings.iban}` : "",
      settings.numero_conta ? `Conta: ${settings.numero_conta}` : "",
      settings.kwik_chave ? `Kwik: ${settings.kwik_chave}` : "",
      settings.link_pagamento ? `Link: ${settings.link_pagamento}` : "",
    ].filter(Boolean).join(" | ") || "dados de pagamento ainda não configurados";
    return (settings.lembrete_trial_template || "Olá {{centro_nome}}, o trial termina em {{dias_restantes}} dia(s). Dados de pagamento: {{dados_pagamento}}")
      .split("{{centro_nome}}").join(item?.nome || "Centro Exemplo")
      .split("{{dias_restantes}}").join(String(days))
      .split("{{dados_pagamento}}").join(paymentData)
      .split("{{email_comercial}}").join(settings.email_comercial)
      .split("{{telefone_comercial}}").join(settings.telefone_comercial)
      .split("{{whatsapp_comercial}}").join(settings.whatsapp_comercial)
      .split("{{link_pagamento}}").join(settings.link_pagamento)
      .split("{{dias_sem_onboarding}}").join("3")
      .split("{{progresso_onboarding}}").join("3/6")
      .split("{{etapas_pendentes}}").join("1. Turma em estado Aberto - Mudar o status de pelo menos uma turma para 'aberta'.\n2. Configuração Fiscal - Vincular o centro a uma empresa fiscal.")
      .split("{{dias_sem_acesso}}").join("5")
      .split("{{login_url}}").join("https://app.klasse.ao/login");
  }, [filteredItems, items, settings]);

  async function saveSettings() {
    setSaving(true);
    try {
      const res = await fetch("/api/super-admin/subscricoes/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item: settings }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao guardar configuração");
      setSettings({ ...emptySettings, ...json.item });
      notifySuccess("Configuração comercial atualizada");
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setSaving(false);
    }
  }

  async function extendTrial(item: CentroItem) {
    setBusyId(item.escola_id);
    try {
      const res = await fetch(`/api/super-admin/centros-formacao/${item.escola_id}/trial/extend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: 5 }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao prolongar trial");
      notifySuccess(`Trial prolongado para ${item.nome}`);
      await load();
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setBusyId(null);
    }
  }

  async function sendReminder(item: CentroItem) {
    setBusyId(item.escola_id);
    try {
      const res = await fetch(`/api/super-admin/centros-formacao/${item.escola_id}/trial/reminder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "email" }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao enviar lembrete");
      notifySuccess(`Lembrete enviado para ${json.to || item.email}`);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setBusyId(null);
    }
  }

  async function sendBulkReminders() {
    const targets = items.filter((item) => selectedIds.includes(item.escola_id));
    if (targets.length === 0) {
      toast({ variant: "info", title: "Selecione pelo menos um centro." });
      return;
    }
    if (!confirm(`Enviar lembrete por e-mail para ${targets.length} centro(s)?`)) return;

    setBusyId("bulk");
    let sent = 0;
    try {
      for (const item of targets) {
        const res = await fetch(`/api/super-admin/centros-formacao/${item.escola_id}/trial/reminder`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channel: "email" }),
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.ok) sent += 1;
      }
      notifySuccess(`${sent}/${targets.length} lembrete(s) enviados.`);
      setSelectedIds([]);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function saveNotes(item: CentroItem) {
    setBusyId(item.escola_id);
    try {
      const res = await fetch(`/api/super-admin/centros-formacao/${item.escola_id}/trial/notes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notesDraft }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao guardar notas");
      notifySuccess("Notas comerciais atualizadas");
      setNotesEditingId(null);
      setNotesDraft("");
      await load();
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setBusyId(null);
    }
  }

  async function openWhatsapp(item: CentroItem) {
    setBusyId(item.escola_id);
    try {
      const res = await fetch(`/api/super-admin/centros-formacao/${item.escola_id}/trial/reminder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "whatsapp" }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao preparar WhatsApp");
      if (json.url) window.open(json.url, "_blank", "noopener,noreferrer");
      else toast({ variant: "info", title: "Mensagem preparada, mas o centro não tem telefone/WhatsApp válido." });
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setBusyId(null);
    }
  }

  async function handleConfirmPayment(item: CentroItem) {
    if (!item.billing?.id || !item.billing?.last_payment_id) {
      notifyError("Dados de pagamento incompletos");
      return;
    }

    if (!confirm(`Deseja confirmar o pagamento de ${item.nome} e activar a subscrição?`)) return;

    setBusyId(item.escola_id);
    try {
      const res = await fetch(`/api/super-admin/billing/assinaturas/${item.billing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          action: "confirm_receipt", 
          pagamento_id: item.billing.last_payment_id 
        }),
      });

      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao confirmar pagamento");

      notifySuccess(`Pagamento confirmado e subscrição activada para ${item.nome}`);
      await load();
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRejectPayment(item: CentroItem) {
    if (!item.billing?.id || !item.billing?.last_payment_id) {
      notifyError("Dados de pagamento incompletos");
      return;
    }

    if (!confirm(`Deseja rejeitar o comprovativo de ${item.nome}?`)) return;

    setBusyId(item.escola_id);
    try {
      const res = await fetch(`/api/super-admin/billing/assinaturas/${item.billing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reject_receipt",
          pagamento_id: item.billing.last_payment_id
        }),
      });

      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao rejeitar comprovativo");

      notifySuccess(`Comprovativo rejeitado para ${item.nome}`);
      await load();
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-4">
        <Stat label="Centros em trial" value={stats.trial} tone="gold" />
        <Stat label="Expiram em 48h" value={stats.expiring} tone="amber" />
        <Stat label="Expirados" value={stats.expired} tone="rose" />
        <Stat label="Ativos" value={stats.active} tone="green" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-950">Cockpit comercial</h2>
              <p className="text-xs text-slate-500">Ações rápidas para trials e conversão de centros.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/50 px-5 py-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Buscar centro, email ou sigla..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-klasse-green focus:ring-1 focus:ring-klasse-green/20"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-klasse-green"
            >
              <option value="all">Todos os estados</option>
              <option value="trial">Em Trial</option>
              <option value="active">Ativos</option>
              <option value="expired">Expirados</option>
              <option value="past_due">Em atraso</option>
            </select>
            <select
              value={provinceFilter}
              onChange={(e) => setProvinceFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-klasse-green"
            >
              <option value="all">Todas províncias</option>
              {provinces.map((province) => (
                <option key={province} value={province}>{province}</option>
              ))}
            </select>
            <Button size="sm" variant="secondary" onClick={sendBulkReminders} disabled={busyId === "bulk" || selectedIds.length === 0}>
              <Mail className="h-3 w-3" />
              Enviar selecionados ({selectedIds.length})
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">
                    <input
                      type="checkbox"
                      checked={filteredItems.length > 0 && filteredItems.every((item) => selectedIds.includes(item.escola_id))}
                      onChange={(event) => {
                        const ids = filteredItems.map((item) => item.escola_id);
                        setSelectedIds((current) =>
                          event.target.checked
                            ? Array.from(new Set([...current, ...ids]))
                            : current.filter((id) => !ids.includes(id))
                        );
                      }}
                    />
                  </th>
                  <th className="px-4 py-3 font-semibold">Centro</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 font-semibold">Faturação</th>
                  <th className="px-4 py-3 font-semibold">Contacto</th>
                  <th className="px-4 py-3 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td className="px-4 py-5 text-slate-500" colSpan={6}>A carregar subscrições...</td></tr>
                ) : filteredItems.length === 0 ? (
                  <tr><td className="px-4 py-5 text-center text-slate-500" colSpan={6}>Nenhum centro encontrado para os filtros aplicados.</td></tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(item.escola_id)}
                          onChange={(event) => {
                            setSelectedIds((current) =>
                              event.target.checked
                                ? Array.from(new Set([...current, item.escola_id]))
                                : current.filter((id) => id !== item.escola_id)
                            );
                          }}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{item.nome}</p>
                        <p className="text-xs text-slate-500">{item.abrev || item.escola_id}</p>
                        {item.commercial_notes ? (
                          <p className="mt-1 max-w-[260px] truncate text-[11px] text-slate-500">Nota: {item.commercial_notes}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                          getStatus(item) === 'active' ? 'border-green-200 bg-green-50 text-green-700' :
                          getStatus(item) === 'expired' ? 'border-rose-200 bg-rose-50 text-rose-700' :
                          'border-slate-200 bg-slate-50 text-slate-700'
                        }`}>
                          {statusLabel(item)}
                        </span>
                        <p className="mt-1 text-xs text-slate-500">Plano {item.plano}</p>
                      </td>
                      <td className="px-4 py-3">
                        {item.billing ? (
                          <>
                            <div className="flex items-center gap-1.5">
                              <span className={`h-1.5 w-1.5 rounded-full ${
                                item.billing.last_payment_status === 'confirmado' ? 'bg-green-500' :
                                item.billing.last_payment_status === 'pendente' ? 'bg-amber-500' :
                                'bg-slate-300'
                              }`} />
                              <span className="font-semibold text-slate-900">
                                {item.billing.last_payment_status === 'confirmado' ? 'Pago' : 
                                 item.billing.last_payment_status === 'pendente' ? 'Pendente' : 'Sem prova'}
                              </span>
                            </div>
                            <div className="mt-1 flex flex-col gap-1">
                              <p className="text-[10px] text-slate-500 uppercase tracking-tight">
                                Renova: {new Date(item.billing.data_renovacao).toLocaleDateString()}
                              </p>
                              {item.billing.comprovativo_url && (
                                <a 
                                  href={item.billing.comprovativo_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-[10px] font-bold text-klasse-green hover:underline flex items-center gap-1"
                                >
                                  <FileText className="h-3 w-3" /> Ver Prova
                                </a>
                              )}
                            </div>
                          </>
                        ) : (
                          <span className="text-xs italic text-slate-400">Sem subscrição</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <p className="max-w-[180px] truncate">{item.email || "sem email"}</p>
                        <p className="text-xs text-slate-500">{item.telefone || "sem telefone"}</p>
                        {item.last_automated_reminder_at && (
                          <p className="mt-1 text-[9px] font-bold uppercase text-blue-600">
                            Auto-lembrete: {new Date(item.last_automated_reminder_at).toLocaleDateString()}
                          </p>
                        )}
                        {item.last_commercial_contact_at && (
                          <p className="mt-1 text-[9px] font-bold uppercase text-slate-500">
                            Último contacto: {new Date(item.last_commercial_contact_at).toLocaleDateString()}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-end gap-2">
                          {item.billing?.last_payment_status === 'pendente' && (
                            <>
                              <Button size="sm" onClick={() => handleConfirmPayment(item)} disabled={busyId === item.escola_id} className="bg-klasse-green hover:bg-klasse-green/90">
                                <CheckCircle2 className="h-3 w-3 mr-1" /> Confirmar
                              </Button>
                              <Button size="sm" variant="secondary" onClick={() => handleRejectPayment(item)} disabled={busyId === item.escola_id} className="border-rose-200 text-rose-700 hover:bg-rose-50">
                                <XCircle className="h-3 w-3 mr-1" /> Rejeitar
                              </Button>
                            </>
                          )}
                          <Button size="sm" variant="secondary" onClick={() => sendReminder(item)} disabled={busyId === item.escola_id}>
                            <Mail className="h-3 w-3 sm:mr-1" />
                            <span className="hidden sm:inline">Email</span>
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => openWhatsapp(item)} disabled={busyId === item.escola_id}>
                            <MessageCircle className="h-3 w-3 sm:mr-1" />
                            <span className="hidden sm:inline">WhatsApp</span>
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => extendTrial(item)} disabled={busyId === item.escola_id}>
                            +5d
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setNotesEditingId(item.escola_id);
                              setNotesDraft(item.commercial_notes || "");
                            }}
                          >
                            Nota
                          </Button>
                        </div>
                        {notesEditingId === item.escola_id ? (
                          <div className="mt-3 min-w-[280px] rounded-xl border border-slate-200 bg-white p-3">
                            <textarea
                              className={`${inputClass} min-h-20 resize-y`}
                              value={notesDraft}
                              onChange={(event) => setNotesDraft(event.target.value)}
                              placeholder="Ex: Diretor prometeu comprovativo até 6ª feira"
                            />
                            <div className="mt-2 flex justify-end gap-2">
                              <Button size="sm" variant="ghost" onClick={() => setNotesEditingId(null)}>Cancelar</Button>
                              <Button size="sm" onClick={() => saveNotes(item)} disabled={busyId === item.escola_id}>Guardar</Button>
                            </div>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-base font-bold text-slate-950">
                <Settings2 className="h-4 w-4 text-slate-500" />
                Configuração comercial
              </h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">Dados usados em lembretes, emails e instruções de pagamento.</p>
            </div>
            <Link href="/super-admin/cobrancas" className="text-xs font-semibold text-klasse-green hover:underline">Cobranças</Link>
          </div>

          {previewOpen ? (
            <div className="mt-4 rounded-xl border border-klasse-green/20 bg-klasse-green/5 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-klasse-green">Preview do lembrete</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{previewMessage}</p>
            </div>
          ) : null}

          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-900">Automação de Lembretes</p>
                  <p className="text-[10px] text-slate-500">Trial, onboarding incompleto e centros sem acesso recente.</p>
                </div>
                <input 
                  type="checkbox" 
                  checked={settings.auto_reminders_enabled} 
                  onChange={(e) => setSettings(p => ({ ...p, auto_reminders_enabled: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 text-klasse-green focus:ring-klasse-green"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Banco"><input className={inputClass} value={settings.banco} onChange={(e) => setSettings((p) => ({ ...p, banco: e.target.value }))} /></Field>
              <Field label="Número de conta"><input className={inputClass} value={settings.numero_conta} onChange={(e) => setSettings((p) => ({ ...p, numero_conta: e.target.value }))} /></Field>
            </div>
            <Field label="Titular"><input className={inputClass} value={settings.titular_conta} onChange={(e) => setSettings((p) => ({ ...p, titular_conta: e.target.value }))} /></Field>
            <Field label="IBAN"><input className={inputClass} value={settings.iban} onChange={(e) => setSettings((p) => ({ ...p, iban: e.target.value.toUpperCase() }))} /></Field>
            <Field label="Chave Kwik"><input className={inputClass} value={settings.kwik_chave} onChange={(e) => setSettings((p) => ({ ...p, kwik_chave: e.target.value }))} /></Field>
            
            <div className="h-px bg-slate-100" />
            
            <Field label="E-mail comercial"><input className={inputClass} value={settings.email_comercial} onChange={(e) => setSettings((p) => ({ ...p, email_comercial: e.target.value }))} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Telefone"><input className={inputClass} value={settings.telefone_comercial} onChange={(e) => setSettings((p) => ({ ...p, telefone_comercial: e.target.value }))} /></Field>
              <Field label="WhatsApp"><input className={inputClass} value={settings.whatsapp_comercial} onChange={(e) => setSettings((p) => ({ ...p, whatsapp_comercial: e.target.value }))} /></Field>
            </div>
            <Field label="Link de pagamento"><input className={inputClass} value={settings.link_pagamento} onChange={(e) => setSettings((p) => ({ ...p, link_pagamento: e.target.value }))} /></Field>
            <Field label="Template trial"><textarea className={`${inputClass} min-h-24 resize-y`} value={settings.lembrete_trial_template} onChange={(e) => setSettings((p) => ({ ...p, lembrete_trial_template: e.target.value }))} /></Field>
            <Field label="Template expirado"><textarea className={`${inputClass} min-h-24 resize-y`} value={settings.lembrete_expirado_template} onChange={(e) => setSettings((p) => ({ ...p, lembrete_expirado_template: e.target.value }))} /></Field>
            <Field label="Template onboarding pendente"><textarea className={`${inputClass} min-h-24 resize-y`} value={settings.lembrete_onboarding_template} onChange={(e) => setSettings((p) => ({ ...p, lembrete_onboarding_template: e.target.value }))} /></Field>
            <Field label="Template inatividade"><textarea className={`${inputClass} min-h-24 resize-y`} value={settings.lembrete_inatividade_template} onChange={(e) => setSettings((p) => ({ ...p, lembrete_inatividade_template: e.target.value }))} /></Field>
          </div>

          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <Button variant="secondary" onClick={() => setPreviewOpen((current) => !current)}>
              <Eye className="mr-2 h-4 w-4" />
              Preview
            </Button>
            <Button className="shadow-lg shadow-klasse-green/10" onClick={saveSettings} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "A guardar..." : "Guardar"}
            </Button>
          </div>
        </aside>
      </section>
    </div>
  );
}

const inputClass = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-klasse-green focus:bg-white";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="ml-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "gold" | "amber" | "rose" | "green" }) {
  const colors = {
    gold: "text-klasse-gold",
    amber: "text-amber-700",
    rose: "text-rose-700",
    green: "text-klasse-green",
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className={`mt-2 text-3xl font-black ${colors[tone]}`}>{value}</p>
    </div>
  );
}
