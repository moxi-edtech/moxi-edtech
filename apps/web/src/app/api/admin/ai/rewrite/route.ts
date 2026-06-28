import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { createAiAction } from "@/lib/server/ai/ai-actions";
import { updateAiUsageLog, validateAiAccess } from "@/lib/server/ai/ai-guards";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { DBWithRPC } from "@/types/supabase-augment";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const rewriteSchema = z.object({
  schoolId: z.string().trim().min(1),
  text: z.string().trim().min(3).max(6000),
  mode: z
    .enum(["more_formal", "shorter", "clearer", "institutional", "whatsapp", "guardian"])
    .optional()
    .default("more_formal"),
});

type RewriteMode = z.infer<typeof rewriteSchema>["mode"];

type GeminiPart = {
  text?: string;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
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

const MODE_INSTRUCTIONS: Record<RewriteMode, string> = {
  more_formal: "Reescreve em português administrativo, claro, profissional e cordial.",
  shorter: "Reescreve de forma mais curta, direta e profissional.",
  clearer: "Reescreve de forma mais clara, organizada e fácil de entender.",
  institutional: "Reescreve em tom institucional, adequado a comunicado oficial da escola.",
  whatsapp: "Reescreve em formato curto para WhatsApp, mantendo cordialidade e objetividade.",
  guardian: "Reescreve para encarregados de educação, com linguagem respeitosa, simples e clara.",
};

type RewriteResult = {
  title: string;
  body: string;
  whatsappText: string;
  reviewNotes: string[];
};

function buildPrompt(text: string, mode: RewriteMode) {
  return [
    "És o KLASSE AI, assistente administrativo para escolas em Angola.",
    MODE_INSTRUCTIONS[mode],
    "Mantém o sentido original, não inventes factos, não adiciones promessas, valores ou datas que não existam no texto.",
    "Se houver nomes, valores, datas ou dados pessoais no texto original, mantém placeholders ou o conteúdo original sem expandir dados.",
    "Responde apenas com JSON válido, sem markdown, no formato:",
    '{"title":"título curto","body":"texto final reescrito","whatsappText":"versão curta para WhatsApp","reviewNotes":["ponto de revisão humana"]}',
    "reviewNotes deve conter 1 a 3 alertas práticos para revisão humana antes de publicar/enviar.",
    "",
    "Texto original:",
    text,
  ].join("\n");
}

function localRewriteFallback(text: string, mode: RewriteMode): RewriteResult {
  const normalized = text
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();

  if (!normalized) {
    return {
      title: "Comunicado",
      body: "",
      whatsappText: "",
      reviewNotes: ["Revise o texto antes de publicar."],
    };
  }

  const first = normalized.charAt(0).toUpperCase() + normalized.slice(1);
  const shortText = first.length > 280 ? `${first.slice(0, 277).trim()}...` : first;
  const body =
    mode === "whatsapp"
      ? shortText
      : `Prezados(as),\n\n${first}\n\nAgradecemos a atenção e permanecemos à disposição para quaisquer esclarecimentos.\n\nCom os melhores cumprimentos.`;

  return {
    title: "Comunicado assistido",
    body,
    whatsappText: shortText,
    reviewNotes: ["Confirme destinatários, datas, valores e nomes antes de publicar ou enviar."],
  };
}

function getGeminiText(data: GeminiResponse) {
  return data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim() ?? "";
}

function parseRewriteResult(rawText: string): RewriteResult {
  const cleaned = rawText
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return {
      title: "Comunicado assistido",
      body: cleaned,
      whatsappText: cleaned.length > 280 ? `${cleaned.slice(0, 277).trim()}...` : cleaned,
      reviewNotes: ["Revise o texto antes de publicar."],
    };
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("O provedor de IA retornou uma resposta inválida.");
  }

  const data = parsed as Partial<RewriteResult>;
  const body = String(data.body ?? "").trim();
  if (!body) {
    throw new Error("O provedor de IA não retornou texto reescrito.");
  }

  const whatsappText = String(data.whatsappText ?? body).trim();
  const reviewNotes = Array.isArray(data.reviewNotes)
    ? data.reviewNotes.map(String).map((item) => item.trim()).filter(Boolean).slice(0, 3)
    : [];

  return {
    title: String(data.title ?? "Comunicado assistido").trim() || "Comunicado assistido",
    body,
    whatsappText: whatsappText.length > 0 ? whatsappText : body,
    reviewNotes: reviewNotes.length > 0 ? reviewNotes : ["Revise o texto antes de publicar."],
  };
}

