const TIME_CLAIM_RE = /\b(?:às|as|a partir das|das|depois das|antes das)\s*\d{1,2}(?::\d{2})?\s*h?\b|\b\d{1,2}(?::\d{2})?\s*h\b|\bhor[aá]rio(?:s)?\s+(?:de\s+)?atendimento\b/i;

const SAFE_HANDOFF_REPLY =
  "Para confirmar esse detalhe, vou encaminhar a sua mensagem para a nossa equipa. Um consultor KLASSE dará seguimento.";

function timeToMinutes(value) {
  const match = String(value).match(/(\d{1,2})(?::|h)?(\d{2})?/i);
  return match ? Number(match[1]) * 60 + Number(match[2] || 0) : null;
}

function hasAllowedCallTime(reply, callWindows) {
  if (!/\b(?:liga(?:ção|cao)|ligar|chamada|marcar|hor[aá]rio disponível|hor[aá]rios disponíveis)\b/i.test(reply)) return true;
  const times = [...reply.matchAll(/\b\d{1,2}(?::\d{2}|h\d{2}|h)\b/gi)].map((match) => timeToMinutes(match[0])).filter((value) => value !== null);
  if (times.length === 0) return true;
  const windows = String(callWindows || "").split(",").map((window) => [...window.matchAll(/\d{1,2}(?::\d{2}|h\d{2}|h)/gi)].map((match) => timeToMinutes(match[0]))).filter((window) => window.length >= 2);
  return times.every((time) => windows.some(([start, end]) => time >= start && time <= end));
}

export function applyResponsePolicy(decision, { businessHours = "", callWindows = "" } = {}) {
  const reply = typeof decision?.reply === "string" ? decision.reply.trim() : "";
  if (!reply || decision?.optOut) return { ...decision, reply: null, followUpHours: 0 };

  const mentionsOperationalTime = TIME_CLAIM_RE.test(reply);
  if (mentionsOperationalTime && !businessHours.trim()) {
    return {
      ...decision,
      reply: SAFE_HANDOFF_REPLY,
      intent: "operational_fact_unavailable",
      handoff: true,
      followUpHours: 0,
    };
  }

  if (!hasAllowedCallTime(reply, callWindows)) {
    return {
      ...decision,
      reply: SAFE_HANDOFF_REPLY,
      intent: "call_window_unavailable",
      handoff: true,
      followUpHours: 0,
    };
  }

  return {
    ...decision,
    reply,
    followUpHours: decision.handoff ? 0 : Number(decision.followUpHours) || 0,
  };
}

export const SAFE_HANDOFF_MESSAGE = SAFE_HANDOFF_REPLY;
