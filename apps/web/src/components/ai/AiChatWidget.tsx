"use client";

import React, { useState, useRef, useEffect } from "react";
import { Sparkles, X, Send, Copy, FileText, ListCollapse, Check, Search, ArrowLeft, HelpCircle, ChevronRight, ClipboardList, WalletCards } from "lucide-react";
import { useRouter } from "next/navigation";
import { findHelpTopics, type HelpTopic } from "@/lib/klasse-help/help-topics";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

interface Message {
  sender: "user" | "ai";
  text: string;
  isActions?: boolean;
  copyable?: boolean;
}

function getInitialMessages(): Message[] {
  return [
    {
      sender: "ai",
      text: "Olá! Sou o Assistente Klasse AI. Posso ajudar-te com tarefas rápidas de produtividade. Seleciona uma das opções abaixo:",
    },
    {
      sender: "ai",
      text: "",
      isActions: true,
    },
  ];
}

function parseStoredMessages(value: string | null): Message[] | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return null;

    const messages = parsed.filter((item): item is Message => {
      if (!item || typeof item !== "object") return false;
      const record = item as Partial<Message>;
      return (
        (record.sender === "user" || record.sender === "ai") &&
        typeof record.text === "string"
      );
    });

    return messages.length > 0 ? messages : null;
  } catch {
    return null;
  }
}

interface AiChatWidgetProps {
  schoolId: string;
  schoolParam?: string;
  hasMobileNav?: boolean;
  context?: AiWidgetContext;
}

