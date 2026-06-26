import "server-only";

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

function getGeminiText(data: GeminiResponse) {
  return data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim() ?? "";
}

export async function generateAiText(params: {
  prompt: string;
  fallback: string;
  temperature?: number;
}) {
  const provider = (process.env.AI_PROVIDER ?? "").trim().toLowerCase();
  const apiKey = (process.env.AI_API_KEY ?? "").trim();
  const model = (process.env.AI_MODEL_TEXT ?? "gemini-2.0-flash").trim();
  const maxTokens = Number.parseInt(process.env.AI_MAX_TOKENS ?? "2048", 10);

  if (provider !== "gemini" || !apiKey) {
    return {
      text: params.fallback,
      provider: provider || "local",
      model: provider === "gemini" ? model : "local-draft",
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
        contents: [{ role: "user", parts: [{ text: params.prompt }] }],
        generationConfig: {
          temperature: params.temperature ?? 0.25,
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
