"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { supabaseRouteClient } from "@/lib/supabaseServer";
import { logAuthEvent } from "@/lib/auth-log";
import { readEnv } from "@/lib/env";
import { checkLoginRateLimit } from "@/lib/rateLimit";

type ResolveIdentifierJobResponse = {
  ok?: boolean;
  data?: { email?: string };
  error?: string;
};

const LoginSchema = z.object({
  identifier: z.string().trim().min(1, "Informe o email ou número de processo."),
  password: z.string().min(1, "A senha não pode estar em branco."),
  redirect_to: z.string().optional(),
});

function normalizeReturnTo(raw: string | null | undefined) {
  const value = String(raw ?? "").trim();
  if (!value) return "";
  if (value.startsWith("/")) return value;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return "";
}

async function resolveIdentifierToEmail(identifier: string): Promise<string | null> {
  if (identifier.includes("@")) return identifier.toLowerCase();

  const token = readEnv(process.env.AUTH_ADMIN_JOB_TOKEN, process.env.CRON_SECRET);
  if (!token) return null;

  const baseUrl = readEnv(
    process.env.AUTH_ADMIN_BASE_URL,
    process.env.NODE_ENV === "development" ? "http://auth.lvh.me:3000" : "https://app.klasse.ao"
  );

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/jobs/auth-admin`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-job-token": token,
      },
      body: JSON.stringify({ action: "resolveIdentifierToEmail", payload: { identifier } }),
      cache: "no-store",
    });

    const json = (await response.json().catch(() => null)) as ResolveIdentifierJobResponse | null;
    if (!response.ok || !json?.ok) return null;

    const email = json.data?.email;
    if (!email) return null;
    return email.toLowerCase();
  } catch {
    return null;
  }
}

export async function loginAction(_: unknown, formData: FormData) {
  const headerStore = await headers();
  const ip = headerStore.get("x-forwarded-for") ?? headerStore.get("x-real-ip") ?? "unknown";
  const rate = await checkLoginRateLimit(ip);
  if (!rate.success) {
    logAuthEvent({
      action: "deny",
      route: "/login",
      details: { reason: "rate_limited", ip: rate.ip },
    });
    return { ok: false, message: "Muitas tentativas. Tente novamente em instantes." };
  }

  const parsed = LoginSchema.safeParse({
    identifier: formData.get("identifier"),
    password: formData.get("password"),
    redirect_to: formData.get("redirect_to"),
  });

  if (!parsed.success) {
    const message = parsed.error.errors.map((err) => err.message).join(" ");
    logAuthEvent({
      action: "deny",
      route: "/login",
      details: { reason: "invalid_payload", ip: rate.ip },
    });
    return { ok: false, message };
  }

  console.info(
    JSON.stringify({
      event: "login_attempt",
      user: parsed.data.identifier.trim().toLowerCase(),
      ip: rate.ip,
      timestamp: new Date().toISOString(),
    })
  );

  try {
    const email = await resolveIdentifierToEmail(parsed.data.identifier);
    if (!email) {
      throw new Error("INVALID_CREDENTIALS");
    }

    const supabase = await supabaseRouteClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: parsed.data.password,
    });

    if (error || !data.user) {
      throw new Error("INVALID_CREDENTIALS");
    }

    logAuthEvent({
      action: "login",
      route: "/login",
      user_id: data.user.id,
      tenant_type: null,
      details: { ip: rate.ip },
    });
    console.info(
      JSON.stringify({
        event: "login_success",
        path: "/login",
        hasSession: true,
        timestamp: new Date().toISOString(),
      })
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("Supabase env")) {
      return { ok: false, message: "Configuração de autenticação inválida no servidor." };
    }
    logAuthEvent({
      action: "deny",
      route: "/login",
      details: { reason: "invalid_credentials", ip: rate.ip },
    });
    return { ok: false, message: "Credenciais inválidas. Verifique os dados e tente novamente." };
  }

  const returnTo = normalizeReturnTo(parsed.data.redirect_to);
  const qs = returnTo ? `?redirect=${encodeURIComponent(returnTo)}` : "";
  redirect(`/redirect${qs}`);
}
