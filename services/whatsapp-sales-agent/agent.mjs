import fs from "node:fs/promises";
import crypto from "node:crypto";
import { applyResponsePolicy } from "./response-policy.mjs";

const required = ["WAHA_BASE_URL", "WAHA_API_KEY", "WAHA_SESSION", "AI_API_KEY"];
for (const name of required) {
  if (!String(process.env[name] || "").trim()) throw new Error("Variável obrigatória ausente: " + name);
}

const baseUrl = process.env.WAHA_BASE_URL.trim().replace(/\/$/, "");
const apiKey = process.env.WAHA_API_KEY.trim();
const session = process.env.WAHA_SESSION.trim();
const aiKey = process.env.AI_API_KEY.trim();
const aiProvider = (process.env.AI_PROVIDER || "gemini").trim().toLowerCase();
const aiModel = (process.env.AI_MODEL || "gemini-2.5-flash").trim();
const dryRun = String(process.env.AGENT_DRY_RUN || "true").toLowerCase() !== "false";
const pollMs = Math.max(5000, Number(process.env.POLL_MS || 15000));
const followUpHours = Math.max(1, Number(process.env.FOLLOWUP_AFTER_HOURS || 24));
const maxFollowUps = Math.max(0, Number(process.env.MAX_FOLLOWUPS || 1));
const requestTimeoutMs = Math.max(5000, Number(process.env.REQUEST_TIMEOUT_MS || 15000));
const gateBaseUrl = (process.env.KLASSE_GATE_BASE_URL || "https://app.klasse.ao").trim().replace(/\/$/, "");
const gateSecret = (process.env.AGENT_GATE_SECRET || process.env.WAHA_WEBHOOK_SECRET || "").trim();
const aiMinIntervalMs = Math.max(1000, Number(process.env.AI_MIN_INTERVAL_MS || 15000));
const maxNewChatsPerTick = Math.max(1, Number(process.env.MAX_NEW_CHATS_PER_TICK || 1));
const chatPageSize = Math.min(100, Math.max(25, Number(process.env.CHAT_PAGE_SIZE || 100)));
const maxChatPages = Math.min(20, Math.max(1, Number(process.env.MAX_CHAT_PAGES || 10)));
const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim().replace(/\/$/, "");
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const queueEnabled = Boolean(supabaseUrl && supabaseServiceKey && String(process.env.SUPABASE_AGENT_QUEUE_ENABLED || "true").toLowerCase() !== "false");
const queueBatchSize = Math.min(50, Math.max(1, Number(process.env.SUPABASE_AGENT_QUEUE_BATCH_SIZE || 20)));
const workerId = (process.env.SUPABASE_AGENT_WORKER_ID || crypto.randomUUID()).trim();
const reconciliationIntervalMs = Math.max(60000, Number(process.env.SUPABASE_AGENT_RECONCILIATION_INTERVAL_MS || 300000));
const reconciliationChatLimit = Math.min(100, Math.max(10, Number(process.env.SUPABASE_AGENT_RECONCILIATION_CHAT_LIMIT || 50)));
const businessTimeZone = "Africa/Luanda";
// Horário operacional só pode vir da configuração da VPS.
const businessHours = (process.env.BUSINESS_HOURS || "").trim();
const callWindows = (process.env.CALL_WINDOWS || "10h–12h, 13h–14h, 14h–15h, 16h–17h").trim();
const managedLabelIds = new Set(["4", "7", "10", "11"]);
const unsupportedInstitutionPattern = /\bcentro\s+de\s+forma(?:ç|c)(?:a|ã)o|forma(?:ç|c)(?:a|ã)o\s+profissional|instituto\s+de\s+forma(?:ç|c)(?:a|ã)o\b/i;
const maleHandoffChatId = (process.env.HANDOFF_MALE_CHAT_ID || "").trim();
const femaleHandoffChatId = (process.env.HANDOFF_FEMALE_CHAT_ID || "").trim();
const testChatIds = new Set(String(process.env.TEST_CHAT_IDS || "").split(",").map((id) => id.trim()).filter(Boolean));
const stateFile = process.env.STATE_FILE || "/data/state.json";
const activationGeneration = process.env.AGENT_GENERATION || "new-only-2026-08-18-v2-lid-typing";
const knowledge = await fs.readFile(new URL("./knowledge.md", import.meta.url), "utf8");

let state = {};
let lastAiRequestAt = 0;
let lastReconciliationAt = 0;
try { state = JSON.parse(await fs.readFile(stateFile, "utf8")); } catch { state = {}; }
const bootstrap = String(process.env.BOOTSTRAP_STATE || "true").toLowerCase() !== "false";

const headers = { "X-Api-Key": apiKey, Accept: "application/json" };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const now = () => Date.now();
const mask = (id) => String(id).replace(/(\d{3})\d+(\d{2}@)/, "$1***$2");

