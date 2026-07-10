"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Copy,
  HelpCircle,
  Search,
  Send,
  ThumbsDown,
  ThumbsUp,
  X,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { describeScreenContext, type AiWidgetContext } from "@/lib/assistant/screen-context";
import { getActionsForRole, ASSISTANT_ACTIONS } from "@/lib/assistant/action-registry";
import { findHelpTopics, type HelpTopic } from "@/lib/klasse-help/help-topics";
import { buildContextualPortalHref } from "@/lib/navigation";

export type { AiWidgetContext };

type Message = {
  id: string;
  sender: "user" | "ai";
  text: string;
  copyable?: boolean;
  actionId?: string | null;
  quickReplies?: Array<{ label: string; action: string }>;
  links?: Array<{ label: string; href: string }>;
};

type AssistantSuggestionPayload = {
  key: string;
  title: string;
};

type AssistantResponsePayload = {
  answer?: string;
  links?: Array<{ label: string; href: string }>;
  suggestions?: AssistantSuggestionPayload[];
  mode?: string;
};

type RewriteResponsePayload = {
  title?: string;
  text?: string;
  body?: string;
  whatsappText?: string;
  reviewNotes?: string[];
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

const REWRITE_MODE_LABELS: Record<string, string> = {
  more_formal: "Mais formal",
  shorter: "Mais curto",
  clearer: "Mais claro",
  institutional: "Institucional",
  whatsapp: "WhatsApp",
  guardian: "Encarregado",
};

function formatRewriteResponse(json: RewriteResponsePayload) {
  const title = String(json?.title ?? "Comunicado assistido").trim();
  const body = String(json?.body ?? json?.text ?? "").trim();
  const whatsappText = String(json?.whatsappText ?? "").trim();
  const reviewNotes = Array.isArray(json?.reviewNotes)
    ? json.reviewNotes.map(String).map((item) => item.trim()).filter(Boolean)
    : [];

  const parts = [`${title}\n\n${body}`];
  if (whatsappText && whatsappText !== body) {
    parts.push(`Versão WhatsApp:\n${whatsappText}`);
  }
  if (reviewNotes.length > 0) {
    parts.push(`Revisão humana:\n${reviewNotes.map((note: string) => `- ${note}`).join("\n")}`);
  }

  return parts.join("\n\n");
}

export default function AiChatWidget({
  schoolId,
  schoolParam,
  hasMobileNav = false,
  context,
}: AiChatWidgetProps) {
  const router = useRouter();
  const pathname = usePathname();
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
  const [helpSearch, setHelpSearch] = useState("");
  const [helpTopics, setHelpTopics] = useState<HelpTopic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<HelpTopic | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [queryCache] = useState(() => new Map<string, AssistantResponsePayload>());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [position, setPosition] = useState<{ right: number; bottom: number }>({ right: 24, bottom: 24 });
  const [dragging, setDragging] = useState(false);
  const isDragging = useRef(false);
  const dragMoved = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, right: 0, bottom: 0 });
  const positionRef = useRef(position);

  const effectiveSchoolId = resolvedSchoolId ?? schoolId;
  const contextName = describeScreenContext(context);
  const actions = useMemo(
    () => getActionsForRole(userRole, context?.module),
    [context?.module, userRole]
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
        const roleStr = String(data.role ?? "").toLowerCase();

        // Block student, teacher, guardian profiles from viewing the assistant completely
        if (["aluno", "professor", "encarregado", "docente", "guardian"].includes(roleStr)) {
          setIsAllowed(false);
          setCheckingAccess(false);
          return;
        }

        setResolvedSchoolId(typeof data.schoolId === "string" ? data.schoolId : null);
        setUserRole(roleStr);
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

    // UI Aesthetic Guidelines: Wow the user upon opening with a highly context-specific greeting
    let greeting = "";
    if (context?.module === "financeiro") {
      greeting = "Você está no Radar Financeiro. Posso ajudar a priorizar cobranças, gerar rascunhos ou abrir a Central WhatsApp.";
    } else if (context?.module === "secretaria") {
      greeting = "Você está na Secretaria. Posso ajudar com alunos, documentos, matrículas e comunicados.";
    } else {
      greeting = `Olá! Estou no KLASSE e conheço esta área. Como posso ajudar? (${describeScreenContext(context)})`;
    }

    setMessages([
      ai(greeting, {
        quickReplies: [
          { label: "O que posso fazer nesta tela?", action: "screen_capabilities" },
          { label: "Abrir Central IA", action: "open_actions" },
        ],
      }),
    ]);
  }, [isAllowed, context, contextName]);

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
    setMessages((current) => [...current, ...next].slice(-10));
  }

  function startFlow(id: FlowId) {
    setShowHelp(false);
    setSelectedTopic(null);
    setInputValue("");
    if (id === "rewrite_notice") {
      setFlow({ id, step: 1, data: { mode: "more_formal" } });
      pushMessages([
        user(FLOW_TITLES[id]),
        ai("Escolha o ajuste de tom desejado para o comunicado:", {
          quickReplies: [
            { label: "Mais formal", action: "rewrite_mode:more_formal" },
            { label: "Mais curto", action: "rewrite_mode:shorter" },
            { label: "Mais claro", action: "rewrite_mode:clearer" },
            { label: "Institucional", action: "rewrite_mode:institutional" },
            { label: "WhatsApp", action: "rewrite_mode:whatsapp" },
            { label: "Encarregado", action: "rewrite_mode:guardian" },
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
        ai("Qual é o público-alvo deste comunicado?", {
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
        ai("Confirma que deseja criar um plano de cobrança como rascunho para revisão na Central de Ações?", {
          quickReplies: [
            { label: "Sim, criar rascunho", action: "run_finance_plan" },
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
        ai("A IA criará um rascunho de mensagem de cobrança. O envio exige revisão manual. Selecione o tom da mensagem:", {
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
      const displayText = formatRewriteResponse(json);
      const copyText = String(json.body ?? json.text ?? "").trim();
      pushMessages([
        ai(`Rascunho criado para revisão:\n\n${displayText}`, {
          copyable: true,
          quickReplies: [
            { label: "Abrir Central IA", action: "open_actions" },
            { label: "Copiar texto", action: `copy:${encodeURIComponent(copyText)}` },
            json.whatsappText
              ? { label: "Copiar WhatsApp", action: `copy:${encodeURIComponent(String(json.whatsappText))}` }
              : { label: "Salvar na Central", action: `save_action:communication_draft:${encodeURIComponent(copyText)}` },
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
    const titles = actions.slice(0, 5).map((item, index) => `${index + 1}. ${item.title}`).join("\n");
    pushMessages([
      user("O que posso fazer nesta tela?"),
      ai(`Nesta tela você pode:\n${titles || "Nenhuma ação contextual liberada para o teu perfil."}`, {
        quickReplies: actions.slice(0, 4).map((action) => ({ label: action.title, action: `suggestion:${action.key}` })),
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

  function handleActionSuggestion(suggestionKey: string) {
    const act = ASSISTANT_ACTIONS.find((a) => a.key === suggestionKey);
    if (act) {
      if (act.href) {
        router.push(act.href(routeSchoolParam));
        setIsOpen(false);
        return;
      }
      if (act.key === "improve_notice") return startFlow("rewrite_notice");
      if (act.key === "generate_notice") return startFlow("guided_notice");
      if (act.key === "create_whatsapp_draft") return startFlow("whatsapp_draft");
      if (act.key === "generate_billing_plan") return startFlow("finance_plan");
      if (act.key === "generate_school_summary") return startFlow("screen_summary");
      if (act.key === "explain_current_screen") return showContextCapabilities();
      if (act.key === "find_system_path") return openHelp();
    }
  }

  function handleQuickAction(action: string) {
    if (action === "cancel_flow") {
      setFlow(null);
      setInputValue("");
      pushMessages([ai("Fluxo cancelado. Escolha uma próxima ação quando quiser.")]);
      return;
    }
    if (action === "screen_capabilities") return showContextCapabilities();
    if (action === "open_actions") {
      router.push(`/escola/${routeSchoolParam}/admin/ai/actions`);
      setIsOpen(false);
      return;
    }
    if (action === "open_whatsapp") {
      router.push(buildContextualPortalHref(routeSchoolParam, "/admin/comunicacao/whatsapp", pathname));
      setIsOpen(false);
      return;
    }
    if (action.startsWith("suggestion:")) {
      const suggestionKey = action.replace("suggestion:", "");
      handleActionSuggestion(suggestionKey);
      return;
    }
    if (action.startsWith("rewrite_mode:")) {
      const mode = action.replace("rewrite_mode:", "");
      setFlow({ id: "rewrite_notice", step: 2, data: { mode } });
      pushMessages([
        user(REWRITE_MODE_LABELS[mode] ?? "Melhorar comunicado"),
        ai("Cole o texto do comunicado para eu preparar o rascunho estruturado. Evite dados sensíveis desnecessários."),
      ]);
      return;
    }
    if (action.startsWith("notice_audience:")) {
      const audience = action.replace("notice_audience:", "");
      setFlow({ id: "guided_notice", step: 2, data: { audience } });
      pushMessages([
        user(audience),
        ai("Qual é o tom do comunicado?", {
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
      pushMessages([user(toneLabel), ai("Digite a ideia principal do comunicado para eu gerar o rascunho.")]);
      return;
    }
    if (action === "run_finance_plan") return runFinancePlan();
    if (action.startsWith("whatsapp_tone:")) {
      const tone = action.replace("whatsapp_tone:", "");
      setFlow({ id: "whatsapp_draft", step: 2, data: { tone } });
      pushMessages([user(tone), ai("Descreva a ideia da mensagem. Lembre-se de não usar dados reais sensíveis.")]);
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
        ai("Para criar rascunho WhatsApp, informe um contato manual autorizado na Central WhatsApp. O assistente não envia mensagens nem aprova envios diretamente.", {
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

  async function handleGeneralQuery(text: string) {
    setThinking(true);

    // Client-side local Cache logic for high performance & instant responses
    const cacheKey = `${effectiveSchoolId}:${userRole}:${text.toLowerCase().trim()}:${context?.module || "any"}`;
    if (queryCache.has(cacheKey)) {
      const cached = queryCache.get(cacheKey);
      if (cached && cached.answer) {
        pushMessages([
          ai(cached.answer, {
            links: cached.links,
            quickReplies: cached.suggestions?.map((s) => ({ label: s.title, action: `suggestion:${s.key}` })),
          }),
        ]);
        setThinking(false);
        return;
      }
    }

    try {
      const res = await fetch("/api/admin/ai/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId: effectiveSchoolId,
          message: text,
          context,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Erro ao consultar assistente.");

      if (json.mode === "fast_path") {
        queryCache.set(cacheKey, json);
      }

      pushMessages([
        ai(json.answer, {
          links: json.links,
          quickReplies: json.suggestions?.map((s: AssistantSuggestionPayload) => ({ label: s.title, action: `suggestion:${s.key}` })),
        }),
      ]);
    } catch (err) {
      pushMessages([ai(errorMessage(err, "Erro ao obter resposta do assistente."))]);
    } finally {
      setThinking(false);
    }
  }

  function submitInput(e: React.FormEvent) {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text) return;
    setInputValue("");
    pushMessages([user(text)]);

    if (flow) {
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
    } else {
      // General question answering
      handleGeneralQuery(text);
    }
  }

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
        className={`fixed z-50 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-tr from-[#1F6B3B] to-[#2b7e49] text-white shadow-lg hover:shadow-xl hover:shadow-[#1F6B3B]/20 active:scale-95 border border-[#1F6B3B]/20 ${dragging ? "" : "transition-all duration-300"}`}
        aria-label="Assistente KLASSE"
      >
        {isOpen ? <X className="h-5 w-5 text-white" /> : <Sparkles className="h-5 w-5 text-[#E3B23C] animate-pulse" />}
      </button>

      {isOpen ? (
        <div
          style={{ right: cardRight, bottom: position.bottom }}
          className={`fixed z-50 flex h-[520px] max-h-[75vh] ${mobile ? "w-[calc(100vw-28px)]" : "w-[360px]"} flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl`}
        >
          <header
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
            className="flex cursor-grab items-center justify-between bg-gradient-to-r from-slate-900 to-slate-950 px-4 py-3 text-white border-b border-slate-800 select-none"
          >
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-[#1F6B3B] to-[#2b7e49] border border-[#1F6B3B]/30">
                <Sparkles className="h-4 w-4 text-[#E3B23C]" />
              </div>
              <div>
                <h3 className="text-xs font-black tracking-wider uppercase text-slate-100 leading-none mb-1">Klasse Brain</h3>
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter truncate max-w-[200px]">{contextName}</span>
                </div>
              </div>
            </div>
            <button type="button" onClick={() => setIsOpen(false)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
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
              <div className="border-b border-slate-100 bg-[#E3B23C]/5 px-3 py-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={showContextCapabilities}
                  className="flex-1 text-left text-[11px] font-bold text-[#7A5200] hover:text-[#1F6B3B] transition-colors"
                >
                  💡 O que posso fazer neste ecrã?
                </button>
                <span className="text-[9px] font-black uppercase bg-[#E3B23C]/20 text-[#7A5200] px-2 py-0.5 rounded border border-[#E3B23C]/30 leading-none">
                  {context?.module || "Geral"}
                </span>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-3">
                <div className="mb-3 flex flex-wrap gap-2">
                  {actions.slice(0, 4).map((act) => (
                    <button
                      key={act.key}
                      type="button"
                      onClick={() => handleActionSuggestion(act.key)}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-bold text-slate-700 hover:border-[#1F6B3B] hover:text-[#1F6B3B] transition-all shadow-sm"
                    >
                      {act.title}
                    </button>
                  ))}
                </div>

                <div className="space-y-4">
                  {messages.map((message) => {
                    const isAi = message.sender === "ai";
                    return (
                      <div key={message.id} className={`flex ${isAi ? "justify-start" : "justify-end"}`}>
                        <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-sm ${isAi ? "border border-slate-100 bg-white text-slate-800 rounded-tl-none" : "bg-[#1F6B3B] text-white rounded-tr-none"}`}>
                          <p className="whitespace-pre-wrap">{message.text}</p>

                          {/* Rendering internal routes returned by the assistant */}
                          {isAi && message.links && message.links.length > 0 ? (
                            <div className="mt-2.5 space-y-1.5">
                              {message.links.map((link, idx) => (
                                <button
                                  key={`${message.id}-link-${idx}`}
                                  type="button"
                                  onClick={() => {
                                    if (link.href.startsWith("/api/")) {
                                      window.open(link.href, "_blank");
                                    } else {
                                      router.push(link.href);
                                      setIsOpen(false);
                                    }
                                  }}
                                  className="w-full flex items-center justify-between gap-1.5 rounded-lg border border-emerald-200/50 bg-[#1F6B3B]/5 hover:bg-[#1F6B3B]/10 px-3 py-2 text-[11px] font-bold text-[#1F6B3B] transition-all"
                                >
                                  <span className="truncate">{link.label}</span>
                                  <ExternalLink className="h-3 w-3 shrink-0" />
                                </button>
                              ))}
                            </div>
                          ) : null}

                          {isAi && message.copyable ? (
                            <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-slate-50 pt-2">
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(cleanGeneratedText(message.text));
                                  setCopiedId(message.id);
                                }}
                                className="rounded-md border border-slate-100 bg-slate-50/50 px-2 py-1 text-[10px] font-semibold text-slate-500 hover:bg-slate-100 transition-colors"
                              >
                                {copiedId === message.id ? <Check className="inline h-3 w-3 mr-0.5" /> : <Copy className="inline h-3 w-3 mr-0.5" />} Copiar
                              </button>
                              <button type="button" onClick={() => sendFeedback(message, "useful")} className="rounded-md border border-slate-100 bg-slate-50/50 px-2 py-1 text-[10px] font-semibold text-slate-500 hover:bg-slate-100 transition-colors">
                                <ThumbsUp className="inline h-3 w-3 mr-0.5" /> Útil
                              </button>
                              <button type="button" onClick={() => sendFeedback(message, "not_useful", "redo")} className="rounded-md border border-slate-100 bg-slate-50/50 px-2 py-1 text-[10px] font-semibold text-slate-500 hover:bg-slate-100 transition-colors">
                                <ThumbsDown className="inline h-3 w-3 mr-0.5" /> Ruim
                              </button>
                              {feedbackId === message.id ? <span className="text-[10px] text-emerald-700 font-bold ml-1 self-center">Salvo</span> : null}
                            </div>
                          ) : null}
                          {message.quickReplies?.length ? (
                            <div className="mt-2.5 flex flex-wrap gap-1.5">
                              {message.quickReplies.map((reply) => (
                                <button
                                  key={`${message.id}-${reply.action}`}
                                  type="button"
                                  onClick={() => handleQuickAction(reply.action)}
                                  className="rounded-full border border-slate-200 bg-slate-50 hover:bg-white hover:border-[#1F6B3B] hover:text-[#1F6B3B] px-2.5 py-1 text-[10px] font-bold text-slate-600 transition-all shadow-sm"
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
                      <div className="rounded-lg border bg-white px-3 py-2 text-xs text-slate-500">
                        <span className="inline-block animate-pulse">Processando...</span>
                      </div>
                    </div>
                  ) : null}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              <form onSubmit={submitInput} className="border-t border-slate-100 bg-white p-2">
                <div className="flex gap-2">
                  <textarea
                    value={inputValue}
                    onChange={(event) => setInputValue(event.target.value)}
                    disabled={thinking}
                    rows={1}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        submitInput(e);
                      }
                    }}
                    className="min-h-9 flex-1 resize-none rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#1F6B3B] focus:ring-1 focus:ring-[#1F6B3B]/20"
                    placeholder={flow ? "Escreva para este fluxo..." : "Pergunte ao assistente KLASSE..."}
                  />
                  <button type="submit" disabled={thinking || !inputValue.trim()} className="rounded-lg bg-[#1F6B3B] px-3.5 text-white disabled:bg-slate-100 disabled:text-slate-400 hover:brightness-105 transition-all shadow-sm">
                    <Send className="h-4 w-4" />
                  </button>
                </div>
                {flow ? (
                  <button type="button" onClick={() => handleQuickAction("cancel_flow")} className="mt-2 w-full rounded-md border border-dashed px-3 py-1 text-[10px] text-slate-500">
                    Cancelar fluxo
                  </button>
                ) : (
                  <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                    <span>Busca de rotas e ajuda oficial.</span>
                    <button type="button" onClick={openHelp} className="flex items-center gap-0.5 font-semibold text-slate-600 hover:text-slate-900">
                      <HelpCircle className="h-3 w-3" /> Ajuda
                    </button>
                  </div>
                )}
              </form>
            </section>
          )}
        </div>
      ) : null}
    </>
  );
}
