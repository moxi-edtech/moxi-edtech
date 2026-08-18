import "server-only";
import { callAiWithFallback, getAiProviderConfig } from "./provider-client";

export async function generateAiText(params: {
  prompt: string;
  fallback: string;
  temperature?: number;
}) {
  const { provider, apiKey, model } = getAiProviderConfig();
  const maxTokens = Number.parseInt(process.env.AI_MAX_TOKENS ?? "2048", 10);

  if (!["gemini", "deepseek"].includes(provider) || !apiKey) {
    return {
      text: params.fallback,
      provider: provider || "local",
      model: ["gemini", "deepseek"].includes(provider) ? model : "local-draft",
      tokensInput: null,
      tokensOutput: null,
      fallback: true,
    };
  }

  const result = await callAiWithFallback({ prompt: params.prompt, temperature: params.temperature, maxTokens });

  return {
    ...result,
    fallback: false,
  };
}
