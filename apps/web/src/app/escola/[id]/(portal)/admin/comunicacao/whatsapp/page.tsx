"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { Check, Copy, MessageSquare, RefreshCw, Search, Send, ShieldCheck, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { useToast } from "@/components/feedback/FeedbackSystem";
import { buildPortalHref } from "@/lib/navigation";

type Props = {
  params: Promise<{ id: string }>;
};

type Template = {
  key: string;
  title: string;
  category: string;
  body: string;
  risk_level: string;
  requires_approval: boolean;
};

type OutboxItem = {
  id: string;
  message_type: string;
  recipient_name: string;
  recipient_phone_masked: string | null;
  title: string | null;
  body: string;
  template_key: string | null;
  status: string;
  risk_level: string;
  requires_approval: boolean;
  retry_count: number;
  last_error: string | null;
  created_at: string;
  approved_at: string | null;
  queued_at: string | null;
  sent_at: string | null;
  failed_at: string | null;
};

type Recipient = {
  id: string;
  type: string;
  name: string;
  studentName?: string;
  phoneMasked: string;
};

type LogItem = {
  id: string;
  outbox_id: string | null;
  event_type: string;
  provider_event_id: string | null;
  created_at: string;
};

type DashboardData = {
  experimentalEnabled: boolean;
  provider: null | {
    status: string;
    sessionNameMasked: string | null;
    dailyLimit: number | null;
    monthlyLimit: number | null;
    updatedAt: string | null;
  };
  session: { status: string; rawStatus: string | null };
  canManageSession: boolean;
  summary: { queueCount: number; sentToday: number; failedToday: number; lastSyncAt: string };
  outbox: OutboxItem[];
  templates: Template[];
  logs: LogItem[];
};

const messageTypes = [
  ["manual_message", "Mensagem manual"],
  ["school_notice", "Comunicado escolar"],
  ["finance_charge", "Cobrança financeira"],
  ["document_ready", "Documento pronto"],
  ["ai_generated_draft", "Rascunho IA"],
] as const;

const statusLabel: Record<string, string> = {
  draft: "Rascunho",
  review_required: "Revisão",
  approved: "Aprovado",
  queued: "Fila",
  sending: "Enviando",
  sent: "Enviado",
  delivered: "Entregue",
  read: "Lido",
  failed: "Falhou",
  cancelled: "Cancelado",
  rejected: "Rejeitado",
  connected: "Conectado",
  pending_qr: "QR pendente",
  disconnected: "Desconectado",
  error: "Erro",
  disabled: "Desativado",
};

