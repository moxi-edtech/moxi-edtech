import { getRoutesForRole, KLASSE_ROUTES, KlasseRoute } from "./route-registry";
import { getActionsForRole, ASSISTANT_ACTIONS, AssistantAction } from "./action-registry";
import { hasAssistantPermission } from "./permission-registry";
import { searchKnowledge } from "./knowledge-search";
import { AiWidgetContext, describeScreenContext, sanitizeContextForAi } from "./screen-context";
import { createAssistantActionV2, instantiateAssistantActionV2, type AssistantActionV2 } from "./actions-v2";
import { answerFinanceDebtByClass } from "./data-copilot/finance-debt-by-class";
import { updateAiUsageLog } from "@/lib/server/ai/ai-guards";

export type AssistantResponse = {
  ok: boolean;
  mode: "fast_path" | "rag" | "data_query" | "action" | "fallback";
  answer: string;
  suggestions?: AssistantAction[];
  actions?: AssistantActionV2[];
  links?: Array<{ label: string; href: string }>;
  requiresApproval?: boolean;
};

// Simple intent keyword matching patterns for Fast Path
export const FAST_PATH_PATTERNS = [
  {
    keywords: ["cadastrar aluno", "cadastro aluno", "matricular aluno", "novo aluno", "onde cadastro", "criar aluno", "adicionar aluno"],
    routeKey: "aluno_novo",
    answer: "Para cadastrar um novo aluno, vá para **Secretaria > Alunos > Novo Aluno** no menu lateral.",
  },
  {
    keywords: ["inadimplentes", "atraso", "radar", "devedores", "propinas em atraso", "como vejo inadimplentes", "cobrança"],
    routeKey: "radar_financeiro",
    answer: "Para identificar alunos inadimplentes e analisar cobranças pendentes, consulte o **Radar Financeiro** em **Financeiro > Radar**.",
  },
  {
    keywords: ["abrir whatsapp", "central whatsapp", "waha", "conectar whatsapp", "mensagem whatsapp", "inbox whatsapp"],
    routeKey: "central_whatsapp",
    answer: "Aceda à **Central WhatsApp** em **Comunicação > Central WhatsApp** para gerenciar contatos, ver o status da API e enviar mensagens.",
  },
  {
    keywords: ["declaracao", "boletim", "emitir documento", "certidao", "onde emito declaracao", "documentos oficiais"],
    routeKey: "documentos",
    answer: "A emissão de declarações de frequência, certidões e boletins de notas é feita na **Secretaria > Documentos**.",
  },
  {
    keywords: ["notas", "pautas", "lancar notas", "cadastrar notas", "boletins"],
    routeKey: "notas",
    answer: "Para lançar ou visualizar notas e pautas escolares, vá para **Administração > Notas**.",
  },
  {
    keywords: ["presenca", "chamada", "frequencia", "faltas", "registrar presenca"],
    routeKey: "presencas",
    answer: "O registro de presenças e o controle de faltas dos alunos é realizado em **Secretaria > Calendário**.",
  },
  {
    keywords: ["acesso aluno", "liberar acesso", "credenciais aluno", "senha aluno", "portal aluno"],
    routeKey: "acesso_alunos",
    answer: "Para gerenciar as credenciais e liberar o acesso do Portal do Aluno para os estudantes, aceda a **Secretaria > Acesso**.",
  },
];

export function isFastPathQuery(query: string, context?: AiWidgetContext): boolean {
  const cleanQuery = query.trim().toLowerCase();
  if (cleanQuery.includes("o que posso fazer nesta tela") || cleanQuery.includes("acoes desta tela")) {
    return true;
  }
  for (const pattern of FAST_PATH_PATTERNS) {
    if (pattern.keywords.some((kw) => cleanQuery.includes(kw))) {
      return true;
    }
  }
  return false;
}

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
  };
  error?: {
    message?: string;
  };
};

async function callGeminiForRAG(prompt: string) {
  const provider = (process.env.AI_PROVIDER ?? "").trim().toLowerCase();
  const apiKey = (process.env.AI_API_KEY ?? "").trim();
  const model = (process.env.AI_MODEL_TEXT ?? "gemini-2.0-flash").trim();
  const maxTokens = Number.parseInt(process.env.AI_MAX_TOKENS ?? "2048", 10);
  const timeoutMs = Number.parseInt(process.env.AI_TIMEOUT_MS ?? "15000", 10);

  if (provider !== "gemini" || !apiKey) {
    throw new Error("Provedor Gemini não configurado ou chave de API ausente.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) ? timeoutMs : 15000);

  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.15,
            maxOutputTokens: maxTokens,
          },
        }),
      }
    );
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Tempo limite excedido ao consultar o provedor de IA.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errText = await response.text();
    if (response.status === 429) {
      throw new Error("COTA_EXCEDIDA");
    }
    throw new Error(`Erro na API do Gemini: ${response.status} - ${errText}`);
  }

  const data = (await response.json()) as GeminiResponse;
  const text = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim() ?? "";

  return {
    text,
    provider,
    model,
    tokensInput: data.usageMetadata?.promptTokenCount ?? null,
    tokensOutput: data.usageMetadata?.candidatesTokenCount ?? null,
  };
}

