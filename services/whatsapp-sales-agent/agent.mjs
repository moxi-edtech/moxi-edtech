import fs from "node:fs/promises";
import crypto from "node:crypto";

const required = ["WAHA_BASE_URL", "WAHA_API_KEY", "WAHA_SESSION", "AI_API_KEY"];
for (const name of required) {
  if (!String(process.env[name] || "").trim()) throw new Error("Variável obrigatória ausente: " + name);
}

const baseUrl = process.env.WAHA_BASE_URL.trim().replace(/\/$/, "");
const apiKey = process.env.WAHA_API_KEY.trim();
const session = process.env.WAHA_SESSION.trim();
const aiProvider = (process.env.AI_PROVIDER || "deepseek").trim().toLowerCase();
const aiKey = process.env.AI_API_KEY.trim();
const aiModel = (process.env.AI_MODEL || (aiProvider === "deepseek" ? "deepseek-v4-flash" : "gemini-2.5-flash")).trim();
const fallbackProvider = (process.env.AI_FALLBACK_PROVIDER || "gemini").trim().toLowerCase();
const fallbackKey = (process.env.AI_FALLBACK_API_KEY || "").trim();
const fallbackModel = (process.env.AI_FALLBACK_MODEL || "gemini-2.5-flash").trim();
const dryRun = String(process.env.AGENT_DRY_RUN || "true").toLowerCase() !== "false";
const pollMs = Math.max(5000, Number(process.env.POLL_MS || 15000));
const followUpHours = Math.max(1, Number(process.env.FOLLOWUP_AFTER_HOURS || 24));
const maxFollowUps = Math.max(0, Number(process.env.MAX_FOLLOWUPS || 2));
const stateFile = process.env.STATE_FILE || "/data/state.json";
const knowledge = await fs.readFile(new URL("./knowledge.md", import.meta.url), "utf8");

let state = {};
try { state = JSON.parse(await fs.readFile(stateFile, "utf8")); } catch { state = {}; }
const bootstrap = String(process.env.BOOTSTRAP_STATE || "true").toLowerCase() !== "false";

const headers = { "X-Api-Key": apiKey, Accept: "application/json" };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const now = () => Date.now();
const mask = (id) => String(id).replace(/(\d{3})\d+(\d{2}@)/, "$1***$2");

async function waha(path, options = {}) {
  const response = await fetch(baseUrl + path, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  const body = await response.text();
  let json; try { json = JSON.parse(body); } catch { json = body; }
  if (!response.ok) throw new Error("WAHA " + response.status + ": " + (typeof json === "string" ? json : JSON.stringify(json)));
  return json;
}

async function getChats() {
  const result = await waha("/api/" + encodeURIComponent(session) + "/chats/overview?limit=100&offset=0");
  return Array.isArray(result) ? result : result.data || result.chats || [];
}

async function getMessages(chatId) {
  const result = await waha("/api/" + encodeURIComponent(session) + "/chats/" + encodeURIComponent(chatId) + "/messages?limit=30");
  return Array.isArray(result) ? result : result.data || result.messages || [];
}

async function callAi(provider, key, model, prompt) {
  if (!key) throw new Error("Chave do provedor de IA ausente");

  if (provider === "deepseek") {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.25,
        max_tokens: 700,
        response_format: { type: "json_object" },
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error((payload.error && payload.error.message) || "DeepSeek " + response.status);
    return String(payload.choices?.[0]?.message?.content || "").trim();
  }

  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent?key=" + encodeURIComponent(key), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.25, maxOutputTokens: 700, responseMimeType: "application/json" } }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((payload.error && payload.error.message) || "Gemini " + response.status);
  return String(payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "").trim();
}

function textOf(message) {
  return String(message && (message.body || (message.text && message.text.body) || message.caption) || "").trim();
}

function conversationText(messages) {
  return messages.filter((message) => textOf(message)).slice(-16)
    .map((message) => (message.fromMe ? "KLASSE" : "LEAD") + ": " + textOf(message)).join("\n");
}

async function generateDecision(chat, messages, followUp) {
  const prompt = [
    "Você é o agente comercial autónomo do KLASSE no WhatsApp.",
    "Responda somente em JSON válido, sem markdown, com as chaves reply, intent, handoff, optOut e followUpHours.",
    "Use português natural de Angola e seja breve, respondendo a pergunta antes de pedir dados.",
    "Nunca invente preços, descontos, funcionalidades ou disponibilidade.",
    "Se perguntarem preço, diga que um consultor apresentará o plano adequado após conhecer a instituição.",
    "Peça no máximo duas informações por mensagem.",
    "handoff=true para reclamação, contrato, negociação, preço final, pedido de humano ou dúvida fora da base.",
    "optOut=true se o lead pedir para parar, remover ou não contactar.",
    "Para follow-up, não pressione: reconheça o contexto e faça uma pergunta simples.",
    "followUpHours deve ser 0 se não for necessário acompanhamento, ou entre 24 e 72 se for.",
    knowledge,
    "Nome do contacto: " + (chat.name || "não informado"),
    "É follow-up: " + (followUp ? "sim" : "não"),
    "Conversa:", conversationText(messages),
  ].join("\n\n");

  let raw;
  try {
    raw = await callAi(aiProvider, aiKey, aiModel, prompt);
  } catch (primaryError) {
    if (!fallbackKey || fallbackProvider === aiProvider) throw primaryError;
    raw = await callAi(fallbackProvider, fallbackKey, fallbackModel, prompt);
    console.warn("[AI_FALLBACK] provider=" + fallbackProvider);
  }
  if (!raw) throw new Error("Gemini não retornou uma decisão");
  const decision = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, ""));
  if (!decision.reply || decision.optOut) return { ...decision, reply: null };
  return decision;
}