function schedulingContext() {
  const nowDate = new Date();
  const dateFormatter = new Intl.DateTimeFormat("pt-AO", { timeZone: businessTimeZone, dateStyle: "full", timeStyle: "short" });
  const dayFormatter = new Intl.DateTimeFormat("en-US", { timeZone: businessTimeZone, weekday: "short" });
  const days = [];
  for (let offset = 1; days.length < 3 && offset <= 10; offset += 1) {
    const date = new Date(nowDate.getTime() + offset * 86400000);
    if (["Sat", "Sun"].includes(dayFormatter.format(date))) continue;
    days.push(new Intl.DateTimeFormat("pt-AO", { timeZone: businessTimeZone, weekday: "long" }).format(date));
  }
  return businessHours
    ? "Data/hora actual em Angola: " + dateFormatter.format(nowDate) + ". Atendimento oficial: " + businessHours + ". Intervalos autorizados para ligações: " + callWindows + ". Próximos dias úteis disponíveis: " + days.join("; ") + ". Ao responder, mostre somente o dia da semana e o intervalo autorizado, sem data numérica; nunca sugira um horário fora dos intervalos."
    : "Não há horário oficial de atendimento configurado. Não informe horas, disponibilidade ou início/fim do expediente; encaminhe essa confirmação para um atendente.";
}

function localParts() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: businessTimeZone, weekday: "short", hour: "2-digit", hour12: false }).formatToParts(new Date());
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

function outsideBusinessHoursReply(hasQualificationData = false) {
  const { weekday, hour } = localParts();
  const weekend = weekday === "Sat" || weekday === "Sun";
  if (weekend) return hasQualificationData
    ? "Obrigado pelas informações. Na segunda-feira retomaremos o atendimento e daremos seguimento ao seu pedido."
    : "Obrigado pela mensagem e um óptimo fim de semana. O nosso expediente desta semana encerrou. Para garantir um atendimento rápido na segunda-feira, envie:\n\n1. Que tipo de instituição é a sua\n2. Quantos alunos em média\n3. Localização\n4. Seu cargo e nome\n\nNa segunda-feira, assim que iniciarmos o dia, retomamos o contacto.";
  if (Number(hour) >= 17 && hasQualificationData) return "Obrigado pelas informações. Amanhã, " + nextBusinessDayLabel() + ", retomaremos o atendimento e daremos seguimento ao seu pedido.";
  if (Number(hour) >= 17) return "Obrigado pela mensagem. O nosso expediente de hoje encerrou. Amanhã, " + nextBusinessDayLabel() + ", retomaremos o atendimento. Para adiantar, envie:\n\n1. Que tipo de instituição é a sua\n2. Quantos alunos em média\n3. Localização\n4. Seu cargo e nome";
  return "Obrigado pela mensagem. O atendimento será retomado no próximo período útil. Para adiantar, envie:\n\n1. Que tipo de instituição é a sua\n2. Quantos alunos em média\n3. Localização\n4. Seu cargo e nome";
}

function isBusinessHours() {
  if (!businessHours) return true;
  const { weekday, hour } = localParts();
  if (["Sat", "Sun"].includes(weekday)) return false;
  const range = businessHours.match(/(\d{1,2})h(?:([0-5]\d))?.*?(\d{1,2})h(?:([0-5]\d))?/i);
  if (!range) return true;
  const start = Number(range[1]) * 60 + Number(range[2] || 0);
  const end = Number(range[3]) * 60 + Number(range[4] || 0);
  const currentHour = Number(hour);
  const currentMinute = Number(new Intl.DateTimeFormat("en-US", { timeZone: businessTimeZone, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date()).find((part) => part.type === "minute")?.value || 0);
  const current = currentHour * 60 + currentMinute;
  return current >= start && current < end;
}

function localDateKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: businessTimeZone }).format(new Date());
}

function nextBusinessDayLabel() {
  const weekday = localParts().weekday;
  const next = { Mon: "terça-feira", Tue: "quarta-feira", Wed: "quinta-feira", Thu: "sexta-feira", Fri: "segunda-feira", Sat: "segunda-feira", Sun: "segunda-feira" };
  return next[weekday] || "próximo dia útil";
}

function unsupportedInstitutionReply() {
  return "Neste momento, o KLASSE é destinado exclusivamente à gestão de escolas. Não atendemos centros de formação. Agradecemos o seu contacto.";
}

function isDirectChat(chatId) {
  return chatId.endsWith("@c.us") || chatId.endsWith("@lid");
}

function isInternalChat(chatId) {
  return chatId === maleHandoffChatId || chatId === femaleHandoffChatId || testChatIds.has(chatId);
}

