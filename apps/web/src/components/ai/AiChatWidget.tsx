"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ClipboardList,
  Copy,
  HelpCircle,
  MessageSquare,
  Search,
  Send,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import {
  describeContext,
  getAssistantSuggestions,
  type AiWidgetContext,
  type AssistantSuggestion,
} from "@/lib/assistant/assistant-suggestions";
import { findHelpTopics, type HelpTopic } from "@/lib/klasse-help/help-topics";

export type { AiWidgetContext };

type Message = {
  id: string;
  sender: "user" | "ai";
  text: string;
  copyable?: boolean;
  actionId?: string | null;
  quickReplies?: Array<{ label: string; action: string }>;
};

type FlowId =
  | "rewrite_notice"
  | "guided_notice"
  | "screen_summary"
  | "finance_plan"
  | "whatsapp_draft"
  | "find_path";

type FlowState = {
  id: FlowId;
  step: number;
  data: Record<string, string>;
};

interface AiChatWidgetProps {
  schoolId: string;
  schoolParam?: string;
  hasMobileNav?: boolean;
  context?: AiWidgetContext;
}

function uid() {
  return crypto.randomUUID();
}

function ai(text: string, extra?: Partial<Message>): Message {
  return { id: uid(), sender: "ai", text, ...extra };
}