function routeAction(params: {
  id: string;
  label: string;
  href: string;
  permission?: string;
  description?: string;
}): AssistantActionV2 {
  return createAssistantActionV2({
    id: params.id,
    kind: params.href.startsWith("/api/") ? "export" : "open_screen",
    label: params.label,
    description: params.description,
    href: params.href,
    riskLevel: params.href.startsWith("/api/") ? "medium" : "low",
    requiresApproval: false,
    permission: params.permission ?? "assistant.help",
  });
}

function assistantSuggestionToAction(action: AssistantAction, schoolId: string, role: string): AssistantActionV2 | null {
  if (action.href) {
    return routeAction({
      id: `route:${action.key}`,
      label: action.title,
      href: action.href(schoolId),
      permission: "assistant.help",
      description: action.description,
    });
  }

  return instantiateAssistantActionV2(`assistant:${action.key}`, role, {}, {
    label: action.title,
    description: action.description,
  });
}

function actionsFromSuggestions(suggestions: AssistantAction[] | undefined, schoolId: string, role: string) {
  return (suggestions ?? [])
    .map((suggestion) => assistantSuggestionToAction(suggestion, schoolId, role))
    .filter((action): action is AssistantActionV2 => Boolean(action));
}

export async function processKlasseBrainQuery(params: {
  schoolId: string;
  role: string;
  query: string;
  context?: AiWidgetContext;
  allowedFeatures?: string[];
  usageLogId?: string;
}): Promise<AssistantResponse> {
  const { schoolId, role, query, context, usageLogId } = params;
  const cleanQuery = query.trim().toLowerCase();

  // 1. Permission check: Check if user is allowed to view/use the assistant
  if (!hasAssistantPermission(role, "assistant.view")) {
    return {
      ok: false,
      mode: "fallback",
      answer: "Desculpe, o seu perfil não tem permissão para usar o assistente KLASSE.",
    };
  }

  const debtByClassAnswer = await answerFinanceDebtByClass({ schoolId, role, query, context });
  if (debtByClassAnswer) {
    return debtByClassAnswer;
  }

  // 2. Fast Path: Check if user wants to see what they can do on this screen
  if (cleanQuery.includes("o que posso fazer nesta tela") || cleanQuery.includes("acoes desta tela")) {
    const allowedActions = getActionsForRole(role, context?.module);
    const textContext = describeScreenContext(context);

    let answerText = `Você está em: **${textContext}**. Aqui estão as ações oficiais recomendadas para o seu perfil:\n\n`;

    if (allowedActions.length > 0) {
      allowedActions.forEach((act, idx) => {
        answerText += `${idx + 1}. **${act.title}**: ${act.description} (Risco: \`${act.riskLevel}\`)\n`;
      });
    } else {
      answerText += "Nenhuma ação contextual específica cadastrada para o seu perfil nesta tela.";
    }

    const matchedRoutes = KLASSE_ROUTES.filter((r) => r.module === context?.module && r.roles.includes(role.toLowerCase()));
    const links = matchedRoutes.map((r) => ({
      label: r.title,
      href: r.href(schoolId),
    }));
    const linkActions = matchedRoutes.map((r) => routeAction({
      id: `route:${r.key}`,
      label: r.title,
      href: r.href(schoolId),
      description: r.description,
    }));
    const suggestionActions = actionsFromSuggestions(allowedActions.slice(0, 4), schoolId, role);

    return {
      ok: true,
      mode: "fast_path",
      answer: answerText,
      suggestions: allowedActions,
      actions: [...suggestionActions, ...linkActions].slice(0, 6),
      links: links.length > 0 ? links : undefined,
    };
  }

  // 3. Fast Path: General search patterns matching static routes
  for (const pattern of FAST_PATH_PATTERNS) {
    if (pattern.keywords.some((kw) => cleanQuery.includes(kw))) {
      const route = KLASSE_ROUTES.find((r) => r.key === pattern.routeKey);
      if (route && route.roles.includes(role.toLowerCase())) {
        const action = ASSISTANT_ACTIONS.find((act) => act.href && act.module === route.module);
        return {
          ok: true,
          mode: "fast_path",
          answer: pattern.answer,
          actions: [
            routeAction({
              id: `route:${route.key}`,
              label: route.title,
              href: route.href(schoolId),
              description: route.description,
            }),
          ],
          links: [
            {
              label: route.title,
              href: route.href(schoolId),
            },
          ],
          suggestions: action ? [action] : undefined,
        };
      }
    }
  }

  // 4. Smart Path (RAG/Knowledge Base Search)
  console.log("[KLASSE Brain] Buscando conhecimento na base para consulta contextual.");
  const relevantChunks = searchKnowledge(query, { module: context?.module, limit: 3 });

  if (relevantChunks.length === 0) {
    const suggestions = getActionsForRole(role, "any").filter((a) => a.actionType === "help");
    return {
      ok: true,
      mode: "fallback",
      answer: "Não encontrei essa informação documentada no KLASSE ainda. Posso ajudar sugerindo tópicos de ajuda relacionados ou você pode aceder à Central de Ajuda.",
      suggestions,
      actions: actionsFromSuggestions(suggestions, schoolId, role),
    };
  }

  // Generate context strings from chunks
  const contextString = relevantChunks
    .map((chunk, idx) => `[Documento ${idx + 1} - ${chunk.metadata?.title || chunk.module}]:\n${chunk.content}`)
    .join("\n\n");

  const sanitizedContext = sanitizeContextForAi(context);
  const textContext = describeScreenContext(context);

  const prompt = [
    "És o KLASSE Brain, o assistente inteligente especialista do sistema de gestão escolar KLASSE em Angola.",
    "Respondes a dúvidas de usuários administrativos (diretoria, secretaria, financeiro) com precisão baseando-te APENAS nos documentos oficiais fornecidos.",
    "Regras Cruciais:",
    "1. NUNCA inventes telas, rotas, permissões ou ações do KLASSE.",
    "2. Se a informação não estiver na base de conhecimento fornecida, responde EXATAMENTE: 'Não encontrei essa informação documentada no KLASSE ainda.'",
    "3. NUNCA ofereças para fazer ações administrativas, editar cadastros, lançar pagamentos ou alterar notas de alunos diretamente. O assistente apenas explica o sistema ou gera rascunhos para posterior aprovação.",
    "4. Sê conciso, direto e profissional.",
    "",
    "Contexto do Ecrã/Tela Atual do Usuário:",
    `- Localização: ${textContext}`,
    `- Papel do Usuário: ${role}`,
    `- Dados do Contexto: ${JSON.stringify(sanitizedContext)}`,
    "",
    "Base de Conhecimento Oficial Recuperada:",
    contextString,
    "",
    `Pergunta do Usuário: "${query}"`,
    "",
    "Resposta do KLASSE Brain:",
  ].join("\n");

  // Call Gemini and handle logging with graceful fallback on quota limits
  let geminiResult;
  try {
    geminiResult = await callGeminiForRAG(prompt);
  } catch (err) {
    if (err instanceof Error && err.message === "COTA_EXCEDIDA") {
      const suggestions = getActionsForRole(role, context?.module).slice(0, 2);
      return {
        ok: true,
        mode: "fallback",
        answer: "O limite de requisições do assistente foi temporariamente excedido. Por favor, tente novamente dentro de um minuto. Enquanto isso, posso sugerir atalhos rápidos para as ações desta tela:",
        suggestions: suggestions.length > 0 ? suggestions : undefined,
        actions: actionsFromSuggestions(suggestions, schoolId, role),
      };
    }
    throw err;
  }
  const answer = geminiResult.text;

  if (usageLogId) {
    await updateAiUsageLog(usageLogId, {
      status: "completed",
      inputPreview: query,
      outputPreview: answer,
      tokensInput: geminiResult.tokensInput,
      tokensOutput: geminiResult.tokensOutput,
      provider: geminiResult.provider,
      model: geminiResult.model,
    });
  }

  // Identify if answer was fallback
  if (answer.toLowerCase().includes("nao encontrei essa informacao") || answer.trim() === "") {
    const suggestions = getActionsForRole(role, context?.module).filter((a) => a.actionType === "help").slice(0, 2);
    return {
      ok: true,
      mode: "fallback",
      answer: "Não encontrei essa informação documentada no KLASSE ainda. Tente procurar por outros termos.",
      suggestions: suggestions.length > 0 ? suggestions : undefined,
      actions: actionsFromSuggestions(suggestions, schoolId, role),
    };
  }

  // Attempt to map matching routes to offer links
  const links: Array<{ label: string; href: string }> = [];
  for (const route of KLASSE_ROUTES) {
    if (route.roles.includes(role.toLowerCase())) {
      const containsAlias = route.aliases.some((alias) => query.toLowerCase().includes(alias));
      if (containsAlias || answer.toLowerCase().includes(route.title.toLowerCase())) {
        links.push({
          label: route.title,
          href: route.href(schoolId),
        });
      }
    }
  }

  const suggestions = getActionsForRole(role, context?.module).slice(0, 2);
  const routeActions = links.slice(0, 3).map((link, index) => routeAction({
    id: `rag:link:${index}`,
    label: link.label,
    href: link.href,
  }));
  const suggestionActions = actionsFromSuggestions(suggestions, schoolId, role);

  return {
    ok: true,
    mode: "rag",
    answer,
    links: links.length > 0 ? links.slice(0, 3) : undefined,
    suggestions: suggestions.length > 0 ? suggestions : undefined,
    actions: [...routeActions, ...suggestionActions].slice(0, 4),
  };
}