function qualificationDataProvided(messages) {
  const text = messages.map(textOf).join("\n");
  return /\b(?:escola|col[eé]gio|ensino|institui[cç][aã]o|privada|p[uú]blica)\b/i.test(text)
    || /\b\d{2,5}\s*(?:alunos?|estudantes?)?\b/i.test(text)
    || /\b(?:Luanda|Kilamba|Viana|Huambo|Benguela|localiza[cç][aã]o)\b/i.test(text)
    || /\b(?:director|diretor|secret[aá]ri[oa]|professor|professora|gestor|respons[aá]vel)\b/i.test(text);
}

function normalizeSalesLanguage(reply) {
  let normalized = String(reply || "")
    .replace(/apresenta(?:ção|cao)|demonstra(?:ção|cao)|\bdemo\b/gi, "ligação para saber mais detalhes");
  normalized = normalized.replace(/^\s*(?:Perfeito[!,]?|Para avançar[,]?)\s*/i, "");
  normalized = normalized.replace(/,?\s*\d{1,2}\/\d{1,2}/g, "");
  const times = [...normalized.matchAll(/\b\d{1,2}h(?:\d{2})?\b/g)].map((match) => match[0]);
  if (times.length > 1 && /ligação para saber mais detalhes/i.test(normalized)) {
    const weekday = normalized.match(/\b(segunda-feira|terça-feira|quarta-feira|quinta-feira|sexta-feira)\b/i)?.[1] || "";
    return "Podemos marcar uma ligação para saber mais detalhes" + (weekday ? " na " + weekday : "") + " às " + times[0] + ". Esse horário funciona para si?";
  }
  return normalized;
}

function currentDayPeriod() {
  const hour = Number(localParts().hour);
  if (hour < 12) return "manhã";
  if (hour < 18) return "tarde";
  return "noite";
}

function confirmedCallReply(chat, latestText) {
  const time = latestText.match(/\b(?:10|11|12|13|14|16|17)h(?:\s*\d{2})?\b/i)?.[0] || "no horário combinado";
  const name = String(chat.name || "").trim();
  const greeting = name ? "Perfeito, " + name + ", " : "Perfeito, ";
  return greeting + "às " + time + " ligaremos para esclarecimentos. Obrigado e continuação de uma óptima " + currentDayPeriod() + ".";
}

async function waha(path, options = {}) {
  const response = await fetch(baseUrl + path, { ...options, signal: AbortSignal.timeout(requestTimeoutMs), headers: { ...headers, ...(options.headers || {}) } });
  const body = await response.text();
  let json; try { json = JSON.parse(body); } catch { json = body; }
  if (!response.ok) throw new Error("WAHA " + response.status + ": " + (typeof json === "string" ? json : JSON.stringify(json)));
  return json;
}

async function supabaseRequest(path, options = {}) {
  if (!queueEnabled) throw new Error("Supabase agent queue is not configured");
  const response = await fetch(supabaseUrl + path, {
    ...options,
    signal: AbortSignal.timeout(requestTimeoutMs),
    headers: {
      apikey: supabaseServiceKey,
      Authorization: "Bearer " + supabaseServiceKey,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const body = await response.text();
  let json; try { json = JSON.parse(body); } catch { json = body; }
  if (!response.ok) throw new Error("Supabase " + response.status + ": " + (typeof json === "string" ? json : JSON.stringify(json)));
  return json;
}

async function claimInboxEvents() {
  return supabaseRequest("/rest/v1/rpc/claim_whatsapp_agent_inbox", {
    method: "POST",
    body: JSON.stringify({ p_session_name: session, p_limit: queueBatchSize, p_worker_id: workerId }),
  });
}

async function updateInboxEvent(id, update) {
  await supabaseRequest("/rest/v1/whatsapp_agent_inbox_events?id=eq." + encodeURIComponent(id), {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(update),
  });
}

async function humanGate(chatId) {
  let gateChatId = String(chatId || "");
  if (gateChatId.endsWith("@lid")) {
    try {
      const contact = await waha("/api/" + encodeURIComponent(session) + "/contacts/" + encodeURIComponent(gateChatId));
      const canonicalId = String(contact?.id || "").trim();
      if (canonicalId.endsWith("@c.us")) gateChatId = canonicalId;
    } catch (error) {
      console.error("[HUMAN_GATE_CONTACT_RESOLVE_ERROR] " + mask(chatId) + " " + (error instanceof Error ? error.message : String(error)));
    }
  }
  const phone = gateChatId.split("@")[0].replace(/\D/g, "");
  if (!phone || !gateSecret) {
    console.error("[HUMAN_GATE_BLOCKED] gate secret or phone is missing");
    return false;
  }
  const payload = session + "\n" + phone;
  const signature = crypto.createHmac("sha256", gateSecret).update(payload).digest("hex");
  const endpoint = gateBaseUrl + "/api/jobs/waha-agent/eligibility?session=" + encodeURIComponent(session) + "&phone=" + encodeURIComponent(phone);
  try {
    const response = await fetch(endpoint, {
      signal: AbortSignal.timeout(requestTimeoutMs),
      headers: { "X-Agent-Signature": signature, Accept: "application/json" },
      cache: "no-store",
    });
    const result = await response.json().catch(() => null);
    const eligible = response.ok && result?.ok === true && result?.eligible === true;
    if (!eligible) console.log("[HUMAN_GATE_SKIP] " + mask(chatId) + " reason=" + String(result?.reason || "gate_error"));
    return eligible;
  } catch (error) {
    console.error("[HUMAN_GATE_ERROR] " + mask(chatId) + " " + (error instanceof Error ? error.message : String(error)));
    return false;
  }
}

async function getChats() {
  const chats = [];
  const seen = new Set();
  for (let page = 0; page < maxChatPages; page += 1) {
    const offset = page * chatPageSize;
    const result = await waha("/api/" + encodeURIComponent(session) + "/chats/overview?limit=" + chatPageSize + "&offset=" + offset);
    const batch = Array.isArray(result) ? result : result.data || result.chats || [];
    for (const chat of batch) {
      const chatId = String(chat?.id || "");
      if (chatId && !seen.has(chatId)) {
        seen.add(chatId);
        chats.push(chat);
      }
    }
    if (batch.length < chatPageSize) break;
  }
  if (chats.length >= chatPageSize * maxChatPages) {
    console.warn("[CHAT_PAGINATION_LIMIT] pages=" + maxChatPages + " chats=" + chats.length);
  }
  return chats;
}

async function getMessages(chatId) {
  const result = await waha("/api/" + encodeURIComponent(session) + "/chats/" + encodeURIComponent(chatId) + "/messages?limit=30");
  return Array.isArray(result) ? result : result.data || result.messages || [];
}

async function setPresence(chatId, presence) {
  if (dryRun) return;
  await waha("/api/" + encodeURIComponent(session) + "/presence", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatId, presence }),
  });
}

