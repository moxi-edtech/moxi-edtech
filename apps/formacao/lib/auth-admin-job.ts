import "server-only";
import fs from "node:fs";
import path from "node:path";

type AdminAction =
  | "createUser"
  | "inviteUserByEmail"
  | "updateUserById"
  | "upsertProfile"
  | "upsertEscolaUser"
  | "upsertEscolaAdministrador"
  | "deleteUser"
  | "getUserById"
  | "listUsers"
  | "generateLink"
  | "findUserByEmail"
  | "resolveIdentifierToEmail"
  | "activateStudentAccess"
  | "resetStudentPassword"
  | "seedSuperAdmin"
  | "seedTest";

type AdminRequest = {
  action: AdminAction;
  payload: Record<string, unknown>;
};

const normalizeToken = (raw?: string | null) =>
  (raw || "").replace(/\\n/g, "").replace(/[\r\n]/g, "").trim();

function readTokenFromEnvFiles() {
  const candidates = [
    path.join(process.cwd(), ".env.local"),
    path.join(process.cwd(), "apps/formacao/.env.local"),
  ];

  for (const file of candidates) {
    try {
      if (!fs.existsSync(file)) continue;
      const content = fs.readFileSync(file, "utf8");
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const idx = trimmed.indexOf("=");
        if (idx <= 0) continue;
        const key = trimmed.slice(0, idx).trim();
        const value = trimmed.slice(idx + 1).trim();
        if (
          key === "AUTH_ADMIN_JOB_TOKEN" ||
          key === "CRON_SECRET" ||
          key === "KLASSE_AUTH_ADMIN_JOB_TOKEN" ||
          key === "KLASSE_JOB_TOKEN"
        ) {
          const normalized = normalizeToken(value);
          if (normalized) return normalized;
        }
      }
    } catch {
      // no-op: continue fallback chain
    }
  }

  return "";
}

function resolveJobsBase(req: Request) {
  const explicit = String(process.env.KLASSE_AUTH_ADMIN_JOB_BASE_URL ?? "").trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const k12Local = String(process.env.KLASSE_K12_LOCAL_ORIGIN ?? "").trim();
  if (k12Local) return k12Local.replace(/\/$/, "");

  let origin = "";
  try {
    origin = new URL(req.url).origin;
  } catch {
    origin = "";
  }

  if (!origin) return "";

  if (origin.includes("://formacao.lvh.me")) {
    return origin.replace("://formacao.lvh.me", "://app.lvh.me").replace(/\/$/, "");
  }
  if (origin.includes("://formacao.klasse.ao")) {
    return origin.replace("://formacao.klasse.ao", "://app.klasse.ao").replace(/\/$/, "");
  }

  return origin.replace(/\/$/, "");
}

export async function callAuthAdminJob(req: Request, action: AdminAction, payload: Record<string, unknown>) {
  const token = normalizeToken(
    process.env.AUTH_ADMIN_JOB_TOKEN ||
      process.env.CRON_SECRET ||
      process.env.KLASSE_AUTH_ADMIN_JOB_TOKEN ||
      process.env.KLASSE_JOB_TOKEN
  ) || readTokenFromEnvFiles();
  if (!token) {
    throw new Error(
      "Missing auth-admin job token. Set AUTH_ADMIN_JOB_TOKEN (or CRON_SECRET) in the formacao production environment; use apps/formacao/.env.local only for local dev."
    );
  }

  const base = resolveJobsBase(req);
  if (!base) {
    throw new Error("Missing auth-admin base URL. Set KLASSE_AUTH_ADMIN_JOB_BASE_URL or KLASSE_K12_LOCAL_ORIGIN.");
  }

  const response = await fetch(`${base}/api/jobs/auth-admin`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-job-token": token,
    },
    body: JSON.stringify({ action, payload } satisfies AdminRequest),
    cache: "no-store",
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.ok) {
    throw new Error(data?.error || "Auth admin job failed");
  }

  return data.data;
}
