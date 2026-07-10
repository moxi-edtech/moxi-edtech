"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  Check,
  Copy,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  X,
  User,
  Phone,
  Clock,
  CheckCheck,
  Archive,
  CheckCircle,
  AlertTriangle,
  FolderArchive,
  ExternalLink,
  DollarSign
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { useToast } from "@/components/feedback/FeedbackSystem";
import { buildContextualPortalHref } from "@/lib/navigation";

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

type Thread = {
  id: string;
  school_id: string;
  channel: string;
  provider: string;
  contact_phone_masked: string;
  contact_name: string | null;
  contact_role: string;
  linked_entity_type: "student" | "guardian" | "teacher" | "manual_contact" | "unknown" | "ambiguous";
  linked_entity_id: string | null;
  status: "open" | "pending" | "resolved" | "archived" | "blocked";
  assigned_to: string | null;
  last_message_preview: string | null;
  last_message_at: string | null;
  unread_count: number;
  created_at: string;
  updated_at: string;
};

type Message = {
  id: string;
  thread_id: string;
  school_id: string;
  direction: "inbound" | "outbound";
  channel: string;
  provider: string;
  provider_message_id: string | null;
  sender_phone_masked: string;
  recipient_phone_masked: string;
  body: string;
  body_preview: string | null;
  message_type: string;
  status: string;
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
  open: "Aberto",
  pending: "Pendente",
  resolved: "Resolvido",
  archived: "Arquivado",
  blocked: "Bloqueado",
};

const roleLabel: Record<string, string> = {
  student: "Aluno",
  guardian: "Encarregado",
  teacher: "Professor",
  manual_contact: "Contato Manual",
  unknown: "Desconhecido",
  ambiguous: "Ambíguo",
};