async function updateLeadLabels(chatId, messages, decision) {
  const existing = await waha("/api/" + encodeURIComponent(session) + "/labels/chats/" + encodeURIComponent(chatId));
  const preserved = (Array.isArray(existing) ? existing : []).filter((label) => !managedLabelIds.has(String(label.id))).map((label) => ({ id: String(label.id) }));
  const text = messages.map(textOf).join("\n");
  const mentionedCounts = [...text.matchAll(/\b(\d{2,5})\s*(?:alunos|alunas|estudantes)\b/gi)].map((match) => Number(match[1]));
  const studentCount = Math.max(Number(decision.studentCount) || 0, ...mentionedCounts, 0);
  const intent = String(decision.intent || "").toLowerCase();
  const stage = String(decision.stage || "").toLowerCase();
  const stageLabel = decision.handoff || /ligar|chamada|contact/.test(stage + " " + intent) ? "4" : /reun|agend|demonstr|hor[aá]rio/.test(stage + " " + intent) ? "11" : "7";
  const labels = [{ id: stageLabel }];
  if (studentCount >= 400) labels.push({ id: "10" });
  await waha("/api/" + encodeURIComponent(session) + "/labels/chats/" + encodeURIComponent(chatId), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ labels: [...preserved, ...labels] }),
  });
  console.log("[LABELS] " + mask(chatId) + " stage=" + stageLabel + " students=" + studentCount);
}

async function notifyHandoff(chat, messages, decision) {
  if (testChatIds.has(String(chat.id || ""))) {
    console.log("[HANDOFF_TEST_ONLY] " + mask(chat.id));
    return true;
  }
  const recipient = decision.contactGender === "male" ? maleHandoffChatId : decision.contactGender === "female" ? femaleHandoffChatId : "";
  if (!recipient) {
    console.log("[HANDOFF_NO_ROUTE] " + mask(chat.id) + " gender=" + String(decision.contactGender || "unknown"));
    return false;
  }
  const latest = latestInbound(messages);
  const text = [
    "NOVO REPASSE COMERCIAL",
    "Lead: " + (chat.name || "Sem nome"),
    "Instituição: " + (decision.institution || "não identificada"),
    "Alunos: " + (decision.studentCount || "não informado"),
    "Localização: " + (decision.location || "não informada"),
    "Cargo: " + (decision.role || "não informado"),
    "Última mensagem: " + textOf(latest),
  ].join("\n");
  await waha("/api/sendText", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session, chatId: recipient, text, id: "klasse-handoff-" + crypto.randomUUID(), linkPreview: false }),
  });
  console.log("[HANDOFF_SENT] " + mask(chat.id) + " gender=" + decision.contactGender);
  return true;
}

function textOf(message) {
  return String(message && (message.body || (message.text && message.text.body) || message.caption) || "").trim();
}

function conversationText(messages) {
  return messages.filter((message) => textOf(message)).sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0)).slice(-16)
    .map((message) => (message.fromMe ? "KLASSE" : "LEAD") + ": " + textOf(message)).join("\n");
}

