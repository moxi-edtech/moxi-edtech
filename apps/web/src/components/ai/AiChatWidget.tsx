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
  MessageCircle,
} from "lucide-react";
import { describeScreenContext, type AiWidgetContext } from "@/lib/assistant/screen-context";
import type { SchoolIntelligenceConversation } from "@/lib/assistant/data-copilot/school-intelligence-contract";
import { canUseOperationalCopilot } from "@/lib/roles/ai-roles";
import { getActionsForRole, ASSISTANT_ACTIONS } from "@/lib/assistant/action-registry";
import type { AssistantActionV2 } from "@/lib/assistant/actions-v2";
import { findHelpTopics, type HelpTopic } from "@/lib/klasse-help/help-topics";
import { buildContextualPortalHref } from "@/lib/navigation";

export type { AiWidgetContext };

type InsightPayload = {
  diagnosis: string;
  impact: string;
  recommendation: string;
  evidence: Array<{ label: string; value: string }>;
  actions: AssistantActionV2[];
  provenance?: {
    source: string;
    consultedAt: string;
    scope: string;
    freshness: "live" | "partial" | "unknown";
    limitation?: string;
  };
};

function formatInsightSource(source: string) {
  return source
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

type Message = {
  id: string;
  sender: "user" | "ai";
  text: string;
  copyable?: boolean;
  actionId?: string | null;
  aiInsightId?: string;
  quickReplies?: Array<{ label: string; action: string }>;
  links?: Array<{ label: string; href: string }>;
  actions?: AssistantActionV2[];
  mode?: string;
  insight?: InsightPayload;
};

type AssistantSuggestionPayload = {
  key: string;
  title: string;
};

type AssistantResponsePayload = {
  answer?: string;
  links?: Array<{ label: string; href: string }>;
  actions?: AssistantActionV2[];
  suggestions?: AssistantSuggestionPayload[];
  mode?: string;
  operatingMode?: "help" | "data" | "action";
  insight?: InsightPayload;
  aiInsightId?: string;
  fallbackReason?: "permission_denied" | "knowledge_not_found" | "provider_unavailable" | "data_unavailable";
  conversation?: SchoolIntelligenceConversation;
  clarification?: {
    question: string;
    options: Array<{ label: string; value: string }>;
  };
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

function normalizeConversationText(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ªº°]/g, "")
    .trim();
}

