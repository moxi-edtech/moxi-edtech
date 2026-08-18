import "server-only";

export type AiProviderResult = {
  text: string;
  provider: string;
  model: string;
  tokensInput: number | null;
  tokensOutput: number | null;
  fallbackUsed?: boolean;
};

type ProviderOptions = {
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
  timeoutMs?: number;
};

type ProviderConfig = {
  provider: string;
  apiKey: string;
  model: string;
};

function modelForProvider(provider: string, configuredModel: string, fallback = false) {
  if (configuredModel) return configuredModel;
  if (provider === "deepseek") return "deepseek-v4-flash";
  if (provider === "gemini") return "gemini-2.5-flash";
  return fallback ? "local-fallback" : "local-draft";
}

export function getAiProviderConfig() {
  const provider = (process.env.AI_PROVIDER || "deepseek").trim().toLowerCase();
  const apiKey = (process.env.AI_API_KEY ?? "").trim();
  const configuredModel = (process.env.AI_MODEL_TEXT ?? "").trim();
  return { provider, apiKey, model: modelForProvider(provider, configuredModel) };
}

function getFallbackProviderConfig(): ProviderConfig | null {
  const provider = (process.env.AI_FALLBACK_PROVIDER || "gemini").trim().toLowerCase();
  const apiKey = (process.env.AI_FALLBACK_API_KEY || process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey || !["gemini", "deepseek"].includes(provider)) return null;
  return {
    provider,
    apiKey,
    model: modelForProvider(provider, (process.env.AI_FALLBACK_MODEL_TEXT ?? "").trim(), true),
  };
}

async function callConfiguredProvider(options: ProviderOptions, config: ProviderConfig): Promise<AiProviderResult> {
  const { provider, apiKey, model } = config;
  const maxTokens = Number.isFinite(options.maxTokens) ? options.maxTokens : 2048;
  const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : 15000;

  if (!apiKey || !["gemini", "deepseek"].includes(provider)) {
    throw new Error("Provedor de IA não configurado ou não suportado.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;

  try {
    if (provider === "deepseek") {
      response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: options.prompt }],
          temperature: options.temperature ?? 0.25,
          max_tokens: maxTokens,
          ...(options.json ? { response_format: { type: "json_object" } } : {}),
        }),
      });
    } else {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: options.prompt }] }],
            generationConfig: {
              temperature: options.temperature ?? 0.25,
              maxOutputTokens: maxTokens,
              ...(options.json ? { responseMimeType: "application/json" } : {}),
            },
          }),
        }
      );
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Tempo limite excedido ao consultar o provedor de IA.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 429) throw new Error("COTA_EXCEDIDA");
    const message = data?.error?.message || data?.error || "Falha ao chamar o provedor de IA.";
    throw new Error(`${provider}: ${response.status} - ${message}`);
  }

  const text = provider === "deepseek"
    ? String(data?.choices?.[0]?.message?.content ?? "").trim()
    : String(data?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? "").join("") ?? "").trim();
  if (!text) throw new Error(`${provider} não retornou texto.`);

  return {
    text,
    provider,
    model,
    tokensInput: data?.usage?.prompt_tokens ?? data?.usageMetadata?.promptTokenCount ?? null,
    tokensOutput: data?.usage?.completion_tokens ?? data?.usageMetadata?.candidatesTokenCount ?? null,
  };
}

export async function callAiProvider(options: ProviderOptions): Promise<AiProviderResult> {
  return callConfiguredProvider(options, getAiProviderConfig());
}

export async function callAiWithFallback(options: ProviderOptions): Promise<AiProviderResult> {
  const primary = getAiProviderConfig();
  try {
    return await callConfiguredProvider(options, primary);
  } catch (primaryError) {
    const fallback = getFallbackProviderConfig();
    if (!fallback || fallback.provider === primary.provider) throw primaryError;

    try {
      const result = await callConfiguredProvider(options, fallback);
      return { ...result, fallbackUsed: true };
    } catch {
      throw primaryError;
    }
  }
}