async function generateRewrite(prompt: string, sourceText: string, mode: RewriteMode) {
  const provider = (process.env.AI_PROVIDER ?? "").trim().toLowerCase();
  const apiKey = (process.env.AI_API_KEY ?? "").trim();
  const model = (process.env.AI_MODEL_TEXT ?? "gemini-2.0-flash").trim();
  const maxTokens = Number.parseInt(process.env.AI_MAX_TOKENS ?? "2048", 10);
  const timeoutMs = Number.parseInt(process.env.AI_TIMEOUT_MS ?? "15000", 10);

  if (provider !== "gemini" || !apiKey) {
    const fallbackResult = localRewriteFallback(sourceText, mode);
    return {
      ...fallbackResult,
      text: fallbackResult.body,
      provider: provider || "local",
      model: provider === "gemini" ? model : "local-rewrite",
      tokensInput: null,
      tokensOutput: null,
      fallback: true,
    };
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
            temperature: mode === "shorter" || mode === "whatsapp" ? 0.2 : 0.35,
            maxOutputTokens: Number.isFinite(maxTokens) ? maxTokens : 2048,
            responseMimeType: "application/json",
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

  const data = (await response.json().catch(() => ({}))) as GeminiResponse;
  if (!response.ok) {
    throw new Error(data.error?.message || "Falha ao chamar o provedor de IA.");
  }

  const text = getGeminiText(data);
  if (!text) {
    throw new Error("O provedor de IA não retornou texto.");
  }
  const parsed = parseRewriteResult(text);

  return {
    ...parsed,
    text: parsed.body,
    provider,
    model,
    tokensInput: data.usageMetadata?.promptTokenCount ?? null,
    tokensOutput: data.usageMetadata?.candidatesTokenCount ?? null,
    fallback: false,
  };
}

export async function POST(req: Request) {
  const parsed = rewriteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Payload inválido." }, { status: 400 });
  }

  const { schoolId: requestedSchoolId, text, mode } = parsed.data;
  const supabase = await supabaseServerTyped<DBWithRPC>();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user ?? null;
  if (!user) {
    return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
  }

  const metaEscolaId = (user.app_metadata as { escola_id?: string | null } | null)?.escola_id ?? null;
  const resolvedEscolaId = await resolveEscolaIdForUser(
    supabase,
    user.id,
    requestedSchoolId,
    metaEscolaId ? String(metaEscolaId) : null
  );
  if (!resolvedEscolaId) {
    return NextResponse.json({ ok: false, error: "Sem permissão para esta escola." }, { status: 403 });
  }

  const access = await validateAiAccess(resolvedEscolaId, "rewrite", "admin_ai_rewrite");
  if (!access.ok || !access.userId) {
    return NextResponse.json({ ok: false, error: access.error ?? "Sem permissão para usar KLASSE AI." }, { status: 403 });
  }

  const prompt = buildPrompt(text, mode);

  try {
    const result = await generateRewrite(prompt, text, mode);
    await updateAiUsageLog(access.usageLogId, {
      status: "completed",
      inputPreview: text,
      outputPreview: result.text,
      tokensInput: result.tokensInput,
      tokensOutput: result.tokensOutput,
      provider: result.provider,
      model: result.model,
    });

    const action = await createAiAction(supabase, {
      schoolId: resolvedEscolaId,
      createdBy: access.userId,
      actionType: "communication_draft",
      sourceModule: "classe_ai",
      title: result.title,
      summary: `Rascunho gerado no modo ${mode}.`,
      content: result.text,
      metadata: {
        mode,
        provider: result.provider,
        model: result.model,
        whatsappText: result.whatsappText,
        reviewNotes: result.reviewNotes,
      },
      riskLevel: mode === "whatsapp" ? "medium" : "low",
      status: "draft",
    });

    return NextResponse.json({
      ok: true,
      title: result.title,
      text: result.text,
      body: result.body,
      whatsappText: result.whatsappText,
      reviewNotes: result.reviewNotes,
      actionId: action.id,
      fallback: result.fallback,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao reescrever texto.";
    await updateAiUsageLog(access.usageLogId, {
      status: "error",
      inputPreview: text,
      outputPreview: null,
      errorMessage: message,
    });

    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