export type AiWidgetContext = {
  module: "dashboard" | "financeiro" | "secretaria" | "academico" | "comunicacao" | "classe_ai";
  page?: string;
  entityType?: string;
  entityId?: string;
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
  const [generating, setGenerating] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Tenant permissions & allowed features states
  const [isAllowed, setIsAllowed] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [userRole, setUserRole] = useState("");
  const [resolvedSchoolId, setResolvedSchoolId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [hydratedMessagesKey, setHydratedMessagesKey] = useState<string | null>(null);

  // Help center states
  const [helpSearchQuery, setHelpSearchQuery] = useState("");
  const [helpResults, setHelpResults] = useState<HelpTopic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<HelpTopic | null>(null);
  
  // Keep track of the active dialog state (e.g. "waiting_for_rewrite_text", "help_menu", "help_search", "help_topic_selected")
  const [dialogState, setDialogState] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Dragging states and refs
  const [position, setPosition] = useState<{ right: number; bottom: number }>({ right: 24, bottom: 24 });
  const [isDraggingState, setIsDraggingState] = useState(false);
  const isDragging = useRef(false);
  const dragHasMoved = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, right: 0, bottom: 0 });
  const positionRef = useRef(position);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  // Load position on client-side mount
  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    const defaultBottom = (hasMobileNav && isMobile) ? 80 : 24;
    const defaultRight = isMobile ? 16 : 24;

    const saved = localStorage.getItem(`klasse_ai_widget_position_${schoolId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (typeof parsed.right === "number" && typeof parsed.bottom === "number") {
          const maxRight = window.innerWidth - 44 - 16;
          const maxBottom = window.innerHeight - 44 - 16;
          const minBottom = (hasMobileNav && isMobile) ? 80 : 16;

          setPosition({
            right: Math.max(16, Math.min(parsed.right, maxRight)),
            bottom: Math.max(minBottom, Math.min(parsed.bottom, maxBottom))
          });
          return;
        }
      } catch (e) {
        console.error("Error parsing saved widget position:", e);
      }
    }

    setPosition({ right: defaultRight, bottom: defaultBottom });
  }, [schoolId, hasMobileNav]);

  // Clamp position when card is opened to make sure the open card fits inside viewport
  useEffect(() => {
    if (!isOpen) return;

    const isMobile = window.innerWidth < 768;
    const minBottom = (hasMobileNav && isMobile) ? 80 : 16;
    const widgetWidth = isMobile ? window.innerWidth - 32 : 340;
    const widgetHeight = 460; // card height

    const maxRight = window.innerWidth - widgetWidth - 16;
    const maxBottom = window.innerHeight - widgetHeight - 16;

    setPosition((prev) => ({
      right: Math.max(16, Math.min(prev.right, maxRight)),
      bottom: Math.max(minBottom, Math.min(prev.bottom, maxBottom))
    }));
  }, [isOpen, hasMobileNav]);

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    // Avoid dragging when clicking buttons, links or input areas
    if ((e.target as HTMLElement).closest("button") || (e.target as HTMLElement).closest("input") || (e.target as HTMLElement).closest("a")) {
      return;
    }
    if ("button" in e && e.button !== 0) return; // Only left mouse click

    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    dragStart.current = {
      x: clientX,
      y: clientY,
      right: positionRef.current.right,
      bottom: positionRef.current.bottom
    };

    isDragging.current = true;
    dragHasMoved.current = false;
    setIsDraggingState(true);
  };

  useEffect(() => {
    const handleDragMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging.current) return;

      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

      const dx = clientX - dragStart.current.x;
      const dy = clientY - dragStart.current.y;

      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        dragHasMoved.current = true;
      }

      const isMobile = window.innerWidth < 768;
      const minBottom = (hasMobileNav && isMobile) ? 80 : 16;

      const widgetWidth = isOpen ? (isMobile ? window.innerWidth - 32 : 340) : 44;
      const widgetHeight = isOpen ? 460 : 44;

      const maxRight = window.innerWidth - widgetWidth - 16;
      const maxBottom = window.innerHeight - widgetHeight - 16;

      const nextRight = dragStart.current.right - dx;
      const nextBottom = dragStart.current.bottom - dy;

      setPosition({
        right: Math.max(16, Math.min(nextRight, maxRight)),
        bottom: Math.max(minBottom, Math.min(nextBottom, maxBottom))
      });
    };

    const handleDragEnd = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      setIsDraggingState(false);

      localStorage.setItem(
        `klasse_ai_widget_position_${schoolId}`,
        JSON.stringify(positionRef.current)
      );
    };

    if (isDraggingState) {
      window.addEventListener("mousemove", handleDragMove, { passive: true });
      window.addEventListener("mouseup", handleDragEnd);
      window.addEventListener("touchmove", handleDragMove, { passive: true });
      window.addEventListener("touchend", handleDragEnd);
    }

    return () => {
      window.removeEventListener("mousemove", handleDragMove);
      window.removeEventListener("mouseup", handleDragEnd);
      window.removeEventListener("touchmove", handleDragMove);
      window.removeEventListener("touchend", handleDragEnd);
    };
  }, [isDraggingState, isOpen, schoolId, hasMobileNav]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Client-side access checks aligning with the backend guards
  useEffect(() => {
    let active = true;
    async function checkAccess() {
      try {
        const res = await fetch(`/api/admin/ai/access?schoolId=${encodeURIComponent(schoolId)}`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);
        if (!active) return;

        if (!res.ok || !json?.ok) {
          setUserId(null);
          setResolvedSchoolId(null);
          setIsAllowed(false);
          setCheckingAccess(false);
          return;
        }

        const data = json.data ?? {};
        const role = String(data.role ?? "").toLowerCase();
        setResolvedSchoolId(typeof data.schoolId === "string" ? data.schoolId : null);
        setUserId(typeof data.userId === "string" ? data.userId : null);
        setIsAllowed(Boolean(data.allowed));
        setUserRole(role);
        setCheckingAccess(false);
      } catch (err) {
        console.error("Error verifying AI access:", err);
        if (active) {
          setIsAllowed(false);
          setCheckingAccess(false);
        }
      }
    }

    checkAccess();
    return () => {
      active = false;
    };
  }, [schoolId]);

  useEffect(() => {
    if (!userId || !resolvedSchoolId) return;

    const key = `klasse_ai_widget_messages_${resolvedSchoolId}_${userId}`;
    const stored = parseStoredMessages(localStorage.getItem(key));
    setMessages(stored ?? getInitialMessages());
    setHydratedMessagesKey(key);
  }, [resolvedSchoolId, userId]);

  useEffect(() => {
    if (!userId || !resolvedSchoolId) return;

    const key = `klasse_ai_widget_messages_${resolvedSchoolId}_${userId}`;
    if (hydratedMessagesKey !== key) return;

    const compactMessages = messages.slice(-80);
    localStorage.setItem(key, JSON.stringify(compactMessages));
  }, [messages, hydratedMessagesKey, resolvedSchoolId, userId]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;

    const userMsg = text.trim();
    setMessages((prev) => [...prev, { sender: "user", text: userMsg }]);
    setInputValue("");
    setGenerating(true);

    try {
      if (dialogState === "waiting_for_rewrite_text") {
        const effectiveSchoolId = resolvedSchoolId ?? schoolId;
        const res = await fetch("/api/admin/ai/rewrite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: userMsg,
            mode: "more_formal",
            schoolId: effectiveSchoolId,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error || "Erro ao reescrever texto.");
        }

        setMessages((prev) => [
          ...prev,
          {
            sender: "ai",
            text: `Aqui está a versão melhorada e formalizada do teu texto:\n\n${data.text}`,
            copyable: true,
          },
        ]);
        setDialogState(null);
      }
    } catch (err: unknown) {
      setMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: `Erro ao executar a solicitação: ${getErrorMessage(err, "Erro desconhecido.")}`,
        },
      ]);
    } finally {
      setGenerating(false);
      setMessages((prev) => [...prev, { sender: "ai", text: "", isActions: true }]);
    }
  };

  const handleAction = async (action: string) => {
    if (generating) return;

    if (action === "rewrite") {
      setMessages((prev) => [
        ...prev,
        { sender: "ai", text: "Excelente! Escreve ou cola abaixo o texto administrativo que desejas polir:" },
      ]);
      setDialogState("waiting_for_rewrite_text");
    } else if (action === "summary") {
      const effectiveSchoolId = resolvedSchoolId ?? schoolId;
      setGenerating(true);
      setMessages((prev) => [
        ...prev,
        { sender: "user", text: "Gerar resumo operacional rápido da escola" },
      ]);

      try {
        const res = await fetch("/api/admin/ai/summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            period: "today",
            schoolId: effectiveSchoolId,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error || "Erro ao gerar resumo da escola.");
        }

        setMessages((prev) => [
          ...prev,
          {
            sender: "ai",
            text: `Aqui está o resumo analítico dos indicadores reais da escola de hoje:\n\n${data.content}`,
            copyable: true,
          },
        ]);
      } catch (err: unknown) {
        setMessages((prev) => [
          ...prev,
          {
            sender: "ai",
            text: `Erro ao obter resumo: ${getErrorMessage(err, "Erro desconhecido.")}`,
          },
        ]);
      } finally {
        setGenerating(false);
        setMessages((prev) => [...prev, { sender: "ai", text: "", isActions: true }]);
      }
    } else if (action === "finance_plan") {
      const effectiveSchoolId = resolvedSchoolId ?? schoolId;
      setGenerating(true);
      setMessages((prev) => [
        ...prev,
        { sender: "user", text: "Preparar plano de cobrança da semana" },
      ]);

      try {
        const res = await fetch("/api/admin/ai/finance-message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            schoolId: effectiveSchoolId,
            title: "Plano de cobrança da semana",
            scenario: "Preparar um rascunho de orientação financeira para cobrança semanal. Usar placeholders para encarregado, valor, aluno e data.",
            recipientLabel: "[Encarregado]",
            amountLabel: "[Valor em aberto]",
            dueDateLabel: "[Data de vencimento]",
            context: { page: context?.page ?? "financeiro" },
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error || "Erro ao preparar plano de cobrança.");
        }

        setMessages((prev) => [
          ...prev,
          {
            sender: "ai",
            text: `Rascunho criado para revisão na Central de Ações IA:\n\n${data.content}`,
            copyable: true,
          },
        ]);
      } catch (err: unknown) {
        setMessages((prev) => [
          ...prev,
          {
            sender: "ai",
            text: `Erro ao preparar cobrança: ${getErrorMessage(err, "Erro desconhecido.")}`,
          },
        ]);
      } finally {
        setGenerating(false);
        setMessages((prev) => [...prev, { sender: "ai", text: "", isActions: true }]);
      }
    } else if (action === "open_actions") {
      router.push(`/escola/${routeSchoolParam}/admin/ai/actions`);
      setIsOpen(false);
    } else if (action === "billing_redirect") {
      setMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: "Para gerar lembretes de cobrança assistidos por IA, clique no botão “Cobrança IA” na ficha do aluno ou acesse o painel KLASSE AI.",
        },
        { sender: "ai", text: "", isActions: true },
      ]);
    } else if (action === "help_menu") {
      setDialogState("help_menu");
      setHelpSearchQuery("");
      setSelectedTopic(null);
      setHelpResults(findHelpTopics("", userRole));
    }
  };

  const handleHelpSearch = (query: string) => {
    setHelpSearchQuery(query);
    const results = findHelpTopics(query, userRole);
    setHelpResults(results);
    if (query.trim() === "") {
      setDialogState("help_menu");
    } else {
      setDialogState("help_search");
    }
  };

  const handleSelectTopic = (topic: HelpTopic) => {
    setSelectedTopic(topic);
    setDialogState("help_topic_selected");
  };

  const handleNavigateToTopic = (topic: HelpTopic) => {
    if (topic.href) {
      router.push(topic.href(routeSchoolParam));
      setIsOpen(false);
    }
  };

  const handleCopy = (text: string, index: number) => {
    const cleanText = text
      .replace(/^Aqui está a versão melhorada e formalizada do teu texto:\n\n/i, "")
      .replace(/^Aqui está o resumo analítico dos indicadores reais da escola de hoje:\n\n/i, "")
      .replace(/^Rascunho criado para revisão na Central de Ações IA:\n\n/i, "");
    navigator.clipboard.writeText(cleanText);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  if (checkingAccess || !isAllowed) return null;

  // Filtered topics based on search state
  const activeHelpTopics = helpSearchQuery ? helpResults : findHelpTopics("", userRole);

  const isMobileSize = typeof window !== "undefined" && window.innerWidth < 768;
  const cardRight = isMobileSize ? 16 : position.right;
  const cardWidthClass = isMobileSize ? "w-[calc(100vw-2rem)]" : "w-[340px]";

  return (
    <>
      {/* Floating Sparkle Button */}
      <button
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
        onClick={(e) => {
          if (dragHasMoved.current) {
            e.preventDefault();
            return;
          }
          setIsOpen(!isOpen);
        }}
        style={{
          right: `${position.right}px`,
          bottom: `${position.bottom}px`,
        }}
        className={`fixed z-50 w-11 h-11 bg-white/90 backdrop-blur-md border border-slate-200 text-slate-700 rounded-full flex items-center justify-center shadow-md hover:shadow-lg hover:text-indigo-600 hover:scale-105 active:scale-95 cursor-grab active:cursor-grabbing ${
          isDraggingState ? "" : "transition-all duration-300"
        }`}
      >
        {isOpen ? <X className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
      </button>

      {/* Popover Chat Interface */}
      {isOpen && (
        <div
          style={{
            right: `${cardRight}px`,
            bottom: `${position.bottom}px`,
          }}
          className={`fixed max-h-[70vh] h-[460px] ${cardWidthClass} bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 shadow-xl z-50 flex flex-col overflow-hidden ${
            isDraggingState ? "" : "transition-all duration-300"
          }`}
        >
          {/* Header */}
          <div
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
            className="bg-white border-b border-slate-100 p-3 flex items-center justify-between cursor-grab active:cursor-grabbing select-none"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <div>
                <h3 className="text-xs font-bold text-slate-800">Klasse AI</h3>
                <p className="text-[9px] text-slate-400">Assistente de Produtividade</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Conditional rendering for Help Center or AI Chat */}
          {dialogState && dialogState.startsWith("help_") ? (
            dialogState === "help_topic_selected" && selectedTopic ? (
              /* ─── Selected Topic Detail View ─── */
              <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  <div className="space-y-1">
                    <span className="text-[9px] font-extrabold uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100/50">
                      {selectedTopic.category}
                    </span>
                    <h4 className="text-sm font-black text-slate-900 pt-1">{selectedTopic.title}</h4>
                  </div>

                  <div className="text-xs text-slate-700 bg-white p-3.5 rounded-xl border border-slate-200/50 shadow-sm leading-relaxed">
                    {selectedTopic.answer}
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Passo a Passo</p>
                    <div className="space-y-2">
                      {selectedTopic.steps.map((step, idx) => (
                        <div key={idx} className="flex gap-2.5 bg-white border border-slate-200/50 p-3 rounded-xl shadow-sm">
                          <span className="flex items-center justify-center w-5 h-5 bg-violet-50 text-violet-700 font-bold text-xs rounded-lg shrink-0">
                            {idx + 1}
                          </span>
                          <p className="text-xs text-slate-600 leading-relaxed pt-0.5">{step}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Navigation & Back Action Bar */}
                <div className="p-3 border-t border-slate-200 bg-white flex flex-col gap-2">
                  {selectedTopic.href && (
                    <button
                      onClick={() => handleNavigateToTopic(selectedTopic)}
                      className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-colors"
                    >
                      <span>Abrir tela</span>
                    </button>
                  )}
                  <button
                    onClick={() => setDialogState("help_menu")}
                    className="w-full py-2 text-xs font-bold text-slate-600 hover:text-slate-800 border border-slate-200 hover:border-slate-300 bg-white rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Voltar à Pesquisa
                  </button>
                </div>
              </div>
            ) : (
              /* ─── Help Menu / Search Results List ─── */
              <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
                {/* Search Bar */}
                <div className="p-3 border-b border-slate-200 bg-white flex items-center gap-2">
                  <Search className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={helpSearchQuery}
                    onChange={(e) => handleHelpSearch(e.target.value)}
                    placeholder="Procure por aluno, pagamento, turma, comunicado..."
                    className="w-full text-xs text-slate-900 bg-transparent outline-none"
                    autoFocus
                  />
                  {helpSearchQuery && (
                    <button
                      onClick={() => handleHelpSearch("")}
                      className="text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Topics List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {helpSearchQuery ? "Resultados da Pesquisa" : "Tópicos Populares"}
                  </p>

                  {activeHelpTopics.length === 0 ? (
                    <div className="text-xs text-slate-500 bg-white border border-slate-200 rounded-xl p-4 leading-relaxed">
                      Ainda não tenho esse caminho documentado. Tente procurar por <strong>aluno</strong>, <strong>pagamento</strong>, <strong>turma</strong>, <strong>comunicado</strong> ou <strong>financeiro</strong>.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {activeHelpTopics.map((topic) => (
                        <button
                          key={topic.key}
                          onClick={() => handleSelectTopic(topic)}
                          className="w-full text-left p-3 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl transition-all duration-200 flex items-center justify-between cursor-pointer"
                        >
                          <div className="space-y-0.5">
                            <p className="text-xs font-bold text-slate-800">{topic.title}</p>
                            <p className="text-[9px] font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded w-fit uppercase">
                              {topic.category}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Back Button */}
                <div className="p-3 border-t border-slate-200 bg-white">
                  <button
                    onClick={() => {
                      setDialogState(null);
                      setHelpSearchQuery("");
                    }}
                    className="w-full py-2 text-xs font-bold text-slate-600 hover:text-slate-800 border border-slate-200 hover:border-slate-300 bg-white rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Voltar ao Menu Principal
                  </button>
                </div>
              </div>
            )
          ) : (
            /* ─── Standard Productivity Widget View ─── */
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                {messages.map((msg, index) => {
                  if (msg.isActions) {
                    if (dialogState !== null) return null;

                    return (
                      <div key={index} className="flex flex-col gap-2 pt-2">
                        {context?.module === "financeiro" && (
                          <>
                            <button
                              onClick={() => handleAction("finance_plan")}
                              disabled={generating}
                              className="w-full text-left p-3 text-xs bg-amber-50 hover:bg-amber-100 border border-amber-100 text-amber-800 rounded-xl font-bold flex items-center gap-2 cursor-pointer transition-all duration-200 shadow-sm"
                            >
                              <WalletCards className="w-3.5 h-3.5 text-amber-600" />
                              <span>Preparar plano de cobrança</span>
                            </button>
                            <button
                              onClick={() => handleAction("summary")}
                              disabled={generating}
                              className="w-full text-left p-3 text-xs bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 text-indigo-800 rounded-xl font-bold flex items-center gap-2 cursor-pointer transition-all duration-200 shadow-sm"
                            >
                              <ListCollapse className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Resumir risco financeiro</span>
                            </button>
                          </>
                        )}

                        {context?.module === "secretaria" && (
                          <>
                            <button
                              onClick={() => handleAction("summary")}
                              disabled={generating}
                              className="w-full text-left p-3 text-xs bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 text-indigo-800 rounded-xl font-bold flex items-center gap-2 cursor-pointer transition-all duration-200 shadow-sm"
                            >
                              <ListCollapse className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Resumir pendências da secretaria</span>
                            </button>
                            <button
                              onClick={() => handleAction("help_menu")}
                              disabled={generating}
                              className="w-full text-left p-3 text-xs bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 text-emerald-800 rounded-xl font-bold flex items-center gap-2 cursor-pointer transition-all duration-200 shadow-sm"
                            >
                              <HelpCircle className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Abrir documentos e ficha</span>
                            </button>
                          </>
                        )}

                        <button
                          onClick={() => handleAction("rewrite")}
                          disabled={generating}
                          className="w-full text-left p-3 text-xs bg-violet-50 hover:bg-violet-100 border border-violet-100 text-violet-800 rounded-xl font-bold flex items-center gap-2 cursor-pointer transition-all duration-200 shadow-sm"
                        >
                          <FileText className="w-3.5 h-3.5 text-violet-600" />
                          <span>✨ Polir ou melhorar aviso</span>
                        </button>

                        <button
                          onClick={() => handleAction("summary")}
                          disabled={generating}
                          className="w-full text-left p-3 text-xs bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 text-indigo-800 rounded-xl font-bold flex items-center gap-2 cursor-pointer transition-all duration-200 shadow-sm"
                        >
                          <ListCollapse className="w-3.5 h-3.5 text-indigo-600" />
                          <span>📊 Resumir indicadores de hoje</span>
                        </button>

                        <button
                          onClick={() => handleAction("open_actions")}
                          disabled={generating}
                          className="w-full text-left p-3 text-xs bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 rounded-xl font-bold flex items-center gap-2 cursor-pointer transition-all duration-200 shadow-sm"
                        >
                          <ClipboardList className="w-3.5 h-3.5 text-slate-600" />
                          <span>Abrir Central de Ações IA</span>
                        </button>

                        <button
                          onClick={() => handleAction("billing_redirect")}
                          disabled={generating}
                          className="w-full text-left p-3 text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl font-bold flex items-center gap-2 cursor-pointer transition-all duration-200 shadow-sm"
                        >
                          <span>💬 Lembrete de Cobrança</span>
                        </button>

                        {/* Help center trigger */}
                        <button
                          onClick={() => handleAction("help_menu")}
                          disabled={generating}
                          className="w-full text-left p-3 text-xs bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 text-emerald-800 rounded-xl font-bold flex items-center gap-2 cursor-pointer transition-all duration-200 shadow-sm"
                        >
                          <HelpCircle className="w-3.5 h-3.5 text-emerald-600" />
                          <span>❔ Ajuda do KLASSE</span>
                        </button>
                      </div>
                    );
                  }

                  const isAi = msg.sender === "ai";
                  return (
                    <div key={index} className={`flex ${isAi ? "justify-start" : "justify-end"}`}>
                      <div
                        className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed whitespace-pre-wrap relative group ${
                          isAi
                            ? "bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200/50"
                            : "bg-slate-800 text-white rounded-tr-none shadow-sm"
                        }`}
                      >
                        <div>{msg.text}</div>
                        
                        {/* Copy action on hover for AI responses */}
                        {isAi && msg.copyable && (
                          <button
                            onClick={() => handleCopy(msg.text, index)}
                            className="absolute top-2 right-2 p-1 bg-white hover:bg-slate-50 border border-slate-200 rounded text-slate-500 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer"
                            title="Copiar texto"
                          >
                            {copiedIndex === index ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Generating typing state */}
                {generating && (
                  <div className="flex justify-start">
                    <div className="bg-slate-100 border border-slate-200/50 text-slate-500 rounded-2xl rounded-tl-none p-3 text-xs flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Form and Cancel Actions shown strictly when dialogState expects user text input */}
              {dialogState === "waiting_for_rewrite_text" && (
                <div className="border-t border-slate-100 p-3 bg-slate-50 flex flex-col gap-2">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSendMessage(inputValue);
                    }}
                    className="flex gap-2 items-center"
                  >
                    <input
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      disabled={generating}
                      placeholder="Cole ou escreve o texto administrativo..."
                      className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-slate-400 transition-colors"
                    />
                    <button
                      type="submit"
                      disabled={generating || !inputValue.trim()}
                      className="p-2 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-200 text-white rounded-xl transition-all cursor-pointer flex items-center justify-center"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>
                  <button
                    type="button"
                    onClick={() => {
                      setDialogState(null);
                      setInputValue("");
                      setMessages((prev) => [
                        ...prev,
                        { sender: "ai", text: "Operação cancelada. Seleciona outra opção:" },
                        { sender: "ai", text: "", isActions: true },
                      ]);
                    }}
                    disabled={generating}
                    className="w-full text-center py-1.5 text-[10px] text-slate-500 hover:text-slate-700 border border-dashed border-slate-200 hover:border-slate-300 rounded-lg transition-all cursor-pointer font-medium"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
