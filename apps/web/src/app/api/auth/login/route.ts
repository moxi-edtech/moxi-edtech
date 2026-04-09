// apps/web/src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { Database } from "~types/supabase";
import { callAuthAdminJob } from "@/lib/auth-admin-job";
import { PayloadLimitError, readJsonWithLimit } from "@/lib/http/readJsonWithLimit";
import { extractLoginCredentials, mapAuthError } from "@/lib/auth/loginHardening";
import { logAuthEvent } from "@/lib/auth/logAuthEvent";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const LOGIN_MAX_JSON_BYTES = 16 * 1024; // 16KB
type AuthAdminFindByEmailResult = { user?: { id?: string } } | null;
type AuthAdminResolveIdentifierResult = { email?: string } | null;

// ---------- Helpers de env (deferidos para tempo de execução) ----------
function getSupabaseEnv() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const anonKey = (
    process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  ).trim();
  return { url, anonKey } as const;
}

// Safe helper to inspect anon key payload (no secret leakage)
function parseAnonKeyInfo(key: string | undefined) {
  try {
    if (!key) return null;
    const parts = key.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const json = JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
    return { ref: json?.ref as string | undefined, role: json?.role as string | undefined };
  } catch {
    return null;
  }
}

// ---------- Resolver identificador (numero_processo_login / telefone → email) ----------

async function resolveIdentifierToEmail(req: NextRequest, identifier: string): Promise<string | null> {
  if (identifier.includes("@")) return null;
  try {
    const result = (await callAuthAdminJob(req, "resolveIdentifierToEmail", {
      identifier,
    })) as AuthAdminResolveIdentifierResult;
    return result?.email ? String(result.email).toLowerCase() : null;
  } catch (error) {
    console.error("[login] resolveIdentifierToEmail error:", error);
    return null;
  }
}

// ---------- Handler principal ----------

export async function POST(req: NextRequest) {
  void req;
  return new NextResponse(
    JSON.stringify({ ok: false, error: "DEPRECATED_AUTH_FLOW" }),
    { status: 410, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } }
  );
}