function user(text: string): Message {
  return { id: uid(), sender: "user", text };
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function cleanGeneratedText(text: string) {
  return text
    .replace(/^Rascunho criado para revisão:\n\n/i, "")
    .replace(/^Resumo gerado:\n\n/i, "")
    .trim();
}

function AssistantMark({ size = "md" }: { size?: "sm" | "md" }) {
  const box = size === "sm" ? "h-6 w-6 text-[13px]" : "h-10 w-10 text-lg";
  const spark = size === "sm" ? "h-1.5 w-1.5 right-0 top-0" : "h-2 w-2 right-0.5 top-0.5";
  return (
    <span
      className={`relative inline-flex ${box} shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-white font-black leading-none text-emerald-800 shadow-sm`}
      aria-hidden="true"
    >
      K
      <span className={`absolute ${spark} rounded-full bg-amber-400 ring-2 ring-white`} />
      <span className="absolute -bottom-0.5 right-1 h-1.5 w-2.5 rounded-bl-full border-b border-r border-emerald-200 bg-white" />
    </span>
  );
}

const FLOW_TITLES: Record<FlowId, string> = {
  rewrite_notice: "Melhorar comunicado",
  guided_notice: "Criar comunicado guiado",
  screen_summary: "Gerar resumo da tela",
  finance_plan: "Criar plano de cobrança",
  whatsapp_draft: "Criar rascunho WhatsApp",
  find_path: "Encontrar caminho no sistema",
};

export default function AiChatWidget({
  schoolId,
  schoolParam,
  hasMobileNav = false,
  context,
}: AiChatWidgetProps) {
  const router = useRouter();
  const routeSchoolParam = schoolParam || schoolId;
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [thinking, setThinking] = useState(false);
  const [flow, setFlow] = useState<FlowState | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feedbackId, setFeedbackId] = useState<string | null>(null);
  const [isAllowed, setIsAllowed] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [userRole, setUserRole] = useState("");
  const [resolvedSchoolId, setResolvedSchoolId] = useState<string | null>(null);
  const [allowedFeatures, setAllowedFeatures] = useState<string[]>([]);
  const [helpSearch, setHelpSearch] = useState("");
  const [helpTopics, setHelpTopics] = useState<HelpTopic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<HelpTopic | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [position, setPosition] = useState<{ right: number; bottom: number }>({ right: 24, bottom: 24 });
  const [dragging, setDragging] = useState(false);
  const isDragging = useRef(false);
  const dragMoved = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, right: 0, bottom: 0 });
  const positionRef = useRef(position);

  const effectiveSchoolId = resolvedSchoolId ?? schoolId;
  const contextName = describeContext(context);
  const suggestions = useMemo(
    () => getAssistantSuggestions({ context, role: userRole, allowedFeatures }),
    [context, userRole, allowedFeatures]
  );

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  useEffect(() => {
    const savedOpen = localStorage.getItem(`klasse_ai_v3_open_${schoolId}`);
    setIsOpen(savedOpen === "true");
    const isMobile = window.innerWidth < 768;
    const defaultBottom = hasMobileNav && isMobile ? 82 : 20;
    const saved = localStorage.getItem(`klasse_ai_widget_position_${schoolId}`);
    if (!saved) {
      setPosition({ right: isMobile ? 14 : 24, bottom: defaultBottom });
      return;
    }
    try {
      const parsed = JSON.parse(saved);
      setPosition({
        right: Math.max(14, Math.min(Number(parsed.right) || 24, window.innerWidth - 58)),
        bottom: Math.max(defaultBottom, Math.min(Number(parsed.bottom) || defaultBottom, window.innerHeight - 58)),
      });
    } catch {
      setPosition({ right: isMobile ? 14 : 24, bottom: defaultBottom });
    }
  }, [schoolId, hasMobileNav]);

  useEffect(() => {
    localStorage.setItem(`klasse_ai_v3_open_${schoolId}`, String(isOpen));
  }, [isOpen, schoolId]);

  useEffect(() => {
    let active = true;
    async function checkAccess() {
      try {
        const res = await fetch(`/api/admin/ai/access?schoolId=${encodeURIComponent(schoolId)}`, { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!active) return;
        const data = json?.data ?? {};
        setResolvedSchoolId(typeof data.schoolId === "string" ? data.schoolId : null);
        setUserRole(String(data.role ?? "").toLowerCase());
        setAllowedFeatures(Array.isArray(data.allowedFeatures) ? data.allowedFeatures.map(String) : []);
        setIsAllowed(Boolean(res.ok && json?.ok && data.allowed));
      } catch {
        if (active) setIsAllowed(false);
      } finally {
        if (active) setCheckingAccess(false);
      }
    }
    checkAccess();
    return () => {
      active = false;
    };
  }, [schoolId]);

  useEffect(() => {
    if (!isAllowed) return;
    setMessages([
      ai(`Olá! Estou vendo que você está em ${contextName}.`, {
        quickReplies: [
          { label: "O que posso fazer nesta tela?", action: "screen_capabilities" },
          { label: "Abrir Central IA", action: "open_actions" },
        ],
      }),
    ]);
  }, [isAllowed, contextName]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking, showHelp]);

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if ((e.target as HTMLElement).closest("button,input,textarea,a")) return;
    if ("button" in e && e.button !== 0) return;
    const point = "touches" in e ? e.touches[0] : e;
    dragStart.current = { x: point.clientX, y: point.clientY, right: positionRef.current.right, bottom: positionRef.current.bottom };
    isDragging.current = true;
    dragMoved.current = false;
    setDragging(true);
  };

  useEffect(() => {
    const move = (e: MouseEvent | TouchEvent) => {
      if (!isDragging.current) return;
      const point = "touches" in e ? e.touches[0] : e;
      const dx = point.clientX - dragStart.current.x;
      const dy = point.clientY - dragStart.current.y;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragMoved.current = true;
      const isMobile = window.innerWidth < 768;
      const widgetWidth = isOpen ? (isMobile ? window.innerWidth - 28 : 360) : 42;
      const widgetHeight = isOpen ? 500 : 42;
      const minBottom = hasMobileNav && isMobile ? 82 : 14;
      setPosition({
        right: Math.max(14, Math.min(dragStart.current.right - dx, window.innerWidth - widgetWidth - 14)),
        bottom: Math.max(minBottom, Math.min(dragStart.current.bottom - dy, window.innerHeight - widgetHeight - 14)),
      });
    };
    const end = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      setDragging(false);
      localStorage.setItem(`klasse_ai_widget_position_${schoolId}`, JSON.stringify(positionRef.current));
    };
    if (dragging) {
      window.addEventListener("mousemove", move, { passive: true });
      window.addEventListener("mouseup", end);
      window.addEventListener("touchmove", move, { passive: true });
      window.addEventListener("touchend", end);
    }
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", end);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", end);
    };
  }, [dragging, isOpen, hasMobileNav, schoolId]);

  function pushMessages(next: Message[]) {
    setMessages((current) => [...current, ...next].slice(-8));
  }

  function startFlow(id: FlowId) {
    setShowHelp(false);
    setSelectedTopic(null);
    setInputValue("");
    if (id === "rewrite_notice") {
      setFlow({ id, step: 1, data: { mode: "more_formal" } });
      pushMessages([
        user(FLOW_TITLES[id]),
        ai("Escolhe o ajuste desejado.", {
          quickReplies: [
            { label: "Mais formal", action: "rewrite_mode:more_formal" },
            { label: "Mais curto", action: "rewrite_mode:shorter" },
            { label: "Mais claro", action: "rewrite_mode:clearer" },
            { label: "Cancelar", action: "cancel_flow" },
          ],
        }),
      ]);
      return;
    }
    if (id === "guided_notice") {
      setFlow({ id, step: 1, data: {} });
      pushMessages([
        user(FLOW_TITLES[id]),
        ai("Qual é o público?", {
          quickReplies: ["Alunos", "Encarregados", "Professores", "Todos"].map((label) => ({
            label,
            action: `notice_audience:${label}`,
          })),
        }),
      ]);
      return;
    }
    if (id === "finance_plan") {
      setFlow({ id, step: 1, data: {} });
      pushMessages([
        user(FLOW_TITLES[id]),
        ai("Confirmas que queres criar um plano financeiro apenas como rascunho para revisão?", {
          quickReplies: [
            { label: "Criar rascunho", action: "run_finance_plan" },
            { label: "Cancelar", action: "cancel_flow" },
          ],
        }),
      ]);
      return;
    }
    if (id === "whatsapp_draft") {
      setFlow({ id, step: 1, data: { tone: "formal" } });
      pushMessages([
        user(FLOW_TITLES[id]),
        ai("A IA só cria rascunho. O envio precisa ser aprovado na Central WhatsApp. Qual o tom?", {
          quickReplies: [
            { label: "Formal", action: "whatsapp_tone:formal" },
            { label: "Amigável", action: "whatsapp_tone:cordial" },
            { label: "Urgente", action: "whatsapp_tone:urgente" },
            { label: "Cancelar", action: "cancel_flow" },
          ],
        }),
      ]);
      return;
    }
    if (id === "screen_summary") {
      runSummary();
      return;
    }
    openHelp();
  }

  async function runRewrite(text: string, mode: string) {
    setThinking(true);
    try {
      const res = await fetch("/api/admin/ai/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId: effectiveSchoolId, text, mode }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Erro ao reescrever.");
      pushMessages([
        ai(`Rascunho criado para revisão:\n\n${json.text}`, {
          copyable: true,
          quickReplies: [
            { label: "Salvar na Central", action: `save_action:communication_draft:${encodeURIComponent(json.text)}` },
            { label: "Copiar", action: `copy:${encodeURIComponent(json.text)}` },
            { label: "Refazer", action: "rewrite_mode:more_formal" },
          ],
        }),
      ]);
      setFlow(null);
    } catch (err) {
      pushMessages([ai(errorMessage(err, "Erro ao reescrever."))]);
    } finally {
      setThinking(false);
    }
  }

  async function runCommunicationDraft(topic: string, data: Record<string, string>) {
    setThinking(true);
    try {
      const res = await fetch("/api/admin/ai/generate-communication", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId: effectiveSchoolId,
          title: "Comunicado assistido",
          audience: data.audience || "comunidade escolar",
          tone: data.tone || "cordial",
          topic,
          context,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Erro ao gerar comunicado.");
      pushMessages([
        ai(`Rascunho criado para revisão:\n\n${json.content}`, {
          copyable: true,
          actionId: json.action?.id ?? null,
          quickReplies: [
            { label: "Abrir Central IA", action: "open_actions" },
            { label: "Criar WhatsApp", action: `prepare_whatsapp:${encodeURIComponent(json.content)}` },
            { label: "Copiar", action: `copy:${encodeURIComponent(json.content)}` },
          ],
        }),
      ]);
      setFlow(null);
    } catch (err) {
      pushMessages([ai(errorMessage(err, "Erro ao gerar comunicado."))]);
    } finally {
      setThinking(false);
    }
  }

  async function runSummary() {
    setThinking(true);
    pushMessages([user("Gerar resumo desta tela")]);
    try {
      const res = await fetch("/api/admin/ai/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId: effectiveSchoolId, period: "today" }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Erro ao gerar resumo.");
      pushMessages([
        ai(`Resumo gerado:\n\n${json.content}`, {
          copyable: true,
          actionId: json.action?.id ?? null,
          quickReplies: [
            { label: "Abrir Central IA", action: "open_actions" },
            { label: "Copiar", action: `copy:${encodeURIComponent(json.content)}` },
          ],
        }),
      ]);
    } catch (err) {
      pushMessages([ai(errorMessage(err, "Erro ao gerar resumo."))]);
    } finally {
      setThinking(false);
    }
  }

  async function runFinancePlan() {
    setThinking(true);
    try {
      const res = await fetch("/api/admin/ai/finance-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId: effectiveSchoolId,
          title: "Plano de cobrança da semana",
          scenario: "Preparar um plano de cobrança semanal com prioridades e mensagem base. Usar placeholders.",
          recipientLabel: "[Encarregado]",
          amountLabel: "[Valor em aberto]",
          dueDateLabel: "[Data de vencimento]",
          context: { page: context?.page ?? "financeiro", module: "financeiro" },
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Erro ao criar plano financeiro.");
      pushMessages([
        ai(`Rascunho financeiro criado para revisão:\n\n${json.content}`, {
          copyable: true,
          actionId: json.action?.id ?? null,
          quickReplies: [
            { label: "Abrir Central IA", action: "open_actions" },
            { label: "Abrir WhatsApp", action: "open_whatsapp" },
            { label: "Copiar", action: `copy:${encodeURIComponent(json.content)}` },
          ],
        }),
      ]);
      setFlow(null);
    } catch (err) {
      pushMessages([ai(errorMessage(err, "Erro ao criar plano financeiro."))]);
    } finally {
      setThinking(false);
    }
  }

  async function saveAction(content: string, actionType: "communication_draft" | "finance_message" | "school_summary") {
    setThinking(true);
    try {
      const res = await fetch("/api/admin/ai/actions/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId: effectiveSchoolId,
          title: actionType === "finance_message" ? "Rascunho financeiro assistido" : "Rascunho assistido",
          content,
          actionType,
          sourceModule: context?.module === "whatsapp" ? "comunicacao" : context?.module || "classe_ai",
          riskLevel: actionType === "finance_message" ? "high" : "medium",
          context: { page: context?.page ?? null, assistant_v3: true },
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Erro ao salvar ação.");
      pushMessages([ai("Salvo na Central de Ações IA para revisão humana.", { actionId: json.action?.id ?? null })]);
    } catch (err) {
      pushMessages([ai(errorMessage(err, "Erro ao salvar ação."))]);
    } finally {
      setThinking(false);
    }
  }

  function openHelp() {
    setShowHelp(true);
    setSelectedTopic(null);
    const topics = findHelpTopics("", userRole);
    setHelpTopics(topics);
    pushMessages([user("O que posso fazer nesta tela?"), ai(`Nesta tela (${contextName}), posso sugerir ações seguras e abrir caminhos oficiais.`)]);
  }

  function showContextCapabilities() {
    const titles = suggestions.slice(0, 5).map((item, index) => `${index + 1}. ${item.title}`).join("\n");
    pushMessages([
      user("O que posso fazer nesta tela?"),
      ai(`Nesta tela você pode:\n${titles || "Nenhuma ação contextual liberada para o teu perfil."}`, {
        quickReplies: suggestions.slice(0, 4).map((suggestion) => ({ label: suggestion.title, action: `suggestion:${suggestion.key}` })),
      }),
    ]);
  }

  async function sendFeedback(message: Message, rating: "useful" | "not_useful", adjustment?: string) {
    setFeedbackId(message.id);
    await fetch("/api/admin/ai/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schoolId: effectiveSchoolId,
        actionId: message.actionId ?? null,
        rating,
        adjustment: adjustment ?? null,
        context: { module: context?.module, page: context?.page },
      }),
    }).catch(() => null);
  }

  function handleSuggestion(suggestion: AssistantSuggestion) {
    if (suggestion.href) {
      router.push(suggestion.href(routeSchoolParam, context));
      setIsOpen(false);
      return;
    }
    if (suggestion.key === "screen_capabilities") return showContextCapabilities();
    if (suggestion.key === "finance_plan") return startFlow("finance_plan");
    if (suggestion.key === "finance_whatsapp_draft") return startFlow("whatsapp_draft");
    if (suggestion.key === "finance_summary" || suggestion.key === "student_summary") return startFlow("screen_summary");
    if (suggestion.key === "communication_rewrite") return startFlow("rewrite_notice");
    if (suggestion.key === "communication_guided") return startFlow("guided_notice");
    if (suggestion.key === "open_actions") return router.push(`/escola/${routeSchoolParam}/admin/ai/actions`);
    openHelp();
  }

  function handleQuickAction(action: string) {
    if (action === "cancel_flow") {
      setFlow(null);
      setInputValue("");
      pushMessages([ai("Fluxo cancelado. Escolhe uma próxima ação quando quiseres.")]);
      return;
    }
    if (action === "screen_capabilities") return showContextCapabilities();
    if (action === "open_actions") {
      router.push(`/escola/${routeSchoolParam}/admin/ai/actions`);
      setIsOpen(false);
      return;
    }
    if (action === "open_whatsapp") {
      router.push(`/escola/${routeSchoolParam}/admin/comunicacao/whatsapp`);
      setIsOpen(false);
      return;
    }
    if (action.startsWith("suggestion:")) {
      const suggestion = suggestions.find((item) => item.key === action.replace("suggestion:", ""));
      if (suggestion) handleSuggestion(suggestion);
      return;
    }
    if (action.startsWith("rewrite_mode:")) {
      const mode = action.replace("rewrite_mode:", "");
      setFlow({ id: "rewrite_notice", step: 2, data: { mode } });
      pushMessages([user(mode === "shorter" ? "Mais curto" : mode === "clearer" ? "Mais claro" : "Mais formal"), ai("Cole o texto do comunicado para eu preparar o rascunho.")]);
      return;
    }
    if (action.startsWith("notice_audience:")) {
      const audience = action.replace("notice_audience:", "");
      setFlow({ id: "guided_notice", step: 2, data: { audience } });
      pushMessages([
        user(audience),
        ai("Qual é o tom?", {
          quickReplies: ["Formal", "Amigável", "Urgente", "Institucional"].map((label) => ({
            label,
            action: `notice_tone:${label}`,
          })),
        }),
      ]);
      return;
    }
    if (action.startsWith("notice_tone:")) {
      const toneLabel = action.replace("notice_tone:", "");
      const tone = toneLabel === "Formal" ? "formal" : toneLabel === "Urgente" ? "urgente" : "cordial";
      setFlow((current) => ({ id: "guided_notice", step: 3, data: { ...(current?.data || {}), tone } }));
      pushMessages([user(toneLabel), ai("Cole a ideia principal do comunicado.")]);
      return;
    }
    if (action === "run_finance_plan") return runFinancePlan();
    if (action.startsWith("whatsapp_tone:")) {
      const tone = action.replace("whatsapp_tone:", "");
      setFlow({ id: "whatsapp_draft", step: 2, data: { tone } });
      pushMessages([user(tone), ai("Escreve a ideia da mensagem. Não inclua dados sensíveis; use placeholders como [Nome] e [Valor].")]);
      return;
    }
    if (action.startsWith("save_action:")) {
      const [, actionType, encoded] = action.split(":");
      saveAction(decodeURIComponent(encoded || ""), actionType === "finance_message" ? "finance_message" : "communication_draft");
      return;
    }
    if (action.startsWith("prepare_whatsapp:")) {
      const content = decodeURIComponent(action.replace("prepare_whatsapp:", ""));
      pushMessages([
        ai("Para criar rascunho WhatsApp, informe um contato manual autorizado na Central WhatsApp. O assistente não envia mensagens nem aprova envios.", {
          quickReplies: [
            { label: "Abrir Central WhatsApp", action: "open_whatsapp" },
            { label: "Salvar na Central IA", action: `save_action:communication_draft:${encodeURIComponent(content)}` },
          ],
        }),
      ]);
      return;
    }
    if (action.startsWith("copy:")) {
      navigator.clipboard.writeText(decodeURIComponent(action.replace("copy:", "")));
    }
  }

  function submitInput(e: React.FormEvent) {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text || !flow) return;
    setInputValue("");
    pushMessages([user(text)]);
    if (flow.id === "rewrite_notice" && flow.step === 2) {
      runRewrite(text, flow.data.mode || "more_formal");
      return;
    }
    if (flow.id === "guided_notice" && flow.step === 3) {
      runCommunicationDraft(text, flow.data);
      return;
    }
    if (flow.id === "whatsapp_draft" && flow.step === 2) {
      const content = `[Rascunho WhatsApp - ${flow.data.tone}]\n\n${text}`;
      saveAction(content, "finance_message");
      setFlow(null);
    }
  }

  const inputRequired = Boolean(
    flow &&
      ((flow.id === "rewrite_notice" && flow.step === 2) ||
        (flow.id === "guided_notice" && flow.step === 3) ||
        (flow.id === "whatsapp_draft" && flow.step === 2))
  );

  if (checkingAccess || !isAllowed) return null;

  const mobile = typeof window !== "undefined" && window.innerWidth < 768;
  const cardRight = mobile ? 14 : position.right;

  return (
    <>
      <button
        type="button"
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
        onClick={(event) => {
          if (dragMoved.current) {
            event.preventDefault();
            return;
          }
          setIsOpen((value) => !value);
        }}
        style={{ right: position.right, bottom: position.bottom }}
        className={`fixed z-50 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-md hover:text-emerald-700 ${dragging ? "" : "transition"}`}
        aria-label="Assistente KLASSE"
      >
        {isOpen ? <X className="h-4 w-4" /> : <AssistantMark />}
      </button>

      {isOpen ? (
        <div
          style={{ right: cardRight, bottom: position.bottom }}
          className={`fixed z-50 flex h-[500px] max-h-[72vh] ${mobile ? "w-[calc(100vw-28px)]" : "w-[360px]"} flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl`}
        >
          <header
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
            className="flex cursor-grab items-center justify-between border-b border-slate-100 px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <AssistantMark size="sm" />
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Assistente KLASSE</h3>
                <p className="text-[11px] text-slate-500">Ajuda rápida e ações inteligentes</p>
              </div>
            </div>
            <button type="button" onClick={() => setIsOpen(false)} className="rounded-md p-1 text-slate-400 hover:bg-slate-50">
              <X className="h-4 w-4" />
            </button>
          </header>

          {showHelp ? (
            <section className="flex min-h-0 flex-1 flex-col bg-slate-50">
              <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={helpSearch}
                  onChange={(event) => {
                    setHelpSearch(event.target.value);
                    setHelpTopics(findHelpTopics(event.target.value, userRole));
                  }}
                  className="w-full bg-transparent text-xs outline-none"
                  placeholder="Procure aluno, pagamento, turma..."
                />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                {selectedTopic ? (
                  <div className="space-y-3">
                    <button type="button" onClick={() => setSelectedTopic(null)} className="flex items-center gap-1 text-xs text-slate-600">
                      <ArrowLeft className="h-3 w-3" /> Voltar
                    </button>
                    <h4 className="text-sm font-semibold text-slate-900">{selectedTopic.title}</h4>
                    <p className="rounded-md border bg-white p-3 text-xs leading-relaxed text-slate-700">{selectedTopic.answer}</p>
                    {selectedTopic.href ? (
                      <button
                        type="button"
                        onClick={() => {
                          router.push(selectedTopic.href!(routeSchoolParam));
                          setIsOpen(false);
                        }}
                        className="w-full rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
                      >
                        Abrir tela
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {helpTopics.map((topic) => (
                      <button
                        key={topic.key}
                        type="button"
                        onClick={() => setSelectedTopic(topic)}
                        className="w-full rounded-md border bg-white p-3 text-left text-xs hover:bg-slate-50"
                      >
                        <span className="block font-semibold text-slate-900">{topic.title}</span>
                        <span className="text-slate-500">{topic.category}</span>
                      </button>
                    ))}
                    {helpTopics.length === 0 ? <p className="text-xs text-slate-500">Sem caminho documentado para essa busca.</p> : null}
                  </div>
                )}
              </div>
              <div className="border-t bg-white p-2">
                <button type="button" onClick={() => setShowHelp(false)} className="w-full rounded-md border px-3 py-2 text-xs font-semibold text-slate-700">
                  Voltar ao assistente
                </button>
              </div>
            </section>
          ) : (
            <section className="flex min-h-0 flex-1 flex-col">
              <div className="border-b border-slate-100 bg-slate-50 px-3 py-2">
                <button
                  type="button"
                  onClick={showContextCapabilities}
                  className="w-full rounded-md border border-emerald-200 bg-white px-3 py-2 text-left text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
                >
                  O que posso fazer nesta tela?
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-3">
                <div className="mb-3 flex flex-wrap gap-2">
                  {suggestions.slice(0, 4).map((suggestion) => (
                    <button
                      key={suggestion.key}
                      type="button"
                      onClick={() => handleSuggestion(suggestion)}
                      className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                    >
                      {suggestion.title}
                    </button>
                  ))}
                </div>

                <div className="space-y-3">
                  {messages.map((message) => {
                    const isAi = message.sender === "ai";
                    return (
                      <div key={message.id} className={`flex ${isAi ? "justify-start" : "justify-end"}`}>
                        <div className={`max-w-[88%] rounded-lg px-3 py-2 text-xs leading-relaxed ${isAi ? "border bg-white text-slate-800" : "bg-slate-900 text-white"}`}>
                          <p className="whitespace-pre-wrap">{message.text}</p>
                          {isAi && message.copyable ? (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(cleanGeneratedText(message.text));
                                  setCopiedId(message.id);
                                }}
                                className="rounded border px-2 py-1 text-[10px] text-slate-600"
                              >
                                {copiedId === message.id ? <Check className="inline h-3 w-3" /> : <Copy className="inline h-3 w-3" />} Copiar
                              </button>
                              <button type="button" onClick={() => sendFeedback(message, "useful")} className="rounded border px-2 py-1 text-[10px] text-slate-600">
                                <ThumbsUp className="inline h-3 w-3" /> Útil
                              </button>
                              <button type="button" onClick={() => sendFeedback(message, "not_useful", "redo")} className="rounded border px-2 py-1 text-[10px] text-slate-600">
                                <ThumbsDown className="inline h-3 w-3" /> Não útil
                              </button>
                              {feedbackId === message.id ? <span className="text-[10px] text-emerald-700">Feedback salvo</span> : null}
                            </div>
                          ) : null}
                          {message.quickReplies?.length ? (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {message.quickReplies.map((reply) => (
                                <button
                                  key={`${message.id}-${reply.action}`}
                                  type="button"
                                  onClick={() => handleQuickAction(reply.action)}
                                  className="rounded-md border bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-700 hover:bg-slate-100"
                                >
                                  {reply.label}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                  {thinking ? (
                    <div className="flex justify-start">
                      <div className="rounded-lg border bg-white px-3 py-2 text-xs text-slate-500">Preparando rascunho...</div>
                    </div>
                  ) : null}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {inputRequired ? (
                <form onSubmit={submitInput} className="border-t border-slate-100 bg-white p-2">
                  <div className="flex gap-2">
                    <textarea
                      value={inputValue}
                      onChange={(event) => setInputValue(event.target.value)}
                      disabled={thinking}
                      rows={2}
                      className="min-h-10 flex-1 resize-none rounded-md border px-3 py-2 text-xs outline-none focus:border-slate-400"
                      placeholder="Escreva apenas o texto necessário para este fluxo..."
                    />
                    <button type="submit" disabled={thinking || !inputValue.trim()} className="rounded-md bg-slate-900 px-3 text-white disabled:bg-slate-200">
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                  <button type="button" onClick={() => handleQuickAction("cancel_flow")} className="mt-2 w-full rounded-md border border-dashed px-3 py-1.5 text-[11px] text-slate-500">
                    Cancelar fluxo
                  </button>
                </form>
              ) : (
                <div className="flex items-center justify-between border-t bg-white px-3 py-2 text-[11px] text-slate-500">
                  <span>Sem chat livre. Escolha uma ação.</span>
                  <button type="button" onClick={openHelp} className="flex items-center gap-1 font-semibold text-slate-700">
                    <HelpCircle className="h-3 w-3" /> Ajuda
                  </button>
                </div>
              )}
            </section>
          )}
        </div>
      ) : null}
    </>
  );
}