function latestInbound(messages) {
  return messages.filter((message) => !message.fromMe && textOf(message))
    .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0))[0];
}

function replyTarget(chatId, inbound) {
  const inboundFrom = String(inbound?.from || "").trim();
  if (inboundFrom.endsWith("@lid")) {
    if (inboundFrom !== chatId) console.log("[REPLY_TARGET_LID] " + mask(chatId) + " -> " + mask(inboundFrom));
    return inboundFrom;
  }
  return chatId;
}

function latestOutbound(messages) {
  return messages.filter((message) => message.fromMe && textOf(message))
    .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0))[0];
}

async function generateDecision(chat, messages, followUp, context = {}) {
  const waitMs = lastAiRequestAt + aiMinIntervalMs - now();
  if (waitMs > 0) await sleep(waitMs);
  lastAiRequestAt = now();
  const prompt = [
    "Você é o agente comercial autónomo do KLASSE no WhatsApp.",
    "Responda somente em JSON válido, sem markdown, com as chaves reply, intent, handoff, optOut, followUpHours, studentCount, stage, contactGender, institution, location e role.",
    "Use português claro, cordial e profissional de Angola. Seja humano e natural, mas não informal: não use gírias, emojis ou excesso de intimidade. Responda em no máximo 2 frases curtas, sem enrolação, respondendo primeiro à última mensagem.",
    "Responda no idioma predominante da última mensagem do lead; se o lead escrever em inglês, responda em inglês. Não traduza nem repita o formulário sem necessidade.",
    "Nunca peça desculpa sem necessidade, nunca repita o histórico e nunca explique o processo. Toda resposta deve terminar com uma única próxima ação concreta: pedir o próximo dado, confirmar um horário específico, sugerir um único horário ou informar que o atendente assumirá. Ao marcar ligação, sugira sempre um único horário concreto entre 10h e 17h; nunca liste dois horários nem uma faixa de horários na mesma mensagem.",
    "Faça uma pergunta por vez. Adapte a formalidade ao contacto, mantendo sempre o padrão institucional do KLASSE. Não force a venda: responda ao que foi perguntado e conduza naturalmente para o próximo passo.",
    "Quando não souber ou a questão exigir intervenção humana, não invente: informe que um atendente dará continuidade.",
    "Na primeira qualificação, envie exactamente este bloco, com uma linha por item e sem texto antes ou depois:\n1. Que tipo de instituição é a sua\n2. Quantos alunos em média\n3. Localização\n4. Seu cargo e nome\nDepois disso, faça apenas uma pergunta por mensagem.",
    "Reconheça dados já enviados, mesmo quando vierem numa frase única. Não peça o nome da instituição separadamente; se o lead informar um nome como Escola do Futuro, guarde-o. Nunca repita uma pergunta já respondida e peça somente o dado que falta.",
    "Fluxo obrigatório: com os quatro dados completos, avance imediatamente para marcar uma ligação para saber mais detalhes. Se os dados estiverem incompletos, peça somente o que falta uma vez. Se esta for a segunda tentativa e ainda faltar dado, diga 'Perfeito' e sugira a ligação; não faça uma terceira recolha de dados.",
    "Se o lead responder com um horário depois de uma proposta de ligação, confirme de forma curta: 'Perfeito, [nome], às [horário] ligaremos para esclarecimentos. Obrigado e continuação de uma óptima [manhã/tarde/noite].'",
    "Não repita cumprimentos, contexto ou informações já respondidas; avance diretamente para o próximo passo comercial.",
    "Nunca invente preços, descontos, funcionalidades ou disponibilidade.",
    "Se perguntarem preço, não informe valores pelo WhatsApp nem invente preços; diga que um consultor poderá informar o preço durante uma ligação.",
    "Depois dos quatro dados iniciais, peça apenas uma informação por mensagem, somente quando necessária para avançar.",
    "Quando já souber instituição, alunos, localização e cargo, proponha imediatamente uma ligação para saber mais detalhes, com data e horário concretos. Nunca use apresentação, demonstração, demo ou reunião como nome do próximo passo.",
    "Não pergunte a dor no WhatsApp. A descoberta da dor será feita pelo atendente durante a ligação.",
    schedulingContext(),
    "handoff=true para reclamação, contrato, negociação, preço final, pedido de humano ou dúvida fora da base.",
    "optOut=true se o lead pedir para parar, remover ou não contactar.",
    "Para follow-up, não pressione: reconheça o contexto e faça uma pergunta simples.",
    "followUpHours deve ser 0 se não houver próximo passo, ou 24 para um único follow-up. Faça no máximo um follow-up por novo contacto. studentCount deve ser um número ou null. stage deve ser um de: por_acompanhar, por_ligar, reuniao, importante. contactGender só pode ser male ou female quando o nome indicar claramente; caso contrário, unknown.",
    knowledge,
    "Nome do contacto: " + (chat.name || "não informado"),
    "É follow-up: " + (followUp ? "sim" : "não"),
    "Perguntas anteriores sobre dados de qualificação: " + Number(context.qualificationAttempts || 0),
    "Conversa:", conversationText(messages),
  ].join("\n\n");

  let response;
  if (aiProvider === "deepseek") {
    response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(requestTimeoutMs),
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + aiKey },
      body: JSON.stringify({ model: aiModel || "deepseek-chat", messages: [{ role: "user", content: prompt }], temperature: 0.2, max_tokens: 180, response_format: { type: "json_object" } }),
    });
  } else {
    response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(aiModel) + ":generateContent?key=" + encodeURIComponent(aiKey), {
      method: "POST",
      signal: AbortSignal.timeout(requestTimeoutMs),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 180, responseMimeType: "application/json" } }),
    });
  }
  const payload = await response.json();
  if (!response.ok) throw new Error((payload.error && (payload.error.message || payload.error)) || aiProvider + " " + response.status);
  const raw = aiProvider === "deepseek"
    ? payload.choices?.[0]?.message?.content?.trim()
    : payload.candidates && payload.candidates[0] && payload.candidates[0].content.parts.map((part) => part.text || "").join("").trim();
  if (!raw) throw new Error("Gemini não retornou uma decisão");
  const decision = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, ""));
  if (!decision.reply || decision.optOut) return { ...decision, reply: null };
  return applyResponsePolicy(decision, { businessHours, callWindows });
}

