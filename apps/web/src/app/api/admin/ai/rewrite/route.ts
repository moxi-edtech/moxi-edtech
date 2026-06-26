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
  schoolId: z.string().uuid(),
  text: z.string().trim().min(3).max(6000),
  mode: z.enum(["more_formal", "shorter", "clearer"]).optional().default("more_formal"),
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
};

function buildPrompt(text: string, mode: RewriteMode) {
  return [
    "És o KLASSE AI, assistente administrativo para escolas em Angola.",
    MODE_INSTRUCTIONS[mode],
    "Mantém o sentido original, não inventes factos, não adiciones promessas, valores ou datas que não existam no texto.",
    "Responde apenas com o texto final reescrito, sem introdução, aspas, bullets ou explicações.",
    "",
    "Texto original:",
    text,
  ].join("\n");
}

function localRewriteFallback(text: string) {
  const normalized = text
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();

  if (!normalized) return "";

  const first = normalized.charAt(0).toUpperCase() + normalized.slice(1);
  return `Prezados(as),\n\n${first}\n\nAgradecemos a atenção e permanecemos à disposição para quaisquer esclarecimentos.\n\nCom os melhores cumprimentos.`;
}

function getGeminiText(data: GeminiResponse) {
  return data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim() ?? "";
}

async function generateRewrite(prompt: string, sourceText: string, mode: RewriteMode) {
  const provider = (process.env.AI_PROVIDER ?? "").trim().toLowerCase();
  const apiKey = (process.env.AI_API_KEY ?? "").trim();
  const model = (process.env.AI_MODEL_TEXT ?? "gemini-2.0-flash").trim();
  const maxTokens = Number.parseInt(process.env.AI_MAX_TOKENS ?? "2048", 10);

  if (provider !== "gemini" || !apiKey) {
    return {
      text: localRewriteFallback(sourceText),
      provider: provider || "local",
      model: provider === "gemini" ? model : "local-rewrite",
      tokensInput: null,
      tokensOutput: null,
      fallback: true,
    };
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: mode === "shorter" ? 0.2 : 0.35,
          maxOutputTokens: Number.isFinite(maxTokens) ? maxTokens : 2048,
        },
      }),
    }
  );

  const data = (await response.json().catch(() => ({}))) as GeminiResponse;
  if (!response.ok) {
    throw new Error(data.error?.message || "Falha ao chamar o provedor de IA.");
  }

  const text = getGeminiText(data);
  if (!text) {
    throw new Error("O provedor de IA não retornou texto.");
  }

  return {
    text,
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

  const { schoolId, text, mode } = parsed.data;
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
    schoolId,
    metaEscolaId ? String(metaEscolaId) : null
  );
  if (!resolvedEscolaId || resolvedEscolaId !== schoolId) {
    return NextResponse.json({ ok: false, error: "Sem permissão para esta escola." }, { status: 403 });
  }

  const access = await validateAiAccess(schoolId, "rewrite", "admin_ai_rewrite");
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
      schoolId,
      createdBy: access.userId,
      actionType: "communication_draft",
      sourceModule: "classe_ai",
      title: "Texto administrativo melhorado",
      summary: "Rascunho gerado a partir da ação Polir ou melhorar aviso.",
      content: result.text,
      metadata: {
        mode,
        provider: result.provider,
        model: result.model,
      },
      riskLevel: "low",
      status: "draft",
    });

    return NextResponse.json({ ok: true, text: result.text, actionId: action.id, fallback: result.fallback });
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