function resolveConversationalQuery(text: string, messages: Message[]) {
  const normalized = normalizeConversationText(text);
  const isClassFollowUp =
    /\b(?:classe|turma)\b/.test(normalized) ||
    /\b[a-z]{2,}[\s-]*\d{1,2}\b/.test(normalized);
  const isContextFollowUp =
    /^(e |agora |tambem |também |desses|dessas|deles|delas|isso|essa|esse|qual |quais |por que|detalhe|detalha|mostre mais|prepare|exporte|abrir|abrir a|e os )/.test(normalized);

  const recentUserMessages = messages
    .filter((message) => message.sender === "user")
    .slice(-6)
    .reverse()
  const recentDebtIntent = recentUserMessages.find((message) =>
    /\b(?:divid|devedor|inadimpl|atras)\w*/.test(normalizeConversationText(message.text)),
  );

  if (isClassFollowUp && recentDebtIntent) return `${recentDebtIntent.text} ${text}`;
  if (!isContextFollowUp) return text;

  const recentContext = recentUserMessages.find((message) => normalizeConversationText(message.text).length >= 8);
  if (!recentContext) return text;

  return `${recentContext.text} ${text}`;
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
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const intelligenceConversationRef = useRef<SchoolIntelligenceConversation | null>(null);
  const queryEpochRef = useRef(0);
  const [activeAcademicYearId, setActiveAcademicYearId] = useState<string | null>(null);
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
        if (!canUseOperationalCopilot(roleStr)) {
          intelligenceConversationRef.current = null;
          setSessionUserId(null);
          setIsAllowed(false);
          setCheckingAccess(false);
          return;
        }

        setResolvedSchoolId(typeof data.schoolId === "string" ? data.schoolId : null);
        setUserRole(roleStr);
        setSessionUserId(typeof data.userId === "string" ? data.userId : null);
        setIsAllowed(Boolean(res.ok && json?.ok && data.allowed));
      } catch {
        if (active) {
          intelligenceConversationRef.current = null;
          setSessionUserId(null);
          setIsAllowed(false);
        }
      } finally {
        if (active) setCheckingAccess(false);
      }
    }
    checkAccess();
    return () => {
      active = false;
    };
  }, [schoolId]);

  // A mudança de escola invalida toda a conversa e qualquer proposta anterior.
  // Não reutilizar mensagens com dados de alunos entre tenants.
  useEffect(() => {
    queryEpochRef.current += 1;
    intelligenceConversationRef.current = null;
    queryCache.clear();
    setMessages([]);
    setFlow(null);
    setResolvedSchoolId(null);
    setSessionUserId(null);
    setActiveAcademicYearId(null);
  }, [schoolId, queryCache]);

  // The active academic year is read from the user's selected route, not guessed by the LLM.
  useEffect(() => {
    const update = () => {
      const value = new URLSearchParams(window.location.search).get("ano_letivo_id");
      const valid = value && /^[a-f\d-]{36}$/i.test(value) ? value : null;
      setActiveAcademicYearId((current) => {
        if (current !== valid) {
          intelligenceConversationRef.current = null;
          queryEpochRef.current += 1;
        }
        return valid;
      });
    };
    update();
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, [pathname]);

  useEffect(() => {
    if (!isAllowed) return;

    let greeting = "";
    if (context?.module === "financeiro") {
      greeting = "Posso ajudar a consultar cobranças, preparar rascunhos e encontrar ações do Financeiro.";
    } else if (context?.module === "secretaria") {
      greeting = "Posso ajudar com alunos, documentos, matrículas e comunicados.";
    } else {
      greeting = "Como posso ajudar nesta área da escola?";
    }

    // Preserve the conversation when navigating between admin/secretaria screens.
    // Context updates affect new requests, not the existing chat transcript.
    setMessages((previous) => previous.length > 0 ? previous : [
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
      const sourceMessage = [...messages]
        .reverse()
        .find((message) => message.sender === "ai" && message.insight);
      const sourceInsight = sourceMessage?.insight;
      const evidence = new Map(
        (sourceInsight?.evidence ?? []).map((item) => [item.label, item.value]),
      );
      const classLabel = evidence.get("Turma") ?? "turma seleccionada";
      const studentsLabel = evidence.get("Alunos em atraso") ?? "casos a confirmar";
      const amountLabel = evidence.get("Valor em atraso") ?? "valor a confirmar";
      const content = [
        "PLANO DE COBRANÇA — RASCUNHO",
        "",
        `Escopo: ${classLabel}.`,
        `Casos em atraso: ${studentsLabel}.`,
        `Valor vencido identificado: ${amountLabel}.`,
        "",
        "1. Financeiro — validar no Radar Financeiro os títulos, pagamentos recentes e contactos autorizados.",
        "2. Financeiro — segmentar os casos por antiguidade e valor, priorizando atrasos mais antigos e montantes maiores.",
        "3. Secretaria — confirmar situações excepcionais, acordos existentes e dados de contacto antes de qualquer abordagem.",
        "4. Financeiro — preparar mensagens individualizadas com valores e datas confirmados, sempre como rascunho.",
        "5. Administração — rever e aprovar cada comunicação ou proposta de acordo antes do envio.",
        "6. Financeiro — acompanhar respostas e actualizar o estado após 7 dias; escalar apenas casos não resolvidos.",
        "",
        "Indicadores de acompanhamento: valor recuperado, casos regularizados, acordos aprovados e casos sem resposta.",
        "Gate humano: este plano não envia mensagens, não altera dívidas e não aprova acordos automaticamente.",
      ].join("\n");

      const res = await fetch("/api/admin/ai/actions/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId: effectiveSchoolId,
          title: "Plano de cobrança da semana",
          content,
          actionType: "operational_recommendation",
          sourceModule: "financeiro",
          riskLevel: "high",
          aiInsightId: sourceMessage?.aiInsightId,
          context: {
            page: context?.page ?? "financeiro",
            assistant_v3: true,
            recommendation_kind: "billing_plan",
          },
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Erro ao criar plano financeiro.");
      pushMessages([
        ai(`Plano de cobrança criado para revisão:\n\n${content}`, {
          copyable: true,
          actionId: json.action?.id ?? null,
          quickReplies: [
            { label: "Abrir Central IA", action: "open_actions" },
            { label: "Gerar mensagem separadamente", action: "suggestion:create_whatsapp_draft" },
            { label: "Copiar", action: `copy:${encodeURIComponent(content)}` },
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

  async function saveAction(
    content: string,
    actionType: "communication_draft" | "finance_message" | "school_summary" | "operational_recommendation",
    aiInsightId?: string,
  ) {
    setThinking(true);
    try {
      const res = await fetch("/api/admin/ai/actions/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId: effectiveSchoolId,
          title: actionType === "finance_message"
            ? "Rascunho financeiro assistido"
            : actionType === "operational_recommendation"
              ? "Plano de intervenção pedagógica"
              : "Rascunho assistido",
          content,
          actionType,
          sourceModule: actionType === "operational_recommendation"
            ? "academico"
            : context?.module === "whatsapp"
              ? "comunicacao"
              : context?.module || "classe_ai",
          riskLevel: ["finance_message", "operational_recommendation"].includes(actionType) ? "high" : "medium",
          aiInsightId,
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

    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.sender === "ai" && lastMsg.text.includes("ações seguras")) {
      return;
    }

    pushMessages([user("O que posso fazer nesta tela?"), ai(`Nesta tela (${contextName}), posso sugerir ações seguras e abrir caminhos oficiais.`)]);
  }

  function showContextCapabilities() {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.sender === "ai" && lastMsg.text.includes("Nesta tela você pode:")) {
      return;
    }

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

  function runAssistantAction(action: AssistantActionV2, aiInsightId?: string) {
    if (action.requiresApproval && action.riskLevel === "high") {
      pushMessages([
        ai(`Ação de alto risco: ${action.label}. Vou abrir o fluxo seguro de rascunho/revisão; nada será enviado ou aplicado automaticamente.`),
      ]);
    }

    if (action.kind === "open_screen" || action.kind === "export") {
      if (!action.href) return;
      if (action.href.startsWith("/api/")) {
        window.open(action.href, "_blank", "noopener,noreferrer");
        return;
      }
      router.push(action.href);
      setIsOpen(false);
      return;
    }

    if (action.kind === "copy_text") {
      const text = typeof action.payload?.text === "string" ? action.payload.text : action.description ?? action.label;
      void navigator.clipboard.writeText(text);
      pushMessages([ai("Texto copiado.")]);
      return;
    }

    const quickAction = typeof action.payload?.quickAction === "string" ? action.payload.quickAction : "";
    if (quickAction === "quick:open_actions") {
      handleQuickAction("open_actions");
      return;
    }
    if (quickAction === "quick:open_help") {
      openHelp();
      return;
    }
    if (quickAction === "quick:screen_capabilities") {
      showContextCapabilities();
      return;
    }
    if (quickAction === "flow:pedagogical_intervention_plan") {
      const content = typeof action.payload?.content === "string"
        ? action.payload.content
        : "Plano pedagógico sem conteúdo disponível.";
      void saveAction(content, "operational_recommendation", aiInsightId);
      return;
    }
    if (quickAction.startsWith("flow:")) {
      const flowId = quickAction.replace("flow:", "") as FlowId;
      startFlow(flowId);
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
    if (action.startsWith("clarification:")) {
      const clarifiedQuery = decodeURIComponent(action.replace("clarification:", ""));
      pushMessages([user(clarifiedQuery)]);
      void handleGeneralQuery(clarifiedQuery);
      return;
    }
    if (action.startsWith("retry_query:")) {
      const retryQuery = decodeURIComponent(action.replace("retry_query:", ""));
      pushMessages([user(retryQuery)]);
      void handleGeneralQuery(retryQuery);
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
    const requestEpoch = queryEpochRef.current;
    setThinking(true);
    const contextualQuery = intelligenceConversationRef.current ? text : resolveConversationalQuery(text, messages);

    // Client-side local Cache logic for high performance & instant responses
    const cacheKey = `${effectiveSchoolId}:${userRole}:${contextualQuery.toLowerCase().trim()}:${context?.module || "any"}`;
    if (queryCache.has(cacheKey)) {
      const cached = queryCache.get(cacheKey);
      if (cached && cached.answer) {
        pushMessages([
          ai(cached.answer, {
            links: cached.links,
            actions: cached.actions,
            mode: cached.operatingMode ?? cached.mode,
            insight: cached.insight,
            aiInsightId: cached.aiInsightId,
            quickReplies: cached.clarification?.options.map((option) => ({ label: option.label, action: `clarification:${encodeURIComponent(option.value)}` }))
              ?? cached.suggestions?.map((s) => ({ label: s.title, action: `suggestion:${s.key}` })),
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
          message: contextualQuery,
          context: { ...context, academicYearId: activeAcademicYearId ?? context?.academicYearId },
          conversation: intelligenceConversationRef.current &&
            intelligenceConversationRef.current.userId === sessionUserId &&
            intelligenceConversationRef.current.schoolId === effectiveSchoolId
              ? intelligenceConversationRef.current : undefined,
        }),
        signal: AbortSignal.timeout(7_500),
      });
      const json = await res.json().catch(() => null);
      if (requestEpoch !== queryEpochRef.current) return; // logout, school/year switch
      if (!res.ok || !json?.ok) {
        if (res.status === 401 || res.status === 403) intelligenceConversationRef.current = null;
        throw new Error(json?.error || "Erro ao consultar assistente.");
      }
      intelligenceConversationRef.current = json.conversation &&
        json.conversation.userId === sessionUserId && json.conversation.schoolId === effectiveSchoolId
          ? json.conversation : null;

      if (json.mode === "fast_path") {
        queryCache.set(cacheKey, json);
      }

      pushMessages([
        ai(json.answer, {
          links: json.links,
          actions: json.actions,
          mode: json.operatingMode ?? json.mode,
          insight: json.insight,
          aiInsightId: json.aiInsightId,
          quickReplies: json.clarification?.options.map((option: { label: string; value: string }) => ({ label: option.label, action: `clarification:${encodeURIComponent(option.value)}` }))
            ?? json.suggestions?.map((s: AssistantSuggestionPayload) => ({ label: s.title, action: `suggestion:${s.key}` }))
            ?? (json.conversation?.intent === "teacher_grade_deadlines" ? [
              { label: "Ver lista de professores", action: `clarification:${encodeURIComponent("Quais são esses professores?")}` },
            ] : json.conversation?.intent === "teacher_pending_details" ? [
              { label: "Próxima página", action: `clarification:${encodeURIComponent("Próxima página")}` },
            ] : (json.fallbackReason === "data_unavailable" || json.insight?.provenance?.freshness === "unknown") ? [
              { label: "Tentar novamente", action: `retry_query:${encodeURIComponent(contextualQuery)}` },
            ] : undefined),
        }),
      ]);
    } catch (err) {
      if (requestEpoch !== queryEpochRef.current) return;
      pushMessages([ai(`${errorMessage(err, "Erro ao obter resposta do assistente.")} A consulta não alterou dados. Pode tentar novamente.`, {
        quickReplies: [{ label: "Tentar novamente", action: `retry_query:${encodeURIComponent(contextualQuery)}` }],
      })]);
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
        className={`fixed z-50 flex h-12 w-12 items-center justify-center rounded-full bg-[#16A34A] text-white shadow-md hover:bg-[#15803D] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16A34A] ${dragging ? "" : "transition-colors"}`}
        aria-label={isOpen ? "Fechar KLASSE IA" : "Abrir KLASSE IA"}
        aria-expanded={isOpen}
        aria-controls="klasse-ai-chat-panel"
      >
        {isOpen ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </button>

      {isOpen ? (
        <div
          id="klasse-ai-chat-panel"
          role="dialog"
          aria-label="Conversa com o KLASSE IA"
          style={{ right: cardRight, bottom: position.bottom, maxHeight: `min(80dvh, calc(100dvh - ${position.bottom + 16}px))` }}
          className="fixed z-50 flex h-[640px] w-[min(440px,calc(100vw-28px))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10"
        >
          <header
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
            className="flex cursor-grab select-none items-center justify-between gap-4 border-b border-slate-100 bg-white px-5 py-4"
          >
            <div className="min-w-0">
              <h3 className="text-sm font-semibold tracking-tight text-slate-900">KLASSE IA</h3>
              <p className="mt-0.5 truncate text-xs font-normal text-slate-500">{contextName}</p>
            </div>
            <button type="button" onClick={() => setIsOpen(false)} aria-label="Fechar conversa" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1F6B3B]">
              <X className="h-4 w-4" />
            </button>
          </header>

          {showHelp ? (
            <section className="flex min-h-0 flex-1 flex-col bg-white">
              <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={helpSearch}
                  onChange={(event) => {
                    setHelpSearch(event.target.value);
                    setHelpTopics(findHelpTopics(event.target.value, userRole));
                  }}
                  className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none"
                  aria-label="Pesquisar na ajuda"
                  placeholder="Procurar na ajuda..."
                />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                {selectedTopic ? (
                  <div className="space-y-3">
                    <button type="button" onClick={() => setSelectedTopic(null)} className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
                      <ArrowLeft className="h-3 w-3" /> Voltar
                    </button>
                    <h4 className="text-base font-semibold text-slate-900">{selectedTopic.title}</h4>
                    <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{selectedTopic.answer}</p>
                    {selectedTopic.href ? (
                      <button
                        type="button"
                        onClick={() => {
                          router.push(selectedTopic.href!(routeSchoolParam));
                          setIsOpen(false);
                        }}
                        className="rounded-lg bg-[#1F6B3B] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#18572f]"
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
                        className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left text-sm transition-colors hover:bg-slate-50"
                      >
                        <span className="block font-semibold text-slate-900">{topic.title}</span>
                        <span className="mt-1 block text-xs text-slate-500">{topic.category}</span>
                      </button>
                    ))}
                    {helpTopics.length === 0 ? <p className="text-xs text-slate-500">Sem caminho documentado para essa busca.</p> : null}
                  </div>
                )}
              </div>
              <div className="border-t border-slate-100 bg-white p-4">
                <button type="button" onClick={() => setShowHelp(false)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  Voltar ao assistente
                </button>
              </div>
            </section>
          ) : (
            <section className="flex min-h-0 flex-1 flex-col">
              <div data-testid="klasse-ai-transcript" className="min-h-0 flex-1 overflow-y-auto bg-white px-4 py-5 sm:px-5">
                {messages.length <= 1 && !thinking && actions.length > 0 ? (
                  <div className="mb-6 flex flex-wrap gap-2" aria-label="Sugestões de consulta">
                    {actions.slice(0, 3).map((act) => (
                      <button
                        key={act.key}
                        type="button"
                        onClick={() => handleActionSuggestion(act.key)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-medium leading-5 text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1F6B3B]"
                      >
                        {act.title}
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="space-y-6">
                  {messages.map((message) => {
                    const isAi = message.sender === "ai";
                    return (
                      <div key={message.id} className={`flex ${isAi ? "justify-start" : "justify-end"}`}>
                        <div className={isAi
                          ? "w-full min-w-0 text-[13px] leading-6 text-slate-800"
                          : "max-w-[88%] min-w-0 rounded-2xl rounded-br-md bg-slate-100 px-4 py-3 text-[13px] leading-6 text-slate-800"}>
                          {isAi && message.insight ? (
                            <div className="space-y-5">
                              <p className="text-xs font-medium text-slate-500">Análise</p>
                              <div>
                                <p className="text-xs font-medium text-slate-500">Diagnóstico</p>
                                <p className="mt-1.5 whitespace-pre-wrap text-sm font-medium leading-6 text-slate-900">{message.insight.diagnosis}</p>
                              </div>
                              <div>
                                <p className="text-xs font-medium text-slate-500">Impacto</p>
                                <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-6 text-slate-700">{message.insight.impact}</p>
                              </div>
                              <div>
                                <p className="text-xs font-medium text-slate-500">Próximo passo</p>
                                <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-6 text-slate-900">{message.insight.recommendation}</p>
                              </div>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-4 border-y border-slate-100 py-4">
                                {message.insight.evidence.slice(0, 4).map((item) => (
                                  <div key={`${message.id}-${item.label}`} className="min-w-0">
                                    <p className="text-[11px] text-slate-500">{item.label}</p>
                                    <p className="mt-1 break-words text-sm font-semibold tabular-nums text-slate-900">{item.value}</p>
                                  </div>
                                ))}
                              </div>
                              {message.insight.provenance ? (
                                <div className="break-words text-[11px] leading-5 text-slate-500">
                                  <p>
                                    Fonte: <span className="font-semibold">{formatInsightSource(message.insight.provenance.source)}</span>
                                    {" · "}{message.insight.provenance.scope}
                                    {" · "}{message.insight.provenance.freshness === "live" ? "consulta ao vivo" : message.insight.provenance.freshness === "partial" ? "cobertura parcial" : "atualidade não confirmada"}
                                    {" · Consultado "}{new Date(message.insight.provenance.consultedAt).toLocaleString("pt-AO", { timeZone: "Africa/Luanda", timeZoneName: "short" })}
                                  </p>
                                  {message.insight.provenance.limitation ? <p className="mt-2 text-slate-600">Limitação: {message.insight.provenance.limitation}</p> : null}
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <>
                              {isAi && message.mode ? <p className="mb-2 text-xs font-medium text-slate-500">{message.mode === "action" ? "Preparando ação" : "Ajuda KLASSE"}</p> : null}
                              <p className="whitespace-pre-wrap">{message.text}</p>
                            </>
                          )}

                          {/* Rendering internal routes returned by the assistant */}
                          {isAi && (!message.actions || message.actions.length === 0) && message.links && message.links.length > 0 ? (
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
                                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-left text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                                >
                                  <span className="truncate">{link.label}</span>
                                  <ExternalLink className="h-3 w-3 shrink-0" />
                                </button>
                              ))}
                            </div>
                          ) : null}

                          {isAi && message.actions && message.actions.length > 0 ? (
                            <div className="mt-2.5 space-y-1.5">
                              {message.actions.map((action) => (
                                <button
                                  key={`${message.id}-action-${action.id}`}
                                  type="button"
                                  onClick={() => runAssistantAction(action, message.aiInsightId)}
                                  className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-xs font-medium transition-colors ${
                                    action.riskLevel === "high"
                                      ? "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                                      : action.riskLevel === "medium"
                                        ? "border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100"
                                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                  }`}
                                  title={action.description}
                                >
                                  <span className="min-w-0">
                                    <span className="block truncate">{action.label}</span>
                                    {action.requiresApproval ? (
                                      <span className="mt-0.5 block text-[11px] font-normal opacity-75">Requer revisão</span>
                                    ) : null}
                                  </span>
                                  <ExternalLink className="h-3 w-3 shrink-0" />
                                </button>
                              ))}
                            </div>
                          ) : null}

                          {isAi && message.copyable ? (
                            <div className="mt-4 flex flex-wrap gap-3 border-t border-slate-100 pt-3">
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(cleanGeneratedText(message.text));
                                  setCopiedId(message.id);
                                }}
                                className="rounded-md px-1 py-1 text-xs text-slate-500 transition-colors hover:text-slate-900"
                              >
                                {copiedId === message.id ? <Check className="inline h-3 w-3 mr-0.5" /> : <Copy className="inline h-3 w-3 mr-0.5" />} Copiar
                              </button>
                              <button type="button" onClick={() => sendFeedback(message, "useful")} className="rounded-md px-1 py-1 text-xs text-slate-500 transition-colors hover:text-slate-900">
                                <ThumbsUp className="inline h-3 w-3 mr-0.5" /> Útil
                              </button>
                              <button type="button" onClick={() => sendFeedback(message, "not_useful", "redo")} className="rounded-md px-1 py-1 text-xs text-slate-500 transition-colors hover:text-slate-900">
                                <ThumbsDown className="inline h-3 w-3 mr-0.5" /> Ruim
                              </button>
                              {feedbackId === message.id ? <span className="ml-1 self-center text-xs text-slate-500">Salvo</span> : null}
                            </div>
                          ) : null}
                          {message.quickReplies?.length ? (
                            <div className="mt-4 flex flex-wrap gap-2">
                              {message.quickReplies.map((reply) => (
                                <button
                                  key={`${message.id}-${reply.action}`}
                                  type="button"
                                  onClick={() => handleQuickAction(reply.action)}
                                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
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
                    <p className="text-xs text-slate-500" role="status" aria-live="polite">A consultar os dados da escola…</p>
                  ) : null}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              <form onSubmit={submitInput} className="shrink-0 border-t border-slate-100 bg-white px-4 pb-4 pt-3 sm:px-5">
                <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-white p-2 transition-colors focus-within:border-[#1F6B3B] focus-within:ring-1 focus-within:ring-[#1F6B3B]/10">
                  <textarea
                    aria-label="Mensagem para o KLASSE IA"
                    value={inputValue}
                    onChange={(event) => setInputValue(event.target.value)}
                    disabled={thinking}
                    rows={2}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        submitInput(e);
                      }
                    }}
                    className="max-h-32 min-h-10 min-w-0 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-5 text-slate-900 placeholder:text-slate-400 outline-none disabled:opacity-50"
                    placeholder={flow ? "Escreva para este fluxo…" : "Escreva a sua pergunta…"}
                  />
                  <button type="submit" aria-label="Enviar mensagem" disabled={thinking || !inputValue.trim()} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#1F6B3B] text-white transition-colors hover:bg-[#18572f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F6B3B] disabled:bg-slate-100 disabled:text-slate-400">
                    <Send className="h-4 w-4" />
                  </button>
                </div>
                {flow ? (
                  <button type="button" onClick={() => handleQuickAction("cancel_flow")} className="mt-3 text-xs text-slate-500 hover:text-slate-900">
                    Cancelar fluxo
                  </button>
                ) : (
                  <div className="mt-3 flex items-center justify-between gap-4 text-xs text-slate-500">
                    <button type="button" onClick={showContextCapabilities} className="text-left transition-colors hover:text-slate-900">
                      O que posso fazer aqui?
                    </button>
                    <button type="button" onClick={openHelp} className="flex shrink-0 items-center gap-1.5 transition-colors hover:text-slate-900">
                      <HelpCircle className="h-3.5 w-3.5" /> Ajuda
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