async function send(chatId, text, idempotencyKey = "") {
  if (dryRun) { console.log("[DRY_RUN] " + mask(chatId) + " <- " + text); return "dry-" + crypto.randomUUID(); }
  const stableId = idempotencyKey
    ? "klasse-sales-" + crypto.createHash("sha256").update(String(idempotencyKey)).digest("hex").slice(0, 32)
    : "klasse-sales-" + crypto.randomUUID();
  try {
    await setPresence(chatId, "typing");
    await sleep(Math.min(2500, Math.max(900, text.length * 18)));
    const result = await waha("/api/sendText", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session, chatId, text, id: stableId, linkPreview: false }),
    });
    return result.id || result.messageId || "sent";
  } finally {
    try { await setPresence(chatId, "paused"); } catch (error) { console.error("[PRESENCE_ERROR] " + mask(chatId) + " " + error.message); }
  }
}

async function processChat(chat, options = {}) {
  const chatId = String(chat.id || "");
  if (!isDirectChat(chatId) || chatId === "status@broadcast" || isInternalChat(chatId)) {
    if (isInternalChat(chatId)) console.log("[SKIP_INTERNAL_CHAT] " + mask(chatId));
    return false;
  }
  if (!options.gateAlreadyChecked && !(await humanGate(chatId))) return false;
  const messages = await getMessages(chatId);
  const lastInbound = latestInbound(messages);
  if (!lastInbound || !lastInbound.id) return false;
  // Trabalhar numa cópia impede que uma falha de envio contamine o estado em memória.
  // A mensagem só é confirmada em state depois de uma ação concluída.
  const entry = { ...(state[chatId] || { followUps: 0 }) };
  if (chat.name && !entry.leadName) entry.leadName = String(chat.name).trim();
  const deferredInbound = entry.deferredInboundId === lastInbound.id;
  const replyChatId = replyTarget(chatId, lastInbound);
  const lastOutbound = latestOutbound(messages);
  const outboundAfterInbound = lastOutbound && Number(lastOutbound.timestamp || 0) >= Number(lastInbound.timestamp || 0);
  const noActionConfirmed = entry.noActionForInboundId === lastInbound.id;
  const inboundAcknowledged = entry.lastInboundId === lastInbound.id && (Boolean(outboundAfterInbound) || noActionConfirmed || entry.handoffNotified === true);
  if (inboundAcknowledged && !(deferredInbound && isBusinessHours())) return false;
  if (entry.handoff && entry.handoffNotified === true) {
    console.log("[HANDOFF_WAITING] " + mask(chatId));
    return false;
  }
  if (entry.unsupportedInstitution) return false;
  const latestText = textOf(lastInbound);
  if (entry.callProposed && /\b(?:10|11|13|14|16|17)h(?:\s*\d{2})?\b/i.test(latestText)) {
    await send(replyChatId, confirmedCallReply(chat, latestText), lastInbound.id);
    entry.lastInboundId = lastInbound.id;
    entry.handoff = true;
    entry.handoffNotified = false;
    entry.callProposed = false;
    entry.lastOutboundAt = now();
    state[chatId] = entry;
    console.log("[CALL_CONFIRMED] " + mask(chatId));
    return true;
  }
  if (unsupportedInstitutionPattern.test(textOf(lastInbound))) {
    await send(replyChatId, unsupportedInstitutionReply(), lastInbound.id);
    entry.unsupportedInstitution = true;
    entry.lastInboundId = lastInbound.id;
    entry.lastOutboundAt = now();
    state[chatId] = entry;
    try { await updateLeadLabels(chatId, messages, { intent: "", stage: "por_acompanhar", studentCount: null }); }
    catch (error) { console.error("[LABEL_ERROR] " + mask(chatId) + " " + error.message); }
    console.log("[UNSUPPORTED_INSTITUTION] " + mask(chatId));
    return true;
  }
  if (!isBusinessHours()) {
    const hasQualificationData = qualificationDataProvided(messages);
    if (entry.offHoursNotifiedDate !== localDateKey()) {
      await send(replyChatId, outsideBusinessHoursReply(hasQualificationData), lastInbound.id);
      entry.offHoursNotifiedDate = localDateKey();
      entry.lastInboundId = lastInbound.id;
      entry.deferredInboundId = lastInbound.id;
      entry.lastOutboundAt = now();
      state[chatId] = entry;
      try { await updateLeadLabels(chatId, messages, { intent: "", stage: "por_acompanhar", studentCount: null }); }
      catch (error) { console.error("[LABEL_ERROR] " + mask(chatId) + " " + error.message); }
      console.log("[OUTSIDE_HOURS_REPLY] " + mask(chatId));
      return true;
    }
    entry.lastInboundId = lastInbound.id;
    state[chatId] = entry;
    return false;
  }
  if (deferredInbound) entry.deferredInboundId = null;
  const decision = await generateDecision(chat, messages, false, entry);
  entry.updatedAt = now();
  entry.followUps = 0;
  entry.handoff = Boolean(decision.handoff);
  entry.noActionForInboundId = null;
  if (decision.reply) {
    decision.reply = normalizeSalesLanguage(decision.reply);
    await send(replyChatId, decision.reply, lastInbound.id);
    entry.lastOutboundAt = now();
    entry.nextFollowUpAt = decision.followUpHours ? now() + decision.followUpHours * 3600000 : null;
    console.log("[REPLY] " + mask(chatId) + " intent=" + decision.intent + " handoff=" + Boolean(decision.handoff));
    if (/\b(?:tipo|alunos|localiza(?:ção|cao)|cargo|nome)\b/i.test(decision.reply)) entry.qualificationAttempts = Number(entry.qualificationAttempts || 0) + 1;
    entry.callProposed = /ligação para saber mais detalhes/i.test(decision.reply);
  }
  try { await updateLeadLabels(chatId, messages, decision); }
  catch (error) { console.error("[LABEL_ERROR] " + mask(chatId) + " " + error.message); }
  if (entry.handoff && !entry.handoffNotified) {
    try { entry.handoffNotified = await notifyHandoff(chat, messages, decision); }
    catch (error) { console.error("[HANDOFF_ERROR] " + mask(chatId) + " " + error.message); }
    if (!entry.handoffNotified) throw new Error("Handoff não confirmado; a mensagem ficará pendente para nova tentativa.");
  }
  if (!decision.reply && !entry.handoff) entry.noActionForInboundId = lastInbound.id;
  entry.lastInboundId = lastInbound.id;
  state[chatId] = entry;
  return true;
}