async function send(chatId, text) {
  if (dryRun) { console.log("[DRY_RUN] " + mask(chatId) + " <- " + text); return "dry-" + crypto.randomUUID(); }
  const result = await waha("/api/sendText", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session, chatId, text, id: "klasse-sales-" + crypto.randomUUID(), linkPreview: false }),
  });
  return result.id || result.messageId || "sent";
}

async function processChat(chat) {
  const chatId = String(chat.id || "");
  if (!chatId.endsWith("@c.us") || chatId === "status@broadcast") return;
  const messages = await getMessages(chatId);
  const lastInbound = messages.filter((message) => !message.fromMe && textOf(message)).at(-1);
  if (!lastInbound || !lastInbound.id) return;
  const entry = state[chatId] || { followUps: 0 };
  if (entry.lastInboundId === lastInbound.id) return;
  const decision = await generateDecision(chat, messages, false);
  entry.lastInboundId = lastInbound.id;
  entry.updatedAt = now();
  entry.followUps = 0;
  if (decision.reply) {
    await send(chatId, decision.reply);
    entry.lastOutboundAt = now();
    entry.nextFollowUpAt = decision.followUpHours ? now() + decision.followUpHours * 3600000 : null;
    console.log("[REPLY] " + mask(chatId) + " intent=" + decision.intent + " handoff=" + Boolean(decision.handoff));
  }
  state[chatId] = entry;
}

async function processFollowUp(chat) {
  const chatId = String(chat.id || "");
  const entry = state[chatId];
  if (!entry || !entry.nextFollowUpAt || entry.followUps >= maxFollowUps || entry.nextFollowUpAt > now()) return;
  const messages = await getMessages(chatId);
  const decision = await generateDecision(chat, messages, true);
  entry.followUps += 1;
  entry.nextFollowUpAt = null;
  if (decision.reply) {
    await send(chatId, decision.reply);
    entry.lastOutboundAt = now();
    entry.nextFollowUpAt = decision.followUpHours ? now() + decision.followUpHours * 3600000 : null;
    console.log("[FOLLOW_UP] " + mask(chatId) + " number=" + entry.followUps);
  }
}

async function tick() {
  const chats = await getChats();
  if (bootstrap && !state.__bootstrapped) {
    for (const chat of chats) {
      const chatId = String(chat.id || "");
      if (!chatId.endsWith("@c.us")) continue;
      try {
        const messages = await getMessages(chatId);
        const inbound = messages.filter((message) => !message.fromMe && textOf(message)).at(-1);
        if (inbound && inbound.id) state[chatId] = { lastInboundId: inbound.id, followUps: 0, bootstrappedAt: now() };
      } catch (error) { console.error("[BOOTSTRAP_ERROR] " + mask(chatId) + " " + error.message); }
    }
    state.__bootstrapped = true;
    await fs.mkdir(new URL(".", "file://" + stateFile).pathname, { recursive: true }).catch(() => {});
    await fs.writeFile(stateFile, JSON.stringify(state, null, 2));
    console.log("State bootstrapped; existing messages will not trigger replies.");
    return;
  }
  for (const chat of chats) {
    try {
      await processChat(chat);
      await processFollowUp(chat);
    } catch (error) { console.error("[CHAT_ERROR] " + mask(chat.id) + " " + error.message); }
  }
  await fs.mkdir(new URL(".", "file://" + stateFile).pathname, { recursive: true }).catch(() => {});
  await fs.writeFile(stateFile, JSON.stringify(state, null, 2));
}

console.log("KLASSE WhatsApp Sales Agent session=" + session + " dryRun=" + dryRun + " pollMs=" + pollMs);
while (true) {
  try { await tick(); } catch (error) { console.error("[TICK_ERROR] " + error.message); }
  await sleep(pollMs);
}