function statusClass(status: string) {
  if (["connected", "sent", "delivered", "read"].includes(status)) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (["pending_qr", "queued", "sending", "review_required"].includes(status)) return "bg-amber-50 text-amber-700 border-amber-200";
  if (["failed", "error", "rejected"].includes(status)) return "bg-red-50 text-red-700 border-red-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-PT", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export default function WhatsAppKlassePage({ params }: Props) {
  const { id: escolaId } = use(params);
  const { error, success } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"fila" | "enviadas" | "falhas" | "templates" | "logs">("fila");
  const [data, setData] = useState<DashboardData | null>(null);
  const [recipientType, setRecipientType] = useState<"aluno" | "professor" | "manual">("aluno");
  const [search, setSearch] = useState("");
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<Recipient[]>([]);
  const [form, setForm] = useState({
    messageType: "manual_message",
    templateKey: "",
    recipientName: "",
    recipientPhone: "",
    title: "",
    body: "",
  });

  const apiBase = `/api/escola/${escolaId}/admin/comunicacao/whatsapp`;
  const configHref = buildPortalHref(escolaId, "/admin/configuracoes/comunicacao");

  const filteredOutbox = useMemo(() => {
    const rows = data?.outbox || [];
    if (activeTab === "fila") return rows.filter((row) => ["draft", "review_required", "approved", "queued", "sending"].includes(row.status));
    if (activeTab === "enviadas") return rows.filter((row) => ["sent", "delivered", "read"].includes(row.status));
    if (activeTab === "falhas") return rows.filter((row) => row.status === "failed");
    return rows;
  }, [activeTab, data?.outbox]);

  const selectedTemplate = useMemo(
    () => data?.templates.find((template) => template.key === form.templateKey) || null,
    [data?.templates, form.templateKey]
  );

  async function loadDashboard() {
    try {
      setLoading(true);
      const res = await fetch(apiBase, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        error(json?.error || "Falha ao carregar WhatsApp KLASSE.");
        return;
      }
      setData(json.data);
    } catch (err) {
      console.error(err);
      error("Erro inesperado ao carregar WhatsApp KLASSE.");
    } finally {
      setLoading(false);
    }
  }

  async function searchRecipients() {
    if (recipientType === "manual") return;
    const res = await fetch(`${apiBase}/recipients?type=${recipientType}&q=${encodeURIComponent(search)}`, { cache: "no-store" });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      error(json?.error || "Falha ao consultar destinatários.");
      return;
    }
    setRecipients(json.data || []);
  }

  async function createMessage(recipient: Recipient | null) {
    const payload = {
      messageType: form.messageType,
      recipientType: recipient?.type || "manual",
      recipientRefId: recipient?.id || null,
      recipientName: recipient?.name || form.recipientName,
      recipientPhone: recipient ? null : form.recipientPhone,
      title: form.title || selectedTemplate?.title || "WhatsApp KLASSE",
      body: form.body || selectedTemplate?.body || "",
      templateKey: form.templateKey || null,
      variables: {},
      sourceModule: "comunicacao",
    };

    const res = await fetch(apiBase, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao criar mensagem.");
    return json.data;
  }

  async function submitMessage() {
    try {
      setSaving(true);
      if (recipientType !== "manual" && selectedRecipients.length === 0) {
        error("Selecione pelo menos um destinatário.");
        return;
      }
      const targets = recipientType === "manual" ? [null] : selectedRecipients.slice(0, 25);
      for (const target of targets) await createMessage(target);
      success(
        targets.length > 1
          ? `Serão criadas ${targets.length} mensagens na fila. O envio será processado gradualmente.`
          : "Mensagem criada na fila do WhatsApp KLASSE."
      );
      setSelectedRecipients([]);
      await loadDashboard();
    } catch (err) {
      error(err instanceof Error ? err.message : "Falha ao criar mensagem.");
    } finally {
      setSaving(false);
    }
  }

  async function submitBulk(messageType: "school_notice" | "finance_charge") {
    if (recipientType !== "aluno" || selectedRecipients.length === 0) {
      error("Selecione alunos/encarregados antes de criar o lote.");
      return;
    }
    const targets = selectedRecipients.slice(0, 50);
    const confirmMessage = `Serão criadas ${targets.length} mensagens na fila. O envio será processado gradualmente.`;
    if (!window.confirm(confirmMessage)) return;

    setSaving(true);
    try {
      const res = await fetch(`${apiBase}/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageType,
          title: form.title || (messageType === "finance_charge" ? "Cobrança financeira" : "Comunicado escolar"),
          body: form.body || selectedTemplate?.body || "",
          templateKey: form.templateKey || (messageType === "finance_charge" ? "finance_friendly_reminder" : "school_general_notice"),
          noticeBody: form.body,
          filters: { alunoIds: targets.map((recipient) => recipient.id) },
          expectedCount: targets.length,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao criar lote.");
      success(`${confirmMessage} Criadas: ${json.data?.created ?? 0}.`);
      setSelectedRecipients([]);
      await loadDashboard();
    } catch (err) {
      error(err instanceof Error ? err.message : "Falha ao criar lote.");
    } finally {
      setSaving(false);
    }
  }

  async function sendStudentAccess() {
    const student = selectedRecipients[0];
    if (!student) {
      error("Selecione um aluno/encarregado para enviar acesso.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${apiBase}/access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alunoId: student.id, templateKey: form.templateKey || "student_access_activation" }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao criar envio de acesso.");
      success("Acesso do aluno criado na fila do WhatsApp KLASSE.");
      await loadDashboard();
    } catch (err) {
      error(err instanceof Error ? err.message : "Falha ao enviar acesso.");
    } finally {
      setSaving(false);
    }
  }

  async function patchOutbox(id: string, action: string) {
    const res = await fetch(`${apiBase}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      error(json?.error || "Falha ao atualizar mensagem.");
      return;
    }
    success("Mensagem atualizada.");
    await loadDashboard();
  }

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escolaId]);

  useEffect(() => {
    const timer = setTimeout(() => searchRecipients(), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, recipientType]);

  const sessionStatus = data?.session.status || data?.provider?.status || "disconnected";
  const disabledMessage = data && !data.experimentalEnabled ? "WhatsApp KLASSE está desativado neste ambiente." : null;
  const disconnectedMessage =
    data && data.experimentalEnabled && sessionStatus !== "connected"
      ? "WhatsApp da escola está desconectado. Conecte a sessão antes de enviar mensagens."
      : null;

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-700">Comunicação</p>
            <h1 className="text-2xl font-semibold text-slate-950">WhatsApp KLASSE</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={loadDashboard} disabled={loading}>
              <RefreshCw className="h-4 w-4" /> Atualizar
            </Button>
            {data?.canManageSession ? (
              <Button asChild variant="outline">
                <Link href={configHref}>Configurar sessão</Link>
              </Button>
            ) : null}
          </div>
        </header>

        {disabledMessage || disconnectedMessage ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {disabledMessage || disconnectedMessage}
          </div>
        ) : null}

        <section className="grid gap-3 md:grid-cols-5">
          {[
            ["Status", statusLabel[sessionStatus] || sessionStatus],
            ["Em fila", data?.summary.queueCount ?? 0],
            ["Enviadas hoje", data?.summary.sentToday ?? 0],
            ["Falhas hoje", data?.summary.failedToday ?? 0],
            ["Última sync", data ? formatDate(data.summary.lastSyncAt) : "-"],
          ].map(([label, value]) => (
            <Card key={label} className="rounded-md shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
                <p className="mt-2 text-xl font-semibold text-slate-950">{String(value)}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-[420px_1fr]">
          <Card className="rounded-md shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="h-4 w-4" /> Nova mensagem
              </CardTitle>
              <CardDescription>Cria rascunhos auditáveis e itens de fila no servidor.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {(["aluno", "professor", "manual"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setRecipientType(type);
                      setSelectedRecipients([]);
                    }}
                    className={`rounded-md border px-3 py-2 text-sm ${recipientType === type ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "bg-white text-slate-700"}`}
                  >
                    {type === "aluno" ? "Aluno" : type === "professor" ? "Professor" : "Manual"}
                  </button>
                ))}
              </div>

              {recipientType === "manual" ? (
                <div className="grid gap-2">
                  <input className="rounded-md border px-3 py-2 text-sm" placeholder="Nome do destinatário" value={form.recipientName} onChange={(e) => setForm({ ...form, recipientName: e.target.value })} />
                  <input className="rounded-md border px-3 py-2 text-sm" placeholder="+244..." value={form.recipientPhone} onChange={(e) => setForm({ ...form, recipientPhone: e.target.value })} />
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 rounded-md border bg-white px-3 py-2">
                    <Search className="h-4 w-4 text-slate-400" />
                    <input className="w-full bg-transparent text-sm outline-none" placeholder="Pesquisar destinatário" value={search} onChange={(e) => setSearch(e.target.value)} />
                  </div>
                  <div className="max-h-44 overflow-auto rounded-md border bg-white">
                    {recipients.map((recipient) => {
                      const checked = selectedRecipients.some((item) => item.id === recipient.id);
                      return (
                        <button
                          type="button"
                          key={recipient.id}
                          onClick={() =>
                            setSelectedRecipients((current) =>
                              checked ? current.filter((item) => item.id !== recipient.id) : [...current, recipient]
                            )
                          }
                          className="flex w-full items-center justify-between border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-slate-50"
                        >
                          <span>
                            <span className="block font-medium text-slate-900">{recipient.name}</span>
                            <span className="text-xs text-slate-500">{recipient.studentName || recipient.phoneMasked}</span>
                          </span>
                          {checked ? <Check className="h-4 w-4 text-emerald-600" /> : null}
                        </button>
                      );
                    })}
                    {recipients.length === 0 ? <p className="px-3 py-4 text-sm text-slate-500">Sem destinatários com telefone válido.</p> : null}
                  </div>
                </div>
              )}

              <select className="w-full rounded-md border px-3 py-2 text-sm" value={form.messageType} onChange={(e) => setForm({ ...form, messageType: e.target.value })}>
                {messageTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>

              <select className="w-full rounded-md border px-3 py-2 text-sm" value={form.templateKey} onChange={(e) => setForm({ ...form, templateKey: e.target.value, body: data?.templates.find((template) => template.key === e.target.value)?.body || form.body })}>
                <option value="">Sem template</option>
                {(data?.templates || []).map((template) => <option key={template.key} value={template.key}>{template.title}</option>)}
              </select>

              <input className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Título interno" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <textarea className="min-h-32 w-full rounded-md border px-3 py-2 text-sm" placeholder="Mensagem" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />

              <div className="flex flex-wrap gap-2">
                <Button onClick={submitMessage} disabled={saving || Boolean(disabledMessage || disconnectedMessage)}>
                  <Send className="h-4 w-4" /> Criar na fila
                </Button>
                <Button variant="outline" onClick={sendStudentAccess} disabled={saving || recipientType !== "aluno" || Boolean(disabledMessage || disconnectedMessage)}>
                  <ShieldCheck className="h-4 w-4" /> Enviar acesso do aluno
                </Button>
                <Button variant="outline" onClick={() => submitBulk("school_notice")} disabled={saving || recipientType !== "aluno" || selectedRecipients.length === 0 || Boolean(disabledMessage || disconnectedMessage)}>
                  Enviar comunicado
                </Button>
                <Button variant="outline" onClick={() => submitBulk("finance_charge")} disabled={saving || recipientType !== "aluno" || selectedRecipients.length === 0 || Boolean(disabledMessage || disconnectedMessage)}>
                  Cobrança selecionada
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-md shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Operação</CardTitle>
              <CardDescription>
                Sessão {data?.provider?.sessionNameMasked || "-"} · WAHA {statusLabel[sessionStatus] || sessionStatus}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex flex-wrap gap-2">
                {[
                  ["fila", "Fila"],
                  ["enviadas", "Enviadas"],
                  ["falhas", "Falhas"],
                  ["templates", "Templates"],
                  ["logs", "Logs"],
                ].map(([key, label]) => (
                  <button
                    type="button"
                    key={key}
                    onClick={() => setActiveTab(key as typeof activeTab)}
                    className={`rounded-md border px-3 py-2 text-sm ${activeTab === key ? "border-slate-900 bg-slate-900 text-white" : "bg-white text-slate-700"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {loading ? <p className="text-sm text-slate-500">Carregando...</p> : null}

              {activeTab === "templates" ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {(data?.templates || []).map((template) => (
                    <div key={template.key} className="rounded-md border bg-white p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-slate-900">{template.title}</p>
                        <Badge variant="outline" className={statusClass(template.requires_approval ? "review_required" : "sent")}>{template.requires_approval ? "Aprovação" : "Direto"}</Badge>
                      </div>
                      <p className="mt-2 line-clamp-3 text-sm text-slate-600">{template.body}</p>
                    </div>
                  ))}
                </div>
              ) : activeTab === "logs" ? (
                <div className="overflow-hidden rounded-md border bg-white">
                  {(data?.logs || []).map((log) => (
                    <div key={log.id} className="grid gap-1 border-b px-3 py-2 text-sm last:border-b-0 md:grid-cols-[1fr_180px_180px]">
                      <span className="font-medium text-slate-900">{log.event_type}</span>
                      <span className="text-slate-500">{log.provider_event_id || "-"}</span>
                      <span className="text-slate-500">{formatDate(log.created_at)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="overflow-hidden rounded-md border bg-white">
                  {filteredOutbox.map((item) => (
                    <div key={item.id} className="grid gap-2 border-b p-3 last:border-b-0 xl:grid-cols-[1fr_130px_150px_180px]">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-slate-950">{item.recipient_name}</p>
                          <Badge variant="outline" className={statusClass(item.status)}>{statusLabel[item.status] || item.status}</Badge>
                          {item.requires_approval ? <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">Aprovação</Badge> : null}
                        </div>
                        <p className="mt-1 text-sm text-slate-600">{item.title || item.message_type} · {item.recipient_phone_masked || "-"}</p>
                        {item.last_error ? <p className="mt-1 text-xs text-red-600">{item.last_error}</p> : null}
                      </div>
                      <p className="text-sm text-slate-600">{item.retry_count || 0} tentativas</p>
                      <p className="text-sm text-slate-600">{formatDate(item.created_at)}</p>
                      <div className="flex flex-wrap justify-end gap-2">
                        {item.status === "review_required" ? <Button size="sm" onClick={() => patchOutbox(item.id, "approve")}>Aprovar</Button> : null}
                        {item.status === "failed" ? <Button size="sm" variant="outline" onClick={() => patchOutbox(item.id, "retry")}>Reenviar</Button> : null}
                        {["draft", "review_required", "approved", "queued"].includes(item.status) ? <Button size="sm" variant="outline" onClick={() => patchOutbox(item.id, "cancel")}><X className="h-3 w-3" /> Cancelar</Button> : null}
                        <Button size="sm" variant="ghost" onClick={() => navigator.clipboard?.writeText(item.body)}><Copy className="h-3 w-3" /></Button>
                      </div>
                    </div>
                  ))}
                  {filteredOutbox.length === 0 ? <p className="p-6 text-sm text-slate-500">Sem itens nesta visão.</p> : null}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
