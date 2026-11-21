/**
 * Identidade offline: acesso somente após sessão validada pelo layout do aluno.
 * Não substitui autorização no backend, não é armazenamento encriptado.
 * Máximo 24 horas e nunca além da validade impressa no cartão.
 */
export const IDENTITY_CARD_CACHE_PREFIX = "klasse_id_card_cache_";
export const IDENTITY_CARD_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const VERSION = 3;

export type OfflineCardIdentity = {
  nome: string;
  processo: string;
  escola: string;
  sigla?: string;
  curso: string;
  turma: string;
  ano_letivo: number;
  validade: string;
  verification_url: string;
};

type CardEnvelope = {
  version: typeof VERSION;
  storedAt: number;
  expiresAt: number;
  identity: OfflineCardIdentity;
};

export function identityCardCacheKey(scope: {
  userId: string;
  escolaId: string;
  studentId: string | null;
}): string | null {
  if (!scope.userId || !scope.escolaId || !scope.studentId) return null;
  return IDENTITY_CARD_CACHE_PREFIX + "v" + VERSION + ":" +
    scope.userId + ":" + scope.escolaId + ":" + scope.studentId;
}

function cardValidUntil(value: string): number {
  // Um cartão válido até uma data civil inclui o último dia dessa data.
  const timestamp = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? Date.parse(value + "T23:59:59.999Z")
    : Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function isIdentity(value: unknown): value is OfflineCardIdentity {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const c = value as Record<string, unknown>;
  return ["nome", "processo", "escola", "curso", "turma", "validade", "verification_url"]
    .every((key) => typeof c[key] === "string")
    && typeof c.ano_letivo === "number"
    && Number.isFinite(c.ano_letivo);
}

export function saveIdentityCardCache(
  storage: Pick<Storage, "setItem" | "removeItem">,
  key: string | null,
  data: OfflineCardIdentity,
  now = Date.now(),
): boolean {
  if (!key || !key.startsWith(IDENTITY_CARD_CACHE_PREFIX + "v" + VERSION + ":")) return false;
  // Lista positiva: BI, fotografia, dados extra e tokens acidentais nunca entram no cache.
  const identity: OfflineCardIdentity = {
    nome: data.nome,
    processo: data.processo,
    escola: data.escola,
    curso: data.curso,
    turma: data.turma,
    ano_letivo: data.ano_letivo,
    validade: data.validade,
    verification_url: data.verification_url,
    ...(typeof data.sigla === "string" ? { sigla: data.sigla } : {}),
  };
  const expiresAt = Math.min(now + IDENTITY_CARD_CACHE_TTL_MS, cardValidUntil(identity.validade));
  if (!isIdentity(identity) || !Number.isFinite(now) || expiresAt <= now) {
    try { storage.removeItem(key); } catch { /* armazenamento inacessível */ }
    return false;
  }

  const envelope: CardEnvelope = { version: VERSION, storedAt: now, expiresAt, identity };
  try {
    storage.setItem(key, JSON.stringify(envelope));
    return true;
  } catch { return false; }
}

export function readIdentityCardCache(
  storage: Pick<Storage, "getItem" | "removeItem">,
  key: string | null,
  now = Date.now(),
): OfflineCardIdentity | null {
  if (!key || !key.startsWith(IDENTITY_CARD_CACHE_PREFIX + "v" + VERSION + ":")) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      storage.removeItem(key);
      return null;
    }
    const item = parsed as Partial<CardEnvelope>;
    if (item.version !== VERSION
      || typeof item.storedAt !== "number"
      || typeof item.expiresAt !== "number"
      || !Number.isFinite(item.storedAt)
      || !Number.isFinite(item.expiresAt)
      || item.storedAt > now
      || item.expiresAt <= now
      || item.expiresAt > item.storedAt + IDENTITY_CARD_CACHE_TTL_MS
      || !isIdentity(item.identity)
      || cardValidUntil(item.identity.validade) < now
    ) {
      storage.removeItem(key);
      return null;
    }
    return item.identity;
  } catch {
    try { storage.removeItem(key); } catch { /* armazenamento inacessível */ }
    return null;
  }
}

/** Purga formatos antigos e cartões expirados, independentemente da conta. */
export function pruneIdentityCardCache(storage: Storage, now = Date.now()) {
  try {
    for (let i = storage.length - 1; i >= 0; i -= 1) {
      const key = storage.key(i);
      if (!key?.startsWith(IDENTITY_CARD_CACHE_PREFIX)) continue;
      if (!key.startsWith(IDENTITY_CARD_CACHE_PREFIX + "v" + VERSION + ":")) {
        storage.removeItem(key);
      } else {
        readIdentityCardCache(storage, key, now);
      }
    }
  } catch { /* navegação privada */ }
}

/** Chamado antes de sair e também em SIGNED_OUT / troca de conta noutra aba. */
export function clearIdentityCardCache() {
  if (typeof window === "undefined") return;
  for (const name of ["localStorage", "sessionStorage"] as const) {
    try {
      const storage = window[name];
      for (let i = storage.length - 1; i >= 0; i -= 1) {
        const key = storage.key(i);
        if (key?.startsWith(IDENTITY_CARD_CACHE_PREFIX)) storage.removeItem(key);
      }
    } catch { /* armazenamento bloqueado: não impedir logout */ }
  }
}