async function processFollowUp(chat) {
  const chatId = String(chat.id || "");
  if (isInternalChat(chatId)) return;
  if (!(await humanGate(chatId))) return;
  const entry = state[chatId];
  if (!entry || !entry.nextFollowUpAt || entry.followUps >= maxFollowUps || entry.nextFollowUpAt > now()) return;
  const messages = await getMessages(chatId);
  const lastInbound = latestInbound(messages);
  if (!lastInbound || lastInbound.id !== entry.lastInboundId || entry.handoff || entry.unsupportedInstitution) {
    entry.nextFollowUpAt = null;
    return;
  }
  const replyChatId = replyTarget(chatId, lastInbound);
  const decision = await generateDecision(chat, messages, true);
  entry.followUps += 1;
  entry.nextFollowUpAt = null;
  if (decision.reply) {
    decision.reply = normalizeSalesLanguage(decision.reply);
    await send(replyChatId, decision.reply, lastInbound.id);
    entry.lastOutboundAt = now();
    entry.nextFollowUpAt = decision.followUpHours ? now() + decision.followUpHours * 3600000 : null;
    console.log("[FOLLOW_UP] " + mask(chatId) + " number=" + entry.followUps);
  }
}

async function tick() {
  if (queueEnabled) {
    const events = await claimInboxEvents();
    console.log("[QUEUE_TICK] events=" + (Array.isArray(events) ? events.length : 0));
    for (const event of Array.isArray(events) ? events : []) {
      const chat = { id: String(event.chat_id || "") };
      try {
        if (!(await humanGate(chat.id))) {
          await updateInboxEvent(event.id, { status: "pending", available_at: new Date(Date.now() + 60000).toISOString(), locked_at: null, locked_by: null, last_error: "human_gate_not_eligible", updated_at: new Date().toISOString() });
          continue;
        }
        await processChat(chat, { gateAlreadyChecked: true });
        await processFollowUp(chat);
        await updateInboxEvent(event.id, { status: "processed", processed_at: new Date().toISOString(), locked_at: null, locked_by: null, last_error: null, updated_at: new Date().toISOString() });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const retryDelay = Math.min(3600000, Math.max(60000, 60000 * Math.pow(2, Math.min(Number(event.attempts || 1), 5))));
        const nextStatus = Number(event.attempts || 1) >= 8 ? "dead_letter" : "failed";
        await updateInboxEvent(event.id, { status: nextStatus, available_at: new Date(Date.now() + retryDelay).toISOString(), locked_at: null, locked_by: null, last_error: message.slice(0, 1000), updated_at: new Date().toISOString() }).catch((updateError) => console.error("[QUEUE_UPDATE_ERROR] " + updateError.message));
        console.error("[QUEUE_EVENT_ERROR] " + mask(chat.id) + " " + message);
      }
    }
    if (now() - lastReconciliationAt >= reconciliationIntervalMs) {
      lastReconciliationAt = now();
      const allChats = (await getChats()).sort((a, b) => Number(b.lastMessage?.timestamp || 0) - Number(a.lastMessage?.timestamp || 0));
      const chats = allChats.slice(0, reconciliationChatLimit);
      console.log("[RECONCILIATION] chats=" + chats.length + " of=" + allChats.length);
      let reconciled = 0;
      for (const chat of chats) {
        try {
          if (await processChat(chat)) reconciled += 1;
          await processFollowUp(chat);
          if (reconciled >= maxNewChatsPerTick) break;
        } catch (error) { console.error("[RECONCILIATION_ERROR] " + mask(chat.id) + " " + error.message); }
      }
    }
    return;
  }
  const chats = (await getChats()).sort((a, b) => Number(b.lastMessage?.timestamp || 0) - Number(a.lastMessage?.timestamp || 0));
  console.log("[TICK] chats=" + chats.length + " pageSize=" + chatPageSize + " maxPages=" + maxChatPages);
  if (state.__activationGeneration !== activationGeneration) {
    for (const chat of chats) {
      const chatId = String(chat.id || "");
      if (!isDirectChat(chatId) || isInternalChat(chatId)) continue;
      try {
        const messages = await getMessages(chatId);
        const inbound = latestInbound(messages);
        if (inbound && inbound.id) state[chatId] = { lastInboundId: inbound.id, followUps: 0, bootstrappedAt: now() };
      } catch (error) { console.error("[ACTIVATION_BOOTSTRAP_ERROR] " + mask(chatId) + " " + error.message); }
    }
    state.__activationGeneration = activationGeneration;
    state.__bootstrapped = true;
    await fs.mkdir(new URL(".", "file://" + stateFile).pathname, { recursive: true }).catch(() => {});
    await fs.writeFile(stateFile, JSON.stringify(state, null, 2));
    console.log("Activation baseline created; historical messages will not trigger replies.");
    return;
  }
  if (bootstrap && !state.__bootstrapped) {
    for (const chat of chats) {
      const chatId = String(chat.id || "");
      if (!isDirectChat(chatId) || isInternalChat(chatId)) continue;
      try {
        const messages = await getMessages(chatId);
        const inbound = latestInbound(messages);
        if (inbound && inbound.id) state[chatId] = { lastInboundId: inbound.id, followUps: 0, bootstrappedAt: now() };
      } catch (error) { console.error("[BOOTSTRAP_ERROR] " + mask(chatId) + " " + error.message); }
    }
    state.__bootstrapped = true;
    await fs.mkdir(new URL(".", "file://" + stateFile).pathname, { recursive: true }).catch(() => {});
    await fs.writeFile(stateFile, JSON.stringify(state, null, 2));
    console.log("State bootstrapped; existing messages will not trigger replies.");
    return;
  }
  let newChatsProcessed = 0;
  for (const chat of chats) {
    try {
      const processed = await processChat(chat);
      if (processed) newChatsProcessed += 1;
      await processFollowUp(chat);
      if (newChatsProcessed >= maxNewChatsPerTick) break;
    } catch (error) { console.error("[CHAT_ERROR] " + mask(chat.id) + " " + error.message); }
  }
  await fs.mkdir(new URL(".", "file://" + stateFile).pathname, { recursive: true }).catch(() => {});
  await fs.writeFile(stateFile, JSON.stringify(state, null, 2));
  console.log("[TICK_DONE] chats=" + chats.length);
}

console.log("KLASSE WhatsApp Sales Agent session=" + session + " dryRun=" + dryRun + " pollMs=" + pollMs);
while (true) {
  try { await tick(); } catch (error) { console.error("[TICK_ERROR] " + error.message); }
  await sleep(pollMs);
}