function statusClass(status: string) {
  if (["connected", "sent", "delivered", "read", "resolved"].includes(status)) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (["pending_qr", "queued", "sending", "review_required", "open", "pending"].includes(status)) return "bg-amber-50 text-amber-700 border-amber-200";
  if (["failed", "error", "rejected", "blocked"].includes(status)) return "bg-red-50 text-red-700 border-red-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-PT", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function formatTime(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-PT", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export default function WhatsAppKlassePage({ params }: Props) {
  const { id: escolaId } = use(params);
  const pathname = usePathname();
  const { error, success } = useToast();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // States
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"inbox" | "fila" | "enviadas" | "falhas" | "templates" | "logs">("inbox");
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

  // Inbox specific states
  const [threads, setThreads] = useState<Thread[]>([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [inboxFilter, setInboxFilter] = useState<string>("open");
  const [inboxSearch, setInboxSearch] = useState("");

  const apiBase = `/api/escola/${escolaId}/admin/comunicacao/whatsapp`;
  const configHref = buildContextualPortalHref(escolaId, "/admin/configuracoes/comunicacao", pathname);

  // Filter outbox rows for non-inbox tabs
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

  // Filter threads by search query
  const filteredThreads = useMemo(() => {
    return threads.filter((t) => {
      const name = String(t.contact_name || "").toLowerCase();
      const phone = String(t.contact_phone_masked || "").toLowerCase();
      const query = inboxSearch.toLowerCase();
      return name.includes(query) || phone.includes(query);
    });
  }, [threads, inboxSearch]);

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

  async function loadThreads() {
    try {
      setInboxLoading(true);
      const res = await fetch(`${apiBase}/inbox?status=${inboxFilter}`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        setThreads(json.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setInboxLoading(false);
    }
  }

  async function loadMessages(threadId: string) {
    try {
      setMessagesLoading(true);
      const res = await fetch(`${apiBase}/inbox/${threadId}`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        setMessages(json.data.messages || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setMessagesLoading(false);
    }
  }

  async function sendReply() {
    if (!selectedThread || !replyText.trim()) return;
    try {
      setSendingReply(true);
      const res = await fetch(`${apiBase}/inbox/${selectedThread.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responseText: replyText })
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        error(json?.error || "Falha ao enviar resposta.");
        return;
      }
      success("Resposta colocada na fila de envio.");
      setReplyText("");
      loadMessages(selectedThread.id);
    } catch (err) {
      error("Erro ao enviar resposta.");
    } finally {
      setSendingReply(false);
    }
  }

  async function updateThreadStatus(threadId: string, status: string) {
    try {
      const res = await fetch(`${apiBase}/inbox/${threadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        success(`Conversa atualizada para ${statusLabel[status] || status}.`);
        if (selectedThread?.id === threadId) {
          setSelectedThread(json.data);
        }
        loadThreads();
      } else {
        error(json?.error || "Falha ao atualizar conversa.");
      }
    } catch (err) {
      error("Erro ao atualizar conversa.");
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

  function copyPhoneToClipboard(phoneMasked: string) {
    navigator.clipboard?.writeText(phoneMasked);
    success("Telefone copiado para a área de transferência.");
  }

  // Initial Load
  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escolaId]);

  // Load threads
  useEffect(() => {
    if (activeTab === "inbox") {
      loadThreads();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, inboxFilter, escolaId]);

  // Load messages & setup polling
  useEffect(() => {
    if (selectedThread) {
      loadMessages(selectedThread.id);
      const interval = setInterval(() => {
        loadMessages(selectedThread.id);
      }, 15000);
      return () => clearInterval(interval);
    }
  }, [selectedThread?.id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Debounced search for recipients
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
            <Button
              variant="outline"
              onClick={() => {
                loadDashboard();
                if (activeTab === "inbox") loadThreads();
              }}
              disabled={loading}
            >
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
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <span>{disabledMessage || disconnectedMessage}</span>
          </div>
        ) : null}

        <section className="grid gap-3 grid-cols-2 md:grid-cols-5">
          {[
            ["Status", statusLabel[sessionStatus] || sessionStatus],
            ["Em fila", data?.summary.queueCount ?? 0],
            ["Enviadas hoje", data?.summary.sentToday ?? 0],
            ["Falhas hoje", data?.summary.failedToday ?? 0],
            ["Última sync", data ? formatDate(data.summary.lastSyncAt) : "-"],
          ].map(([label, value]) => (
            <Card key={label} className="rounded-md shadow-sm border-slate-100">
              <CardContent className="p-4">
                <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
                <p className="mt-2 text-lg md:text-xl font-semibold text-slate-950">{String(value)}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-white p-1 rounded-md shadow-sm">
          {[
            ["inbox", "Caixa de Entrada"],
            ["fila", "Fila"],
            ["enviadas", "Enviadas"],
            ["falhas", "Falhas"],
            ["templates", "Templates"],
            ["logs", "Logs"],
          ].map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`flex-1 text-center py-2 px-3 text-sm font-medium rounded-md transition-all ${
                activeTab === tab
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* MAIN PANEL CONTENT */}
        {activeTab === "inbox" ? (
          <section className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4 min-h-[600px] max-h-[750px]">
            {/* THREADS LIST SIDEBAR */}
            <Card className="rounded-md shadow-sm overflow-hidden flex flex-col h-full bg-white border-slate-200">
              <div className="p-4 border-b border-slate-100 space-y-3 bg-slate-50/50">
                <div className="flex items-center gap-2 bg-white rounded-md border px-3 py-2 shadow-sm">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input
                    className="w-full bg-transparent text-sm outline-none"
                    placeholder="Pesquisar conversas..."
                    value={inboxSearch}
                    onChange={(e) => setInboxSearch(e.target.value)}
                  />
                </div>
                <div className="flex gap-1">
                  {[
                    ["open", "Abertas"],
                    ["resolved", "Resolvidas"],
                    ["archived", "Arquivadas"],
                  ].map(([status, label]) => (
                    <button
                      key={status}
                      onClick={() => {
                        setInboxFilter(status);
                        setSelectedThread(null);
                      }}
                      className={`flex-1 text-xs font-semibold py-1 px-2 rounded-md border text-center transition-all ${
                        inboxFilter === status
                          ? "bg-slate-200 text-slate-900 border-slate-300"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                {inboxLoading ? (
                  <div className="p-4 text-center text-sm text-slate-400 flex items-center justify-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin" /> Carregando conversas...
                  </div>
                ) : filteredThreads.length === 0 ? (
                  <p className="p-6 text-center text-sm text-slate-400">Nenhuma conversa nesta pasta.</p>
                ) : (
                  filteredThreads.map((thread) => {
                    const active = selectedThread?.id === thread.id;
                    return (
                      <button
                        key={thread.id}
                        onClick={() => setSelectedThread(thread)}
                        className={`w-full text-left p-4 hover:bg-slate-50 transition-colors flex items-start justify-between gap-3 ${
                          active ? "bg-slate-100/75 border-l-4 border-slate-900" : ""
                        }`}
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-slate-950 truncate">
                              {thread.contact_name || thread.contact_phone_masked}
                            </span>
                            <Badge variant="outline" className="text-[10px] py-0 px-1 border-slate-200 bg-slate-50 text-slate-600 font-medium">
                              {roleLabel[thread.contact_role] || thread.contact_role}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-500 truncate">
                            {thread.contact_phone_masked}
                          </p>
                          <p className="text-xs text-slate-600 truncate mt-1">
                            {thread.last_message_preview || "Sem mensagens"}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          <span className="text-[10px] text-slate-400 font-medium">
                            {thread.last_message_at ? formatTime(thread.last_message_at) : ""}
                          </span>
                          {thread.unread_count > 0 ? (
                            <span className="h-5 min-w-5 px-1.5 flex items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">
                              {thread.unread_count}
                            </span>
                          ) : null}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </Card>

            {/* CHAT VIEW & HISTORIC */}
            <Card className="rounded-md shadow-sm overflow-hidden flex flex-col h-full bg-white border-slate-200">
              {selectedThread ? (
                <>
                  {/* Thread Header */}
                  <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h2 className="font-semibold text-slate-950">
                          {selectedThread.contact_name || selectedThread.contact_phone_masked}
                        </h2>
                        <Badge className={statusClass(selectedThread.status)}>
                          {statusLabel[selectedThread.status] || selectedThread.status}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span>{selectedThread.contact_phone_masked}</span>
                        <span>•</span>
                        <span>Vínculo: <span className="font-medium text-slate-700">{roleLabel[selectedThread.linked_entity_type] || selectedThread.linked_entity_type}</span></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => copyPhoneToClipboard(selectedThread.contact_phone_masked)}>
                        <Copy className="h-3 w-3 mr-1" /> Copiar Tel
                      </Button>

                      {selectedThread.linked_entity_id && selectedThread.linked_entity_type === "student" ? (
                        <>
                          <Button size="sm" variant="outline" asChild>
                            <Link href={buildContextualPortalHref(escolaId, `/secretaria/alunos/${selectedThread.linked_entity_id}`, pathname)} target="_blank">
                              <ExternalLink className="h-3 w-3 mr-1" /> Ficha Aluno
                            </Link>
                          </Button>
                          <Button size="sm" variant="outline" asChild>
                            <Link href={buildContextualPortalHref(escolaId, `/secretaria/alunos/${selectedThread.linked_entity_id}/pagamento`, pathname)} target="_blank">
                              <DollarSign className="h-3 w-3 mr-1" /> Financeiro
                            </Link>
                          </Button>
                        </>
                      ) : null}

                      {selectedThread.status !== "resolved" ? (
                        <Button size="sm" variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={() => updateThreadStatus(selectedThread.id, "resolved")}>
                          <CheckCircle className="h-3 w-3 mr-1" /> Resolver
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => updateThreadStatus(selectedThread.id, "open")}>
                          Reabrir
                        </Button>
                      )}

                      {selectedThread.status !== "archived" ? (
                        <Button size="sm" variant="outline" className="border-amber-200 text-amber-700 hover:bg-amber-50" onClick={() => updateThreadStatus(selectedThread.id, "archived")}>
                          <Archive className="h-3 w-3 mr-1" /> Arquivar
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  {/* Messages Bubble Container */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/25">
                    {messagesLoading && messages.length === 0 ? (
                      <div className="p-4 text-center text-sm text-slate-400">Carregando conversa...</div>
                    ) : (
                      messages.map((message) => {
                        const inbound = message.direction === "inbound";
                        return (
                          <div
                            key={message.id}
                            className={`flex ${inbound ? "justify-start" : "justify-end"}`}
                          >
                            <div
                              className={`max-w-[70%] rounded-lg p-3 shadow-sm border ${
                                inbound
                                  ? "bg-white text-slate-800 border-slate-100 rounded-bl-none"
                                  : "bg-emerald-600 text-white border-emerald-700 rounded-br-none"
                              }`}
                            >
                              <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.body}</p>
                              <div className={`mt-1 flex items-center justify-end gap-1.5 text-[10px] ${
                                inbound ? "text-slate-400" : "text-emerald-100"
                              }`}>
                                <span>{formatTime(message.created_at)}</span>
                                {!inbound && (
                                  <span>
                                    {message.status === "read" ? (
                                      <CheckCheck className="h-3.5 w-3.5 text-sky-200" />
                                    ) : message.status === "delivered" || message.status === "sent" ? (
                                      <CheckCheck className="h-3.5 w-3.5" />
                                    ) : (
                                      <Clock className="h-3 w-3" />
                                    )}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Reply Input Box */}
                  <div className="p-4 border-t border-slate-100 space-y-3 bg-slate-50/50">
                    {sessionStatus !== "connected" ? (
                      <div className="text-xs text-amber-800 bg-amber-50 rounded border border-amber-200 p-2 flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
                        <span>Sessão desconectada. Você não pode responder neste chat.</span>
                      </div>
                    ) : null}

                    <div className="flex gap-2">
                      <textarea
                        className="w-full min-h-12 max-h-32 rounded-md border p-2 text-sm shadow-sm outline-none focus:border-slate-400 bg-white"
                        placeholder="Digite sua resposta manual..."
                        disabled={sessionStatus !== "connected" || sendingReply}
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            sendReply();
                          }
                        }}
                      />
                      <Button
                        onClick={sendReply}
                        disabled={sessionStatus !== "connected" || sendingReply || !replyText.trim()}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white shadow flex-shrink-0 px-4 self-end"
                      >
                        {sendingReply ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 space-y-2">
                  <MessageSquare className="h-12 w-12 text-slate-300" />
                  <p className="font-medium text-sm">Nenhuma conversa selecionada</p>
                  <p className="text-xs text-slate-500">Selecione um contato na barra lateral para iniciar o atendimento.</p>
                </div>
              )}
            </Card>
          </section>
        ) : (
          /* OTHER TABS CONTENT */
          <section className="grid gap-4 lg:grid-cols-[420px_1fr]">
            {/* Left Box: Send New Message */}
            <Card className="rounded-md shadow-sm border-slate-100">
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
                      className={`rounded-md border px-3 py-2 text-sm transition-all font-medium ${
                        recipientType === type
                          ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                          : "bg-white text-slate-700 hover:bg-slate-50 border-slate-200"
                      }`}
                    >
                      {type === "aluno" ? "Aluno" : type === "professor" ? "Professor" : "Manual"}
                    </button>
                  ))}
                </div>

                {recipientType === "manual" ? (
                  <div className="grid gap-2">
                    <input
                      className="rounded-md border px-3 py-2 text-sm outline-none focus:border-slate-400"
                      placeholder="Nome do destinatário"
                      value={form.recipientName}
                      onChange={(e) => setForm({ ...form, recipientName: e.target.value })}
                    />
                    <input
                      className="rounded-md border px-3 py-2 text-sm outline-none focus:border-slate-400"
                      placeholder="+244..."
                      value={form.recipientPhone}
                      onChange={(e) => setForm({ ...form, recipientPhone: e.target.value })}
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 rounded-md border bg-white px-3 py-2 shadow-sm">
                      <Search className="h-4 w-4 text-slate-400" />
                      <input
                        className="w-full bg-transparent text-sm outline-none"
                        placeholder="Pesquisar destinatário"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                    <div className="max-h-44 overflow-auto rounded-md border bg-white divide-y divide-slate-100">
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
                            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 transition-colors"
                          >
                            <span>
                              <span className="block font-medium text-slate-900">{recipient.name}</span>
                              <span className="text-xs text-slate-500">{recipient.studentName || recipient.phoneMasked}</span>
                            </span>
                            {checked ? <Check className="h-4 w-4 text-emerald-600" /> : null}
                          </button>
                        );
                      })}
                      {recipients.length === 0 ? <p className="px-3 py-4 text-sm text-slate-400 text-center">Sem destinatários com telefone válido.</p> : null}
                    </div>
                  </div>
                )}

                <select
                  className="w-full rounded-md border px-3 py-2 text-sm bg-white outline-none"
                  value={form.messageType}
                  onChange={(e) => setForm({ ...form, messageType: e.target.value })}
                >
                  {messageTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>

                <select
                  className="w-full rounded-md border px-3 py-2 text-sm bg-white outline-none"
                  value={form.templateKey}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      templateKey: e.target.value,
                      body: data?.templates.find((template) => template.key === e.target.value)?.body || form.body,
                    })
                  }
                >
                  <option value="">Sem template</option>
                  {(data?.templates || []).map((template) => <option key={template.key} value={template.key}>{template.title}</option>)}
                </select>

                <input
                  className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-slate-400"
                  placeholder="Título interno"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
                <textarea
                  className="min-h-32 w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-slate-400 bg-white"
                  placeholder="Mensagem"
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                />

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button onClick={submitMessage} disabled={saving || Boolean(disabledMessage || disconnectedMessage)}>
                    <Send className="h-4 w-4 mr-1" /> Fila
                  </Button>
                  <Button variant="outline" onClick={sendStudentAccess} disabled={saving || recipientType !== "aluno" || Boolean(disabledMessage || disconnectedMessage)}>
                    <ShieldCheck className="h-4 w-4 mr-1" /> Acesso Aluno
                  </Button>
                  <Button variant="outline" onClick={() => submitBulk("school_notice")} disabled={saving || recipientType !== "aluno" || selectedRecipients.length === 0 || Boolean(disabledMessage || disconnectedMessage)}>
                    Comunicado
                  </Button>
                  <Button variant="outline" onClick={() => submitBulk("finance_charge")} disabled={saving || recipientType !== "aluno" || selectedRecipients.length === 0 || Boolean(disabledMessage || disconnectedMessage)}>
                    Cobrança
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Right Box: Operation Details & Tabs */}
            <Card className="rounded-md shadow-sm border-slate-100">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Operação</CardTitle>
                <CardDescription>
                  Sessão {data?.provider?.sessionNameMasked || "-"} · WAHA {statusLabel[sessionStatus] || sessionStatus}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? <p className="text-sm text-slate-400">Carregando...</p> : null}

                {activeTab === "templates" ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {(data?.templates || []).map((template) => (
                      <div key={template.key} className="rounded-md border bg-white p-3 shadow-sm border-slate-150 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-sm text-slate-900">{template.title}</p>
                          <Badge variant="outline" className={statusClass(template.requires_approval ? "review_required" : "sent")}>
                            {template.requires_approval ? "Aprovação" : "Direto"}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-600 font-mono bg-slate-50 p-1.5 rounded">{template.key}</p>
                        <p className="text-xs text-slate-600 line-clamp-4 leading-relaxed">{template.body}</p>
                      </div>
                    ))}
                  </div>
                ) : activeTab === "logs" ? (
                  <div className="overflow-hidden rounded-md border bg-white divide-y divide-slate-100">
                    {(data?.logs || []).map((log) => (
                      <div key={log.id} className="grid gap-1 px-3 py-2 text-xs last:border-b-0 md:grid-cols-[1fr_180px_180px] hover:bg-slate-50 transition-colors">
                        <span className="font-medium text-slate-900">{log.event_type}</span>
                        <span className="text-slate-500 font-mono">{log.provider_event_id || "-"}</span>
                        <span className="text-slate-400">{formatDate(log.created_at)}</span>
                      </div>
                    ))}
                    {data?.logs.length === 0 ? <p className="p-6 text-center text-sm text-slate-400">Nenhum log registrado.</p> : null}
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-md border bg-white divide-y divide-slate-100">
                    {filteredOutbox.map((item) => (
                      <div key={item.id} className="grid gap-2 p-3 last:border-b-0 xl:grid-cols-[1fr_120px_140px_160px] hover:bg-slate-50 transition-colors items-center">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-slate-950 truncate text-sm">{item.recipient_name}</p>
                            <Badge variant="outline" className={statusClass(item.status)}>
                              {statusLabel[item.status] || item.status}
                            </Badge>
                            {item.requires_approval ? (
                              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                                Aprovação
                              </Badge>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs text-slate-600 truncate">
                            {item.title || item.message_type} · {item.recipient_phone_masked || "-"}
                          </p>
                          {item.last_error ? <p className="mt-1 text-[10px] text-red-600 font-medium">{item.last_error}</p> : null}
                        </div>
                        <p className="text-xs text-slate-500 font-medium">{item.retry_count || 0} tentativas</p>
                        <p className="text-xs text-slate-400">{formatDate(item.created_at)}</p>
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {item.status === "review_required" ? (
                            <Button size="sm" onClick={() => patchOutbox(item.id, "approve")}>
                              Aprovar
                            </Button>
                          ) : null}
                          {item.status === "failed" ? (
                            <Button size="sm" variant="outline" onClick={() => patchOutbox(item.id, "retry")}>
                              Reenviar
                            </Button>
                          ) : null}
                          {["draft", "review_required", "approved", "queued"].includes(item.status) ? (
                            <Button size="sm" variant="outline" onClick={() => patchOutbox(item.id, "cancel")} className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-100">
                              <X className="h-3 w-3" />
                            </Button>
                          ) : null}
                          <Button size="sm" variant="ghost" onClick={() => navigator.clipboard?.writeText(item.body)}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {filteredOutbox.length === 0 ? <p className="p-6 text-sm text-slate-400 text-center">Sem itens nesta visão.</p> : null}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        )}
      </div>
    </main>
  );
}
